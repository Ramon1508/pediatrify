import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideNativeDateAdapter, MAT_DATE_LOCALE, DateAdapter } from '@angular/material/core';
import { of } from 'rxjs';
import { Calendar } from './calendar';
import { AppointmentRepository } from '../../core/repositories/appointment.repository';
import { PatientRepository } from '../../core/repositories/patient.repository';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { SpanishDateAdapter } from '../../core/adapters/spanish-date-adapter';

const TODAY = '2026-06-01';

describe('Calendar', () => {
  let fixture: ComponentFixture<Calendar>;
  let component: Calendar;
  let appointmentRepo: AppointmentRepository;
  let alertService: AlertService;

  const mockPatients = [
    { id: 'p1', name: 'Ana', lastName: 'López', email: 'ana@test.com', phone: '5512345678', otpPassword: 'ABC123' },
  ] as any[];

  const mockAppointments = [
    {
      id: 'a1',
      patientId: 'p1',
      patientName: 'Ana López',
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
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Calendar);
    component = fixture.componentInstance;
    appointmentRepo = TestBed.inject(AppointmentRepository);
    alertService = TestBed.inject(AlertService);
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('has 32 time slots (6:00 to 21:30)', () => {
    expect((component as any).timeSlots.length).toBe(32);
    expect((component as any).timeSlots[0].label).toBe('6:00');
    expect((component as any).timeSlots[31].key).toBe('21:30');
  });

  it('generates 7 week days', () => {
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

  it('opens new appointment dialog with pre-filled date/time', () => {
    const date = new Date(2026, 5, 1);
    const slot = (component as any).timeSlots[16]; // 14:00
    (component as any).openNewAppointment(date, slot);

    expect((component as any).showDialog).toBe(true);
    expect((component as any).appointmentForm.get('date')?.value).toBe('2026-06-01');
    expect((component as any).appointmentForm.get('time')?.value).toBe('14:00');
  });

  it('closes dialog', () => {
    (component as any).showDialog = true;
    (component as any).closeDialog();
    expect((component as any).showDialog).toBe(false);
  });

  it('saves a new appointment', async () => {
    (component as any).appointmentForm.setValue({ patientId: 'p1', date: '2026-06-05', time: '11:00', notes: '' });
    (appointmentRepo.createAppointment as any).mockResolvedValue(undefined);

    await (component as any).saveAppointment();

    expect(appointmentRepo.createAppointment).toHaveBeenCalled();
    expect(alertService.success).toHaveBeenCalledWith({ message: 'Cita agendada', duration: 3000 });
    expect((component as any).showDialog).toBe(false);
  });

  it('does not save without required fields', async () => {
    await (component as any).saveAppointment();
    expect(appointmentRepo.createAppointment).not.toHaveBeenCalled();
  });

  it('tracks hovered cell', () => {
    const date = new Date(2026, 5, 1);
    const slot = (component as any).timeSlots[4]; // 10:00
    (component as any).onCellHover(date, slot);

    expect((component as any).isHovered(date, slot)).toBe(true);

    (component as any).onCellLeave();
    expect((component as any).isHovered(date, slot)).toBe(false);
  });
});
