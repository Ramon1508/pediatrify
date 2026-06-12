import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef } from '@angular/material/dialog';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MAT_DATE_LOCALE } from '@angular/material/core';
import { NewPatientDialog } from './new-patient-dialog';
import { PatientRepository } from '../../../../core/repositories/patient.repository';
import { AlertService } from '../../../../core/services/alert.service';
import { Patient } from '../../../../core/models/user';

describe('NewPatientDialog', () => {
  const basePatient = { id: 'p1', name: 'Juan', lastName: 'Pérez', email: 'juan@mail.com', otpPassword: '123456' };

  function createFixture(patients: Patient[] = [], editData?: Patient) {
    const patientRepo = {
      createPatient: vi.fn().mockResolvedValue(undefined),
      updatePatient: vi.fn().mockResolvedValue(undefined),
      getAllPatients: vi.fn().mockResolvedValue([]),
    };
    const alertService = { success: vi.fn(), error: vi.fn() };
    const dialogRef = { close: vi.fn() };

    TestBed.configureTestingModule({
      imports: [NewPatientDialog, NoopAnimationsModule],
      providers: [
        provideNativeDateAdapter(),
        { provide: MAT_DATE_LOCALE, useValue: 'es-MX' },
        { provide: PatientRepository, useValue: patientRepo },
        { provide: AlertService, useValue: alertService },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    });

    const fixture = TestBed.createComponent(NewPatientDialog);
    const component = fixture.componentInstance as any;
    component.setPatients(patients);
    if (editData) component.setEditData(editData);
    fixture.detectChanges();
    return { fixture, component, patientRepo, alertService, dialogRef };
  }

  it('renders form fields', () => {
    const { fixture } = createFixture();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('input[formcontrolname="name"]')).toBeTruthy();
    expect(el.querySelector('input[formcontrolname="lastName"]')).toBeTruthy();
    expect(el.querySelector('input[formcontrolname="email"]')).toBeTruthy();
  });

  it('shows validation errors when submitted empty', () => {
    const { component } = createFixture();
    component.submitted = true;
    component.form.patchValue({ name: '', lastName: '', email: '', birthDate: '', fatherName: '', motherName: '', phone: '' });
    expect(component.form.invalid).toBe(true);
  });

  it('calls createPatient on save for new patient', async () => {
    const { component, patientRepo, dialogRef, alertService } = createFixture();
    component.form.setValue({
      name: 'Ana', lastName: 'López', birthDate: '2020-01-01',
      email: 'ana@mail.com', secondaryEmail: '', fatherName: 'Luis', motherName: 'María', phone: '5555555555',
    });
    await component.save();
    expect(patientRepo.createPatient).toHaveBeenCalled();
    expect(alertService.success).toHaveBeenCalled();
    expect(dialogRef.close).toHaveBeenCalled();
  });

  it('shows alert on duplicate email', async () => {
    const existingPatient: Patient = { ...basePatient, birthDate: '2020-01-01', fatherName: 'Luis', motherName: 'María', phone: '5555555555' };
    const { component } = createFixture([existingPatient]);
    component.form.setValue({
      name: 'Ana', lastName: 'López', birthDate: '2020-01-01',
      email: 'juan@mail.com', secondaryEmail: '', fatherName: 'Luis', motherName: 'María', phone: '5555555555',
    });
    await component.save();
    expect(component.alertMsg).toContain('correos electrónicos');
  });

  it('pre-fills form with edit data', () => {
    const editPatient: Patient = { ...basePatient, id: 'p2', name: 'Ana', lastName: 'López', email: 'ana@mail.com', fatherName: 'Luis', motherName: 'María', birthDate: '2020-01-01', phone: '5555555555' };
    const { component } = createFixture([], editPatient);
    expect(component.form.value.name).toBe('Ana');
    expect(component.form.value.lastName).toBe('López');
  });

  it('calls updatePatient on save for existing patient', async () => {
    const editPatient: Patient = { ...basePatient, id: 'p2', name: 'Ana', lastName: 'López', email: 'ana@mail.com', fatherName: 'Luis', motherName: 'María', birthDate: '2020-01-01', phone: '5555555555' };
    const { component, patientRepo, dialogRef, alertService } = createFixture([], editPatient);
    component.form.setValue({
      name: 'Ana', lastName: 'López', birthDate: '2020-01-01',
      email: 'ana@mail.com', secondaryEmail: '', fatherName: 'Luis', motherName: 'María', phone: '5555555555',
    });
    await component.save();
    expect(patientRepo.updatePatient).toHaveBeenCalledWith('p2', expect.objectContaining({ name: 'Ana' }));
    expect(alertService.success).toHaveBeenCalled();
    expect(dialogRef.close).toHaveBeenCalled();
  });

  it('closes dialog on close()', () => {
    const { component, dialogRef } = createFixture();
    component.close();
    expect(dialogRef.close).toHaveBeenCalled();
  });
});
