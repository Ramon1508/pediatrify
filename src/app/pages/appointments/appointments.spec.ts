import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { Appointments } from './appointments';
import { AppointmentRepository } from '../../core/repositories/appointment.repository';
import { PatientRepository } from '../../core/repositories/patient.repository';
import { UserRepository } from '../../core/repositories/user.repository';
import { AuditRepository } from '../../core/repositories/audit.repository';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';

describe('Appointments', () => {
  let fixture: ComponentFixture<Appointments>;
  let component: Appointments;
  let appointmentRepo: AppointmentRepository;
  let authService: AuthService;
  let alertService: AlertService;
  let dialog: MatDialog;

  const mockPatients = [
    { id: 'p1', name: 'Juan', lastName: 'Pérez', email: 'juan@test.com', phone: '5512345678', otpPassword: 'ABC123' },
  ] as any[];

  const mockAppointments = [
    { id: 'a1', patientId: 'p1', patientName: 'Juan Pérez', patientLastName: 'Pérez', patientFatherName: '', patientMotherName: '', patientBirthDate: '', patientPhone: '', doctorId: 'd1', doctorName: 'Dr. X', date: '2026-06-01', time: '10:00', status: 'scheduled', type: 'scheduled' },
    { id: 'a2', patientId: 'p1', patientName: 'Juan Pérez', patientLastName: 'Pérez', patientFatherName: '', patientMotherName: '', patientBirthDate: '', patientPhone: '', doctorId: 'd1', doctorName: 'Dr. X', date: '2026-06-01', time: '11:00', status: 'attended', type: 'scheduled' },
  ] as any[];

  beforeEach(async () => {
    const aptSpy = {
      watchAppointmentsByDoctor: vi.fn().mockReturnValue(of(mockAppointments)),
      createAppointment: vi.fn(),
      updateAppointment: vi.fn(),
    } as any;
    const patientSpy = { getAllPatients: vi.fn().mockResolvedValue(mockPatients) } as any;
    const userSpy = { getUser: vi.fn().mockResolvedValue({ timeSegments: [{ startTime: '08:00', endTime: '12:00' }], consultationDuration: 30 }) } as any;
    const auditSpy = { log: vi.fn().mockResolvedValue(undefined) } as any;
    const authSpy = { currentDoctor: { uid: 'd1', name: 'Dr. X' } as any };
    const alertSpy = { success: vi.fn() } as any;
    const dialogSpy = {
      open: vi.fn().mockReturnValue({
        afterClosed: vi.fn().mockReturnValue(of(true)),
        componentInstance: { setPatients: vi.fn(), setEditData: vi.fn() },
      }),
      _openDialogs: [],
      _afterAllClosed: { subscribe: vi.fn() },
      afterOpened: { subscribe: vi.fn(), pipe: vi.fn().mockReturnThis() },
    } as any;

    await TestBed.configureTestingModule({
      imports: [Appointments, NoopAnimationsModule],
      providers: [
        { provide: AppointmentRepository, useValue: aptSpy },
        { provide: PatientRepository, useValue: patientSpy },
        { provide: UserRepository, useValue: userSpy },
        { provide: AuditRepository, useValue: auditSpy },
        { provide: AuthService, useValue: authSpy },
        { provide: AlertService, useValue: alertSpy },
      ],
    }).overrideProvider(MatDialog, {
      useValue: dialogSpy,
    }).compileComponents();

    fixture = TestBed.createComponent(Appointments);
    component = fixture.componentInstance;
    appointmentRepo = TestBed.inject(AppointmentRepository);
    authService = TestBed.inject(AuthService);
    alertService = TestBed.inject(AlertService);
    dialog = TestBed.inject(MatDialog);
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('renders tabs and appointments', () => {
    const el = fixture.nativeElement;
    expect(el.textContent).toContain('Citas');
    expect(el.textContent).toContain('Pendientes');
    expect(el.textContent).toContain('Atendidas');
  });

  it('computes pending appointments', () => {
    expect((component as any).pendingAppointments().length).toBe(1);
    expect((component as any).pendingAppointments()[0].id).toBe('a1');
  });

  it('computes attended appointments', () => {
    expect((component as any).attendedAppointments().length).toBe(1);
    expect((component as any).attendedAppointments()[0].id).toBe('a2');
  });

  it('opens new appointment dialog', () => {
    (component as any).openNewAppointment();
    expect(dialog.open).toHaveBeenCalled();
  });

  it('marks appointment as attended', async () => {
    (appointmentRepo.updateAppointment as any).mockResolvedValue(undefined);

    await (component as any).markAttended(mockAppointments[0]);

    expect(appointmentRepo.updateAppointment).toHaveBeenCalledWith('a1', { status: 'attended' });
    expect(alertService.success).toHaveBeenCalled();
  });

  it('cancels appointment', async () => {
    (appointmentRepo.updateAppointment as any).mockResolvedValue(undefined);

    await (component as any).cancelAppointment(mockAppointments[0]);

    expect(appointmentRepo.updateAppointment).toHaveBeenCalledWith('a1', { status: 'cancelled' });
    expect(alertService.success).toHaveBeenCalled();
  });

  it('registers a walk-in', async () => {
    (component as any).walkInForm.setValue({ patientId: 'p1', date: '2026-06-01', time: '15:00', notes: '' });
    (appointmentRepo.createAppointment as any).mockResolvedValue(undefined);

    await (component as any).registerWalkIn();

    expect(appointmentRepo.createAppointment).toHaveBeenCalled();
    expect(alertService.success).toHaveBeenCalled();
  });

  it('does not register walk-in without patient', async () => {
    await (component as any).registerWalkIn();
    expect(appointmentRepo.createAppointment).not.toHaveBeenCalled();
  });
});
