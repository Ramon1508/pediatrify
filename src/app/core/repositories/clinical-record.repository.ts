import { Injectable, inject } from '@angular/core';
import { doc, getDoc, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { FirebaseService } from '../firebase/firebase.service';
import { ClinicalRecord } from '../models/clinical-record';
import { dateStringToLocalDate, dateToString } from '../utils/date-utils';
import { Observable, of, switchMap } from 'rxjs';
import { ClinicGatewayService, clinicFields } from '../services/clinic-gateway.service';

const RECORD_FIELDS = ['date', 'weight', 'height', 'headCircumference', 'bmi', 'saturation', 'temperature', 'motivoConsulta', 'diagnosis', 'notas', 'recommendations', 'visibleUntil', 'prescription', 'visibleUntilRx'];

@Injectable({ providedIn: 'root' })
export class ClinicalRecordRepository {
  private firebase = inject(FirebaseService);
  private gateway = inject(ClinicGatewayService);
  private get db() { return this.firebase.firestore; }
  private mapRecord(snapshot: {id: string; data(): unknown}): ClinicalRecord {
    const data = snapshot.data() as ClinicalRecord;
    return { ...data, id: snapshot.id, date: dateToString(data.date),
      visibleUntil: data.visibleUntil ? dateToString(data.visibleUntil) : undefined,
      visibleUntilRx: data.visibleUntilRx ? dateToString(data.visibleUntilRx) : undefined };
  }
  private changes(data: Partial<ClinicalRecord>) {
    const clean = clinicFields(data, RECORD_FIELDS);
    for (const key of ['date', 'visibleUntil', 'visibleUntilRx']) if (clean[key]) clean[key] = dateToString(clean[key]);
    return clean;
  }
  async get(id: string): Promise<ClinicalRecord | null> {
    if (this.gateway.principal()?.role !== 'doctor') throw new Error('Esta cuenta no puede consultar expedientes clínicos.');
    const snapshot = await getDoc(doc(this.db, 'clinicalRecords', id));
    return snapshot.exists() ? this.mapRecord(snapshot) : null;
  }
  async create(id: string, data: ClinicalRecord): Promise<void> {
    await this.gateway.mutate('record.create', id, this.changes(data), data.patientId);
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
    await this.gateway.mutate('record.update', id, this.changes(data));
  }
  async delete(id: string): Promise<void> { await this.gateway.mutate('record.delete', id); }
  async deleteMany(ids: string[]): Promise<void> { for (const id of ids) await this.delete(id); }

  async getByPatient(patientId: string): Promise<ClinicalRecord[]> {
    const principal = this.gateway.principal();
    if (principal?.role === 'patient') {
      const identity = principal.authUid;
      const lease = this.gateway.lease()?.id;
      const result = await this.gateway.call<{records: ClinicalRecord[]}>('getClinicPublications', { patientId });
      if (identity !== this.gateway.principal()?.authUid || lease !== this.gateway.lease()?.id) return [];
      return result.records;
    }
    if (principal?.role !== 'doctor' || !principal.doctorId) throw new Error('Esta cuenta no puede consultar expedientes clínicos.');
    const source = query(collection(this.db, 'clinicalRecords'), where('doctorId', '==', principal.doctorId), where('patientId', '==', patientId));
    return (await getDocs(source)).docs.map(item => this.mapRecord(item));
  }
  watchByPatient(patientId: string): Observable<ClinicalRecord[]> {
    return this.gateway.scope$.pipe(switchMap(principal => {
      if (principal?.role !== 'doctor' || !principal.doctorId) return of([]);
      const source = query(collection(this.db, 'clinicalRecords'), where('doctorId', '==', principal.doctorId), where('patientId', '==', patientId));
      return new Observable<ClinicalRecord[]>(subscriber => onSnapshot(source,
        snapshot => subscriber.next(snapshot.docs.map(item => this.mapRecord(item))), error => subscriber.error(error)));
    }));
  }
}
