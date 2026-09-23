import { TestBed } from '@angular/core/testing';
import { ComponentFixture } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Impresion } from './impresion';
import { AuthService } from '../../core/services/auth.service';
import { UserRepository } from '../../core/repositories/user.repository';
import { PrintSettingsRepository } from '../../core/repositories/print-settings.repository';
import { FirebaseService } from '../../core/firebase/firebase.service';
import { DEFAULT_LOGO_URL } from '../../core/config/brand';
import { getDefaultSettings } from '../../core/models/print-settings';

vi.mock('firebase/storage', () => ({
  ref: vi.fn().mockReturnValue({}),
  uploadBytes: vi.fn().mockResolvedValue({ ref: {} }),
  getDownloadURL: vi.fn().mockResolvedValue('https://example.com/new.png'),
}));

describe('Impresion doctor logo', () => {
  const doctor = { uid: 'd1', role: 'doctor', logoPath: 'logos/d1/old.png' } as any;
  let fixture: ComponentFixture<Impresion>;
  let component: any;
  let auth: any;
  let userRepo: any;
  let printRepo: any;

  beforeEach(() => {
    auth = {
      currentDoctor: doctor,
      updateCurrentDoctor: vi.fn(),
    };
    userRepo = { updateUser: vi.fn().mockResolvedValue(undefined) };
    printRepo = {
      getSettings: vi.fn().mockResolvedValue(getDefaultSettings()),
      updateSettings: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      imports: [Impresion, NoopAnimationsModule],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: UserRepository, useValue: userRepo },
        { provide: PrintSettingsRepository, useValue: printRepo },
        { provide: FirebaseService, useValue: { storage: {} } },
        { provide: DEFAULT_LOGO_URL, useValue: '/images/Logo.jpg' },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
      ],
    });

    fixture = TestBed.createComponent(Impresion);
    component = fixture.componentInstance as any;
    component.doctor = doctor;
  });

  it('saves a replacement in the shared logoPath and updates the active UI session', async () => {
    const file = new File(['logo'], 'new.png', { type: 'image/png' });
    await component.onLogoSelected({ target: { files: [file], value: 'new.png' } } as any);

    await component.save();

    expect(userRepo.updateUser).toHaveBeenCalledWith('d1', { logoPath: 'logos/d1/new.png' });
    expect(auth.updateCurrentDoctor).toHaveBeenCalledWith({ logoPath: 'logos/d1/new.png' });
    expect(printRepo.updateSettings).toHaveBeenCalledWith(
      'd1',
      expect.objectContaining({ usePreloadedLogo: true })
    );
  });

  it('removes the persisted shared logo and updates the active UI session', async () => {
    component.removeLogo();

    await component.save();

    expect(userRepo.updateUser).toHaveBeenCalledWith('d1', { logoPath: '' });
    expect(auth.updateCurrentDoctor).toHaveBeenCalledWith({ logoPath: '' });
  });

  it('does not allow a non-doctor to change the logo', async () => {
    auth.currentDoctor = { ...doctor, role: 'assistant' };
    component.pendingLogoPath = 'logos/d1/forbidden.png';

    await component.save();

    expect(userRepo.updateUser).not.toHaveBeenCalled();
    expect(printRepo.updateSettings).not.toHaveBeenCalled();
  });
});
