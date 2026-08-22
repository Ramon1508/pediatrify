import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { Header } from './header';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { BRAND_NAME } from '../../../core/config/brand';
import { ProfileDialog } from '../profile-dialog/profile-dialog';
import { NotificationsDialog } from '../notifications-dialog/notifications-dialog';

describe('Header', () => {
  let fixture: ComponentFixture<Header>;
  let component: Header;
  let dialog: MatDialog;
  let authService: AuthService;

  beforeEach(async () => {
    const authSpy = { logout: vi.fn(), session$: of(null) } as any;
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
        { provide: AuthService, useValue: authSpy },
        { provide: MatDialog, useValue: dialogSpy },
        { provide: NotificationService, useValue: notificationsSpy },
        { provide: BRAND_NAME, useValue: 'Lilcare' },
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

  it('opens the profile dialog when clicking the account button', () => {
    Object.defineProperty(authService, 'isAuthenticated', { get: () => true, configurable: true });
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button[aria-label="Perfil"]');
    button.click();
    expect(dialog.open).toHaveBeenCalledWith(ProfileDialog, expect.objectContaining({
      panelClass: 'profile-panel',
      disableClose: true,
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
