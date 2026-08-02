import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDialogRef } from '@angular/material/dialog';
import { ClinicalEntryDialog } from './clinical-entry-dialog';
import { ClinicalRecordRepository } from '../../../../core/repositories/clinical-record.repository';
import { AuthService } from '../../../../core/services/auth.service';
import { AlertService } from '../../../../core/services/alert.service';

describe('ClinicalEntryDialog', () => {
  let fixture: ComponentFixture<ClinicalEntryDialog>;
  let component: ClinicalEntryDialog;
  let dialogRef: MatDialogRef<ClinicalEntryDialog>;
  let alertService: AlertService;

  beforeEach(async () => {
    dialogRef = { close: vi.fn() } as any;

    await TestBed.configureTestingModule({
      imports: [ClinicalEntryDialog, NoopAnimationsModule],
      providers: [
        provideNativeDateAdapter(),
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: ClinicalRecordRepository, useValue: { create: vi.fn(), update: vi.fn() } },
        { provide: AuthService, useValue: { currentDoctor: { email: 'dr@test.com', name: 'Dr. Test' } } },
        { provide: AlertService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ClinicalEntryDialog);
    component = fixture.componentInstance;
    alertService = TestBed.inject(AlertService);
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('shows title for new entry', () => {
    component.setPatientId('p1');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Nueva entrada');
  });

  it('shows title for editing', () => {
    component.setRecord({
      id: 'r1',
      patientId: 'p1',
      date: '2026-07-01',
      headCircumference: 45,
      weight: 12,
      height: 90,
      bmi: 14.8,
      saturation: 98,
      temperature: 36.5,
      motivoConsulta: 'Dolor de cabeza',
      diagnosis: 'Migraña',
    } as any);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Editar datos de la consulta');
  });

  it('sets patient id and age', () => {
    component.setPatientId('p1');
    component.setAge('3 años');
    expect((component as any).patientId).toBe('p1');
    expect((component as any).ageDisplay).toBe('3 años');
  });

  it('pre-fills form values from record', () => {
    component.setRecord({
      id: 'r1',
      patientId: 'p1',
      date: '2026-07-01',
      headCircumference: 45,
      weight: 12.5,
      height: 90,
      bmi: 15.4,
      saturation: 98,
      temperature: 36.5,
      motivoConsulta: 'Dolor abdominal',
      diagnosis: 'Gastritis',
      notas: 'Reposo',
      recommendations: 'Tomar agua',
      visibleUntil: '2026-08-01',
      prescription: 'Paracetamol',
      visibleUntilRx: '2026-08-01',
    } as any);

    expect((component as any).step1Form.get('headCircumference')?.value).toBe('45');
    expect((component as any).step1Form.get('weight')?.value).toBe('12.5');
    expect((component as any).step1Form.get('height')?.value).toBe('90');
    expect((component as any).step1Form.get('diagnosis')?.value).toBe('Gastritis');
    expect((component as any).step2Form.get('recommendations')?.value).toBe('Tomar agua');
    expect((component as any).step3Form.get('prescription')?.value).toBe('Paracetamol');
  });

  it('creates record on save', async () => {
    const repo = TestBed.inject(ClinicalRecordRepository);
    (repo.create as any).mockResolvedValue(undefined);

    component.setPatientId('p1');
    (component as any).step1Form.patchValue({
      headCircumference: '45',
      weight: '12',
      height: '90',
      saturation: '98',
      temperature: '36.5',
      motivoConsulta: 'Dolor',
      diagnosis: 'Gastritis',
    });
    (component as any).step3Form.patchValue({
      visibleUntilRx: '2026-08-01',
    });
    fixture.detectChanges();

    await component.save();

    expect(repo.create).toHaveBeenCalled();
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('shows error when save fails', async () => {
    const repo = TestBed.inject(ClinicalRecordRepository);
    (repo.create as any).mockRejectedValue(new Error('DB error'));

    component.setPatientId('p1');
    (component as any).step1Form.patchValue({
      headCircumference: '45',
      weight: '12',
      height: '90',
      saturation: '98',
      temperature: '36.5',
      motivoConsulta: 'Dolor',
      diagnosis: 'Gastritis',
    });
    (component as any).step3Form.patchValue({
      visibleUntilRx: '2026-08-01',
    });
    fixture.detectChanges();

    await component.save();

    expect(alertService.error).toHaveBeenCalled();
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('calculates BMI from weight and height', () => {
    (component as any).step1Form.patchValue({ weight: '12', height: '90' });
    (component as any).calcBMI();
    const bmi = parseFloat((component as any).step1Form.get('bmi')?.value ?? '0');
    expect(bmi).toBeCloseTo(14.81, 1);
  });
});
