import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
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

  protected unreadCount = this.notifications.unreadCount;
  protected recipientId = this.notifications.recipientId;

  protected openNotifications() {
    this.dialog.open(NotificationsDialog, {
      panelClass: 'notif-panel',
      backdropClass: 'notif-backdrop',
      maxWidth: '100vw',
      maxHeight: 'calc(100dvh - 88px)',
    });
  }
}
