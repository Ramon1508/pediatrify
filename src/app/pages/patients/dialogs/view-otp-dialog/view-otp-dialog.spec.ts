import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef } from '@angular/material/dialog';
import { ViewOtpDialog } from './view-otp-dialog';
import { PatientRepository } from '../../../../core/repositories/patient.repository';
import { AlertService } from '../../../../core/services/alert.service';
import { Patient } from '../../../../core/models/user';

describe('ViewOtpDialog', () => {
  const mockPatient: Patient = { id: 'p1', name: 'Juan', lastName: 'Pérez', email: 'juan@mail.com', otpPassword: 'ABC123', birthDate: '2020-01-15', fatherName: 'Carlos', motherName: 'María', phone: '5555555555' };

  function createFixture(patient: Patient = mockPatient) {
    const patientRepo = { updatePatient: vi.fn().mockResolvedValue(undefined) };
    const alertService = { success: vi.fn(), error: vi.fn() };
    const dialogRef = { close: vi.fn() };

    TestBed.configureTestingModule({
      imports: [ViewOtpDialog, NoopAnimationsModule],
      providers: [
        { provide: PatientRepository, useValue: patientRepo },
        { provide: AlertService, useValue: alertService },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    });

    const fixture = TestBed.createComponent(ViewOtpDialog);
    const component = fixture.componentInstance as any;
    component.setPatient(patient);
    fixture.detectChanges();
    return { fixture, component, patientRepo, alertService, dialogRef };
  }

  it('renders title', () => {
    const { fixture } = createFixture();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Contraseña OTP');
  });

  it('displays patient name', () => {
    const { fixture } = createFixture();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Juan Pérez');
  });

  it('displays OTP value in view mode', () => {
    const { fixture } = createFixture();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('ABC123');
  });

  it('shows edit button in view mode', () => {
    const { fixture } = createFixture();
    const btns = fixture.nativeElement.querySelectorAll('button');
    const texts = Array.from(btns).map((b: any) => b.textContent.trim());
    expect(texts).toContain('Editar');
  });

  it('toggles to edit mode', () => {
    const { component, fixture } = createFixture();
    component.toggleEdit();
    fixture.detectChanges();
    expect(component.editing).toBe(true);
    expect(fixture.nativeElement.querySelector('.otp-field')).toBeTruthy();
  });

  it('saves OTP on save in edit mode', async () => {
    const { component, patientRepo, alertService } = createFixture();
    component.editing = true;
    component.otpValue = 'NEW456';
    await component.save();
    expect(patientRepo.updatePatient).toHaveBeenCalledWith('p1', { otpPassword: 'NEW456' });
    expect(alertService.success).toHaveBeenCalledWith({ message: 'Contraseña OTP actualizada', duration: 3000 });
    expect(component.editing).toBe(false);
  });

  it('shows error if OTP too short', async () => {
    const { component, alertService } = createFixture();
    component.otpValue = 'AB';
    await component.save();
    expect(alertService.error).toHaveBeenCalled();
  });

  it('copies OTP to clipboard', () => {
    const { component, alertService } = createFixture();
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    component.copyOtp();
    expect(alertService.success).toHaveBeenCalledWith({ message: 'Copiado al portapapeles', duration: 2000 });
  });

  it('closes dialog on close()', () => {
    const { component, dialogRef } = createFixture();
    component.close();
    expect(dialogRef.close).toHaveBeenCalledWith(false);
  });
});
