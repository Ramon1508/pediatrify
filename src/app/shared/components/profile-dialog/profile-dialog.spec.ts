import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef, MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { ProfileDialog } from './profile-dialog';
import { UserRepository } from '../../../core/repositories/user.repository';
import { PrintSettingsRepository } from '../../../core/repositories/print-settings.repository';
import { AuthService } from '../../../core/services/auth.service';
import { AlertService } from '../../../core/services/alert.service';
import { FirebaseService } from '../../../core/firebase/firebase.service';
import { AppUser } from '../../../core/models/user';
import { Subject } from 'rxjs';
import { StaffEmailChangeService } from '../../../core/services/staff-email-change.service';

vi.mock('firebase/storage', () => ({
  ref: vi.fn().mockReturnValue({}),
  getDownloadURL: vi.fn().mockResolvedValue('https://example.com/logos/logo.png'),
}));

describe('ProfileDialog', () => {
  const mockDoctor: AppUser = {
    uid: 'd1',
    name: 'Dr. Test',
    email: 'test@mail.com',
    role: 'doctor',
    sexo: 1,
    phone: '555',
    especialidad: 'Pediatría',
    cedula: '123',
    cedulaEspecialidad: '456',
    consultorios: 'Consultorio A',
    logoPath: '',
  };

  const mockAssistant: AppUser = { ...mockDoctor, role: 'assistant', uid: 'a1' };
  const mockAdmin: AppUser = { ...mockDoctor, role: 'admin', uid: 'admin-test', name: 'Administrador de prueba' };

  function createFixture(doctor: AppUser = mockDoctor) {
    const emailChange = { changeEmail: vi.fn().mockResolvedValue({ updated: true, pendingInvitation: false }) };
    const userRepo = { updateUser: vi.fn().mockResolvedValue(undefined) };
    const printSettingsRepo = { getSettings: vi.fn().mockResolvedValue({ usePreloadedLogo: true }), updateSettings: vi.fn().mockResolvedValue(undefined) };
    const alertService = { success: vi.fn(), error: vi.fn() };
    const authService = { currentDoctor: doctor, updateCurrentDoctor: vi.fn(), logout: vi.fn().mockResolvedValue(undefined) };
    const dialogRef = { close: vi.fn(), addPanelClass: vi.fn(), removePanelClass: vi.fn() };
    const router = { navigate: vi.fn() };
    const firebase = { storage: {} };
    const dialog = { open: vi.fn() };

    TestBed.configureTestingModule({
      imports: [ProfileDialog, NoopAnimationsModule],
      providers: [
        { provide: UserRepository, useValue: userRepo },
        { provide: StaffEmailChangeService, useValue: emailChange },
        { provide: PrintSettingsRepository, useValue: printSettingsRepo },
        { provide: AuthService, useValue: authService },
        { provide: AlertService, useValue: alertService },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MatDialog, useValue: dialog },
        { provide: Router, useValue: router },
        { provide: FirebaseService, useValue: firebase },
      ],
    });
    TestBed.overrideProvider(MatDialog, { useValue: dialog });

    const fixture = TestBed.createComponent(ProfileDialog);
    const component = fixture.componentInstance as any;
    fixture.detectChanges();
    return { fixture, component, emailChange, userRepo, printSettingsRepo, alertService, authService, dialogRef, router, dialog };
  }

  it('renders the title "Perfil"', () => {
    const { fixture } = createFixture();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Perfil');
  }, 10000);

  it('starts in read-only mode with the form disabled', () => {
    const { component, dialogRef } = createFixture();
    expect(component.readOnly()).toBe(true);
    expect(component.form().disabled).toBe(true);
    expect(dialogRef.addPanelClass).not.toHaveBeenCalled();
  });

  it('doctor profile shows all read fields and "Editar perfil"', () => {
    const { fixture } = createFixture();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Doctor(a)');
    expect(el.textContent).toContain('Pediatría');
    expect(el.textContent).toContain('Cédula profesional');
    expect(el.textContent).toContain('Editar perfil');
    expect(el.textContent).toContain('Cerrar sesión');
  });

  it('simple profile (assistant) shows only role, name, email and "Cerrar sesión"', () => {
    const { fixture } = createFixture(mockAssistant);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Asistente');
    expect(el.textContent).toContain('test@mail.com');
    expect(el.textContent).toContain('Cerrar sesión');
    expect(el.textContent).toContain('Editar perfil');
    expect(el.textContent).not.toContain('Pediatría');
  });

  it('does not allow an assistant to set a doctor logo', () => {
    const { component } = createFixture(mockAssistant);

    component.onLogoUploaded({
      path: 'logos/a1/forbidden.png',
      url: 'https://example.com/forbidden.png',
    });

    expect(component.logoUpload).toBeUndefined();
    expect(component.logoUrl()).toBe('');
  });

  it('switchToEdit enables the form', () => {
    const { component, dialogRef } = createFixture();
    component.switchToEdit();
    expect(component.readOnly()).toBe(false);
    expect(component.form().enabled).toBe(true);
    expect(dialogRef.addPanelClass).toHaveBeenCalledWith('profile-edit-panel');
  });

  it('loads the same persisted logo when the profile is opened again', async () => {
    const { component } = createFixture({
      ...mockDoctor,
      logoPath: 'logos/d1/persisted-logo.png',
    });

    await vi.waitFor(() => {
      expect(component.logoFileName()).toBe('persisted-logo.png');
      expect(component.logoUrl()).toBe('https://example.com/logos/logo.png');
    });
  });

  it('cancelEdit restores original values and disables the form', () => {
    const { component, dialogRef } = createFixture();
    component.switchToEdit();
    component.form().controls.name.setValue('Dr. Cambiado');
    component.cancelEdit();
    expect(component.form().disabled).toBe(true);
    expect(component.form().value.name).toBe('Dr. Test');
    expect(component.readOnly()).toBe(true);
    expect(dialogRef.removePanelClass).toHaveBeenCalledWith('profile-edit-panel');
  });

  it('save() calls updateUser and shows the saved message', async () => {
    const { component, userRepo, dialogRef } = createFixture();
    component.switchToEdit();
    component.form().controls.name.setValue('Dr. Actualizado');
    component.form().markAsDirty();
    await component.save();
    expect(userRepo.updateUser).toHaveBeenCalledWith(
      'd1',
      expect.objectContaining({ name: 'Dr. Actualizado', phone: '555', logoPath: '' })
    );
    expect(component.showSaved()).toBe(true);
    expect(dialogRef.removePanelClass).toHaveBeenCalledWith('profile-edit-panel');
    expect(component.readOnly()).toBe(true);
    expect(component.form().disabled).toBe(true);
  });

  it('updates the shared doctor session after saving a new logo', async () => {
    const { component, authService, printSettingsRepo, userRepo } = createFixture();
    component.switchToEdit();
    component.onLogoUploaded({
      path: 'logos/d1/new-logo.png',
      url: 'https://example.com/new-logo.png',
    });

    await component.save();

    expect(authService.updateCurrentDoctor).toHaveBeenCalledWith(
      expect.objectContaining({ logoPath: 'logos/d1/new-logo.png' })
    );
    expect(userRepo.updateUser).toHaveBeenCalledWith(
      'd1',
      expect.objectContaining({ printSettings: expect.objectContaining({ usePreloadedLogo: false }) })
    );
    expect(printSettingsRepo.updateSettings).not.toHaveBeenCalled();
    expect(component.logoUrl()).toBe('https://example.com/new-logo.png');
  });

  it('removes the shared doctor logo instead of keeping a stale copy', async () => {
    const { component, userRepo, authService, printSettingsRepo } = createFixture({
      ...mockDoctor,
      logoPath: 'logos/d1/old-logo.png',
    });
    component.switchToEdit();
    component.onLogoUploaded(null);

    await component.save();

    expect(userRepo.updateUser).toHaveBeenCalledWith(
      'd1',
      expect.objectContaining({ logoPath: '' })
    );
    expect(authService.updateCurrentDoctor).toHaveBeenCalledWith(
      expect.objectContaining({ logoPath: '' })
    );
    expect(userRepo.updateUser).toHaveBeenCalledWith(
      'd1',
      expect.objectContaining({ printSettings: expect.objectContaining({ usePreloadedLogo: true }) })
    );
    expect(printSettingsRepo.updateSettings).not.toHaveBeenCalled();
  });

  it('save() does nothing when the form is invalid', async () => {
    const { component, userRepo, dialogRef } = createFixture();
    component.switchToEdit();
    component.form().controls.name.setValue('');
    await component.save();
    expect(userRepo.updateUser).not.toHaveBeenCalled();
    expect(dialogRef.removePanelClass).not.toHaveBeenCalled();
  });

  it.each(['profile', 'settings'] as const)('retains the committed logo after a %s failure and retries without uploading twice (P50)', async (failure) => {
    const { component, userRepo, printSettingsRepo, alertService, authService } = createFixture();
    component.switchToEdit();
    component.onLogoUploaded({ path: 'logos/d1/draft.png', url: 'blob:draft' });
    let pending = true;
    const committed = { path: 'logos/d1/committed.png', url: 'https://example.com/committed.png' };
    const upload = vi.fn(async () => { pending = false; return committed; });
    component.logoUploader = { get hasPending() { return pending; }, upload, reset: vi.fn() };
    if (failure === 'profile') userRepo.updateUser.mockRejectedValueOnce(new Error('synthetic denied'));
    else printSettingsRepo.getSettings.mockRejectedValueOnce(new Error('synthetic denied'));
    await component.save();
    expect(upload).toHaveBeenCalledTimes(1);
    expect(component.logoUpload).toEqual(committed);
    expect(component.logoUrl()).toBe(committed.url);
    expect(component.readOnly()).toBe(false);
    expect(authService.updateCurrentDoctor).not.toHaveBeenCalled();
    expect(alertService.error).toHaveBeenCalledWith(expect.objectContaining({message: expect.stringContaining('listo para reintentar')}));
    if (failure === 'settings') expect(userRepo.updateUser).not.toHaveBeenCalled();
    await component.save();
    expect(upload).toHaveBeenCalledTimes(1);
    expect(userRepo.updateUser).toHaveBeenLastCalledWith('d1', expect.objectContaining({logoPath: committed.path,
      printSettings: expect.objectContaining({usePreloadedLogo: false})}));
    expect(printSettingsRepo.updateSettings).not.toHaveBeenCalled();
    expect(component.logoUrl()).toBe(committed.url);
    expect(component.readOnly()).toBe(true);
  });

  it.each(['profile', 'settings'] as const)('retains the committed logo after a %s failure and retries without uploading twice (P50)', async (failure) => {
    const { component, userRepo, printSettingsRepo, alertService, authService } = createFixture();
    component.switchToEdit();
    component.onLogoUploaded({ path: 'logos/d1/draft.png', url: 'blob:draft' });
    let pending = true;
    const committed = { path: 'logos/d1/committed.png', url: 'https://example.com/committed.png' };
    const upload = vi.fn(async () => { pending = false; return committed; });
    component.logoUploader = { get hasPending() { return pending; }, upload, reset: vi.fn() };
    if (failure === 'profile') userRepo.updateUser.mockRejectedValueOnce(new Error('synthetic denied'));
    else printSettingsRepo.getSettings.mockRejectedValueOnce(new Error('synthetic denied'));
    await component.save();
    expect(upload).toHaveBeenCalledTimes(1);
    expect(component.logoUpload).toEqual(committed);
    expect(component.logoUrl()).toBe(committed.url);
    expect(component.readOnly()).toBe(false);
    expect(authService.updateCurrentDoctor).not.toHaveBeenCalled();
    expect(alertService.error).toHaveBeenCalledWith(expect.objectContaining({message: expect.stringContaining('listo para reintentar')}));
    if (failure === 'settings') expect(userRepo.updateUser).not.toHaveBeenCalled();
    await component.save();
    expect(upload).toHaveBeenCalledTimes(1);
    expect(userRepo.updateUser).toHaveBeenLastCalledWith('d1', expect.objectContaining({logoPath: committed.path,
      printSettings: expect.objectContaining({usePreloadedLogo: false})}));
    expect(printSettingsRepo.updateSettings).not.toHaveBeenCalled();
    expect(component.logoUrl()).toBe(committed.url);
    expect(component.readOnly()).toBe(true);
  });

  it('save() failure shows an error alert', async () => {
    const { component, userRepo, alertService, dialogRef } = createFixture();
    userRepo.updateUser.mockRejectedValue(new Error('fail'));
    component.switchToEdit();
    component.form().controls.name.setValue('Dr. Actualizado');
    component.form().markAsDirty();
    await component.save();
    expect(alertService.error).toHaveBeenCalledWith({ message: 'Error al guardar los cambios', duration: 5000 });
    expect(component.saving()).toBe(false);
    expect(component.readOnly()).toBe(false);
    expect(dialogRef.removePanelClass).not.toHaveBeenCalled();
  });

  it('close() closes the dialog in read-only mode', () => {
    const { component, dialogRef } = createFixture();
    component.close();
    expect(dialogRef.close).toHaveBeenCalled();
  });

  it('close() closes the dialog even in edit mode (no confirmation)', () => {
    const { component, dialogRef } = createFixture();
    component.switchToEdit();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    component.close();
    expect(dialogRef.close).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('logout() closes the dialog, logs out and navigates to login', () => {
    const { component, dialogRef, authService, router } = createFixture();
    component.logout();
    expect(dialogRef.close).toHaveBeenCalled();
    expect(authService.logout).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('hides the close button when rendered as a page (mobile)', () => {
    const { fixture } = createFixture();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.btn-close-dialog')).toBeTruthy();
    fixture.componentRef.setInput('asPage', true);
    fixture.detectChanges();
    expect(el.querySelector('.btn-close-dialog')).toBeNull();
  });

  it('admin has only email enabled, name read-only and no professional fields', () => {
    const { fixture, component } = createFixture(mockAdmin);
    component.switchToEdit();
    fixture.detectChanges();
    expect(component.form().controls.email.enabled).toBe(true);
    expect(component.form().controls.name.disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('input[formControlName="name"]').readOnly).toBe(true);
    expect(fixture.nativeElement.querySelector('input[formControlName="email"]').readOnly).toBe(false);
    expect(fixture.nativeElement.querySelector('app-file-upload')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Cédula');
  });

  it('admin sends only email metadata even when name and hidden fields are manipulated', async () => {
    const { component, emailChange, userRepo, authService, printSettingsRepo, router, dialogRef } = createFixture(mockAdmin);
    component.switchToEdit();
    component.form().enable();
    component.form().patchValue({ name: 'Forbidden change', phone: '999', email: ' NEW@example.test ' });
    component.form().markAsDirty();
    // Angular email validator rejects exterior spaces, so use a valid typed address.
    component.form().controls.email.setValue('NEW@example.test');
    await component.save();
    expect(emailChange.changeEmail).toHaveBeenCalledExactlyOnceWith({
      userId: mockAdmin.uid, email: 'new@example.test', expectedEmail: mockAdmin.email,
      operationId: expect.any(String),
    });
    expect(userRepo.updateUser).not.toHaveBeenCalled();
    expect(printSettingsRepo.getSettings).not.toHaveBeenCalled();
    expect(authService.updateCurrentDoctor).toHaveBeenCalledWith({ email: 'new@example.test' });
    expect(authService.logout).toHaveBeenCalledOnce();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('rejects an admin name-only save even if its disabled control is enabled manually', async () => {
    const { component, emailChange, userRepo } = createFixture(mockAdmin);
    component.switchToEdit();
    component.form().controls.name.enable();
    component.form().controls.name.setValue('Changed');
    component.form().markAsDirty();
    await component.save();
    expect(component.saveDisabled()).toBe(true);
    expect(emailChange.changeEmail).not.toHaveBeenCalled();
    expect(userRepo.updateUser).not.toHaveBeenCalled();
  });

  it('assistant enables only name and email', () => {
    const { fixture, component } = createFixture(mockAssistant);
    component.switchToEdit();
    fixture.detectChanges();
    expect(component.form().controls.name.enabled).toBe(true);
    expect(component.form().controls.email.enabled).toBe(true);
    expect(component.form().controls.phone.disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('app-file-upload')).toBeNull();
  });

  it('saves only assistant name, keeps its session and leaves professional settings untouched', async () => {
    const { component, userRepo, authService, emailChange, printSettingsRepo } = createFixture(mockAssistant);
    component.switchToEdit();
    component.form().enable();
    component.form().patchValue({ name: '  Nuevo nombre  ', phone: '999', cedula: 'forbidden' });
    component.form().markAsDirty();
    await component.save();
    expect(userRepo.updateUser).toHaveBeenCalledExactlyOnceWith(mockAssistant.uid, { name: 'Nuevo nombre' });
    expect(authService.updateCurrentDoctor).toHaveBeenCalledWith({ name: 'Nuevo nombre' });
    expect(emailChange.changeEmail).not.toHaveBeenCalled();
    expect(authService.logout).not.toHaveBeenCalled();
    expect(printSettingsRepo.getSettings).not.toHaveBeenCalled();
    expect(component.readOnly()).toBe(true);
  });

  it('assistant sends name with changed email, then signs out after confirmation', async () => {
    const { component, emailChange, authService, userRepo } = createFixture(mockAssistant);
    component.switchToEdit();
    component.form().patchValue({ name: '  Nuevo  ', email: 'new@example.test' });
    component.form().markAsDirty();
    await component.save();
    expect(emailChange.changeEmail).toHaveBeenCalledWith({
      userId: mockAssistant.uid, name: 'Nuevo', email: 'new@example.test', expectedEmail: mockAssistant.email,
      operationId: expect.any(String),
    });
    expect(userRepo.updateUser).not.toHaveBeenCalled();
    expect(authService.logout).toHaveBeenCalledOnce();
  });

  it.each(['', '   ', 'x'.repeat(301)])('validates assistant name (%s)', async (name) => {
    const { component, userRepo, emailChange, fixture } = createFixture(mockAssistant);
    component.switchToEdit();
    component.form().controls.name.setValue(name);
    component.form().markAsDirty();
    await component.save();
    fixture.detectChanges();
    expect(component.saveDisabled()).toBe(true);
    expect(fixture.nativeElement.querySelector('mat-error')).toBeTruthy();
    expect(userRepo.updateUser).not.toHaveBeenCalled();
    expect(emailChange.changeEmail).not.toHaveBeenCalled();
  });

  it.each(['', 'invalid', 'x'.repeat(250) + '@example.test'])('validates admin email (%s)', async (email) => {
    const { component, emailChange, fixture } = createFixture(mockAdmin);
    component.switchToEdit();
    component.form().controls.email.setValue(email);
    component.form().markAsDirty();
    await component.save();
    fixture.detectChanges();
    expect(component.saveDisabled()).toBe(true);
    expect(fixture.nativeElement.querySelector('mat-error')?.textContent).toContain('Ingresa un correo electrónico válido');
    expect(emailChange.changeEmail).not.toHaveBeenCalled();
  });

  it('keeps pristine/no meaningful change disabled and prevents double submission while saving', async () => {
    const { component, fixture, emailChange, dialogRef } = createFixture(mockAdmin);
    component.switchToEdit();
    expect(component.saveDisabled()).toBe(true);
    const input = fixture.nativeElement;
    fixture.detectChanges();
    const email = input.querySelector('input[formControlName="email"]') as HTMLInputElement;
    email.value = 'new@example.test';
    email.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(component.saveDisabled()).toBe(false);
    let resolve!: (value: unknown) => void;
    emailChange.changeEmail.mockReturnValue(new Promise(done => { resolve = done; }));
    const saving = component.save();
    fixture.detectChanges();
    expect(component.saveDisabled()).toBe(true);
    expect(fixture.nativeElement.querySelector('mat-spinner')).toBeTruthy();
    component.close();
    component.cancelEdit();
    await component.save();
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(emailChange.changeEmail).toHaveBeenCalledOnce();
    resolve({ updated: true, pendingInvitation: false });
    await saving;
  });

  it('keeps failed draft and reuses operation ID on retry without signing out prematurely', async () => {
    const { component, emailChange, authService, alertService } = createFixture(mockAdmin);
    component.switchToEdit();
    component.form().controls.email.setValue('new@example.test');
    component.form().markAsDirty();
    emailChange.changeEmail.mockRejectedValueOnce({ code: 'functions/already-exists' });
    await component.save();
    const id = emailChange.changeEmail.mock.calls[0][0].operationId;
    expect(component.readOnly()).toBe(false);
    expect(component.form().controls.email.value).toBe('new@example.test');
    expect(authService.logout).not.toHaveBeenCalled();
    expect(alertService.error).toHaveBeenCalledWith(expect.objectContaining({ message: 'Ingresa un correo que no esté asociado a otra cuenta.' }));
    await component.save();
    expect(emailChange.changeEmail.mock.calls[1][0].operationId).toBe(id);
    expect(authService.logout).toHaveBeenCalledOnce();
  });

  it('cancel restores admin email without saving', () => {
    const { component, emailChange } = createFixture(mockAdmin);
    component.switchToEdit();
    component.form().controls.email.setValue('new@example.test');
    component.form().markAsDirty();
    component.cancelEdit();
    expect(component.form().controls.email.value).toBe(mockAdmin.email);
    expect(component.readOnly()).toBe(true);
    expect(emailChange.changeEmail).not.toHaveBeenCalled();
  });

  it('opens mobile assistant editing in the existing bottom sheet', () => {
    const { fixture, component, dialog, authService } = createFixture(mockAssistant);
    const closed = new Subject();
    const enterEditMode = vi.fn();
    dialog.open.mockReturnValue({ componentInstance: { enterEditMode }, afterClosed: () => closed });
    fixture.componentRef.setInput('asPage', true);
    component.switchToEdit();
    expect(dialog.open).toHaveBeenCalledWith(ProfileDialog, expect.objectContaining({ panelClass: ['profile-panel', 'profile-edit-panel'] }));
    expect(enterEditMode).toHaveBeenCalledOnce();
    authService.currentDoctor = { ...mockAssistant, name: 'Nuevo' };
    closed.next(true);
    closed.complete();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Nuevo');
  });

  it('closes mobile editing after saving assistant name', async () => {
    const { component, dialogRef } = createFixture(mockAssistant);
    component.enterEditMode();
    component.form().controls.name.setValue('Nuevo');
    component.form().markAsDirty();
    await component.save();
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('does not force logout or overwrite another account after an in-flight session change', async () => {
    const { component, emailChange, authService, router } = createFixture(mockAdmin);
    component.switchToEdit();
    component.form().controls.email.setValue('new@example.test');
    component.form().markAsDirty();
    let resolve!: (value: unknown) => void;
    emailChange.changeEmail.mockReturnValue(new Promise(done => { resolve = done; }));
    const pending = component.save();
    authService.currentDoctor = mockAssistant;
    resolve({ updated: true, pendingInvitation: false });
    await pending;
    expect(authService.updateCurrentDoctor).not.toHaveBeenCalled();
    expect(authService.logout).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('still directs a completed own email change to login if Auth already removed the local session', async () => {
    const { component, emailChange, authService, router } = createFixture(mockAdmin);
    component.switchToEdit();
    component.form().controls.email.setValue('new@example.test');
    component.form().markAsDirty();
    emailChange.changeEmail.mockImplementation(async () => {
      authService.currentDoctor = null as any;
      return { updated: true, pendingInvitation: false };
    });
    await component.save();
    expect(authService.updateCurrentDoctor).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('reports completed email separately from logout failure', async () => {
    const { component, authService, alertService, router } = createFixture(mockAdmin);
    component.switchToEdit();
    component.form().controls.email.setValue('new@example.test');
    component.form().markAsDirty();
    authService.logout.mockRejectedValue(new Error('Synthetic failure'));
    await component.save();
    expect(alertService.error).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('El correo se actualizó') }));
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});
