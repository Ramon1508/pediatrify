import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, ActivatedRoute } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { SetupProfile } from './setup-profile';
import { AuthService } from '../../core/services/auth.service';
import { InvitationRepository } from '../../core/repositories/invitation.repository';
import { AlertService } from '../../core/services/alert.service';
import { MatDialog } from '@angular/material/dialog';
import { Sexo } from '../../core/models/sexo';

describe('SetupProfile', () => {
  let fixture: ComponentFixture<SetupProfile>;
  let component: SetupProfile;
  let authService: AuthService;
  let alertService: AlertService;
  let router: Router;

  beforeEach(async () => {
    const authSpy = {
      registerFromInvitation: vi.fn(),
      completeProfile: vi.fn(),
    } as any;
    Object.defineProperty(authSpy, 'currentDoctor', { get: () => null });
    Object.defineProperty(authSpy, 'isDoctor', { get: () => false });
    const alertSpy = { success: vi.fn(), error: vi.fn() } as any;
    const routerSpy = { navigate: vi.fn() } as any;
    const invitationSpy = { findPendingUserByEmail: vi.fn() } as any;

    await TestBed.configureTestingModule({
      imports: [SetupProfile, NoopAnimationsModule],
      providers: [
        { provide: AuthService, useValue: authSpy },
        { provide: AlertService, useValue: alertSpy },
        { provide: Router, useValue: routerSpy },
        { provide: InvitationRepository, useValue: invitationSpy },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParams: {} },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SetupProfile);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthService);
    alertService = TestBed.inject(AlertService);
    router = TestBed.inject(Router);
    fixture.detectChanges();
    (component as any).mode.set('existing');
    (component as any).displayEmail = 'doc@test.com';
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('renders form fields', () => {
    const el = fixture.nativeElement;
    expect(el.textContent).toContain('Registro');
    expect(el.textContent).toContain('Sexo');
    expect(el.textContent).toContain('Teléfono');
    expect(el.textContent).toContain('Cédula profesional');
    expect(el.textContent).toContain('Consultorio(s)');
  });

  describe('form validation', () => {
    it('is invalid when required fields are empty', () => {
      expect((component as any).form.invalid).toBe(true);
    });

    it('is valid when all required fields are filled', () => {
      (component as any).form.setValue({
        sexo: Sexo.Masculino,
        phone: '5512345678',
        especialidad: '',
        cedula: '12345678',
        cedulaEspecialidad: '',
        consultorios: 'Consultorio 1',
        password: 'Pass1234!',
        confirmPassword: 'Pass1234!',
      });
      expect((component as any).form.valid).toBe(true);
    });

    it('validates phone pattern (10 digits)', () => {
      const phone = (component as any).form.get('phone')!;
      phone.setValue('12345');
      expect(phone.hasError('pattern')).toBe(true);

      phone.setValue('5512345678');
      expect(phone.valid).toBe(true);
    });

    it('requires sexo field', () => {
      const sexo = (component as any).form.get('sexo')!;
      expect(sexo.hasError('required')).toBe(true);

      sexo.setValue(Sexo.Femenino);
      expect(sexo.valid).toBe(true);
    });

    it('password requires min 8 chars with uppercase, lowercase, number, symbol', () => {
      (component as any).passwordControl.setValue('Ab1!');
      expect((component as any).passwordControl.hasError('minlength')).toBe(true);

      (component as any).passwordControl.setValue('Pass123!');
      expect((component as any).passwordControl.valid).toBe(true);
    });
  });

  describe('finish()', () => {
    function fillValidForm() {
      (component as any).form.setValue({
        sexo: Sexo.Masculino,
        phone: '5512345678',
        especialidad: 'Pediatría',
        cedula: '12345678',
        cedulaEspecialidad: '',
        consultorios: 'Consultorio A',
        password: 'Pass1234!',
        confirmPassword: 'Pass1234!',
      });
    }

    it('does not call auth service when form invalid', async () => {
      await (component as any).finish();
      expect(authService.completeProfile).not.toHaveBeenCalled();
      expect(authService.registerFromInvitation).not.toHaveBeenCalled();
    });

    it('does not proceed when passwords do not match', async () => {
      fillValidForm();
      (component as any).passwordControl.setValue('Pass1234!');
      (component as any).confirmPasswordControl.setValue('OtherPa$$1');

      await (component as any).finish();
      expect(authService.completeProfile).not.toHaveBeenCalled();
    });

    it('calls completeProfile in existing mode', async () => {
      (component as any).mode.set('existing');
      (component as any).displayEmail = 'doc@test.com';
      fillValidForm();
      (authService.completeProfile as any).mockResolvedValue(undefined);

      await (component as any).finish();

      expect(authService.completeProfile).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/login'], {
        queryParams: { registered: 'true' },
      });
    });

    it('sets finishing to false after error', async () => {
      (component as any).mode.set('existing');
      fillValidForm();
      (authService.completeProfile as any).mockRejectedValue({ code: 'auth/weak-password' });

      await (component as any).finish();

      expect((component as any).finishing).toBe(false);
      expect(alertService.error).toHaveBeenCalled();
    });
  });

  describe('sexoOptions', () => {
    it('contains all three options', () => {
      expect((component as any).sexoOptions.length).toBe(3);
      expect((component as any).sexoOptions[0].value).toBe(Sexo.Masculino);
      expect((component as any).sexoOptions[1].value).toBe(Sexo.Femenino);
      expect((component as any).sexoOptions[2].value).toBe(Sexo.Otro);
    });
  });

  it('onLogoUploaded sets logoPath', () => {
    (component as any).onLogoUploaded({ url: 'http://img', path: 'logos/file.png' });
    expect((component as any).logoPath).toBe('logos/file.png');

    (component as any).onLogoUploaded(null);
    expect((component as any).logoPath).toBeNull();
  });
});
