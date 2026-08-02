import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDialogRef, MatDialog } from '@angular/material/dialog';
import { AppointmentDialog } from './appointment-dialog';
import { AppointmentRepository } from '../../../../core/repositories/appointment.repository';
import { PatientRepository } from '../../../../core/repositories/patient.repository';
import { AuthService } from '../../../../core/services/auth.service';
import { AlertService } from '../../../../core/services/alert.service';
import { AuditRepository } from '../../../../core/repositories/audit.repository';

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
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MatDialog, useValue: { open: vi.fn().mockReturnValue({ afterClosed: () => of(null), componentInstance: { setPatients: vi.fn() } }) } },
        { provide: AppointmentRepository, useValue: { createAppointment: vi.fn(), updateAppointment: vi.fn() } },
        { provide: PatientRepository, useValue: { getAllPatients: vi.fn().mockResolvedValue(mockPatients) } },
        { provide: AuthService, useValue: { currentDoctor: { uid: 'd1', firebaseUid: 'd1', name: 'Dr. Test', email: 'dr@test.com' } } },
        { provide: AlertService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: AuditRepository, useValue: { log: vi.fn() } },
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
    component.setData({ allPatients: mockPatients, selectedDoctorId: 'd1', timeSegments: [{ startTime: '09:00', endTime: '17:00' }], consultationDuration: 30 });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Agendar una consulta');
  });

  it('renders title when editing', () => {
    component.setData({
      allPatients: mockPatients,
      selectedDoctorId: 'd1',
      editingAppointment: { id: 'a1', patientId: 'p1', patientName: 'Juan Pérez', date: '2026-07-01', time: '10:00', doctorId: 'd1', notes: 'Test' } as any,
      timeSegments: [{ startTime: '09:00', endTime: '17:00' }],
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

    component.setData({ allPatients: mockPatients, selectedDoctorId: 'd1', timeSegments: [{ startTime: '09:00', endTime: '17:00' }], consultationDuration: 30 });
    (component as any).form.patchValue({ patientId: 'p1', date: '2026-07-15', time: '10:00', notes: '' });
    (component as any).form.markAsDirty();
    fixture.detectChanges();

    await component.save();

    expect(aptRepo.createAppointment).toHaveBeenCalled();
    expect(alertService.success).toHaveBeenCalled();
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });
});
