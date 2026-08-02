import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { ProfileDialog } from './profile-dialog';
import { UserRepository } from '../../../core/repositories/user.repository';
import { AuthService } from '../../../core/services/auth.service';
import { AlertService } from '../../../core/services/alert.service';
import { FirebaseService } from '../../../core/firebase/firebase.service';
import { AppUser } from '../../../core/models/user';

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

  function createFixture(doctor: AppUser = mockDoctor) {
    const userRepo = { updateUser: vi.fn().mockResolvedValue(undefined) };
    const alertService = { success: vi.fn(), error: vi.fn() };
    const authService = { currentDoctor: doctor, logout: vi.fn() };
    const dialogRef = { close: vi.fn() };
    const router = { navigate: vi.fn() };
    const firebase = { storage: {} };

    TestBed.configureTestingModule({
      imports: [ProfileDialog, NoopAnimationsModule],
      providers: [
        { provide: UserRepository, useValue: userRepo },
        { provide: AuthService, useValue: authService },
        { provide: AlertService, useValue: alertService },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: Router, useValue: router },
        { provide: FirebaseService, useValue: firebase },
      ],
    });

    const fixture = TestBed.createComponent(ProfileDialog);
    const component = fixture.componentInstance as any;
    fixture.detectChanges();
    return { fixture, component, userRepo, alertService, authService, dialogRef, router };
  }

  it('renders the title "Perfil"', () => {
    const { fixture } = createFixture();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Perfil');
  }, 10000);

  it('starts in read-only mode with the form disabled', () => {
    const { component } = createFixture();
    expect(component.readOnly).toBe(true);
    expect(component.form.disabled).toBe(true);
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
    expect(el.textContent).not.toContain('Editar perfil');
    expect(el.textContent).not.toContain('Pediatría');
  });

  it('switchToEdit enables the form', () => {
    const { component } = createFixture();
    component.switchToEdit();
    expect(component.readOnly).toBe(false);
    expect(component.form.enabled).toBe(true);
  });

  it('cancelEdit restores original values and disables the form', () => {
    const { component } = createFixture();
    component.switchToEdit();
    component.form.controls.name.setValue('Dr. Cambiado');
    component.cancelEdit();
    expect(component.form.disabled).toBe(true);
    expect(component.form.value.name).toBe('Dr. Test');
    expect(component.readOnly).toBe(true);
  });

  it('save() calls updateUser and shows the saved message', async () => {
    const { component, userRepo } = createFixture();
    component.switchToEdit();
    await component.save();
    expect(userRepo.updateUser).toHaveBeenCalledWith(
      'd1',
      expect.objectContaining({ name: 'Dr. Test', phone: '555', logoPath: '' })
    );
    expect(component.showSaved).toBe(true);
    expect(component.readOnly).toBe(true);
    expect(component.form.disabled).toBe(true);
  });

  it('save() does nothing when the form is invalid', async () => {
    const { component, userRepo } = createFixture();
    component.switchToEdit();
    component.form.controls.name.setValue('');
    await component.save();
    expect(userRepo.updateUser).not.toHaveBeenCalled();
  });

  it('save() failure shows an error alert', async () => {
    const { component, userRepo, alertService } = createFixture();
    userRepo.updateUser.mockRejectedValue(new Error('fail'));
    component.switchToEdit();
    await component.save();
    expect(alertService.error).toHaveBeenCalledWith({ message: 'Error al guardar los cambios', duration: 5000 });
    expect(component.saving).toBe(false);
  });

  it('close() closes the dialog in read-only mode', () => {
    const { component, dialogRef } = createFixture();
    component.close();
    expect(dialogRef.close).toHaveBeenCalled();
  });

  it('close() in edit mode asks for confirmation before closing', () => {
    const { component, dialogRef } = createFixture();
    component.switchToEdit();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    component.close();
    expect(dialogRef.close).not.toHaveBeenCalled();
    confirmSpy.mockReturnValue(true);
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
});
