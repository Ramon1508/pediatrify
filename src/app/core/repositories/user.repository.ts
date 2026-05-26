import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { FirebaseService } from '../firebase/firebase.service';
import { AppUser } from '../models/user';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class UserRepository {
  private firebase = inject(FirebaseService);

  private get db(): Firestore {
    return this.firebase.firestore;
  }

  private get userRef() {
    return collection(this.db, 'users');
  }

  private docRef(uid: string) {
    return doc(this.db, 'users', uid);
  }

  async getUser(uid: string): Promise<AppUser | null> {
    const snapshot = await getDoc(this.docRef(uid));
    return snapshot.exists() ? (snapshot.data() as AppUser) : null;
  }

  async createUser(uid: string, data: Partial<AppUser>): Promise<void> {
    await setDoc(this.docRef(uid), {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async updateUser(uid: string, data: Partial<AppUser>): Promise<void> {
    await updateDoc(this.docRef(uid), {
      ...data,
      updatedAt: new Date(),
    });
  }

  async deleteUser(uid: string): Promise<void> {
    await deleteDoc(this.docRef(uid));
  }

  watchUser(uid: string): Observable<AppUser | null> {
    return new Observable((subscriber) => {
      const unsubscribe = onSnapshot(this.docRef(uid), (snapshot) => {
        if (snapshot.exists()) {
          subscriber.next(snapshot.data() as AppUser);
        } else {
          subscriber.next(null);
        }
      });

      return { unsubscribe };
    });
  }

  watchAllUsers(): Observable<AppUser[]> {
    return new Observable((subscriber) => {
      const unsubscribe = onSnapshot(this.userRef, (snapshot) => {
        const users = snapshot.docs.map((doc) => doc.data() as AppUser);
        subscriber.next(users);
      });

      return { unsubscribe };
    });
  }
}
