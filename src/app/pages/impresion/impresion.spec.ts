import { TestBed } from '@angular/core/testing';
import { ComponentFixture } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { OverlayContainer } from '@angular/cdk/overlay';
import { Impresion } from './impresion';
import { AuthService } from '../../core/services/auth.service';
import { UserRepository } from '../../core/repositories/user.repository';
import { PrintSettingsRepository } from '../../core/repositories/print-settings.repository';
import { FirebaseService } from '../../core/firebase/firebase.service';
import { DEFAULT_LOGO_URL } from '../../core/config/brand';
import { getDefaultSettings } from '../../core/models/print-settings';
import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { BehaviorSubject } from 'rxjs';
import { uploadBytes } from 'firebase/storage';

vi.mock('firebase/storage', () => ({
  ref: vi.fn().mockReturnValue({}),
  uploadBytes: vi.fn().mockResolvedValue({ ref: {} }),
  getDownloadURL: vi.fn().mockResolvedValue('https://example.com/new.png'),
}));

describe('Impresion', () => {
  const doctor = { uid: 'd1', role: 'doctor', logoPath: 'logos/d1/old.png' } as any;
  let fixture: ComponentFixture<Impresion>;
  let component: any;
  let auth: any;
  let userRepo: any;
  let printRepo: any;
  let viewport: BehaviorSubject<BreakpointState>;

  beforeEach(() => {
    vi.mocked(uploadBytes).mockClear();
    vi.stubGlobal('URL', class extends URL {
      static override createObjectURL = vi.fn().mockReturnValue('blob:pending-logo');
      static override revokeObjectURL = vi.fn();
    });
    viewport = new BehaviorSubject<BreakpointState>({ matches: false, breakpoints: {} });
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
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
        { provide: BreakpointObserver, useValue: {
          observe: () => viewport.asObservable(),
          isMatched: () => viewport.value.matches,
        } },
      ],
    });

    fixture = TestBed.createComponent(Impresion);
    component = fixture.componentInstance as any;
    component.doctor = doctor;
  });

  afterEach(() => vi.unstubAllGlobals());

  async function render() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function tabs(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('[role="tab"]'));
  }

  function sheet(): HTMLElement {
    return TestBed.inject(OverlayContainer).getContainerElement();
  }

  async function editOnMobile() {
    viewport.next({ matches: true, breakpoints: {} });
    await render();
    fixture.nativeElement.querySelector('.header-actions button').click();
    await render();
  }

  it('keeps the preview beside the three settings tabs on desktop', async () => {
    await render();
    expect(tabs().map((tab) => tab.textContent?.trim())).toEqual([
      'Márgenes y estilos', 'Logo', 'Información',
    ]);
    expect(fixture.nativeElement.querySelector('.preview-panel .preview-frame')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.preview-frame')).toHaveLength(1);
  });

  it('opens Preview as the first mobile tab without a second preview below', async () => {
    viewport.next({ matches: true, breakpoints: {} });
    await render();
    expect(tabs().map((tab) => tab.textContent?.trim())).toEqual([
      'Preview', 'Márgenes y estilos', 'Logo', 'Información',
    ]);
    expect(tabs()[0].getAttribute('aria-selected')).toBe('true');
    expect(fixture.nativeElement.querySelector('.preview-tab .preview-frame')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.preview-panel')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.preview-frame')).toHaveLength(1);
  });

  it('preserves unsaved edits when switching tabs and moving between mobile and desktop', async () => {
    await editOnMobile();
    const input = sheet().querySelector('input[type="number"]') as HTMLInputElement;
    input.value = '2.5';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    (sheet().querySelectorAll('[role="tab"]')[1] as HTMLElement).click();
    await render();
    expect(component.settings().marginTop).toBe(2.5);
    expect(fixture.nativeElement.querySelector('.preview-tab .preview-frame')).not.toBeNull();

    viewport.next({ matches: false, breakpoints: {} });
    await render();
    expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(0);
    expect(fixture.nativeElement.querySelector('.preview-panel .preview-frame')).not.toBeNull();
    viewport.next({ matches: true, breakpoints: {} });
    await render();
    expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(1);
    tabs()[0].click();
    await render();
    expect(component.settings().marginTop).toBe(2.5);
    expect(component.isEditing()).toBe(true);
    expect(fixture.nativeElement.querySelectorAll('.preview-frame')).toHaveLength(1);
    expect(printRepo.updateSettings).not.toHaveBeenCalled();
  });

  it('opens only the three editable tabs in the mobile sheet', async () => {
    await editOnMobile();
    expect(sheet().querySelector('h2')?.textContent).toBe('Editar ajustes de impresión');
    expect(Array.from(sheet().querySelectorAll('[role="tab"]')).map((tab) => tab.textContent?.trim())).toEqual([
      'Márgenes y estilos', 'Logo', 'Información',
    ]);
    expect(sheet().querySelector('.print-settings-actions')?.textContent?.trim()).toBe('Guardar cambios');
    expect(sheet().textContent).not.toContain('Cancelar');
  });

  it.each(['close', 'backdrop', 'escape'])('discards unsaved settings and logo changes on %s', async (dismissal) => {
    await editOnMobile();
    component.updateSetting('marginTop', 3.5);
    component.pendingLogoPath = 'logos/d1/draft.png';
    component.pendingLogoUrl.set('https://example.com/draft.png');
    if (dismissal === 'close') {
      (sheet().querySelector('.btn-close-dialog') as HTMLButtonElement).click();
    } else if (dismissal === 'backdrop') {
      (sheet().querySelector('.cdk-overlay-backdrop') as HTMLElement).click();
    } else {
      const event = new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true });
      sheet().querySelector('[role="dialog"]')!.dispatchEvent(event);
    }
    await render();
    expect(component.settings()).toEqual(getDefaultSettings());
    expect(component.pendingLogoPath).toBe('');
    expect(component.pendingLogoUrl()).toBe('');
    expect(component.isEditing()).toBe(false);
    expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(0);
    expect(printRepo.updateSettings).not.toHaveBeenCalled();
    expect(userRepo.updateUser).not.toHaveBeenCalled();
  });

  it('saves from the sheet and retains the saved changes after closing', async () => {
    await editOnMobile();
    component.updateSetting('marginTop', 2.5);
    (sheet().querySelector('.print-settings-save') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(component.isEditing()).toBe(false));
    await render();
    expect(printRepo.updateSettings).toHaveBeenCalledWith('d1', expect.objectContaining({ marginTop: 2.5 }));
    expect(component.settings().marginTop).toBe(2.5);
    expect(component.savedSettings().marginTop).toBe(2.5);
    expect(component.isEditing()).toBe(false);
    expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(0);
  });

  it('keeps the draft open after a failed save and allows cancellation', async () => {
    await editOnMobile();
    printRepo.updateSettings.mockRejectedValueOnce(new Error('save failed'));
    component.updateSetting('marginTop', 2.5);
    await component.save();
    await render();
    expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(1);
    expect(component.settings().marginTop).toBe(2.5);
    expect(component.isEditing()).toBe(true);
    (sheet().querySelector('.btn-close-dialog') as HTMLButtonElement).click();
    await render();
    expect(component.settings()).toEqual(getDefaultSettings());
  });

  it('prevents duplicate saves and dismissal while a save is in flight', async () => {
    await editOnMobile();
    let finishSave!: () => void;
    printRepo.updateSettings.mockImplementationOnce(() => new Promise<void>((resolve) => finishSave = resolve));
    const saving = component.save();
    await render();
    expect((sheet().querySelector('.btn-close-dialog') as HTMLButtonElement).disabled).toBe(true);
    expect((sheet().querySelector('.print-settings-save') as HTMLButtonElement).disabled).toBe(true);
    (sheet().querySelector('.cdk-overlay-backdrop') as HTMLElement).click();
    await component.save();
    expect(component.isEditing()).toBe(true);
    expect(printRepo.updateSettings).toHaveBeenCalledTimes(1);
    finishSave();
    await saving;
    await render();
    expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(0);
  });

  it('saves a replacement in the shared logoPath and updates the active UI session', async () => {
    const file = new File(['logo'], 'new.png', { type: 'image/png' });
    await component.onLogoSelected({ target: { files: [file], value: 'new.png' } } as any);
    expect(uploadBytes).not.toHaveBeenCalled();

    await component.save();

    expect(uploadBytes).toHaveBeenCalledWith(expect.anything(), file, { contentType: 'image/png' });
    expect(userRepo.updateUser).toHaveBeenCalledWith('d1', { logoPath: 'logos/d1/new.png' });
    expect(auth.updateCurrentDoctor).toHaveBeenCalledWith({ logoPath: 'logos/d1/new.png' });
    expect(printRepo.updateSettings).toHaveBeenCalledWith(
      'd1',
      expect.objectContaining({ usePreloadedLogo: true })
    );
  });

  it('discards a selected logo on close without uploading or overwriting the saved logo', async () => {
    await editOnMobile();
    const file = new File(['replacement'], 'old.png', { type: 'image/png' });
    await component.onLogoSelected({ target: { files: [file], value: 'old.png' } } as any);
    expect(component.logoUrl()).toBe('blob:pending-logo');
    (sheet().querySelector('.btn-close-dialog') as HTMLButtonElement).click();
    await render();
    expect(uploadBytes).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:pending-logo');
    expect(component.pendingLogoFile).toBeUndefined();
    expect(component.pendingLogoPath).toBe('');
    expect(userRepo.updateUser).not.toHaveBeenCalled();
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
