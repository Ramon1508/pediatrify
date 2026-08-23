import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { PrintSettingsRepository } from '../../core/repositories/print-settings.repository';
import { AuthService } from '../../core/services/auth.service';
import { AppUser } from '../../core/models/user';
import { PrintSettings, PAPER_SIZES, PaperOrientation, getDefaultSettings, getPaperDimensions } from '../../core/models/print-settings';
import { DEFAULT_LOGO_URL } from '../../core/config/brand';
import { Sexo } from '../../core/models/sexo';

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
  ],
})
export class Impresion implements OnInit {
  private repo = inject(PrintSettingsRepository);
  private auth = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private defaultLogo = inject(DEFAULT_LOGO_URL);

  protected doctor: AppUser | null = null;
  protected settings = signal<PrintSettings>(getDefaultSettings());
  protected savedSettings = signal<PrintSettings>(getDefaultSettings());
  protected isEditing = signal(false);
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

    this.loading.set(false);
  }

  toggleEdit() {
    this.isEditing.update((v) => !v);
  }

  updateSetting(key: keyof PrintSettings, value: any) {
    this.settings.update((s) => ({ ...s, [key]: value }));
  }

  async save() {
    const doctor = this.auth.currentDoctor;
    if (!doctor) return;

    this.saving.set(true);
    try {
      const current = this.settings();
      const { customWidth, customHeight, logoUrl, ...rest } = current;
      const cleaned: PrintSettings = {
        ...rest,
        ...(current.paperSize === 'custom' ? { customWidth, customHeight } : {}),
        ...(current.logoUrl ? { logoUrl } : {}),
      };
      await this.repo.updateSettings(doctor.uid, cleaned);
      this.savedSettings.set(structuredClone(current));
      this.isEditing.set(false);
      this.snackBar.open('Configuración guardada correctamente', 'Cerrar', { duration: 5000 });
    } catch {
      this.snackBar.open('Error al guardar la configuración', 'Cerrar', { duration: 5000 });
    } finally {
      this.saving.set(false);
    }
  }

  cancel() {
    this.settings.set(structuredClone(this.savedSettings()));
    this.isEditing.set(false);
  }

  onLogoSelected(event: Event) {
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

    const reader = new FileReader();
    reader.onload = () => {
      this.settings.update((s) => ({ ...s, logoUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  removeLogo() {
    this.settings.update((s) => ({ ...s, logoUrl: undefined, usePreloadedLogo: false }));
  }

  protected logoUrl = computed(() => {
    const s = this.settings();
    if (s.usePreloadedLogo) {
      return this.doctor?.logoPath || this.defaultLogo;
    }
    return s.logoUrl || this.doctor?.logoPath || this.defaultLogo;
  });

  protected showLogo = computed(() => true);

  protected previewLogoWidthPx = computed(() => {
    const cm = this.settings().logoWidth;
    const previewCmPerPx = this.previewScaleCmPerPx();
    return Math.round(cm / previewCmPerPx);
  });

  private previewScaleCmPerPx = computed(() => {
    const s = this.settings();
    const dim = getPaperDimensions(s.paperSize, s.customWidth, s.customHeight, s.orientation);
    const previewMaxWidth = 400;
    return dim.width / previewMaxWidth;
  });

  private ptToPx = computed(() => {
    const dim = getPaperDimensions(this.settings().paperSize, this.settings().customWidth, this.settings().customHeight, this.settings().orientation);
    const previewWidth = 400;
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
    return { width: '400px', aspectRatio: `${aspect}` };
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
