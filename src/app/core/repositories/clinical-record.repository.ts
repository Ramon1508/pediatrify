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
  getDocs,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { FirebaseService } from '../firebase/firebase.service';
import { ClinicalRecord } from '../models/clinical-record';
import { dateStringToLocalDate, dateToString } from '../utils/date-utils';
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

  private mapRecord(data: any): ClinicalRecord {
    return {
      ...data,
      date: dateToString(data.date),
      visibleUntil: data.visibleUntil ? dateToString(data.visibleUntil) : undefined,
      visibleUntilRx: data.visibleUntilRx ? dateToString(data.visibleUntilRx) : undefined,
    } as ClinicalRecord;
  }

  private normalizeRecordDates<T extends Partial<ClinicalRecord>>(data: T): T {
    const normalized: any = { ...data };
    if ('date' in normalized) normalized.date = dateToString(normalized.date);
    if ('visibleUntil' in normalized && normalized.visibleUntil) {
      normalized.visibleUntil = dateToString(normalized.visibleUntil);
    }
    if ('visibleUntilRx' in normalized && normalized.visibleUntilRx) {
      normalized.visibleUntilRx = dateToString(normalized.visibleUntilRx);
    }
    return normalized as T;
  }

  async get(id: string): Promise<ClinicalRecord | null> {
    const snapshot = await getDoc(this.docRef(id));
    return snapshot.exists() ? this.mapRecord(snapshot.data()) : null;
  }

  async create(id: string, data: ClinicalRecord): Promise<void> {
    await setDoc(this.docRef(id), {
      ...this.normalizeRecordDates(data),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  async seedTestRecords(patientId: string, birthDate: string): Promise<void> {
    const data: { ageMo: number; weight: number; height: number }[] = [
      { ageMo: 0,  weight: 3.2, height: 50 },
      { ageMo: 1,  weight: 4.4, height: 54 },
      { ageMo: 2,  weight: 5.4, height: 58 },
      { ageMo: 3,  weight: 6.1, height: 61 },
      { ageMo: 4,  weight: 6.8, height: 63 },
      { ageMo: 5,  weight: 7.3, height: 65 },
      { ageMo: 6,  weight: 7.8, height: 67 },
      { ageMo: 8,  weight: 8.5, height: 70 },
      { ageMo: 10, weight: 9.2, height: 73 },
      { ageMo: 12, weight: 9.8, height: 76 },
      { ageMo: 15, weight: 10.7, height: 80 },
      { ageMo: 18, weight: 11.5, height: 83 },
      { ageMo: 21, weight: 12.2, height: 86 },
      { ageMo: 24, weight: 12.8, height: 88 },
      { ageMo: 27, weight: 13.3, height: 91 },
      { ageMo: 30, weight: 13.9, height: 93 },
      { ageMo: 33, weight: 14.5, height: 95 },
      { ageMo: 36, weight: 15.0, height: 97 },
    ];

    const birth = dateStringToLocalDate(birthDate);

    for (const d of data) {
      const visitDate = new Date(birth);
      visitDate.setMonth(visitDate.getMonth() + d.ageMo);
      const dateStr = dateToString(visitDate);
      const bmi = d.weight / ((d.height / 100) * (d.height / 100));

      const id = `${patientId}_test_${String(d.ageMo).padStart(2, '0')}`;
      await this.create(id, {
        id,
        patientId,
        date: dateStr,
        weight: d.weight,
        height: d.height,
        bmi: Math.round(bmi * 100) / 100,
        motivoConsulta: 'Consulta de desarrollo',
        diagnosis: 'Paciente sano',
        createdBy: 'seed',
      });
    }
  }

  async update(id: string, data: Partial<ClinicalRecord>): Promise<void> {
    await updateDoc(this.docRef(id), {
      ...this.normalizeRecordDates(data),
      updatedAt: serverTimestamp(),
    });
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(this.docRef(id));
  }

  async deleteMany(ids: string[]): Promise<void> {
    await Promise.all(ids.map((id) => deleteDoc(this.docRef(id))));
  }

  async getByPatient(patientId: string): Promise<ClinicalRecord[]> {
    const q = query(this.ref, where('patientId', '==', patientId));
    const docsSnap = await getDocs(q);
    return docsSnap.docs.map((d) => this.mapRecord(d.data()));
  }

  watchByPatient(patientId: string): Observable<ClinicalRecord[]> {
    return new Observable((subscriber) => {
      const q = query(this.ref, where('patientId', '==', patientId));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map((d) => this.mapRecord(d.data()));
        subscriber.next(items);
      });
      return { unsubscribe };
    });
  }
}
