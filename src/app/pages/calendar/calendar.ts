import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { AppointmentRepository } from '../../core/repositories/appointment.repository';
import { PatientRepository } from '../../core/repositories/patient.repository';
import { Appointment, Patient } from '../../core/models/user';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';

export interface TimeSlot {
  hour: number;
  minute: number;
  label: string;
  key: string;
}

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.html',
  styleUrl: './calendar.scss',
  standalone: true,
  imports: [
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
})
export class Calendar implements OnInit {
  private appointmentRepo = inject(AppointmentRepository);
  private patientRepo = inject(PatientRepository);
  private authService = inject(AuthService);
  private alert = inject(AlertService);

  readonly dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  protected weekStart = signal<Date>(this.getMonday(new Date()));
  protected allAppointments = signal<Appointment[]>([]);
  protected allPatients: Patient[] = [];

  protected showDialog = false;
  protected dialogError = '';
  protected newAppointment = { patientId: '', date: '', time: '', notes: '' };

  protected weekDays = computed(() => {
    const start = this.weekStart();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  });

  protected timeSlots: TimeSlot[] = [];

  protected hoveredCell: { date: Date; slot: TimeSlot } | null = null;

  constructor() {
    for (let h = 6; h <= 21; h++) {
      this.timeSlots.push({ hour: h, minute: 0, label: `${h}:00`, key: `${h}:00` });
      this.timeSlots.push({ hour: h, minute: 30, label: '', key: `${h}:30` });
    }
  }

  async ngOnInit() {
    const doctor = this.authService.currentDoctor;
    if (!doctor) return;
    this.allPatients = await this.patientRepo.getAllPatients();
    this.appointmentRepo.watchAppointmentsByDoctor(doctor.uid).subscribe((apps) => {
      this.allAppointments.set(apps);
    });
  }

  private getMonday(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  previousWeek() {
    const current = this.weekStart();
    current.setDate(current.getDate() - 7);
    this.weekStart.set(new Date(current));
  }

  nextWeek() {
    const current = this.weekStart();
    current.setDate(current.getDate() + 7);
    this.weekStart.set(new Date(current));
  }

  goToToday() {
    this.weekStart.set(this.getMonday(new Date()));
  }

  onCellHover(date: Date, slot: TimeSlot) {
    this.hoveredCell = { date, slot };
  }

  onCellLeave() {
    this.hoveredCell = null;
  }

  getAppointmentsForCell(date: Date, slot: TimeSlot): Appointment[] {
    const dateStr = this.formatDate(date);
    const timeStr = `${slot.hour.toString().padStart(2, '0')}:${slot.minute.toString().padStart(2, '0')}`;
    return this.allAppointments().filter(
      (a) => a.date === dateStr && a.time === timeStr && a.status !== 'cancelled'
    );
  }

  isHovered(date: Date, slot: TimeSlot): boolean {
    if (!this.hoveredCell) return false;
    return (
      this.hoveredCell.date.getTime() === date.getTime() &&
      this.hoveredCell.slot.key === slot.key
    );
  }

  openNewAppointment(date: Date, slot: TimeSlot) {
    const dateStr = this.formatDate(date);
    const timeStr = `${slot.hour.toString().padStart(2, '0')}:${slot.minute.toString().padStart(2, '0')}`;
    this.newAppointment = { patientId: '', date: dateStr, time: timeStr, notes: '' };
    this.dialogError = '';
    this.showDialog = true;
  }

  closeDialog() {
    this.showDialog = false;
  }

  async saveAppointment() {
    if (!this.newAppointment.patientId || !this.newAppointment.date || !this.newAppointment.time) return;

    const doctor = this.authService.currentDoctor;
    const patient = this.allPatients.find((p) => p.id === this.newAppointment.patientId);
    if (!doctor || !patient) return;

    const id = crypto.randomUUID();
    await this.appointmentRepo.createAppointment(id, {
      id,
      patientId: patient.id,
      patientName: `${patient.name} ${patient.lastName}`,
      doctorId: doctor.uid,
      doctorName: doctor.name,
      date: this.newAppointment.date,
      time: this.newAppointment.time,
      status: 'scheduled',
      type: 'scheduled',
      notes: this.newAppointment.notes,
    });

    this.alert.success({ message: 'Cita agendada', duration: 3000 });
    this.showDialog = false;
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
