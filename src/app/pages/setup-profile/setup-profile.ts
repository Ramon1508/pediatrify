import { Component, inject, signal, computed, OnInit, OnDestroy, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { Subscription } from 'rxjs';
import { Header } from '../../shared/components/header/header';
import { FileUpload, UploadResult } from '../../shared/components/file-upload/file-upload';
import { AuthService } from '../../core/services/auth.service';
import { StaffInvitationService, InvitationProfile } from '../../core/services/staff-invitation.service';
import { AlertService } from '../../core/services/alert.service';
import { Sexo } from '../../core/models/sexo';

@Component({
  selector: 'app-setup-profile', templateUrl: './setup-profile.html', styleUrl: './setup-profile.scss',
  standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Header, FileUpload, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatIconModule, MatButtonModule, MatProgressSpinnerModule, MatDividerModule],
})
export class SetupProfile implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private invitations = inject(StaffInvitationService);
  private alert = inject(AlertService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private token = '';
  private readonly operationId = crypto.randomUUID();
  private destroyed = false;
  private readonly subscriptions = new Subscription();
  protected readonly mode = signal<'loading' | 'invitation' | 'existing' | 'invalid'>('loading');
  protected readonly pendingRole = signal('doctor');
  protected readonly displayName = signal('');
  protected readonly displayEmail = signal('');
  protected readonly userUid = signal('');
  protected readonly isNonDoctor = computed(() => this.pendingRole() !== 'doctor');
  protected readonly invalidMessage = signal('Solicita una nueva invitación al Administrador o a tu Doctor.');
  protected readonly showForm = computed(() => this.mode() === 'invitation' || this.mode() === 'existing');
  protected readonly showLogoUpload = computed(() => this.mode() === 'existing' && !this.isNonDoctor());
  protected readonly sexoOptions = signal([
    { value: Sexo.Masculino, label: 'Masculino' }, { value: Sexo.Femenino, label: 'Femenino' }, { value: Sexo.Otro, label: 'Otro' },
  ]);
  protected readonly form = signal(this.fb.group({
    sexo: [null as Sexo | null, Validators.required],
    phone: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
    especialidad: ['', Validators.maxLength(300)],
    cedula: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(300)]],
    cedulaEspecialidad: ['', Validators.maxLength(300)],
    consultorios: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(5000)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(256),
      Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>_]).{8,}$/)]],
    confirmPassword: ['', Validators.required],
  }));
  protected readonly hidePassword = signal(true);
  protected readonly hideConfirmPassword = signal(true);
  protected readonly finishing = signal(false);
  @ViewChild(FileUpload) private logoUploader?: FileUpload;
  protected readonly logoPath = signal<string | null>(null);
  protected readonly submitted = signal(false);
  private readonly formState = signal({ invalid: true, pristine: true, errors: {} as Record<string, string> });
  protected readonly errors = computed(() => this.formState().errors);
  protected readonly saveDisabled = computed(() => !this.showForm() || this.formState().invalid ||
    this.formState().pristine || this.finishing());

  constructor() {
    const controls = this.form().controls;
    controls.confirmPassword.setValidators([Validators.required, control =>
      !control.value || control.value === controls.password.value ? null : { mismatch: true }]);
    this.subscriptions.add(controls.password.valueChanges.subscribe(() =>
      controls.confirmPassword.updateValueAndValidity({ onlySelf: true, emitEvent: false })));
    this.subscriptions.add(this.form().events.subscribe(() => this.syncFormState()));
  }

  private syncFormState() {
    const form = this.form();
    const errors: Record<string, string> = {};
    for (const [key, control] of Object.entries(form.controls)) {
      if (!(control.touched || this.submitted())) continue;
      if (control.invalid) {
        const labels: Record<string, string> = { sexo: 'Selecciona tu sexo.', phone: 'Ingresa un teléfono de 10 dígitos.',
          cedula: 'Ingresa tu cédula profesional de hasta 300 caracteres.',
          especialidad: 'Ingresa una especialidad de hasta 300 caracteres.',
          cedulaEspecialidad: 'Ingresa una cédula de especialidad de hasta 300 caracteres.',
          consultorios: 'Ingresa tus consultorios de hasta 5000 caracteres.',
          password: 'Ingresa una contraseña de 8 a 256 caracteres con mayúscula, minúscula, número y símbolo.',
          confirmPassword: 'Confirma tu contraseña.' };
        errors[key] = labels[key];
      }
    }
    if (form.controls.confirmPassword.hasError('mismatch') && (form.controls.confirmPassword.touched || this.submitted())) {
      errors['confirmPassword'] = 'Ingresa la misma contraseña en ambos campos.';
    }
    this.formState.set({ invalid: form.invalid, pristine: form.pristine, errors });
  }

  async ngOnInit() {
    const fragment = this.route.snapshot.fragment;
    if (fragment || this.route.snapshot.queryParams['email']) {
      const match = /^invitation=([A-Za-z0-9_-]{43})$/.exec(fragment ?? '');
      if (!match) { this.mode.set('invalid'); return; }
      this.token = match[1];
      try {
        const summary = await this.invitations.inspect(this.token);
        if (this.destroyed) return;
        this.configure(summary.role, summary.name, summary.email, summary.userId);
        this.mode.set('invitation');
      } catch (error) {
        if (this.destroyed) return;
        this.invalidMessage.set(this.readable(error));
        this.mode.set('invalid');
      }
      return;
    }
    const user = this.authService.currentDoctor;
    if (this.authService.isDoctor && user && !user.profileComplete) {
      this.configure(user.role, user.name, user.email, user.uid);
      this.mode.set('existing');
    } else { this.mode.set('invalid'); }
  }

  private configure(role: string, name: string, email: string, id: string) {
    this.pendingRole.set(role); this.displayName.set(name); this.displayEmail.set(email); this.userUid.set(id);
    if (role !== 'doctor') {
      for (const key of ['sexo', 'phone', 'cedula', 'consultorios']) {
        this.form().get(key)?.clearValidators();
        this.form().get(key)?.updateValueAndValidity();
      }
    }
    this.syncFormState();
  }
  onLogoUploaded(result: UploadResult | null) { if (this.showLogoUpload()) this.logoPath.set(result?.path || null); }
  goToLogin() { this.router.navigate(['/login']); }

  async finish() {
    if (this.destroyed || this.finishing() || !this.showForm()) return;
    this.submitted.set(true); this.form().markAllAsTouched(); this.syncFormState();
    if (this.saveDisabled()) return;
    const fv = this.form().getRawValue();
    const profile: InvitationProfile = { sexo: this.isNonDoctor() ? Sexo.Otro : fv.sexo ?? Sexo.Otro,
      phone: this.isNonDoctor() ? '' : fv.phone ?? '', especialidad: this.isNonDoctor() ? '' : fv.especialidad ?? '',
      cedula: this.isNonDoctor() ? '' : fv.cedula ?? '', cedulaEspecialidad: this.isNonDoctor() ? '' : fv.cedulaEspecialidad ?? '',
      consultorios: this.isNonDoctor() ? '' : fv.consultorios ?? '' };
    this.finishing.set(true);
    try {
      // Subir el logo pendiente al confirmar (P35); cancelar ya no escribe en Storage.
      let logoPath = this.logoPath();
      if (this.logoUploader?.hasPending) {
        const committed = await this.logoUploader.upload();
        if (!committed) throw new Error('No fue posible subir el logo. Intenta nuevamente.');
        logoPath = committed.path;
      }
      if (this.mode() === 'invitation') {
        await this.authService.registerFromInvitation(this.token, fv.password ?? '', profile, this.operationId);
      } else {
        const user = this.authService.currentDoctor;
        if (!user || user.uid !== this.userUid() || user.role !== this.pendingRole()) throw new Error('Invalid session');
        await this.authService.completeProfile({ name: this.displayName(), ...profile,
          logoPath: logoPath || undefined }, fv.password ?? '');
      }
      if (!this.destroyed) await this.router.navigate(['/login'], { queryParams: { registered: 'true' } });
    } catch (error) {
      if (!this.destroyed) this.alert.error({ message: this.readable(error), duration: 5000 });
    } finally { this.finishing.set(false); }
  }
  private readable(error: unknown): string {
    const failure = error as { code?: string; message?: string; details?: { reason?: string } };
    if (failure.code === 'functions/deadline-exceeded' && failure.details?.reason === 'invitation-expired') {
      return 'Esta invitación caducó. Solicita una nueva al Administrador o a tu Doctor.';
    }
    if (['functions/failed-precondition', 'functions/already-exists', 'functions/aborted', 'functions/resource-exhausted',
      'functions/permission-denied', 'functions/invalid-argument'].includes(failure.code ?? '')) {
      return failure.message || 'Solicita una nueva invitación.';
    }
    return 'No se pudo completar la operación. Reintenta con los mismos datos.';
  }
  ngOnDestroy() { this.destroyed = true; this.token = ''; this.subscriptions.unsubscribe(); this.form().reset(); }
}
