import { Component, inject, signal, computed, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';
import { MatDividerModule } from '@angular/material/divider';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { NotificationRepository } from '../../../core/repositories/notification.repository';
import { AppointmentRepository } from '../../../core/repositories/appointment.repository';
import { AuthService } from '../../../core/services/auth.service';
import { CalendarFocusService } from '../../../core/services/calendar-focus.service';
import { Appointment } from '../../../core/models/user';
import { AppNotification, NotificationRecipientType } from '../../../core/models/notification';

@Component({
  selector: 'app-notifications-dialog',
  templateUrl: './notifications-dialog.html',
  styleUrl: './notifications-dialog.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatIconModule,
    MatButtonModule,
    MatRadioModule,
    MatDividerModule,
  ],
})
export class NotificationsDialog implements OnDestroy {
  private fb = inject(FormBuilder);
  private repo = inject(NotificationRepository);
  private appointmentRepo = inject(AppointmentRepository);
  private auth = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private dialogRef = inject(MatDialogRef<NotificationsDialog>);
  private focusService = inject(CalendarFocusService);

  protected notifications = signal<AppNotification[]>([]);
  protected appointments = signal<Record<string, Appointment | null>>({});
  protected filterControl = this.fb.control<'all' | 'unread'>('all');
  protected filterMode = signal<'all' | 'unread'>('all');

  private subscription: Subscription | null = null;
  private recipient: { id: string; type: NotificationRecipientType } | null = null;
  private resolvedAppointments = new Set<string>();

  constructor() {
    this.filterControl.valueChanges.subscribe((value) => {
      this.filterMode.set(value ?? 'all');
    });

    const doctor = this.auth.currentDoctor;
    if (doctor && doctor.role !== 'admin') {
      this.recipient = { id: doctor.uid, type: 'doctor' };
    } else if (this.auth.currentPatient) {
      this.recipient = { id: this.auth.currentPatient.id, type: 'patient' };
    }

    if (this.recipient) {
      this.subscription = this.repo.watchForRecipient(this.recipient.id).subscribe((list) => {
        this.notifications.set(list);
        this.resolveAppointments(list);
        this.cdr.markForCheck();
      });
    }
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }

  protected filtered = computed(() => {
    const list = this.notifications();
    if (this.filterMode() === 'unread') {
      return list.filter((n) => this.isUnread(n));
    }
    return list;
  });

  private isUnread(n: AppNotification): boolean {
    return (
      n.recipients?.some(
        (r) => r.recipientId === this.recipient?.id && r.read === false
      ) ?? false
    );
  }

  protected isRead(n: AppNotification): boolean {
    return !this.isUnread(n);
  }

  private async resolveAppointments(list: AppNotification[]) {
    const pending = list.filter(
      (n) => n.appointmentId && !this.resolvedAppointments.has(n.appointmentId!)
    );
    if (!pending.length) return;
    for (const n of pending) {
      this.resolvedAppointments.add(n.appointmentId!);
      const appointment = await this.appointmentRepo.getAppointment(n.appointmentId!);
      const map = { ...this.appointments() };
      map[n.id] = appointment && appointment.disabled !== true ? appointment : null;
      this.appointments.set(map);
      this.cdr.markForCheck();
    }
  }

  protected canShowDetails(n: AppNotification): boolean {
    if (n.type === 'appointment-cancelled') return false;
    return !!n.appointmentId && !!this.appointments()[n.id];
  }

  protected async openDetails(n: AppNotification) {
    const appointment = this.appointments()[n.id];
    if (!appointment) return;
    if (this.recipient) {
      await this.repo.markRead(n.id, this.recipient.id);
    }
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