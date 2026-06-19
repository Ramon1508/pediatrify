import { Injectable, inject } from '@angular/core';
import {
  getDocs,
  getDoc,
  collection,
  query,
  where,
  Timestamp,
  doc,
  updateDoc,
  runTransaction,
} from 'firebase/firestore';
import { FirebaseService } from '../firebase/firebase.service';
import { normalizeEmail } from '../utils/normalize-email';

const ADMIN_EMAIL = normalizeEmail('valenzuela_luna@hotmail.com');
const ADMIN_SEED_UID = 'seed-admin-valenzuela-luna';

export type AdminInitResult =
  | 'seed-exists'
  | 'email-exists'
  | 'email-normalized'
  | 'admin-exists'
  | 'created'
  | 'error';

@Injectable({
  providedIn: 'root',
})
export class AdminInitService {
  private firebase = inject(FirebaseService);

  async ensureAdminExists(): Promise<AdminInitResult> {
    try {
      const firestore = this.firebase.firestore;
      const usersRef = collection(firestore, 'users');
      const seedRef = doc(firestore, 'users', ADMIN_SEED_UID);

      const seedSnap = await getDoc(seedRef);
      if (seedSnap.exists()) {
        const seedEmail = normalizeEmail(seedSnap.data()['email'] ?? '');
        if (seedEmail !== ADMIN_EMAIL) {
          await updateDoc(seedRef, { email: ADMIN_EMAIL });
        }
        return 'seed-exists';
      }

      const existing = query(usersRef, where('email', '==', ADMIN_EMAIL));
      const snap = await getDocs(existing);
      if (!snap.empty) return 'email-exists';

      const allSnap = await getDocs(usersRef);
      const matched = allSnap.docs.find(
        (d) => normalizeEmail(d.data()['email'] ?? '') === ADMIN_EMAIL
      );
      if (matched) {
        await updateDoc(doc(firestore, 'users', matched.id), { email: ADMIN_EMAIL });
        return 'email-normalized';
      }

      const registeredAdmin = allSnap.docs.find((d) => d.data()['role'] === 'admin');
      if (registeredAdmin) return 'admin-exists';

      let created = false;
      await runTransaction(firestore, async (transaction) => {
        const currentSeed = await transaction.get(seedRef);
        if (currentSeed.exists()) return;

        transaction.set(seedRef, {
          uid: ADMIN_SEED_UID,
          email: ADMIN_EMAIL,
          name: 'José Ramón',
          role: 'admin',
          pending: true,
          createdAt: Timestamp.now(),
        });
        created = true;
      });
      return created ? 'created' : 'seed-exists';
    } catch (error: any) {
      console.error('Error creating admin pending user:', error);
      return 'error';
    }
  }
}
