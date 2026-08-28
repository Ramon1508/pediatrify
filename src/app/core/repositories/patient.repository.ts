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
  serverTimestamp,
} from 'firebase/firestore';
import { FirebaseService } from '../firebase/firebase.service';
import { Patient, VaccineDose } from '../models/user';
import { normalizeEmail } from '../utils/normalize-email';
import { dateToString } from '../utils/date-utils';
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

  private normalizeVaccinationRecord(record: Patient['vaccinationRecord']): Patient['vaccinationRecord'] {
    if (!record) return record;
    const normalized: Record<string, Record<string, VaccineDose>> = {};
    for (const [vaccine, doses] of Object.entries(record)) {
      normalized[vaccine] = {};
      for (const [age, dose] of Object.entries(doses ?? {})) {
        const applicationDate = dose.applicationDate ? dateToString(dose.applicationDate) : '';
        normalized[vaccine][age] = {
          ...dose,
        };
        if (applicationDate) normalized[vaccine][age].applicationDate = applicationDate;
        else delete normalized[vaccine][age].applicationDate;
      }
    }
    return normalized;
  }

  private mapPatient(data: any): Patient {
    return {
      ...data,
      birthDate: dateToString(data.birthDate),
      vaccinationRecord: this.normalizeVaccinationRecord(data.vaccinationRecord),
    } as Patient;
  }

  private normalizePatientDates<T extends Partial<Patient>>(data: T): T {
    const normalized: any = { ...data };
    if ('birthDate' in normalized) normalized.birthDate = dateToString(normalized.birthDate);
    if ('vaccinationRecord' in normalized) {
      normalized.vaccinationRecord = this.normalizeVaccinationRecord(normalized.vaccinationRecord);
    }
    return normalized as T;
  }

  async getPatient(id: string): Promise<Patient | null> {
    const snapshot = await getDoc(this.docRef(id));
    return snapshot.exists() ? this.mapPatient(snapshot.data()) : null;
  }

  async getPatientByEmail(email: string): Promise<Patient | null> {
    const all = await this.getAllPatients();
    return all.find((p) => p.email === email) || null;
  }

  async createPatient(id: string, data: Patient): Promise<void> {
    if (!data.doctorId) {
      throw new Error('createPatient: doctorId es obligatorio para crear un paciente');
    }
    await setDoc(this.docRef(id), {
      ...this.normalizePatientDates(data),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  async updatePatient(id: string, data: Partial<Patient>): Promise<void> {
    // Nunca permitir que un update sobrescriba/borre el doctorId del paciente.
    const clean = { ...data };
    if (clean.doctorId === undefined) {
      delete clean.doctorId;
    }
    await updateDoc(this.docRef(id), {
      ...this.normalizePatientDates(clean),
      updatedAt: serverTimestamp(),
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
    return docsSnap.docs.map((d) => this.mapPatient(d.data()));
  }

  async getPatientsByDoctor(doctorId: string): Promise<Patient[]> {
    const q = query(this.patientRef, where('doctorId', '==', doctorId));
    const docsSnap = await getDocs(q);
    return docsSnap.docs.map((d) => this.mapPatient(d.data()));
  }

  async findPatientsByLoginEmail(email: string): Promise<Patient[]> {
    const q1 = query(this.patientRef, where('email', '==', email));
    const q2 = query(this.patientRef, where('secondaryEmail', '==', email));
    const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    const map = new Map<string, Patient>();
    for (const snap of [s1, s2]) {
      for (const d of snap.docs) {
        map.set(d.id, this.mapPatient(d.data()));
      }
    }
    return [...map.values()];
  }

  /**
   * Todos los hijos que un tutor (padre) puede ver tras iniciar sesión con su correo + el OTP
   * de cualquiera de sus hijos: el correo del padre aparece como email PRIMARIO o SECUNDARIO
   * del hijo Y el hijo está registrado por el MISMO doctor al que entró.
   * La comparación se hace en cliente (normalizada) sobre los pacientes del doctor para ser
   * robusta a emails con mayúsculas/espacios en la BD.
   * El `otpPassword` es POR NIÑO y solo sirve para autenticar el login; NO filtra la familia
   * (el padre puede entrar con el OTP de cualquiera de sus hijos y ver a todos).
   */
  async getChildrenGroup(email: string, doctorId: string): Promise<Patient[]> {
    const normalizedEmail = normalizeEmail(email);
    const byDoc = await this.getPatientsByDoctor(doctorId);
    const group = byDoc.filter((p) => {
      const primary = normalizeEmail(p.email || '');
      const secondary = p.secondaryEmail ? normalizeEmail(p.secondaryEmail) : '';
      return (primary && primary === normalizedEmail) || (secondary && secondary === normalizedEmail);
    });
    return group;
  }

  watchPatient(id: string): Observable<Patient | null> {
    return new Observable((subscriber) => {
      const unsubscribe = onSnapshot(this.docRef(id), (snapshot) => {
        subscriber.next(snapshot.exists() ? this.mapPatient(snapshot.data()) : null);
      });
      return { unsubscribe };
    });
  }

  watchAllPatients(): Observable<Patient[]> {
    return new Observable((subscriber) => {
      const unsubscribe = onSnapshot(this.patientRef, (snapshot) => {
        const patients = snapshot.docs.map((doc) => this.mapPatient(doc.data()));
        subscriber.next(patients);
      });
      return { unsubscribe };
    });
  }
}
