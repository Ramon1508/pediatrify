import { TestBed } from '@angular/core/testing';
import { signInWithCustomToken, signOut } from 'firebase/auth';
import { onSnapshot } from 'firebase/firestore';
import { Subject } from 'rxjs';
import { authFixture, flushAuth, HOUR } from '../../../../security/p01/angular-auth-fixture';

describe('Verified device sessions and one-hour inactivity (P01/P17)', () => {
  beforeEach(() => {
    sessionStorage.clear(); vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(Date.UTC(2026, 9, 10, 12));
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  });
  afterEach(() => { TestBed.resetTestingModule(); vi.restoreAllMocks(); vi.useRealTimers(); sessionStorage.clear(); });

  it.each(['patient', 'doctor', 'assistant', 'admin'] as const)('expires %s at exactly one hour and revokes its device session', async role => {
    const { auth, router, gateway } = authFixture(role);
    if (role === 'patient') await auth.loginPatient(' Family@Example.Test ', 'synthetic-generated');
    else await auth.loginDoctor(' Staff@Example.Test ', 'synthetic-password');
    await vi.advanceTimersByTimeAsync(HOUR - 1); expect(auth.isAuthenticated).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(auth.session).toBeNull(); expect(signOut).toHaveBeenCalledOnce();
    expect(gateway.call).toHaveBeenCalledWith('touchClinicSession', { close: true });
    expect(router.navigate).toHaveBeenCalledWith([role === 'patient' ? '/patient-login' : '/login']);
    expect(sessionStorage.getItem('pediatrify_activity')).toBeNull();
  });

  it.each(['click', 'keydown', 'mousemove', 'pointerdown', 'touchstart', 'scroll'])('records %s activity without changing the reusable password', async event => {
    const { auth, gateway } = authFixture(); await auth.loginPatient('family@example.test', 'synthetic-generated');
    await vi.advanceTimersByTimeAsync(HOUR - 1); document.dispatchEvent(new Event(event)); await flushAuth();
    await vi.advanceTimersByTimeAsync(HOUR - 1); expect(auth.isPatient).toBe(true);
    expect(gateway.call).toHaveBeenCalledWith('touchClinicSession', {});
    expect(gateway.call.mock.calls.filter(([name]) => name === 'loginClinicPatient')).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1); expect(auth.isPatient).toBe(false);
  });

  it('a sleeping-tab clock jump cannot be revived by its first click', async () => {
    const { auth } = authFixture(); await auth.loginPatient('family@example.test', 'synthetic-generated');
    vi.setSystemTime(Date.now() + HOUR); document.dispatchEvent(new Event('click')); await flushAuth();
    expect(auth.session).toBeNull();
  });
  it('a hidden tab does not renew its deadline', async () => {
    const { auth } = authFixture(); await auth.loginPatient('family@example.test', 'synthetic-generated');
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    await vi.advanceTimersByTimeAsync(HOUR - 1); document.dispatchEvent(new Event('click'));
    await vi.advanceTimersByTimeAsync(1); expect(auth.session).toBeNull();
  });
  it('never restores a browser profile/password cache as authenticated identity', async () => {
    sessionStorage.setItem('pediatrify_session', JSON.stringify({ type: 'patient', patient: { id: 'forged', otpPassword: 'private-cache' } }));
    const { auth, gateway, restore, router } = authFixture();
    expect(auth.session).toBeNull(); expect(sessionStorage.getItem('pediatrify_session')).toBeNull();
    gateway.loadSession.mockRejectedValue({ code: 'functions/permission-denied' });
    restore({ uid: 'synthetic-auth' }); await flushAuth();
    expect(auth.session).toBeNull(); expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
  it('staff reload restores only verified authority and matching recent device metadata', async () => {
    sessionStorage.setItem('pediatrify_activity', JSON.stringify({ authUid: 'synthetic-auth', sessionId: 'device', kind: 'staff', lastActivityAt: Date.now()-1000 }));
    const { auth, gateway, restore } = authFixture('doctor'); restore({ uid: 'synthetic-auth' }); await flushAuth();
    expect(gateway.loadSession).toHaveBeenCalledOnce(); expect(auth.currentDoctor?.uid).toBe('doctor');
    expect(signInWithCustomToken).not.toHaveBeenCalled();
  });
  it('an expired patient restore returns to patient login and never resets the last activity', async () => {
    sessionStorage.setItem('pediatrify_activity', JSON.stringify({ authUid: 'synthetic-auth', sessionId: 'device', kind: 'patient', lastActivityAt: Date.now()-HOUR }));
    const { auth, restore, router } = authFixture(); restore({ uid: 'synthetic-auth' }); await flushAuth();
    expect(auth.session).toBeNull(); expect(router.navigate).toHaveBeenCalledWith(['/patient-login']);
  });
  it('expired backend authority ends a session on resume without extending activity', async () => {
    const { auth, gateway, router } = authFixture(); await auth.loginPatient('family@example.test', 'synthetic-generated');
    gateway.loadSession.mockRejectedValue({ code: 'functions/permission-denied' });
    window.dispatchEvent(new Event('focus')); await flushAuth();
    expect(auth.session).toBeNull(); expect(router.navigate).toHaveBeenCalledWith(['/patient-login']);
  });
  it('Patient access uses neither Firebase sign-in, Firestore listeners nor persisted browser activity', async () => {
    const store = vi.spyOn(Storage.prototype, 'setItem');
    const { auth, gateway, firebaseAuth } = authFixture();
    await auth.loginPatient('family@example.test', 'synthetic-generated');
    expect(auth.isPatient).toBe(true); expect(firebaseAuth.currentUser).toBeNull();
    expect(gateway.openPatient).toHaveBeenCalledOnce();
    expect(signInWithCustomToken).not.toHaveBeenCalled(); expect(onSnapshot).not.toHaveBeenCalled();
    document.dispatchEvent(new Event('click')); await flushAuth();
    expect(store).not.toHaveBeenCalled(); expect(sessionStorage.getItem('pediatrify_activity')).toBeNull();
  });
  it('reload cannot restore the Patient session from a cached browser record', async () => {
    sessionStorage.setItem('pediatrify_activity', JSON.stringify({authUid:'synthetic-auth',sessionId:'device',kind:'patient',lastActivityAt:Date.now()}));
    const {auth, gateway, restore} = authFixture();
    restore(null); await flushAuth();
    expect(auth.session).toBeNull(); expect(gateway.loadSession).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('pediatrify_activity')).toBeNull();
  });
  it('a server revocation closes Patient access while Firebase Auth callbacks do not own its session', async () => {
    const updates = new Subject<never>();
    const {auth, gateway, restore, router} = authFixture();
    gateway.watchPatientSession.mockReturnValue(updates);
    await auth.loginPatient('family@example.test', 'synthetic-generated');
    restore(null); await flushAuth(); expect(auth.isPatient).toBe(true);
    updates.error({code:'functions/permission-denied'}); await flushAuth();
    expect(auth.session).toBeNull(); expect(router.navigate).toHaveBeenCalledWith(['/patient-login']);
  });
});
