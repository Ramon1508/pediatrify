import { Component, inject, Input, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../../../core/services/auth.service';
import { BRAND_NAME } from '../../../core/config/brand';

@Component({
  selector: 'app-header',
  templateUrl: './header.html',
  styleUrl: './header.scss',
  standalone: true,
  imports: [
    NgOptimizedImage,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatDividerModule,
  ],
})
export class Header {
  protected authService = inject(AuthService);
  private router = inject(Router);
  protected brandName = inject(BRAND_NAME);

  @Input() showMenuToggle = false;
  @Output() menuToggle = new EventEmitter<void>();

  protected goHome() {
    this.router.navigate(['/login']);
  }

  get displayName(): string {
    if (this.authService.currentDoctor) return this.authService.currentDoctor.name;
    if (this.authService.currentPatient) {
      const p = this.authService.currentPatient;
      return `${p.name} ${p.lastName}`;
    }
    return '';
  }

  get roleLabel(): string {
    if (!this.authService.isAuthenticated) return '';
    if (this.authService.currentDoctor) {
      return this.authService.currentDoctor.role === 'admin' ? 'Administrador' : 'Doctor';
    }
    return 'Paciente';
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
