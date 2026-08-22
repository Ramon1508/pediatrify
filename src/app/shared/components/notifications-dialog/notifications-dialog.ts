import {
  Component,
  inject,
  signal,
  computed,
  effect,
  viewChild,
  ElementRef,
  OnDestroy,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { NotificationService } from '../../../core/services/notification.service';
import { AppointmentRepository } from '../../../core/repositories/appointment.repository';
import { CalendarFocusService } from '../../../core/services/calendar-focus.service';
import { Appointment } from '../../../core/models/user';
import { AppNotification } from '../../../core/models/notification';

const SCROLL_THRESHOLD = 80;
const MAX_AUTOFILL_PAGES = 2;

@Component({
  selector: 'app-notifications-dialog',
  templateUrl: './notifications-dialog.html',
  styleUrl: './notifications-dialog.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatDialogModule,
    MatIconModule,
    MatButtonModule,
    MatRadioModule,
    MatDividerModule,
    MatProgressSpinnerModule,
  ],
})
export class NotificationsDialog implements OnDestroy {
  private notificationsService = inject(NotificationService);
  private appointmentRepo = inject(AppointmentRepository);
  private router = inject(Router);
  private dialogRef = inject(MatDialogRef<NotificationsDialog>);
  private focusService = inject(CalendarFocusService);

  protected notifications = this.notificationsService.notifications;
  protected activeFilter = this.notificationsService.activeFilter;
  protected isInitialLoading = this.notificationsService.isInitialLoading;
  protected isLoadingMore = this.notificationsService.isLoadingMore;
  protected hasMore = this.notificationsService.hasMore;

  protected appointments = signal<Record<string, Appointment | null>>({});
  protected skeletonItems = [0, 1, 2];
  private resolvedByAppointment = new Map<string, Appointment | null>();
  private inFlightAppointments = new Map<string, Promise<Appointment | null>>();

  private listEl = viewChild<ElementRef<HTMLElement>>('notifList');
  private closeSub: Subscription;
  private autoFillCount = 0;
  private cancelledMarked = false;

  private loadEffect = effect(() => {
    const list = this.notifications();
    if (list.length > 0) {
      void this.resolveAppointments(list);
    }
  });

  private fillEffect = effect(() => {
    const list = this.notifications();
    const hasMore = this.hasMore();
    if (list.length === 0 || this.isInitialLoading() || this.isLoadingMore() || !hasMore) return;
    if (this.autoFillCount >= MAX_AUTOFILL_PAGES) return;
    queueMicrotask(() => {
      const el = this.listEl()?.nativeElement;
      if (!el) return;
      if (el.scrollHeight <= el.clientHeight && this.hasMore()) {
        this.autoFillCount++;
        void this.notificationsService.loadMore();
      }
    });
  });

  /**
   * Marca las notificaciones de citas canceladas como leídas UNA sola vez al
   * cerrar el modal (por afterClosed o ngOnDestroy, el que dispare primero).
   */
  private triggerMarkCancelledRead(): void {
    if (this.cancelledMarked) return;
    this.cancelledMarked = true;
    void this.notificationsService.markCancelledRead();
  }

  constructor() {
    const recipient = this.notificationsService.recipientId();
    if (recipient && this.notifications().length === 0 && !this.isInitialLoading()) {
      void this.notificationsService.loadFirstPage(this.activeFilter());
    }
    this.closeSub = this.dialogRef.afterClosed().subscribe(() => {
      this.triggerMarkCancelledRead();
    });
  }

  ngOnDestroy() {
    this.closeSub?.unsubscribe();
    this.triggerMarkCancelledRead();
    this.loadEffect.destroy();
    this.fillEffect.destroy();
  }

  protected items = computed(() =>
    this.notifications().map((n) => ({
      notification: n,
      read: !this.isUnread(n),
      showDetails: this.canShowDetails(n),
    }))
  );

  private canShowDetails(n: AppNotification): boolean {
    if (n.type === 'appointment-cancelled' || !n.appointmentId) return false;
    const appointment = this.appointments()[n.id];
    const resolved = appointment !== undefined;
    return !resolved || appointment !== null;
  }

  private isUnread(n: AppNotification): boolean {
    return n.read === false;
  }

  protected setFilter(filter: 'all' | 'unread') {
    this.autoFillCount = 0;
    void this.notificationsService.setFilter(filter);
  }

  protected onScroll(event: Event) {
    const el = event.target as HTMLElement;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_THRESHOLD;
    if (nearBottom) {
      void this.notificationsService.loadMore();
    }
  }

  private async resolveAppointments(list: AppNotification[]) {
    for (const n of list) {
      if (n.appointmentId) {
        await this.resolveAppointment(n);
      }
    }
  }

  private async resolveAppointment(n: AppNotification): Promise<Appointment | null> {
    const appointmentId = n.appointmentId!;
    const cached = this.resolvedByAppointment.get(appointmentId);
    if (cached !== undefined) {
      this.appointments.update((map) => ({ ...map, [n.id]: cached }));
      return cached;
    }
    const inFlight = this.inFlightAppointments.get(appointmentId);
    if (inFlight) {
      const value = await inFlight;
      this.appointments.update((map) => ({ ...map, [n.id]: value }));
      return value;
    }
    const promise = Promise.resolve(this.appointmentRepo.getAppointment(appointmentId)).then(
      (appointment) => {
        const value = appointment && appointment.disabled !== true ? appointment : null;
        this.resolvedByAppointment.set(appointmentId, value);
        return value;
      }
    );
    this.inFlightAppointments.set(appointmentId, promise);
    const value = await promise;
    this.appointments.update((map) => ({ ...map, [n.id]: value }));
    return value;
  }

  protected async openDetails(n: AppNotification) {
    const appointment = await this.resolveAppointment(n);
    if (!appointment) return;
    await this.notificationsService.markAsRead(n.id);
    this.focusService.setFocus({
      date: appointment.date,
      time: appointment.time,
      appointmentId: appointment.id,
    });
    this.router.navigate(['/app/calendar']);
    this.dialogRef.close();
  }

  protected close() {
    this.dialogRef.close();
  }
}
