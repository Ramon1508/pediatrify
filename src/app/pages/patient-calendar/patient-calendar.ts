import { Component, inject, signal, computed, ChangeDetectionStrategy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { PatientRepository } from '../../core/repositories/patient.repository';
import { AppointmentRepository } from '../../core/repositories/appointment.repository';
import { AuthService } from '../../core/services/auth.service';
import { Patient, Appointment } from '../../core/models/user';

@Component({
  selector: 'app-patient-calendar',
  templateUrl: './patient-calendar.html',
  styleUrl: './patient-calendar.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatFormFieldModule, MatInputModule, MatIconModule, MatButtonModule, MatDatepickerModule],
})
export class PatientCalendar implements OnInit {
  private patientRepo = inject(PatientRepository);
  private appointmentRepo = inject(AppointmentRepository);
  private auth = inject(AuthService);

  protected children = signal<Patient[]>([]);
  protected appointments = signal<Appointment[]>([]);
  protected selectedDay = signal<string>(this.formatDate(new Date()));
  protected weekStart = signal<Date>(this.getWeekStart(new Date()));

  @ViewChild('picker') protected materialPicker!: any;

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private formatTime(time: string): string {
    const [h, m] = time.split(':').map(Number);
    const period = h >= 12 ? 'pm' : 'am';
    const hour12 = h % 12 || 12;
    return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  }

  protected dateLabel = computed(() => {
    const d = new Date(this.selectedDay() + 'T12:00:00');
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
  });

  protected weekDays = computed(() => {
    const start = this.weekStart();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return { date: d, dateStr: this.formatDate(d) };
    });
  });

  protected dayAppointments = computed(() => {
    const dateStr = this.selectedDay();
    return this.appointments()
      .filter((a) => a.date === dateStr && a.status !== 'cancelled' && !a.disabled)
      .sort((a, b) => a.time.localeCompare(b.time))
      .map((a) => ({ apt: a, timeLabel: this.formatTime(a.time) }));
  });

  protected weekAppointments = computed(() => {
    const map = new Map<string, Appointment[]>();
    const start = this.weekStart();
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const startStr = this.formatDate(start);
    const endStr = this.formatDate(end);
    for (const a of this.appointments()) {
      if (
        a.date >= startStr &&
        a.date < endStr &&
        a.status !== 'cancelled' &&
        !a.disabled
      ) {
        const list = map.get(a.date) ?? [];
        list.push(a);
        map.set(a.date, list);
      }
    }
    for (const list of map.values()) list.sort((a, b) => a.time.localeCompare(b.time));
    return map;
  });

  protected get patientName(): string {
    const me = this.auth.currentPatient;
    return me ? `${me.name} ${me.lastName}` : '';
  }

  async ngOnInit() {
    const me = this.auth.currentPatient;
    if (!me) return;
    const loginEmail = this.auth.currentPatientLoginEmail ?? me.email;
    const group = await this.patientRepo.getChildrenGroup(loginEmail, me.doctorId ?? '');
    this.children.set(group);

    const all: Appointment[] = [];
    for (const child of group) {
      const appts = await this.appointmentRepo.getByPatient(child.id);
      all.push(...appts.filter((a) => !a.disabled));
    }
    this.appointments.set(all);
  }

  protected openDatePicker() {
    this.materialPicker?.open();
  }

  protected onDateSelected(event: any) {
    const d = event?.value;
    if (d && !isNaN(d.getTime())) {
      this.selectedDay.set(this.formatDate(d));
      this.weekStart.set(this.getWeekStart(d));
    }
  }

  protected goToToday() {
    const now = new Date();
    this.selectedDay.set(this.formatDate(now));
    this.weekStart.set(this.getWeekStart(now));
  }
}
