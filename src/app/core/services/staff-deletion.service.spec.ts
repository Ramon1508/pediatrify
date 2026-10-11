import { TestBed } from '@angular/core/testing';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { StaffDeletionService } from './staff-deletion.service';
import { FirebaseService } from '../firebase/firebase.service';

vi.mock('firebase/functions', () => ({ getFunctions: vi.fn(), httpsCallable: vi.fn() }));

describe('StaffDeletionService', () => {
  const app = {};
  const functions = {};
  const callable = Object.assign(vi.fn(), { stream: vi.fn() });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getFunctions).mockReturnValue(functions as ReturnType<typeof getFunctions>);
    vi.mocked(httpsCallable).mockReturnValue(callable);
    TestBed.configureTestingModule({ providers: [
      { provide: FirebaseService, useValue: { auth: { app } } },
    ] });
  });

  it('sends only a business ID through the authenticated callable', async () => {
    callable.mockResolvedValue({ data: { deleted: true } });
    await TestBed.inject(StaffDeletionService).deleteStaff('doctor-id');
    expect(getFunctions).toHaveBeenCalledWith(app, 'us-central1');
    expect(httpsCallable).toHaveBeenCalledWith(functions, 'deleteStaff', { timeout: 540_000 });
    expect(callable).toHaveBeenCalledWith({ userId: 'doctor-id' });
  });

  it('rejects an unconfirmed success response', async () => {
    callable.mockResolvedValue({ data: {} });
    await expect(TestBed.inject(StaffDeletionService).deleteStaff('doctor-id')).rejects.toThrow('Baja no confirmada');
  });

  it('propagates server rejection without a client deletion fallback', async () => {
    const failure = { code: 'functions/failed-precondition' };
    callable.mockRejectedValue(failure);
    await expect(TestBed.inject(StaffDeletionService).deleteStaff('doctor-id')).rejects.toBe(failure);
    expect(callable).toHaveBeenCalledTimes(1);
  });
});
