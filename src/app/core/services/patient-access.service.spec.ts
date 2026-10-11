import { TestBed } from '@angular/core/testing';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { FirebaseService } from '../firebase/firebase.service';
import { PatientAccessRenewal, PatientAccessService } from './patient-access.service';

vi.mock('firebase/functions', () => ({ getFunctions: vi.fn(), httpsCallable: vi.fn() }));

describe('PatientAccessService', () => {
  const app = {};
  const functions = {};
  const callable = Object.assign(vi.fn(), { stream: vi.fn() });
  const access = { password: 'SYN234', credentialVersion: 1, credentialEpoch: 'a'.repeat(32) };
  const request = { patientId: 'synthetic-child', operationId: 'same-operation',
    expectedVersion: 1, expectedEpoch: access.credentialEpoch };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getFunctions).mockReturnValue(functions as ReturnType<typeof getFunctions>);
    vi.mocked(httpsCallable).mockReturnValue(callable);
    callable.mockResolvedValue({ data: access });
    TestBed.configureTestingModule({ providers: [{ provide: FirebaseService, useValue: { auth: { app } } }] });
  });

  it('reads through the authenticated callable, sending only a child ID and returning allowed fields', async () => {
    callable.mockResolvedValue({ data: { ...access, role: 'doctor', email: 'excluded@example.test', diagnosis: 'excluded' } });
    const result = await TestBed.inject(PatientAccessService).read(request.patientId);
    expect(getFunctions).toHaveBeenCalledWith(app, 'us-central1');
    expect(httpsCallable).toHaveBeenCalledWith(functions, 'getClinicPatientAccess');
    expect(callable).toHaveBeenCalledExactlyOnceWith({ patientId: request.patientId });
    expect(result).toEqual(access);
  });

  it('renewal whitelists business fields and keeps the retry ID; it never sends a caller-selected password', async () => {
    const service = TestBed.inject(PatientAccessService);
    const input = { ...request, password: ' 1234 ', role: 'admin', doctorId: 'forged', authUid: 'forged' };
    await service.renew(input as PatientAccessRenewal);
    await service.renew(input as PatientAccessRenewal);
    expect(httpsCallable).toHaveBeenCalledWith(functions, 'renewClinicPatientAccess', { timeout: 90000 });
    for (const [payload] of callable.mock.calls) expect(payload).toEqual(request);
  });

  it('requests generated renewal without an undefined password', async () => {
    await TestBed.inject(PatientAccessService).renew(request);
    expect(callable).toHaveBeenCalledExactlyOnceWith(request);
    expect(callable.mock.calls[0][0]).not.toHaveProperty('password');
  });

  it.each([null, {}, { ...access, password: '' }, { ...access, password: 'x'.repeat(257) },
    { ...access, credentialVersion: 0 }, { ...access, credentialVersion: 1.5 }, { ...access, credentialEpoch: 'forged' }])(
    'refuses incomplete or invalid confirmation without including a password in the error', async data => {
      callable.mockResolvedValue({ data });
      await expect(TestBed.inject(PatientAccessService).read(request.patientId)).rejects.toThrow('No se pudo confirmar');
    },
  );

  it('propagates permission, stale revision and disabled rollout errors without direct Firestore writes', async () => {
    const service = TestBed.inject(PatientAccessService);
    for (const code of ['functions/permission-denied', 'functions/aborted', 'functions/failed-precondition']) {
      const error = { code };
      callable.mockRejectedValue(error);
      await expect(service.renew(request)).rejects.toBe(error);
    }
    expect(callable).toHaveBeenCalledTimes(3);
  });
});
