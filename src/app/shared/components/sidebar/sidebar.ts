import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    RouterLinkActive,
    MatIconModule,
    MatButtonModule,
  ],
})
export class Sidebar {
  protected authService = inject(AuthService);
  private router = inject(Router);
  readonly navItems = [
    { path: '/app/calendar', icon: 'access_time', label: 'Calendario' },
    { path: '/app/patients', icon: 'groups', label: 'Pacientes' },
  ];

  get isDoctor(): boolean {
    return this.authService.currentDoctor?.role === 'doctor';
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
