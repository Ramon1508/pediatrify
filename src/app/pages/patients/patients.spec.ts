import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { Patients } from './patients';
import { PatientRepository } from '../../core/repositories/patient.repository';
import { AlertService } from '../../core/services/alert.service';
import { Clipboard } from '@angular/cdk/clipboard';

describe('Patients', () => {
  let fixture: ComponentFixture<Patients>;
  let component: Patients;
  let patientRepo: PatientRepository;
  let alertService: AlertService;

  const mockPatients = [
    { id: '1', name: 'Juan', lastName: 'Pérez', email: 'juan@test.com', phone: '5512345678', otpPassword: 'ABC123' },
    { id: '2', name: 'María', lastName: 'García', email: 'maria@test.com', phone: '5598765432', otpPassword: 'XYZ789' },
  ] as any[];

  beforeEach(async () => {
    const repoSpy = {
      watchAllPatients: vi.fn().mockReturnValue(of(mockPatients)),
      createPatient: vi.fn(),
      updatePatient: vi.fn(),
      deletePatient: vi.fn(),
    } as any;
    const alertSpy = { success: vi.fn() } as any;
    const clipboardSpy = { copy: vi.fn() } as any;

    await TestBed.configureTestingModule({
      imports: [Patients, NoopAnimationsModule],
      providers: [
        { provide: PatientRepository, useValue: repoSpy },
        { provide: AlertService, useValue: alertSpy },
        { provide: Clipboard, useValue: clipboardSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Patients);
    component = fixture.componentInstance;
    patientRepo = TestBed.inject(PatientRepository);
    alertService = TestBed.inject(AlertService);
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

  it('opens dialog for new patient', () => {
    (component as any).openNewPatient();
    expect((component as any).showDialog).toBe(true);
    expect((component as any).editingPatient).toBeNull();
  });

  it('closes dialog', () => {
    (component as any).showDialog = true;
    (component as any).closeDialog();
    expect((component as any).showDialog).toBe(false);
  });

  it('creates a new patient', async () => {
    (component as any).form.setValue({
      name: 'Carlos',
      lastName: 'López',
      email: 'carlos@test.com',
      phone: '5511111111',
    });
    (patientRepo.createPatient as any).mockResolvedValue(undefined);

    await (component as any).savePatient();

    expect(patientRepo.createPatient).toHaveBeenCalled();
    expect(alertService.success).toHaveBeenCalled();
  });

  it('does not save when required fields are empty', async () => {
    await (component as any).savePatient();
    expect(patientRepo.createPatient).not.toHaveBeenCalled();
  });

  it('updates an existing patient', async () => {
    (component as any).editingPatient = mockPatients[0];
    (component as any).form.setValue({
      name: 'Juan Updated',
      lastName: 'Pérez',
      email: 'juan@test.com',
      phone: '5512345678',
    });
    (patientRepo.updatePatient as any).mockResolvedValue(undefined);

    await (component as any).savePatient();

    expect(patientRepo.updatePatient).toHaveBeenCalledWith('1', (component as any).form.value);
    expect(alertService.success).toHaveBeenCalled();
  });

  it('regenerates OTP password', async () => {
    (patientRepo.updatePatient as any).mockResolvedValue(undefined);

    await (component as any).regenerateOtp(mockPatients[0]);

    expect(patientRepo.updatePatient).toHaveBeenCalledWith('1', expect.objectContaining({ otpPassword: expect.any(String) }));
    expect(alertService.success).toHaveBeenCalled();
  });

  it('deletes patient after confirm', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    (patientRepo.deletePatient as any).mockResolvedValue(undefined);

    await (component as any).deletePatient(mockPatients[0]);

    expect(patientRepo.deletePatient).toHaveBeenCalledWith('1');
    expect(alertService.success).toHaveBeenCalled();
  });

  it('does not delete if cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    await (component as any).deletePatient(mockPatients[0]);

    expect(patientRepo.deletePatient).not.toHaveBeenCalled();
  });
});
