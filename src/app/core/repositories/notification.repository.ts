import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { Observable } from 'rxjs';
import { FirebaseService } from '../firebase/firebase.service';
import { AppNotification } from '../models/notification';

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

  async create(notification: AppNotification): Promise<void> {
    await setDoc(this.docRef(notification.id), {
      ...notification,
      createdAt: new Date(),
    });
  }

  watchForRecipient(recipientId: string, limitCount = 100): Observable<AppNotification[]> {
    return new Observable((subscriber) => {
      const q = query(
        this.notificationRef,
        orderBy('createdAt', 'desc'),
        limit(limitCount),
      );
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const filtered = snapshot.docs
            .map((d) => d.data() as AppNotification)
            .filter((n) => (n.recipientIds ?? []).includes(recipientId));
          subscriber.next(filtered);
        },
        (error) => {
          console.error('watchForRecipient error:', error);
          subscriber.error(error);
        },
      );
      return { unsubscribe };
    });
  }

  async markRead(notificationId: string, recipientId: string): Promise<void> {
    const snapshot = await getDoc(this.docRef(notificationId));
    if (!snapshot.exists()) return;
    const notification = snapshot.data() as AppNotification;
    const alreadyRead = notification.recipients?.some(
      (r) => r.recipientId === recipientId && r.read === true
    );
    if (alreadyRead) return;
    const recipients = (notification.recipients ?? []).map((r) =>
      r.recipientId === recipientId ? { ...r, read: true } : r
    );
    await updateDoc(this.docRef(notificationId), { recipients });
  }

  async markAllRead(recipientId: string, notificationIds: string[]): Promise<void> {
    await Promise.all(
      notificationIds.map((id) => this.markRead(id, recipientId).catch(() => undefined))
    );
  }
}