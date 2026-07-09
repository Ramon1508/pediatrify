import { Component, inject, signal, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-otp-login',
  templateUrl: './otp-login.html',
  styleUrl: './otp-login.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
})
export class OtpLogin {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  protected form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected hidePassword = signal(true);
  protected error = signal('');
  protected loading = signal(false);
  protected submitted = signal(false);

  protected get emailControl() { return this.form.get('email')!; }
  protected get passwordControl() { return this.form.get('password')!; }

  async onSubmit() {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.loading.set(true);
    this.error.set('');

    try {
      await this.authService.loginPatient(this.form.value.email!, this.form.value.password!);
      this.router.navigate(['/otp-dashboard']);
    } catch (e: any) {
      this.error.set(e.message || 'Error al verificar credenciales');
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }
}
