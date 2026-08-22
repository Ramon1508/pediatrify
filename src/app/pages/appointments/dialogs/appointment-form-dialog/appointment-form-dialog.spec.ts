import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef } from '@angular/material/dialog';
import { AppointmentFormDialog } from './appointment-form-dialog';
import { AppointmentRepository } from '../../../../core/repositories/appointment.repository';
import { PatientRepository } from '../../../../core/repositories/patient.repository';
import { AuthService } from '../../../../core/services/auth.service';
import { AlertService } from '../../../../core/services/alert.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { Patient } from '../../../../core/models/user';

describe('AppointmentFormDialog', () => {
  const mockPatient: Patient = { id: 'p1', name: 'Juan', lastName: 'Pérez', email: 'juan@mail.com', otpPassword: '123456', birthDate: '2020-01-15', fatherName: 'Carlos', motherName: 'María', phone: '5555555555' };
  const mockDoctor = { uid: 'd1', name: 'Dr. Test', email: 'test@mail.com' };
  const mockAppointment = {
    id: 'apt1',
    patientId: 'p1',
    date: '2026-06-15',
    time: '10:00',
    notes: 'nota existente',
  };

  function createFixture(editData?: any) {
    const appointmentRepo = { createAppointment: vi.fn().mockResolvedValue(undefined), updateAppointment: vi.fn().mockResolvedValue(undefined) };
    const alertService = { success: vi.fn(), error: vi.fn() };
    const dialogRef = { close: vi.fn() };

    TestBed.configureTestingModule({
      imports: [AppointmentFormDialog, NoopAnimationsModule],
      providers: [
        { provide: AppointmentRepository, useValue: appointmentRepo },
        { provide: PatientRepository, useValue: {} },
        { provide: AuthService, useValue: { currentDoctor: mockDoctor } },
        { provide: AlertService, useValue: alertService },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: NotificationService, useValue: { notifyAppointmentCreated: vi.fn(), notifyAppointmentCancelled: vi.fn(), notifyAppointmentRescheduled: vi.fn() } },
      ],
    });

    const fixture = TestBed.createComponent(AppointmentFormDialog);
    const component = fixture.componentInstance;
    const c = component as any;
    c.setPatients([mockPatient]);
    if (editData) c.setEditData(editData);
    fixture.detectChanges();
    return { fixture, component: c, appointmentRepo, alertService, dialogRef };
  }

  it('renders new appointment title', () => {
    const { fixture } = createFixture();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Nueva cita');
  });

  it('renders edit appointment title when edit data set', () => {
    const { fixture } = createFixture(mockAppointment);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Editar cita');
  });

  it('pre-fills form with edit data', () => {
    const { component } = createFixture(mockAppointment);
    expect(component.form.value.patientId).toBe('p1');
    expect(component.form.value.date).toEqual(new Date(2026, 5, 15));
    expect(component.form.value.time).toBe('10:00');
    expect(component.form.value.notes).toBe('nota existente');
  });

  it('shows validation errors when submitted empty', () => {
    const { component, fixture } = createFixture();
    component.submitted = true;
    component.form.patchValue({ patientId: '', date: '', time: '' });
    fixture.detectChanges();
    expect(component.form.invalid).toBe(true);
  });

  it('calls createAppointment on save for new appointment', async () => {
    const { component, appointmentRepo, dialogRef, alertService } = createFixture();
    component.form.setValue({ patientId: 'p1', date: '2026-06-15', time: '11:00', notes: '' });
    await component.save();
    expect(appointmentRepo.createAppointment).toHaveBeenCalled();
    expect(alertService.success).toHaveBeenCalled();
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('calls updateAppointment on save for existing appointment', async () => {
    const { component, appointmentRepo, dialogRef, alertService } = createFixture(mockAppointment);
    component.form.setValue({ patientId: 'p1', date: '2026-06-15', time: '11:00', notes: 'actualizada' });
    await component.save();
    expect(appointmentRepo.updateAppointment).toHaveBeenCalledWith('apt1', expect.objectContaining({ notes: 'actualizada' }));
    expect(alertService.success).toHaveBeenCalled();
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('shows error on save failure', async () => {
    const { component, fixture, appointmentRepo, alertService } = createFixture();
    appointmentRepo.createAppointment.mockRejectedValue(new Error('fail'));
    component.form.setValue({ patientId: 'p1', date: '2026-06-15', time: '11:00', notes: '' });
    await component.save();
    expect(component.error).toBe('fail');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('fail');
  });

  it('closes dialog on close()', () => {
    const { component, dialogRef } = createFixture();
    component.close();
    expect(dialogRef.close).toHaveBeenCalled();
  });
});
