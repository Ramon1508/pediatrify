import { Injectable, inject, NgZone } from '@angular/core';
import {
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  RecaptchaVerifier,
  linkWithPhoneNumber,
  ConfirmationResult,
  updatePassword,
} from 'firebase/auth';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { FirebaseService } from '../firebase/firebase.service';
import { UserRepository } from '../repositories/user.repository';
import { PatientRepository } from '../repositories/patient.repository';
import { AppUser, Patient, SessionUser, UserRole } from '../models/user';

export interface ProfileData {
  name: string;
  sexo: string;
  phone: string;
  especialidad: string;
  cedula: string;
  cedulaEspecialidad: string;
  consultorios: string;
  logoPath?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private firebase = inject(FirebaseService);
  private userRepo = inject(UserRepository);
  private patientRepo = inject(PatientRepository);
  private router = inject(Router);
  private ngZone = inject(NgZone);

  private sessionSubject = new BehaviorSubject<SessionUser>(null);
  session$ = this.sessionSubject.asObservable();

  private confirmationResult: ConfirmationResult | null = null;

  constructor() {
    const auth = this.firebase.auth;
    onAuthStateChanged(auth, (firebaseUser) => {
      this.ngZone.run(() => {
        if (firebaseUser) {
          this.loadDoctorSession(firebaseUser.uid);
        } else if (!this.isPatientSession) {
          this.sessionSubject.next(null);
        }
      });
    });
  }

  private get auth(): Auth {
    return this.firebase.auth;
  }

  private async loadDoctorSession(uid: string): Promise<void> {
    try {
      const user = await this.userRepo.getUser(uid);
      if (user) {
        this.sessionSubject.next({ type: 'doctor', user });
        if (!user.profileComplete) {
          this.router.navigate(['/setup-profile']);
        }
      }
    } catch (error) {
      console.error('Error loading user data', error);
      this.sessionSubject.next(null);
    }
  }

  async loginDoctor(email: string, password: string): Promise<AppUser> {
    const credential = await signInWithEmailAndPassword(this.auth, email, password);
    const user = await this.userRepo.getUser(credential.user.uid);
    if (!user) {
      await signOut(this.auth);
      throw new Error('Usuario no encontrado');
    }
    this.sessionSubject.next({ type: 'doctor', user });

    if (!user.profileComplete) {
      this.router.navigate(['/setup-profile']);
    }

    return user;
  }

  async loginPatient(email: string, password: string): Promise<Patient> {
    const patients = await this.patientRepo.getAllPatients();
    const patient = patients.find((p) => p.email === email && p.otpPassword === password);
    if (!patient) {
      throw new Error('Credenciales inválidas. Verifica tu correo y contraseña OTP.');
    }
    this.sessionSubject.next({ type: 'patient', patient });
    return patient;
  }

  async logout(): Promise<void> {
    if (this.currentDoctor) {
      await signOut(this.auth);
    }
    this.sessionSubject.next(null);
  }

  async completeProfile(data: ProfileData, newPassword: string): Promise<void> {
    const user = this.currentDoctor;
    if (!user) throw new Error('No hay sesión activa');

    await this.userRepo.updateUser(user.uid, {
      name: data.name,
      sexo: data.sexo,
      phone: data.phone,
      phoneVerified: true,
      especialidad: data.especialidad,
      cedula: data.cedula,
      cedulaEspecialidad: data.cedulaEspecialidad,
      consultorios: data.consultorios,
      logoPath: data.logoPath,
      profileComplete: true,
    });

    if (newPassword) {
      const fbUser = this.auth.currentUser;
      if (fbUser) {
        await updatePassword(fbUser, newPassword);
      }
    }

    await signOut(this.auth);
    this.sessionSubject.next(null);
  }

  async sendPhoneCode(phoneNumber: string): Promise<void> {
    const recaptchaId = 'recaptcha-container';
    let recaptcha = document.getElementById(recaptchaId);

    if (!recaptcha) {
      const div = document.createElement('div');
      div.id = recaptchaId;
      div.style.position = 'fixed';
      div.style.width = '0';
      div.style.height = '0';
      document.body.appendChild(div);
      recaptcha = div;
    }

    const verifier = new RecaptchaVerifier(this.auth, recaptchaId, {
      size: 'invisible',
    });

    if (!this.auth.currentUser) throw new Error('No hay sesión activa');

    this.confirmationResult = await linkWithPhoneNumber(this.auth.currentUser, phoneNumber, verifier);
  }

  async verifyPhoneCode(code: string): Promise<boolean> {
    if (!this.confirmationResult) throw new Error('No hay código pendiente');
    await this.confirmationResult.confirm(code);
    this.confirmationResult = null;
    return true;
  }

  get currentUserUid(): string | null {
    return this.auth.currentUser?.uid || null;
  }

  get session(): SessionUser {
    return this.sessionSubject.value;
  }

  get currentDoctor(): AppUser | null {
    const s = this.sessionSubject.value;
    return s?.type === 'doctor' ? s.user : null;
  }

  get currentPatient(): Patient | null {
    const s = this.sessionSubject.value;
    return s?.type === 'patient' ? s.patient : null;
  }

  get isAuthenticated(): boolean {
    return this.sessionSubject.value !== null;
  }

  private get isPatientSession(): boolean {
    return this.sessionSubject.value?.type === 'patient';
  }

  get isDoctor(): boolean {
    return this.sessionSubject.value?.type === 'doctor';
  }

  get isPatient(): boolean {
    return this.sessionSubject.value?.type === 'patient';
  }

  hasRole(role: UserRole): boolean {
    return this.currentDoctor?.role === role;
  }

  hasAnyRole(roles: UserRole[]): boolean {
    const role = this.currentDoctor?.role;
    return role ? roles.includes(role) : false;
  }

  async registerFromInvitation(
    email: string,
    password: string,
    data: ProfileData & { role: UserRole },
    pendingUid: string
  ): Promise<void> {
    const { deleteDoc, doc } = await import('firebase/firestore');

    const credential = await createUserWithEmailAndPassword(this.auth, email, password);
    const uid = credential.user.uid;

    await this.userRepo.createUser(uid, {
      uid,
      email,
      name: data.name,
      role: data.role,
      sexo: data.sexo,
      phone: data.phone,
      phoneVerified: false,
      especialidad: data.especialidad,
      cedula: data.cedula,
      cedulaEspecialidad: data.cedulaEspecialidad,
      consultorios: data.consultorios,
      logoPath: data.logoPath,
      profileComplete: true,
    });

    await deleteDoc(doc(this.firebase.firestore, 'users', pendingUid));

    await signOut(this.auth);
    this.sessionSubject.next(null);
  }
}
