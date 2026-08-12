import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/services/auth.service';
import { BRAND_NAME } from '../../../core/config/brand';
import { ProfileDialog } from '../profile-dialog/profile-dialog';
import { NotificationBell } from '../notification-bell/notification-bell';

@Component({
  selector: 'app-header',
  templateUrl: './header.html',
  styleUrl: './header.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgOptimizedImage,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    NotificationBell,
  ],
})
export class Header {
  protected authService = inject(AuthService);
  private router = inject(Router);
  protected brandName = inject(BRAND_NAME);
  private dialog = inject(MatDialog);

  protected goHome() {
    this.router.navigate(['/login']);
  }

  protected openProfileDialog() {
    this.dialog.open(ProfileDialog, {
      panelClass: 'profile-panel',
      backdropClass: 'profile-backdrop',
      disableClose: true,
    });
  }
}
