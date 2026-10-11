import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef } from '@angular/material/dialog';
import { Clipboard } from '@angular/cdk/clipboard';
import { StaffInvitationService } from '../../../../core/services/staff-invitation.service';
import { InviteDoctorDialog } from './invite-doctor-dialog';
import { FirebaseService } from '../../../../core/firebase/firebase.service';
import { AuthService } from '../../../../core/services/auth.service';
import { AlertService } from '../../../../core/services/alert.service';
import { EmailService } from '../../../../core/services/email.service';

const issued = { userId: 'pending', name: 'Invitado ficticio', email: 'invited@example.test', doctorName: 'Operador ficticio',
  role: 'assistant', token: 'x'.repeat(43), expiresAt: 123456789,
  link: window.location.origin + '/setup-profile#invitation=' + 'x'.repeat(43) };
const issue = vi.fn();

describe('InviteDoctorDialog', () => {
  beforeEach(() => { vi.clearAllMocks(); issue.mockReset().mockResolvedValue(issued); });
  function setup(role = 'doctor') {
    const auth = { currentDoctor: { uid: 'operator', role, name: 'Operador ficticio' } };
    const alert = { success: vi.fn(), error: vi.fn() };
    const email = { sendInvitationEmail: vi.fn().mockResolvedValue(undefined) };
    const clipboard = { copy: vi.fn().mockReturnValue(true) };
    const ref = { close: vi.fn(), disableClose: false };
    TestBed.configureTestingModule({ imports: [InviteDoctorDialog, NoopAnimationsModule], providers: [
      { provide: StaffInvitationService, useValue: { issue } }, { provide: AuthService, useValue: auth },
      { provide: AlertService, useValue: alert }, { provide: EmailService, useValue: email },
      { provide: Clipboard, useValue: clipboard }, { provide: MatDialogRef, useValue: ref },
    ] });
    const fixture = TestBed.createComponent(InviteDoctorDialog);
    const component = fixture.componentInstance as any;
    fixture.detectChanges();
    return { fixture, component, auth, alert, email, clipboard, ref };
  }
  function fill(component: any, values = { name: 'Invitado ficticio', email: 'INVITED@example.test' }) {
    component.form().setValue(values);
    component.form().markAsDirty();
  }

  it.each([['admin', 'doctor', 'Invitar doctor'], ['doctor', 'assistant', 'Invitar asistente']])
   ('maps %s to %s with the existing fixed role', async (role, target, title) => {
      const { fixture, component } = setup(role);
      expect(fixture.nativeElement.textContent).toContain(title);
      expect(component.targetRole()).toBe(target);
      expect(fixture.nativeElement.querySelector('mat-select')).toBeNull();
      fill(component);
      await component.save();
      expect(issue).toHaveBeenCalledExactlyOnceWith({ action: 'create', operationId: expect.any(String),
        name: 'Invitado ficticio', email: 'invited@example.test' });
    });

  it('renders a pristine disabled form and does not create until a valid input changes', async () => {
    const { fixture, component } = setup();
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBe(true);
    await component.save();
    expect(issue).not.toHaveBeenCalled();
    const input = fixture.nativeElement.querySelector('input[formControlName="name"]') as HTMLInputElement;
    input.value = 'Nombre ficticio';
    input.dispatchEvent(new Event('input'));
    const email = fixture.nativeElement.querySelector('input[formControlName="email"]') as HTMLInputElement;
    email.value = 'invited@example.test';
    email.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBe(false);
  });

  it.each([{ name: '', email: 'valid@example.test' }, { name: '   ', email: 'valid@example.test' },
    { name: 'x'.repeat(201), email: 'valid@example.test' }, { name: 'Nombre', email: '' },
    { name: 'Nombre', email: 'invalid' }, { name: 'Nombre', email: 'x'.repeat(250) + '@example.test' }])
   ('invalid input %j cannot create or send', async values => {
      const { fixture, component, email } = setup();
      fill(component, values);
      await component.save();
      fixture.detectChanges();
      expect(component.saveDisabled()).toBe(true);
      expect(fixture.nativeElement.querySelector('mat-error')).toBeTruthy();
      expect(issue).not.toHaveBeenCalled();
      expect(email.sendInvitationEmail).not.toHaveBeenCalled();
    });

  it('keeps invitation and sent message independent of later form manipulation', async () => {
    const { fixture, component, email } = setup();
    fill(component);
    await component.save();
    const link = component.invitationLink();
    expect(link).toBe(issued.link);
    expect(email.sendInvitationEmail).toHaveBeenCalledExactlyOnceWith({
      userId: 'pending', token: 'x'.repeat(43), operationId: expect.any(String),
    });
    component.form().setValue({ name: 'Otro', email: 'other@example.test' });
    fixture.detectChanges();
    expect(component.deliveryStatus()).toBe('sent');
    expect(fixture.nativeElement.querySelector('.invitation-hint').textContent).toContain('Se envió el enlace al correo invited@example.test');
    expect(fixture.nativeElement.querySelector('input[formControlName="name"]').readOnly).toBe(true);
    expect(fixture.nativeElement.querySelector('input[formControlName="email"]').readOnly).toBe(true);
    await component.save();
    expect(issue).toHaveBeenCalledTimes(1);
  });

  it('SMTP failure shows failed persistent state, keeps copy and offers retry', async () => {
    const { fixture, component, email, alert } = setup();
    email.sendInvitationEmail.mockRejectedValue(new Error('Synthetic SMTP failure'));
    fill(component);
    await component.save();
    fixture.detectChanges();
    expect(component.deliveryStatus()).toBe('failed');
    expect(component.invitationLink()).toBeTruthy();
    const message = fixture.nativeElement.querySelector('.invitation-hint').textContent;
    expect(message).toContain('no se pudo confirmar');
    expect(message).not.toContain('Se envió');
    expect(fixture.nativeElement.textContent).toContain('Reintentar envío');
    expect(alert.success).not.toHaveBeenCalled();
    expect(alert.error).toHaveBeenCalled();
    expect(component.saving()).toBe(false);
  });

  it('retry sends the same invitation once without creating another user or using manipulated fields', async () => {
    const { fixture, component, email, alert } = setup();
    email.sendInvitationEmail.mockRejectedValueOnce(new Error('Synthetic failure'));
    fill(component);
    await component.save();
    const payload = email.sendInvitationEmail.mock.calls[0][0];
    component.form().setValue({ name: 'Other', email: 'other@example.test' });
    await component.retryEmail();
    fixture.detectChanges();
    expect(issue).toHaveBeenCalledTimes(1);
    expect(email.sendInvitationEmail).toHaveBeenCalledTimes(2);
    expect(email.sendInvitationEmail.mock.calls[1][0]).toEqual(payload);
    expect(component.deliveryStatus()).toBe('sent');
    expect(fixture.nativeElement.textContent).not.toContain('Reintentar envío');
    expect(alert.success).toHaveBeenCalledOnce();
    await component.retryEmail();
    expect(email.sendInvitationEmail).toHaveBeenCalledTimes(2);
  });

  it('another retry failure keeps link/state and does not create another record', async () => {
    const { component, email } = setup();
    email.sendInvitationEmail.mockRejectedValue(new Error('Synthetic failure'));
    fill(component);
    await component.save();
    const link = component.invitationLink();
    await component.retryEmail();
    expect(component.invitationLink()).toBe(link);
    expect(component.deliveryStatus()).toBe('failed');
    expect(component.canRetry()).toBe(true);
    expect(issue).toHaveBeenCalledTimes(1);
  });

  it('creation failure shows no link and makes no email attempt, then permits retry of creation', async () => {
    const { component, email } = setup();
    vi.mocked(issue).mockRejectedValueOnce(new Error('Synthetic Firestore failure'));
    fill(component);
    await component.save();
    expect(component.invitationLink()).toBe('');
    expect(component.error()).toContain('No fue posible crear');
    expect(component.deliveryStatus()).toBe('idle');
    expect(email.sendInvitationEmail).not.toHaveBeenCalled();
    expect(component.saving()).toBe(false);
    await component.save();
    expect(component.error()).toBe('');
    expect(email.sendInvitationEmail).toHaveBeenCalledOnce();
  });

  it('locks close and duplicate creation while Firestore is pending', async () => {
    const { component, ref, email } = setup();
    let resolve!: () => void;
    vi.mocked(issue).mockReturnValue(new Promise<any>(done => { resolve = () => done(issued); }));
    fill(component);
    const pending = component.save();
    await component.save();
    component.close();
    expect(issue).toHaveBeenCalledOnce();
    expect(ref.close).not.toHaveBeenCalled();
    expect(ref.disableClose).toBe(true);
    expect(email.sendInvitationEmail).not.toHaveBeenCalled();
    resolve();
    await pending;
    expect(ref.disableClose).toBe(false);
  });

  it('shows sending before confirmation and prevents duplicate retry or closing during retry', async () => {
    const { component, fixture, ref, email, alert } = setup();
    email.sendInvitationEmail.mockRejectedValueOnce(new Error('Synthetic failure'));
    fill(component);
    await component.save();
    let resolve!: () => void;
    email.sendInvitationEmail.mockReturnValue(new Promise<void>(done => { resolve = done; }));
    const retry = component.retryEmail();
    await component.retryEmail();
    component.close();
    fixture.detectChanges();
    expect(component.deliveryStatus()).toBe('sending');
    expect(fixture.nativeElement.querySelector('.invitation-hint').textContent).toContain('Enviando');
    expect(fixture.nativeElement.querySelector('.invitation-hint').textContent).not.toContain('Se envió');
    expect(fixture.nativeElement.querySelector('mat-spinner')).toBeTruthy();
    expect(ref.disableClose).toBe(true);
    expect(ref.close).not.toHaveBeenCalled();
    expect(email.sendInvitationEmail).toHaveBeenCalledTimes(2);
    expect(alert.success).not.toHaveBeenCalled();
    resolve();
    await retry;
    expect(component.deliveryStatus()).toBe('sent');
    expect(ref.disableClose).toBe(false);
  });

  it('copy is available after a failed send; clipboard failure never claims success', async () => {
    const { component, email, clipboard, alert } = setup();
    component.copyLink();
    expect(clipboard.copy).not.toHaveBeenCalled();
    email.sendInvitationEmail.mockRejectedValue(new Error('Synthetic failure'));
    fill(component);
    await component.save();
    component.copyLink();
    expect(clipboard.copy).toHaveBeenCalledWith(component.invitationLink());
    expect(alert.success).toHaveBeenCalledWith({ message: 'Enlace copiado al portapapeles', duration: 2000 });
    alert.success.mockClear();
    clipboard.copy.mockReturnValue(false);
    component.copyLink();
    expect(alert.success).not.toHaveBeenCalled();
    expect(alert.error).toHaveBeenLastCalledWith(expect.objectContaining({ message: expect.stringContaining('No se pudo copiar') }));
  });

  it('blocks unauthorized inviter and a changed session without writing or sending', async () => {
    const { component, auth, email } = setup('assistant');
    fill(component);
    await component.save();
    expect(issue).not.toHaveBeenCalled();
    auth.currentDoctor = { uid: 'other', role: 'admin', name: 'Otro' };
    await component.save();
    expect(issue).not.toHaveBeenCalled();
    expect(email.sendInvitationEmail).not.toHaveBeenCalled();
  });

  it('retry refuses a different operator session', async () => {
    const { component, auth, email } = setup();
    email.sendInvitationEmail.mockRejectedValue(new Error('Synthetic failure'));
    fill(component);
    await component.save();
    auth.currentDoctor = { uid: 'other', role: 'doctor', name: 'Otro' };
    await component.retryEmail();
    expect(email.sendInvitationEmail).toHaveBeenCalledOnce();
    expect(issue).toHaveBeenCalledOnce();
  });

  it('destroying the view during creation stops subsequent sending', async () => {
    const { component, email, fixture } = setup();
    let resolve!: () => void;
    vi.mocked(issue).mockReturnValue(new Promise<void>(done => { resolve = done; }));
    fill(component);
    const pending = component.save();
    fixture.destroy();
    resolve();
    await pending;
    expect(email.sendInvitationEmail).not.toHaveBeenCalled();
  });

  it('creates an Admin with a fixed role from the Admin directory (P45)', async () => {
    const { component, fixture } = setup('admin');
    component.setTargetRole('admin');
    fill(component);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Invitar administrador');
    await component.save();
    expect(issue).toHaveBeenCalledWith(expect.objectContaining({action:'create',role:'admin'}));
  });

  it('does not offer an Admin role to a Doctor (P45)', () => {
    const { component } = setup('doctor');
    component.setTargetRole('admin');
    expect((component as any).targetRole()).toBe('assistant');
  });

  it('does not expose Assistant creation in the Admin UI (P45)', () => {
    const { component } = setup('admin');
    component.setTargetRole('assistant');
    expect((component as any).targetRole()).toBe('doctor');
  });

  it('resends through the same pending ID and exposes no editable recipient fields', async () => {
    const { component, fixture } = setup('admin');
    component.setResendTarget({ uid: 'pending', name: 'Invitado ficticio', email: 'invited@example.test', pending: true });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Reenviar invitación');
    expect(fixture.nativeElement.querySelector('input[formControlName="email"]').readOnly).toBe(true);
    await component.save();
    expect(issue).toHaveBeenCalledExactlyOnceWith({ action: 'resend', userId: 'pending', operationId: expect.any(String) });
  });
  it('retries creation with the same operation ID after an unknown server failure', async () => {
    const { component } = setup(); fill(component);
    issue.mockRejectedValueOnce(new Error('Synthetic lost acknowledgement'));
    await component.save(); await component.save();
    expect(issue.mock.calls[0][0]).toEqual(issue.mock.calls[1][0]);
  });
  it('shows the server duplicate message without email delivery or a link', async () => {
    const { component, email } = setup(); fill(component);
    issue.mockRejectedValueOnce({ code: 'functions/already-exists', message: 'Revisa el directorio y reenvía la invitación.' });
    await component.save();
    expect(component.error()).toContain('Revisa el directorio');
    expect(component.invitationLink()).toBe(''); expect(email.sendInvitationEmail).not.toHaveBeenCalled();
  });

  it('closing an idle or failed invitation closes without creating another record', async () => {
    const { component, ref, email } = setup();
    component.close();
    expect(ref.close).toHaveBeenCalledOnce();
    email.sendInvitationEmail.mockRejectedValue(new Error('Synthetic failure'));
    fill(component);
    await component.save();
    component.close();
    expect(ref.close).toHaveBeenCalledTimes(2);
    expect(issue).toHaveBeenCalledTimes(1);
  });
});
