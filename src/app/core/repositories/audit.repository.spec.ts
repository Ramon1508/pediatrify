import { TestBed } from '@angular/core/testing';
import { AuditRepository } from './audit.repository';
import { FirebaseService } from '../firebase/firebase.service';
import { onSnapshot } from 'firebase/firestore';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})), doc: vi.fn(), setDoc: vi.fn(), query: vi.fn(() => ({})),
  orderBy: vi.fn(), limit: vi.fn(), serverTimestamp: vi.fn(), onSnapshot: vi.fn(),
}));

describe('AuditRepository permission failures (P51)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({providers: [AuditRepository,
      {provide: FirebaseService, useValue: {firestore: {}}}]});
  });

  it('forwards a rejected snapshot to the UI and releases the listener', () => {
    let fail!: (error: Error) => void;
    const unsubscribe = vi.fn();
    vi.mocked(onSnapshot).mockImplementation((_query: any, _next: any, error: any) => {
      fail = error;
      return unsubscribe;
    });
    const error = vi.fn();
    TestBed.inject(AuditRepository).watchAll().subscribe({error});
    const denied = new Error('synthetic permission denied');
    fail(denied);
    expect(error).toHaveBeenCalledExactlyOnceWith(denied);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
