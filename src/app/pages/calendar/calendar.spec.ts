import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideNativeDateAdapter, MAT_DATE_LOCALE, DateAdapter } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { Calendar } from './calendar';
import { AppointmentRepository } from '../../core/repositories/appointment.repository';
import { UserRepository } from '../../core/repositories/user.repository';
import { PatientRepository } from '../../core/repositories/patient.repository';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { NotificationService } from '../../core/services/notification.service';
import { CalendarFocusService } from '../../core/services/calendar-focus.service';
import { SpanishDateAdapter } from '../../core/adapters/spanish-date-adapter';

const TODAY = '2026-06-01';

describe('Calendar', () => {
  let fixture: ComponentFixture<Calendar>;
  let component: Calendar;

  const mockPatients = [
    { id: 'p1', name: 'Ana', lastName: 'López', email: 'ana@test.com', phone: '5512345678', otpPassword: 'ABC123' },
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
      createAppointment: vi.fn(),
    } as any;
    const patientSpy = { getAllPatients: vi.fn().mockResolvedValue(mockPatients) } as any;
    const authSpy = { currentDoctor: { uid: 'd1', name: 'Dr. Y' } as any };
    const alertSpy = { success: vi.fn() } as any;
    const dialogSpy = { open: vi.fn().mockReturnValue({ afterClosed: () => of(true) }) } as any;

    await TestBed.configureTestingModule({
      imports: [Calendar, NoopAnimationsModule],
      providers: [
        provideNativeDateAdapter(),
        { provide: MAT_DATE_LOCALE, useValue: 'es-MX' },
        { provide: DateAdapter, useClass: SpanishDateAdapter },
        { provide: AppointmentRepository, useValue: aptSpy },
        { provide: PatientRepository, useValue: patientSpy },
        { provide: AuthService, useValue: authSpy },
        { provide: AlertService, useValue: alertSpy },
        { provide: MatDialog, useValue: dialogSpy },
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
    const sunday = (component as any).getWeekStart(new Date());
    expect((component as any).weekStart().getTime()).toBe(sunday.getTime());
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

  it('applies focus to an appointment set on the focus service', async () => {
    const date = '2026-06-01';
    TestBed.resetTestingModule();
    const focusService = new CalendarFocusService();
    const aptSpy = {
      watchAppointmentsByDoctor: vi.fn().mockReturnValue(of(mockAppointments)),
      watchAppointmentsByUpdatedBy: vi.fn().mockReturnValue(of(mockAppointments)),
      createAppointment: vi.fn(),
    } as any;
    const patientSpy = { getAllPatients: vi.fn().mockResolvedValue(mockPatients) } as any;
    const authSpy = { currentDoctor: { uid: 'd1', name: 'Dr. Y', role: 'doctor' } as any };
    const alertSpy = { success: vi.fn() } as any;
    const dialogSpy = { open: vi.fn().mockReturnValue({ afterClosed: () => of(true) }) } as any;

    focusService.setFocus({ date, time: '10:00', appointmentId: 'a1' });

    await TestBed.configureTestingModule({
      imports: [Calendar, NoopAnimationsModule],
      providers: [
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
    const patientSpy = { getAllPatients: vi.fn().mockResolvedValue(mockPatients) } as any;
    const authSpy = { currentDoctor: { uid: 'd1', name: 'Dr. Y', role: 'doctor' } as any };
    const alertSpy = { success: vi.fn() } as any;
    const dialogSpy = { open: vi.fn().mockReturnValue({ afterClosed: () => of(true) }) } as any;

    await TestBed.configureTestingModule({
      imports: [Calendar, NoopAnimationsModule],
      providers: [
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
