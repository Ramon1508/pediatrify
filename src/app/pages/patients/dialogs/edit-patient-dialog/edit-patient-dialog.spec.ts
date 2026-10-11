import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MAT_DATE_LOCALE } from '@angular/material/core';
import { EditPatientDialog } from './edit-patient-dialog';
import { PatientRepository } from '../../../../core/repositories/patient.repository';
import { AlertService } from '../../../../core/services/alert.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Sexo } from '../../../../core/models/sexo';

describe('EditPatientDialog', () => {
  const mockPatient = {
    id: 'p1',
    doctorId: 'doctor-test',
    name: 'Juan',
    lastName: 'Pérez',
    email: 'juan@mail.com',
    birthDate: '2020-01-15',
    bloodType: 'O+',
    birthWeight: 3.5,
    birthHeight: 50,
    sex: Sexo.Masculino,
    birthMethod: 'vaginal' as const,
    hasAllergies: false,
    hasBeenHospitalized: false,
    hasDisease: false,
    takesMedication: false,
    fatherName: 'Carlos',
    motherName: 'María',
    phone: '5555555555',
    otpPassword: '123456',
  };

  const patientRepo = { updatePatient: vi.fn().mockResolvedValue(undefined), getAllPatients: vi.fn(), getPatientsByDoctor: vi.fn().mockResolvedValue([]) };
  const alertService = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };
  const snackBar = { open: vi.fn() };
  const dialogRef = { close: vi.fn() };

  function createFixture() {
    TestBed.configureTestingModule({
      imports: [EditPatientDialog, NoopAnimationsModule],
      providers: [
        provideNativeDateAdapter(),
        { provide: MAT_DATE_LOCALE, useValue: 'es-MX' },
        { provide: PatientRepository, useValue: patientRepo },
        { provide: AlertService, useValue: alertService },
        { provide: AuthService, useValue: { currentDoctor: { uid: 'doctor-test', role: 'doctor' } } },
        { provide: MatSnackBar, useValue: snackBar },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    });

    const fixture = TestBed.createComponent(EditPatientDialog);
    const component = fixture.componentInstance as any;
    return { fixture, component };
  }

  function initComponent(component: any) {
    component.setPatient(mockPatient);
    component.setMode('view');
  }

  it('scopes referral suggestions to the doctor without unrelated or legacy patients', async () => {
    patientRepo.getPatientsByDoctor.mockResolvedValueOnce([
      mockPatient,
      { ...mockPatient, id: 'foreign', doctorId: 'other-doctor' },
      { ...mockPatient, id: 'legacy', doctorId: undefined },
    ]);
    const { component } = createFixture();
    initComponent(component);
    await vi.waitFor(() => expect(component.filteredPatients()).toHaveLength(1));
    expect(component.filteredPatients()[0].id).toBe('p1');
    expect(patientRepo.getPatientsByDoctor).toHaveBeenCalledWith('doctor-test');
    expect(patientRepo.getAllPatients).not.toHaveBeenCalled();
  });

  it('does not load suggestions for a patient outside the doctor scope', async () => {
    const { component } = createFixture();
    patientRepo.getPatientsByDoctor.mockClear();
    component.setPatient({ ...mockPatient, doctorId: 'other-doctor' });
    await Promise.resolve();
    expect(component.filteredPatients()).toEqual([]);
    expect(patientRepo.getPatientsByDoctor).not.toHaveBeenCalled();
    expect(patientRepo.getAllPatients).not.toHaveBeenCalled();
  });

  it('renders title', async () => {
    const { fixture, component } = createFixture();
    initComponent(component);
    fixture.detectChanges();
    await new Promise(r => setTimeout(r, 50));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Perfil del paciente');
  }, 30000);

  it('renders three tabs', async () => {
    const { fixture, component } = createFixture();
    initComponent(component);
    fixture.detectChanges();
    await new Promise(r => setTimeout(r, 50));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Datos generales');
    expect(el.textContent).toContain('Datos de contacto');
    expect(el.textContent).toContain('Esquema de vacunación');
  }, 30000);

  it('pre-fills form with patient data', () => {
    const { component } = createFixture();
    initComponent(component);
    expect(component.form.value.fullName).toBe('Juan Pérez');
    expect(component.form.value.bloodType).toBe('O+');
  });

  it('starts in readOnly mode', () => {
    const { component } = createFixture();
    initComponent(component);
    expect(component.readOnly()).toBe(true);
    expect(component.form.disabled).toBe(true);
  });

  it('switches to edit mode', () => {
    const { component } = createFixture();
    initComponent(component);
    component.switchToEdit();
    expect(component.readOnly()).toBe(false);
    expect(component.form.enabled).toBe(true);
  });

  it('shows save button in edit mode', async () => {
    const { component, fixture } = createFixture();
    initComponent(component);
    fixture.detectChanges();
    await new Promise(r => setTimeout(r, 50));
    component.switchToEdit();
    fixture.detectChanges();
    const btns = fixture.nativeElement.querySelectorAll('button');
    const texts = Array.from(btns).map((b: any) => b.textContent.trim());
    expect(texts).toContain('Guardar cambios');
  }, 30000);

  it('detects vaccination changes when form has no changes', async () => {
    const { component } = createFixture();
    initComponent(component);
    component.switchToEdit();
    await component.save();
    expect(patientRepo.updatePatient).toHaveBeenCalledWith('p1', expect.objectContaining({
      vaccinationRecord: expect.any(Object),
    }));
  });

  it('calls updatePatient on save with changes', async () => {
    const { component } = createFixture();
    initComponent(component);
    component.switchToEdit();
    component.form.patchValue({ fullName: 'Juan Updated Pérez' });
    await component.save();
    expect(patientRepo.updatePatient).toHaveBeenCalledWith('p1', expect.objectContaining({ name: 'Juan Updated' }));
  });

  it('shows success message after save', async () => {
    const { component } = createFixture();
    initComponent(component);
    component.switchToEdit();
    component.form.patchValue({ fullName: 'Juan Updated Pérez' });
    await component.save();
    expect(component.saveSuccess()).toBe('Cambios del perfil guardados.');
  });

  it('switches back to view mode after save', async () => {
    const { component } = createFixture();
    initComponent(component);
    component.switchToEdit();
    component.form.patchValue({ fullName: 'Juan Updated Pérez' });
    await component.save();
    expect(component.readOnly()).toBe(true);
  });

  it('shows error on save failure', async () => {
    const { component } = createFixture();
    initComponent(component);
    patientRepo.updatePatient.mockRejectedValue(new Error('fail'));
    component.switchToEdit();
    component.form.patchValue({ fullName: 'Juan Updated Pérez' });
    await component.save();
    expect(alertService.error).toHaveBeenCalled();
  });

  it('closes dialog on close()', () => {
    const { component } = createFixture();
    initComponent(component);
    component.close();
    expect(dialogRef.close).toHaveBeenCalledWith(false);
  });

  it('toggles conditional validators on boolean changes', () => {
    const { component } = createFixture();
    initComponent(component);
    component.onHasAllergiesChange(true);
    expect(component.form.get('allergies')?.hasValidator).toBeTruthy();
    component.onHasAllergiesChange(false);
    expect(component.form.get('allergies')?.value).toBe('');
  });

  it('validates form on submit', () => {
    const { component } = createFixture();
    initComponent(component);
    component.switchToEdit();
    component.form.patchValue({ fullName: '' });
    component.saved = true;
    expect(component.form.invalid).toBe(true);
  });

  it('loads vaccination map', () => {
    const { component } = createFixture();
    initComponent(component);
    expect(component.vaccinationMap.size).toBeGreaterThan(0);
  });

  it('toggles vaccine dose', () => {
    const { component } = createFixture();
    initComponent(component);
    component.switchToEdit();
    component.toggleDose('BCG', 'Al nacer');
    expect(component.isVaccineApplied('BCG', 'Al nacer')).toBe(true);
    component.toggleDose('BCG', 'Al nacer');
    expect(component.isVaccineApplied('BCG', 'Al nacer')).toBe(false);
  });

  it('does not toggle vaccine dose in readOnly mode', () => {
    const { component } = createFixture();
    initComponent(component);
    component.toggleDose('BCG', 'Al nacer');
    expect(component.isVaccineApplied('BCG', 'Al nacer')).toBe(false);
  });

  it('requires at least one parent when editing and allows removing one (P32)', () => {
    const { component, fixture } = createFixture();
    initComponent(component);
    component.switchToEdit();
    fixture.detectChanges();
    component.form.patchValue({ fatherName: '', motherName: '' });
    expect(component.form.hasError('atLeastOneParent')).toBe(true);
    component.form.patchValue({ fatherName: 'Carlos', motherName: '' });
    expect(component.form.hasError('atLeastOneParent')).toBe(false);
  });

  it('rejects zero birth measures and a future birth date in edit mode (P31)', () => {
    const { component, fixture } = createFixture();
    initComponent(component);
    component.switchToEdit();
    fixture.detectChanges();
    component.form.patchValue({ birthWeight: '0', birthHeight: '0', headCircumference: '0' });
    expect(component.form.get('birthWeight')?.hasError('greaterThanZero')).toBe(true);
    expect(component.form.get('birthHeight')?.hasError('greaterThanZero')).toBe(true);
    expect(component.form.get('headCircumference')?.hasError('greaterThanZero')).toBe(true);
    component.form.patchValue({ birthDate: new Date(2099, 0, 1) });
    fixture.detectChanges();
    expect(component.form.get('birthDate')?.hasError('matDatepickerMax')).toBe(true);
  });
});
