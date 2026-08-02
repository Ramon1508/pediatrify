import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Login } from './login';
import { AuthService } from '../../core/services/auth.service';
import { FirebaseService } from '../../core/firebase/firebase.service';
import { AlertService } from '../../core/services/alert.service';
import { MatDialog } from '@angular/material/dialog';

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn().mockReturnValue({}),
  signInWithEmailAndPassword: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));

describe('Login', () => {
  let fixture: ComponentFixture<Login>;
  let component: Login;
  let authService: AuthService;
  let alertService: AlertService;
  let router: Router;

  beforeEach(async () => {
    const authSpy = {
      loginDoctor: vi.fn(),
    } as any;
    Object.defineProperty(authSpy, 'currentDoctor', { get: () => null, configurable: true });
    const alertSpy = { success: vi.fn(), error: vi.fn() } as any;
    const routerSpy = { navigate: vi.fn(), events: of() } as any;
    const firebaseSpy = {} as any;
    Object.defineProperty(firebaseSpy, 'auth', { get: () => ({}) });

    await TestBed.configureTestingModule({
      imports: [Login, NoopAnimationsModule],
      providers: [
        { provide: AuthService, useValue: authSpy },
        { provide: AlertService, useValue: alertSpy },
        { provide: Router, useValue: routerSpy },
        { provide: FirebaseService, useValue: firebaseSpy },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: { queryParams: of({}) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthService);
    alertService = TestBed.inject(AlertService);
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('has an invalid form when empty', () => {
    expect((component as any).loginForm.invalid).toBe(true);
  });

  it('validates email field', () => {
    const email = (component as any).loginForm.get('email')!;
    expect(email.valid).toBe(false);

    email.setValue('not-an-email');
    expect(email.hasError('email')).toBe(true);

    email.setValue('test@example.com');
    expect(email.valid).toBe(true);
  });

  it('validates password field', () => {
    const password = (component as any).loginForm.get('password')!;
    expect(password.valid).toBe(false);

    password.setValue('somepass');
    expect(password.valid).toBe(true);
  });

  it('does not call loginDoctor when form is invalid', async () => {
    await (component as any).onSubmit();
    expect(authService.loginDoctor).not.toHaveBeenCalled();
  });

  it('calls loginDoctor with credentials when form is valid', async () => {
    (component as any).loginForm.setValue({ email: 'doc@test.com', password: '123456' });
    (authService.loginDoctor as any).mockRejectedValue({ code: 'auth/invalid-credential' });

    await (component as any).onSubmit();

    expect(authService.loginDoctor).toHaveBeenCalledWith('doc@test.com', '123456');
  });

  it('navigates to /app/calendar on successful login with complete profile', async () => {
    (component as any).loginForm.setValue({ email: 'doc@test.com', password: '123456' });
    (authService.loginDoctor as any).mockResolvedValue({} as any);
    Object.defineProperty(authService, 'currentDoctor', {
      get: () => ({ profileComplete: true, role: 'doctor' }) as any,
      configurable: true,
    });

    await (component as any).onSubmit();

    expect(router.navigate).toHaveBeenCalledWith(['/app/calendar']);
  });

  it('navigates to /app/doctors for admin on successful login', async () => {
    (component as any).loginForm.setValue({ email: 'admin@test.com', password: '123456' });
    (authService.loginDoctor as any).mockResolvedValue({} as any);
    Object.defineProperty(authService, 'currentDoctor', {
      get: () => ({ profileComplete: true, role: 'admin' }) as any,
      configurable: true,
    });

    await (component as any).onSubmit();

    expect(router.navigate).toHaveBeenCalledWith(['/app/doctors']);
  });

  it('shows error on auth failure', async () => {
    (component as any).loginForm.setValue({ email: 'doc@test.com', password: 'wrong' });
    (authService.loginDoctor as any).mockRejectedValue({ code: 'auth/invalid-credential' });

    await (component as any).onSubmit();

    expect(alertService.error).toHaveBeenCalledWith({ message: 'Correo o contraseña incorrectos', duration: 5000 });
  });

  it('shows generic error for unknown error codes', async () => {
    (component as any).loginForm.setValue({ email: 'doc@test.com', password: 'wrong' });
    (authService.loginDoctor as any).mockRejectedValue({ code: 'auth/too-many-requests', message: 'Too many' });

    await (component as any).onSubmit();

    expect(alertService.error).toHaveBeenCalledWith({ message: 'Too many', duration: 5000 });
  });

  it('uses registered query param to show success alert', () => {
    TestBed.resetTestingModule();

    const alertSpy2 = { success: vi.fn() } as any;

    TestBed.configureTestingModule({
      imports: [Login, NoopAnimationsModule],
      providers: [
        { provide: AuthService, useValue: { loginDoctor: vi.fn() } as any },
        { provide: AlertService, useValue: alertSpy2 },
        { provide: Router, useValue: { navigate: vi.fn() } as any },
        { provide: FirebaseService, useValue: {} as any },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: { queryParams: of({ registered: 'true' }) },
        },
      ],
    }).compileComponents();

    const comp = TestBed.createComponent(Login).componentInstance;
    (comp as any).ngOnInit();

    expect(alertSpy2.success).toHaveBeenCalledWith({ message: 'Tu cuenta ha sido creada', duration: 5000 });
  });
});
