import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { Header } from './header';
import { AuthService } from '../../../core/services/auth.service';
import { BRAND_NAME } from '../../../core/config/brand';
import { ProfileDialog } from '../profile-dialog/profile-dialog';

describe('Header', () => {
  let fixture: ComponentFixture<Header>;
  let component: Header;
  let dialog: MatDialog;
  let authService: AuthService;

  beforeEach(async () => {
    const authSpy = { logout: vi.fn() } as any;
    Object.defineProperty(authSpy, 'currentDoctor', { get: () => null, configurable: true });
    Object.defineProperty(authSpy, 'currentPatient', { get: () => null, configurable: true });
    Object.defineProperty(authSpy, 'isAuthenticated', { get: () => false, configurable: true });
    const dialogSpy = { open: vi.fn() } as any;

    await TestBed.configureTestingModule({
      imports: [Header, NoopAnimationsModule],
      providers: [
        { provide: AuthService, useValue: authSpy },
        { provide: MatDialog, useValue: dialogSpy },
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
});
