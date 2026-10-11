import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { ClinicGatewayService } from '../services/clinic-gateway.service';
import { PatientRepository } from './patient.repository';
import { FirebaseService } from '../firebase/firebase.service';

const fixture = vi.hoisted(() => {
  const patients = [
    { id: 'own-child', doctorId: 'doctor-one', birthDate: '2025-01-01' },
    { id: 'other-child', doctorId: 'doctor-two', birthDate: '2025-01-02' },
    { id: 'legacy-child', birthDate: '2025-01-03' },
    { id: 'empty-owner', doctorId: '', birthDate: '2025-01-04' },
  ];
  const snapshot = (q: any) => ({
    docs: patients.filter((p: any) => q.constraints.every((condition: any) =>
      condition.operator === '==' && p[condition.field] === condition.value))
      .map((p) => ({ id: p.id, data: () => p })),
  });
  const unsubscribe = vi.fn();
  return {
    getDocs: vi.fn(async (q: any) => snapshot(q)),
    onSnapshot: vi.fn((q: any, next: any, _error: any) => {
      next(snapshot(q));
      return unsubscribe;
    }),
    unsubscribe,
  };
});

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, name: string) => ({ name }),
  query: (collection: unknown, ...constraints: unknown[]) => ({ collection, constraints }),
  where: (field: string, operator: string, value: unknown) => ({ field, operator, value }),
  getDocs: fixture.getDocs,
  onSnapshot: fixture.onSnapshot,
  doc: vi.fn(), getDoc: vi.fn(), setDoc: vi.fn(), updateDoc: vi.fn(), deleteDoc: vi.fn(),
  serverTimestamp: vi.fn(),
}));

describe('PatientRepository scoped reads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [PatientRepository, { provide: FirebaseService, useValue: { firestore: {} } },
        { provide: ClinicGatewayService, useValue: { principal: () => ({ role: 'doctor', doctorId: 'doctor-one' }), scope$: of({ role: 'doctor', doctorId: 'doctor-one' }) } }],
    });
  });

  it('queries only the requested doctor without including unrelated or unowned children', async () => {
    const repo = TestBed.inject(PatientRepository);
    expect((await repo.getPatientsByDoctor('doctor-one')).map((p) => p.id)).toEqual(['own-child']);
    expect(await repo.getPatientsByDoctor('doctor-two')).toEqual([]);
  });

  it('keeps the realtime query scoped and releases its listener', async () => {
    const patients = await firstValueFrom(TestBed.inject(PatientRepository).watchPatientsByDoctor('doctor-one'));
    expect(patients.map((p) => p.id)).toEqual(['own-child']);
    expect(fixture.unsubscribe).toHaveBeenCalledOnce();
  });

  it.each(['', '   '])('does not query unowned records for an empty doctor scope (%s)', async (doctorId) => {
    const repo = TestBed.inject(PatientRepository);
    expect(await repo.getPatientsByDoctor(doctorId)).toEqual([]);
    expect(await firstValueFrom(repo.watchPatientsByDoctor(doctorId))).toEqual([]);
    expect(fixture.getDocs).not.toHaveBeenCalled();
    expect(fixture.onSnapshot).not.toHaveBeenCalled();
  });

  it('propagates listener errors to the caller', () => {
    const failure = new Error('Synthetic denied read');
    fixture.onSnapshot.mockImplementationOnce((_query, _next, error) => {
      error(failure);
      return fixture.unsubscribe;
    });
    const onError = vi.fn();
    TestBed.inject(PatientRepository).watchPatientsByDoctor('doctor-one').subscribe({ error: onError });
    expect(onError).toHaveBeenCalledWith(failure);
    expect(fixture.unsubscribe).toHaveBeenCalledOnce();
  });
});
