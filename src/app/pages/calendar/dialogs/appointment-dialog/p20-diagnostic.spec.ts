import { TestBed } from '@angular/core/testing';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDialogRef } from '@angular/material/dialog';
import { AppointmentDialog } from './appointment-dialog';
import { AppointmentRepository } from '../../../../core/repositories/appointment.repository';
import { PatientRepository } from '../../../../core/repositories/patient.repository';
import { AuditRepository } from '../../../../core/repositories/audit.repository';
import { AuthService } from '../../../../core/services/auth.service';
import { AlertService } from '../../../../core/services/alert.service';
import { NotificationService } from '../../../../core/services/notification.service';

describe('P20 retaining the original time by role', () => {
  it.each(['doctor', 'assistant', 'patient'].flatMap(role => ['open', 'closed', 'past', 'other-time', 'occupied'].map(scenario => ({ role, scenario }))))(
    'retains only the original slot as $role with $scenario availability', async ({ role, scenario }) => {
    const patient = { id: 'synthetic-child', doctorId: 'synthetic-doctor', name: 'Paciente', lastName: 'ficticio',
      email: 'family@example.test', birthDate: '', phone: '', fatherName: '', motherName: '' };
    const appointment = { id: 'synthetic-appointment', doctorId: 'synthetic-doctor', patientId: patient.id,
      patientName: 'Paciente ficticio', date: scenario === 'past' ? '2020-01-05' : '2099-01-05', time: '10:00', status: 'scheduled', type: 'scheduled' };
    const repository = { createAppointment: vi.fn(), updateAppointment: vi.fn().mockResolvedValue(undefined) };
    const notifications = { notifyAppointmentRescheduled: vi.fn() };
    const dialog = { close: vi.fn() };
    TestBed.configureTestingModule({ imports: [AppointmentDialog], providers: [
      provideNativeDateAdapter(),
      { provide: MatDialogRef, useValue: dialog },
      { provide: AppointmentRepository, useValue: repository },
      { provide: PatientRepository, useValue: {} },
      { provide: AuditRepository, useValue: {} },
      { provide: AuthService, useValue: {
        currentDoctor: role === 'patient' ? null : { uid: role === 'doctor' ? 'synthetic-doctor' : 'synthetic-assistant', role, createdBy: 'synthetic-doctor' },
        currentPatient: role === 'patient' ? patient : null,
      } },
      { provide: AlertService, useValue: { success: vi.fn(), error: vi.fn() } },
      { provide: NotificationService, useValue: notifications },
    ] });
    const fixture = TestBed.createComponent(AppointmentDialog);
    const component = fixture.componentInstance as any;
    const segment = [{ startTime: '09:00', endTime: '17:00' }];
    component.setData({ allPatients: [patient], selectedDoctorId: 'synthetic-doctor', editingAppointment: appointment,
      existingAppointments: [appointment], patientScheduling: role === 'patient',
      occupiedSlots: scenario === 'occupied' ? [appointment.date + '|' + appointment.time] : [],
      timeSegmentsByDay: ['closed', 'other-time', 'occupied'].includes(scenario) ? {} :
        { Lun: segment, Mar: segment, Mié: segment, Jue: segment, Vie: segment, Sáb: segment, Dom: segment } });
    component.form.patchValue({ notes: 'Motivo de prueba' });
    fixture.detectChanges();
    if (scenario === 'other-time') component.form.patchValue({ time: '10:30' });
    const blocked = scenario === 'other-time' || (scenario === 'occupied' && role === 'patient');
    if (!blocked) expect(component.availableTimes()).toContain('10:00');
    await component.save();
    if (blocked) {
      expect(repository.updateAppointment).not.toHaveBeenCalled();
      expect(dialog.close).not.toHaveBeenCalled();
      expect(component.error()).not.toBe('');
    } else {
      expect(repository.updateAppointment).toHaveBeenCalledWith(appointment.id, expect.objectContaining({ date: appointment.date, time: appointment.time }));
      expect(dialog.close).toHaveBeenCalledWith(true);
    }
    expect(repository.createAppointment).not.toHaveBeenCalled();
    expect(notifications.notifyAppointmentRescheduled).not.toHaveBeenCalled();
  });
});
