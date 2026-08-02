import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef } from '@angular/material/dialog';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MAT_DATE_LOCALE } from '@angular/material/core';
import { NewPatientDialog } from './new-patient-dialog';
import { PatientRepository } from '../../../../core/repositories/patient.repository';
import { AlertService } from '../../../../core/services/alert.service';
import { AuthService } from '../../../../core/services/auth.service';
import { EmailService } from '../../../../core/services/email.service';
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
    const authService = { currentDoctor: { uid: 'd1', role: 'doctor' } };
    const emailService = { sendPatientAccessEmail: vi.fn().mockResolvedValue(undefined) };

    TestBed.configureTestingModule({
      imports: [NewPatientDialog, NoopAnimationsModule],
      providers: [
        provideNativeDateAdapter(),
        { provide: MAT_DATE_LOCALE, useValue: 'es-MX' },
        { provide: PatientRepository, useValue: patientRepo },
        { provide: AlertService, useValue: alertService },
        { provide: AuthService, useValue: authService },
        { provide: EmailService, useValue: emailService },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    });

    const fixture = TestBed.createComponent(NewPatientDialog);
    const component = fixture.componentInstance as any;
    component.setPatients(patients);
    if (editData) component.setEditData(editData);
    fixture.detectChanges();
    return { fixture, component, patientRepo, alertService, dialogRef, emailService };
  }

  it('renders form fields', () => {
    const { fixture } = createFixture();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('input[formcontrolname="fullName"]')).toBeTruthy();
    expect(el.querySelector('input[formcontrolname="email"]')).toBeTruthy();
  });

  it('shows validation errors when submitted empty', () => {
    const { component } = createFixture();
    component.submitted = true;
    component.form.patchValue({ fullName: '', email: '', birthDate: '', fatherName: '', motherName: '', phone: '' });
    expect(component.form.invalid).toBe(true);
  });

  it('calls createPatient on save for new patient', async () => {
    const { component, patientRepo, dialogRef, alertService, emailService } = createFixture();
    component.form.setValue({
      fullName: 'Ana López', birthDate: '2020-01-01',
      email: 'ana@mail.com', secondaryEmail: '', fatherName: 'Luis', motherName: 'María', phone: '5555555555',
    });
    await component.save();
    expect(patientRepo.createPatient).toHaveBeenCalled();
    expect(emailService.sendPatientAccessEmail).toHaveBeenCalledWith(expect.objectContaining({ email: 'ana@mail.com' }));
    expect(alertService.success).toHaveBeenCalled();
    expect(dialogRef.close).toHaveBeenCalled();
  });

  it('does not send access email when creating fails', async () => {
    const { component, patientRepo, emailService } = createFixture();
    component.form.setValue({
      fullName: 'Ana López', birthDate: '2020-01-01',
      email: 'ana@mail.com', secondaryEmail: '', fatherName: 'Luis', motherName: 'María', phone: '5555555555',
    });
    (patientRepo.createPatient as any).mockRejectedValue(new Error('boom'));
    await component.save();
    expect(emailService.sendPatientAccessEmail).not.toHaveBeenCalled();
  });

  it('shows alert on duplicate email within same doctor', async () => {
    const existingPatient: Patient = { ...basePatient, doctorId: 'd1', birthDate: '2020-01-01', fatherName: 'Luis', motherName: 'María', phone: '5555555555' };
    const { component } = createFixture([existingPatient]);
    component.form.setValue({
      fullName: 'Ana López', birthDate: '2020-01-01',
      email: 'juan@mail.com', secondaryEmail: '', fatherName: 'Luis', motherName: 'María', phone: '5555555555',
    });
    await component.save();
    expect(component.alertMsg).toContain('correos electrónicos');
  });

  it('does not alert when duplicate email belongs to another doctor', async () => {
    const otherDoctorPatient: Patient = { ...basePatient, doctorId: 'd2', birthDate: '2020-01-01', fatherName: 'Luis', motherName: 'María', phone: '5555555555' };
    const { component, patientRepo } = createFixture([otherDoctorPatient]);
    component.form.setValue({
      fullName: 'Ana López', birthDate: '2020-01-01',
      email: 'juan@mail.com', secondaryEmail: '', fatherName: 'Luis', motherName: 'María', phone: '5555555555',
    });
    await component.save();
    expect(component.alertMsg).toBe('');
    expect(patientRepo.createPatient).toHaveBeenCalled();
  });

  it('pre-fills form with edit data', () => {
    const editPatient: Patient = { ...basePatient, id: 'p2', name: 'Ana', lastName: 'López', email: 'ana@mail.com', fatherName: 'Luis', motherName: 'María', birthDate: '2020-01-01', phone: '5555555555' };
    const { component } = createFixture([], editPatient);
    expect(component.form.value.fullName).toBe('Ana López');
  });

  it('calls updatePatient on save for existing patient', async () => {
    const editPatient: Patient = { ...basePatient, id: 'p2', name: 'Ana', lastName: 'López', email: 'ana@mail.com', fatherName: 'Luis', motherName: 'María', birthDate: '2020-01-01', phone: '5555555555' };
    const { component, patientRepo, dialogRef, alertService } = createFixture([], editPatient);
    component.form.setValue({
      fullName: 'Ana López', birthDate: '2020-01-01',
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
