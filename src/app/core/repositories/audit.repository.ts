import { Injectable, inject } from '@angular/core';
import {
  Firestore,
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

  watchAll(limitCount = 200): Observable<AuditEntry[]> {
    return new Observable((subscriber) => {
      const q = query(this.auditRef, orderBy('timestamp', 'desc'), limit(limitCount));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map((d) => d.data() as AuditEntry);
        subscriber.next(items);
      }, (error) => subscriber.error(error));
      return { unsubscribe };
    });
  }
}
