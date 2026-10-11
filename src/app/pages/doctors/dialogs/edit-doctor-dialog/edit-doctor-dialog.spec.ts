import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef } from '@angular/material/dialog';
import { EditDoctorDialog } from './edit-doctor-dialog';
import { UserRepository } from '../../../../core/repositories/user.repository';
import { AuthService } from '../../../../core/services/auth.service';
import { StaffEmailChangeService } from '../../../../core/services/staff-email-change.service';
import { AlertService } from '../../../../core/services/alert.service';
import { AppUser } from '../../../../core/models/user';

describe('EditDoctorDialog', () => {
  const doctor: AppUser = { uid: 'doctor', name: 'Doctor ficticio', email: 'doctor@example.test', role: 'doctor', pending: false };
  const assistant: AppUser = { uid: 'assistant', name: 'Asistente ficticio', email: 'assistant@example.test', role: 'assistant', pending: false, createdBy: 'doctor' };
  function setup(target = doctor, actor: AppUser = { uid: 'admin', role: 'admin', name: 'Admin ficticio', email: 'admin@example.test' }) {
    const userRepo = { updateUser: vi.fn().mockResolvedValue(undefined) };
    const emailChange = { changeEmail: vi.fn().mockResolvedValue({ updated: true, pendingInvitation: false }) };
    const auth = { currentDoctor: actor, logout: vi.fn() };
    const alerts = { success: vi.fn(), error: vi.fn() };
    const ref = { close: vi.fn(), disableClose: false };
    TestBed.configureTestingModule({ imports: [EditDoctorDialog, NoopAnimationsModule], providers: [
      { provide: UserRepository, useValue: userRepo }, { provide: AuthService, useValue: auth },
      { provide: StaffEmailChangeService, useValue: emailChange }, { provide: AlertService, useValue: alerts },
      { provide: MatDialogRef, useValue: ref },
    ] });
    const fixture = TestBed.createComponent(EditDoctorDialog);
    const component = fixture.componentInstance as any;
    component.setDoctor(target);
    fixture.detectChanges();
    return { component, fixture, userRepo, emailChange, auth, ref, alerts };
  }
  function edit(component: any, fields: object) { component.form().patchValue(fields); component.form().markAsDirty(); }

  it('updates another Admin name through the authorized server operation (P45)', async () => {
    const target: AppUser = { ...doctor, uid: 'admin-b', role: 'admin' };
    const { component, fixture, emailChange, userRepo, ref } = setup(target);
    expect(fixture.nativeElement.textContent).toContain('Editar administrador');
    edit(component, { name: 'Administrador actualizado' });
    await component.save();
    expect(emailChange.changeEmail).toHaveBeenCalledExactlyOnceWith({
      userId: target.uid, name: 'Administrador actualizado', email: target.email,
      expectedEmail: target.email, operationId: expect.any(String),
    });
    expect(userRepo.updateUser).not.toHaveBeenCalled();
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('updates another Admin email without changing the operator session (P45)', async () => {
    const target: AppUser = { ...doctor, uid: 'admin-b', role: 'admin' };
    const { component, emailChange, userRepo, auth, ref } = setup(target);
    edit(component, { email: 'NEW@example.test' });
    await component.save();
    expect(emailChange.changeEmail).toHaveBeenCalledWith(expect.objectContaining({ userId: target.uid, email: 'new@example.test' }));
    expect(userRepo.updateUser).not.toHaveBeenCalled();
    expect(auth.logout).not.toHaveBeenCalled();
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('rejects a Doctor attempting to edit an Admin (P45)', async () => {
    const { component, emailChange, userRepo } = setup({ ...doctor, uid: 'admin-b', role: 'admin' }, doctor);
    edit(component, { email: 'new@example.test' });
    await component.save();
    expect(emailChange.changeEmail).not.toHaveBeenCalled();
    expect(userRepo.updateUser).not.toHaveBeenCalled();
  });

  it('prefills one name/email form, without password controls', () => {
    const { component, fixture } = setup();
    expect(component.form().getRawValue()).toEqual({ name: doctor.name, email: doctor.email });
    expect(fixture.nativeElement.textContent).toContain('Editar doctor');
    expect(fixture.nativeElement.querySelector('input[type="password"]')).toBeNull();
    expect(component.saveDisabled()).toBe(true);
  });
  it('doctor edits its own assistant label', () => {
    const { fixture } = setup(assistant, doctor);
    expect(fixture.nativeElement.textContent).toContain('Editar asistente');
  });
  it('saves only changed name without touching Auth', async () => {
    const { component, userRepo, emailChange, auth, ref } = setup();
    edit(component, { name: 'Nombre actualizado' });
    await component.save();
    expect(userRepo.updateUser).toHaveBeenCalledExactlyOnceWith(doctor.uid, { name: 'Nombre actualizado' });
    expect(emailChange.changeEmail).not.toHaveBeenCalled();
    expect(auth.logout).not.toHaveBeenCalled();
    expect(ref.close).toHaveBeenCalledWith(true);
  });
  it('email change sends identity metadata without passwords and keeps operator session', async () => {
    const { component, emailChange, userRepo, auth, ref, fixture } = setup();
    edit(component, { name: '  Nombre actualizado  ', email: 'NEW@example.test' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('contraseña actual');
    await component.save();
    expect(emailChange.changeEmail).toHaveBeenCalledExactlyOnceWith({
      userId: doctor.uid, name: 'Nombre actualizado', email: 'new@example.test',
      expectedEmail: doctor.email, operationId: expect.any(String),
    });
    expect(userRepo.updateUser).not.toHaveBeenCalled();
    expect(auth.currentDoctor.uid).toBe('admin');
    expect(auth.logout).not.toHaveBeenCalled();
    expect(ref.close).toHaveBeenCalledWith(true);
  });
  it('pending invitation success instructs re-sending', async () => {
    const { component, emailChange, alerts } = setup({ ...doctor, pending: true });
    emailChange.changeEmail.mockResolvedValue({ updated: true, pendingInvitation: true });
    edit(component, { email: 'new@example.test' });
    await component.save();
    expect(alerts.success).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Reenvía la invitación') }));
  });
  it.each([{ name: '' }, { name: '   ' }, { name: 'x'.repeat(201) }, { email: 'bad' }, { email: '' }])('rejects invalid inputs %j', async fields => {
    const { component, userRepo, emailChange } = setup();
    edit(component, fields);
    await component.save();
    expect(component.saveDisabled()).toBe(true);
    expect(userRepo.updateUser).not.toHaveBeenCalled();
    expect(emailChange.changeEmail).not.toHaveBeenCalled();
  });
  it('blocks unauthorized doctor, admin editing assistant, or assistant managing staff', async () => {
    const { component, auth, emailChange, userRepo } = setup(assistant, doctor);
    for (const actor of [{ ...doctor, uid: 'other' }, { ...doctor, role: 'admin' }, assistant]) {
      auth.currentDoctor = actor as AppUser;
      edit(component, { email: 'new@example.test' });
      await component.save();
    }
    expect(emailChange.changeEmail).not.toHaveBeenCalled();
    expect(userRepo.updateUser).not.toHaveBeenCalled();
  });
  it('keeps failed draft and stable operation ID, releases loading and retries', async () => {
    const { component, emailChange, ref } = setup();
    edit(component, { email: 'new@example.test' });
    emailChange.changeEmail.mockRejectedValueOnce({ code: 'functions/already-exists' });
    await component.save();
    expect(component.error()).toContain('no esté asociado');
    expect(ref.close).not.toHaveBeenCalled();
    expect(component.saving()).toBe(false);
    expect(ref.disableClose).toBe(false);
    await component.save();
    expect(emailChange.changeEmail.mock.calls[1][0].operationId).toBe(emailChange.changeEmail.mock.calls[0][0].operationId);
    expect(ref.close).toHaveBeenCalledWith(true);
  });
  it('prevents duplicate saves and closes while saving', async () => {
    const { component, emailChange, ref } = setup();
    edit(component, { email: 'new@example.test' });
    let done!: (value: unknown) => void;
    emailChange.changeEmail.mockReturnValue(new Promise(resolve => { done = resolve; }));
    const pending = component.save();
    await component.save();
    component.close();
    expect(component.saveDisabled()).toBe(true);
    expect(ref.close).not.toHaveBeenCalled();
    expect(emailChange.changeEmail).toHaveBeenCalledOnce();
    done({ updated: true, pendingInvitation: false });
    await pending;
  });
  it('does not publish success to a different operator session', async () => {
    const { component, emailChange, auth, alerts, ref } = setup();
    edit(component, { email: 'new@example.test' });
    emailChange.changeEmail.mockImplementation(async () => { auth.currentDoctor = assistant; return { updated: true, pendingInvitation: false }; });
    await component.save();
    expect(ref.close).not.toHaveBeenCalled();
    expect(alerts.success).not.toHaveBeenCalled();
  });
});
