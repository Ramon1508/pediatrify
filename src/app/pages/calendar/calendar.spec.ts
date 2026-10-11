import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideNativeDateAdapter, MAT_DATE_LOCALE, DateAdapter } from '@angular/material/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { of, Subject, map } from 'rxjs';
import { Calendar } from './calendar';
import { AppointmentRepository } from '../../core/repositories/appointment.repository';
import { UserRepository } from '../../core/repositories/user.repository';
import { PatientRepository } from '../../core/repositories/patient.repository';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { NotificationService } from '../../core/services/notification.service';
import { CalendarFocusService } from '../../core/services/calendar-focus.service';
import { SpanishDateAdapter } from '../../core/adapters/spanish-date-adapter';
import { AuditRepository } from '../../core/repositories/audit.repository';
import { AppointmentDialog } from './dialogs/appointment-dialog/appointment-dialog';
import { clinicTodayDate } from '../../core/utils/clinic-time';
import { dateToString } from '../../core/utils/date-utils';
import { ClinicClockService } from '../../core/services/clinic-clock.service';

const TODAY = '2026-06-01';

describe('Calendar', () => {
  let fixture: ComponentFixture<Calendar>;
  let component: Calendar;

  const mockPatients = [
    { id: 'p1', doctorId: 'd1', name: 'Ana', lastName: 'López', email: 'ana@test.com', phone: '5512345678', otpPassword: 'ABC123' },
  ] as any[];

  const mockAppointments = [
    {
      id: 'a1',
      patientId: 'p1',
      patientName: 'Ana López',
      patientLastName: 'López',
      patientFatherName: '',
      patientMotherName: '',
      patientBirthDate: '',
      patientPhone: '',
      doctorId: 'd1',
      doctorName: 'Dr. Y',
      date: TODAY,
      time: '10:00',
      status: 'scheduled',
      type: 'scheduled',
    },
  ] as any[];

  beforeEach(async () => {
    const aptSpy = {
      watchAppointmentsByDoctor: vi.fn().mockReturnValue(of(mockAppointments)),
      watchAppointmentsByUpdatedBy: vi.fn().mockReturnValue(of(mockAppointments)),
      watchOccupiedSlots: vi.fn((doctorId: string) => aptSpy.watchAppointmentsByDoctor(doctorId).pipe(map((items: any[]) =>
        items.filter(item => !item.disabled && item.status !== 'cancelled').map(({ id, doctorId, date, time }) => ({ id, doctorId, date, time }))))),
      createAppointment: vi.fn(),
      updateAppointment: vi.fn().mockResolvedValue(undefined),
    } as any;
    const patientSpy = { getAllPatients: vi.fn(), getPatientsByDoctor: vi.fn().mockResolvedValue(mockPatients) } as any;
    const userSpy = {
      getUser: vi.fn().mockResolvedValue({ uid: 'd1', role: 'doctor', profileComplete: true }),
      watchUser: vi.fn().mockReturnValue(of({ uid: 'd1', role: 'doctor', profileComplete: true })),
      watchAllUsers: vi.fn().mockReturnValue(of([])),
    } as any;
    const authSpy = { currentDoctor: { uid: 'd1', name: 'Dr. Y', role: 'doctor' } as any, session$: of(null) };
    const alertSpy = { success: vi.fn(), error: vi.fn() } as any;
    const dialogSpy = { open: vi.fn().mockReturnValue({ afterClosed: () => of(true) }) } as any;

    await TestBed.configureTestingModule({
      imports: [Calendar, NoopAnimationsModule],
      providers: [
        { provide: Router, useValue: { navigate: vi.fn() } },
        provideNativeDateAdapter(),
        { provide: MAT_DATE_LOCALE, useValue: 'es-MX' },
        { provide: DateAdapter, useClass: SpanishDateAdapter },
        { provide: AppointmentRepository, useValue: aptSpy },
        { provide: UserRepository, useValue: userSpy },
        { provide: PatientRepository, useValue: patientSpy },
        { provide: AuthService, useValue: authSpy },
        { provide: AlertService, useValue: alertSpy },
        { provide: MatDialog, useValue: dialogSpy },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        { provide: AuditRepository, useValue: {} },
        { provide: CalendarFocusService, useValue: new CalendarFocusService() },
        { provide: NotificationService, useValue: { notifyAppointmentCreated: vi.fn(), notifyAppointmentCancelled: vi.fn(), notifyAppointmentRescheduled: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Calendar);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it.each(['doctor', 'assistant', 'patient'])('uses a date-neutral empty message on another selected day as %s (P27)', async role => {
    const auth = TestBed.inject(AuthService) as any;
    auth.currentDoctor = role === 'patient' ? null : role === 'assistant'
      ? { uid: 'synthetic-assistant', role, createdBy: 'd1' } : { uid: 'd1', role };
    auth.currentPatient = role === 'patient' ? mockPatients[0] : null;
    (TestBed.inject(PatientRepository) as any).getChildrenGroup = vi.fn().mockResolvedValue(mockPatients);
    await component.ngOnInit();
    (component as any).selectedDay.set(new Date(2099, 0, 5));
    fixture.detectChanges();
    const empty = fixture.nativeElement.querySelector('.mobile-view');
    expect(empty.textContent).toContain('No tienes consultas agendadas para este día.');
    expect(empty.textContent).not.toContain('No tienes consultas agendadas para el día de hoy.');
  });

  it('shows an error and no success when cancelling an appointment fails (P43)', async () => {
    const alertSpy = TestBed.inject(AlertService) as any;
    const repo = TestBed.inject(AppointmentRepository) as any;
    repo.updateAppointment.mockRejectedValueOnce(new Error('fail'));
    await (component as any).doCancelAppointment(mockAppointments[0]);
    expect(alertSpy.error).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'No fue posible cancelar la consulta. Intenta nuevamente.' }));
    expect(alertSpy.success).not.toHaveBeenCalled();
  });

  it('initializes and returns to the clinic day and updates its markers at clinic midnight (P28)', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const clock = TestBed.inject(ClinicClockService);
    try {
      vi.setSystemTime(new Date('2026-10-10T05:45:00Z'));
      clock.refresh();
      fixture.destroy();
      fixture = TestBed.createComponent(Calendar);
      component = fixture.componentInstance;
      expect(dateToString((component as any).selectedDay())).toBe('2026-10-09');
      expect(dateToString((component as any).weekStart())).toBe('2026-10-04');
      expect((component as any).isToday(new Date(2026, 9, 9))).toBe(true);
      expect((component as any).isToday(new Date(2026, 9, 10))).toBe(false);
      expect((component as any).headerDays().find((d: any) => d.isToday).date).toBe(9);
      expect((component as any).isCurrentHour({ hour: 23, minute: 30 })).toBe(true);
      (component as any).nextWeek();
      (component as any).selectedDay.set(new Date(2026, 9, 11));
      (component as any).goToToday();
      expect(dateToString((component as any).selectedDay())).toBe('2026-10-09');
      vi.setSystemTime(new Date('2026-10-10T06:00:00Z'));
      clock.refresh();
      expect((component as any).isToday(new Date(2026, 9, 9))).toBe(false);
      expect((component as any).isToday(new Date(2026, 9, 10))).toBe(true);
      expect((component as any).headerDays().find((d: any) => d.isToday).date).toBe(10);
      expect((component as any).isCurrentHour({ hour: 0, minute: 0 })).toBe(true);
      // Refrescar el reloj no sustituye la fecha que el usuario está consultando.
      expect(dateToString((component as any).selectedDay())).toBe('2026-10-09');
      (component as any).goToToday();
      expect(dateToString((component as any).selectedDay())).toBe('2026-10-10');
    } finally {
      vi.useRealTimers();
      clock.refresh();
    }
  });

  it.each(['doctor', 'assistant', 'patient'])('mobile Reagendar opens the existing edit form as %s and collapses the detail (P18)', async role => {
    await component.ngOnInit();
    const auth = TestBed.inject(AuthService) as any;
    auth.currentDoctor = role === 'patient' ? null : role === 'assistant'
      ? { uid: 'synthetic-assistant', role, createdBy: 'd1' } : { uid: 'd1', role };
    auth.currentPatient = role === 'patient' ? mockPatients[0] : null;
    Object.defineProperty(auth, 'isPatient', { get: () => role === 'patient' });
    (TestBed.inject(PatientRepository) as any).getChildrenGroup = vi.fn().mockResolvedValue(mockPatients);
    vi.mocked(TestBed.inject(UserRepository).getUser).mockResolvedValue({ uid: 'd1', role: 'doctor', profileComplete: true, allowPatientScheduling: true } as any);
    const appointment = { ...mockAppointments[0], date: '2099-01-05', notes: 'Motivo de prueba' };
    const repository = TestBed.inject(AppointmentRepository);
    vi.mocked(repository.watchAppointmentsByDoctor).mockReturnValue(of([appointment]));
    vi.mocked(repository.watchAppointmentsByUpdatedBy).mockReturnValue(of([appointment]));
    await component.ngOnInit();
    (component as any).selectedDay.set(new Date(2099, 0, 5));
    const closed = new Subject<null>();
    const instance = { setData: vi.fn(), lockPatient: vi.fn(), setOccupiedSlots: vi.fn() };
    const dialog = { open: vi.fn().mockReturnValue({ componentInstance: instance, afterClosed: () => closed, close: vi.fn() }) };
    (component as any).dialog = dialog;
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.mobile-card').click();
    fixture.detectChanges();
    const detail = fixture.nativeElement.querySelector('.mobile-view app-appointment-detail-card') as HTMLElement;
    expect(detail).not.toBeNull();
    const button = [...detail.querySelectorAll('button')].find(el => el.textContent?.trim() === 'Reagendar');
    expect(button).toBeDefined();
    button!.click();
    fixture.detectChanges();
    expect(dialog.open).toHaveBeenCalledTimes(1);
    expect(instance.setData).toHaveBeenCalledWith(expect.objectContaining({ editingAppointment: appointment,
      selectedDoctorId: 'd1', patientScheduling: role === 'patient' }));
    expect((component as any).expandedAppointmentId()).toBeNull();
    expect(fixture.nativeElement.querySelector('.mobile-view app-appointment-detail-card')).toBeNull();
    closed.next(null); closed.complete();
  });

  it('mobile hides Reagendar and refuses its handler for a patient without scheduling permission (P18)', async () => {
    await component.ngOnInit();
    const auth = TestBed.inject(AuthService) as any;
    auth.currentDoctor = null; auth.currentPatient = mockPatients[0];
    Object.defineProperty(auth, 'isPatient', { get: () => true });
    (TestBed.inject(PatientRepository) as any).getChildrenGroup = vi.fn().mockResolvedValue(mockPatients);
    await component.ngOnInit();
    (component as any).selectedDay.set(new Date(2026, 5, 1));
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.mobile-card').click();
    fixture.detectChanges();
    const detail = fixture.nativeElement.querySelector('.mobile-view app-appointment-detail-card') as HTMLElement;
    expect(detail).not.toBeNull();
    expect([...detail.querySelectorAll('button')].some(el => el.textContent?.trim() === 'Reagendar')).toBe(false);
    const open = vi.spyOn(component as any, 'openAppointmentDialog');
    component.editAppointment(mockAppointments[0]);
    expect(open).not.toHaveBeenCalled();
  });

  it('releases cancelled hours and days while retaining another active booking at the same hour (P19)', async () => {
    await component.ngOnInit();
    const auth = TestBed.inject(AuthService) as any;
    auth.currentDoctor = null; auth.currentPatient = mockPatients[0];
    (TestBed.inject(PatientRepository) as any).getChildrenGroup = vi.fn().mockResolvedValue(mockPatients);
    const updates = new Subject<any[]>();
    vi.mocked(TestBed.inject(AppointmentRepository).watchAppointmentsByDoctor).mockReturnValue(updates);
    await component.ngOnInit();
    const cancelled = { ...mockAppointments[0], id: 'cancelled-only', date: '2099-01-05', status: 'cancelled' };
    const active = { ...mockAppointments[0], id: 'active', date: '2099-01-06', patientId: 'other-child' };
    updates.next([cancelled, active, { ...active, id: 'cancelled-shared', status: 'cancelled' },
      { ...active, id: 'disabled', date: '2099-01-07', disabled: true }]);
    expect([...((component as any).occupiedSlots() as Set<string>)]).toEqual(['2099-01-06|10:00']);
    expect([...((component as any).occupiedDays() as Set<string>)]).toEqual(['2099-01-06']);
    expect((component as any).allAppointments()).toEqual([]);
    updates.next([{ ...active, status: 'cancelled' }]);
    expect((component as any).occupiedSlots().size).toBe(0);
    expect((component as any).occupiedDays().size).toBe(0);
  });

  it('updates an open patient appointment form when a booking is cancelled and stops updating it after closing (P19)', async () => {
    await component.ngOnInit();
    const auth = TestBed.inject(AuthService) as any;
    auth.currentDoctor = null; auth.currentPatient = mockPatients[0];
    (TestBed.inject(PatientRepository) as any).getChildrenGroup = vi.fn().mockResolvedValue(mockPatients);
    vi.mocked(TestBed.inject(UserRepository).getUser).mockResolvedValue({ uid: 'd1', role: 'doctor', allowPatientScheduling: true } as any);
    const updates = new Subject<any[]>();
    vi.mocked(TestBed.inject(AppointmentRepository).watchAppointmentsByDoctor).mockReturnValue(updates);
    await component.ngOnInit();
    const active = { ...mockAppointments[0], date: '2099-01-05' };
    updates.next([active]);
    const closed = new Subject<null>();
    const instance = { setData: vi.fn(), setOccupiedSlots: vi.fn(), lockPatient: vi.fn(), hideAddPatient: { set: vi.fn() } };
    (component as any).dialog = { open: vi.fn().mockReturnValue({ componentInstance: instance, afterClosed: () => closed, close: vi.fn() }) };
    component.openSideAppointment();
    expect(instance.setData).toHaveBeenCalledWith(expect.objectContaining({ occupiedSlots: ['2099-01-05|10:00'], patientScheduling: true }));
    updates.next([{ ...active, status: 'cancelled' }]);
    expect(instance.setOccupiedSlots).toHaveBeenLastCalledWith([], []);
    closed.next(null); closed.complete();
    updates.next([active]);
    expect(instance.setOccupiedSlots).toHaveBeenCalledTimes(2);
  });

  it('does not send cancelled appointments to the staff overlap warning (P19)', async () => {
    await component.ngOnInit();
    const active = mockAppointments[0];
    (component as any).allAppointments.set([active, { ...active, id: 'cancelled', status: 'cancelled' }, { ...active, id: 'disabled', disabled: true }]);
    const instance = { setData: vi.fn() };
    (component as any).dialog = { open: vi.fn().mockReturnValue({ componentInstance: instance, afterClosed: () => of(null) }) };
    component.openSideAppointment();
    expect(instance.setData).toHaveBeenCalledWith(expect.objectContaining({ existingAppointments: [active] }));
  });

  async function openPatientReagenda(otherAppointments: any[] = []) {
    await component.ngOnInit();
    const auth = TestBed.inject(AuthService) as any;
    auth.currentDoctor = null;
    auth.currentPatient = mockPatients[0];
    (TestBed.inject(PatientRepository) as any).getChildrenGroup = vi.fn().mockResolvedValue(mockPatients);
    vi.mocked(TestBed.inject(UserRepository).getUser).mockResolvedValue({ uid: 'd1', role: 'doctor', allowPatientScheduling: true } as any);
    const updates = new Subject<any[]>();
    vi.mocked(TestBed.inject(AppointmentRepository).watchAppointmentsByDoctor).mockReturnValue(updates);
    await component.ngOnInit();
    (component as any).timeSegmentsByDaySignal.set(Object.fromEntries(
      ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => [day, [{ startTime: '09:00', endTime: '17:00' }]])
    ));
    const own = { ...mockAppointments[0], date: '2099-01-05' };
    updates.next([own, ...otherAppointments]);
    const editor = TestBed.createComponent(AppointmentDialog).componentInstance;
    const closed = new Subject<null>();
    (component as any).dialog = { open: vi.fn().mockReturnValue({ componentInstance: editor, afterClosed: () => closed, close: vi.fn() }) };
    const data = vi.spyOn(editor, 'setData');
    component.editAppointment(own);
    (editor as any).form.patchValue({ notes: 'Motivo ficticio actualizado' });
    return { editor, updates, own, closed, data };
  }

  it('excludes only the edited appointment and saves its original hour while the calendar still shows it occupied (P20)', async () => {
    const { editor, own, data } = await openPatientReagenda();
    expect(data).toHaveBeenCalledWith(expect.objectContaining({ occupiedSlots: [], editingAppointment: own }));
    expect((editor as any).availableTimes()).toContain(own.time);
    expect((component as any).occupiedSlots().has(`${own.date}|${own.time}`)).toBe(true);
    await editor.save();
    expect(TestBed.inject(AppointmentRepository).updateAppointment).toHaveBeenCalledWith(own.id,
      expect.objectContaining({ date: own.date, time: own.time, notes: 'Motivo ficticio actualizado' }));
    expect(TestBed.inject(AppointmentRepository).createAppointment).not.toHaveBeenCalled();

  });

  it.each([
    { status: 'scheduled', disabled: false, blocked: true },
    { status: 'cancelled', disabled: false, blocked: false },
    { status: 'scheduled', disabled: true, blocked: false },
  ])('keeps another appointment as occupancy according to its state: %j (P20)', async state => {
    const other = { ...mockAppointments[0], ...state, id: 'other-reservation', patientId: 'foreign-child', date: '2099-01-05' };
    const { editor, own, data } = await openPatientReagenda([other]);
    expect((editor as any).availableTimes().includes(own.time)).toBe(!state.blocked);
    expect(data).toHaveBeenCalledWith(expect.objectContaining({ existingAppointments: [own] }));
    await editor.save();
    if (state.blocked) {
      expect(TestBed.inject(AppointmentRepository).updateAppointment).not.toHaveBeenCalled();
      expect((editor as any).error()).toBe('Esa hora ya está ocupada. Elige otra hora disponible.');
    } else {
      expect(TestBed.inject(AppointmentRepository).updateAppointment).toHaveBeenCalledWith(own.id, expect.any(Object));
    }
  });

  it('rechecks other reservations live, keeps the own appointment excluded and stops updating a closed editor (P20)', async () => {
    const { editor, updates, own, closed } = await openPatientReagenda();
    const other = { ...own, id: 'other-live', patientId: 'foreign-child' };
    const setSlots = vi.spyOn(editor, 'setOccupiedSlots');
    updates.next([own]);
    expect((editor as any).availableTimes()).toContain(own.time);
    updates.next([own, other]);
    expect((editor as any).availableTimes()).not.toContain(own.time);
    await editor.save();
    expect(TestBed.inject(AppointmentRepository).updateAppointment).not.toHaveBeenCalled();
    updates.next([own, { ...other, status: 'cancelled' }]);
    expect((editor as any).availableTimes()).toContain(own.time);
    await editor.save();
    expect(TestBed.inject(AppointmentRepository).updateAppointment).toHaveBeenCalledWith(own.id, expect.objectContaining({ date: own.date, time: own.time }));
    expect(setSlots).toHaveBeenLastCalledWith([], [own]);
    const calls = setSlots.mock.calls.length;
    closed.next(null); closed.complete();
    updates.next([own, other]);
    expect(setSlots).toHaveBeenCalledTimes(calls);
  });

  it('blocks another chosen hour and sends a reschedule notification only after choosing a free new hour (P20)', async () => {
    const other = { ...mockAppointments[0], id: 'other-hour', patientId: 'foreign-child', date: '2099-01-05', time: '11:00' };
    const { editor, own } = await openPatientReagenda([other]);
    (editor as any).form.patchValue({ time: '11:00' });
    await editor.save();
    expect(TestBed.inject(AppointmentRepository).updateAppointment).not.toHaveBeenCalled();
    (editor as any).form.patchValue({ time: '11:30' });
    await editor.save();
    expect(TestBed.inject(AppointmentRepository).updateAppointment).toHaveBeenCalledWith(own.id, expect.objectContaining({ time: '11:30' }));

  });

  it.each(['doctor', 'assistant'])('loads only the owner patients for %s and excludes unowned records', async (role) => {
    const auth = TestBed.inject(AuthService) as any;
    auth.currentDoctor = role === 'doctor'
      ? { uid: 'd1', role: 'doctor' }
      : { uid: 'assistant-test', role: 'assistant', createdBy: 'd1' };
    const repo = TestBed.inject(PatientRepository);
    vi.mocked(repo.getPatientsByDoctor).mockResolvedValue([
      ...mockPatients,
      { ...mockPatients[0], id: 'foreign', doctorId: 'd2' },
      { ...mockPatients[0], id: 'legacy', doctorId: undefined },
    ]);
    await component.ngOnInit();
    expect(repo.getPatientsByDoctor).toHaveBeenCalledWith('d1');
    expect(repo.getAllPatients).not.toHaveBeenCalled();
    expect((component as any).allPatients().map((p: any) => p.id)).toEqual(['p1']);
  });

  it('does not use the assistant identity as a substitute for an unassigned doctor', async () => {
    await component.ngOnInit();
    const repo = TestBed.inject(PatientRepository);
    vi.mocked(repo.getPatientsByDoctor).mockClear();
    (TestBed.inject(AuthService) as any).currentDoctor = { uid: 'assistant-test', role: 'assistant' };
    await component.ngOnInit();
    expect(repo.getPatientsByDoctor).not.toHaveBeenCalled();
    expect((component as any).selectedDoctorId()).toBe('');
    expect((component as any).allPatients()).toEqual([]);
    const open = vi.spyOn((component as any).dialog, 'open');
    component.openSideAppointment();
    expect(open).not.toHaveBeenCalled();
  });

  it('refreshes scoped patients after closing a cancelled appointment form', async () => {
    await component.ngOnInit();
    const repo = TestBed.inject(PatientRepository);
    vi.mocked(repo.getPatientsByDoctor).mockClear();
    vi.mocked(repo.getPatientsByDoctor).mockResolvedValue([...mockPatients, { ...mockPatients[0], id: 'new-child' }]);
    const setData = vi.fn();
    (component as any).dialog = {
      open: vi.fn().mockReturnValue({ componentInstance: { setData }, afterClosed: () => of(null) }),
    };
    component.openSideAppointment();
    await vi.waitFor(() => expect((component as any).allPatients()).toHaveLength(2));
    expect(repo.getPatientsByDoctor).toHaveBeenCalledWith('d1');
    expect(repo.getAllPatients).not.toHaveBeenCalled();
    expect(setData).toHaveBeenCalledWith(expect.objectContaining({ allPatients: mockPatients }));
  });

  it('has 36 time slots (06:00 to 23:30) from default segment', () => {
    fixture.detectChanges();
    const slots = (component as any).timeSlots();
    expect(slots.length).toBe(36);
    expect(slots[0].label).toBe('6:00 AM');
    expect(slots[35].key).toBe('23:30');
  });

  it('shows all 7 days in the week', () => {
    fixture.detectChanges();
    expect((component as any).weekDays().length).toBe(7);
  });

  it('navigates to next week', () => {
    const initialStart = (component as any).weekStart().getTime();
    (component as any).nextWeek();
    expect((component as any).weekStart().getTime()).toBe(initialStart + 7 * 24 * 60 * 60 * 1000);
  });

  it('navigates to previous week', () => {
    const initialStart = (component as any).weekStart().getTime();
    (component as any).previousWeek();
    expect((component as any).weekStart().getTime()).toBe(initialStart - 7 * 24 * 60 * 60 * 1000);
  });

  it('goes to today (current week)', () => {
    (component as any).nextWeek();
    (component as any).goToToday();
    const sunday = (component as any).getWeekStart(clinicTodayDate());
    expect((component as any).weekStart().getTime()).toBe(sunday.getTime());
  });

  it('flags current week correctly', () => {
    const isCurrent = (component as any).isCurrentWeek();
    expect(isCurrent).toBe(true);
    (component as any).nextWeek();
    expect((component as any).isCurrentWeek()).toBe(false);
    (component as any).goToToday();
    expect((component as any).isCurrentWeek()).toBe(true);
  });

  it('tracks hovered cell', () => {
    fixture.detectChanges();
    const date = new Date(2026, 5, 1);
    const slot = (component as any).timeSlots()[4];
    (component as any).onCellHover(date, slot);

    expect((component as any).isHovered(date, slot)).toBe(true);

    (component as any).onCellLeave();
    expect((component as any).isHovered(date, slot)).toBe(false);
  });

  it('applies saved settings to the calendar immediately', () => {
    const savedSettings = {
      consultationDuration: 45,
      allowPatientScheduling: true,
      timeSegmentsByDay: {
        Lun: [{ startTime: '07:00', endTime: '11:00' }],
        Vie: [{ startTime: '13:00', endTime: '18:00' }],
      },
      availableDays: ['Lun', 'Vie'],
    };
    const setData = vi.fn();
    const dialog = {
      open: vi.fn().mockReturnValue({
        componentInstance: { setData },
        afterClosed: () => of(savedSettings),
      }),
    };
    (component as any).dialog = dialog;

    (component as any).openSettingsDialog();

    expect(setData).toHaveBeenCalled();
    expect((component as any).consultationDurationSignal()).toBe(45);
    expect((component as any).availableDaysSignal()).toEqual(['Lun', 'Vie']);
    expect((component as any).timeSegmentsByDaySignal()).toEqual(savedSettings.timeSegmentsByDay);
    expect((component as any).settingsForm.value.allowPatientScheduling).toBe(true);
  });

  it('opens the existing scheduling drawer when navigation requests a new appointment', async () => {
    const setData = vi.fn();
    const dialog = {
      open: vi.fn().mockReturnValue({
        componentInstance: { setData },
        afterClosed: () => of(null),
      }),
    };
    (component as any).dialog = dialog;
    history.replaceState({ openAppointment: true }, '');

    await component.ngOnInit();

    expect(dialog.open).toHaveBeenCalled();
    expect(setData).toHaveBeenCalledWith(expect.objectContaining({ editingAppointment: null }));
    expect(history.state.openAppointment).toBeUndefined();
  });

  it('opens appointment details and dismisses them from the backdrop without opening the scheduler', () => {
    const openDialog = vi.spyOn(component as any, 'openAppointmentDialog');
    const target = document.createElement('button');
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
      top: 10, right: 110, bottom: 50, left: 20, width: 90, height: 40, x: 20, y: 10,
      toJSON: () => ({}),
    });

    (component as any).selectAppointment(mockAppointments[0], { currentTarget: target } as unknown as MouseEvent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.detail-overlay')).toBeTruthy();
    const backdrop = fixture.nativeElement.querySelector('.detail-backdrop') as HTMLElement;
    expect(backdrop).toBeTruthy();
    backdrop.click();
    fixture.detectChanges();

    expect((component as any).selectedAppointment()).toBeNull();
    expect(openDialog).not.toHaveBeenCalled();
  });

  it('applies focus to an appointment set on the focus service', async () => {
    const date = '2026-06-01';
    TestBed.resetTestingModule();
    const focusService = new CalendarFocusService();
    const aptSpy = {
      watchAppointmentsByDoctor: vi.fn().mockReturnValue(of(mockAppointments)),
      watchAppointmentsByUpdatedBy: vi.fn().mockReturnValue(of(mockAppointments)),
      createAppointment: vi.fn(),
    } as any;
    const patientSpy = { getAllPatients: vi.fn(), getPatientsByDoctor: vi.fn().mockResolvedValue(mockPatients) } as any;
    const authSpy = { currentDoctor: { uid: 'd1', name: 'Dr. Y', role: 'doctor' } as any };
    const alertSpy = { success: vi.fn() } as any;
    const dialogSpy = { open: vi.fn().mockReturnValue({ afterClosed: () => of(true) }) } as any;

    focusService.setFocus({ date, time: '10:00', appointmentId: 'a1' });

    await TestBed.configureTestingModule({
      imports: [Calendar, NoopAnimationsModule],
      providers: [
        { provide: Router, useValue: { navigate: vi.fn() } },
        provideNativeDateAdapter(),
        { provide: MAT_DATE_LOCALE, useValue: 'es-MX' },
        { provide: DateAdapter, useClass: SpanishDateAdapter },
        { provide: AppointmentRepository, useValue: aptSpy },
        { provide: PatientRepository, useValue: patientSpy },
        { provide: AuthService, useValue: authSpy },
        { provide: AlertService, useValue: alertSpy },
        { provide: MatDialog, useValue: dialogSpy },
        { provide: UserRepository, useValue: { getUser: vi.fn().mockResolvedValue(undefined) } },
        { provide: CalendarFocusService, useValue: focusService },
        { provide: NotificationService, useValue: { notifyAppointmentCreated: vi.fn(), notifyAppointmentCancelled: vi.fn(), notifyAppointmentRescheduled: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Calendar);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 200));

    expect((component as any).focusedAppointmentId()).toBe('a1');
    expect((component as any).selectedDay().getFullYear()).toBe(2026);
  });

  it('applies focus when the focus service is set while already on the calendar', async () => {
    const date = '2026-06-01';
    TestBed.resetTestingModule();
    const focusService = new CalendarFocusService();
    const aptSpy = {
      watchAppointmentsByDoctor: vi.fn().mockReturnValue(of(mockAppointments)),
      watchAppointmentsByUpdatedBy: vi.fn().mockReturnValue(of(mockAppointments)),
      createAppointment: vi.fn(),
    } as any;
    const patientSpy = { getAllPatients: vi.fn(), getPatientsByDoctor: vi.fn().mockResolvedValue(mockPatients) } as any;
    const authSpy = { currentDoctor: { uid: 'd1', name: 'Dr. Y', role: 'doctor' } as any };
    const alertSpy = { success: vi.fn() } as any;
    const dialogSpy = { open: vi.fn().mockReturnValue({ afterClosed: () => of(true) }) } as any;

    await TestBed.configureTestingModule({
      imports: [Calendar, NoopAnimationsModule],
      providers: [
        { provide: Router, useValue: { navigate: vi.fn() } },
        provideNativeDateAdapter(),
        { provide: MAT_DATE_LOCALE, useValue: 'es-MX' },
        { provide: DateAdapter, useClass: SpanishDateAdapter },
        { provide: AppointmentRepository, useValue: aptSpy },
        { provide: PatientRepository, useValue: patientSpy },
        { provide: AuthService, useValue: authSpy },
        { provide: AlertService, useValue: alertSpy },
        { provide: MatDialog, useValue: dialogSpy },
        { provide: UserRepository, useValue: { getUser: vi.fn().mockResolvedValue(undefined) } },
        { provide: CalendarFocusService, useValue: focusService },
        { provide: NotificationService, useValue: { notifyAppointmentCreated: vi.fn(), notifyAppointmentCancelled: vi.fn(), notifyAppointmentRescheduled: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Calendar);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 20));

    expect((component as any).focusedAppointmentId()).toBe(null);

    focusService.setFocus({ date, time: '10:00', appointmentId: 'a1' });
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 200));

    expect((component as any).focusedAppointmentId()).toBe('a1');
    expect((component as any).selectedDay().getFullYear()).toBe(2026);
  });
});
