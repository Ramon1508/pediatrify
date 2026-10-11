import { TestBed } from '@angular/core/testing';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { FirebaseService } from '../firebase/firebase.service';
import { StaffInvitationService } from './staff-invitation.service';
vi.mock('firebase/functions', () => ({ getFunctions: vi.fn(), httpsCallable: vi.fn() }));
const token = 'x'.repeat(43);
const summary = { userId: 'pending', role: 'doctor', name: 'Ficticio', email: 'invited@example.test', expiresAt: 123456789 };
const profile = { sexo: 1, phone: '5512345678', especialidad: '', cedula: '123', cedulaEspecialidad: '', consultorios: 'Prueba' };
describe('StaffInvitationService', () => {
  const callable = Object.assign(vi.fn(), { stream: vi.fn() });
  beforeEach(() => {
    vi.clearAllMocks(); vi.mocked(httpsCallable).mockReturnValue(callable);
    TestBed.configureTestingModule({ providers: [{ provide: FirebaseService, useValue: { auth: { app: {} } } }] });
  });
  it('issues normalized whitelisted input and builds the fragment locally', async () => {
    callable.mockResolvedValue({ data: { ...summary, token, doctorName: 'Operador', link: 'https://untrusted.example/' } });
    const result = await TestBed.inject(StaffInvitationService).issue({ action: 'create', name: ' Ficticio ', email: ' INVITED@example.test ',
      operationId: 'op', role: 'admin', firebaseUid: 'spoofed' } as any);
    expect(callable).toHaveBeenCalledExactlyOnceWith({ action: 'create', name: 'Ficticio', email: 'invited@example.test', operationId: 'op', role: 'admin' });
    expect(result.link).toBe(window.location.origin + '/setup-profile#invitation=' + token);
    expect(result.link).not.toContain('?email=');
  });
  it('resend identifies only the same business account, not a caller-selected email or role', async () => {
    callable.mockResolvedValue({ data: { ...summary, token, doctorName: 'Operador' } });
    await TestBed.inject(StaffInvitationService).issue({ action: 'resend', userId: 'pending', operationId: 'op', email: 'spoofed@example.test' } as any);
    expect(callable).toHaveBeenCalledExactlyOnceWith({ action: 'resend', userId: 'pending', operationId: 'op' });
  });
  it('inspection sends only the capability', async () => {
    callable.mockResolvedValue({ data: summary }); await TestBed.inject(StaffInvitationService).inspect(token);
    expect(httpsCallable).toHaveBeenCalledWith(undefined, 'inspectStaffInvitation', { timeout: 90000 });
    expect(callable).toHaveBeenCalledExactlyOnceWith({ token });
  });
  it('preserves a supported legacy staff document identifier without deriving an account from it', async () => {
    callable.mockResolvedValue({ data: { ...summary, userId: 'doctor.legacy+test@example.invalid' } });
    const result = await TestBed.inject(StaffInvitationService).inspect(token);
    expect(result.userId).toBe('doctor.legacy+test@example.invalid');
    expect(callable).toHaveBeenCalledExactlyOnceWith({ token });
  });
  it('rejects unsafe document segments returned by the server', async () => {
    const service = TestBed.inject(StaffInvitationService);
    for (const userId of ['../profile', 'a/b', 'a\\b', ' a', 'a ', '.', '..', '__reserved__', 'a%2Fb', 'a?b', 'a#b', 'a'.repeat(129)]) {
      callable.mockResolvedValue({ data: { ...summary, userId } });
      await expect(service.inspect(token)).rejects.toThrow('no confirmada');
    }
  });
  it('registration whitelists professional fields and does not persist credentials', async () => {
    callable.mockResolvedValue({ data: { registered: true } });
    await TestBed.inject(StaffInvitationService).complete(token, 'Synthetic123!', { ...profile, role: 'admin', name: 'spoofed', logoPath: 'foreign' } as any, 'op');
    expect(callable).toHaveBeenCalledExactlyOnceWith({ token, password: 'Synthetic123!', profile, operationId: 'op' });
    expect(sessionStorage.getItem('staffInvitation')).toBeNull();
  });
  it.each(['', 'invalid', 'x'.repeat(42), 'x'.repeat(44), '../' + token])('malformed capability %s never calls backend', async value => {
    await expect(TestBed.inject(StaffInvitationService).inspect(value)).rejects.toThrow(); expect(callable).not.toHaveBeenCalled();
  });
  it.each([{}, { ...summary, role: 'superadmin' }, { ...summary, expiresAt: '123' }])('rejects invalid server summary', async data => {
    callable.mockResolvedValue({ data }); await expect(TestBed.inject(StaffInvitationService).inspect(token)).rejects.toThrow('no confirmada');
  });
  it('requires positive registration confirmation and propagates callable errors', async () => {
    callable.mockResolvedValue({ data: { registered: false } });
    await expect(TestBed.inject(StaffInvitationService).complete(token, 'Synthetic123!', profile, 'op')).rejects.toThrow('no confirmado');
    const failure = { code: 'functions/deadline-exceeded' }; callable.mockRejectedValue(failure);
    await expect(TestBed.inject(StaffInvitationService).inspect(token)).rejects.toBe(failure);
  });
});
