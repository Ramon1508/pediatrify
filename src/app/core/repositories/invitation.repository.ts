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
      where('email', '==', email)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const pendingDoc = snap.docs.find(d => d.data()['pending'] === true);
    if (!pendingDoc) return null;
    return { id: pendingDoc.id, ...pendingDoc.data() } as any;
  }

  async deletePendingUser(uid: string) {
    await deleteDoc(doc(this.firestore, 'users', uid));
  }
}
