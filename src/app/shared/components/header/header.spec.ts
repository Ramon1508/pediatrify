import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { signal } from '@angular/core';
import { BehaviorSubject, of } from 'rxjs';
import { provideRouter, Router } from '@angular/router';
import { Header } from './header';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { BRAND_NAME } from '../../../core/config/brand';
import { DEFAULT_LOGO_URL } from '../../../core/config/brand';
import { FirebaseService } from '../../../core/firebase/firebase.service';
import { UserRepository } from '../../../core/repositories/user.repository';
import { ProfileDialog } from '../profile-dialog/profile-dialog';
import { PatientProfile } from '../patient-profile/patient-profile';
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
    Object.defineProperty(authSpy, 'session', { get: () => sessionSubject.value });
    const dialogSpy = { open: vi.fn().mockReturnValue({ afterClosed: () => of(true) }) } as any;
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
        { provide: UserRepository, useValue: { getUser: vi.fn().mockResolvedValue(null) } },
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

  it.each([
    ['assistant', { type: 'doctor', user: { uid: 'a1', role: 'assistant', createdBy: 'd1' } }],
    ['patient', { type: 'patient', patient: { id: 'p1', doctorId: 'd1' } }],
  ])('inherits the owning doctor logo for %s (P33)', async (_role, session) => {
    const userRepo = TestBed.inject(UserRepository) as any;
    userRepo.getUser.mockResolvedValue({ uid: 'd1', logoPath: 'https://example.com/doctor-logo.png' });
    sessionSubject.next(session);
    await vi.waitFor(() => {
      fixture.detectChanges();
      const logo = fixture.nativeElement.querySelector('.nav-logo') as HTMLImageElement;
      expect(logo.src).toContain('https://example.com/doctor-logo.png');
    });
    expect(userRepo.getUser).toHaveBeenCalledWith('d1');
  });

  it('opens the profile dialog when clicking the account button', () => {
    sessionSubject.next({ type: 'doctor', user: { uid: 'd1', role: 'doctor' } });
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button[aria-label="Perfil"]');
    button.click();
    expect(dialog.open).toHaveBeenCalledWith(ProfileDialog, expect.objectContaining({
      panelClass: 'profile-panel',
      disableClose: false,
    }));
  });

  it.each(['assistant', 'patient'])('recovers a rejected owner lookup for %s and handles a subsequent session', async (role) => {
    const repository = TestBed.inject(UserRepository);
    vi.mocked(repository.getUser).mockRejectedValueOnce(new Error('synthetic permission failure'));
    sessionSubject.next(role === 'assistant'
      ? { type: 'doctor', user: { uid: 'a1', role, createdBy: 'd1' } }
      : { type: 'patient', patient: { id: 'p1', doctorId: 'd1' } });
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(repository.getUser).toHaveBeenCalledWith('d1');
      expect((component as any).logoUrl()).toBe('/images/Logo.jpg');
    });
    vi.mocked(repository.getUser).mockResolvedValue({ uid: 'd2', role: 'doctor', logoPath: 'https://example.com/recovered.png' } as any);
    sessionSubject.next({ type: 'patient', patient: { id: 'p2', doctorId: 'd2' } });
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect((component as any).logoUrl()).toContain('https://example.com/recovered.png');
    });
    sessionSubject.next(null);
    fixture.detectChanges();
    expect((component as any).logoUrl()).toBe('/images/Logo.jpg');
  });

  it('opens the notifications dialog when clicking the bell button', () => {
    sessionSubject.next({ type: 'doctor', user: { uid: 'd1', role: 'doctor' } });
    const service = TestBed.inject(NotificationService) as any;
    service.recipientId.set('d1');
    fixture.detectChanges();
    const bell = fixture.nativeElement.querySelector('button[aria-label="Abrir notificaciones"]');
    bell.click();
    expect(dialog.open).toHaveBeenCalledWith(NotificationsDialog, expect.objectContaining({
      panelClass: 'notif-panel',
    }));
  });

  describe('mobile', () => {
    afterEach(() => {
      delete (window as any).matchMedia;
    });

    it('navigates to the profile route instead of opening the dialog', () => {
      (window as any).matchMedia = vi.fn().mockReturnValue({ matches: true });
      sessionSubject.next({ type: 'doctor', user: { uid: 'd1', role: 'doctor' } });
      fixture.detectChanges();
      const router = TestBed.inject(Router);
      const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      const button = fixture.nativeElement.querySelector('button[aria-label="Perfil"]');
      button.click();
      expect(navigate).toHaveBeenCalledWith(['/app/perfil']);
      expect(dialog.open).not.toHaveBeenCalled();
    });

    it('opens the patient profile page inside the patient portal', () => {
      (window as any).matchMedia = vi.fn().mockReturnValue({ matches: true });
      sessionSubject.next({ type: 'patient', patient: { id: 'p1' } });
      fixture.detectChanges();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      fixture.nativeElement.querySelector('button[aria-label="Perfil"]').click();
      expect(navigate).toHaveBeenCalledWith(['/paciente/perfil']);
      expect(dialog.open).not.toHaveBeenCalled();
    });

    it('returns to the patient calendar on a second profile click even on direct entry', () => {
      (window as any).matchMedia = vi.fn().mockReturnValue({ matches: true });
      sessionSubject.next({ type: 'patient', patient: { id: 'p1' } });
      const router = TestBed.inject(Router);
      vi.spyOn(router, 'url', 'get').mockReturnValue('/paciente/perfil?test=true');
      const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      fixture.detectChanges();
      fixture.nativeElement.querySelector('button[aria-label="Perfil"]').click();
      expect(navigate).toHaveBeenCalledWith(['/paciente/calendario']);
      expect(dialog.open).not.toHaveBeenCalled();
    });
  });

  it('opens a dedicated read-only patient profile on desktop', () => {
    sessionSubject.next({ type: 'patient', patient: { id: 'p1' } });
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button[aria-label="Perfil"]').click();
    expect(dialog.open).toHaveBeenCalledWith(PatientProfile, expect.objectContaining({ panelClass: 'profile-panel' }));
    expect(authService.logout).not.toHaveBeenCalled();
  });

  it('removes the account button after logout and does not open a profile without a session', () => {
    sessionSubject.next({ type: 'patient', patient: { id: 'p1' } });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button[aria-label="Perfil"]')).not.toBeNull();
    sessionSubject.next(null);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button[aria-label="Perfil"]')).toBeNull();
    (component as any).openProfileDialog();
    expect(dialog.open).not.toHaveBeenCalled();
  });
});
