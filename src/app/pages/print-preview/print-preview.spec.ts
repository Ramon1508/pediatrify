import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, CanActivateFn, convertToParamMap, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { PrintPreview } from './print-preview';
import { routes } from '../../app.routes';
import { AuthService } from '../../core/services/auth.service';
import { ClinicalRecordRepository } from '../../core/repositories/clinical-record.repository';
import { PatientRepository } from '../../core/repositories/patient.repository';
import { PrintSettingsRepository } from '../../core/repositories/print-settings.repository';
import { UserRepository } from '../../core/repositories/user.repository';
import { FirebaseService } from '../../core/firebase/firebase.service';
import { DEFAULT_LOGO_URL } from '../../core/config/brand';
import { AppUser, Patient, SessionUser } from '../../core/models/user';
import { ClinicalRecord } from '../../core/models/clinical-record';
import { getDefaultSettings } from '../../core/models/print-settings';

describe('PrintPreview access', () => {
  const doctor: AppUser = {
    uid: 'doctor-test', name: 'Doctor de prueba', email: 'doctor@example.test', role: 'doctor',
  };
  const patient: Patient = {
    id: 'patient-test', doctorId: doctor.uid, name: 'Paciente', lastName: 'Sintético',
    birthDate: '2025-01-01', email: 'family@example.test', fatherName: '', motherName: '',
    phone: '', otpPassword: '',
  };
  const record: ClinicalRecord = {
    id: 'record-test', patientId: patient.id, date: '2026-10-01',
    motivoConsulta: 'Consulta sintética', recommendations: '<p>Recomendación de prueba</p>',
    prescription: '<p>Receta de prueba</p>', createdBy: doctor.email,
  };
  let session: BehaviorSubject<SessionUser>;
  let clinicalRepo: { get: ReturnType<typeof vi.fn> };
  let patientRepo: { getPatient: ReturnType<typeof vi.fn> };
  let printRepo: { getSettings: ReturnType<typeof vi.fn> };
  let userRepo: { getUser: ReturnType<typeof vi.fn>; getUserByEmail: ReturnType<typeof vi.fn> };
  let route: { snapshot: { paramMap: ReturnType<typeof convertToParamMap> } };
  let openWindow: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    session = new BehaviorSubject<SessionUser>({ type: 'doctor', user: doctor });
    clinicalRepo = { get: vi.fn().mockResolvedValue(record) };
    patientRepo = { getPatient: vi.fn().mockResolvedValue(patient) };
    printRepo = { getSettings: vi.fn().mockResolvedValue(getDefaultSettings()) };
    userRepo = {
      getUser: vi.fn().mockResolvedValue(doctor),
      getUserByEmail: vi.fn().mockResolvedValue(doctor),
    };
    route = { snapshot: { paramMap: convertToParamMap({ recordId: record.id }) } };
    const auth = {
      session$: session.asObservable(),
      get currentDoctor() { return session.value?.type === 'doctor' ? session.value.user : null; },
      get isAuthenticated() { return session.value !== null; },
      get isDoctor() { return session.value?.type === 'doctor'; },
      hasAnyRole: (roles: string[]) => session.value?.type === 'doctor' &&
        roles.includes(session.value.user.role),
    };
    TestBed.configureTestingModule({
      imports: [PrintPreview],
      providers: [
        { provide: ActivatedRoute, useValue: route },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: AuthService, useValue: auth },
        { provide: ClinicalRecordRepository, useValue: clinicalRepo },
        { provide: PatientRepository, useValue: patientRepo },
        { provide: PrintSettingsRepository, useValue: printRepo },
        { provide: UserRepository, useValue: userRepo },
        { provide: FirebaseService, useValue: { storage: {} } },
        { provide: DEFAULT_LOGO_URL, useValue: 'https://example.test/default-logo.svg' },
      ],
    });
    openWindow = vi.spyOn(window, 'open').mockReturnValue(null);
  });

  afterEach(() => vi.restoreAllMocks());

  function create() {
    const fixture = TestBed.createComponent(PrintPreview);
    // Access tests isolate layout measurements and the browser print dialog.
    const component = fixture.componentInstance as any;
    vi.spyOn(component, 'waitForPrintableLayout').mockResolvedValue(undefined);
    const paginate = vi.spyOn(component, 'paginateContent').mockImplementation(() => {
      component.pages.set([{ html: 'Contenido sintético' }]);
    });
    return { component, fixture, paginate };
  }

  const excluded: [string, SessionUser][] = [
    ['sin sesión', null],
    ['administrador', { type: 'doctor', user: { ...doctor, role: 'admin' } }],
    ['asistente', { type: 'doctor', user: { ...doctor, role: 'assistant' } }],
    ['paciente', { type: 'patient', patient }],
  ];

  it.each(excluded)('blocks the print route for %s', (_label, value) => {
    session.next(value);
    const guards = routes.find((r) => r.path === 'print/:recordId')!.canActivate!;
    const results = guards.map((guard) => TestBed.runInInjectionContext(() =>
      (guard as CanActivateFn)({} as any, {} as any)));
    expect(results).toContain(false);
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/login']);
    expect(clinicalRepo.get).not.toHaveBeenCalled();
  });

  it('allows a doctor through the role guards', () => {
    const guards = routes.find((r) => r.path === 'print/:recordId')!.canActivate!;
    for (const guard of guards) {
      expect(TestBed.runInInjectionContext(() =>
        (guard as CanActivateFn)({} as any, {} as any))).toBe(true);
    }
  });

  it.each(excluded)('does not fetch or publish data for %s even without route guards', async (_label, value) => {
    session.next(value);
    const { component, paginate } = create();
    await component.ngOnInit();
    expect(clinicalRepo.get).not.toHaveBeenCalled();
    expect(patientRepo.getPatient).not.toHaveBeenCalled();
    expect(component.record()).toBeNull();
    expect(component.canViewRecord()).toBe(false);
    expect(component.loading()).toBe(false);
    expect(paginate).not.toHaveBeenCalled();
    expect(openWindow).not.toHaveBeenCalled();
  });

  it('allows the owner to preview and print even after patient visibility expires', async () => {
    clinicalRepo.get.mockResolvedValue({ ...record, visibleUntil: '2020-01-01', visibleUntilRx: '2020-01-01' });
    const { component, paginate, fixture } = create();
    await component.ngOnInit();
    expect(component.canViewRecord()).toBe(true);
    expect(component.patient()).toEqual(patient);
    expect(component.consultationDate()).not.toBe('');
    expect(printRepo.getSettings).toHaveBeenCalledWith(doctor.uid);
    expect(paginate).toHaveBeenCalledOnce();
    component.printViaNewWindow();
    expect(openWindow).toHaveBeenCalledOnce();
    fixture.destroy();
  });

  it('honors "logo precargado" versus the doctor logo (P34)', async () => {
    session.next({ type: 'doctor', user: { ...doctor, logoPath: 'https://example.test/custom-logo.png' } });

    printRepo.getSettings.mockResolvedValue({ ...getDefaultSettings(), usePreloadedLogo: true });
    const preloaded = create();
    await preloaded.component.ngOnInit();
    expect(preloaded.component.logoUrl()).toBe('https://example.test/default-logo.svg');
    preloaded.fixture.destroy();

    printRepo.getSettings.mockResolvedValue({ ...getDefaultSettings(), usePreloadedLogo: false });
    const custom = create();
    await custom.component.ngOnInit();
    expect(custom.component.logoUrl()).toContain('https://example.test/custom-logo.png');
    custom.fixture.destroy();
  });

  it('computes the printed age at the consultation date, not today (P36)', async () => {
    patientRepo.getPatient.mockResolvedValue({ ...patient, birthDate: '2020-01-15' });
    clinicalRepo.get.mockResolvedValue({ ...record, date: '2022-01-15' });
    const { component } = create();
    await component.ngOnInit();
    expect(component.patientAge()).toBe('2 años');
    expect(component.consultationDate()).toBe('15/01/2022');
  });

  it('renders authorized signal values and removes the preview after a change of doctor', async () => {
    const { fixture, paginate } = create();
    fixture.detectChanges();
    await vi.waitFor(() => expect(paginate).toHaveBeenCalledOnce());
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.print-preview-pages')).not.toBeNull();
    expect(element.textContent).toContain('Paciente Sintético');
    expect(element.textContent).toContain('DOCTOR DE PRUEBA');
    session.next({ type: 'doctor', user: { ...doctor, uid: 'other-doctor' } });
    fixture.detectChanges();
    expect(element.querySelector('.print-preview-pages')).toBeNull();
    expect(element.textContent).not.toContain('Paciente Sintético');
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('no está disponible');
    fixture.destroy();
  });

  it.each(['other-doctor', undefined, ''])('denies patient ownership %s despite a matching record author', async (doctorId) => {
    patientRepo.getPatient.mockResolvedValue({ ...patient, doctorId });
    const { component, paginate } = create();
    await component.ngOnInit();
    expect(component.record()).toBeNull();
    expect(component.patient()).toBeNull();
    expect(component.canViewRecord()).toBe(false);
    expect(printRepo.getSettings).not.toHaveBeenCalled();
    expect(userRepo.getUser).not.toHaveBeenCalled();
    expect(userRepo.getUserByEmail).not.toHaveBeenCalled();
    expect(paginate).not.toHaveBeenCalled();
    component.printViaNewWindow();
    expect(openWindow).not.toHaveBeenCalled();
  });

  it.each(['missing-id', 'missing-record', 'missing-patient-id', 'missing-patient'])('finishes loading safely for %s', async (scenario) => {
    if (scenario === 'missing-id') route.snapshot.paramMap = convertToParamMap({});
    if (scenario === 'missing-record') clinicalRepo.get.mockResolvedValue(null);
    if (scenario === 'missing-patient-id') clinicalRepo.get.mockResolvedValue({ ...record, patientId: '' });
    if (scenario === 'missing-patient') patientRepo.getPatient.mockResolvedValue(null);
    const { component, paginate } = create();
    await component.ngOnInit();
    expect(component.loading()).toBe(false);
    expect(component.record()).toBeNull();
    expect(component.canViewRecord()).toBe(false);
    expect(paginate).not.toHaveBeenCalled();
  });

  it.each(['record', 'patient', 'settings'])('handles a failed %s read without publishing content', async (source) => {
    const failure = new Error('Synthetic permission failure');
    if (source === 'record') clinicalRepo.get.mockRejectedValue(failure);
    if (source === 'patient') patientRepo.getPatient.mockRejectedValue(failure);
    if (source === 'settings') printRepo.getSettings.mockRejectedValue(failure);
    const { component } = create();
    await component.ngOnInit();
    expect(component.loading()).toBe(false);
    expect(component.record()).toBeNull();
    expect(component.pages()).toEqual([]);
    expect(component.errorMessage()).toContain('Intenta abrirla nuevamente');
    expect(openWindow).not.toHaveBeenCalled();
  });

  it('rejects a session changed while data loads', async () => {
    patientRepo.getPatient.mockImplementation(async () => {
      session.next({ type: 'doctor', user: { ...doctor, uid: 'other-doctor' } });
      return patient;
    });
    const { component, paginate } = create();
    await component.ngOnInit();
    expect(component.record()).toBeNull();
    expect(component.canViewRecord()).toBe(false);
    expect(paginate).not.toHaveBeenCalled();
    expect(openWindow).not.toHaveBeenCalled();
  });

  it.each(excluded)('withdraws display and refuses printing when the session becomes %s', async (_label, value) => {
    const { component, fixture } = create();
    await component.ngOnInit();
    expect(component.canViewRecord()).toBe(true);
    session.next(value);
    expect(component.canViewRecord()).toBe(false);
    component.printViaNewWindow();
    expect(openWindow).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('cancels the automatic print when the preview is destroyed', async () => {
    vi.useFakeTimers();
    try {
      const { component, fixture } = create();
      await component.ngOnInit();
      fixture.destroy();
      vi.advanceTimersByTime(500);
      expect(openWindow).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
