import { Component, inject, signal, computed, OnInit, AfterViewInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { AppointmentRepository } from '../../core/repositories/appointment.repository';
import { PatientRepository } from '../../core/repositories/patient.repository';
import { Appointment, Patient } from '../../core/models/user';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { AppointmentDetailCard } from '../../shared/components/appointment-detail-card/appointment-detail-card';

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
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    AppointmentDetailCard,
    MatDatepickerModule,
  ],
})
export class Calendar implements OnInit, AfterViewInit {
  private fb = inject(FormBuilder);
  private appointmentRepo = inject(AppointmentRepository);
  private patientRepo = inject(PatientRepository);
  private authService = inject(AuthService);
  private alert = inject(AlertService);

  readonly dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  readonly monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  protected weekStart = signal<Date>(this.getWeekStart(new Date()));
  protected allAppointments = signal<Appointment[]>([]);
  protected allPatients: Patient[] = [];

  protected showDialog = false;
  protected showSettings = false;
  protected dialogError = '';

  protected appointmentForm = this.fb.group({
    patientId: ['', Validators.required],
    date: ['', Validators.required],
    time: ['', Validators.required],
    notes: [''],
  });

  protected selectedDay = signal<Date>(new Date());
  protected expandedAppointmentId = signal<string | null>(null);

  @ViewChild('picker') materialPicker!: any;

  protected onDateSelected(event: any) {
    const d = event?.value;
    if (!d || isNaN(d.getTime())) return;
    this.weekStart.set(this.getWeekStart(d));
  }

  protected openDatePicker() {
    this.materialPicker?.open();
  }

  protected toggleSettings() {
    this.showSettings = !this.showSettings;
  }

  protected closeSettings() {
    this.showSettings = false;
  }

  protected getAppointmentsForDay = computed(() => {
    const dateStr = this.formatDate(this.selectedDay());
    return this.allAppointments().filter(
      (a) => a.date === dateStr && a.status !== 'cancelled'
    );
  });

  protected mobileDateLabel = computed(() => {
    const d = this.selectedDay();
    const month = this.monthNames[d.getMonth()];
    const year = d.getFullYear();
    return `${year}, ${month} ${d.getDate()}`;
  });

  protected formatTime(time: string): string {
    const [h, m] = time.split(':').map(Number);
    const period = h >= 12 ? 'pm' : 'am';
    const hour12 = h % 12 || 12;
    return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
  }

  protected jumpToDay(dateValue: string) {
    const d = new Date(dateValue + 'T12:00:00');
    if (isNaN(d.getTime())) return;
    this.selectedDay.set(d);
  }

  protected onMobileDateChange(dateValue: string) {
    this.jumpToDay(dateValue);
  }

  protected toggleExpand(id: string) {
    this.expandedAppointmentId.set(
      this.expandedAppointmentId() === id ? null : id
    );
  }

  protected clearExpand() {
    this.expandedAppointmentId.set(null);
  }

  protected weekDays = computed(() => {
    const start = this.weekStart();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  });

  protected dateLabel = computed(() => {
    const start = this.weekStart();
    const end = this.weekDays()[6];
    const startMonth = this.monthNames[start.getMonth()];
    const endMonth = this.monthNames[end.getMonth()];
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();

    if (startMonth === endMonth && startYear === endYear) {
      return `${startYear}, ${startMonth} ${start.getDate()}-${end.getDate()}`;
    }
    if (startYear === endYear) {
      return `${startYear}, ${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}`;
    }
    return `${startYear}, ${startMonth} ${start.getDate()} - ${endYear}, ${endMonth} ${end.getDate()}`;
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

  ngAfterViewInit() {
    setTimeout(() => {
      const el = document.querySelector('.time-label.current-hour');
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'auto' });
      }
    });
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay());
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
    this.weekStart.set(this.getWeekStart(new Date()));
  }

  jumpToWeek(dateValue: string) {
    const d = new Date(dateValue + 'T12:00:00');
    if (isNaN(d.getTime())) return;
    this.weekStart.set(this.getWeekStart(d));
  }

  isToday(date: Date): boolean {
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  }

  isCurrentHour(slot: TimeSlot): boolean {
    const now = new Date();
    const currentBlockMinute = now.getMinutes() < 30 ? 0 : 30;
    return slot.hour === now.getHours() && slot.minute === currentBlockMinute;
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
    this.appointmentForm.setValue({ patientId: '', date: dateStr, time: timeStr, notes: '' });
    this.dialogError = '';
    this.showDialog = true;
  }

  closeDialog() {
    this.showDialog = false;
  }

  async saveAppointment() {
    if (this.appointmentForm.invalid) return;

    const doctor = this.authService.currentDoctor;
    const { patientId, date, time, notes } = this.appointmentForm.value;
    const patient = this.allPatients.find((p) => p.id === patientId);
    if (!doctor || !patient) return;

    const id = crypto.randomUUID();
    await this.appointmentRepo.createAppointment(id, {
      id,
      patientId: patient.id,
      patientName: `${patient.name} ${patient.lastName}`,
      doctorId: doctor.uid,
      doctorName: doctor.name,
      date: date!,
      time: time!,
      status: 'scheduled',
      type: 'scheduled',
      notes: notes || '',
    });

    this.alert.success({ message: 'Cita agendada', duration: 3000 });
    this.showDialog = false;
  }

  protected formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
