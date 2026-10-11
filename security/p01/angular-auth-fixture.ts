import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { NEVER } from 'rxjs';
import { Router } from '@angular/router';
import { onAuthStateChanged, signInWithEmailAndPassword, signInWithCustomToken, signOut } from 'firebase/auth';
import { onSnapshot } from 'firebase/firestore';
import { AuthService } from '../../src/app/core/services/auth.service';
import { FirebaseService } from '../../src/app/core/firebase/firebase.service';
import { ClinicGatewayService, ClinicSessionResponse } from '../../src/app/core/services/clinic-gateway.service';
import { StaffInvitationService } from '../../src/app/core/services/staff-invitation.service';

vi.mock('firebase/auth', () => ({ onAuthStateChanged: vi.fn(), signInWithEmailAndPassword: vi.fn(), signInWithCustomToken: vi.fn(), signOut: vi.fn(), updatePassword: vi.fn(), RecaptchaVerifier: vi.fn(), linkWithPhoneNumber: vi.fn() }));
vi.mock('firebase/firestore', () => ({ doc: (_db: unknown, path: string) => ({ path }), onSnapshot: vi.fn() }));

export const HOUR = 3_600_000;
export function verifiedSession(role: 'admin' | 'doctor' | 'assistant' | 'patient'): ClinicSessionResponse {
  return {
    principal: { authUid: 'synthetic-auth', active: true, role,
      ...(role === 'patient' ? { patientId: 'child', doctorId: 'doctor' } : { userId: role, ...(role === 'admin' ? {} : { doctorId: 'doctor' }) }) },
    lease: { id: 'device', expiresAt: Date.now() + HOUR },
    session: role === 'patient' ? { type: 'patient', loginEmail: 'family@example.test', patient: {
      id: 'child', doctorId: 'doctor', name: 'Paciente ficticio', lastName: 'Ejemplo', birthDate: '2020-01-01',
      email: '', fatherName: 'Tutor', motherName: 'Tutora', phone: '',
    } } : { type: 'doctor', user: { uid: role, firebaseUid: 'synthetic-auth', name: 'Personal ficticio',
      email: 'canonical@example.test', role, pending: false, profileComplete: true, ...(role === 'assistant' ? { createdBy: 'doctor' } : {}) } },
  };
}

export function authFixture(role: 'admin' | 'doctor' | 'assistant' | 'patient' = 'patient') {
  const result = verifiedSession(role);
  const firebaseAuth = { currentUser: { uid: 'synthetic-auth' } as { uid: string } | null };
  const unsubscribe = vi.fn();
  vi.mocked(onAuthStateChanged).mockReturnValue(unsubscribe);
  vi.mocked(onSnapshot).mockReturnValue(unsubscribe);
  vi.mocked(signInWithEmailAndPassword).mockResolvedValue({ user: { uid: 'synthetic-auth' } } as never);
  vi.mocked(signInWithCustomToken).mockImplementation(async () => {
    firebaseAuth.currentUser = { uid: 'synthetic-auth' };
    return { user: firebaseAuth.currentUser } as never;
  });
  vi.mocked(signOut).mockImplementation(async () => { firebaseAuth.currentUser = null; });
  const principal = signal<ClinicSessionResponse['principal'] | null>(null);
  const lease = signal<ClinicSessionResponse['lease'] | null>(null);
  const gateway = {
    openPatient: vi.fn(), capturePatientClose: vi.fn(() => role === 'patient' ? async () => { await gateway.call('touchClinicSession', {close: true}); } : null),
    watchPatientSession: vi.fn(() => NEVER),
    principal, lease, clear: vi.fn(() => { principal.set(null); lease.set(null); }),
    publish: vi.fn((value: ClinicSessionResponse) => { principal.set(value.principal); lease.set(value.lease); }),
    loadSession: vi.fn().mockResolvedValue(result),
    call: vi.fn(async (name: string, _data?: unknown) => name === 'touchClinicSession' ? { updated: true, expiresAt: Date.now() + HOUR } : { token: 'synthetic-custom-token' }),
  };
  const router = { navigate: vi.fn().mockResolvedValue(true) };
  const invitations = { complete: vi.fn().mockResolvedValue(undefined) };
  TestBed.configureTestingModule({ providers: [
    { provide: FirebaseService, useValue: { auth: firebaseAuth, firestore: {} } },
    { provide: ClinicGatewayService, useValue: gateway },
    { provide: StaffInvitationService, useValue: invitations },
    { provide: Router, useValue: router },
  ] });
  const auth = TestBed.inject(AuthService);
  const restore = vi.mocked(onAuthStateChanged).mock.calls.at(-1)![1] as (user: unknown) => void;
  return { auth, gateway, router, firebaseAuth, restore, result, unsubscribe, invitations };
}

export async function flushAuth(): Promise<void> {
  for (let count = 0; count < 12; count++) await Promise.resolve();
}
