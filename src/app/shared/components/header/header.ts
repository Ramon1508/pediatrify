import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/services/auth.service';
import { BRAND_NAME, DEFAULT_LOGO_URL } from '../../../core/config/brand';
import { FirebaseService } from '../../../core/firebase/firebase.service';
import { resolveLogoUrl } from '../../../core/utils/logo-utils';
import { ProfileDialog } from '../profile-dialog/profile-dialog';
import { NotificationBell } from '../notification-bell/notification-bell';
import { from, of, switchMap } from 'rxjs';

@Component({
  selector: 'app-header',
  templateUrl: './header.html',
  styleUrl: './header.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
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
  private firebase = inject(FirebaseService);
  private defaultLogo = inject(DEFAULT_LOGO_URL);
  private logoRevision = 0;

  protected logoUrl = toSignal(
    this.authService.session$.pipe(
      switchMap((session) => {
        const logoPath = session?.type === 'doctor' ? session.user.logoPath : '';
        if (!logoPath) return of(this.defaultLogo);
        return from(this.resolveSessionLogo(logoPath));
      })
    ),
    { initialValue: this.defaultLogo }
  );

  private async resolveSessionLogo(logoPath: string): Promise<string> {
    const url = await resolveLogoUrl(this.firebase.storage, logoPath);
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${++this.logoRevision}`;
  }

  protected goHome() {
    this.router.navigate(['/login']);
  }

  protected openProfileDialog() {
    this.dialog.open(ProfileDialog, {
      panelClass: 'profile-panel',
      backdropClass: 'profile-backdrop',
      disableClose: false,
    });
  }
}
