import { ComponentFixture, TestBed, fakeAsync, flush } from '@angular/core/testing';
import { ClinicClockService } from '../../core/services/clinic-clock.service';
import { todayClinicDateString } from '../../core/utils/clinic-time';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, Subject, throwError } from 'rxjs';
import { Patients } from './patients';
import { PatientRepository } from '../../core/repositories/patient.repository';
import { AppointmentRepository } from '../../core/repositories/appointment.repository';
import { ClinicalRecordRepository } from '../../core/repositories/clinical-record.repository';
import { AlertService } from '../../core/services/alert.service';
import { AuthService } from '../../core/services/auth.service';
import { EmailService } from '../../core/services/email.service';
import { PatientAccessService } from '../../core/services/patient-access.service';
import { NotificationService } from '../../core/services/notification.service';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatDialog } from '@angular/material/dialog';
import { provideNativeDateAdapter } from '@angular/material/core';
import { Router } from '@angular/router';

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
  let dialog: MatDialog;

  const mockPatients = [
    { id: '1', doctorId: 'doc1', name: 'Juan', lastName: 'Pérez', email: 'juan@test.com', phone: '5512345678', otpPassword: 'ABC123', birthDate: '2020-01-15', fatherName: 'Carlos', motherName: 'María' },
    { id: '2', doctorId: 'doc1', name: 'María', lastName: 'García', email: 'maria@test.com', phone: '5598765432', otpPassword: 'XYZ789', birthDate: '2019-06-20', fatherName: 'Luis', motherName: 'Ana' },
  ] as any[];

  const todayStr = () => todayClinicDateString();
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
        switchToEdit: vi.fn(),
      },
      close: vi.fn(),
    };

    const repoSpy = {
      watchAllPatients: vi.fn(),
      watchPatientsByDoctor: vi.fn().mockReturnValue(of(mockPatients)),
      createPatient: vi.fn(),
      updatePatient: vi.fn(),
      deletePatient: vi.fn(),
      getPatientsByDoctor: vi.fn().mockResolvedValue([]),
      deletePatients: vi.fn().mockResolvedValue(undefined),
    } as any;
    const alertSpy = { success: vi.fn(), error: vi.fn() } as any;
    const clipboardSpy = { copy: vi.fn() } as any;
    const authSpy = { currentDoctor: { uid: 'doc1', email: 'doctor@example.test', role: 'doctor' } } as any;
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
        { provide: AlertService, useValue: alertSpy },
        { provide: AuthService, useValue: authSpy },
        { provide: EmailService, useValue: emailSpy },
        { provide: PatientAccessService, useValue: { read: vi.fn().mockResolvedValue({ credentialEpoch: 'a'.repeat(32), credentialVersion: 1, password: 'SYN123' }), renew: vi.fn().mockResolvedValue({ credentialEpoch: 'a'.repeat(32), credentialVersion: 2, password: 'NEW123' }) } },
        { provide: Clipboard, useValue: clipboardSpy },
        { provide: MatDialog, useValue: dialogSpy },
        { provide: NotificationService, useValue: { notifyAppointmentCreated: vi.fn(), notifyAppointmentCancelled: vi.fn(), notifyAppointmentRescheduled: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Patients);
    component = fixture.componentInstance;
    patientRepo = TestBed.inject(PatientRepository);
    appointmentRepo = TestBed.inject(AppointmentRepository);
    alertService = TestBed.inject(AlertService);
    dialog = TestBed.inject(MatDialog);
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('subscribes only to the current doctor and excludes foreign and legacy records', async () => {
    const scoped = new Subject<any[]>();
    vi.mocked(patientRepo.watchPatientsByDoctor).mockReturnValue(scoped);
    await component.ngOnInit();
    scoped.next([...mockPatients,
      { ...mockPatients[0], id: 'foreign', doctorId: 'other-doctor' },
      { ...mockPatients[0], id: 'legacy', doctorId: undefined },
    ]);
    expect(patientRepo.watchPatientsByDoctor).toHaveBeenCalledWith('doc1');
    expect(patientRepo.watchAllPatients).not.toHaveBeenCalled();
    expect((component as any).patients().map((p: any) => p.id)).toEqual(['1', '2']);
    scoped.next([mockPatients[0]]);
    expect((component as any).patients()).toHaveLength(1);
    fixture.destroy();
    expect(scoped.observed).toBe(false);
  });

  it('ends loading and shows an alert when the scoped subscription fails', async () => {
    vi.mocked(patientRepo.watchPatientsByDoctor).mockReturnValue(throwError(() => new Error('Synthetic read failure')));
    await component.ngOnInit();
    expect((component as any).patients()).toEqual([]);
    expect((component as any).loading()).toBe(false);
    expect(alertService.error).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('cargar tus pacientes') }));
  });

  it.each(['admin', 'assistant', 'no-user'])('does not subscribe to patients for %s', async (role) => {
    const auth = TestBed.inject(AuthService) as any;
    auth.currentDoctor = role === 'no-user' ? null : { uid: 'other', role };
    vi.mocked(patientRepo.watchPatientsByDoctor).mockClear();
    await component.ngOnInit();
    expect(patientRepo.watchPatientsByDoctor).not.toHaveBeenCalled();
    expect(patientRepo.watchAllPatients).not.toHaveBeenCalled();
  });

  it('renders the patients list', () => {
    const el = fixture.nativeElement;
    expect(el.textContent).toContain('Pacientes');
    expect(el.textContent).toContain('Juan');
    expect(el.textContent).toContain('María');
  });

  it('shows only the centered add button when there are no patients', () => {
    (component as any).patients.set([]);
    (component as any).patientsWithAge.set([]);
    (component as any).loading.set(false);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const headerAddButton = el.querySelector('.header-actions button');
    const emptyStateAddButton = el.querySelector('.empty-state-content button');

    expect(el.textContent).toContain('No has agregado ningún paciente.');
    expect(emptyStateAddButton?.textContent).toContain('Agregar paciente');
    expect(headerAddButton).toBeNull();
  });

  it('shows only the header add button when patients exist', () => {
    const el: HTMLElement = fixture.nativeElement;
    const headerAddButton = el.querySelector('.header-actions button');
    const emptyStateAddButton = el.querySelector('.empty-state-content button');

    expect(headerAddButton?.textContent).toContain('Agregar paciente');
    expect(emptyStateAddButton).toBeNull();
    expect(el.querySelectorAll('app-patient-card')).toHaveLength(2);
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
    expect(el.querySelector('.appointments-empty-state')).toBeNull();
  });

  it('shows the independent appointments empty state and reuses the scheduling flow', () => {
    (component as any).agendaAppointments.set([]);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Consultas del día de hoy');
    expect(el.textContent).toContain('No tienes consultas agendadas para el día de hoy.');
    const button = el.querySelector('.appointments-empty-state button') as HTMLButtonElement;
    expect(button.textContent).toContain('Agendar consulta');
    expect(el.querySelectorAll('app-patient-card')).toHaveLength(2);

    button.click();
    expect(navigate).toHaveBeenCalledWith(['/app/calendar'], { state: { openAppointment: true } });
  });

  it('changes Consultas del día at clinic midnight without another snapshot (P28)', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const clock = TestBed.inject(ClinicClockService);
    try {
      vi.setSystemTime(new Date('2026-10-10T05:59:00Z'));
      clock.refresh();
      (component as any).agendaAppointments.set([
        { ...mockAppointments[0], id: 'previous', date: '2026-10-09' },
        { ...mockAppointments[0], id: 'next', date: '2026-10-10' },
        { ...mockAppointments[0], id: 'cancelled', date: '2026-10-10', status: 'cancelled' },
      ]);
      expect((component as any).todayAppointments().map((a: any) => a.id)).toEqual(['previous']);
      expect((component as any).todayDateLabel()).toBe('09/10/2026');
      vi.setSystemTime(new Date('2026-10-10T06:00:00Z'));
      clock.refresh();
      expect((component as any).todayAppointments().map((a: any) => a.id)).toEqual(['next']);
      expect((component as any).todayDateLabel()).toBe('10/10/2026');
    } finally {
      vi.useRealTimers();
      clock.refresh();
    }
  });

  it('opens dialog for new patient', async () => {
    dialogRefMock.afterClosed = () => of(null);

    await (component as any).openNewPatient();

    expect(dialog.open).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({
      width: '400px',
      disableClose: false,
      panelClass: 'right-panel',
    }));
    expect(dialogRefMock.componentInstance.setPatients).toHaveBeenCalledWith(mockPatients);
  });

  it('opens dialog for editing patient', async () => {
    dialogRefMock.afterClosed = () => of(null);

    await (component as any).openEditPatient(mockPatients[0]);

    expect(dialog.open).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({
      width: '736px',
      disableClose: false,
      panelClass: 'right-panel',
    }));
    expect(dialogRefMock.componentInstance.setPatient).toHaveBeenCalledWith(mockPatients[0]);
    expect(dialogRefMock.componentInstance.switchToEdit).toHaveBeenCalled();
  });

  it('confirms a created patient when the dialog returns its result', async () => {
    const newPatient = { id: '3', name: 'Carlos', lastName: 'López', email: 'carlos@test.com', phone: '5511111111', fatherName: 'Pedro', motherName: 'Sofía' };
    dialogRefMock.afterClosed = () => of(newPatient);

    await (component as any).openNewPatient();

    expect(TestBed.inject(AlertService).success).toHaveBeenCalledWith({ message: 'Paciente agregado', duration: 3000 });
  });

  it('does not confirm creation when the dialog is dismissed', async () => {
    dialogRefMock.afterClosed = () => of(null);

    await (component as any).openNewPatient();

    expect(TestBed.inject(AlertService).success).not.toHaveBeenCalled();
  });

  it('regenerates OTP password', async () => {
    (patientRepo.updatePatient as any).mockResolvedValue(undefined);
    const emailService = TestBed.inject(EmailService);

    await (component as any).regenerateOtp(mockPatients[0]);

    expect(TestBed.inject(PatientAccessService).renew).toHaveBeenCalledWith(expect.objectContaining({ patientId: '1', expectedVersion: 1, expectedEpoch: 'a'.repeat(32) }));
    expect(patientRepo.updatePatient).not.toHaveBeenCalled();
    expect(emailService.sendPatientAccessEmail).toHaveBeenCalledWith(expect.objectContaining({ patientId: '1', operationId: expect.any(String) }));
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
