import { ComponentFixture, TestBed, fakeAsync, flush } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { Patients } from './patients';
import { PatientRepository } from '../../core/repositories/patient.repository';
import { AppointmentRepository } from '../../core/repositories/appointment.repository';
import { ClinicalRecordRepository } from '../../core/repositories/clinical-record.repository';
import { AuditRepository } from '../../core/repositories/audit.repository';
import { AlertService } from '../../core/services/alert.service';
import { AuthService } from '../../core/services/auth.service';
import { EmailService } from '../../core/services/email.service';
import { NotificationService } from '../../core/services/notification.service';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatDialog } from '@angular/material/dialog';
import { provideNativeDateAdapter } from '@angular/material/core';

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as any).ResizeObserver = MockResizeObserver;

describe('Patients', () => {
  let fixture: ComponentFixture<Patients>;
  let component: Patients;
  let patientRepo: PatientRepository;
  let alertService: AlertService;
  let appointmentRepo: AppointmentRepository;
  let auditRepo: AuditRepository;
  let dialog: MatDialog;

  const mockPatients = [
    { id: '1', name: 'Juan', lastName: 'Pérez', email: 'juan@test.com', phone: '5512345678', otpPassword: 'ABC123', birthDate: '2020-01-15', fatherName: 'Carlos', motherName: 'María' },
    { id: '2', name: 'María', lastName: 'García', email: 'maria@test.com', phone: '5598765432', otpPassword: 'XYZ789', birthDate: '2019-06-20', fatherName: 'Luis', motherName: 'Ana' },
  ] as any[];

  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const mockAppointments = [
    { id: 'a1', patientId: '1', patientName: 'Juan Pérez', patientLastName: 'Pérez', patientFatherName: '', patientMotherName: '', patientBirthDate: '', patientPhone: '', doctorId: 'doc1', doctorName: 'Dr. Test', date: todayStr(), time: '10:00', status: 'scheduled' as const, type: 'scheduled' as const, notes: 'Dolor de cabeza' },
  ] as any[];

  let dialogRefMock: any;

  beforeEach(async () => {
    dialogRefMock = {
      afterClosed: () => of(null),
      componentInstance: {
        setPatients: vi.fn(),
        setEditData: vi.fn(),
        setPatient: vi.fn(),
      },
      close: vi.fn(),
    };

    const repoSpy = {
      watchAllPatients: vi.fn().mockReturnValue(of(mockPatients)),
      createPatient: vi.fn(),
      updatePatient: vi.fn(),
      deletePatient: vi.fn(),
      getPatientsByDoctor: vi.fn().mockResolvedValue([]),
      deletePatients: vi.fn().mockResolvedValue(undefined),
    } as any;
    const alertSpy = { success: vi.fn(), error: vi.fn() } as any;
    const clipboardSpy = { copy: vi.fn() } as any;
    const auditSpy = { log: vi.fn() } as any;
    const authSpy = { currentDoctor: { uid: 'doc1', email: 'admin@test.com', role: 'admin' } } as any;
    const apptRepoSpy = {
      watchAppointmentsByDoctor: vi.fn().mockReturnValue(of(mockAppointments)),
      updateAppointment: vi.fn(),
      getByPatient: vi.fn().mockResolvedValue([]),
      getAllByDoctor: vi.fn().mockResolvedValue([]),
      deleteAppointments: vi.fn().mockResolvedValue(undefined),
    } as any;
    const clinicalRepoSpy = {
      getByPatient: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue(undefined),
    } as any;
    const emailSpy = { sendPatientAccessEmail: vi.fn().mockResolvedValue(undefined) } as any;
    const dialogSpy = {
      open: vi.fn().mockReturnValue(dialogRefMock),
    } as any;

    await TestBed.configureTestingModule({
      imports: [Patients, NoopAnimationsModule],
      providers: [
        provideNativeDateAdapter(),
        { provide: PatientRepository, useValue: repoSpy },
        { provide: AppointmentRepository, useValue: apptRepoSpy },
        { provide: ClinicalRecordRepository, useValue: clinicalRepoSpy },
        { provide: AuditRepository, useValue: auditSpy },
        { provide: AlertService, useValue: alertSpy },
        { provide: AuthService, useValue: authSpy },
        { provide: EmailService, useValue: emailSpy },
        { provide: Clipboard, useValue: clipboardSpy },
        { provide: MatDialog, useValue: dialogSpy },
        { provide: NotificationService, useValue: { notifyAppointmentCreated: vi.fn(), notifyAppointmentCancelled: vi.fn(), notifyAppointmentRescheduled: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Patients);
    component = fixture.componentInstance;
    patientRepo = TestBed.inject(PatientRepository);
    appointmentRepo = TestBed.inject(AppointmentRepository);
    auditRepo = TestBed.inject(AuditRepository);
    alertService = TestBed.inject(AlertService);
    dialog = TestBed.inject(MatDialog);
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('renders the patients list', () => {
    const el = fixture.nativeElement;
    expect(el.textContent).toContain('Pacientes');
    expect(el.textContent).toContain('Juan');
    expect(el.textContent).toContain('María');
  });

  it('shows today appointments carousel', () => {
    const appts = (component as any).todayAppointments();
    expect(appts.length).toBe(1);
    expect(appts[0].patientName).toBe('Juan Pérez');
    fixture.detectChanges();
    fixture.detectChanges();
    const el = fixture.nativeElement;
    expect(el.textContent).toContain('Consultas del día de hoy');
    expect(el.textContent).toContain('Juan Pérez');
    expect(el.textContent).toContain('Cancelar');
  });

  it('opens dialog for new patient', async () => {
    dialogRefMock.afterClosed = () => of(null);

    await (component as any).openNewPatient();

    expect(dialog.open).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({
      width: '400px',
      disableClose: true,
      panelClass: 'right-panel',
    }));
    expect(dialogRefMock.componentInstance.setPatients).toHaveBeenCalledWith(mockPatients);
  });

  it('opens dialog for editing patient', async () => {
    dialogRefMock.afterClosed = () => of(null);

    await (component as any).openEditPatient(mockPatients[0]);

    expect(dialog.open).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({
      width: '736px',
      disableClose: true,
      panelClass: 'right-panel',
    }));
    expect(dialogRefMock.componentInstance.setPatient).toHaveBeenCalledWith(mockPatients[0]);
  });

  it('logs audit when new patient dialog returns a result', async () => {
    const newPatient = { id: '3', name: 'Carlos', lastName: 'López', email: 'carlos@test.com', phone: '5511111111', fatherName: 'Pedro', motherName: 'Sofía' };
    dialogRefMock.afterClosed = () => of(newPatient);

    await (component as any).openNewPatient();

    expect(auditRepo.log).toHaveBeenCalled();
  });

  it('does not log audit when dialog is dismissed', async () => {
    dialogRefMock.afterClosed = () => of(null);

    await (component as any).openNewPatient();

    expect(auditRepo.log).not.toHaveBeenCalled();
  });

  it('regenerates OTP password', async () => {
    (patientRepo.updatePatient as any).mockResolvedValue(undefined);
    const emailService = TestBed.inject(EmailService);

    await (component as any).regenerateOtp(mockPatients[0]);

    expect(patientRepo.updatePatient).toHaveBeenCalledWith('1', expect.objectContaining({ otpPassword: expect.any(String) }));
    expect(emailService.sendPatientAccessEmail).toHaveBeenCalledWith(expect.objectContaining({ email: 'juan@test.com' }));
    expect(alertService.success).toHaveBeenCalled();
  });

  it('deletes patient after confirm', async () => {
    dialogRefMock.afterClosed = () => of(true);
    (patientRepo.deletePatient as any).mockResolvedValue(undefined);

    await (component as any).deletePatient(mockPatients[0]);

    expect(patientRepo.deletePatient).toHaveBeenCalledWith('1');
    expect(alertService.success).toHaveBeenCalled();
  });

  it('does not delete if cancelled', async () => {
    dialogRefMock.afterClosed = () => of(false);

    await (component as any).deletePatient(mockPatients[0]);

    expect(patientRepo.deletePatient).not.toHaveBeenCalled();
  });

  it('cancels an appointment', async () => {
    dialogRefMock.afterClosed = () => of(true);
    (appointmentRepo.updateAppointment as any).mockResolvedValue(undefined);

    await (component as any).cancelAppointment(mockAppointments[0]);

    expect(appointmentRepo.updateAppointment).toHaveBeenCalledWith('a1', { status: 'cancelled' });
    expect(auditRepo.log).toHaveBeenCalled();
    expect(alertService.success).toHaveBeenCalled();
  });

  it('does not cancel appointment when dialog is dismissed', async () => {
    dialogRefMock.afterClosed = () => of(false);

    await (component as any).cancelAppointment(mockAppointments[0]);

    expect(appointmentRepo.updateAppointment).not.toHaveBeenCalled();
  });

  it('filters patients by search term', () => {
    (component as any).searchTerm.set('garcía');
    fixture.detectChanges();
    expect((component as any).filteredPatients().length).toBe(1);
    expect((component as any).filteredPatients()[0].name).toBe('María');
  });

  it('searches by father name', () => {
    (component as any).searchTerm.set('Carlos');
    fixture.detectChanges();
    expect((component as any).filteredPatients().length).toBe(1);
    expect((component as any).filteredPatients()[0].name).toBe('Juan');
  });

  it('copies OTP to clipboard', () => {
    const clipboard = TestBed.inject(Clipboard);
    (component as any).copyOtp('ABC123');
    expect(clipboard.copy).toHaveBeenCalledWith('ABC123');
    expect(alertService.success).toHaveBeenCalled();
  });
});
