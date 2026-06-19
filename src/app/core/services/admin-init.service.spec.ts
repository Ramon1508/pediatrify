import { TestBed } from '@angular/core/testing';
import {
  getDoc,
  getDocs,
  updateDoc,
  runTransaction,
  Timestamp,
} from 'firebase/firestore';
import { FirebaseService } from '../firebase/firebase.service';
import { AdminInitService } from './admin-init.service';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, path) => ({ path })),
  query: vi.fn((ref, ...constraints) => ({ ref, constraints })),
  where: vi.fn((field, op, value) => ({ field, op, value })),
  doc: vi.fn((_db, path, id) => ({ path, id })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  updateDoc: vi.fn(),
  runTransaction: vi.fn(),
  Timestamp: {
    now: vi.fn(() => 'now'),
  },
}));

describe('AdminInitService', () => {
  const adminEmail = 'valenzuela_luna@hotmail.com';
  const seedUid = 'seed-admin-valenzuela-luna';

  function docSnap(exists: boolean, data: Record<string, unknown> = {}) {
    return {
      exists: () => exists,
      data: () => data,
    };
  }

  function querySnap(docs: { id: string; data: Record<string, unknown> }[]) {
    return {
      empty: docs.length === 0,
      docs: docs.map((d) => ({
        id: d.id,
        data: () => d.data,
      })),
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        AdminInitService,
        { provide: FirebaseService, useValue: { firestore: {} } },
      ],
    });
  });

  it('does not create another user when the seed admin document already exists', async () => {
    vi.mocked(getDoc).mockResolvedValue(docSnap(true, { email: adminEmail }) as any);

    const result = await TestBed.inject(AdminInitService).ensureAdminExists();

    expect(result).toBe('seed-exists');
    expect(getDocs).not.toHaveBeenCalled();
    expect(updateDoc).not.toHaveBeenCalled();
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it('does not create the seed when another admin already exists', async () => {
    vi.mocked(getDoc).mockResolvedValue(docSnap(false) as any);
    vi.mocked(getDocs)
      .mockResolvedValueOnce(querySnap([]) as any)
      .mockResolvedValueOnce(
        querySnap([{ id: 'existing-admin', data: { email: 'admin@test.com', role: 'admin' } }]) as any
      );

    const result = await TestBed.inject(AdminInitService).ensureAdminExists();

    expect(result).toBe('admin-exists');
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it('creates the initial admin with a deterministic uid', async () => {
    const transaction = {
      get: vi.fn().mockResolvedValue(docSnap(false)),
      set: vi.fn(),
    };

    vi.mocked(getDoc).mockResolvedValue(docSnap(false) as any);
    vi.mocked(getDocs)
      .mockResolvedValueOnce(querySnap([]) as any)
      .mockResolvedValueOnce(querySnap([]) as any);
    vi.mocked(runTransaction).mockImplementation(async (_db, callback: any) => {
      await callback(transaction);
    });

    const result = await TestBed.inject(AdminInitService).ensureAdminExists();

    expect(result).toBe('created');
    expect(transaction.set).toHaveBeenCalledWith(
      expect.objectContaining({ id: seedUid }),
      expect.objectContaining({
        uid: seedUid,
        email: adminEmail,
        role: 'admin',
        pending: true,
        createdAt: Timestamp.now(),
      })
    );
  });
});
