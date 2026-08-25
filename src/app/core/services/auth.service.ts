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
  deleteUser,
} from 'firebase/auth';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { FirebaseService } from '../firebase/firebase.service';
import { UserRepository } from '../repositories/user.repository';
import { PatientRepository } from '../repositories/patient.repository';
import { AppUser, Patient, SessionUser, UserRole } from '../models/user';
import { Sexo } from '../models/sexo';
import { normalizeEmail } from '../utils/normalize-email';

export interface ProfileData {
  name: string;
  sexo: Sexo;
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
  private readonly SESSION_KEY = 'pediatrify_session';
  private readonly INACTIVITY_MS = 3_600_000;
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private activityHandler: (() => void) | null = null;

  constructor() {
    const cached = this.loadSessionFromCache();
    if (cached) {
      this.sessionSubject.next(cached);
    }

    const auth = this.firebase.auth;
    onAuthStateChanged(auth, (firebaseUser) => {
      this.ngZone.run(() => {
        if (firebaseUser && !this.isPatientSession) {
          this.loadDoctorSession(firebaseUser.email ?? firebaseUser.uid);
        } else if (!firebaseUser && !this.isPatientSession) {
          this.setSession(null);
        }
      });
    });
  }

  private setSession(session: SessionUser): void {
    this.sessionSubject.next(session);
    this.saveSessionToCache(session);
    if (session?.type === 'doctor') {
      this.startInactivityTimer();
    } else {
      this.stopInactivityTimer();
    }
  }

  private startInactivityTimer(): void {
    this.stopInactivityTimer();
    this.inactivityTimer = setTimeout(() => this.logout(), this.INACTIVITY_MS);
    if (!this.activityHandler) {
      this.activityHandler = () => {
        if (this.inactivityTimer) {
          clearTimeout(this.inactivityTimer);
          this.inactivityTimer = setTimeout(() => this.logout(), this.INACTIVITY_MS);
        }
      };
      document.addEventListener('click', this.activityHandler);
      document.addEventListener('keydown', this.activityHandler);
      document.addEventListener('mousemove', this.activityHandler);
    }
  }

  private stopInactivityTimer(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
    if (this.activityHandler) {
      document.removeEventListener('click', this.activityHandler);
      document.removeEventListener('keydown', this.activityHandler);
      document.removeEventListener('mousemove', this.activityHandler);
      this.activityHandler = null;
    }
  }

  private saveSessionToCache(session: SessionUser): void {
    if (!session) {
      sessionStorage.removeItem(this.SESSION_KEY);
      return;
    }
    try {
      sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    } catch {
      sessionStorage.removeItem(this.SESSION_KEY);
    }
  }

  private loadSessionFromCache(): SessionUser | null {
    try {
      const raw = sessionStorage.getItem(this.SESSION_KEY);
      return raw ? (JSON.parse(raw) as SessionUser) : null;
    } catch {
      sessionStorage.removeItem(this.SESSION_KEY);
      return null;
    }
  }

  private get auth(): Auth {
    return this.firebase.auth;
  }

  private async loadDoctorSession(emailOrUid: string): Promise<void> {
    try {
      let user = await this.userRepo.getUserByEmail(normalizeEmail(emailOrUid));
      if (!user) {
        user = await this.userRepo.getUserByFirebaseUid(emailOrUid);
      }
      if (!user) {
        user = await this.userRepo.getUser(emailOrUid);
      }
      if (user) {
        this.setSession({ type: 'doctor', user });
        if (!user.profileComplete) {
          this.router.navigate(['/setup-profile']);
        }
      }
    } catch (error) {
      console.error('Error loading user data', error);
      this.setSession(null);
    }
  }

  async loginDoctor(email: string, password: string): Promise<AppUser> {
    const credential = await signInWithEmailAndPassword(this.auth, email, password);
    const normalizedEmail = normalizeEmail(email);
    let user = await this.userRepo.getUserByEmail(normalizedEmail);
    if (!user) {
      user = await this.userRepo.getUserByFirebaseUid(credential.user.uid);
    }
    if (!user) {
      user = await this.userRepo.getUser(credential.user.uid);
    }
    if (!user) {
      await signOut(this.auth);
      throw new Error('Usuario no encontrado');
    }
    await this.userRepo.updateUser(user.uid, {
      firebaseUid: credential.user.uid,
      email: normalizedEmail,
    });
    this.setSession({ type: 'doctor', user });

    if (!user.profileComplete) {
      this.router.navigate(['/setup-profile']);
    }

    return user;
  }

  async loginPatient(email: string, password: string): Promise<Patient> {
    const normalizedEmail = email.trim().toLowerCase();
    const candidates = await this.patientRepo.findPatientsByLoginEmail(normalizedEmail);
    const patient = candidates.find((p) => p.otpPassword === password);
    if (!patient) {
      throw new Error('Credenciales inválidas. Verifica tu correo y contraseña.');
    }
    // Evita que una sesión de doctor residual (Firebase Auth) se imponga sobre la del paciente
    // y que el paciente pueda acceder a rutas del doctor (/app/*).
    if (this.firebase.auth.currentUser) {
      await signOut(this.firebase.auth);
    }
    this.setSession({ type: 'patient', patient, loginEmail: normalizedEmail });
    return patient;
  }

  /** El correo con el que el padre inició sesión (puede diferir del email del hijo). */
  get currentPatientLoginEmail(): string | null {
    return this.sessionSubject.value?.type === 'patient'
      ? (this.sessionSubject.value as any).loginEmail ?? null
      : null;
  }

  async logout(): Promise<void> {
    if (this.currentDoctor) {
      await signOut(this.auth);
    }
    this.setSession(null);
  }

  async completeProfile(data: ProfileData, newPassword: string): Promise<void> {
    const user = this.currentDoctor;
    if (!user) throw new Error('No hay sesión activa');

    const fbUser = this.auth.currentUser;
    await this.userRepo.updateUser(user.uid, {
      name: data.name,
      sexo: data.sexo,
      phone: data.phone,
      phoneVerified: true,
      especialidad: data.especialidad,
      cedula: data.cedula,
      cedulaEspecialidad: data.cedulaEspecialidad,
      consultorios: data.consultorios,
      ...(data.logoPath ? { logoPath: data.logoPath } : {}),
      profileComplete: true,
      pending: false,
      ...(fbUser?.uid ? { firebaseUid: fbUser.uid } : {}),
    });

    if (newPassword) {
      const fbUser = this.auth.currentUser;
      if (fbUser) {
        await updatePassword(fbUser, newPassword);
      }
    }

    await signOut(this.auth);
    this.setSession(null);
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
    let credential;
    try {
      credential = await createUserWithEmailAndPassword(this.auth, email, password);
    } catch (e: any) {
      if (e.code === 'auth/email-already-in-use') {
        const cred = await signInWithEmailAndPassword(this.auth, email, password);
        await deleteUser(cred.user);
        credential = await createUserWithEmailAndPassword(this.auth, email, password);
      } else {
        throw e;
      }
    }

    await this.userRepo.updateUser(pendingUid, {
      firebaseUid: credential.user.uid,
      email: normalizeEmail(email),
      name: data.name,
      role: data.role,
      sexo: data.sexo,
      phone: data.phone,
      phoneVerified: false,
      especialidad: data.especialidad,
      cedula: data.cedula,
      cedulaEspecialidad: data.cedulaEspecialidad,
      consultorios: data.consultorios,
      ...(data.logoPath ? { logoPath: data.logoPath } : {}),
      profileComplete: true,
      pending: false,
    });

    await signOut(this.auth);
    this.setSession(null);
  }
}
