import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MAT_DATE_LOCALE } from '@angular/material/core';
import { MatDialogRef } from '@angular/material/dialog';
import { AppointmentDialog } from './appointment-dialog';
import { AppointmentRepository } from '../../../../core/repositories/appointment.repository';
import { PatientRepository } from '../../../../core/repositories/patient.repository';
import { AuthService } from '../../../../core/services/auth.service';
import { AlertService } from '../../../../core/services/alert.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { AuditRepository } from '../../../../core/repositories/audit.repository';
import { EmailService } from '../../../../core/services/email.service';

describe('AppointmentDialog', () => {
  let fixture: ComponentFixture<AppointmentDialog>;
  let component: AppointmentDialog;
  let dialogRef: MatDialogRef<AppointmentDialog>;
  let alertService: AlertService;

  const mockPatients = [
    { id: 'p1', name: 'Juan', lastName: 'Pérez', email: 'juan@test.com', phone: '5512345678', otpPassword: 'ABC123', fatherName: 'Carlos', motherName: 'María', birthDate: '2020-01-15' },
  ] as any[];

  beforeEach(async () => {
    dialogRef = { close: vi.fn() } as any;

    await TestBed.configureTestingModule({
      imports: [AppointmentDialog, NoopAnimationsModule],
      providers: [
        provideNativeDateAdapter(),
        { provide: MAT_DATE_LOCALE, useValue: 'es-MX' },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: AppointmentRepository, useValue: { createAppointment: vi.fn(), updateAppointment: vi.fn() } },
        { provide: PatientRepository, useValue: { getAllPatients: vi.fn().mockResolvedValue(mockPatients) } },
        { provide: AuthService, useValue: { currentDoctor: { uid: 'd1', firebaseUid: 'd1', name: 'Dr. Test', email: 'dr@test.com' } } },
        { provide: AlertService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: AuditRepository, useValue: { log: vi.fn() } },
        { provide: NotificationService, useValue: { notifyAppointmentCreated: vi.fn(), notifyAppointmentCancelled: vi.fn(), notifyAppointmentRescheduled: vi.fn() } },
        { provide: EmailService, useValue: { sendPatientAccessEmail: vi.fn().mockResolvedValue(undefined) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppointmentDialog);
    component = fixture.componentInstance;
    alertService = TestBed.inject(AlertService);
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('renders title when creating', () => {
    component.setData({ allPatients: mockPatients, selectedDoctorId: 'd1', timeSegmentsByDay: { Lun: [{ startTime: '09:00', endTime: '17:00' }] }, consultationDuration: 30 });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Agendar una consulta');
  });

  it('renders title when editing', () => {
    component.setData({
      allPatients: mockPatients,
      selectedDoctorId: 'd1',
      editingAppointment: { id: 'a1', patientId: 'p1', patientName: 'Juan Pérez', date: '2026-07-01', time: '10:00', doctorId: 'd1', notes: 'Test' } as any,
      timeSegmentsByDay: { Lun: [{ startTime: '09:00', endTime: '17:00' }] },
      consultationDuration: 30,
    });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Reagendar consulta');
  });

  it('shows error on save when form is invalid', async () => {
    component.setData({ allPatients: mockPatients, selectedDoctorId: 'd1' });
    fixture.detectChanges();
    await component.save();
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('closes dialog on save when form is valid', async () => {
    const aptRepo = TestBed.inject(AppointmentRepository);
    (aptRepo.createAppointment as any).mockResolvedValue(undefined);

    component.setData({ allPatients: mockPatients, selectedDoctorId: 'd1', timeSegmentsByDay: { Lun: [{ startTime: '09:00', endTime: '17:00' }] }, consultationDuration: 30 });
    (component as any).form.patchValue({ patientId: 'p1', date: '2026-07-15', time: '10:00', notes: '' });
    (component as any).form.markAsDirty();
    fixture.detectChanges();

    await component.save();

    expect(aptRepo.createAppointment).toHaveBeenCalled();
    expect(alertService.success).toHaveBeenCalled();
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('shows the embedded new patient form instead of a stacked dialog', () => {
    component.setData({ allPatients: mockPatients, selectedDoctorId: 'd1', timeSegmentsByDay: { Lun: [{ startTime: '09:00', endTime: '17:00' }] }, consultationDuration: 30 });
    fixture.detectChanges();

    const addBtn = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
      (b: any) => (b.textContent || '').includes('Añadir nuevo paciente')
    );
    expect(addBtn).toBeTruthy();

    (addBtn as HTMLButtonElement).click();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect((component as any).showNewPatient()).toBe(true);
    expect(el.textContent).toContain('Nombre completo');
    expect(el.querySelector('.btn-back-dialog')).toBeTruthy();
    expect(el.querySelector('app-new-patient-dialog')).toBeTruthy();
  });

  it('returns to the appointment form from the embedded new patient view', async () => {
    component.setData({ allPatients: mockPatients, selectedDoctorId: 'd1', timeSegmentsByDay: { Lun: [{ startTime: '09:00', endTime: '17:00' }] }, consultationDuration: 30 });
    fixture.detectChanges();

    (component as any).showNewPatient.set(true);
    fixture.detectChanges();

    const backBtn = fixture.nativeElement.querySelector('.btn-back-dialog') as HTMLButtonElement;
    backBtn.click();
    fixture.detectChanges();

    expect((component as any).showNewPatient()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Agendar una consulta');
  });

  it('selects the newly created patient after saving from the embedded form', async () => {
    const patientRepo = TestBed.inject(PatientRepository);
    (patientRepo.getAllPatients as any).mockResolvedValue([...mockPatients, { id: 'p2', name: 'Ana', lastName: 'López', email: 'ana@test.com', phone: '5599999999', fatherName: 'Luis', motherName: 'Lucía', birthDate: '2021-05-10', otpPassword: 'XYZ789' }]);

    component.setData({ allPatients: mockPatients, selectedDoctorId: 'd1', timeSegmentsByDay: { Lun: [{ startTime: '09:00', endTime: '17:00' }] }, consultationDuration: 30 });
    fixture.detectChanges();

    const newPatient = { id: 'p2', name: 'Ana', lastName: 'López' };
    await component.onPatientCreated(newPatient as any);

    expect((component as any).showNewPatient()).toBe(false);
    expect((component as any).form.get('patientId')?.value).toBe('p2');
  });
});
