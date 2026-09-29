import { Component, inject, signal, computed, effect, viewChild, ElementRef, OnInit, ChangeDetectionStrategy, DestroyRef, untracked } from '@angular/core';
import { NgTemplateOutlet, UpperCasePipe } from '@angular/common';
import { BreakpointObserver } from '@angular/cdk/layout';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { PrintSettingsRepository } from '../../core/repositories/print-settings.repository';
import { AuthService } from '../../core/services/auth.service';
import { AppUser } from '../../core/models/user';
import { PrintSettings, PAPER_SIZES, PaperOrientation, getDefaultSettings, getPaperDimensions } from '../../core/models/print-settings';
import { DEFAULT_LOGO_URL } from '../../core/config/brand';
import { Sexo } from '../../core/models/sexo';
import { FirebaseService } from '../../core/firebase/firebase.service';
import { resolveLogoUrl } from '../../core/utils/logo-utils';
import { UserRepository } from '../../core/repositories/user.repository';
import { ref, uploadBytes } from 'firebase/storage';
import { PrintSettingsDialog, PrintSettingsDialogData } from './dialogs/print-settings-dialog/print-settings-dialog';

// Matches the project's $bp-mobile token in styles.scss.
const MOBILE_QUERY = '(max-width: 768px)';

@Component({
  selector: 'app-impresion',
  templateUrl: './impresion.html',
  styleUrl: './impresion.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatIconModule,
    MatButtonModule,
    MatTabsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatSnackBarModule,
    FormsModule,
    UpperCasePipe,
    NgTemplateOutlet,
  ],
})
export class Impresion implements OnInit {
  private repo = inject(PrintSettingsRepository);
  private auth = inject(AuthService);
  private userRepo = inject(UserRepository);
  private snackBar = inject(MatSnackBar);
  private firebase = inject(FirebaseService);
  private defaultLogo = inject(DEFAULT_LOGO_URL);
  private breakpoints = inject(BreakpointObserver);
  private dialog = inject(MatDialog);
  private destroyRef = inject(DestroyRef);
  private editorRef?: MatDialogRef<PrintSettingsDialog, 'saved' | 'layout'>;
  private readonly settingsTabs = viewChild.required<PrintSettingsDialogData['tabs']>('settingsTabs');
  protected readonly isMobile = toSignal(
    this.breakpoints.observe(MOBILE_QUERY).pipe(map((state) => state.matches)),
    { initialValue: this.breakpoints.isMatched(MOBILE_QUERY) },
  );
  private readonly previewViewport = viewChild<ElementRef<HTMLElement>>('previewViewport');
  private readonly previewAvailableWidth = signal(400);
  private readonly previewWidth = computed(() =>
    this.isMobile() ? Math.min(400, this.previewAvailableWidth()) : 400,
  );

  constructor() {
    effect((onCleanup) => {
      const viewport = this.previewViewport()?.nativeElement;
      if (!viewport) return;
      const observer = new ResizeObserver(([entry]) => {
        if (entry.contentRect.width > 0) {
          this.previewAvailableWidth.set(entry.contentRect.width);
        }
      });
      observer.observe(viewport);
      onCleanup(() => observer.disconnect());
    });

    effect(() => {
      const showSheet = this.isMobile() && this.isEditing();
      untracked(() => {
        if (showSheet) this.openEditor();
        else this.closeEditor('layout');
      });
    });

    this.destroyRef.onDestroy(() => {
      this.closeEditor('layout');
      this.clearPendingLogo();
    });
  }

  protected doctor: AppUser | null = null;
  protected settings = signal<PrintSettings>(getDefaultSettings());
  protected savedSettings = signal<PrintSettings>(getDefaultSettings());
  protected isEditing = signal(false);
  protected pendingLogoPath = '';
  protected pendingLogoUrl = signal('');
  private pendingLogoFile?: File;
  private logoRemoved = false;
  protected saving = signal(false);
  protected loading = signal(true);

  protected readonly paperSizes = PAPER_SIZES;

  protected readonly orientations: { value: PaperOrientation; label: string }[] = [
    { value: 'horizontal', label: 'Horizontal' },
    { value: 'vertical', label: 'Vertical' },
  ];

  protected paperSizeLabel = computed(() => {
    const value = this.settings().paperSize;
    const found = PAPER_SIZES.find((s) => s.value === value);
    return found ? found.label : value === 'custom' ? 'Personalizado' : value;
  });

  protected paperSizeShortLabel(value: string): string {
    const found = PAPER_SIZES.find((s) => s.value === value);
    if (!found) return value === 'custom' ? `${this.settings().customWidth ?? '?'} × ${this.settings().customHeight ?? '?'} cm` : value;
    const [labelPart] = found.label.split('(').map((s) => s.trim());
    return labelPart || found.label;
  }
  protected readonly Sexo = Sexo;

  async ngOnInit() {
    const doctor = this.auth.currentDoctor;
    this.doctor = doctor;

    if (doctor) {
      const s = await this.repo.getSettings(doctor.uid);
      this.settings.set(s);
      this.savedSettings.set(structuredClone(s));
    }

    await this.refreshLogoUrl();
    this.loading.set(false);
  }

  toggleEdit() {
    this.isEditing.set(true);
  }

  private openEditor() {
    if (this.editorRef) return;
    const ref = this.dialog.open<PrintSettingsDialog, PrintSettingsDialogData, 'saved' | 'layout'>(PrintSettingsDialog, {
      panelClass: 'right-panel',
      width: '100%',
      maxWidth: '100vw',
      ariaLabelledBy: 'print-settings-title',
      autoFocus: '.btn-close-dialog',
      disableClose: this.saving(),
      data: { tabs: this.settingsTabs(), saving: this.saving, save: () => this.save() },
    });
    this.editorRef = ref;
    ref.beforeClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (this.editorRef === ref) this.editorRef = undefined;
      // Resizing transfers the same draft to desktop; dismissing discards it.
      if (result !== 'saved' && result !== 'layout') this.cancel();
    });
  }

  private closeEditor(result: 'saved' | 'layout') {
    const ref = this.editorRef;
    this.editorRef = undefined;
    ref?.close(result);
  }

  updateSetting(key: keyof PrintSettings, value: any) {
    this.settings.update((s) => ({ ...s, [key]: value }));
    if (key === 'usePreloadedLogo') {
      this.refreshLogoUrl();
    }
  }

  async save() {
    const doctor = this.auth.currentDoctor;
    if (!doctor || doctor.role !== 'doctor' || this.saving()) return;

    this.saving.set(true);
    if (this.editorRef) this.editorRef.disableClose = true;
    try {
      const current = this.settings();
      const logoPath = this.logoRemoved ? '' : (this.pendingLogoPath || doctor.logoPath || '');
      const usePreloadedLogo = this.pendingLogoPath || this.logoRemoved
        ? true
        : current.usePreloadedLogo;

      if (this.pendingLogoFile) {
        const storageRef = ref(this.firebase.storage, this.pendingLogoPath);
        await uploadBytes(storageRef, this.pendingLogoFile, { contentType: this.pendingLogoFile.type });
      }

      await this.userRepo.updateUser(doctor.uid, { logoPath });

      const { customWidth, customHeight, ...rest } = current;
      const cleaned: PrintSettings = {
        ...rest,
        usePreloadedLogo,
        ...(current.paperSize === 'custom' ? { customWidth, customHeight } : {}),
      };
      await this.repo.updateSettings(doctor.uid, cleaned);
      if (doctor) {
        this.doctor = { ...doctor, logoPath: logoPath || undefined };
      }
      this.auth.updateCurrentDoctor({ logoPath });
      this.clearPendingLogo();
      this.logoRemoved = false;
      await this.refreshLogoUrl();
      this.savedSettings.set(structuredClone(cleaned));
      this.settings.set(cleaned);
      this.isEditing.set(false);
      this.closeEditor('saved');
      this.snackBar.open('Configuración guardada correctamente', 'Cerrar', { duration: 5000 });
    } catch {
      this.snackBar.open('Error al guardar la configuración', 'Cerrar', { duration: 5000 });
    } finally {
      this.saving.set(false);
      if (this.editorRef) this.editorRef.disableClose = false;
    }
  }

  cancel() {
    this.settings.set(structuredClone(this.savedSettings()));
    this.clearPendingLogo();
    this.logoRemoved = false;
    this.doctor = this.auth.currentDoctor;
    this.refreshLogoUrl();
    this.isEditing.set(false);
  }

  async onLogoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    const validTypes = ['image/png', 'image/jpeg', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      this.snackBar.open('Solo se aceptan PNG, JPG, JPEG y SVG', 'Cerrar', { duration: 5000 });
      input.value = '';
      return;
    }

    if (file.size > 1024 * 1024) {
      this.snackBar.open('La imagen no debe superar 1 MB', 'Cerrar', { duration: 5000 });
      input.value = '';
      return;
    }

    const doctor = this.auth.currentDoctor;
    if (!doctor || doctor.role !== 'doctor') return;

    this.clearPendingLogo();
    this.pendingLogoFile = file;
    this.pendingLogoPath = `logos/${doctor.uid}/${file.name}`;
    this.pendingLogoUrl.set(URL.createObjectURL(file));
    this.logoRemoved = false;
    await this.refreshLogoUrl();
    input.value = '';
  }

  private clearPendingLogo() {
    if (this.pendingLogoFile) URL.revokeObjectURL(this.pendingLogoUrl());
    this.pendingLogoFile = undefined;
    this.pendingLogoPath = '';
    this.pendingLogoUrl.set('');
  }

  removeLogo() {
    if (this.auth.currentDoctor?.role !== 'doctor') return;
    this.clearPendingLogo();
    this.logoRemoved = true;
    this.settings.update((s) => ({ ...s, usePreloadedLogo: true }));
    this.refreshLogoUrl();
  }

  protected logoUrl = signal(this.defaultLogo);

  private logoSource(): string {
    if (this.logoRemoved) return this.defaultLogo;
    return this.pendingLogoPath || this.doctor?.logoPath || this.defaultLogo;
  }

  private async refreshLogoUrl() {
    if (this.pendingLogoUrl()) {
      this.logoUrl.set(this.pendingLogoUrl());
      return;
    }
    const source = this.logoSource();
    this.logoUrl.set(await resolveLogoUrl(this.firebase.storage, source || this.defaultLogo));
  }

  protected showLogo = computed(() => true);

  protected previewLogoWidthPx = computed(() => {
    const cm = this.settings().logoWidth;
    const previewCmPerPx = this.previewScaleCmPerPx();
    return Math.round(cm / previewCmPerPx);
  });

  private previewScaleCmPerPx = computed(() => {
    const s = this.settings();
    const dim = getPaperDimensions(s.paperSize, s.customWidth, s.customHeight, s.orientation);
    const previewMaxWidth = this.previewWidth();
    return dim.width / previewMaxWidth;
  });

  private ptToPx = computed(() => {
    const dim = getPaperDimensions(this.settings().paperSize, this.settings().customWidth, this.settings().customHeight, this.settings().orientation);
    const previewWidth = this.previewWidth();
    const cmPerPx = dim.width / previewWidth;
    const ptToCm = 2.54 / 72;
    return ptToCm / cmPerPx;
  });

  private scaleRatio = computed(() => (12 * this.ptToPx()) / 12);
  protected fontSize16 = computed(() => `${Math.round(16 * this.ptToPx())}px`);
  protected fontSize12 = computed(() => `${Math.round(12 * this.ptToPx())}px`);

  protected gapPx(value: number): string {
    return `${Math.round(value * this.scaleRatio())}px`;
  }

  protected previewStyle = computed(() => {
    const s = this.settings();
    const dim = getPaperDimensions(s.paperSize, s.customWidth, s.customHeight, s.orientation);
    const aspect = dim.width / dim.height;
    return { width: `${this.previewWidth()}px`, aspectRatio: `${aspect}` };
  });

  protected previewContentStyle = computed(() => {
    const s = this.settings();
    const previewCmPerPx = this.previewScaleCmPerPx();
    const topPx = Math.round(s.marginTop / previewCmPerPx);
    const bottomPx = Math.round(s.marginBottom / previewCmPerPx);
    const leftPx = Math.round(s.marginLeft / previewCmPerPx);
    const rightPx = Math.round(s.marginRight / previewCmPerPx);
    return {
      paddingTop: `${topPx}px`,
      paddingBottom: `${bottomPx}px`,
      paddingLeft: `${leftPx}px`,
      paddingRight: `${rightPx}px`,
    };
  });
}
