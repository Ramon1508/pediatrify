import { Injectable, inject } from '@angular/core';
import { Firestore, doc, getDoc, getDocs, collection, query, where, onSnapshot, Query } from 'firebase/firestore';
import { FirebaseService } from '../firebase/firebase.service';
import { AppUser } from '../models/user';
import { Observable, of, switchMap } from 'rxjs';
import { ClinicGatewayService, clinicFields } from '../services/clinic-gateway.service';

@Injectable({ providedIn: 'root' })
export class UserRepository {
  private firebase = inject(FirebaseService);
  private gateway = inject(ClinicGatewayService);
  private get db(): Firestore { return this.firebase.firestore; }

  private docRef(uid: string) {
    const principal = this.gateway.principal();
    if (!principal) throw new Error('Inicia sesión para consultar perfiles.');
    const own = principal.userId === uid;
    const collectionName = own ? 'users' :
      principal.doctorId === uid && ['assistant', 'patient'].includes(principal.role) ? 'doctorProfiles' : 'staffDirectory';
    return doc(this.db, collectionName, uid);
  }

  private mapDoc(snapshot: { id: string; data(): unknown }): AppUser {
    return { ...(snapshot.data() as object), uid: snapshot.id } as AppUser;
  }

  async getUser(uid: string): Promise<AppUser | null> {
    if (this.gateway.principal()?.role === 'patient') return this.gateway.patientRead('doctor', {doctorId: uid});
    const snapshot = await getDoc(this.docRef(uid));
    return snapshot.exists() ? this.mapDoc(snapshot) : null;
  }

  async getUserByFirebaseUid(firebaseUid: string): Promise<AppUser | null> {
    const principal = this.gateway.principal();
    return principal?.authUid === firebaseUid && principal.userId ? this.getUser(principal.userId) : null;
  }

  async getUserByEmail(email: string): Promise<AppUser | null> {
    const own = this.gateway.principal()?.userId;
    if (!own) return null;
    const profile = await this.getUser(own);
    return profile?.email.toLowerCase() === email.trim().toLowerCase() ? profile : null;
  }

  async getAssistantsByDoctor(doctorUid: string): Promise<AppUser[]> {
    const principal = this.gateway.principal();
    if (principal?.role !== 'doctor' || principal.userId !== doctorUid) return [];
    const source = query(collection(this.db, 'staffDirectory'), where('role', '==', 'assistant'), where('createdBy', '==', doctorUid));
    return (await getDocs(source)).docs.map(snapshot => this.mapDoc(snapshot));
  }

  async updateUser(uid: string, data: Partial<AppUser>): Promise<void> {
    if (['role', 'firebaseUid', 'createdBy', 'email', 'pending', 'profileComplete'].some(key => key in data)) {
      throw new Error('Usa el flujo autorizado para cambiar acceso o identidad.');
    }
    await this.gateway.mutate('profile.update', uid, clinicFields(data,
      ['name', 'sexo', 'phone', 'especialidad', 'cedula', 'cedulaEspecialidad', 'consultorios', 'logoPath', 'printSettings']));
  }

  async updateSchedule(uid: string, data: Partial<AppUser>): Promise<void> {
    await this.gateway.mutate('schedule.update', uid, clinicFields(data,
      ['consultationDuration', 'allowPatientScheduling', 'availableDays', 'timeSegmentsByDay', 'timeSegments']));
  }

  watchUser(uid: string): Observable<AppUser | null> {
    return this.gateway.scope$.pipe(switchMap(principal => !principal ? of(null) : principal.role === 'patient' ? this.gateway.watchPatient<AppUser | null>('doctor', {doctorId: uid}) :
      new Observable<AppUser | null>(subscriber => onSnapshot(this.docRef(uid),
        snapshot => subscriber.next(snapshot.exists() ? this.mapDoc(snapshot) : null),
        error => subscriber.error(error)))));
  }

  private directoryQuery(): Query | null {
    const principal = this.gateway.principal();
    if (principal?.role === 'admin') return query(collection(this.db, 'staffDirectory'), where('role', 'in', ['admin', 'doctor']));
    if (principal?.role === 'doctor') return query(collection(this.db, 'staffDirectory'), where('role', '==', 'assistant'), where('createdBy', '==', principal.userId));
    return null;
  }

  watchAllUsers(): Observable<AppUser[]> {
    return this.gateway.scope$.pipe(switchMap(() => {
      const source = this.directoryQuery();
      return !source ? of([]) : new Observable<AppUser[]>(subscriber =>
        onSnapshot(source, snapshot => subscriber.next(snapshot.docs.map(item => this.mapDoc(item))), error => subscriber.error(error)));
    }));
  }
}
