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
import { ClinicEmailDeliveryError } from '../../../../core/services/email.service';
import { Patient } from '../../../../core/models/user';

describe('NewPatientDialog', () => {
  const basePatient = { id: 'p1', name: 'Juan', lastName: 'Pérez', email: 'juan@mail.com', otpPassword: '123456' };

  function createFixture(patients: Patient[] = [], editData?: Patient) {
    const patientRepo = {
      createPatient: vi.fn().mockImplementation(async (_operationId, data) => ({ status: 'created', patient: { ...data, id: 'created', doctorId: 'd1' } })),
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

  it('keeps the patient after a partial email failure and retries only the original delivery', async () => {
    const { component, patientRepo, emailService, dialogRef, fixture } = createFixture();
    component.form.setValue({ fullName: 'Paciente Ficticio', birthDate: '2020-01-01', email: 'family@example.test', secondaryEmail: 'secondary@example.test', fatherName: 'Tutor', motherName: 'Tutora', phone: '5555555555' });
    emailService.sendPatientAccessEmail.mockRejectedValueOnce(new ClinicEmailDeliveryError([{ destination: 'primary', sent: true }, { destination: 'secondary', sent: false }]));
    await component.save(); fixture.detectChanges();
    const original = emailService.sendPatientAccessEmail.mock.calls[0][0];
    expect(patientRepo.createPatient).toHaveBeenCalledOnce(); expect(dialogRef.close).not.toHaveBeenCalled();
    expect(component.form.disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Correo secundario: envío no confirmado.');
    await component.save(); await component.retryEmail();
    expect(patientRepo.createPatient).toHaveBeenCalledOnce();
    expect(emailService.sendPatientAccessEmail.mock.calls[1][0]).toEqual(original);
    expect(dialogRef.close).toHaveBeenCalledWith(expect.objectContaining({ id: 'created' }));
  });

  it('reuses the creation operation after an uncertain outcome while unchanged data is retried', async () => {
    const { component, patientRepo } = createFixture();
    component.form.setValue({ fullName: 'Paciente Ficticio', birthDate: '2020-01-01', email: 'family@example.test', secondaryEmail: '', fatherName: 'Tutor', motherName: 'Tutora', phone: '5555555555' });
    patientRepo.createPatient.mockRejectedValueOnce(new Error('Resultado de red incierto'));
    await component.save(); await component.save();
    expect(patientRepo.createPatient.mock.calls[0][0]).toBe(patientRepo.createPatient.mock.calls[1][0]);
  });

  it('shows a server-detected duplicate and sends separate confirmation on the same creation operation', async () => {
    const { component, patientRepo } = createFixture();
    component.form.setValue({ fullName: 'Paciente Ficticio', birthDate: '2020-01-01', email: 'family@example.test', secondaryEmail: '', fatherName: 'Tutor', motherName: 'Tutora', phone: '5555555555' });
    patientRepo.createPatient.mockResolvedValueOnce({ status: 'confirmation-required', warnings: ['email'] });
    await component.save(); expect(component.alertMsg()).not.toBe('');
    await component.continueWithExisting();
    expect(patientRepo.createPatient.mock.calls[0][0]).toBe(patientRepo.createPatient.mock.calls[1][0]);
    expect(patientRepo.createPatient.mock.calls[1][2]).toEqual(['email']);
  });

  it('shows validation errors when submitted empty', () => {
    const { component } = createFixture();
    component.submitted.set(true);
    component.form.patchValue({ fullName: '', email: '', birthDate: '', fatherName: '', motherName: '', phone: '' });
    expect(component.form.invalid).toBe(true);
  });

  it('rejects a future birth date (P31)', () => {
    const { component, fixture } = createFixture();
    component.form.patchValue({ birthDate: new Date(2099, 0, 1) });
    fixture.detectChanges();
    expect(component.form.get('birthDate')?.hasError('matDatepickerMax')).toBe(true);
  });

  it('calls createPatient on save for new patient', async () => {
    const { component, patientRepo, dialogRef, alertService, emailService } = createFixture();
    component.form.setValue({
      fullName: 'Ana López', birthDate: '2020-01-01',
      email: 'ana@mail.com', secondaryEmail: '', fatherName: 'Luis', motherName: 'María', phone: '5555555555',
    });
    await component.save();
    expect(patientRepo.createPatient).toHaveBeenCalled();
    expect(emailService.sendPatientAccessEmail).toHaveBeenCalledWith(expect.objectContaining({ patientId: 'created', creationOperationId: expect.any(String), operationId: expect.any(String) }));
    expect(alertService.success).toHaveBeenCalled();
    expect(dialogRef.close).toHaveBeenCalled();
  });

  it('creates an assistant patient under the assigned doctor rather than the assistant identity', async () => {
    const { component, patientRepo, alertService } = createFixture();
    (TestBed.inject(AuthService) as any).currentDoctor = { uid: 'assistant-test', role: 'assistant', createdBy: 'doctor-owner' };
    component.form.setValue({
      fullName: 'Paciente Sintético', birthDate: '2025-01-01',
      email: 'family@example.test', secondaryEmail: '', fatherName: 'Tutor', motherName: 'Tutora', phone: '5555555555',
    });
    await component.save();
    expect(patientRepo.createPatient).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ name: 'Paciente' }), []);
    expect(patientRepo.createPatient.mock.calls[0][1]).not.toHaveProperty('otpPassword');
    expect(patientRepo.createPatient.mock.calls[0][1]).not.toHaveProperty('doctorId');
    expect(alertService.success).toHaveBeenCalledWith({ message: 'Paciente creado. Se envió el acceso a los correos guardados.', duration: 5000 });
  });

  it('does not create a patient or send access email for an assistant without a doctor', async () => {
    const { component, patientRepo, emailService, alertService } = createFixture();
    (TestBed.inject(AuthService) as any).currentDoctor = { uid: 'assistant-test', role: 'assistant' };
    component.form.setValue({
      fullName: 'Paciente Sintético', birthDate: '2025-01-01',
      email: 'family@example.test', secondaryEmail: '', fatherName: 'Tutor', motherName: 'Tutora', phone: '5555555555',
    });
    await component.save();
    expect(patientRepo.createPatient).not.toHaveBeenCalled();
    expect(emailService.sendPatientAccessEmail).not.toHaveBeenCalled();
    expect(alertService.error).toHaveBeenCalled();
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
    expect(component.alertMsg()).toContain('correos electrónicos');
  });

  it('does not alert when duplicate email belongs to another doctor', async () => {
    const otherDoctorPatient: Patient = { ...basePatient, doctorId: 'd2', birthDate: '2020-01-01', fatherName: 'Luis', motherName: 'María', phone: '5555555555' };
    const { component, patientRepo } = createFixture([otherDoctorPatient]);
    component.form.setValue({
      fullName: 'Ana López', birthDate: '2020-01-01',
      email: 'juan@mail.com', secondaryEmail: '', fatherName: 'Luis', motherName: 'María', phone: '5555555555',
    });
    await component.save();
    expect(component.alertMsg()).toBe('');
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

  it('emits back instead of closing when embedded', () => {
    const { fixture, component } = createFixture();
    component.embedded = true;
    const backSpy = vi.fn();
    component.back.subscribe(backSpy);
    component.close();
    expect(backSpy).toHaveBeenCalled();
  });

  it('emits saved instead of closing when embedded after creating a patient', async () => {
    const { component, patientRepo, emailService } = createFixture();
    component.embedded = true;
    const savedSpy = vi.fn();
    component.saved.subscribe(savedSpy);
    component.form.setValue({
      fullName: 'Ana López', birthDate: '2020-01-01',
      email: 'ana@mail.com', secondaryEmail: '', fatherName: 'Luis', motherName: 'María', phone: '5555555555',
    });
    await component.save();
    expect(patientRepo.createPatient).toHaveBeenCalled();
    expect(emailService.sendPatientAccessEmail).toHaveBeenCalled();
    expect(savedSpy).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ana', lastName: 'López' }));
  });

  it('shows a back arrow and close button in the header when embedded', () => {
    const { fixture } = createFixture();
    fixture.componentRef.setInput('embedded', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.btn-back-dialog')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.btn-close-dialog')).toBeTruthy();
  });

  it('shows a close button in the header when not embedded', () => {
    const { fixture } = createFixture();
    expect(fixture.nativeElement.querySelector('.btn-close-dialog')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.btn-back-dialog')).toBeNull();
  });

  describe('explicit duplicate confirmation (P23)', () => {
    const familyPatient: Patient = { ...basePatient, doctorId: 'd1', email: 'family@example.test', secondaryEmail: 'other@example.test',
      birthDate: '2020-01-01', fatherName: 'Tutor ficticio', motherName: 'Tutora ficticia', phone: '5555555555' };
    const fields = { fullName: 'Paciente Nuevo', birthDate: '2024-01-01', email: 'family@example.test', secondaryEmail: '',
      fatherName: 'Tutor ficticio', motherName: 'Tutora ficticia', phone: '5555555555' };

    it.each([{ role: 'doctor', embedded: false }, { role: 'assistant', embedded: true }])(
      'creates a sibling once after clicking the actual Continue button: %j', async ({ role, embedded }) => {
        const { fixture, component, patientRepo, dialogRef, emailService } = createFixture([familyPatient]);
        (TestBed.inject(AuthService) as any).currentDoctor = role === 'doctor'
          ? { uid: 'd1', role } : { uid: 'synthetic-assistant', role, createdBy: 'd1' };
        component.embedded = embedded;
        const saved = vi.fn();
        component.saved.subscribe(saved);
        component.form.setValue(fields);
        component.form.markAsDirty();
        await component.save();
        fixture.detectChanges();
        expect(component.alertMsg()).toContain('correos electrónicos');
        expect(fixture.nativeElement.querySelector('.btn-primary').disabled).toBe(true);
        expect(patientRepo.createPatient).not.toHaveBeenCalled();
        expect(emailService.sendPatientAccessEmail).not.toHaveBeenCalled();
        fixture.nativeElement.querySelector('.alert-continue-btn').click();
        await vi.waitFor(() => expect(component.saving()).toBe(false));
        expect(patientRepo.createPatient).toHaveBeenCalledExactlyOnceWith(expect.any(String),
          expect.objectContaining({ email: fields.email, name: 'Paciente', lastName: 'Nuevo' }), ['email']);
        expect(emailService.sendPatientAccessEmail).toHaveBeenCalledTimes(1);
        expect(embedded ? saved : dialogRef.close).toHaveBeenCalledTimes(1);
        expect(embedded ? dialogRef.close : saved).not.toHaveBeenCalled();
      }
    );

    it('confirms a coincident name without requiring email confirmation', async () => {
      const { component, patientRepo } = createFixture([familyPatient]);
      component.form.setValue({ ...fields, fullName: 'Juan Pérez', email: 'new@example.test' });
      await component.save();
      expect(component.alertMsg()).toContain('ese nombre');
      expect(patientRepo.createPatient).not.toHaveBeenCalled();
      await component.continueWithExisting();
      expect(patientRepo.createPatient).toHaveBeenCalledTimes(1);
    });

    it('requires separate email and name confirmations and cannot bypass either with the save action', async () => {
      const { component, patientRepo } = createFixture([familyPatient]);
      component.form.setValue({ ...fields, fullName: 'Juan Pérez' });
      await component.save();
      await component.save();
      expect(component.alertMsg()).toContain('correos electrónicos');
      expect(patientRepo.createPatient).not.toHaveBeenCalled();
      await component.continueWithExisting();
      expect(component.alertMsg()).toContain('ese nombre');
      await component.save();
      expect(component.alertMsg()).toContain('ese nombre');
      expect(patientRepo.createPatient).not.toHaveBeenCalled();
      await component.continueWithExisting();
      expect(patientRepo.createPatient).toHaveBeenCalledTimes(1);
      expect(component.alertMsg()).toBe('');
    });

    it.each([
      { email: 'family@example.test', secondaryEmail: '' },
      { email: 'other@example.test', secondaryEmail: '' },
      { email: 'new@example.test', secondaryEmail: 'family@example.test' },
      { email: 'new@example.test', secondaryEmail: 'other@example.test' },
    ])('checks shared primary/secondary emails in either position: %j', async emails => {
      const { component, patientRepo } = createFixture([familyPatient]);
      component.form.setValue({ ...fields, ...emails });
      await component.save();
      expect(component.alertMsg()).toContain('correos electrónicos');
      expect(patientRepo.createPatient).not.toHaveBeenCalled();
      await component.continueWithExisting();
      expect(patientRepo.createPatient).toHaveBeenCalledTimes(1);
    });

    it.each([
      { field: 'email', value: 'other@example.test' },
      { field: 'secondaryEmail', value: 'other@example.test' },
      { field: 'fullName', value: 'Ana López' },
    ])('invalidates acceptance when a checked field changes: %j', async ({ field, value }) => {
      const { component, patientRepo } = createFixture([familyPatient, { ...familyPatient, id: 'synthetic-sibling', name: 'Ana', lastName: 'López' }]);
      component.form.setValue({ ...fields, fullName: 'Juan Pérez' });
      await component.save();
      await component.continueWithExisting();
      expect(component.alertMsg()).toContain('ese nombre');
      component.form.patchValue({ [field]: value });
      expect(component.alertMsg()).toBe('');
      await component.continueWithExisting();
      expect(patientRepo.createPatient).not.toHaveBeenCalled();
      await component.save();
      expect(component.alertMsg()).toContain('correos electrónicos');
      await component.continueWithExisting();
      expect(component.alertMsg()).toContain('ese nombre');
      expect(patientRepo.createPatient).not.toHaveBeenCalled();
      await component.continueWithExisting();
      expect(patientRepo.createPatient).toHaveBeenCalledTimes(1);
    });

    it('does not reset acceptance when only an unrelated field changes', async () => {
      const { component, patientRepo } = createFixture([familyPatient]);
      component.form.setValue({ ...fields, fullName: 'Juan Pérez' });
      await component.save();
      await component.continueWithExisting();
      component.form.patchValue({ phone: '5555555556' });
      expect(component.alertMsg()).toContain('ese nombre');
      await component.continueWithExisting();
      expect(patientRepo.createPatient).toHaveBeenCalledExactlyOnceWith(expect.any(String), expect.objectContaining({ phone: '5555555556' }), ['email', 'name']);
    });

    it('does not accept a stale warning when a checked field changes without emitting a form event', async () => {
      const { component, patientRepo } = createFixture([familyPatient]);
      component.form.setValue({ ...fields, fullName: 'Juan Pérez' });
      await component.save();
      await component.continueWithExisting();
      component.form.patchValue({ email: 'other@example.test' }, { emitEvent: false });
      await component.continueWithExisting();
      expect(patientRepo.createPatient).not.toHaveBeenCalled();
      await component.save();
      expect(component.alertMsg()).toContain('correos electrónicos');
    });

    it('checks email normalization when matching existing accounts', async () => {
      const { component, patientRepo } = createFixture([{ ...familyPatient, email: ' FAMILY@EXAMPLE.TEST ' }]);
      component.form.setValue({ ...fields, email: 'FAMILY@example.test' });
      await component.save();
      expect(component.alertMsg()).toContain('correos electrónicos');
      await component.continueWithExisting();
      expect(patientRepo.createPatient).toHaveBeenCalledExactlyOnceWith(expect.any(String), expect.objectContaining({ email: 'family@example.test' }), ['email']);
    });

    it('invalidates acceptance when the supplied patient list changes', async () => {
      const { component, patientRepo } = createFixture([familyPatient]);
      component.form.setValue({ ...fields, fullName: 'Juan Pérez' });
      await component.save();
      await component.continueWithExisting();
      component.setPatients([familyPatient, { ...familyPatient, id: 'another-sibling' }]);
      await component.continueWithExisting();
      expect(patientRepo.createPatient).not.toHaveBeenCalled();
      await component.save();
      expect(component.alertMsg()).toContain('correos electrónicos');
    });

    it('invalidates acceptance when the doctor scope changes', async () => {
      const { component, patientRepo } = createFixture([familyPatient, { ...familyPatient, id: 'other-doctor-child', doctorId: 'd2' }]);
      component.form.setValue({ ...fields, fullName: 'Juan Pérez' });
      await component.save();
      await component.continueWithExisting();
      (TestBed.inject(AuthService) as any).currentDoctor = { uid: 'd2', role: 'doctor' };
      await component.continueWithExisting();
      expect(patientRepo.createPatient).not.toHaveBeenCalled();
      await component.save();
      expect(component.alertMsg()).toContain('correos electrónicos');
    });

    it('requires a valid form before accepting a warning', async () => {
      const { component, patientRepo } = createFixture([familyPatient]);
      component.form.setValue(fields);
      await component.save();
      component.form.patchValue({ phone: '' });
      expect(component.continueDisabled()).toBe(true);
      await component.continueWithExisting();
      expect(patientRepo.createPatient).not.toHaveBeenCalled();
      component.form.patchValue({ phone: fields.phone });
      await component.continueWithExisting();
      expect(patientRepo.createPatient).toHaveBeenCalledTimes(1);
    });

    it('shows a save error without a Continue action and retries only on explicit save', async () => {
      const { fixture, component, patientRepo } = createFixture([familyPatient]);
      component.form.setValue(fields);
      patientRepo.createPatient.mockRejectedValueOnce(new Error('Fallo sintético de guardado'));
      await component.save();
      await component.continueWithExisting();
      fixture.detectChanges();
      expect(component.alertMsg()).toBe('');
      expect(component.saveError()).toBe('Fallo sintético de guardado');
      expect(fixture.nativeElement.textContent).toContain('Fallo sintético de guardado');
      expect(fixture.nativeElement.querySelector('.alert-continue-btn')).toBeNull();
      await component.continueWithExisting();
      expect(patientRepo.createPatient).toHaveBeenCalledTimes(1);
      await component.save();
      expect(patientRepo.createPatient).toHaveBeenCalledTimes(2);
      expect(component.saveError()).toBe('');
    });

    it('prevents repeated creation while a request is in flight', async () => {
      const { component, patientRepo, emailService } = createFixture();
      component.form.setValue({ ...fields, email: 'new@example.test' });
      let resolveCreate!: (result: any) => void;
      patientRepo.createPatient.mockReturnValueOnce(new Promise(resolve => { resolveCreate = resolve; }));
      const firstSave = component.save();
      expect(component.saving()).toBe(true);
      expect(component.saveDisabled()).toBe(true);
      await component.save();
      await component.continueWithExisting();
      expect(patientRepo.createPatient).toHaveBeenCalledTimes(1);
      resolveCreate({ status: 'created', patient: { id: 'created', doctorId: 'd1', name: 'Paciente', lastName: 'Ejemplo' } });
      await firstSave;
      expect(component.saving()).toBe(false);
      expect(emailService.sendPatientAccessEmail).toHaveBeenCalledTimes(1);
    });
  });
});
