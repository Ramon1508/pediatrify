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
  serverTimestamp,
} from 'firebase/firestore';
import { FirebaseService } from '../firebase/firebase.service';
import { Appointment } from '../models/user';
import { dateToString } from '../utils/date-utils';
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

  private mapAppointment(data: any): Appointment {
    return {
      ...data,
      date: dateToString(data.date),
      patientBirthDate: dateToString(data.patientBirthDate),
    } as Appointment;
  }

  private normalizeAppointmentDates<T extends Partial<Appointment>>(data: T): T {
    const normalized: any = { ...data };
    if ('date' in normalized) normalized.date = dateToString(normalized.date);
    if ('patientBirthDate' in normalized) normalized.patientBirthDate = dateToString(normalized.patientBirthDate);
    return normalized as T;
  }

  async getAppointment(id: string): Promise<Appointment | null> {
    const snapshot = await getDoc(this.docRef(id));
    return snapshot.exists() ? this.mapAppointment(snapshot.data()) : null;
  }

  async createAppointment(id: string, data: Appointment): Promise<void> {
    await setDoc(this.docRef(id), {
      ...this.normalizeAppointmentDates(data),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  async updateAppointment(id: string, data: Partial<Appointment>): Promise<void> {
    await updateDoc(this.docRef(id), {
      ...this.normalizeAppointmentDates(data),
      updatedAt: serverTimestamp(),
    });
  }

  async deleteAppointment(id: string): Promise<void> {
    await deleteDoc(this.docRef(id));
  }

  async deleteAppointments(ids: string[]): Promise<void> {
    await Promise.all(ids.map((id) => deleteDoc(this.docRef(id))));
  }

  async getByPatient(patientId: string): Promise<Appointment[]> {
    const q = query(this.appointmentRef, where('patientId', '==', patientId));
    const docsSnap = await getDocs(q);
    return docsSnap.docs.map((d) => this.mapAppointment(d.data()));
  }

  async getAllByDoctor(doctorId: string): Promise<Appointment[]> {
    const q = query(this.appointmentRef, where('doctorId', '==', doctorId));
    const docsSnap = await getDocs(q);
    return docsSnap.docs.map((d) => this.mapAppointment(d.data()));
  }

  async getAllAppointments(): Promise<Appointment[]> {
    const docsSnap = await getDocs(this.appointmentRef);
    return docsSnap.docs.map((d) => this.mapAppointment(d.data()));
  }

  async getAppointmentsByDoctor(doctorId: string): Promise<Appointment[]> {
    const q = query(
      this.appointmentRef,
      where('doctorId', '==', doctorId),
      where('disabled', '==', false),
    );
    const docsSnap = await getDocs(q);
    return docsSnap.docs.map((d) => this.mapAppointment(d.data()));
  }

  watchOneAppointment(id: string): Observable<Appointment | null> {
    return new Observable((subscriber) => {
      const unsubscribe = onSnapshot(this.docRef(id), (snapshot) => {
        subscriber.next(snapshot.exists() ? this.mapAppointment(snapshot.data()) : null);
      });
      return { unsubscribe };
    });
  }

  watchAllAppointments(): Observable<Appointment[]> {
    return new Observable((subscriber) => {
      const q = query(this.appointmentRef, where('disabled', '==', false));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map((doc) => this.mapAppointment(doc.data()));
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
      );
      const unsubscribe = onSnapshot(q,
        (snapshot) => {
          const items = snapshot.docs
            .map((doc) => this.mapAppointment(doc.data()))
            .filter((a) => a.disabled !== true);
          subscriber.next(items);
        },
        (error) => {
          console.error('watchAppointmentsByDoctor error:', error);
          subscriber.error(error);
        },
      );
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
        const items = snapshot.docs.map((doc) => this.mapAppointment(doc.data()));
        subscriber.next(items);
      });
      return { unsubscribe };
    });
  }
}
