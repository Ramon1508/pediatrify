import { TestBed } from '@angular/core/testing';
import { UserRepository } from './user.repository';
import { of } from 'rxjs';
import { ClinicGatewayService } from '../services/clinic-gateway.service';
import { FirebaseService } from '../firebase/firebase.service';

const listener = vi.hoisted(() => ({ onSnapshot: vi.fn(), unsubscribe: vi.fn() }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, collection: string, id: string) => ({ collection, id }),
  onSnapshot: listener.onSnapshot,
  collection: vi.fn(), query: vi.fn(), where: vi.fn(), getDoc: vi.fn(), getDocs: vi.fn(),
  setDoc: vi.fn(), updateDoc: vi.fn(), deleteDoc: vi.fn(), serverTimestamp: vi.fn(),
}));

describe('UserRepository association listener', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [UserRepository, { provide: FirebaseService, useValue: { firestore: {} } },
        { provide: ClinicGatewayService, useValue: { principal: () => ({ role: 'assistant', userId: 'assistant', doctorId: 'doctor-test' }), scope$: of({ role: 'assistant', userId: 'assistant', doctorId: 'doctor-test' }) } }],
    });
  });

  it('uses the document identity instead of a missing or conflicting stored UID', () => {
    listener.onSnapshot.mockImplementationOnce((_ref, next) => {
      next({ id: 'doctor-test', exists: () => true, data: () => ({ uid: 'wrong-stored-uid', role: 'doctor' }) });
      return listener.unsubscribe;
    });
    const next = vi.fn();
    const sub = TestBed.inject(UserRepository).watchUser('doctor-test').subscribe(next);
    expect(next).toHaveBeenCalledWith({ uid: 'doctor-test', role: 'doctor' });
    sub.unsubscribe();
    expect(listener.unsubscribe).toHaveBeenCalledOnce();
  });

  it('emits null when the associated profile no longer exists', () => {
    listener.onSnapshot.mockImplementationOnce((_ref, next) => {
      next({ exists: () => false });
      return listener.unsubscribe;
    });
    const next = vi.fn();
    const sub = TestBed.inject(UserRepository).watchUser('doctor-test').subscribe(next);
    expect(next).toHaveBeenCalledWith(null);
    sub.unsubscribe();
  });

  it('reports denied/failed listeners to the calendar and releases them', () => {
    const failure = new Error('Synthetic listener failure');
    listener.onSnapshot.mockImplementationOnce((_ref, _next, error) => {
      error(failure);
      return listener.unsubscribe;
    });
    const error = vi.fn();
    TestBed.inject(UserRepository).watchUser('doctor-test').subscribe({ error });
    expect(error).toHaveBeenCalledWith(failure);
    expect(listener.unsubscribe).toHaveBeenCalledOnce();
  });
});
