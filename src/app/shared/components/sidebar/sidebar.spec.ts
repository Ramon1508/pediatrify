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

    expect(component.showAdminItems).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Asistentes');
  });

  it('hides admin items when user is not admin', () => {
    Object.defineProperty(authService, 'currentDoctor', {
      get: () => ({ role: 'employee' }) as any,
      configurable: true,
    });
    fixture.detectChanges();

    expect(component.showAdminItems).toBe(false);
    expect(fixture.nativeElement.textContent).not.toContain('Asistentes');
  });

  it('logs out and navigates to /login on logout click', () => {
    fixture.detectChanges();
    const logoutBtn = fixture.nativeElement.querySelector('.logout-btn');
    logoutBtn.click();

    expect(authService.logout).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('has a logout button in the footer', () => {
    fixture.detectChanges();
    const footer = fixture.nativeElement.querySelector('.sidebar-footer');
    expect(footer.textContent).toContain('Salir');
  });
});
