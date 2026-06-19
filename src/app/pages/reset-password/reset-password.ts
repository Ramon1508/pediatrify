import {
  Component,
  inject,
  signal,
  OnInit,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { sendPasswordResetEmail, confirmPasswordReset } from 'firebase/auth';
import { NgOptimizedImage } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FirebaseService } from '../../core/firebase/firebase.service';
import { AlertService } from '../../core/services/alert.service';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NgOptimizedImage,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
})
export class ResetPassword implements OnInit {
  private firebase = inject(FirebaseService);
  private alert = inject(AlertService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);

  protected mode = signal<'request' | 'reset'>('request');
  protected oobCode = '';
  protected loading = signal(false);
  protected submitted = signal(false);
  protected hidePassword = signal(true);
  protected hideConfirmPassword = signal(true);

  protected requestForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected resetForm = this.fb.group({
    newPassword: [
      '',
      [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>_]).{8,}$/),
      ],
    ],
    confirmPassword: ['', Validators.required],
  });

  get passwordControl() {
    return this.resetForm.get('newPassword')!;
  }
  get confirmPasswordControl() {
    return this.resetForm.get('confirmPassword')!;
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

  ngOnInit() {
    const params = this.route.snapshot.queryParams;
    const oobCode = params['oobCode'];
    if (oobCode) {
      this.oobCode = oobCode;
      this.mode.set('reset');
      this.cdr.detectChanges();
    }
  }

  async onRequestLink() {
    this.submitted.set(true);
    if (this.requestForm.invalid) return;

    const email = this.requestForm.value.email!;
    this.loading.set(true);

    try {
      // Cuando el dominio esté configurado, cambiar esta condición para usar el SDK de Firebase directamente:
      if (false) {
        const url =
          'https://us-central1-lilcare-afdf5.cloudfunctions.net/sendCustomPasswordResetEmail';

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: { email } }),
        });

        const result = await response.json();
        if (result.error) throw new Error(result.error.message);
      } else {
        const actionCodeSettings = {
          url: `${window.location.origin}/reset-password`,
          handleCodeInApp: true,
        };
        await sendPasswordResetEmail(this.firebase.auth, email, actionCodeSettings);
      }

      this.alert.success({
        message: 'Correo de recuperación enviado. Revisa tu bandeja de entrada.',
        duration: 5000,
      });
      this.requestForm.reset();
      this.submitted.set(false);
    } catch (e: any) {
      if (false) {
        this.alert.error({
          message: e.message || 'Error al enviar correo de recuperación',
          duration: 5000,
        });
      } else {
        if (e.code === 'auth/user-not-found') {
          this.alert.error({
            message: 'No se encontró una cuenta con este correo electrónico',
            duration: 5000,
          });
        } else {
          this.alert.error({
            message: e.message || 'Error al enviar correo de recuperación',
            duration: 5000,
          });
        }
      }
    } finally {
      this.loading.set(false);
    }
  }

  async onResetPassword() {
    this.submitted.set(true);
    if (this.resetForm.invalid) return;

    const newPassword = this.resetForm.value.newPassword!;
    this.loading.set(true);

    try {
      await confirmPasswordReset(this.firebase.auth, this.oobCode, newPassword);
      this.alert.success({
        message: 'Contraseña restablecida correctamente. Inicia sesión con tu nueva contraseña.',
        duration: 5000,
      });
      this.router.navigate(['/login']);
    } catch (e: any) {
      if (e.code === 'auth/expired-action-code') {
        this.alert.error({
          message: 'El enlace de recuperación ha expirado. Solicita uno nuevo.',
          duration: 5000,
        });
      } else if (e.code === 'auth/invalid-action-code') {
        this.alert.error({
          message: 'El enlace de recuperación no es válido. Solicita uno nuevo.',
          duration: 5000,
        });
      } else {
        this.alert.error({
          message: e.message || 'Error al restablecer la contraseña',
          duration: 5000,
        });
      }
    } finally {
      this.loading.set(false);
    }
  }
}
