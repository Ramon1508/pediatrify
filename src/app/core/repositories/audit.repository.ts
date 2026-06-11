import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  doc,
  setDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { FirebaseService } from '../firebase/firebase.service';
import { AuditEntry } from '../models/user';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuditRepository {
  private firebase = inject(FirebaseService);

  private get db(): Firestore {
    return this.firebase.firestore;
  }

  private get auditRef() {
    return collection(this.db, 'auditLog');
  }

  async log(entry: AuditEntry): Promise<void> {
    await setDoc(doc(this.db, 'auditLog', entry.id), entry);
  }

  watchAll(limitCount = 200): Observable<AuditEntry[]> {
    return new Observable((subscriber) => {
      const q = query(this.auditRef, orderBy('timestamp', 'desc'), limit(limitCount));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map((d) => d.data() as AuditEntry);
        subscriber.next(items);
      });
      return { unsubscribe };
    });
  }
}
