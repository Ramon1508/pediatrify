import { Injectable, inject } from '@angular/core';
import {
  getDocs,
  collection,
  query,
  where,
  Timestamp,
  doc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { FirebaseService } from '../firebase/firebase.service';
import { normalizeEmail } from '../utils/normalize-email';

const ADMIN_EMAIL = normalizeEmail('valenzuela_luna@hotmail.com');

@Injectable({
  providedIn: 'root',
})
export class AdminInitService {
  private firebase = inject(FirebaseService);

  async ensureAdminExists(): Promise<void> {
    try {
      const firestore = this.firebase.firestore;
      const usersRef = collection(firestore, 'users');

      const existing = query(
        usersRef,
        where('email', '==', ADMIN_EMAIL)
      );
      const snap = await getDocs(existing);
      if (!snap.empty) return;

      const allSnap = await getDocs(usersRef);
      const matched = allSnap.docs.find(
        (d) => normalizeEmail(d.data()['email'] ?? '') === ADMIN_EMAIL
      );
      if (matched) {
        await updateDoc(doc(firestore, 'users', matched.id), { email: ADMIN_EMAIL });
        return;
      }

      const uid = crypto.randomUUID();
      await setDoc(doc(firestore, 'users', uid), {
        uid,
        email: ADMIN_EMAIL,
        name: 'José Ramón',
        role: 'admin',
        pending: true,
        createdAt: Timestamp.now(),
      });
    } catch (error: any) {
      console.error('Error creating admin pending user:', error);
    }
  }
}
