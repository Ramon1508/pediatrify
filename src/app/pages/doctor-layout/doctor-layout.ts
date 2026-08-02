import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
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
export class DoctorLayout {
  private authService = inject(AuthService);

  protected get showSidebar(): boolean {
    return this.authService.currentDoctor?.role === 'doctor';
  }
}
