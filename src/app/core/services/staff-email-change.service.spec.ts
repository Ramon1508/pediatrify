import { TestBed } from '@angular/core/testing';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { FirebaseService } from '../firebase/firebase.service';
import { StaffEmailChangeService } from './staff-email-change.service';

vi.mock('firebase/functions', () => ({ getFunctions: vi.fn(), httpsCallable: vi.fn() }));
describe('StaffEmailChangeService', () => {
  const app = {};
  const functions = {};
  const callable = Object.assign(vi.fn(), { stream: vi.fn() });
  const request = { userId: 'business-id', operationId: 'operation', email: ' NEW@example.test ', expectedEmail: ' OLD@example.test ' };
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getFunctions).mockReturnValue(functions as ReturnType<typeof getFunctions>);
    vi.mocked(httpsCallable).mockReturnValue(callable);
    TestBed.configureTestingModule({ providers: [{ provide: FirebaseService, useValue: { auth: { app } } }] });
  });
  it('normalizes and whitelists callable payload without client role/password/Auth UID', async () => {
    callable.mockResolvedValue({ data: { updated: true, pendingInvitation: false } });
    await TestBed.inject(StaffEmailChangeService).changeEmail({ ...request, name: ' Name ', role: 'admin', password: 'synthetic' } as any);
    expect(getFunctions).toHaveBeenCalledWith(app, 'us-central1');
    expect(httpsCallable).toHaveBeenCalledWith(functions, 'updateStaffEmail', { timeout: 90000 });
    expect(callable).toHaveBeenCalledExactlyOnceWith({ userId: 'business-id', operationId: 'operation',
      email: 'new@example.test', expectedEmail: 'old@example.test', name: 'Name' });
  });
  it('does not include a name for Admin self-edit', async () => {
    callable.mockResolvedValue({ data: { updated: true, pendingInvitation: false } });
    await TestBed.inject(StaffEmailChangeService).changeEmail(request);
    expect(callable.mock.calls[0][0]).not.toHaveProperty('name');
  });
  it.each([{}, { updated: false }, { updated: true }, { updated: true, pendingInvitation: 'false' }])('rejects unconfirmed response %j', async data => {
    callable.mockResolvedValue({ data });
    await expect(TestBed.inject(StaffEmailChangeService).changeEmail(request)).rejects.toThrow('no confirmado');
  });
  it('propagates server errors without a local fallback', async () => {
    const failure = { code: 'functions/failed-precondition' };
    callable.mockRejectedValue(failure);
    await expect(TestBed.inject(StaffEmailChangeService).changeEmail(request)).rejects.toBe(failure);
  });
});
