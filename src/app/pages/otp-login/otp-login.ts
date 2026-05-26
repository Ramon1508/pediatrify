import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
  imports: [
    FormsModule,
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
  private authService = inject(AuthService);
  private router = inject(Router);

  protected email = '';
  protected password = '';
  protected error = '';
  protected loading = false;

  async onSubmit() {
    if (!this.email || !this.password) return;

    this.loading = true;
    this.error = '';

    try {
      await this.authService.loginPatient(this.email, this.password);
      this.router.navigate(['/otp-dashboard']);
    } catch (e: any) {
      this.error = e.message || 'Error al verificar credenciales';
    } finally {
      this.loading = false;
    }
  }
}
