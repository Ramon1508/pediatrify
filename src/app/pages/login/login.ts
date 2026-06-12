import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrl: './login.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    NgOptimizedImage,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
})
export class Login implements OnInit {
  private authService = inject(AuthService);
  private alert = inject(AlertService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);

  protected loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  protected hidePassword = signal(true);
  protected loading = signal(false);
  protected submitted = signal(false);

  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      if (params['registered'] === 'true') {
        this.alert.success({ message: 'Tu cuenta ha sido creada', duration: 5000 });
      }
    });
  }

  async onSubmit() {
    this.submitted.set(true);

    if (this.loginForm.invalid) return;

    const { email, password } = this.loginForm.value;

    this.loading.set(true);

    try {
      await this.authService.loginDoctor(email!, password!);
      const doctor = this.authService.currentDoctor;
      if (doctor?.profileComplete) {
        this.router.navigate(['/app/calendar']);
      }
    } catch (e: any) {
      if (e.code === 'auth/invalid-credential' || e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password') {
        this.alert.error({ message: 'Correo o contraseña incorrectos', duration: 5000 });
      } else {
        this.alert.error({ message: e.message || 'Error al iniciar sesión', duration: 5000 });
      }
    } finally {
      this.loading.set(false);
    }
  }

  goToResetPassword() {
    this.router.navigate(['/reset-password']);
  }
}
