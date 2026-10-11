import { Component, computed, effect, inject, ChangeDetectionStrategy, OnInit, OnDestroy } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { RouterOutlet } from '@angular/router';
import { Header } from '../../shared/components/header/header';
import { Sidebar } from '../../shared/components/sidebar/sidebar';
import { AuthService } from '../../core/services/auth.service';
import { MatDialog } from '@angular/material/dialog';

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
  private dialogs = inject(MatDialog);

  private readonly role = toSignal(this.authService.session$.pipe(map(() => this.authService.currentDoctor?.role)),
    { initialValue: this.authService.currentDoctor?.role });
  protected readonly showSidebar = computed(() => {
    const role = this.role();
    return role === 'doctor' || role === 'admin';
  });

  constructor() {
    effect(() => document.body.style.setProperty('--app-nav-h', this.showSidebar() ? '64px' : '0px'));
    effect(() => { if (!this.role()) this.dialogs.closeAll(); });
  }

  ngOnInit() {
    // Variables usadas por los modales a pantalla completa en mobile: dejan libre
    // el header (arriba) y la barra de navegación inferior (si el usuario la tiene).
    document.body.style.setProperty('--app-header-h', '56px');
  }

  ngOnDestroy() {
    document.body.style.removeProperty('--app-nav-h');
  }
}
