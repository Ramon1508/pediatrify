import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef } from '@angular/material/dialog';
import { EditDoctorDialog } from './edit-doctor-dialog';
import { UserRepository } from '../../../../core/repositories/user.repository';
import { FirebaseService } from '../../../../core/firebase/firebase.service';
import { AlertService } from '../../../../core/services/alert.service';
import { AppUser } from '../../../../core/models/user';

describe('EditDoctorDialog', () => {
  const mockDoctor: AppUser = { uid: 'd1', name: 'Dr. Test', email: 'test@mail.com', role: 'doctor', pending: false };
  const mockAssistant: AppUser = { uid: 'a1', name: 'Asistente', email: 'a@mail.com', role: 'assistant', pending: false };

  function createFixture(doctor: AppUser = mockDoctor) {
    const userRepo = { updateUser: vi.fn().mockResolvedValue(undefined) };
    const firebaseService = { auth: {} };
    const alertService = { success: vi.fn(), error: vi.fn() };
    const dialogRef = { close: vi.fn() };

    TestBed.configureTestingModule({
      imports: [EditDoctorDialog, NoopAnimationsModule],
      providers: [
        { provide: UserRepository, useValue: userRepo },
        { provide: FirebaseService, useValue: firebaseService },
        { provide: AlertService, useValue: alertService },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    });

    const fixture = TestBed.createComponent(EditDoctorDialog);
    const component = fixture.componentInstance as any;
    component.setDoctor(doctor);
    fixture.detectChanges();
    return { fixture, component, userRepo, alertService, dialogRef };
  }

  it('renders title for doctor', () => {
    const { fixture } = createFixture();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Editar doctor');
  });

  it('renders title for assistant', () => {
    const { fixture } = createFixture(mockAssistant);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Editar asistente');
  });

  it('pre-fills form with doctor data', () => {
    const { component } = createFixture();
    expect(component.form.value.name).toBe('Dr. Test');
    expect(component.form.value.email).toBe('test@mail.com');
  });

  it('shows password section when email changes', () => {
    const { component } = createFixture();
    component.form.patchValue({ email: 'new@mail.com' });
    component.onEmailChange();
    expect(component.showPasswordSection).toBe(true);
  });

  it('hides password section when email is same', () => {
    const { component } = createFixture();
    component.form.patchValue({ email: 'test@mail.com' });
    component.onEmailChange();
    expect(component.showPasswordSection).toBe(false);
  });

  it('calls updateUser on save without email change', async () => {
    const { component, userRepo, alertService, dialogRef } = createFixture();
    await component.save();
    expect(userRepo.updateUser).toHaveBeenCalledWith('d1', { name: 'Dr. Test' });
    expect(alertService.success).toHaveBeenCalled();
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('shows error if password mismatch on email change', async () => {
    const { component } = createFixture();
    component.form.patchValue({ email: 'new@mail.com' });
    component.onEmailChange();
    component.passwordForm.setValue({ newPassword: '12345678', confirmPassword: 'different' });
    await component.save();
    expect(component.error).toBe('Las contraseñas no coinciden.');
  });

  it('validates empty form on submit', () => {
    const { component } = createFixture();
    component.form.patchValue({ name: '', email: '' });
    component.submitted = true;
    expect(component.form.invalid).toBe(true);
  });

  it('closes dialog on close()', () => {
    const { component, dialogRef } = createFixture();
    component.close();
    expect(dialogRef.close).toHaveBeenCalled();
  });
});
