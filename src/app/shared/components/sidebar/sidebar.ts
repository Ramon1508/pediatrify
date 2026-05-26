import { Component, inject, output } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    MatIconModule,
  ],
})
export class Sidebar {
  protected authService = inject(AuthService);
  private router = inject(Router);
  closeSidenav = output<void>();

  readonly navItems = [
    { path: '/app/calendar', icon: 'access_time', label: 'Calendario' },
    { path: '/app/patients', icon: 'groups', label: 'Pacientes' },
  ];

  get showAdminItems(): boolean {
    return this.authService.currentDoctor?.role === 'admin';
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
