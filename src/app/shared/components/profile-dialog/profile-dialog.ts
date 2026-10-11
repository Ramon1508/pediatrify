import { Component, inject, input, signal, computed, OnDestroy, ViewChild, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialogModule, MatDialogRef, MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TextFieldModule } from '@angular/cdk/text-field';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../../../core/services/auth.service';
import { AlertService } from '../../../core/services/alert.service';
import { UserRepository } from '../../../core/repositories/user.repository';
import { Sexo, SexoLabel } from '../../../core/models/sexo';
import { AppUser } from '../../../core/models/user';
import { FirebaseService } from '../../../core/firebase/firebase.service';
import { PrintSettingsRepository } from '../../../core/repositories/print-settings.repository';
import { resolveLogoUrl } from '../../../core/utils/logo-utils';
import { FileUpload, UploadResult } from '../file-upload/file-upload';
import { Subscription } from 'rxjs';
import { StaffEmailChangeService } from '../../../core/services/staff-email-change.service';
import { normalizeEmail } from '../../../core/utils/normalize-email';

@Component({
  selector: 'app-profile-dialog',
  templateUrl: './profile-dialog.html',
  styleUrl: './profile-dialog.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.page-mode]': 'asPage()',
  },
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    TextFieldModule,
    MatDividerModule,
    FileUpload,
  ],
})
export class ProfileDialog implements OnDestroy {
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  private dialogRef = inject(MatDialogRef<ProfileDialog>, { optional: true });
  private dialog = inject(MatDialog);
  private authService = inject(AuthService);
  private alert = inject(AlertService);
  private userRepo = inject(UserRepository);
  private emailChange = inject(StaffEmailChangeService);
  private emailAttempt: { key: string; id: string } | null = null;
  private printSettingsRepo = inject(PrintSettingsRepository);
  private firebase = inject(FirebaseService);
  private router = inject(Router);

  /** Cuando se renderiza como página (mobile) en vez de modal: sin X ni estilos de card. */
  readonly asPage = input(false);

  protected readonly sexoOptions = signal<{ value: Sexo; label: string }[]>([
    { value: Sexo.Masculino, label: 'Masculino' },
    { value: Sexo.Femenino, label: 'Femenino' },
    { value: Sexo.Otro, label: 'Otro' },
  ]);
  protected readOnly = signal(true);
  protected saving = signal(false);
  protected showSaved = signal(false);
  protected isSimpleProfile = computed(() => this.doctor()?.role !== 'doctor');
  protected roleDisplay = computed(() => this.doctor()?.role === 'admin' ? 'Administrador' : 'Asistente');
  protected canEditProfile = computed(() => ['admin', 'doctor', 'assistant'].includes(this.doctor()?.role ?? ''));
  protected nameEditable = computed(() => this.doctor()?.role !== 'admin');
  protected emailEditable = computed(() => this.doctor()?.role === 'admin' || this.doctor()?.role === 'assistant');
  protected nameLabel = computed(() => this.isSimpleProfile() ? 'Nombre completo' : 'Doctor(a)');
  protected nameErrorMessage = computed(() => this.formState().nameTooLong
    ? 'Ingresa un nombre de hasta 300 caracteres.'
    : this.isSimpleProfile() ? 'Ingresa tu nombre completo.' : 'Ingresa el nombre del doctor.');
  protected sexLabel = computed(() => {
    const sexo = this.doctor()?.sexo;
    return sexo ? SexoLabel[sexo] : '';
  });

  @ViewChild(FileUpload) private logoUploader?: FileUpload;

  protected doctor = signal<AppUser | null>(null);
  protected logoFileName = signal('');
  protected logoUrl = signal('');
  private logoUpload: UploadResult | null | undefined = undefined;
  private openedInEditMode = false;
  private destroyed = false;
  private savedTimer: ReturnType<typeof setTimeout> | null = null;
  private formSubscription: Subscription;
  protected submitted = signal(false);
  private formState = signal({ invalid: false, pristine: true, nameInvalid: false, nameTouched: false, nameTooLong: false,
    emailInvalid: false, emailTouched: false, email: '', name: '' });
  protected emailChanged = computed(() => this.emailEditable() && normalizeEmail(this.formState().email) !== normalizeEmail(this.doctor()?.email ?? ''));
  protected saveDisabled = computed(() => this.formState().invalid || this.formState().pristine || this.saving() ||
    (this.isSimpleProfile() && !this.emailChanged() && (this.doctor()?.role === 'admin' || this.formState().name.trim() === this.doctor()?.name)));
  protected nameError = computed(() => this.formState().nameInvalid && (this.formState().nameTouched || this.submitted()));
  protected emailError = computed(() => this.formState().emailInvalid && (this.formState().emailTouched || this.submitted()));

  protected form = signal(this.fb.group({
    name: ['', Validators.required],
    sexo: [null as Sexo | null],
    phone: [''],
    especialidad: [''],
    cedula: [''],
    cedulaEspecialidad: [''],
    email: ['', [Validators.email]],
    consultorios: [''],
  }));

  constructor() {
    this.formSubscription = this.form().events.subscribe(() => {
      const form = this.form();
      this.formState.set({ invalid: form.invalid, pristine: form.pristine,
        nameInvalid: form.controls.name.invalid, nameTouched: form.controls.name.touched,
        nameTooLong: form.controls.name.hasError('maxlength'), emailInvalid: form.controls.email.invalid,
        emailTouched: form.controls.email.touched, email: form.controls.email.value ?? '', name: form.controls.name.value ?? '' });
    });
    const doctor = this.authService.currentDoctor;
    this.doctor.set(doctor);
    if (doctor) {
      if (doctor.role === 'assistant') this.form().controls.name.addValidators([Validators.pattern(/\S/), Validators.maxLength(300)]);
      if (doctor.role === 'admin' || doctor.role === 'assistant') this.form().controls.email.addValidators([Validators.required, Validators.maxLength(254)]);
      this.form().patchValue({
        name: doctor.name ?? '',
        sexo: doctor.sexo ?? null,
        phone: doctor.phone ?? '',
        especialidad: doctor.especialidad ?? '',
        cedula: doctor.cedula ?? '',
        cedulaEspecialidad: doctor.cedulaEspecialidad ?? '',
        email: doctor.email ?? '',
        consultorios: doctor.consultorios ?? '',
      });
      const logo = doctor.logoPath;
      if (logo && doctor.role === 'doctor') {
        this.logoFileName.set(this.extractFileName(logo));
        this.resolveLogoUrl(logo).then((url) => {
          if (this.destroyed) return;
          this.logoUrl.set(url);
          this.cdr.markForCheck();
        });
      }
    }
    this.form().disable();
  }

  private extractFileName(value: string): string {
    const base = value.split('?')[0];
    const name = base.split('/').pop() ?? value;
    try {
      return decodeURIComponent(name).replace(/^[a-f0-9-]{36}_/i, '');
    } catch {
      return name;
    }
  }

  private async resolveLogoUrl(pathOrUrl: string): Promise<string> {
    try {
      return await resolveLogoUrl(this.firebase.storage, pathOrUrl);
    } catch {
      return '';
    }
  }

  switchToEdit() {
    if (!this.canEditOwnProfile() || this.saving()) return;
    // En la página de perfil (mobile), "Editar perfil" abre la edición como
    // bottom sheet dialog (no inline en la página).
    if (this.asPage()) {
      this.openEditDialog();
      return;
    }
    this.readOnly.set(false);
    this.dialogRef?.addPanelClass('profile-edit-panel');
    this.enableProfileForm();
    const doctor = this.doctor();
    if (!this.logoUrl() && doctor?.role === 'doctor' && doctor.logoPath) {
      this.resolveLogoUrl(doctor.logoPath).then((url) => {
        if (this.destroyed) return;
        this.logoUrl.set(url);
        this.cdr.markForCheck();
      });
    }
    this.cdr.markForCheck();
  }

  /** Abre la edición del perfil como dialog (bottom sheet en mobile). */
  private openEditDialog() {
    const ref = this.dialog.open(ProfileDialog, {
      panelClass: ['profile-panel', 'profile-edit-panel'],
      backdropClass: 'profile-backdrop',
      disableClose: false,
    });
    ref.componentInstance.enterEditMode();
    ref.afterClosed().subscribe(() => this.reloadDoctor());
  }

  /** Deja el dialog en modo edición desde el inicio. */
  enterEditMode() {
    if (!this.canEditOwnProfile() || this.saving()) return;
    this.openedInEditMode = true;
    this.readOnly.set(false);
    this.enableProfileForm();
    this.cdr.markForCheck();
  }

  private reloadDoctor() {
    const doctor = this.authService.currentDoctor;
    if (this.destroyed) return;
    this.doctor.set(doctor);
    if (doctor) {
      this.form().patchValue({
        name: doctor.name ?? '',
        sexo: doctor.sexo ?? null,
        phone: doctor.phone ?? '',
        especialidad: doctor.especialidad ?? '',
        cedula: doctor.cedula ?? '',
        cedulaEspecialidad: doctor.cedulaEspecialidad ?? '',
        email: doctor.email ?? '',
        consultorios: doctor.consultorios ?? '',
      });
      const logo = doctor.logoPath;
      this.logoFileName.set(logo ? this.extractFileName(logo) : '');
      this.logoUrl.set('');
      if (logo && doctor.role === 'doctor') {
        this.resolveLogoUrl(logo).then((url) => {
          if (this.destroyed) return;
          this.logoUrl.set(url);
          this.cdr.markForCheck();
        });
      }
    }
    this.readOnly.set(true);
    this.form().markAsPristine();
    this.form().disable();
    this.cdr.markForCheck();
  }

  cancelEdit() {
    if (this.saving()) return;
    // Si el dialog se abrió directamente en modo edición (desde la página), cancelar lo cierra.
    if (this.openedInEditMode) {
      this.dialogRef?.close();
      return;
    }
    const doctor = this.doctor();
    if (doctor) {
      this.form().patchValue({
        name: doctor.name ?? '',
        sexo: doctor.sexo ?? null,
        phone: doctor.phone ?? '',
        especialidad: doctor.especialidad ?? '',
        cedula: doctor.cedula ?? '',
        cedulaEspecialidad: doctor.cedulaEspecialidad ?? '',
        email: doctor.email ?? '',
        consultorios: doctor.consultorios ?? '',
      });
    }
    const logo = doctor?.role === 'doctor' ? doctor.logoPath : '';
    this.logoFileName.set(logo ? this.extractFileName(logo) : '');
    this.logoUrl.set('');
    if (logo) {
      this.resolveLogoUrl(logo).then((url) => {
        if (this.destroyed) return;
        this.logoUrl.set(url);
        this.cdr.markForCheck();
      });
    }
    this.logoUpload = undefined;
    this.logoUploader?.reset();
    this.readOnly.set(true);
    this.dialogRef?.removePanelClass('profile-edit-panel');
    this.form().markAsPristine();
    this.form().disable();
    this.cdr.markForCheck();
  }

  onLogoUploaded(result: UploadResult | null) {
    if (this.doctor()?.role !== 'doctor' || !this.canEditOwnProfile() || this.readOnly() || this.saving()) return;
    this.logoUpload = result;
    this.form().markAsDirty();
    if (result) {
      this.logoFileName.set(this.extractFileName(result.url));
      this.logoUrl.set(result.url);
    } else {
      this.logoFileName.set('');
      this.logoUrl.set('');
    }
    this.cdr.markForCheck();
  }

  async save() {
    if (!this.canEditOwnProfile() || this.readOnly() || this.saving()) return;
    this.submitted.set(true);
    this.form().markAllAsTouched();
    if (this.saveDisabled()) return;
    const doctor = this.doctor()!;

    this.saving.set(true);
    if (this.dialogRef) this.dialogRef.disableClose = true;
    this.cdr.markForCheck();

    try {
      if (this.emailChanged()) {
        const email = normalizeEmail(this.form().controls.email.value ?? '');
        const name = (this.form().controls.name.value ?? '').trim();
        const key = JSON.stringify([doctor.uid, email, doctor.email, doctor.role === 'assistant' ? name : null]);
        if (this.emailAttempt?.key !== key) this.emailAttempt = { key, id: crypto.randomUUID() };
        const result = await this.emailChange.changeEmail({ userId: doctor.uid, email, expectedEmail: doctor.email,
          operationId: this.emailAttempt.id, ...(doctor.role === 'assistant' ? { name } : {}) });
        if (result.pendingInvitation) throw new Error('Acceso propio no confirmado.');
        const current = this.authService.currentDoctor;
        if (current && (current.uid !== doctor.uid || current.role !== doctor.role)) return;
        if (current) this.authService.updateCurrentDoctor({ email, ...(doctor.role === 'assistant' ? { name } : {}) });
        this.dialogRef?.close(true);
        try {
          await this.authService.logout();
          this.alert.success({ message: 'Correo actualizado. Inicia sesión con tu nuevo correo y tu contraseña actual.', duration: 5000 });
        } catch {
          this.alert.error({ message: 'El correo se actualizó, pero no fue posible cerrar sesión. Inicia sesión con tu nuevo correo.', duration: 5000 });
        }
        await this.router.navigate(['/login']);
        return;
      }
      let uploadedLogoUrl = '';
      let logoPath = doctor.logoPath ?? '';
      let usePreloadedLogo: boolean | null = null;
      if (this.logoUpload === null) {
        // Logo eliminado: se usa el precargado (Lilcare).
        logoPath = '';
        usePreloadedLogo = true;
      } else if (this.logoUpload) {
        // Logo propio: subir el archivo pendiente al guardar (P35).
        if (this.logoUploader?.hasPending) {
          const committed = await this.logoUploader.upload();
          if (!committed) throw new Error('No fue posible subir el logo. Intenta nuevamente.');
          this.logoUpload = committed;
          this.logoUrl.set(committed.url);
          this.logoFileName.set(this.extractFileName(committed.path));
          logoPath = committed.path;
          uploadedLogoUrl = committed.url;
        } else {
          logoPath = this.logoUpload.path;
          uploadedLogoUrl = this.logoUpload.url;
        }
        usePreloadedLogo = false;
      } else if (!logoPath) {
        usePreloadedLogo = true;
      }

      const v = this.form().value;
      const payload: Partial<AppUser> = doctor.role === 'assistant' ? { name: (v.name ?? '').trim() } : {
        name: v.name ?? '',
        phone: v.phone ?? '',
        especialidad: v.especialidad ?? '',
        cedula: v.cedula ?? '',
        cedulaEspecialidad: v.cedulaEspecialidad ?? '',
        consultorios: v.consultorios ?? '',
        logoPath,
      };
      if (doctor.role === 'doctor' && v.sexo != null) payload.sexo = v.sexo;
      if (doctor.role === 'doctor' && usePreloadedLogo !== null) {
        const ps = await this.printSettingsRepo.getSettings(doctor.uid);
        payload.printSettings = { ...ps, usePreloadedLogo };
      }
      // Professional data, logo reference and preference live in one document.
      // One commit prevents success in one part and failure in the other.
      await this.userRepo.updateUser(doctor.uid, payload);
      if (!this.canEditOwnProfile()) return;

      this.doctor.set({ ...doctor, ...payload });
      this.authService.updateCurrentDoctor(payload);
      this.logoFileName.set(doctor.role === 'doctor' && logoPath ? this.extractFileName(logoPath) : '');
      this.logoUrl.set(uploadedLogoUrl);
      if (doctor.role === 'doctor' && logoPath && !uploadedLogoUrl) {
        this.resolveLogoUrl(logoPath).then((url) => {
          if (this.destroyed) return;
          this.logoUrl.set(url);
          this.cdr.markForCheck();
        });
      }
      this.logoUpload = undefined;

      this.readOnly.set(true);
      this.dialogRef?.removePanelClass('profile-edit-panel');
      this.form().markAsPristine();
      this.form().disable();

      // Si el dialog se abrió en modo edición (desde la página de perfil), cerrar al guardar.
      if (this.openedInEditMode) {
        this.dialogRef?.close(true);
        return;
      }

      this.showSaved.set(true);
      if (this.savedTimer) clearTimeout(this.savedTimer);
      this.savedTimer = setTimeout(() => {
        this.showSaved.set(false);
        this.cdr.markForCheck();
      }, 4000);
    } catch (error) {
      if (this.destroyed) return;
      const current = this.authService.currentDoctor;
      if (current && (current.uid !== doctor.uid || current.role !== doctor.role)) return;
      const code = (error as { code?: string }).code;
      this.alert.error({ message: code === 'functions/already-exists' ? 'Ingresa un correo que no esté asociado a otra cuenta.'
        : this.emailChanged() ? (code === 'functions/failed-precondition' || code === 'functions/aborted' ? (error as Error).message
          : 'No se completó el cambio de correo. Reintenta con los mismos datos; puede ser necesario iniciar sesión con el nuevo correo y tu contraseña actual.')
          : this.logoUpload && !this.logoUploader?.hasPending && !this.logoUpload.url.startsWith('blob:')
            ? 'No se guardaron los cambios del perfil. El logo subido está listo para reintentar; el perfil anterior se conserva.'
            : 'Error al guardar los cambios', duration: 5000 });
    } finally {
      this.saving.set(false);
      if (this.dialogRef) this.dialogRef.disableClose = false;
      this.cdr.markForCheck();
    }
  }

  dismissSaved() {
    this.showSaved.set(false);
    this.cdr.markForCheck();
  }

  logout() {
    this.dialogRef?.close();
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  close() {
    if (this.saving()) return;
    if (this.asPage()) {
      this.router.navigate(['/app/calendar']);
      return;
    }
    this.dialogRef?.close();
  }

  private canEditOwnProfile(): boolean {
    const doctor = this.doctor();
    const current = this.authService.currentDoctor;
    return !this.destroyed && !!doctor && !!current && current.uid === doctor.uid && current.role === doctor.role
      && (current.role === 'doctor' || current.role === 'admin' || current.role === 'assistant');
  }

  private enableProfileForm() {
    this.submitted.set(false);
    this.form().markAsUntouched();
    if (this.isSimpleProfile()) {
      this.form().disable();
      this.form().controls.email.enable();
      if (this.doctor()?.role === 'assistant') this.form().controls.name.enable();
    } else {
      this.form().enable();
      this.form().controls.email.disable();
    }
    this.form().markAsPristine();
  }

  ngOnDestroy() {
    this.destroyed = true;
    this.formSubscription.unsubscribe();
    if (this.savedTimer) clearTimeout(this.savedTimer);
  }
}
