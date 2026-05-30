import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { sendPasswordResetEmail } from 'firebase/auth';
import { NgOptimizedImage } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/services/auth.service';
import { FirebaseService } from '../../core/firebase/firebase.service';
import { AlertService } from '../../core/services/alert.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrl: './login.scss',
  standalone: true,
  imports: [
    FormsModule,
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
  private firebase = inject(FirebaseService);
  private alert = inject(AlertService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  protected email = '';
  protected password = '';
  protected error = '';
  protected successMsg = '';
  protected loading = false;
  protected submitted = false;

  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      if (params['registered'] === 'true') {
        this.alert.success({ message: 'Tu cuenta ha sido creada', duration: 5000 });
      }
    });
  }

  async onSubmit() {
    this.submitted = true;

    if (!this.email || !this.password) return;

    this.loading = true;
    this.error = '';
    this.successMsg = '';

    try {
      await this.authService.loginDoctor(this.email, this.password);
      const doctor = this.authService.currentDoctor;
      if (doctor?.profileComplete) {
        this.router.navigate(['/app/calendar']);
      }
    } catch (e: any) {
      if (e.code === 'auth/invalid-credential' || e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password') {
        this.error = 'Correo o contraseña incorrectos';
      } else {
        this.error = e.message || 'Error al iniciar sesión';
      }
    } finally {
      this.loading = false;
    }
  }

  async forgotPassword() {
    if (!this.email) {
      this.error = 'Ingresa tu correo electrónico primero';
      return;
    }

    try {
      await sendPasswordResetEmail(this.firebase.auth, this.email);
      this.successMsg = 'Correo de recuperación enviado. Revisa tu bandeja de entrada.';
      this.error = '';
    } catch (e: any) {
      this.error = e.message || 'Error al enviar correo de recuperación';
    }
  }
}
