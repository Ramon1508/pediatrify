import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { PatientHistoryView } from './patient-history-view';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { ClinicClockService } from '../../core/services/clinic-clock.service';
import { PatientRepository } from '../../core/repositories/patient.repository';
import { ClinicalRecordRepository } from '../../core/repositories/clinical-record.repository';

describe('PatientHistoryView clinic validity (P28)', () => {
  let fixture: ComponentFixture<PatientHistoryView>;
  const child = { id: 'synthetic-child', doctorId: 'synthetic-doctor', name: 'Paciente sintético',
    lastName: 'Ejemplo', email: 'family@example.test', birthDate: '2020-01-15' };
  const record = { id: 'synthetic-record', patientId: child.id, date: '2026-10-09',
    recommendations: '<p>Recomendación sintética</p>', prescription: '<p>Receta sintética</p>',
    visibleUntil: '2026-10-09', visibleUntilRx: '2026-10-10' };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-10T05:59:00Z'));
    await TestBed.configureTestingModule({
      imports: [PatientHistoryView, NoopAnimationsModule],
      providers: [provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => child.id } } } },
        { provide: AuthService, useValue: { currentPatient: child } },
        { provide: AlertService, useValue: { error: vi.fn() } },
        { provide: PatientRepository, useValue: { getChildrenGroup: vi.fn().mockResolvedValue([child]),
          getPatient: vi.fn().mockResolvedValue(child) } },
        { provide: ClinicalRecordRepository, useValue: { getByPatient: vi.fn().mockResolvedValue([record]) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PatientHistoryView);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  async function render() {
    await (fixture.componentInstance as any).ngOnInit();
    fixture.detectChanges();
  }

  it('shows a document through its clinic expiry day and updates an open view at clinic midnight', async () => {
    const component = fixture.componentInstance as any;
    await render();
    expect(component.hasRecommendations()).toBe(true);
    expect(component.hasPrescription()).toBe(true);
    expect(component.recommendationRecord().id).toBe(record.id);
    expect(component.prescriptionRecord().id).toBe(record.id);
    vi.setSystemTime(new Date('2026-10-10T06:00:00Z'));
    TestBed.inject(ClinicClockService).refresh();
    fixture.detectChanges();
    expect(component.hasRecommendations()).toBe(false);
    expect(component.hasPrescription()).toBe(true);
    expect(fixture.nativeElement.querySelectorAll('[role="tab"]')).toHaveLength(1);
    vi.setSystemTime(new Date('2026-10-11T06:00:00Z'));
    TestBed.inject(ClinicClockService).refresh();
    fixture.detectChanges();
    expect(component.hasConsultable()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Por el momento no cuentas con recomendaciones o recetas por consultar.');
  });

  it('keeps documents without an expiry visible across a clinic day change', async () => {
    vi.mocked(TestBed.inject(ClinicalRecordRepository).getByPatient).mockResolvedValue([
      { ...record, visibleUntil: '', visibleUntilRx: '' } as any,
    ]);
    const component = fixture.componentInstance as any;
    await render();
    vi.setSystemTime(new Date('2026-10-11T06:00:00Z'));
    TestBed.inject(ClinicClockService).refresh();
    expect(component.hasRecommendations()).toBe(true);
    expect(component.hasPrescription()).toBe(true);
  });

  it('shows an error state with retry when loading fails (P42)', async () => {
    vi.mocked(TestBed.inject(ClinicalRecordRepository).getByPatient).mockRejectedValue(new Error('fail'));
    const component = fixture.componentInstance as any;
    await render();
    expect(component.error()).toBe(true);
    expect(component.loading()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('No fue posible cargar el historial.');

    vi.mocked(TestBed.inject(ClinicalRecordRepository).getByPatient).mockResolvedValue([record] as any);
    await component.load();
    fixture.detectChanges();
    expect(component.error()).toBe(false);
    expect(component.patient()?.id).toBe(child.id);
  });

  it('alerts when the print popup is blocked (P43)', async () => {
    const component = fixture.componentInstance as any;
    await render();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    component.print('recommendations');
    expect(TestBed.inject(AlertService).error).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Permite ventanas emergentes para imprimir' }));
    open.mockRestore();
  });

  it('shows the most recent valid document per type instead of one global consultation (P29)', async () => {
    const older = { id: 'older', patientId: child.id, date: '2026-10-01',
      recommendations: '', prescription: '<p>Receta vigente anterior</p>',
      visibleUntil: '', visibleUntilRx: '2026-12-31' };
    const newer = { id: 'newer', patientId: child.id, date: '2026-10-08',
      recommendations: '<p>Recomendación nueva</p>', prescription: '',
      visibleUntil: '2026-12-31', visibleUntilRx: '' };
    vi.mocked(TestBed.inject(ClinicalRecordRepository).getByPatient).mockResolvedValue([older, newer] as any);
    const component = fixture.componentInstance as any;
    await render();
    expect(component.recommendationRecord().id).toBe('newer');
    expect(component.prescriptionRecord().id).toBe('older');
    expect(fixture.nativeElement.querySelectorAll('[role="tab"]')).toHaveLength(2);
    expect(fixture.nativeElement.textContent).toContain('Recomendación nueva');
    expect(component.prescriptionRecord().prescription).toContain('Receta vigente anterior');
  });

  it('falls back to an older document of the same type when the newest expires (P29)', async () => {
    const older = { id: 'older', patientId: child.id, date: '2026-10-01',
      recommendations: '<p>Recomendación anterior</p>', prescription: '',
      visibleUntil: '2026-12-31', visibleUntilRx: '' };
    const newer = { id: 'newer', patientId: child.id, date: '2026-10-08',
      recommendations: '<p>Recomendación nueva</p>', prescription: '',
      visibleUntil: '2026-10-09', visibleUntilRx: '' };
    vi.mocked(TestBed.inject(ClinicalRecordRepository).getByPatient).mockResolvedValue([older, newer] as any);
    const component = fixture.componentInstance as any;
    await render();
    expect(component.recommendationRecord().id).toBe('newer');
    vi.setSystemTime(new Date('2026-10-10T06:00:00Z'));
    TestBed.inject(ClinicClockService).refresh();
    fixture.detectChanges();
    expect(component.recommendationRecord().id).toBe('older');
    expect(fixture.nativeElement.textContent).toContain('Recomendación anterior');
  });

  it('keeps both active same-day documents accessible, newest creation first, regardless of editing (P48)', async () => {
    const older = { ...record, id: 'a-older', createdAt: { seconds: 1_790_000_000, nanoseconds: 100 },
      updatedAt: { seconds: 1_790_100_000, nanoseconds: 0 },
      recommendations: '<p>Primera recomendación vigente</p>', prescription: '<p>Primera receta vigente</p>' };
    const newer = { ...record, id: 'z-newer', createdAt: { seconds: 1_790_000_000, nanoseconds: 200 },
      recommendations: '<p>Segunda recomendación vigente</p>', prescription: '<p>Segunda receta vigente</p>' };
    const component = fixture.componentInstance as any;
    await component.ngOnInit();
    for (const response of [[older, newer], [newer, older]]) {
      vi.mocked(TestBed.inject(ClinicalRecordRepository).getByPatient).mockResolvedValue(response as any);
      await component.load();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(component.recommendationRecords().map((r: any) => r.id)).toEqual(['z-newer', 'a-older']);
      expect(component.prescriptionRecords().map((r: any) => r.id)).toEqual(['z-newer', 'a-older']);
      const entries = [...fixture.nativeElement.querySelectorAll('article.entry')];
      expect(entries).toHaveLength(2);
      expect(entries[0].textContent).toContain('Segunda recomendación vigente');
      expect(entries[1].textContent).toContain('Primera recomendación vigente');
      expect(entries[1].querySelector('button')).toBeTruthy();
    }
  });

  it('prints the selected older active document, not the first document (P48)', async () => {
    vi.mocked(TestBed.inject(ClinicalRecordRepository).getByPatient).mockResolvedValue([
      { ...record, id: 'newer', createdAt: { seconds: 2, nanoseconds: 0 }, prescription: '<p>Receta nueva</p>' },
      { ...record, id: 'older', createdAt: { seconds: 1, nanoseconds: 0 }, prescription: '<p>Receta anterior</p>' },
    ] as any);
    await render();
    const write = vi.fn();
    const popup = { document: { write, close: vi.fn() }, focus: vi.fn(), print: vi.fn() };
    const open = vi.spyOn(window, 'open').mockReturnValue(popup as any);
    const timer = vi.spyOn(globalThis, 'setTimeout').mockImplementation(() => 0 as any);
    try {
      (fixture.componentInstance as any).print('prescription', 'older');
      expect(write).toHaveBeenCalledWith(expect.stringContaining('Receta anterior'));
      expect(write.mock.calls[0][0]).not.toContain('Receta nueva');
    } finally {
      timer.mockRestore();
      open.mockRestore();
    }
  });

  it('removes expired documents independently and refuses printing expired or unknown IDs (P48)', async () => {
    vi.mocked(TestBed.inject(ClinicalRecordRepository).getByPatient).mockResolvedValue([
      { ...record, id: 'expires-today' },
      { ...record, id: 'continues', visibleUntil: '2026-12-31', visibleUntilRx: '2026-12-31' },
    ] as any);
    await render();
    const component = fixture.componentInstance as any;
    expect(component.recommendationRecords()).toHaveLength(2);
    vi.setSystemTime(new Date('2026-10-10T06:00:00Z'));
    TestBed.inject(ClinicClockService).refresh();
    fixture.detectChanges();
    expect(component.recommendationRecords().map((r: any) => r.id)).toEqual(['continues']);
    expect(component.prescriptionRecords()).toHaveLength(2);
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    try {
      component.print('recommendations', 'expires-today');
      component.print('prescription', 'unknown');
      expect(open).not.toHaveBeenCalled();
    } finally {
      open.mockRestore();
    }
  });

  it('does not load documents for a child outside the logged-in family (P48)', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    vi.mocked(TestBed.inject(PatientRepository).getChildrenGroup).mockResolvedValue([]);
    await render();
    expect(TestBed.inject(ClinicalRecordRepository).getByPatient).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/paciente/pacientes']);
  });
});
