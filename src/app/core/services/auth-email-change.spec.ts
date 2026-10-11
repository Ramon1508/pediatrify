import { TestBed } from '@angular/core/testing';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { authFixture, flushAuth, verifiedSession } from '../../../../security/p01/angular-auth-fixture';

describe('Staff identity and canonical profile after an email change (P01/P09)', () => {
  beforeEach(() => { sessionStorage.clear(); vi.clearAllMocks(); });
  afterEach(() => { TestBed.resetTestingModule(); sessionStorage.clear(); });
  it('uses Auth login and trusted UID binding without rewriting a pending canonical email', async () => {
    const { auth, gateway } = authFixture('assistant');
    const profile = await auth.loginDoctor(' NEW@Example.Test ', 'synthetic-password');
    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(expect.anything(), 'new@example.test', 'synthetic-password');
    expect(gateway.call).toHaveBeenCalledWith('startClinicStaffSession', {});
    expect(profile.firebaseUid).toBe('synthetic-auth'); expect(profile.email).toBe('canonical@example.test');
    expect(gateway.call.mock.calls.some(([name]) => name === 'saveClinicData')).toBe(false);
  });
  it('a failed trusted binding never establishes a role from an email lookup', async () => {
    const { auth, gateway } = authFixture('assistant');
    gateway.loadSession.mockRejectedValue({ code: 'functions/permission-denied' });
    await expect(auth.loginDoctor('new@example.test', 'synthetic-password')).rejects.toEqual({ code: 'functions/permission-denied' });
    expect(auth.session).toBeNull();
  });
  it('an older refresh response cannot overwrite a newer canonical profile', async () => {
    const { auth, gateway } = authFixture('assistant');
    await auth.loginDoctor('staff@example.test', 'synthetic-password');
    let resolveOlder!: (value: ReturnType<typeof verifiedSession>) => void;
    gateway.loadSession.mockImplementationOnce(() => new Promise(resolve => { resolveOlder = resolve; }));
    const newer = verifiedSession('assistant');
    if (newer.session.type === 'doctor') newer.session.user.name = 'Perfil más reciente';
    gateway.loadSession.mockResolvedValueOnce(newer);
    const first = (auth as any).refreshSession();
    await (auth as any).refreshSession();
    resolveOlder(verifiedSession('assistant')); await first;
    expect(auth.currentDoctor?.name).toBe('Perfil más reciente');
  });
  it('a logout waits for an in-flight login before a new account can sign in', async () => {
    const { auth, gateway } = authFixture('doctor');
    let release!: () => void;
    vi.mocked(signInWithEmailAndPassword).mockImplementationOnce(() => new Promise(resolve => { release = () => resolve({ user: { uid: 'synthetic-auth' } } as never); }));
    const previous = auth.loginDoctor('staff@example.test', 'synthetic-password').catch(error => error);
    await flushAuth();
    const closing = auth.logout();
    gateway.loadSession.mockResolvedValue(verifiedSession('patient'));
    const next = auth.loginPatient('family@example.test', 'synthetic-generated');
    release(); await previous; await closing; await next;
    expect(auth.isPatient).toBe(true);
    expect(gateway.call.mock.calls.filter(([name]) => name === 'startClinicStaffSession')).toHaveLength(0);
  });
});
