import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { Doctors } from './doctors';
import { UserRepository } from '../../core/repositories/user.repository';
import { AlertService } from '../../core/services/alert.service';
import { Clipboard } from '@angular/cdk/clipboard';
import { FirebaseService } from '../../core/firebase/firebase.service';

vi.mock('firebase/firestore', () => ({
  setDoc: vi.fn().mockResolvedValue(undefined),
  doc: vi.fn().mockReturnValue('doc-ref'),
  Timestamp: { now: () => ({ toMillis: () => 0 }) },
}));

describe('Doctors', () => {
  let fixture: ComponentFixture<Doctors>;
  let component: Doctors;
  let userRepo: UserRepository;
  let alertService: AlertService;

  const mockDoctors = [
    { uid: '1', name: 'Dr. A', email: 'a@test.com', role: 'admin', profileComplete: true },
    { uid: '2', name: 'Dr. B', email: 'b@test.com', role: 'employee', profileComplete: false },
  ] as any[];

  beforeEach(async () => {
    const userRepoSpy = {
      watchAllUsers: vi.fn().mockReturnValue(of(mockDoctors)),
      deleteUser: vi.fn(),
    } as any;
    const alertSpy = { success: vi.fn() } as any;
    const clipboardSpy = { copy: vi.fn() } as any;
    const firebaseSpy = {} as any;
    Object.defineProperty(firebaseSpy, 'firestore', { get: () => 'mocked-firestore' as any, configurable: true });

    await TestBed.configureTestingModule({
      imports: [Doctors, NoopAnimationsModule],
      providers: [
        { provide: UserRepository, useValue: userRepoSpy },
        { provide: AlertService, useValue: alertSpy },
        { provide: Clipboard, useValue: clipboardSpy },
        { provide: FirebaseService, useValue: firebaseSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Doctors);
    component = fixture.componentInstance;
    userRepo = TestBed.inject(UserRepository);
    alertService = TestBed.inject(AlertService);
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('renders a list of doctors', () => {
    const el = fixture.nativeElement;
    expect(el.textContent).toContain('Doctores');
    expect(el.textContent).toContain('Dr. A');
    expect(el.textContent).toContain('Dr. B');
  });

  it('shows doctor count', () => {
    expect((component as any).doctors().length).toBe(2);
  });

  it('opens dialog to invite a new doctor', () => {
    (component as any).openNewDoctor();
    expect((component as any).showDialog).toBe(true);
    expect((component as any).form.get('name').value).toBe('');
    expect((component as any).form.get('email').value).toBe('');
  });

  it('closes dialog', () => {
    (component as any).showDialog = true;
    (component as any).closeDialog();
    expect((component as any).showDialog).toBe(false);
  });

  it('saves a doctor (creates invitation)', async () => {
    (component as any).form.setValue({ name: 'Dr. C', email: 'c@test.com', role: 'employee' });
    await (component as any).saveDoctor();

    expect((component as any).invitationLink).toContain('/setup-profile?email=');
    expect(alertService.success).toHaveBeenCalled();
  });

  it('does not save without name or email', async () => {
    (component as any).form.setValue({ name: '', email: '', role: 'employee' });
    await (component as any).saveDoctor();

    expect((component as any).invitationLink).toBe('');
  });

  it('deletes a doctor', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    (userRepo.deleteUser as any).mockResolvedValue(undefined);

    await (component as any).deleteDoctor(mockDoctors[0]);

    expect(userRepo.deleteUser).toHaveBeenCalledWith('1');
    expect(alertService.success).toHaveBeenCalledWith({ message: 'Doctor eliminado', duration: 3000 });
  });

  it('does not delete if cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    await (component as any).deleteDoctor(mockDoctors[0]);

    expect(userRepo.deleteUser).not.toHaveBeenCalled();
  });
});
