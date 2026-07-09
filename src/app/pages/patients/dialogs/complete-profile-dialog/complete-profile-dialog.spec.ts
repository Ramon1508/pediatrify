import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef } from '@angular/material/dialog';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MAT_DATE_LOCALE } from '@angular/material/core';
import { CompleteProfileDialog } from './complete-profile-dialog';
import { PatientRepository } from '../../../../core/repositories/patient.repository';
import { AlertService } from '../../../../core/services/alert.service';

describe('CompleteProfileDialog', () => {
  const mockPatient = {
    id: 'p1',
    name: 'Juan',
    lastName: 'Pérez',
    email: 'juan@mail.com',
    phone: '5555555555',
    fatherName: 'Carlos',
    motherName: 'María',
    birthDate: '2020-01-15',
    otpPassword: '123456',
  };

  function createFixture() {
    const patientRepo = {
      updatePatient: vi.fn().mockResolvedValue(undefined),
      getAllPatients: vi.fn().mockResolvedValue([]),
    };
    const alertService = { success: vi.fn(), error: vi.fn() };
    const dialogRef = { close: vi.fn() };

    TestBed.configureTestingModule({
      imports: [CompleteProfileDialog, NoopAnimationsModule],
      providers: [
        provideNativeDateAdapter(),
        { provide: MAT_DATE_LOCALE, useValue: 'es-MX' },
        { provide: PatientRepository, useValue: patientRepo },
        { provide: AlertService, useValue: alertService },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    });

    const fixture = TestBed.createComponent(CompleteProfileDialog);
    const component = fixture.componentInstance as any;
    component.setPatient(mockPatient);
    fixture.detectChanges();
    return { fixture, component, patientRepo, alertService, dialogRef };
  }

  it('renders title', async () => {
    const { fixture } = createFixture();
    await new Promise(r => setTimeout(r, 50));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Perfil del paciente');
  }, 30000);

  it('pre-fills form with patient data', () => {
    const { component } = createFixture();
    expect(component.form.value.fullName).toBe('Juan Pérez');
  });

  it('shows save button on step 3', async () => {
    const { component, fixture } = createFixture();
    component.step = 3;
    component.cdr.markForCheck();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const btns = fixture.nativeElement.querySelectorAll('button');
    const texts = Array.from(btns).map((b: any) => b.textContent.trim());
    expect(texts.some((t) => t.includes('Guardar'))).toBe(true);
  });

  it('calls updatePatient with profileComplete on save', async () => {
    const { component, patientRepo, alertService, dialogRef } = createFixture();
    component.form.patchValue({
      fullName: 'Juan Pérez', birthDate: '2020-01-15',
      bloodType: 'O+', birthWeight: 3.5, birthHeight: 50,
      sex: 1, birthMethod: 'vaginal',
      hasAllergies: false, hasBeenHospitalized: false, hasDisease: false, takesMedication: false,
      email: 'juan@mail.com', phone: '5555555555',
      fatherName: 'Carlos', motherName: 'María',
    });
    await component.save();
    expect(patientRepo.updatePatient).toHaveBeenCalledWith('p1', expect.objectContaining({ profileComplete: true }));
    expect(alertService.success).toHaveBeenCalledWith({ message: 'Perfil del paciente guardado.', duration: 3000 });
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('shows error on save failure', async () => {
    const { component, patientRepo, alertService } = createFixture();
    patientRepo.updatePatient.mockRejectedValue(new Error('fail'));
    component.form.patchValue({
      fullName: 'Juan Pérez', birthDate: '2020-01-15',
      bloodType: 'O+', birthWeight: 3.5, birthHeight: 50,
      sex: 1, birthMethod: 'vaginal',
      hasAllergies: false, hasBeenHospitalized: false, hasDisease: false, takesMedication: false,
      email: 'juan@mail.com', phone: '5555555555',
      fatherName: 'Carlos', motherName: 'María',
    });
    await component.save();
    expect(alertService.error).toHaveBeenCalled();
  });

  it('closes dialog on close()', () => {
    const { component, dialogRef } = createFixture();
    component.close();
    expect(dialogRef.close).toHaveBeenCalledWith(false);
  });
});
