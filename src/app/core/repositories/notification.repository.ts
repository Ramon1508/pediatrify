import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  writeBatch,
  doc,
  getDocs,
  updateDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
  startAfter,
  QueryDocumentSnapshot,
  QueryConstraint,
} from 'firebase/firestore';
import { Observable } from 'rxjs';
import { FirebaseService } from '../firebase/firebase.service';
import { ClinicGatewayService } from '../services/clinic-gateway.service';
import {
  AppNotification,
  NotificationFilter,
} from '../models/notification';

export interface NotificationPage {
  items: AppNotification[];
  lastVisible: NotificationCursor;
}
export type NotificationCursor = QueryDocumentSnapshot | string | null;

@Injectable({
  providedIn: 'root',
})
export class NotificationRepository {
  private firebase = inject(FirebaseService);
  private gateway = inject(ClinicGatewayService);

  private recipientScope(recipientId: string): QueryConstraint[] {
    const principal = this.gateway.principal();
    const ownId = principal?.role === 'patient' ? principal.patientId : principal?.userId;
    if (!principal?.doctorId || principal.role === 'admin' || recipientId !== ownId) {
      throw new Error('Esta cuenta no puede consultar esa bandeja.');
    }
    return [where('doctorId', '==', principal.doctorId), where('recipientId', '==', recipientId), where('recipientType', '==', principal.role)];
  }

  private get db(): Firestore {
    return this.firebase.firestore;
  }

  private get notificationRef() {
    return collection(this.db, 'notifications');
  }

  private docRef(id: string) {
    return doc(this.db, 'notifications', id);
  }

  /**
   * Pagina las notificaciones de un destinatario (bandeja).
   * - `all`: `where(recipientId == me) + orderBy(createdAt desc)`.
   * - `unread`: `where(recipientId == me) + where(read == false) + orderBy(createdAt desc)`.
   * Requiere los índices compuestos `recipientId + createdAt` y
   * `recipientId + read + createdAt`.
   */
  async getPage(
    recipientId: string,
    filter: NotificationFilter,
    pageSize: number,
    lastVisible: NotificationCursor = null
  ): Promise<NotificationPage> {
    if (this.gateway.principal()?.role === 'patient') {
      const result = await this.gateway.patientOperation<{value: AppNotification[]; cursor: string | null}>('notifications.page', {
        recipientId, filter, pageSize, cursor: typeof lastVisible === 'string' ? lastVisible : null,
      });
      return {items: result.value, lastVisible: result.cursor};
    }
    if (typeof lastVisible === 'string') throw new Error('La página pertenece a otra sesión.');
    let q = query(
      this.notificationRef,
      ...this.recipientScope(recipientId),
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    );
    if (filter === 'unread') {
      q = query(q, where('read', '==', false));
    }
    if (lastVisible) {
      q = query(q, startAfter(lastVisible));
    }
    const snapshot = await getDocs(q);
    return {
      items: snapshot.docs.map((d) => d.data() as AppNotification),
      lastVisible: snapshot.docs.length ? snapshot.docs[snapshot.docs.length - 1] : null,
    };
  }

  /**
   * Suscripción en tiempo real al número de notificaciones NO leídas del
   * destinatario. `where(recipientId == me) + where(read == false)` +
   * `snapshot.size` — cada usuario mira solo SUS docs.
   */
  watchUnreadCount(recipientId: string): Observable<number> {
    if (this.gateway.principal()?.role === 'patient') return this.gateway.watchPatient('notifications.count', {recipientId});
    return new Observable<number>((subscriber) => {
      const q = query(
        this.notificationRef,
        ...this.recipientScope(recipientId),
        where('read', '==', false),
        orderBy('createdAt', 'desc')
      );
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => subscriber.next(snapshot.size),
        (error) => {
          console.error('watchUnreadCount error:', error);
          subscriber.error(error);
        }
      );
      return { unsubscribe };
    });
  }

  /** Realtime de las notificaciones MÁS RECIENTES del destinatario (para prepend). */
  watchForRecipient(recipientId: string, limitCount = 100): Observable<AppNotification[]> {
    if (this.gateway.principal()?.role === 'patient') return this.gateway.watchPatient('notifications.latest', {recipientId, pageSize: limitCount});
    return new Observable((subscriber) => {
      const q = query(
        this.notificationRef,
        ...this.recipientScope(recipientId),
        orderBy('createdAt', 'desc'),
        limit(limitCount),
      );
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => subscriber.next(snapshot.docs.map((d) => d.data() as AppNotification)),
        (error) => {
          console.error('watchForRecipient error:', error);
          subscriber.error(error);
        },
      );
      return { unsubscribe };
    });
  }

  /** Marca UNA notificación del destinatario como leída. */
  async markRead(notificationId: string): Promise<void> {
    if (this.gateway.principal()?.role === 'patient') {
      await this.gateway.patientOperation('notification.read', {id: notificationId}); return;
    }
    await updateDoc(this.docRef(notificationId), { read: true });
  }

  /** Marca toda la bandeja pendiente del destinatario, incluida la no cargada en la UI. */
  async markAllRead(recipientId: string): Promise<string[]> {
    if (this.gateway.principal()?.role === 'patient') return this.markPatientBatch('notifications.read-all', recipientId);
    const pageSize = 100;
    const marked: string[] = [];
    let cursor: NotificationCursor = null;

    for (;;) {
      const page = await this.getPage(recipientId, 'unread', pageSize, cursor);
      if (!page.items.length) break;
      const batch = writeBatch(this.db);
      for (const notification of page.items) {
        batch.update(this.docRef(notification.id), { read: true });
      }
      await batch.commit();
      marked.push(...page.items.map((notification) => notification.id));
      cursor = page.lastVisible;
      if (page.items.length < pageSize || !cursor) break;
    }

    return marked;
  }

  /**
   * Marca como leídas TODAS las citas canceladas del destinatario.
   * `where(recipientId == me) + where(type == appointment-cancelled) +
   * where(read == false)`. Devuelve los ids marcados.
   */
  async markAllCancelledRead(recipientId: string): Promise<string[]> {
    if (this.gateway.principal()?.role === 'patient') return this.markPatientBatch('notifications.read-cancelled', recipientId);
    const PAGE = 100;
    const marked: string[] = [];
    let lastVisible: QueryDocumentSnapshot | null = null;

    for (;;) {
      let q = query(
        this.notificationRef,
        ...this.recipientScope(recipientId),
        where('type', '==', 'appointment-cancelled'),
        where('read', '==', false),
        limit(PAGE)
      );
      if (lastVisible) {
        q = query(q, startAfter(lastVisible));
      }
      const snapshot = await getDocs(q);
      if (snapshot.empty) break;

      const writes: Promise<void>[] = [];
      for (const d of snapshot.docs) {
        marked.push(d.id);
        writes.push(updateDoc(d.ref, { read: true }));
      }
      if (writes.length) {
        await Promise.all(writes);
      }
      lastVisible = snapshot.docs[snapshot.docs.length - 1];
      if (snapshot.docs.length < PAGE) break;
    }

    return marked;
  }

  private async markPatientBatch(action: string, recipientId: string): Promise<string[]> {
    const marked: string[] = [];
    for (;;) {
      const result = await this.gateway.patientRead<string[]>(action, {recipientId});
      marked.push(...result);
      if (result.length < 400) return marked;
    }
  }
}
