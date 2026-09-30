import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { provideRouter, Router } from '@angular/router';
import { Header } from './header';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { BRAND_NAME } from '../../../core/config/brand';
import { DEFAULT_LOGO_URL } from '../../../core/config/brand';
import { FirebaseService } from '../../../core/firebase/firebase.service';
import { ProfileDialog } from '../profile-dialog/profile-dialog';
import { NotificationsDialog } from '../notifications-dialog/notifications-dialog';

describe('Header', () => {
  let fixture: ComponentFixture<Header>;
  let component: Header;
  let dialog: MatDialog;
  let authService: AuthService;
  let sessionSubject: BehaviorSubject<any>;

  beforeEach(async () => {
    sessionSubject = new BehaviorSubject<any>(null);
    const authSpy = { logout: vi.fn(), session$: sessionSubject.asObservable() } as any;
    Object.defineProperty(authSpy, 'currentDoctor', { get: () => null, configurable: true });
    Object.defineProperty(authSpy, 'currentPatient', { get: () => null, configurable: true });
    Object.defineProperty(authSpy, 'isAuthenticated', { get: () => false, configurable: true });
    const dialogSpy = { open: vi.fn() } as any;
    const notificationsSpy = {
      unreadCount: signal(0),
      recipientId: signal(null),
    };

    await TestBed.configureTestingModule({
      imports: [Header, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authSpy },
        { provide: MatDialog, useValue: dialogSpy },
        { provide: NotificationService, useValue: notificationsSpy },
        { provide: BRAND_NAME, useValue: 'Lilcare' },
        { provide: DEFAULT_LOGO_URL, useValue: '/images/Logo.jpg' },
        { provide: FirebaseService, useValue: { storage: {} } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Header);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthService);
    dialog = TestBed.inject(MatDialog);
  });

  it('shows the brand name', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Lilcare');
  });

  it.each([
    ['doctor', '/app/calendar'],
    ['assistant', '/app/calendar'],
    ['admin', '/app/doctors'],
    ['patient', '/paciente/calendario'],
  ])('links the logo and brand to the home for %s', (role, home) => {
    sessionSubject.next(role === 'patient'
      ? { type: 'patient', patient: { id: 'p1' } }
      : { type: 'doctor', user: { uid: 'd1', role } });
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const link = fixture.nativeElement.querySelector('a.nav-center') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe(home);
    for (const selector of ['.nav-logo', '.nav-brand']) {
      (link.querySelector(selector) as HTMLElement).click();
      const target = navigate.mock.lastCall![0];
      expect(typeof target === 'string' ? target : router.serializeUrl(target)).toBe(home);
    }
  });

  it('updates the home link when the session changes and returns to login only after logout', () => {
    fixture.detectChanges();
    const link = fixture.nativeElement.querySelector('a.nav-center') as HTMLAnchorElement;
    sessionSubject.next({ type: 'doctor', user: { uid: 'admin1', role: 'admin' } });
    fixture.detectChanges();
    expect(link.getAttribute('href')).toBe('/app/doctors');
    sessionSubject.next({ type: 'patient', patient: { id: 'p1' } });
    fixture.detectChanges();
    expect(link.getAttribute('href')).toBe('/paciente/calendario');
    sessionSubject.next(null);
    fixture.detectChanges();
    expect(link.getAttribute('href')).toBe('/login');
  });

  it('updates the navigation logo when the shared doctor session changes', async () => {
    fixture.detectChanges();
    sessionSubject.next({
      type: 'doctor',
      user: { uid: 'd1', role: 'doctor', logoPath: 'https://example.com/new-logo.png' },
    });
    await vi.waitFor(() => {
      fixture.detectChanges();
      const logo = fixture.nativeElement.querySelector('.nav-logo') as HTMLImageElement;
      expect(logo.src).toContain('https://example.com/new-logo.png');
    });
  });

  it('opens the profile dialog when clicking the account button', () => {
    Object.defineProperty(authService, 'isAuthenticated', { get: () => true, configurable: true });
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button[aria-label="Perfil"]');
    button.click();
    expect(dialog.open).toHaveBeenCalledWith(ProfileDialog, expect.objectContaining({
      panelClass: 'profile-panel',
      disableClose: false,
    }));
  });

  it('opens the notifications dialog when clicking the bell button', () => {
    Object.defineProperty(authService, 'isAuthenticated', { get: () => true, configurable: true });
    Object.defineProperty(authService, 'currentDoctor', { get: () => ({ uid: 'd1', role: 'doctor' }), configurable: true });
    const service = TestBed.inject(NotificationService) as any;
    service.recipientId.set('d1');
    fixture.detectChanges();
    const bell = fixture.nativeElement.querySelector('button[aria-label="Abrir notificaciones"]');
    bell.click();
    expect(dialog.open).toHaveBeenCalledWith(NotificationsDialog, expect.objectContaining({
      panelClass: 'notif-panel',
    }));
  });
});
