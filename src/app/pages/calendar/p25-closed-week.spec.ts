import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { setDoc } from 'firebase/firestore';
import { Calendar } from './calendar';
import { SettingsDialog, SettingsSaveResult } from './dialogs/settings-dialog/settings-dialog';
import { AppointmentDialog } from './dialogs/appointment-dialog/appointment-dialog';
import { AppointmentRepository } from '../../core/repositories/appointment.repository';
import { UserRepository } from '../../core/repositories/user.repository';
import { PatientRepository } from '../../core/repositories/patient.repository';
import { AuditRepository } from '../../core/repositories/audit.repository';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { NotificationService } from '../../core/services/notification.service';
import { CalendarFocusService } from '../../core/services/calendar-focus.service';
import { FirebaseService } from '../../core/firebase/firebase.service';
import { AppUser, TimeSegment } from '../../core/models/user';
import { WEEKDAYS_SHORT } from '../../core/utils/availability';

vi.mock('firebase/firestore', () => ({
  setDoc: vi.fn(),
  doc: vi.fn(() => ({ id: 'synthetic-doctor', path: 'users/synthetic-doctor' })),
  serverTimestamp: vi.fn(() => new Date()),
}));

describe('P25: semana cerrada al guardar, aplicar y reabrir', () => {
  it.each([
    { role: 'doctor', initiallyEmpty: false },
    { role: 'assistant', initiallyEmpty: false },
    { role: 'doctor', initiallyEmpty: true },
  ] as const)('preserves the closed week through the real components: %j', async ({ role, initiallyEmpty }) => {
    const openWeek: Record<string, TimeSegment[]> = initiallyEmpty ? {} : Object.fromEntries(
      WEEKDAYS_SHORT.map(day => [day, [{ startTime: '09:00', endTime: '12:00' }, { startTime: '15:00', endTime: '17:00' }]])
    );
    let doctor = { uid: 'synthetic-doctor', role: 'doctor', profileComplete: true,
      name: 'Doctor sintético', email: 'doctor@example.test', consultationDuration: 30,
      allowPatientScheduling: true, timeSegmentsByDay: openWeek,
      availableDays: initiallyEmpty ? [] : [...WEEKDAYS_SHORT], timeSegments: [] } as unknown as AppUser;
    const assistant = { uid: 'synthetic-assistant', role: 'assistant', createdBy: doctor.uid,
      profileComplete: true, name: 'Asistente sintético', email: 'assistant@example.test' } as AppUser;
    const patient = { id: 'synthetic-patient', doctorId: doctor.uid, name: 'Paciente', lastName: 'Sintético' } as any;
    const existing = { id: 'synthetic-existing', doctorId: doctor.uid, patientId: patient.id,
      patientName: 'Paciente Sintético', date: '2099-01-05', time: '10:00', status: 'scheduled' } as any;
    const appointments = { watchAppointmentsByDoctor: vi.fn(() => of([existing])),
      watchOccupiedSlots: vi.fn(() => of([{ id: existing.id, doctorId: existing.doctorId, date: existing.date, time: existing.time }])),
      watchAppointmentsByUpdatedBy: vi.fn(() => of([existing])), createAppointment: vi.fn(), updateAppointment: vi.fn() };
    const users = { getUser: vi.fn(async () => doctor), getUserByEmail: vi.fn(async () => doctor),
      updateSchedule: vi.fn(async (_uid: string, data: Partial<AppUser>) => { persisted = structuredClone(data); doctor = { ...doctor, ...persisted }; }),
      watchUser: vi.fn(() => of(doctor)) };
    const auth = { currentDoctor: role === 'doctor' ? doctor : assistant, currentPatient: null as any,
      session$: of({ type: 'doctor', user: role === 'doctor' ? doctor : assistant }), updateCurrentDoctor: vi.fn((data: Partial<AppUser>) => {
        auth.currentDoctor = { ...auth.currentDoctor, ...data };
      }) };
    const alerts = { success: vi.fn(), error: vi.fn() };
    const dialogs = { open: vi.fn() };
    const close = vi.fn();
    let persisted: Record<string, any> = {};
    vi.mocked(setDoc).mockClear();
    vi.mocked(setDoc).mockImplementation(async (_ref, data) => {
      persisted = structuredClone(data);
      doctor = { ...doctor, ...persisted };
    });
    await TestBed.configureTestingModule({
      imports: [Calendar, SettingsDialog, AppointmentDialog, NoopAnimationsModule],
      providers: [provideNativeDateAdapter(),
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: MatDialog, useValue: dialogs }, { provide: MatDialogRef, useValue: { close } },
        { provide: FirebaseService, useValue: { firestore: {} } },
        { provide: AppointmentRepository, useValue: appointments }, { provide: UserRepository, useValue: users },
        { provide: PatientRepository, useValue: { getPatientsByDoctor: vi.fn(async () => [patient]),
          getChildrenGroup: vi.fn(async () => [patient]) } },
        { provide: AuditRepository, useValue: { log: vi.fn(async () => undefined) } },
        { provide: AuthService, useValue: auth }, { provide: AlertService, useValue: alerts },
        { provide: NotificationService, useValue: {} },
        { provide: CalendarFocusService, useValue: new CalendarFocusService() },
      ],
    }).compileComponents();

    const calendarFixture = TestBed.createComponent(Calendar);
    const calendar = calendarFixture.componentInstance as any;
    calendar.dialog = dialogs;
    await calendar.ngOnInit();
    if (!initiallyEmpty) expect(calendar.availableDaysSignal()).toEqual([...WEEKDAYS_SHORT]);

    const settingsFixture = TestBed.createComponent(SettingsDialog);
    const settings = settingsFixture.componentInstance;
    settings.setData({ doctorId: doctor.uid, doctorEmail: doctor.email, consultationDuration: 30,
      allowPatientScheduling: true, timeSegmentsByDay: openWeek,
      availableDays: initiallyEmpty ? [] : [...WEEKDAYS_SHORT] });
    settingsFixture.detectChanges();
    const element = settingsFixture.nativeElement as HTMLElement;
    if (!initiallyEmpty) {
      for (const day of WEEKDAYS_SHORT) {
        [...element.querySelectorAll<HTMLButtonElement>('.chip-day')].find(button => button.textContent?.includes(day))!.click();
        settingsFixture.detectChanges();
        while (element.querySelector('.segment-remove, .btn-segment-remove')) {
          element.querySelector<HTMLButtonElement>('.segment-remove, .btn-segment-remove')!.click();
          settingsFixture.detectChanges();
        }
      }
    } else {
      // Un borrador sin cambios no se guarda; añadir y retirar un segmento cierra la semana explícitamente.
      element.querySelector<HTMLButtonElement>('.btn-add-segment')!.click();
      settingsFixture.detectChanges();
      element.querySelector<HTMLButtonElement>('.segment-remove')!.click();
      settingsFixture.detectChanges();
    }
    expect(element.querySelector('.segments-list')).toBeNull();
    expect(element.querySelector('.day-check')).toBeNull();
    const save = vi.spyOn(settings, 'save');
    const saveButton = element.querySelector<HTMLButtonElement>('mat-dialog-actions .btn-primary')!;
    expect(saveButton.disabled).toBe(false);
    saveButton.click();
    await save.mock.results.at(-1)!.value;
    expect(users.updateSchedule).toHaveBeenCalledTimes(1);
    expect(users.updateSchedule).toHaveBeenCalledWith('synthetic-doctor',
      expect.objectContaining({ availableDays: [], timeSegments: [] }));
    expect(setDoc).not.toHaveBeenCalled();
    expect(Object.keys(persisted['timeSegmentsByDay']).length).toBeGreaterThan(0);
    expect(Object.values(persisted['timeSegmentsByDay']).every(segments => (segments as unknown[]).length === 0)).toBe(true);
    expect(doctor.allowPatientScheduling).toBe(true);
    if (role === 'assistant') expect(persisted).not.toHaveProperty('allowPatientScheduling');
    expect(alerts.success).toHaveBeenCalledWith({ message: 'Configuración guardada', duration: 5000 });
    const saved = close.mock.calls.at(-1)![0] as SettingsSaveResult;

    // El Doctor publica el perfil guardado; el Asistente aplica el resultado del diálogo a su agenda.
    if (!initiallyEmpty) expect(calendar.availableDaysSignal()).toEqual(role === 'doctor' ? [] : [...WEEKDAYS_SHORT]);
    dialogs.open.mockReturnValue({ componentInstance: { setData: vi.fn() }, afterClosed: () => of(saved), close: vi.fn() });
    calendar.openSettingsDialog();
    expect(calendar.availableDaysSignal()).toEqual([]);
    expect(calendar.timeSegmentsByDaySignal()).toEqual({});
    expect(calendar.allAppointments()).toEqual([existing]);

    const reopenedFixture = TestBed.createComponent(SettingsDialog);
    const reopened = reopenedFixture.componentInstance;
    dialogs.open.mockReturnValue({ componentInstance: reopened, afterClosed: () => of(null), close: vi.fn() });
    calendar.openSettingsDialog();
    reopenedFixture.detectChanges();
    for (const day of WEEKDAYS_SHORT) {
      reopened.toggleDay(day);
      reopenedFixture.detectChanges();
      expect(reopenedFixture.nativeElement.querySelector('.segments-list')).toBeNull();
      expect(reopenedFixture.nativeElement.querySelector('.day-check')).toBeNull();
    }
    // Reguardar desde el mapa normalizado del calendario debe seguir cerrado.
    (reopened as any).form.controls.consultationDuration.setValue(45);
    (reopened as any).form.markAsDirty();
    await reopened.save();
    expect(users.updateSchedule).toHaveBeenCalledTimes(2);
    calendarFixture.destroy();
    const freshFixture = TestBed.createComponent(Calendar);
    const fresh = freshFixture.componentInstance as any;
    await fresh.ngOnInit();
    expect(fresh.availableDaysSignal()).toEqual([]);
    expect(fresh.timeSegmentsByDaySignal()).toEqual({});
    expect(fresh.allAppointments()).toEqual([existing]);

    for (let offset = 0; offset < 7; offset++) {
      const date = new Date(2099, 0, 5 + offset);
      expect(fresh.isDayAvailable(date)).toBe(false);
    }
    // El portal lee el mismo documento cerrado; no se habilitan horas por el permiso del Doctor.
    auth.currentDoctor = null as any;
    auth.currentPatient = patient;
    const portalFixture = TestBed.createComponent(Calendar);
    const portal = portalFixture.componentInstance as any;
    await portal.ngOnInit();
    expect(portal.allowScheduling()).toBe(true);
    expect(portal.timeSegmentsByDaySignal()).toEqual({});
    const appointmentFixture = TestBed.createComponent(AppointmentDialog);
    const appointment = appointmentFixture.componentInstance;
    appointment.setData({ selectedDoctorId: doctor.uid, allPatients: [patient], patientScheduling: true,
      timeSegmentsByDay: portal.timeSegmentsByDaySignal(), consultationDuration: 30 });
    for (let offset = 0; offset < 7; offset++) {
      const date = new Date(2099, 0, 5 + offset);
      expect(portal.canInteractWithCell(date)).toBe(false);
      expect(appointment.dateFilter()(date)).toBe(false);
      appointment.setPrefill(`${date.getFullYear()}-01-${String(date.getDate()).padStart(2, '0')}`, '10:00');
      expect((appointment as any).availableTimes()).toEqual([]);
    }
    appointment.lockPatient(patient.id);
    await appointment.save();
    expect(appointments.createAppointment).not.toHaveBeenCalled();
    expect(appointments.updateAppointment).not.toHaveBeenCalled();
    expect(alerts.error).not.toHaveBeenCalled();
  });
});
