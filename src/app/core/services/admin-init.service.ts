import { Injectable, inject } from '@angular/core';
import {
  getDocs,
  collection,
  query,
  where,
  Timestamp,
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import { FirebaseService } from '../firebase/firebase.service';

const ADMIN_EMAIL = 'valenzuela_luna@hotmail.com';

@Injectable({
  providedIn: 'root',
})
export class AdminInitService {
  private firebase = inject(FirebaseService);

  async ensureAdminExists(): Promise<void> {
    try {
      const firestore = this.firebase.firestore;

      const existing = query(
        collection(firestore, 'users'),
        where('email', '==', ADMIN_EMAIL)
      );
      const snap = await getDocs(existing);
      if (!snap.empty) return;

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
