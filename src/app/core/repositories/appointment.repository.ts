import { Injectable, inject } from '@angular/core';
import { doc, getDoc, collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { FirebaseService } from '../firebase/firebase.service';
import { Appointment } from '../models/user';
import { dateToString } from '../utils/date-utils';
import { Observable, of, switchMap, map } from 'rxjs';
import { ClinicGatewayService, clinicFields } from '../services/clinic-gateway.service';

export interface AppointmentOccupancy { id: string; doctorId: string; date: string; time: string; }

@Injectable({ providedIn: 'root' })
export class AppointmentRepository {
  private firebase = inject(FirebaseService);
  private gateway = inject(ClinicGatewayService);
  private get db() { return this.firebase.firestore; }
  private get ref() { return collection(this.db, 'appointments'); }
  private mapAppointment(snapshot: { id: string; data(): unknown }): Appointment {
    const data = snapshot.data() as Appointment;
    return { ...data, id: snapshot.id, date: dateToString(data.date), patientBirthDate: dateToString(data.patientBirthDate) };
  }
  private changes(data: Partial<Appointment>) {
    const clean = clinicFields(data, ['patientId', 'date', 'time', 'notes', 'status', 'disabled']);
    if ('date' in clean) clean['date'] = dateToString(data.date);
    return clean;
  }

  async getAppointment(id: string): Promise<Appointment | null> {
    if (this.gateway.principal()?.role === 'patient') return this.gateway.patientRead('appointment', { id });
    const snapshot = await getDoc(doc(this.db, 'appointments', id));
    return snapshot.exists() ? this.mapAppointment(snapshot) : null;
  }
  async createAppointment(id: string, data: Appointment): Promise<void> {
    await this.gateway.mutate('appointment.create', id, this.changes(data));
  }
  async updateAppointment(id: string, data: Partial<Appointment>): Promise<void> {
    await this.gateway.mutate('appointment.update', id, this.changes(data));
  }
  async deleteAppointment(id: string): Promise<void> { await this.gateway.mutate('appointment.delete', id); }
  async deleteAppointments(ids: string[]): Promise<void> { for (const id of ids) await this.deleteAppointment(id); }

  async getByPatient(patientId: string): Promise<Appointment[]> {
    if (this.gateway.principal()?.role === 'patient') return this.gateway.patientRead('appointments', { patientId });
    const doctorId = this.gateway.principal()?.doctorId;
    if (!doctorId) return [];
    const source = query(this.ref, where('doctorId', '==', doctorId), where('patientId', '==', patientId));
    return (await getDocs(source)).docs.map(item => this.mapAppointment(item));
  }
  async getAllByDoctor(doctorId: string): Promise<Appointment[]> {
    const principal = this.gateway.principal();
    if (!doctorId || principal?.doctorId !== doctorId) return [];
    if (principal.role === 'patient') {
      const children = await this.gateway.getFamily();
      return (await Promise.all(children.map(child => this.getByPatient(child.id)))).flat();
    }
    return (await getDocs(query(this.ref, where('doctorId', '==', doctorId)))).docs.map(item => this.mapAppointment(item));
  }
  async getAllAppointments(): Promise<Appointment[]> {
    const doctorId = this.gateway.principal()?.doctorId;
    return doctorId ? this.getAllByDoctor(doctorId) : [];
  }
  async getAppointmentsByDoctor(doctorId: string): Promise<Appointment[]> {
    return (await this.getAllByDoctor(doctorId)).filter(item => item.disabled !== true);
  }
  watchOneAppointment(id: string): Observable<Appointment | null> {
    return this.gateway.scope$.pipe(switchMap(principal => !principal ? of(null) : principal.role === 'patient' ? this.gateway.watchPatient<Appointment | null>('appointment', {id}) :
      new Observable<Appointment | null>(subscriber => onSnapshot(doc(this.db, 'appointments', id),
        snapshot => subscriber.next(snapshot.exists() ? this.mapAppointment(snapshot) : null), error => subscriber.error(error)))));
  }
  watchAllAppointments(): Observable<Appointment[]> {
    return this.gateway.scope$.pipe(switchMap(principal => principal?.doctorId ?
      this.watchAppointmentsByDoctor(principal.doctorId) : of([])));
  }
  watchAppointmentsByDoctor(doctorId: string): Observable<Appointment[]> {
    return this.gateway.scope$.pipe(switchMap(principal => {
      if (!doctorId || principal?.doctorId !== doctorId || principal.role === 'admin') return of([]);
      if (principal.role === 'patient') {
        return this.gateway.watchPatient<Appointment[]>('appointments', { doctorId }).pipe(map(items => items.filter(item => item.disabled !== true)));
      }
      return this.watchPatientAppointments(doctorId);
    }));
  }
  private watchPatientAppointments(doctorId: string, patientId?: string): Observable<Appointment[]> {
    const source = query(this.ref, where('doctorId', '==', doctorId), ...(patientId ? [where('patientId', '==', patientId)] : []));
    return new Observable<Appointment[]>(subscriber => onSnapshot(source,
      snapshot => subscriber.next(snapshot.docs.map(item => this.mapAppointment(item)).filter(item => item.disabled !== true)), error => subscriber.error(error)));
  }
  watchOccupiedSlots(doctorId: string): Observable<AppointmentOccupancy[]> {
    return this.gateway.scope$.pipe(switchMap(principal => principal?.doctorId !== doctorId || principal.role !== 'patient' ? of([]) :
      this.gateway.watchPatient<AppointmentOccupancy[]>('slots', { doctorId })));
  }
  watchAppointmentsByUpdatedBy(_email: string): Observable<Appointment[]> {
    const doctorId = this.gateway.principal()?.doctorId;
    return doctorId ? this.watchAppointmentsByDoctor(doctorId) : of([]);
  }
}
