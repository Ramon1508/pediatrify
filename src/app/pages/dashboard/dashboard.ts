import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../core/services/auth.service';
@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  standalone: true,
  imports: [
    RouterLink,
    MatCardModule,
    MatDividerModule,
    MatIconModule,
    MatButtonModule,
  ],
})
export class Dashboard {
  protected authService = inject(AuthService);

  get doctor() {
    return this.authService.currentDoctor;
  }
}
