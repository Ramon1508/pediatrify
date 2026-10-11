import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDialogRef } from '@angular/material/dialog';
import { ClinicalEntryDialog } from './clinical-entry-dialog';
import { ClinicalRecordRepository } from '../../../../core/repositories/clinical-record.repository';
import { AuthService } from '../../../../core/services/auth.service';
import { AlertService } from '../../../../core/services/alert.service';
import { ClinicClockService } from '../../../../core/services/clinic-clock.service';

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

  it.each(['save', 'saveAndPrint'] as const)('uses the clinic date for a new record through %s (P28)', async action => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const clock = TestBed.inject(ClinicClockService);
    const popup = { location: { href: '' }, focus: vi.fn(), close: vi.fn() };
    const open = vi.spyOn(window, 'open').mockReturnValue(popup as any);
    try {
      vi.setSystemTime(new Date('2026-10-10T05:30:00Z'));
      clock.refresh();
      component.setPatientId('synthetic-child');
      (component as any).step3Form.patchValue({ visibleUntilRx: new Date(2026, 9, 9) });
      fixture.detectChanges();
      expect((component as any).entryDateLabel()).toBe('09/10/2026');
      expect((component as any).noPastDates()(new Date(2026, 9, 9))).toBe(true);
      expect((component as any).noPastDates()(new Date(2026, 9, 8))).toBe(false);
      await component[action]();
      expect(TestBed.inject(ClinicalRecordRepository).create).toHaveBeenCalledWith(expect.any(String),
        expect.objectContaining({ date: '2026-10-09', visibleUntilRx: '2026-10-09', patientId: 'synthetic-child' }));
    } finally {
      open.mockRestore();
      vi.useRealTimers();
      clock.refresh();
    }
  });

  it('updates a new entry date at clinic midnight but keeps an existing record date (P28)', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const clock = TestBed.inject(ClinicClockService);
    try {
      vi.setSystemTime(new Date('2026-10-10T05:59:00Z'));
      clock.refresh();
      expect((component as any).entryDateLabel()).toBe('09/10/2026');
      vi.setSystemTime(new Date('2026-10-10T06:00:00Z'));
      clock.refresh();
      expect((component as any).entryDateLabel()).toBe('10/10/2026');
      expect((component as any).noPastDates()(new Date(2026, 9, 9))).toBe(false);
      component.setRecord({ id: 'synthetic-record', patientId: 'synthetic-child', date: '2026-07-01',
        createdBy: 'doctor@example.test', motivoConsulta: 'Ejemplo sintético' });
      expect((component as any).entryDateLabel()).toBe('01/07/2026');
      expect((component as any).noPastDates()(new Date(2026, 9, 9))).toBe(true);
    } finally {
      vi.useRealTimers();
      clock.refresh();
    }
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
    expect((component as any).ageDisplay()).toBe('3 años');
  });

  it('revalidates a rendered datepicker after clinic midnight (P52)', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const clock = TestBed.inject(ClinicClockService);
    try {
      vi.setSystemTime(new Date('2026-10-10T05:59:00Z'));
      clock.refresh();
      const state = component as any;
      state.step.set(3);
      fixture.detectChanges();
      state.step3Form.controls.visibleUntilRx.setValue(new Date(2026, 9, 9));
      fixture.detectChanges();
      expect(state.step3Form.controls.visibleUntilRx.valid).toBe(true);
      vi.setSystemTime(new Date('2026-10-10T06:00:00Z'));
      clock.refresh();
      fixture.detectChanges();
      expect(state.step3Form.controls.visibleUntilRx.hasError('matDatepickerFilter')).toBe(true);
    } finally {
      vi.useRealTimers();
      clock.refresh();
    }
  });

  it.each(['save', 'saveAndPrint'] as const)('rechecks expiry before %s, even before a render after midnight (P52)', async (action) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const clock = TestBed.inject(ClinicClockService);
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    try {
      vi.setSystemTime(new Date('2026-10-10T05:59:00Z'));
      clock.refresh();
      component.setPatientId('synthetic-child');
      (component as any).step2Form.patchValue({ visibleUntil: new Date(2026, 9, 9) });
      (component as any).step3Form.patchValue({ visibleUntilRx: new Date(2026, 9, 9) });
      vi.setSystemTime(new Date('2026-10-10T06:00:00Z'));
      await component[action]();
      expect(TestBed.inject(ClinicalRecordRepository).create).not.toHaveBeenCalled();
      expect(open).not.toHaveBeenCalled();
      expect(alertService.error).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Selecciona una fecha límite de visualización de hoy o posterior.',
      }));
      expect((component as any).step2Form.controls.visibleUntil.hasError('matDatepickerFilter')).toBe(true);
      expect((component as any).step3Form.controls.visibleUntilRx.hasError('matDatepickerFilter')).toBe(true);
    } finally {
      open.mockRestore();
      vi.useRealTimers();
      clock.refresh();
    }
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
      visibleUntilRx: '2030-08-01',
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

  it('offers only Guardar e imprimir for a new entry, never save-without-print (P30)', () => {
    component.setPatientId('p1');
    (component as any).step.set(3);
    fixture.detectChanges();
    const buttons = [...fixture.nativeElement.querySelectorAll('mat-dialog-actions button')] as HTMLButtonElement[];
    const labels = buttons.map((b) => b.textContent?.trim());
    expect(labels).toContain('Guardar e imprimir');
    expect(labels).not.toContain('Guardar');
  });

  it('does not save a new entry when the print popup is blocked, and shows an alert (P30)', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    try {
      component.setPatientId('p1');
      (component as any).step3Form.patchValue({ prescription: '<p>Receta sintética</p>', visibleUntilRx: '2030-08-01' });
      fixture.detectChanges();
      await component.saveAndPrint();
      expect(alertService.error).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Permite ventanas emergentes para imprimir' }));
      expect(TestBed.inject(ClinicalRecordRepository).create).not.toHaveBeenCalled();
      expect(dialogRef.close).not.toHaveBeenCalled();
    } finally {
      open.mockRestore();
    }
  });

  it('rejects zero measures while keeping positive values valid (P31)', () => {
    component.setPatientId('p1');
    const step1 = (component as any).step1Form;
    step1.patchValue({ headCircumference: '0', weight: '0', height: '0', saturation: '0', temperature: '0' });
    ['headCircumference', 'weight', 'height', 'saturation', 'temperature'].forEach((field) => {
      expect(step1.get(field)?.hasError('greaterThanZero')).toBe(true);
    });
    step1.patchValue({ headCircumference: '45', weight: '12', height: '90', saturation: '98', temperature: '36.5' });
    ['headCircumference', 'weight', 'height', 'saturation', 'temperature'].forEach((field) => {
      expect(step1.get(field)?.hasError('greaterThanZero')).toBe(false);
      expect(step1.get(field)?.hasError('pattern')).toBe(false);
    });
  });

  it('calculates BMI from weight and height', () => {
    (component as any).step1Form.patchValue({ weight: '12', height: '90' });
    (component as any).calcBMI();
    const bmi = parseFloat((component as any).step1Form.get('bmi')?.value ?? '0');
    expect(bmi).toBeCloseTo(14.81, 1);
  });
});
