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
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { FirebaseService } from '../firebase/firebase.service';
import { Appointment } from '../models/user';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AppointmentRepository {
  private firebase = inject(FirebaseService);

  private get db(): Firestore {
    return this.firebase.firestore;
  }

  private get appointmentRef() {
    return collection(this.db, 'appointments');
  }

  private docRef(id: string) {
    return doc(this.db, 'appointments', id);
  }

  async getAppointment(id: string): Promise<Appointment | null> {
    const snapshot = await getDoc(this.docRef(id));
    return snapshot.exists() ? (snapshot.data() as Appointment) : null;
  }

  async createAppointment(id: string, data: Appointment): Promise<void> {
    await setDoc(this.docRef(id), {
      ...data,
      createdAt: new Date(),
    });
  }

  async updateAppointment(id: string, data: Partial<Appointment>): Promise<void> {
    await updateDoc(this.docRef(id), { ...data });
  }

  async deleteAppointment(id: string): Promise<void> {
    await deleteDoc(this.docRef(id));
  }

  async getAllAppointments(): Promise<Appointment[]> {
    const docsSnap = await getDocs(this.appointmentRef);
    return docsSnap.docs.map((d) => d.data() as Appointment);
  }

  async getAppointmentsByDoctor(doctorId: string): Promise<Appointment[]> {
    const q = query(
      this.appointmentRef,
      where('doctorId', '==', doctorId),
      where('disabled', '==', false),
    );
    const docsSnap = await getDocs(q);
    return docsSnap.docs.map((d) => d.data() as Appointment);
  }

  watchAllAppointments(): Observable<Appointment[]> {
    return new Observable((subscriber) => {
      const q = query(this.appointmentRef, where('disabled', '==', false));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map((doc) => doc.data() as Appointment);
        subscriber.next(items);
      });
      return { unsubscribe };
    });
  }

  watchAppointmentsByDoctor(doctorId: string): Observable<Appointment[]> {
    return new Observable((subscriber) => {
      const q = query(
        this.appointmentRef,
        where('doctorId', '==', doctorId),
        where('disabled', '==', false),
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map((doc) => doc.data() as Appointment);
        subscriber.next(items);
      });
      return { unsubscribe };
    });
  }

  watchAppointmentsByUpdatedBy(email: string): Observable<Appointment[]> {
    return new Observable((subscriber) => {
      const q = query(
        this.appointmentRef,
        where('updatedBy', '==', email),
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map((doc) => doc.data() as Appointment);
        subscriber.next(items);
      });
      return { unsubscribe };
    });
  }
}
