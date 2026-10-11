import { Component, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../../core/services/auth.service';

export interface SidebarNavItem {
  path: string;
  icon: string;
  label: string;
}

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

  private readonly role = toSignal(this.authService.session$.pipe(map(() => this.authService.currentDoctor?.role)),
    { initialValue: this.authService.currentDoctor?.role });
  readonly isDoctor = computed(() => this.role() === 'doctor');

  /** P45: directorios separados; Bitácora conserva la última posición. */
  readonly navItems = computed<SidebarNavItem[]>(() => {
    const role = this.role();
    if (role === 'admin') {
      return [
        { path: '/app/doctors', icon: 'group', label: 'Doctores' },
        { path: '/app/admins', icon: 'admin_panel_settings', label: 'Administradores' },
        { path: '/app/audit-log', icon: 'history', label: 'Bitácora' },
      ];
    }
    if (role === 'doctor') {
      return [
        { path: '/app/calendar', icon: 'access_time', label: 'Calendario' },
        { path: '/app/patients', icon: 'groups', label: 'Pacientes' },
        { path: '/app/doctors', icon: 'group', label: 'Asistentes' },
        { path: '/app/impresion', icon: 'settings', label: 'Impresión' },
      ];
    }
    return [];
  });

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
