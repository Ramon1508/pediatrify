import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, ActivatedRoute } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ResetPassword } from './reset-password';
import { FirebaseService } from '../../core/firebase/firebase.service';
import { AlertService } from '../../core/services/alert.service';

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn().mockReturnValue({}),
  sendPasswordResetEmail: vi.fn(),
  confirmPasswordReset: vi.fn(),
}));

describe('ResetPassword', () => {
  let fixture: ComponentFixture<ResetPassword>;
  let component: ResetPassword;
  let alertService: AlertService;
  let router: Router;

  beforeEach(async () => {
    const firebaseSpy = {} as any;
    Object.defineProperty(firebaseSpy, 'auth', { get: () => ({}) });
    const alertSpy = { success: vi.fn(), error: vi.fn() } as any;
    const routerSpy = { navigate: vi.fn() } as any;

    await TestBed.configureTestingModule({
      imports: [ResetPassword, NoopAnimationsModule],
      providers: [
        { provide: FirebaseService, useValue: firebaseSpy },
        { provide: AlertService, useValue: alertSpy },
        { provide: Router, useValue: routerSpy },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParams: {} } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ResetPassword);
    component = fixture.componentInstance;
    alertService = TestBed.inject(AlertService);
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('starts in request mode by default', () => {
    expect((component as any).mode()).toBe('request');
  });

  it('requestForm is invalid when empty', () => {
    expect((component as any).requestForm.invalid).toBe(true);
  });

  it('validates email field in requestForm', () => {
    const email = (component as any).requestForm.get('email')!;
    expect(email.valid).toBe(false);

    email.setValue('not-an-email');
    expect(email.hasError('email')).toBe(true);

    email.setValue('test@example.com');
    expect(email.valid).toBe(true);
  });

  it('does not call sendPasswordResetEmail when form is invalid', async () => {
    await (component as any).onRequestLink();
    expect((component as any).loading()).toBe(false);
  });

  it('calls sendPasswordResetEmail when form is valid', async () => {
    (component as any).requestForm.setValue({ email: 'doc@test.com' });

    const { sendPasswordResetEmail } = await import('firebase/auth');
    (sendPasswordResetEmail as any).mockResolvedValue(undefined);

    await (component as any).onRequestLink();

    expect(sendPasswordResetEmail).toHaveBeenCalledWith(
      (component as any).firebase.auth,
      'doc@test.com',
      { url: `${window.location.origin}/reset-password` }
    );
  });

  it('shows success alert on email sent', async () => {
    (component as any).requestForm.setValue({ email: 'doc@test.com' });
    const { sendPasswordResetEmail } = await import('firebase/auth');
    (sendPasswordResetEmail as any).mockResolvedValue(undefined);

    await (component as any).onRequestLink();

    expect(alertService.success).toHaveBeenCalledWith({ message: 'Correo de recuperación enviado. Revisa tu bandeja de entrada.', duration: 5000 });
  });

  it('shows error alert on user not found', async () => {
    (component as any).requestForm.setValue({ email: 'missing@test.com' });
    const { sendPasswordResetEmail } = await import('firebase/auth');
    (sendPasswordResetEmail as any).mockRejectedValue({ code: 'auth/user-not-found' });

    await (component as any).onRequestLink();

    expect(alertService.error).toHaveBeenCalledWith({ message: 'No se encontró una cuenta con este correo electrónico', duration: 5000 });
  });

  it('shows generic error on unknown error code', async () => {
    (component as any).requestForm.setValue({ email: 'doc@test.com' });
    const { sendPasswordResetEmail } = await import('firebase/auth');
    (sendPasswordResetEmail as any).mockRejectedValue({ code: 'auth/too-many-requests', message: 'Demasiados intentos' });

    await (component as any).onRequestLink();

    expect(alertService.error).toHaveBeenCalledWith({ message: 'Demasiados intentos', duration: 5000 });
  });

  it('resets form after successful email send', async () => {
    (component as any).requestForm.setValue({ email: 'doc@test.com' });
    const { sendPasswordResetEmail } = await import('firebase/auth');
    (sendPasswordResetEmail as any).mockResolvedValue(undefined);
    const resetSpy = vi.spyOn((component as any).requestForm, 'reset');

    await (component as any).onRequestLink();

    expect(resetSpy).toHaveBeenCalled();
  });

  describe('with oobCode', () => {
    beforeEach(async () => {
      TestBed.resetTestingModule();
      const firebaseSpy2 = {} as any;
      Object.defineProperty(firebaseSpy2, 'auth', { get: () => ({}) });
      const alertSpy2 = { success: vi.fn(), error: vi.fn() } as any;
      const routerSpy2 = { navigate: vi.fn() } as any;

      await TestBed.configureTestingModule({
        imports: [ResetPassword, NoopAnimationsModule],
        providers: [
          { provide: FirebaseService, useValue: firebaseSpy2 },
          { provide: AlertService, useValue: alertSpy2 },
          { provide: Router, useValue: routerSpy2 },
          {
            provide: ActivatedRoute,
            useValue: { snapshot: { queryParams: { oobCode: 'valid-code' } } },
          },
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(ResetPassword);
      component = fixture.componentInstance;
      router = TestBed.inject(Router);
      alertService = TestBed.inject(AlertService);
      fixture.detectChanges();
    });

    it('switches to reset mode when oobCode is valid', () => {
      expect((component as any).mode()).toBe('reset');
      expect((component as any).oobCode).toBe('valid-code');
    });

    it('resetForm is invalid when empty', () => {
      expect((component as any).resetForm.invalid).toBe(true);
    });

    it('validates newPassword field', () => {
      const pwd = (component as any).passwordControl;
      expect(pwd.valid).toBe(false);

      pwd.setValue('short');
      expect(pwd.hasError('minlength')).toBe(true);

      pwd.setValue('nouppercaseordigit1!');
      expect(pwd.hasError('pattern')).toBe(true);

      pwd.setValue('Valid1Pass!');
      expect(pwd.valid).toBe(true);
    });

    it('detects password mismatch', () => {
      (component as any).passwordControl.setValue('MyValid1Pass!');
      (component as any).confirmPasswordControl.setValue('DifferentPass1!');
      (component as any).confirmPasswordControl.updateValueAndValidity();

      expect((component as any).confirmPasswordControl.hasError('mismatch')).toBe(true);
    });

    it('calls confirmPasswordReset with oobCode and new password', async () => {
      (component as any).passwordControl.setValue('NewValid1Pass!');
      (component as any).confirmPasswordControl.setValue('NewValid1Pass!');

      const { confirmPasswordReset } = await import('firebase/auth');
      (confirmPasswordReset as any).mockResolvedValue(undefined);

      await (component as any).onResetPassword();

      expect(confirmPasswordReset).toHaveBeenCalledWith(
        (component as any).firebase.auth,
        'valid-code',
        'NewValid1Pass!'
      );
    });

    it('navigates to /login on success', async () => {
      (component as any).passwordControl.setValue('NewValid1Pass!');
      (component as any).confirmPasswordControl.setValue('NewValid1Pass!');

      const { confirmPasswordReset } = await import('firebase/auth');
      (confirmPasswordReset as any).mockResolvedValue(undefined);

      await (component as any).onResetPassword();

      expect(alertService.success).toHaveBeenCalledWith({ message: 'Contraseña restablecida correctamente. Inicia sesión con tu nueva contraseña.', duration: 5000 });
      expect(router.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('shows error on expired action code', async () => {
      (component as any).passwordControl.setValue('NewValid1Pass!');
      (component as any).confirmPasswordControl.setValue('NewValid1Pass!');

      const { confirmPasswordReset } = await import('firebase/auth');
      (confirmPasswordReset as any).mockRejectedValue({ code: 'auth/expired-action-code' });

      await (component as any).onResetPassword();

      expect(alertService.error).toHaveBeenCalledWith({ message: 'El enlace de recuperación ha expirado. Solicita uno nuevo.', duration: 5000 });
    });

    it('shows error on invalid action code', async () => {
      (component as any).passwordControl.setValue('NewValid1Pass!');
      (component as any).confirmPasswordControl.setValue('NewValid1Pass!');

      const { confirmPasswordReset } = await import('firebase/auth');
      (confirmPasswordReset as any).mockRejectedValue({ code: 'auth/invalid-action-code' });

      await (component as any).onResetPassword();

      expect(alertService.error).toHaveBeenCalledWith({ message: 'El enlace de recuperación no es válido. Solicita uno nuevo.', duration: 5000 });
    });
  });
});
