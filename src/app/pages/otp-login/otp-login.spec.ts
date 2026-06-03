import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { OtpLogin } from './otp-login';
import { AuthService } from '../../core/services/auth.service';

describe('OtpLogin', () => {
  let fixture: ComponentFixture<OtpLogin>;
  let component: OtpLogin;
  let authService: AuthService;
  let router: Router;

  beforeEach(async () => {
    const authSpy = { loginPatient: vi.fn() } as any;
    const routerSpy = { navigate: vi.fn() } as any;

    await TestBed.configureTestingModule({
      imports: [OtpLogin, NoopAnimationsModule],
      providers: [
        { provide: AuthService, useValue: authSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParams: {} } } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OtpLogin);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('renders title and form fields', () => {
    const el = fixture.nativeElement;
    expect(el.textContent).toContain('Lilcare');
    expect(el.textContent).toContain('Acceso paciente');
    expect(el.textContent).toContain('Correo electrónico');
    expect(el.textContent).toContain('Contraseña OTP');
  });

  it('has a link to /login', () => {
    const el = fixture.nativeElement;
    expect(el.textContent).toContain('Volver al inicio de sesión');
  });

  it('does not call loginPatient when email or password is empty', async () => {
    await (component as any).onSubmit();
    expect(authService.loginPatient).not.toHaveBeenCalled();
  });

  it('calls loginPatient with credentials', async () => {
    (component as any).form.setValue({ email: 'patient@test.com', password: 'ABC123' });
    (authService.loginPatient as any).mockResolvedValue({} as any);

    await (component as any).onSubmit();

    expect(authService.loginPatient).toHaveBeenCalledWith('patient@test.com', 'ABC123');
  });

  it('navigates to /otp-dashboard on success', async () => {
    (component as any).form.setValue({ email: 'patient@test.com', password: 'ABC123' });
    (authService.loginPatient as any).mockResolvedValue({} as any);

    await (component as any).onSubmit();

    expect(router.navigate).toHaveBeenCalledWith(['/otp-dashboard']);
  });

  it('shows error message on failure', async () => {
    (component as any).form.setValue({ email: 'patient@test.com', password: 'wrong' });
    (authService.loginPatient as any).mockRejectedValue(new Error('Credenciales inválidas'));

    await (component as any).onSubmit();

    expect((component as any).error).toBe('Credenciales inválidas');
  });

  it('uses submitted flag to show validation errors', () => {
    expect((component as any).submitted).toBe(false);

    (component as any).onSubmit();

    expect((component as any).submitted).toBe(true);
  });

  it('resets loading state after error', async () => {
    (component as any).form.setValue({ email: 'patient@test.com', password: 'wrong' });
    (authService.loginPatient as any).mockRejectedValue(new Error('fail'));

    await (component as any).onSubmit();

    expect((component as any).loading).toBe(false);
  });
});
