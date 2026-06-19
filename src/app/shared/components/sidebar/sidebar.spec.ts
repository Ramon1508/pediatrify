import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Sidebar } from './sidebar';
import { AuthService } from '../../../core/services/auth.service';

describe('Sidebar', () => {
  let fixture: ComponentFixture<Sidebar>;
  let component: Sidebar;
  let authService: AuthService;
  let router: Router;

  beforeEach(async () => {
    const authSpy = {
      logout: vi.fn(),
    } as any;
    Object.defineProperty(authSpy, 'currentDoctor', { get: () => null, configurable: true });
    const routerSpy = { navigate: vi.fn(), events: of() } as any;

    await TestBed.configureTestingModule({
      imports: [Sidebar, NoopAnimationsModule],
      providers: [
        { provide: AuthService, useValue: authSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParams: {} } } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Sidebar);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  it('renders nav items', () => {
    fixture.detectChanges();
    const el = fixture.nativeElement;
    expect(el.textContent).toContain('Calendario');
    expect(el.textContent).toContain('Pacientes');
  });

  it('shows admin items when user is admin', () => {
    Object.defineProperty(authService, 'currentDoctor', {
      get: () => ({ role: 'admin' }) as any,
      configurable: true,
    });
    fixture.detectChanges();

    expect(component.isAdmin).toBe(true);
    expect(component.isAdminOrDoctor).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Asistentes');
    expect(fixture.nativeElement.textContent).toContain('Impresión');
    expect(fixture.nativeElement.textContent).toContain('Bitácora');
  });

  it('shows doctor items for doctor role', () => {
    Object.defineProperty(authService, 'currentDoctor', {
      get: () => ({ role: 'doctor' }) as any,
      configurable: true,
    });
    fixture.detectChanges();

    expect(component.isAdmin).toBe(false);
    expect(component.isAdminOrDoctor).toBe(true);
    expect(fixture.nativeElement.textContent).not.toContain('Asistentes');
    expect(fixture.nativeElement.textContent).toContain('Impresión');
    expect(fixture.nativeElement.textContent).not.toContain('Bitácora');
  });

  it('hides admin/doctor items for assistant role', () => {
    Object.defineProperty(authService, 'currentDoctor', {
      get: () => ({ role: 'assistant' }) as any,
      configurable: true,
    });
    fixture.detectChanges();

    expect(component.isAdmin).toBe(false);
    expect(component.isAdminOrDoctor).toBe(false);
    expect(fixture.nativeElement.textContent).not.toContain('Asistentes');
    expect(fixture.nativeElement.textContent).not.toContain('Impresión');
    expect(fixture.nativeElement.textContent).not.toContain('Bitácora');
  });

  it('calls logout and navigates to login', () => {
    component.logout();

    expect(authService.logout).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});
