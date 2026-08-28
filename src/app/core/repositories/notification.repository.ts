import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  writeBatch,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
  startAfter,
  QueryDocumentSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { Observable } from 'rxjs';
import { FirebaseService } from '../firebase/firebase.service';
import {
  AppNotification,
  NotificationFilter,
  NotificationRecipient,
} from '../models/notification';

export interface NotificationPage {
  items: AppNotification[];
  lastVisible: QueryDocumentSnapshot | null;
}

/** Contenido compartido de una notificación, sin el estado por destinatario. */
export interface NotificationPayload {
  type: AppNotification['type'];
  title: string;
  description: string;
  appointmentId?: string;
  originatorId: string;
  originatorName: string;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationRepository {
  private firebase = inject(FirebaseService);

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
   * Crea UNA notificación por destinatario (fan-out) en un único `writeBatch`.
   * Cada doc trae el contenido compartido + su `recipientId`/`recipientType`
   * y `read: false`. 1 round-trip para N destinatarios.
   */
  async createMany(
    payload: NotificationPayload,
    recipients: NotificationRecipient[]
  ): Promise<void> {
    if (!recipients.length) return;
    const batch = writeBatch(this.db);
    for (const recipient of recipients) {
      const ref = doc(this.db, 'notifications', crypto.randomUUID());
      const notification: AppNotification = {
        id: ref.id,
        ...payload,
        createdAt: serverTimestamp() as any,
        recipientId: recipient.recipientId,
        recipientType: recipient.recipientType,
        read: false,
      };
      batch.set(ref, notification);
    }
    await batch.commit();
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
    lastVisible: QueryDocumentSnapshot | null = null
  ): Promise<NotificationPage> {
    let q = query(
      this.notificationRef,
      where('recipientId', '==', recipientId),
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
    return new Observable<number>((subscriber) => {
      const q = query(
        this.notificationRef,
        where('recipientId', '==', recipientId),
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
    return new Observable((subscriber) => {
      const q = query(
        this.notificationRef,
        where('recipientId', '==', recipientId),
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
    await updateDoc(this.docRef(notificationId), { read: true });
  }

  async markAllRead(recipientId: string, notificationIds: string[]): Promise<void> {
    await Promise.all(
      notificationIds.map((id) => this.markRead(id).catch(() => undefined))
    );
  }

  /**
   * Marca como leídas TODAS las citas canceladas del destinatario.
   * `where(recipientId == me) + where(type == appointment-cancelled) +
   * where(read == false)`. Devuelve los ids marcados.
   */
  async markAllCancelledRead(recipientId: string): Promise<string[]> {
    const PAGE = 100;
    const marked: string[] = [];
    let lastVisible: QueryDocumentSnapshot | null = null;

    for (;;) {
      let q = query(
        this.notificationRef,
        where('recipientId', '==', recipientId),
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
}
