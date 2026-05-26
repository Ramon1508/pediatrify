import { Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';
import { Header } from '../../shared/components/header/header';

@Component({
  selector: 'app-otp-dashboard',
  templateUrl: './otp-dashboard.html',
  styleUrl: './otp-dashboard.scss',
  standalone: true,
  imports: [
    Header,
    MatCardModule,
    MatDividerModule,
    MatIconModule,
  ],
})
export class OtpDashboard {
  protected authService = inject(AuthService);

  get patient() {
    return this.authService.currentPatient;
  }
}
