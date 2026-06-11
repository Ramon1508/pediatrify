import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Header } from './header';
import { AuthService } from '../../../core/services/auth.service';
import { BRAND_NAME } from '../../../core/config/brand';

describe('Header', () => {
  let fixture: ComponentFixture<Header>;
  let component: Header;
  let authService: AuthService;
  let router: Router;

  beforeEach(async () => {
    const authSpy = { logout: vi.fn() } as any;
    Object.defineProperty(authSpy, 'currentDoctor', { get: () => null, configurable: true });
    Object.defineProperty(authSpy, 'currentPatient', { get: () => null, configurable: true });
    Object.defineProperty(authSpy, 'isAuthenticated', { get: () => false, configurable: true });
    const routerSpy = { navigate: vi.fn(), events: of() } as any;

    await TestBed.configureTestingModule({
      imports: [Header, NoopAnimationsModule],
      providers: [
        { provide: AuthService, useValue: authSpy },
        { provide: Router, useValue: routerSpy },
        { provide: BRAND_NAME, useValue: 'Lilcare' },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Header);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  it('shows the brand name', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Lilcare');
  });

  it('shows doctor name and role when authenticated as doctor', () => {
    setDoctor('Dr. Pérez', 'admin');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Dr. Pérez');
    expect(component.roleLabel).toBe('Administrador');
  });

  it('shows employee role label', () => {
    setDoctor('Dr. López', 'employee');
    expect(component.roleLabel).toBe('Doctor');
  });

  it('shows patient name when authenticated as patient', () => {
    setPatient('Juan', 'García');
    expect(component.displayName).toBe('Juan García');
    expect(component.roleLabel).toBe('Paciente');
  });

  it('logs out and navigates to login', () => {
    fixture.detectChanges();
    component.logout();
    expect(authService.logout).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('returns empty displayName when not authenticated', () => {
    setNotAuthenticated();
    expect(component.displayName).toBe('');
  });

  it('returns empty roleLabel when not authenticated', () => {
    setNotAuthenticated();
    expect(component.roleLabel).toBe('');
  });

  function defineGetter(obj: any, prop: string, getter: () => any) {
    Object.defineProperty(obj, prop, { get: getter, configurable: true });
  }

  function setDoctor(name: string, role: string) {
    defineGetter(authService, 'currentDoctor', () => ({ name, role }) as any);
    defineGetter(authService, 'currentPatient', () => null);
    defineGetter(authService, 'isAuthenticated', () => true);
  }

  function setPatient(name: string, lastName: string) {
    defineGetter(authService, 'currentDoctor', () => null);
    defineGetter(authService, 'currentPatient', () => ({ name, lastName }) as any);
    defineGetter(authService, 'isAuthenticated', () => true);
  }

  function setNotAuthenticated() {
    defineGetter(authService, 'currentDoctor', () => null);
    defineGetter(authService, 'currentPatient', () => null);
    defineGetter(authService, 'isAuthenticated', () => false);
  }
});
