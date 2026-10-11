import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Sidebar } from './sidebar';
import { AuthService } from '../../../core/services/auth.service';

describe('Sidebar', () => {
  let fixture: ComponentFixture<Sidebar>;
  let component: Sidebar;
  let authService: AuthService;
  let router: Router;
  let sessions: Subject<null>;

  beforeEach(async () => {
    sessions = new Subject<null>();
    const authSpy = {
      logout: vi.fn(),
      session$: sessions,
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

  function setRole(role: string | null) {
    Object.defineProperty(authService, 'currentDoctor', {
      get: () => (role ? ({ role } as any) : null),
      configurable: true,
    });
    sessions.next(null);
  }

  it('renders the doctor nav items', () => {
    setRole('doctor');
    fixture.detectChanges();
    const el = fixture.nativeElement;
    expect(el.textContent).toContain('Calendario');
    expect(el.textContent).toContain('Pacientes');
  });

  it('shows Asistentes and Impresión for doctor role', () => {
    setRole('doctor');
    fixture.detectChanges();

    expect(component.isDoctor()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Asistentes');
    expect(fixture.nativeElement.textContent).toContain('Impresión');
    expect(fixture.nativeElement.textContent).not.toContain('Bitácora');
  });

  it('shows Doctores, Administradores and Bitácora (last) for admin role', () => {
    setRole('admin');
    fixture.detectChanges();

    expect(component.isDoctor()).toBe(false);
    const labels = [...fixture.nativeElement.querySelectorAll('.nav-label')].map((e: HTMLElement) => e.textContent);
    expect(labels).toEqual(['Doctores', 'Administradores', 'Bitácora']);
    expect(fixture.nativeElement.textContent).not.toContain('Asistentes');
    expect(fixture.nativeElement.textContent).not.toContain('Impresión');
  });

  it('renders no nav items for assistant role', () => {
    setRole('assistant');
    fixture.detectChanges();

    expect(component.isDoctor()).toBe(false);
    expect(fixture.nativeElement.querySelectorAll('.nav-item')).toHaveLength(0);
  });

  it('calls logout and navigates to login', () => {
    component.logout();

    expect(authService.logout).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});
