import { Component, inject, ChangeDetectionStrategy, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from '../../shared/components/header/header';
import { Sidebar } from '../../shared/components/sidebar/sidebar';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-doctor-layout',
  templateUrl: './doctor-layout.html',
  styleUrl: './doctor-layout.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    Header,
    Sidebar,
  ],
})
export class DoctorLayout implements OnInit, OnDestroy {
  private authService = inject(AuthService);

  protected get showSidebar(): boolean {
    return this.authService.currentDoctor?.role === 'doctor';
  }

  ngOnInit() {
    // Variables usadas por los modales a pantalla completa en mobile: dejan libre
    // el header (arriba) y la barra de navegación inferior (si el usuario la tiene).
    document.body.style.setProperty('--app-header-h', '56px');
    document.body.style.setProperty('--app-nav-h', this.showSidebar ? '64px' : '0px');
  }

  ngOnDestroy() {
    document.body.style.removeProperty('--app-nav-h');
  }
}
