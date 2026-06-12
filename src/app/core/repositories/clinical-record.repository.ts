import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { FirebaseService } from '../firebase/firebase.service';
import { ClinicalRecord } from '../models/clinical-record';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ClinicalRecordRepository {
  private firebase = inject(FirebaseService);

  private get db(): Firestore {
    return this.firebase.firestore;
  }

  private get ref() {
    return collection(this.db, 'clinicalRecords');
  }

  private docRef(id: string) {
    return doc(this.db, 'clinicalRecords', id);
  }

  async get(id: string): Promise<ClinicalRecord | null> {
    const snapshot = await getDoc(this.docRef(id));
    return snapshot.exists() ? (snapshot.data() as ClinicalRecord) : null;
  }

  async create(id: string, data: ClinicalRecord): Promise<void> {
    await setDoc(this.docRef(id), {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async update(id: string, data: Partial<ClinicalRecord>): Promise<void> {
    await updateDoc(this.docRef(id), {
      ...data,
      updatedAt: new Date(),
    });
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(this.docRef(id));
  }

  watchByPatient(patientId: string): Observable<ClinicalRecord[]> {
    return new Observable((subscriber) => {
      const q = query(
        this.ref,
        where('patientId', '==', patientId),
        orderBy('date', 'desc'),
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map((d) => d.data() as ClinicalRecord);
        subscriber.next(items);
      });
      return { unsubscribe };
    });
  }
}
