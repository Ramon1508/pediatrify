import { Component, inject, signal, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Subscription } from 'rxjs';
import { NotificationRepository } from '../../../core/repositories/notification.repository';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationsDialog } from '../notifications-dialog/notifications-dialog';

@Component({
  selector: 'app-notification-bell',
  templateUrl: './notification-bell.html',
  styleUrl: './notification-bell.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, MatButtonModule],
})
export class NotificationBell implements OnInit, OnDestroy {
  protected unreadCount = signal(0);
  protected recipientId = signal<string | null>(null);

  private repo = inject(NotificationRepository);
  private auth = inject(AuthService);
  private dialog = inject(MatDialog);

  private sessionSub: Subscription | null = null;
  private notificationSub: Subscription | null = null;

  ngOnDestroy() {
    this.sessionSub?.unsubscribe();
    this.notificationSub?.unsubscribe();
  }

  ngOnInit() {
    this.sessionSub = this.auth.session$.subscribe(() => {
      this.recipientId.set(this.resolveRecipientId());
      this.resubscribe();
    });
  }

  private resolveRecipientId(): string | null {
    const doctor = this.auth.currentDoctor;
    if (doctor) return doctor.role === 'admin' ? null : doctor.uid;
    return this.auth.currentPatient?.id ?? null;
  }

  private resubscribe() {
    const id = this.recipientId();
    this.notificationSub?.unsubscribe();
    this.notificationSub = null;
    this.unreadCount.set(0);

    if (!id) return;

    this.notificationSub = this.repo.watchForRecipient(id).subscribe((notifications) => {
      const unread = notifications.filter((n) =>
        n.recipients?.some((r) => r.recipientId === id && r.read === false)
      ).length;
      this.unreadCount.set(unread);
    });
  }

  protected openNotifications() {
    this.dialog.open(NotificationsDialog, {
      panelClass: 'notif-panel',
      backdropClass: 'notif-backdrop',
      maxWidth: '100vw',
      maxHeight: 'calc(100dvh - 88px)',
    });
  }
}