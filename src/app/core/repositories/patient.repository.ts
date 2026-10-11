import { Injectable, inject } from '@angular/core';
import { doc, getDoc, collection, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { FirebaseService } from '../firebase/firebase.service';
import { Patient, VaccineDose } from '../models/user';
import { normalizeEmail } from '../utils/normalize-email';
import { dateToString } from '../utils/date-utils';
import { Observable, of, switchMap } from 'rxjs';
import { ClinicGatewayService, ClinicPatientCreation, clinicFields } from '../services/clinic-gateway.service';

const BASIC_FIELDS = ['name', 'lastName', 'birthDate', 'email', 'secondaryEmail', 'fatherName', 'motherName', 'phone', 'secondaryPhone', 'referredBy'];
const PATIENT_FIELDS = [...BASIC_FIELDS, 'bloodType', 'birthWeight', 'birthHeight', 'headCircumference', 'sex', 'birthMethod', 'hasAllergies', 'allergies', 'hasBeenHospitalized', 'hospitalizationReason', 'hasDisease', 'diseaseDescription', 'takesMedication', 'medicationDescription', 'vaccinationRecord', 'profileComplete'];

@Injectable({ providedIn: 'root' })
export class PatientRepository {
  private firebase = inject(FirebaseService);
  private gateway = inject(ClinicGatewayService);
  private get db() { return this.firebase.firestore; }
  private get collectionName() {
    const role = this.gateway.principal()?.role;
    if (role === 'doctor') return 'patients';
    if (role === 'assistant') return 'patientDirectory';
    if (role === 'patient') return 'patientPortal';
    throw new Error('Esta cuenta no puede consultar pacientes.');
  }

  private normalizeVaccinationRecord(record: Patient['vaccinationRecord']): Patient['vaccinationRecord'] {
    if (!record) return record;
    const normalized: Record<string, Record<string, VaccineDose>> = {};
    for (const [vaccine, doses] of Object.entries(record)) {
      normalized[vaccine] = {};
      for (const [age, dose] of Object.entries(doses ?? {})) {
        const applicationDate = dose.applicationDate ? dateToString(dose.applicationDate) : '';
        normalized[vaccine][age] = { ...dose };
        if (applicationDate) normalized[vaccine][age].applicationDate = applicationDate;
        else delete normalized[vaccine][age].applicationDate;
      }
    }
    return normalized;
  }

  private mapPatient(snapshot: { id: string; data(): unknown }): Patient {
    const data = snapshot.data() as Patient;
    return { ...data, id: snapshot.id, birthDate: dateToString(data.birthDate),
      vaccinationRecord: this.normalizeVaccinationRecord(data.vaccinationRecord) };
  }

  private normalizePatientDates(data: Partial<Patient>): Partial<Patient> {
    const normalized = { ...data };
    if ('birthDate' in data) normalized.birthDate = dateToString(data.birthDate);
    if ('vaccinationRecord' in data) normalized.vaccinationRecord = this.normalizeVaccinationRecord(data.vaccinationRecord);
    return normalized;
  }

  async getPatient(id: string): Promise<Patient | null> {
    if (this.gateway.principal()?.role === 'patient') return this.gateway.patientRead('patient', { id });
    const snapshot = await getDoc(doc(this.db, this.collectionName, id));
    return snapshot.exists() ? this.mapPatient(snapshot) : null;
  }

  async getPatientByEmail(email: string): Promise<Patient | null> {
    return (await this.getAllPatients()).find(patient => normalizeEmail(patient.email) === normalizeEmail(email)) ?? null;
  }

  async createPatient(operationId: string, data: Partial<Patient>, confirmedDuplicates: ('email' | 'name')[] = []): Promise<ClinicPatientCreation> {
    if ('otpPassword' in data) throw new Error('La contraseña se genera únicamente en el servidor.');
    return this.gateway.call<ClinicPatientCreation>('createClinicPatient', {
      operationId, patient: clinicFields(this.normalizePatientDates(data), BASIC_FIELDS), confirmedDuplicates,
    });
  }

  async updatePatient(id: string, data: Partial<Patient>): Promise<void> {
    if ('otpPassword' in data) throw new Error('Usa la renovación autorizada de contraseña.');
    await this.gateway.mutate('patient.update', id, clinicFields(this.normalizePatientDates(data), PATIENT_FIELDS));
  }

  async deletePatient(id: string): Promise<void> { await this.gateway.mutate('patient.delete', id); }
  async deletePatients(ids: string[]): Promise<void> { for (const id of ids) await this.deletePatient(id); }

  async getAllPatients(): Promise<Patient[]> {
    const doctorId = this.gateway.principal()?.doctorId;
    return doctorId ? this.getPatientsByDoctor(doctorId) : [];
  }

  async getPatientsByDoctor(doctorId: string): Promise<Patient[]> {
    const principal = this.gateway.principal();
    if (!doctorId || principal?.doctorId !== doctorId) return [];
    if (principal.role === 'patient') return this.gateway.getFamily();
    const source = query(collection(this.db, this.collectionName), where('doctorId', '==', doctorId));
    return (await getDocs(source)).docs.map(item => this.mapPatient(item));
  }

  async findPatientsByLoginEmail(email: string): Promise<Patient[]> {
    const normalized = normalizeEmail(email);
    return (await this.getAllPatients()).filter(patient =>
      normalizeEmail(patient.email ?? '') === normalized || normalizeEmail(patient.secondaryEmail ?? '') === normalized);
  }

  async getChildrenGroup(_email: string, doctorId: string): Promise<Patient[]> {
    const principal = this.gateway.principal();
    return principal?.role === 'patient' && principal.doctorId === doctorId ? this.gateway.getFamily() : [];
  }

  watchPatient(id: string): Observable<Patient | null> {
    return this.gateway.scope$.pipe(switchMap(principal => !principal ? of(null) : principal.role === 'patient' ? this.gateway.watchPatient<Patient | null>('patient', {id}) :
      new Observable<Patient | null>(subscriber => onSnapshot(doc(this.db, this.collectionName, id),
        snapshot => subscriber.next(snapshot.exists() ? this.mapPatient(snapshot) : null), error => subscriber.error(error)))));
  }

  watchPatientsByDoctor(doctorId: string): Observable<Patient[]> {
    return this.gateway.scope$.pipe(switchMap(principal => {
      if (!doctorId || principal?.doctorId !== doctorId || !['doctor', 'assistant'].includes(principal.role)) return of([]);
      const source = query(collection(this.db, this.collectionName), where('doctorId', '==', doctorId));
      return new Observable<Patient[]>(subscriber => onSnapshot(source,
        snapshot => subscriber.next(snapshot.docs.map(item => this.mapPatient(item))), error => subscriber.error(error)));
    }));
  }

  watchAllPatients(): Observable<Patient[]> {
    return this.gateway.scope$.pipe(switchMap(principal => principal?.doctorId ?
      this.watchPatientsByDoctor(principal.doctorId) : of([])));
  }
}
