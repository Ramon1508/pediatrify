import { Injectable, inject } from '@angular/core';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  deleteDoc,
} from 'firebase/firestore';
import { FirebaseService } from '../firebase/firebase.service';

@Injectable({ providedIn: 'root' })
export class InvitationRepository {
  private firestore = inject(FirebaseService).firestore;

  async findPendingUserByEmail(email: string) {
    const q = query(
      collection(this.firestore, 'users'),
      where('email', '==', email),
      where('pending', '==', true)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() } as any;
  }

  async deletePendingUser(uid: string) {
    await deleteDoc(doc(this.firestore, 'users', uid));
  }
}
