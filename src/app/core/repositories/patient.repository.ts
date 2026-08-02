import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { FirebaseService } from '../firebase/firebase.service';
import { Patient } from '../models/user';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class PatientRepository {
  private firebase = inject(FirebaseService);

  private get db(): Firestore {
    return this.firebase.firestore;
  }

  private get patientRef() {
    return collection(this.db, 'patients');
  }

  private docRef(id: string) {
    return doc(this.db, 'patients', id);
  }

  async getPatient(id: string): Promise<Patient | null> {
    const snapshot = await getDoc(this.docRef(id));
    return snapshot.exists() ? (snapshot.data() as Patient) : null;
  }

  async getPatientByEmail(email: string): Promise<Patient | null> {
    const all = await this.getAllPatients();
    return all.find((p) => p.email === email) || null;
  }

  async createPatient(id: string, data: Patient): Promise<void> {
    await setDoc(this.docRef(id), {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async updatePatient(id: string, data: Partial<Patient>): Promise<void> {
    await updateDoc(this.docRef(id), {
      ...data,
      updatedAt: new Date(),
    });
  }

  async deletePatient(id: string): Promise<void> {
    await deleteDoc(this.docRef(id));
  }

  async deletePatients(ids: string[]): Promise<void> {
    await Promise.all(ids.map((id) => deleteDoc(this.docRef(id))));
  }

  async getAllPatients(): Promise<Patient[]> {
    const docsSnap = await getDocs(this.patientRef);
    return docsSnap.docs.map((d) => d.data() as Patient);
  }

  async getPatientsByDoctor(doctorId: string): Promise<Patient[]> {
    const q = query(this.patientRef, where('doctorId', '==', doctorId));
    const docsSnap = await getDocs(q);
    return docsSnap.docs.map((d) => d.data() as Patient);
  }

  async findPatientsByLoginEmail(email: string): Promise<Patient[]> {
    const q1 = query(this.patientRef, where('email', '==', email));
    const q2 = query(this.patientRef, where('secondaryEmail', '==', email));
    const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    const map = new Map<string, Patient>();
    for (const snap of [s1, s2]) {
      for (const d of snap.docs) {
        map.set(d.id, d.data() as Patient);
      }
    }
    return [...map.values()];
  }

  watchPatient(id: string): Observable<Patient | null> {
    return new Observable((subscriber) => {
      const unsubscribe = onSnapshot(this.docRef(id), (snapshot) => {
        subscriber.next(snapshot.exists() ? (snapshot.data() as Patient) : null);
      });
      return { unsubscribe };
    });
  }

  watchAllPatients(): Observable<Patient[]> {
    return new Observable((subscriber) => {
      const unsubscribe = onSnapshot(this.patientRef, (snapshot) => {
        const patients = snapshot.docs.map((doc) => doc.data() as Patient);
        subscriber.next(patients);
      });
      return { unsubscribe };
    });
  }
}
