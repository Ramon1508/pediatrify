import { Component, input, output } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { SetupProfile } from './setup-profile';
import { AuthService } from '../../core/services/auth.service';
import { StaffInvitationService } from '../../core/services/staff-invitation.service';
import { PrintSettingsRepository } from '../../core/repositories/print-settings.repository';
import { AlertService } from '../../core/services/alert.service';
import { Header } from '../../shared/components/header/header';
import { FileUpload } from '../../shared/components/file-upload/file-upload';

@Component({ selector: 'app-header', template: '' }) class HeaderStub {}
@Component({ selector: 'app-file-upload', template: '' }) class UploadStub {
  id = input(''); label = input(''); uploaded = output<unknown>();
}
const token = 'x'.repeat(43);
const valid = { sexo: 1, phone: '5512345678', especialidad: '', cedula: '123', cedulaEspecialidad: '',
  consultorios: 'Consultorio de prueba', password: 'Synthetic123!', confirmPassword: 'Synthetic123!' };

describe('SetupProfile secure invitation', () => {
  async function setup(options: { role?: string; fragment?: string | null; email?: string; existing?: any; failure?: any } = {}) {
    const invitations = { inspect: vi.fn().mockResolvedValue({ userId: 'pending', name: 'Nombre ficticio',
      email: 'invited@example.test', role: options.role ?? 'doctor', expiresAt: 123456789 }) };
    if (options.failure) invitations.inspect.mockRejectedValue(options.failure);
    const auth = { registerFromInvitation: vi.fn().mockResolvedValue(undefined), completeProfile: vi.fn().mockResolvedValue(undefined),
      currentDoctor: options.existing ?? null, isDoctor: !!options.existing };
    const print = { getSettings: vi.fn().mockResolvedValue({}), updateSettings: vi.fn().mockResolvedValue(undefined) };
    const alert = { error: vi.fn() }; const router = { navigate: vi.fn().mockResolvedValue(true) };
    TestBed.configureTestingModule({ imports: [SetupProfile, NoopAnimationsModule], providers: [
      { provide: AuthService, useValue: auth }, { provide: StaffInvitationService, useValue: invitations },
      { provide: PrintSettingsRepository, useValue: print }, { provide: AlertService, useValue: alert },
      { provide: Router, useValue: router }, { provide: ActivatedRoute, useValue: { snapshot: {
        fragment: options.fragment === undefined ? 'invitation=' + token : options.fragment,
        queryParams: options.email ? { email: options.email } : {} } } },
    ] }).overrideComponent(SetupProfile, { remove: { imports: [Header, FileUpload] }, add: { imports: [HeaderStub, UploadStub] } });
    const fixture = TestBed.createComponent(SetupProfile); const component = fixture.componentInstance as any;
    fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    return { fixture, component, auth, print, alert, router, invitations };
  }
  function fill(component: any, values = valid) { component.form().setValue(values); component.form().markAsDirty(); }

  it('validates the capability before showing readonly identity and professional fields', async () => {
    const { fixture, component, invitations } = await setup();
    expect(invitations.inspect).toHaveBeenCalledExactlyOnceWith(token);
    expect(component.mode()).toBe('invitation'); expect(component.displayEmail()).toBe('invited@example.test');
    expect(fixture.nativeElement.querySelector('input[formControlName="email"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-file-upload')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Puedes agregar tu logotipo desde Perfil');
    expect(component.saveDisabled()).toBe(true);
  });
  it.each(['email', 'bad-fragment', 'missing'])('rejects %s without an email-based fallback', async kind => {
    const { component, invitations, auth } = await setup({ fragment: kind === 'bad-fragment' ? 'invitation=invalid' : null,
      email: kind === 'email' ? 'invited@example.test' : undefined });
    expect(component.mode()).toBe('invalid'); expect(invitations.inspect).not.toHaveBeenCalled();
    await component.finish(); expect(auth.registerFromInvitation).not.toHaveBeenCalled();
  });
  it('an old email link cannot fall through to an existing incomplete profile', async () => {
    const { component } = await setup({ fragment: null, email: 'invited@example.test', existing: { role: 'admin', profileComplete: false } });
    expect(component.mode()).toBe('invalid');
  });
  it.each(['functions/deadline-exceeded', 'functions/failed-precondition', 'functions/resource-exhausted'])
  ('shows rejected invitation %s and a login action, without a form', async code => {
    const { fixture, component, router } = await setup({ failure: { code, message: 'Solicita una nueva invitación.' } });
    expect(component.mode()).toBe('invalid'); expect(fixture.nativeElement.querySelector('form')).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
    component.goToLogin(); expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
  it('doctor submits only capability, password and professional data; does not write print settings anonymously', async () => {
    const { component, auth, print, router } = await setup(); fill(component);
    await component.finish();
    const { password, confirmPassword, ...profile } = valid;
    expect(auth.registerFromInvitation).toHaveBeenCalledExactlyOnceWith(token, password, profile, expect.any(String));
    expect(auth.completeProfile).not.toHaveBeenCalled(); expect(print.updateSettings).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { registered: 'true' } });
  });
  it('distinguishes an expired invitation from a network request timeout', async () => {
    const { component } = await setup({ failure: { code: 'functions/deadline-exceeded', details: { reason: 'invitation-expired' } } });
    expect(component.invalidMessage()).toContain('caducó');
    TestBed.resetTestingModule();
    const timeout = await setup({ failure: { code: 'functions/deadline-exceeded' } });
    expect(timeout.component.invalidMessage()).toContain('Reintenta');
    expect(timeout.component.invalidMessage()).not.toContain('caducó');
  });
  it('assistant completes only password and ignores injected professional values', async () => {
    const { fixture, component, auth } = await setup({ role: 'assistant' });
    expect(fixture.nativeElement.querySelector('input[formControlName="phone"]')).toBeNull();
    fill(component); await component.finish();
    expect(auth.registerFromInvitation).toHaveBeenCalledWith(token, valid.password, { sexo: 3, phone: '', especialidad: '',
      cedula: '', cedulaEspecialidad: '', consultorios: '' }, expect.any(String));
  });
  it.each([
    { ...valid, password: 'weak', confirmPassword: 'weak' }, { ...valid, confirmPassword: 'Different123!' },
    { ...valid, phone: '123' }, { ...valid, cedula: '   ' }, { ...valid, consultorios: '' },
    { ...valid, especialidad: 'x'.repeat(301) }, { ...valid, consultorios: 'x'.repeat(5001) },
  ])('invalid form cannot register', async values => {
    const { component, fixture, auth } = await setup(); fill(component, values); await component.finish(); fixture.detectChanges();
    expect(component.saveDisabled()).toBe(true); expect(auth.registerFromInvitation).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('mat-error')).toBeTruthy();
  });
  it('guards duplicate submits and retries a failure using the same operation ID', async () => {
    const { component, auth, alert } = await setup(); fill(component);
    let reject!: (error: unknown) => void;
    auth.registerFromInvitation.mockReturnValueOnce(new Promise((_resolve, fail) => { reject = fail; }));
    const first = component.finish(); await component.finish(); expect(auth.registerFromInvitation).toHaveBeenCalledOnce();
    reject({ code: 'functions/aborted', message: 'Reintenta con los mismos datos.' }); await first;
    expect(alert.error).toHaveBeenCalled(); expect(component.finishing()).toBe(false);
    await component.finish(); expect(auth.registerFromInvitation.mock.calls[0]).toEqual(auth.registerFromInvitation.mock.calls[1]);
  });
  it('existing Admin remains password-only and does not update print settings', async () => {
    const { component, auth, print } = await setup({ fragment: null, existing: {
      uid: 'admin', name: 'Admin ficticio', email: 'admin@example.test', role: 'admin', profileComplete: false } });
    expect(component.mode()).toBe('existing'); expect(component.pendingRole()).toBe('admin');
    fill(component); await component.finish(); expect(auth.completeProfile).toHaveBeenCalledOnce();
    expect(auth.registerFromInvitation).not.toHaveBeenCalled(); expect(print.getSettings).not.toHaveBeenCalled();
  });
  it('existing Doctor delegates profile and print defaults to the server before clearing the active session', async () => {
    const { component, auth, print } = await setup({ fragment: null, existing: {
      uid: 'doctor', name: 'Doctor ficticio', email: 'doctor@example.test', role: 'doctor', profileComplete: false } });
    auth.completeProfile.mockImplementation(async () => {
    expect(print.updateSettings).not.toHaveBeenCalled();
    expect(auth.completeProfile).toHaveBeenCalledOnce();
      auth.currentDoctor = null;
    }); fill(component); await component.finish();
    expect(print.updateSettings).not.toHaveBeenCalled();
    expect(auth.completeProfile).toHaveBeenCalledOnce();
  });
});
