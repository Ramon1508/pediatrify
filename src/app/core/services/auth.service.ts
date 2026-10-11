import { Injectable, inject, NgZone, OnDestroy } from '@angular/core';
import { Auth, User, signInWithEmailAndPassword, signInWithCustomToken, signOut, onAuthStateChanged,
  RecaptchaVerifier, linkWithPhoneNumber, ConfirmationResult, updatePassword } from 'firebase/auth';
import { doc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { FirebaseService } from '../firebase/firebase.service';
import { AppUser, Patient, SessionUser, UserRole } from '../models/user';
import { Sexo } from '../models/sexo';
import { StaffInvitationService, InvitationProfile } from './staff-invitation.service';
import { ClinicGatewayService, ClinicSessionResponse } from './clinic-gateway.service';
import { normalizeEmail } from '../utils/normalize-email';

export interface ProfileData {
  name: string; sexo: Sexo; phone: string; especialidad: string; cedula: string;
  cedulaEspecialidad: string; consultorios: string; logoPath?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
  private firebase = inject(FirebaseService);
  private invitations = inject(StaffInvitationService);
  private gateway = inject(ClinicGatewayService);
  private router = inject(Router);
  private zone = inject(NgZone);
  private sessionSubject = new BehaviorSubject<SessionUser>(null);
  readonly session$ = this.sessionSubject.asObservable();
  private resolveReady!: () => void;
  readonly ready = new Promise<void>(resolve => { this.resolveReady = resolve; });
  private authUnsubscribe?: Unsubscribe;
  private authorityListeners: Unsubscribe[] = [];
  private epoch = 0;
  private refreshGeneration = 0;
  private authenticating = false;
  private transitions: Promise<void> = Promise.resolve();
  private closingPromise: Promise<void> | null = null;
  private destroyed = false;
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private resumeRefresh: ReturnType<typeof setTimeout> | null = null;
  private heartbeatAt = 0;
  private heartbeatPending = false;
  private lastActivityAt: number | null = null;
  private readonly IDLE_MS = 3_600_000;
  private readonly ACTIVITY_KEY = 'pediatrify_activity';
  private readonly events = ['click', 'keydown', 'mousemove', 'pointerdown', 'touchstart', 'scroll'];
  private confirmationResult: ConfirmationResult | null = null;
  private readonly activityHandler = () => {
    if (document.visibilityState === 'hidden' || !this.checkInactivity()) return;
    this.lastActivityAt = Date.now();
    this.persistActivity();
    this.scheduleInactivity();
    void this.touchSession();
  };
  private readonly resumeHandler = () => {
    if (document.visibilityState !== 'hidden' && this.checkInactivity()) void this.refreshSession();
  };

  constructor() {
    // Cached profiles/passwords never establish identity.
    sessionStorage.removeItem('pediatrify_session');
    sessionStorage.removeItem('pediatrify_patient_activity');
    this.authUnsubscribe = onAuthStateChanged(this.auth, user => {
      if (this.authenticating || this.closingPromise || this.destroyed || this.isPatient) return;
      const epoch = ++this.epoch;
      this.clearLocal(false);
      void this.restoreFirebaseSession(user, epoch).finally(() => this.resolveReady());
    });
  }
  private get auth(): Auth { return this.firebase.auth; }

  private async restoreFirebaseSession(user: User | null, epoch: number): Promise<void> {
    if (!user) { sessionStorage.removeItem(this.ACTIVITY_KEY); return; }
    try {
      const result = await this.gateway.loadSession();
      if (result.session.type === 'patient') throw new Error('Ingresa nuevamente al portal de pacientes.');
      if (epoch !== this.epoch || this.destroyed || this.auth.currentUser?.uid !== user.uid) return;
      const activity = this.readActivity(result);
      if (activity === null) { await this.endSession(false, true); return; }
      this.establish(result, activity);
    } catch {
      if (epoch === this.epoch && !this.destroyed) {
        let patient = window.location.pathname.startsWith('/paciente');
        try { patient ||= JSON.parse(sessionStorage.getItem(this.ACTIVITY_KEY) ?? 'null')?.kind === 'patient'; } catch { /* Only a redirect hint. */ }
        await this.endSession(patient, true);
      }
    }
  }

  private establish(result: ClinicSessionResponse, lastActivityAt: number): void {
    this.stopTracking();
    this.gateway.publish(result);
    this.lastActivityAt = lastActivityAt;
    this.heartbeatAt = Date.now();
    this.publishSession(result.session);
    this.persistActivity();
    this.zone.runOutsideAngular(() => {
      for (const event of this.events) document.addEventListener(event, this.activityHandler, { capture: true, passive: true });
      document.addEventListener('visibilitychange', this.resumeHandler);
      window.addEventListener('focus', this.resumeHandler);
      window.addEventListener('pageshow', this.resumeHandler);
      this.scheduleInactivity();
    });
    const scope = result.principal;
    if (scope.role === 'patient') {
      const subscription = this.gateway.watchPatientSession().subscribe({
        next: verified => {
          if (this.gateway.principal()?.authUid !== verified.principal.authUid) return;
          this.gateway.publish(verified);
          this.publishSession(verified.session);
        },
        error: () => { void this.endSession(true, true); },
      });
      this.authorityListeners.push(() => subscription.unsubscribe());
      return;
    }
    const sources = ['securityPrincipals/' + scope.authUid, 'clinicSessions/' + result.lease.id];
    if (scope.userId) sources.push('users/' + scope.userId);
    for (const source of sources) this.authorityListeners.push(onSnapshot(doc(this.firebase.firestore, source), () => {
      if (this.resumeRefresh !== null) clearTimeout(this.resumeRefresh);
      this.resumeRefresh = setTimeout(() => { this.resumeRefresh = null; void this.refreshSession(); }, 0);
    }, () => { void this.endSession(this.isPatient, true); }));
  }
  private publishSession(session: SessionUser): void {
    if (JSON.stringify(this.sessionSubject.value) !== JSON.stringify(session)) this.zone.run(() => this.sessionSubject.next(session));
  }
  private readActivity(result: ClinicSessionResponse): number | null {
    try {
      const value = JSON.parse(sessionStorage.getItem(this.ACTIVITY_KEY) ?? 'null');
      const at = value?.lastActivityAt;
      return value?.authUid === result.principal.authUid && value?.sessionId === result.lease.id && Number.isFinite(at) &&
        at <= Date.now() && Date.now() - at < this.IDLE_MS ? at : null;
    } catch { return null; }
  }
  private persistActivity(): void {
    if (this.isPatient) { sessionStorage.removeItem(this.ACTIVITY_KEY); return; }
    const principal = this.gateway.principal();
    const lease = this.gateway.lease();
    if (!principal || !lease || this.lastActivityAt === null) return;
    try { sessionStorage.setItem(this.ACTIVITY_KEY, JSON.stringify({ authUid: principal.authUid, sessionId: lease.id, kind: principal.role === 'patient' ? 'patient' : 'staff', lastActivityAt: this.lastActivityAt })); }
    catch { sessionStorage.removeItem(this.ACTIVITY_KEY); }
  }
  private checkInactivity(): boolean {
    if (!this.session || this.lastActivityAt === null) return false;
    const elapsed = Date.now() - this.lastActivityAt;
    if (elapsed < 0 || elapsed >= this.IDLE_MS) { void this.endSession(this.isPatient, true); return false; }
    return true;
  }
  private scheduleInactivity(): void {
    if (this.inactivityTimer !== null) clearTimeout(this.inactivityTimer);
    if (!this.session || this.lastActivityAt === null) return;
    this.inactivityTimer = setTimeout(() => { if (this.checkInactivity()) this.scheduleInactivity(); }, Math.max(0, this.IDLE_MS - (Date.now() - this.lastActivityAt)));
  }
  private async touchSession(): Promise<void> {
    if (this.heartbeatPending || Date.now() - this.heartbeatAt < 30_000 || !this.session) return;
    const epoch = this.epoch;
    this.heartbeatPending = true;
    try {
      await this.gateway.call('touchClinicSession', {});
      if (epoch === this.epoch) this.heartbeatAt = Date.now();
    } catch (failure) {
      if (epoch === this.epoch && ['functions/permission-denied', 'functions/unauthenticated'].includes((failure as { code?: string }).code ?? '')) await this.endSession(this.isPatient, true);
    } finally { this.heartbeatPending = false; }
  }
  private async refreshSession(): Promise<void> {
    if (!this.checkInactivity()) return;
    const epoch = this.epoch;
    const refresh = ++this.refreshGeneration;
    try {
      const result = await this.gateway.loadSession();
      if (epoch !== this.epoch || refresh !== this.refreshGeneration || this.destroyed) return;
      this.gateway.publish(result);
      this.publishSession(result.session);
    } catch (failure) {
      const code = (failure as { code?: string }).code;
      if (epoch === this.epoch && refresh === this.refreshGeneration && !['functions/unavailable', 'functions/deadline-exceeded'].includes(code ?? '')) await this.endSession(this.isPatient, true);
    }
  }
  private stopTracking(): void {
    if (this.inactivityTimer !== null) clearTimeout(this.inactivityTimer);
    if (this.resumeRefresh !== null) clearTimeout(this.resumeRefresh);
    this.inactivityTimer = null; this.resumeRefresh = null;
    for (const event of this.events) document.removeEventListener(event, this.activityHandler, true);
    document.removeEventListener('visibilitychange', this.resumeHandler);
    window.removeEventListener('focus', this.resumeHandler); window.removeEventListener('pageshow', this.resumeHandler);
    for (const stop of this.authorityListeners.splice(0)) stop();
  }
  private clearLocal(removeActivity = true): void {
    this.stopTracking(); this.gateway.clear(); this.lastActivityAt = null; this.publishSession(null);
    if (removeActivity) sessionStorage.removeItem(this.ACTIVITY_KEY);
  }
  private enqueueTransition<T>(work: () => Promise<T>): Promise<T> {
    const next = this.transitions.then(work, work);
    this.transitions = next.then(() => undefined, () => undefined);
    return next;
  }
  private endSession(patient: boolean, navigate: boolean): Promise<void> {
    if (this.closingPromise) return this.closingPromise;
    const epoch = ++this.epoch;
    const patientClose = this.gateway.capturePatientClose();
    this.clearLocal();
    this.authenticating = true;
    this.closingPromise = this.enqueueTransition(async () => {
      try {
        if (patientClose) await patientClose().catch(() => undefined);
        else await this.gateway.call('touchClinicSession', { close: true }).catch(() => undefined);
        if (this.auth.currentUser) await signOut(this.auth);
      }
      finally {
        this.authenticating = false;
        this.resolveReady();
        if (navigate && epoch === this.epoch && !this.destroyed) await this.router.navigate([patient ? '/patient-login' : '/login']);
      }
    }).finally(() => { this.closingPromise = null; });
    return this.closingPromise;
  }

  async loginDoctor(email: string, password: string): Promise<AppUser> {
    return this.enqueueTransition(async () => {
    const epoch = ++this.epoch;
    this.authenticating = true; this.clearLocal();
    try {
      await signInWithEmailAndPassword(this.auth, normalizeEmail(email), password);
      if (epoch !== this.epoch) throw new Error('La sesión cambió. Inicia sesión nuevamente.');
      const result = await this.gateway.call<{ token: string }>('startClinicStaffSession', {});
      if (!result?.token) throw new Error('No fue posible abrir la sesión.');
      if (epoch !== this.epoch) throw new Error('La sesión cambió. Inicia sesión nuevamente.');
      await signInWithCustomToken(this.auth, result.token);
      const verified = await this.gateway.loadSession();
      if (epoch !== this.epoch || verified.session.type !== 'doctor') throw new Error('La sesión cambió. Inicia sesión nuevamente.');
      this.establish(verified, Date.now());
      if (!verified.session.user.profileComplete) await this.router.navigate(['/setup-profile']);
      return verified.session.user;
    } catch (error) {
      if (epoch === this.epoch) { this.clearLocal(); await signOut(this.auth).catch(() => undefined); }
      throw error;
    } finally { this.authenticating = false; this.resolveReady(); }
    });
  }
  async loginPatient(email: string, password: string): Promise<Patient> {
    return this.enqueueTransition(async () => {
    const epoch = ++this.epoch;
    this.authenticating = true; this.clearLocal();
    try {
      if (this.auth.currentUser) await signOut(this.auth);
      const result = await this.gateway.call<{ token: string }>('loginClinicPatient', { email: normalizeEmail(email), password });
      if (!result?.token) throw new Error('Credenciales inválidas. Verifica tu correo y contraseña.');
      if (epoch !== this.epoch) throw new Error('La sesión cambió. Inicia sesión nuevamente.');
      this.gateway.openPatient(result.token);
      const verified = await this.gateway.loadSession();
      if (epoch !== this.epoch || verified.session.type !== 'patient') throw new Error('La sesión cambió. Inicia sesión nuevamente.');
      this.establish(verified, Date.now());
      return verified.session.patient;
    } catch (error) {
      if (epoch === this.epoch) { this.clearLocal(); await signOut(this.auth).catch(() => undefined); }
      throw error;
    } finally { this.authenticating = false; this.resolveReady(); }
    });
  }
  async logout(): Promise<void> { await this.endSession(this.isPatient, false); }
  async completeProfile(data: ProfileData, newPassword: string): Promise<void> {
    if (!this.currentDoctor || !this.auth.currentUser) throw new Error('No hay sesión activa');
    if (newPassword) await updatePassword(this.auth.currentUser, newPassword);
    const { name: _name, ...profile } = data;
    const result = await this.gateway.call<{ completed: boolean }>('completeClinicProfile', JSON.parse(JSON.stringify(profile)));
    if (!result?.completed) throw new Error('No fue posible completar el perfil. Reintenta con los mismos datos.');
    await this.logout();
  }
  async sendPhoneCode(phoneNumber: string): Promise<void> {
    const recaptchaId = 'recaptcha-container';
    if (!document.getElementById(recaptchaId)) {
      const element = document.createElement('div'); element.id = recaptchaId; element.style.display = 'none'; document.body.appendChild(element);
    }
    if (!this.auth.currentUser) throw new Error('No hay sesión activa');
    const verifier = new RecaptchaVerifier(this.auth, recaptchaId, { size: 'invisible' });
    this.confirmationResult = await linkWithPhoneNumber(this.auth.currentUser, phoneNumber, verifier);
  }
  async verifyPhoneCode(code: string): Promise<boolean> {
    if (!this.confirmationResult) throw new Error('No hay código pendiente');
    await this.confirmationResult.confirm(code); this.confirmationResult = null; return true;
  }
  get currentPatientLoginEmail(): string | null { return this.session?.type === 'patient' ? this.session.loginEmail ?? null : null; }
  get currentUserUid(): string | null { return this.auth.currentUser?.uid ?? null; }
  get session(): SessionUser { return this.sessionSubject.value; }
  get currentDoctor(): AppUser | null { return this.session?.type === 'doctor' ? this.session.user : null; }
  get currentPatient(): Patient | null { return this.session?.type === 'patient' ? this.session.patient : null; }
  get isAuthenticated(): boolean { return this.session !== null; }
  get isDoctor(): boolean { return this.session?.type === 'doctor'; }
  get isPatient(): boolean { return this.session?.type === 'patient'; }
  hasRole(role: UserRole): boolean { return this.currentDoctor?.role === role; }
  hasAnyRole(roles: UserRole[]): boolean { return !!this.currentDoctor && roles.includes(this.currentDoctor.role); }
  updateCurrentDoctor(_changes: Partial<AppUser>): void { void this.refreshSession(); }
  async registerFromInvitation(token: string, password: string, profile: InvitationProfile, operationId: string): Promise<void> {
    await this.invitations.complete(token, password, profile, operationId); await this.logout();
  }
  ngOnDestroy(): void { this.destroyed = true; ++this.epoch; this.stopTracking(); this.authUnsubscribe?.(); this.resolveReady(); }
}
