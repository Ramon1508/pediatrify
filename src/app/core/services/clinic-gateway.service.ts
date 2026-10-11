import { Injectable, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, Observable } from 'rxjs';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Timestamp } from 'firebase/firestore';
import { FirebaseService } from '../firebase/firebase.service';
import { SessionUser, Patient } from '../models/user';

export interface ClinicPrincipal {
  authUid: string; userId?: string; doctorId?: string; patientId?: string;
  role: 'admin' | 'doctor' | 'assistant' | 'patient'; active: boolean;
}
export interface ClinicSessionResponse {
  principal: ClinicPrincipal;
  lease: { id: string; expiresAt: number };
  session: Exclude<SessionUser, null>;
}
export type ClinicPatientCreation = { status: 'created'; patient: Patient } | { status: 'confirmation-required'; warnings: ('email' | 'name')[] };

/** Owns the verified access scope shared by repositories; browser caches never establish it. */
@Injectable({ providedIn: 'root' })
export class ClinicGatewayService {
  private firebase = inject(FirebaseService);
  readonly principal = signal<ClinicPrincipal | null>(null);
  readonly lease = signal<ClinicSessionResponse['lease'] | null>(null);
  readonly family = signal<Patient[]>([]);
  readonly scope$ = toObservable(this.principal).pipe(distinctUntilChanged((a, b) =>
    JSON.stringify(a) === JSON.stringify(b)));
  private pendingMutations = new Map<string, string>();
  private patientToken: string | null = null;

  openPatient(token: string): void {
    if (!/^[a-f0-9]{48}\.[a-f0-9]{64}$/.test(token)) throw new Error('No fue posible verificar el acceso.');
    this.patientToken = token;
  }
  private async patientCall<T>(action: string, data: unknown = {}, token = this.patientToken, closing = false): Promise<T> {
    if (!token) throw new Error('Ingresa nuevamente al portal.');
    const result = await this.rawCall<T>('patientPortal', { sessionToken: token, action, data });
    if (!closing && token !== this.patientToken) throw new Error('La sesión cambió. Ingresa nuevamente al portal.');
    return result;
  }
  async patientRead<T>(action: string, data: unknown = {}): Promise<T> {
    return (await this.patientCall<{ value: T }>(action, data)).value;
  }
  async patientOperation<T>(action: string, data: unknown = {}): Promise<T> {
    return this.patientCall<T>(action, data);
  }
  watchPatient<T>(action: string, data: unknown = {}): Observable<T> {
    return new Observable<T>(subscriber => {
      const token = this.patientToken;
      const controller = new AbortController();
      let retry: ReturnType<typeof setTimeout> | undefined;
      const connect = async () => {
        if (!token || controller.signal.aborted || token !== this.patientToken) return;
        try {
          const callable = httpsCallable<unknown, unknown, { value: T }>(getFunctions(this.firebase.auth.app, 'us-central1'), 'patientPortal', { timeout: 180_000 });
          const result = await callable.stream({ sessionToken: token, action, data }, { signal: controller.signal });
          const completion = result.data.catch(error => { throw error; });
          // Observe completion immediately so disconnect/error never creates an unhandled rejection.
          void completion.catch(() => undefined);
          for await (const chunk of result.stream) {
            if (!controller.signal.aborted && token === this.patientToken) subscriber.next(this.restoreTimestamps(chunk.value) as T);
          }
          await completion;
          if (!controller.signal.aborted && token === this.patientToken) retry = setTimeout(() => { void connect(); }, 1000);
        } catch (error) {
          if (controller.signal.aborted || token !== this.patientToken) return;
          const code = (error as {code?: string}).code;
          if (['functions/unauthenticated', 'functions/permission-denied'].includes(code ?? '')) subscriber.error(error);
          else retry = setTimeout(() => { void connect(); }, 3000);
        }
      };
      void connect();
      return () => { controller.abort(); clearTimeout(retry); };
    });
  }

  async call<T>(name: string, data: unknown): Promise<T> {
    if (this.patientToken) {
      const action = ({getClinicSession: 'session', touchClinicSession: 'touch', getClinicFamily: 'family', getClinicPublications: 'publications', saveClinicData: 'save'} as Record<string, string>)[name];
      if (!action) throw new Error('Esta operación no está disponible para pacientes.');
      return this.patientCall<T>(action, data);
    }
    return this.rawCall<T>(name, data);
  }
  private async rawCall<T>(name: string, data: unknown): Promise<T> {
    const callable = httpsCallable<unknown, T>(getFunctions(this.firebase.auth.app, 'us-central1'), name, { timeout: 540_000 });
    return this.restoreTimestamps((await callable(data)).data) as T;
  }

  async loadSession(): Promise<ClinicSessionResponse> {
    const result = await this.call<ClinicSessionResponse>('getClinicSession', {});
    if (!result?.principal?.active || !['admin', 'doctor', 'assistant', 'patient'].includes(result.principal.role) ||
        (result.principal.role === 'patient' ? !this.patientToken : result.principal.authUid !== this.firebase.auth.currentUser?.uid) || !result.lease?.id || !Number.isFinite(result.lease.expiresAt) || result.lease.expiresAt <= Date.now() ||
        !result.session || (result.principal.role === 'patient' ? result.session.type !== 'patient' : result.session.type !== 'doctor')) {
      throw new Error('Tu sesión no pudo verificarse. Inicia sesión nuevamente.');
    }
    if (result.session.type === 'patient' ? result.session.patient.id !== result.principal.patientId || result.session.patient.doctorId !== result.principal.doctorId :
      result.session.user.uid !== result.principal.userId || result.session.user.role !== result.principal.role || result.session.user.firebaseUid !== result.principal.authUid) {
      throw new Error('Tu sesión no pudo verificarse. Inicia sesión nuevamente.');
    }
    return result;
  }

  publish(result: ClinicSessionResponse): void {
    this.principal.set(result.principal);
    this.lease.set(result.lease);
  }

  clear(): void {
    this.patientToken = null;
    this.principal.set(null); this.lease.set(null); this.family.set([]); this.pendingMutations.clear();
  }

  capturePatientClose(): (() => Promise<void>) | null {
    const token = this.patientToken;
    return token ? async () => { await this.patientCall('touch', { close: true }, token, true); } : null;
  }

  watchPatientSession(): Observable<ClinicSessionResponse> {
    // Session chunks have a distinct envelope from data reads.
    return new Observable(subscriber => {
      const token = this.patientToken;
      const controller = new AbortController();
      let retry: ReturnType<typeof setTimeout> | undefined;
      const connect = async () => {
        if (!token || token !== this.patientToken || controller.signal.aborted) return;
        try {
          const callable = httpsCallable<unknown, unknown, ClinicSessionResponse>(getFunctions(this.firebase.auth.app, 'us-central1'), 'patientPortal', {timeout: 180_000});
          const result = await callable.stream({sessionToken: token, action: 'session', data: {}}, {signal: controller.signal});
          void result.data.catch(() => undefined);
          for await (const chunk of result.stream) if (token === this.patientToken && !controller.signal.aborted) subscriber.next(this.restoreTimestamps(chunk) as ClinicSessionResponse);
          await result.data;
          if (!controller.signal.aborted) retry = setTimeout(() => { void connect(); }, 1000);
        } catch (error) {
          if (controller.signal.aborted || token !== this.patientToken) return;
          if (['functions/unauthenticated', 'functions/permission-denied'].includes((error as {code?: string}).code ?? '')) subscriber.error(error);
          else retry = setTimeout(() => { void connect(); }, 3000);
        }
      };
      void connect();
      return () => { controller.abort(); clearTimeout(retry); };
    });
  }

  async getFamily(): Promise<Patient[]> {
    const identity = this.principal();
    const leaseId = this.lease()?.id;
    if (identity?.role !== 'patient') return [];
    const result = await this.call<{ patients: Patient[] }>('getClinicFamily', {});
    if (identity.authUid !== this.principal()?.authUid || leaseId !== this.lease()?.id || !Array.isArray(result?.patients)) return [];
    const children = result.patients.filter(p => p.doctorId === identity.doctorId);
    this.family.set(children);
    return children;
  }

  /** Preserve an operation ID after uncertain network outcomes; changed data starts a new operation. */
  async mutate(operation: string, entityId: string, data: unknown = {}, patientId?: string): Promise<void> {
    const clean = JSON.parse(JSON.stringify(data));
    const identity = this.principal();
    const lease = this.lease();
    if (!identity?.active || !lease || lease.expiresAt <= Date.now()) throw new Error('Inicia sesión nuevamente antes de guardar.');
    const key = JSON.stringify([identity.authUid, lease.id, operation, entityId, patientId ?? '', clean]);
    const operationId = this.pendingMutations.get(key) ?? crypto.randomUUID();
    this.pendingMutations.set(key, operationId);
    const result = await this.call<{ saved: boolean }>('saveClinicData', { operation, operationId, entityId, data: clean, ...(patientId ? { patientId } : {}) });
    if (result?.saved !== true) throw new Error('El servidor no confirmó el guardado. Reintenta la operación.');
    this.pendingMutations.delete(key);
  }

  private restoreTimestamps(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(item => this.restoreTimestamps(item));
    if (!value || typeof value !== 'object') return value;
    const object = value as Record<string, unknown>;
    if (typeof object['_seconds'] === 'number' && typeof object['_nanoseconds'] === 'number') return new Timestamp(object['_seconds'], object['_nanoseconds']);
    return Object.fromEntries(Object.entries(object).map(([key, item]) => [key, this.restoreTimestamps(item)]));
  }
}

export function clinicFields(data: object, fields: readonly string[]): Record<string, unknown> {
  const source = data as Record<string, unknown>;
  return Object.fromEntries(fields.filter(key => source[key] !== undefined).map(key => [key, source[key]]));
}
