import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { Header } from '../../shared/components/header/header';
import { FileUpload, UploadResult } from '../../shared/components/file-upload/file-upload';
import { AuthService } from '../../core/services/auth.service';
import { InvitationRepository } from '../../core/repositories/invitation.repository';
import { AlertService } from '../../core/services/alert.service';
import { UserRole } from '../../core/models/user';
import { Sexo } from '../../core/models/sexo';

@Component({
  selector: 'app-setup-profile',
  templateUrl: './setup-profile.html',
  styleUrl: './setup-profile.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    Header,
    FileUpload,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatDividerModule,
  ],
})
export class SetupProfile implements OnInit {
  private authService = inject(AuthService);
  private invitationRepo = inject(InvitationRepository);
  private alert = inject(AlertService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);

  protected mode = signal<'invitation' | 'existing' | 'invalid'>('invalid');
  protected pendingUid = '';
  protected pendingRole: UserRole = 'assistant';
  protected displayName = signal('');
  protected displayEmail = signal('');
  protected isNonDoctor = signal(false);

  protected readonly sexoOptions: { value: Sexo; label: string }[] = [
    { value: Sexo.Masculino, label: 'Masculino' },
    { value: Sexo.Femenino, label: 'Femenino' },
    { value: Sexo.Otro, label: 'Otro' },
  ];

  protected form = this.fb.group({
    sexo: [null as Sexo | null, Validators.required],
    phone: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
    especialidad: [''],
    cedula: ['', Validators.required],
    cedulaEspecialidad: [''],
    consultorios: ['', Validators.required],
    password: ['', [
      Validators.required,
      Validators.minLength(8),
      Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>_]).{8,}$/),
    ]],
    confirmPassword: ['', Validators.required],
  });

  get passwordControl() { return this.form.get('password')!; }
  get confirmPasswordControl() { return this.form.get('confirmPassword')!; }
  protected hidePassword = signal(true);
  protected hideConfirmPassword = signal(true);
  protected finishing = signal(false);
  protected logoPath = signal<string | null>(null);
  protected submitted = signal(false);

  async ngOnInit() {
    try {
      const email = this.route.snapshot.queryParams['email'];

      if (email) {
        const pending = await this.invitationRepo.findPendingUserByEmail(email);
        if (pending) {
          this.mode.set('invitation');
          this.pendingUid = pending.uid;
          this.pendingRole = pending.role;
          this.displayName.set(pending.name);
          this.displayEmail.set(pending.email);
          if (pending.role === 'assistant' || pending.role === 'admin') {
            this.isNonDoctor.set(true);
            this.form.get('sexo')?.clearValidators();
            this.form.get('phone')?.clearValidators();
            this.form.get('cedula')?.clearValidators();
            this.form.get('consultorios')?.clearValidators();
            this.form.get('sexo')?.updateValueAndValidity();
            this.form.get('phone')?.updateValueAndValidity();
            this.form.get('cedula')?.updateValueAndValidity();
            this.form.get('consultorios')?.updateValueAndValidity();
          }
          return;
        }
      }

      const doctor = this.authService.currentDoctor;
      if (this.authService.isDoctor && doctor && !doctor.profileComplete) {
        this.mode.set('existing');
        this.displayName.set(doctor.name);
        this.displayEmail.set(doctor.email);
        if (doctor.role === 'admin' || doctor.role === 'assistant') {
          this.isNonDoctor.set(true);
          this.form.get('sexo')?.clearValidators();
          this.form.get('phone')?.clearValidators();
          this.form.get('cedula')?.clearValidators();
          this.form.get('consultorios')?.clearValidators();
          this.form.get('sexo')?.updateValueAndValidity();
          this.form.get('phone')?.updateValueAndValidity();
          this.form.get('cedula')?.updateValueAndValidity();
          this.form.get('consultorios')?.updateValueAndValidity();
        }
        return;
      }

      this.mode.set('invalid');
      this.router.navigate(['/login']);
    } catch (e) {
      console.error('SetupProfile init error:', e);
      this.mode.set('invalid');
      this.router.navigate(['/login']);
    }
  }

  constructor() {
    this.confirmPasswordControl.setValidators([
      Validators.required,
      (control: AbstractControl) => {
        if (!control.value) return null;
        return control.value === this.passwordControl.value ? null : { mismatch: true };
      },
    ]);
    this.passwordControl.valueChanges.subscribe(() => {
      this.confirmPasswordControl.updateValueAndValidity({ onlySelf: true, emitEvent: false });
    });
  }

  onLogoUploaded(result: UploadResult | null) {
    this.logoPath.set(result?.path || null);
  }

  async finish() {
    this.submitted.set(true);
    this.form.markAllAsTouched();

    if (this.form.invalid) return;

    const password = this.passwordControl.value ?? '';

    this.finishing.set(true);

    const fv = this.form.value;

    try {
      if (this.mode() === 'invitation') {
        await this.authService.registerFromInvitation(
          this.displayEmail(),
          password,
          {
            name: this.displayName(),
            role: this.pendingRole,
            sexo: this.isNonDoctor() ? Sexo.Otro : (fv.sexo ?? Sexo.Otro),
            phone: this.isNonDoctor() ? '' : (fv.phone ?? ''),
            especialidad: this.isNonDoctor() ? '' : (fv.especialidad ?? ''),
            cedula: this.isNonDoctor() ? '' : (fv.cedula ?? ''),
            cedulaEspecialidad: this.isNonDoctor() ? '' : (fv.cedulaEspecialidad ?? ''),
            consultorios: this.isNonDoctor() ? '' : (fv.consultorios ?? ''),
            logoPath: this.logoPath() || undefined,
          },
          this.pendingUid
        );
      } else if (this.mode() === 'existing') {
        await this.authService.completeProfile(
          {
            name: this.displayName(),
            sexo: this.isNonDoctor() ? Sexo.Otro : fv.sexo!,
            phone: this.isNonDoctor() ? '' : (fv.phone ?? ''),
            especialidad: this.isNonDoctor() ? '' : (fv.especialidad ?? ''),
            cedula: this.isNonDoctor() ? '' : (fv.cedula!),
            cedulaEspecialidad: this.isNonDoctor() ? '' : (fv.cedulaEspecialidad ?? ''),
            consultorios: this.isNonDoctor() ? '' : (fv.consultorios ?? ''),
            logoPath: this.logoPath() || undefined,
          },
          password
        );
      }

      this.router.navigate(['/login'], { queryParams: { registered: 'true' } });
    } catch (e: any) {
      this.alert.error({ message: this.getReadableError(e), duration: 5000 });
    } finally {
      this.finishing.set(false);
    }
  }

  private getReadableError(e: any): string {
    const map: Record<string, string> = {
      'auth/email-already-in-use': 'Este correo ya está registrado',
      'auth/weak-password': 'La contraseña es muy débil. Usa al menos 6 caracteres.',
      'auth/invalid-email': 'Correo electrónico inválido',
    };
    return map[e.code] || e.message || 'Error inesperado';
  }
}
