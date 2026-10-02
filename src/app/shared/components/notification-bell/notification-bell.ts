import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Location } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { NotificationService } from '../../../core/services/notification.service';
import { NotificationsDialog } from '../notifications-dialog/notifications-dialog';

@Component({
  selector: 'app-notification-bell',
  templateUrl: './notification-bell.html',
  styleUrl: './notification-bell.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, MatButtonModule],
})
export class NotificationBell {
  private notifications = inject(NotificationService);
  private dialog = inject(MatDialog);
  private router = inject(Router);
  private location = inject(Location);

  protected unreadCount = this.notifications.unreadCount;
  protected recipientId = this.notifications.recipientId;

  protected active = signal(false);
  private dialogOpen = false;
  private readonly mobileQuery = '(max-width: 768px)';

  constructor() {
    if (this.router.events) {
      this.router.events
        .pipe(filter((e) => e instanceof NavigationEnd))
        .subscribe(() => this.syncActive());
    }
    this.syncActive();
  }

  private get isMobile(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia(this.mobileQuery).matches
    );
  }

  private syncActive() {
    const url = this.router.url ?? '';
    const onRoute = url.split('?')[0].startsWith('/app/notificaciones');
    this.active.set(onRoute || this.dialogOpen);
  }

  protected openNotifications() {
    // En mobile Notificaciones es una página completa (ruta).
    // Un segundo click estando ya en la ruta vuelve a la ruta anterior.
    if (this.isMobile) {
      const onRoute = (this.router.url ?? '').split('?')[0].startsWith('/app/notificaciones');
      if (onRoute) {
        this.location.back();
      } else {
        this.router.navigate(['/app/notificaciones']);
      }
      return;
    }
    this.dialogOpen = true;
    this.active.set(true);
    const ref = this.dialog.open(NotificationsDialog, {
      panelClass: 'notif-panel',
      backdropClass: 'notif-backdrop',
      maxWidth: '100vw',
      maxHeight: 'calc(100dvh - 88px)',
    });
    ref.afterClosed().subscribe(() => {
      this.dialogOpen = false;
      this.syncActive();
    });
  }
}
