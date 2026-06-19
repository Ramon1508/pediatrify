import { Component, inject, signal, computed, OnInit, ViewChild, ChangeDetectorRef, ChangeDetectionStrategy, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormArray } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { AppointmentRepository } from '../../core/repositories/appointment.repository';
import { UserRepository } from '../../core/repositories/user.repository';
import { PatientRepository } from '../../core/repositories/patient.repository';
import { AuditRepository } from '../../core/repositories/audit.repository';
import { Appointment, Patient, AppUser, TimeSegment } from '../../core/models/user';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { AppointmentDetailCard } from '../../shared/components/appointment-detail-card/appointment-detail-card';
import { AppointmentDialog } from './dialogs/appointment-dialog/appointment-dialog';
import { SettingsDialog, SettingsData } from './dialogs/settings-dialog/settings-dialog';
import { CancelAppointmentDialog } from './dialogs/cancel-appointment-dialog/cancel-appointment-dialog';
import { Subscription } from 'rxjs';

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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatAutocompleteModule,
    AppointmentDetailCard,
    MatDatepickerModule,
    MatTooltipModule,
    MatDialogModule,
    MatSlideToggleModule,
    MatProgressSpinnerModule,
  ],
})
export class Calendar implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private appointmentRepo = inject(AppointmentRepository);
  private userRepo = inject(UserRepository);
  private patientRepo = inject(PatientRepository);
  private auditRepo = inject(AuditRepository);
  private authService = inject(AuthService);
  private alert = inject(AlertService);
  private dialog = inject(MatDialog);
  private cdr = inject(ChangeDetectorRef);

  readonly dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  readonly dayNamesShort = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  readonly monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  protected weekStart = signal<Date>(this.getWeekStart(new Date()));
  protected allAppointments = signal<Appointment[]>([]);
  protected visibleWeekAppointments = computed(() => {
    const start = this.weekStart();
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const fmt = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const startStr = fmt(start);
    const endStr = fmt(end);
    return this.allAppointments().filter(
      (a) => a.date >= startStr && a.date < endStr && a.status !== 'cancelled' && !a.disabled
    );
  });
  protected allPatients: Patient[] = [];
  protected allDoctors: AppUser[] = [];
  protected selectedDoctorId = signal<string>('');
  protected isAdmin = false;

  protected settingsForm = this.fb.group({
    consultationDuration: [30, Validators.required],
    allowPatientScheduling: [false],
    timeSegments: this.fb.array<{ startTime: string; endTime: string }>([]),
  });

  protected availableDaysSignal = signal<string[]>(['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']);

  protected timeSegmentsSignal = signal<TimeSegment[]>([{ startTime: '06:00', endTime: '00:00' }]);
  protected consultationDurationSignal = signal(30);

  protected selectedDay = signal<Date>(new Date());
  protected expandedAppointmentId = signal<string | null>(null);
  protected selectedAppointment = signal<Appointment | null>(null);
  protected overlayPosition = signal<{ top: number; left: number } | null>(null);

  private appointmentSub: Subscription | null = null;

  @ViewChild('picker') materialPicker!: any;

  protected onDateSelected(event: any) {
    const d = event?.value;
    if (!d || isNaN(d.getTime())) return;
    this.weekStart.set(this.getWeekStart(d));
  }

  protected openDatePicker() {
    this.materialPicker?.open();
  }

  protected openSettingsDialog() {
    const data: SettingsData = {
      consultationDuration: this.settingsForm.value.consultationDuration ?? 30,
      allowPatientScheduling: this.settingsForm.value.allowPatientScheduling ?? false,
      timeSegments: (this.settingsForm.value.timeSegments ?? []) as TimeSegment[],
      availableDays: this.availableDaysSignal(),
      doctorId: this.selectedDoctorId(),
    };
    const dialogRef = this.dialog.open(SettingsDialog, {
      width: '400px',
      disableClose: true,
      panelClass: 'right-panel',
    });
    dialogRef.componentInstance.setData(data);
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadDoctorData(this.selectedDoctorId());
      }
    });
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

  protected gridTemplateColumns = '80px repeat(7, 1fr)';

  protected dateLabel = computed(() => {
    const start = this.weekStart();
    const allDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
    const end = allDays[6];
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

  protected hoveredCell: { date: Date; slot: TimeSlot } | null = null;

  protected timeSlots = computed(() => {
    const segments = this.timeSegmentsSignal();
    const duration = this.consultationDurationSignal();
    const weekAppts = this.visibleWeekAppointments();

    let overallStart = 1440;
    let overallEnd = 0;
    for (const seg of segments) {
      const [sh, sm] = seg.startTime.split(':').map(Number);
      let [eh, em] = seg.endTime.split(':').map(Number);
      if (eh === 0 && em === 0) eh = 24;
      overallStart = Math.min(overallStart, sh * 60 + sm);
      overallEnd = Math.max(overallEnd, eh * 60 + em);
    }
    for (const apt of weekAppts) {
      const [h, m] = apt.time.split(':').map(Number);
      const t = h * 60 + m;
      if (t < overallStart) overallStart = Math.floor(t / 30) * 30;
      if (t + duration > overallEnd) overallEnd = Math.ceil((t + duration) / 30) * 30;
    }

    const slots: TimeSlot[] = [];
    let idx = 0;
    for (let m = overallStart; m < overallEnd; m += duration) {
      const hour = Math.floor(m / 60);
      const minute = m % 60;
      const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      const period = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      slots.push({
        hour,
        minute,
        label: idx % 2 === 0 ? `${hour12}:${minute.toString().padStart(2, '0')} ${period}` : '',
        key: timeStr,
      });
      idx++;
    }
    return slots;
  });

  constructor() {}

  private getDayShort(date: Date): string {
    const idx = date.getDay();
    return this.dayNamesShort[idx === 0 ? 6 : idx - 1];
  }

  protected isDayAvailable(date: Date): boolean {
    return this.availableDaysSignal().includes(this.getDayShort(date));
  }

  protected canInteractWithCell(_date: Date): boolean {
    return true;
  }

  protected onDoctorSelected(doctorId: string) {
    this.selectedDoctorId.set(doctorId);
    this.loadDoctorData(doctorId);
  }

  private get timeSegmentsFormArray() {
    return this.settingsForm.get('timeSegments') as FormArray;
  }

  private async loadDoctorData(doctorId: string) {
    if (this.appointmentSub) {
      this.appointmentSub.unsubscribe();
      this.appointmentSub = null;
    }

    this.appointmentSub = this.appointmentRepo.watchAppointmentsByDoctor(doctorId).subscribe((apps) => {
      this.allAppointments.set(apps);
      this.scrollToCurrentHour();
      this.cdr.markForCheck();
    });

    const user = await this.userRepo.getUser(doctorId);
    if (user) {
      this.settingsForm.patchValue({
        consultationDuration: user.consultationDuration ?? 30,
        allowPatientScheduling: user.allowPatientScheduling ?? false,
      });
      this.consultationDurationSignal.set(user.consultationDuration ?? 30);
      this.timeSegmentsFormArray.clear();
      const oldDefault = user.timeSegments?.length === 1 && user.timeSegments[0].startTime === '08:00' && user.timeSegments[0].endTime === '17:00';
      const segments = oldDefault ? [{ startTime: '06:00', endTime: '00:00' }] : (user.timeSegments?.length ? user.timeSegments : [{ startTime: '06:00', endTime: '00:00' }]);
      for (const seg of segments) {
        this.timeSegmentsFormArray.push(this.fb.group({ startTime: seg.startTime, endTime: seg.endTime }));
      }
      this.timeSegmentsSignal.set(segments);
      if (user.availableDays?.length) {
        this.availableDaysSignal.set(user.availableDays);
      }
    }
    this.cdr.markForCheck();
  }

  async ngOnInit() {
    const doctor = this.authService.currentDoctor;
        
    if (!doctor) return;

    this.isAdmin = doctor.role === 'admin';
    this.selectedDoctorId.set(doctor.uid);

    this.allPatients = await this.patientRepo.getAllPatients();
    this.cdr.markForCheck();

    if (this.isAdmin) {
      this.userRepo.watchAllUsers().subscribe((users) => {
        this.allDoctors = users.filter(u => u.role === 'admin' || u.role === 'doctor');
        this.cdr.markForCheck();
      });
    }

    this.loadDoctorData(doctor.uid);
  }

  private scrollToCurrentHour() {
    setTimeout(() => {
      const el = document.querySelector('.current-hour');
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'auto' });
      } else {
        const container = document.querySelector('.calendar-scroll');
        if (container) {
          container.scrollTop = container.scrollHeight / 2;
        }
      }
    });
  }

  ngOnDestroy() {
    if (this.appointmentSub) {
      this.appointmentSub.unsubscribe();
    }
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
    setTimeout(() => this.scrollToCurrentHour());
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
    const duration = this.consultationDurationSignal();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const blockStart = Math.floor(nowMinutes / duration) * duration;
    const slotMinutes = slot.hour * 60 + slot.minute;
    return slotMinutes === blockStart;
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
    const result = this.allAppointments().filter(
      (a) => a.date === dateStr && a.time === timeStr && a.status !== 'cancelled'
    );
    return result;
  }

  isHovered(date: Date, slot: TimeSlot): boolean {
    if (!this.hoveredCell) return false;
    return (
      this.hoveredCell.date.getTime() === date.getTime() &&
      this.hoveredCell.slot.key === slot.key
    );
  }

  private openAppointmentDialog(editingAppointment?: Appointment | null, prefill?: { date: Date; slot: TimeSlot }) {
    const dialogRef = this.dialog.open(AppointmentDialog, {
      width: '400px',
      disableClose: true,
      panelClass: 'right-panel',
    });
    const instance = dialogRef.componentInstance;
    const segments = this.timeSegmentsSignal();

    if (prefill) {
      const dateStr = this.formatDate(prefill.date);
      const timeStr = `${prefill.slot.hour.toString().padStart(2, '0')}:${prefill.slot.minute.toString().padStart(2, '0')}`;
      instance.setData({
        allPatients: this.allPatients,
        selectedDoctorId: this.selectedDoctorId(),
        editingAppointment: null,
        timeSegments: segments,
      });
      instance.setPrefill(dateStr, timeStr);
    } else if (editingAppointment) {
      instance.setData({
        allPatients: this.allPatients,
        selectedDoctorId: this.selectedDoctorId(),
        editingAppointment,
        timeSegments: segments,
      });
    } else {
      instance.setData({
        allPatients: this.allPatients,
        selectedDoctorId: this.selectedDoctorId(),
        timeSegments: segments,
      });
    }

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.cdr.markForCheck();
      }
    });
  }

  protected selectAppointment(apt: Appointment, event: MouseEvent) {
    this.selectedAppointment.set(apt);
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.overlayPosition.set({ top: rect.bottom + 4, left: rect.left });
  }

  openNewAppointment(date: Date, slot: TimeSlot) {
    this.selectedAppointment.set(null);
    this.overlayPosition.set(null);
    this.openAppointmentDialog(null, { date, slot });
  }

  openSideAppointment() {
    this.selectedAppointment.set(null);
    this.overlayPosition.set(null);
    this.openAppointmentDialog();
  }

  editAppointment(apt: Appointment) {
    this.selectedAppointment.set(null);
    this.overlayPosition.set(null);
    this.openAppointmentDialog(apt);
  }

  protected cancelAppointment(apt: Appointment) {
    const dialogRef = this.dialog.open(CancelAppointmentDialog, {
      disableClose: true,
      panelClass: 'cancel-dialog',
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.selectedAppointment.set(null);
        this.overlayPosition.set(null);
        this.doCancelAppointment(apt);
      }
    });
  }

  private async doCancelAppointment(apt: Appointment) {
    await this.appointmentRepo.updateAppointment(apt.id, { status: 'cancelled' });
    this.alert.success({ message: 'Cita cancelada', duration: 3000 });
  }

  async deleteAppointment(apt: Appointment) {
    this.selectedAppointment.set(null);
    this.overlayPosition.set(null);
    const dialogRef = this.alert.confirm({
      title: 'Eliminar cita',
      message: `¿Deshabilitar la cita de ${apt.patientName}? No se borrará, solo se ocultará.`,
      confirmText: 'Eliminar',
    });
    const result = await dialogRef.afterClosed().toPromise();
    if (!result) return;
    await this.appointmentRepo.updateAppointment(apt.id, { disabled: true });
    const currentUser = this.authService.currentDoctor;
    await this.auditRepo.log({
      id: crypto.randomUUID(),
      action: 'delete',
      entityType: 'appointment',
      entityId: apt.id,
      performedBy: currentUser?.email ?? '',
      performedByUid: currentUser?.uid ?? '',
      timestamp: new Date() as any,
      oldValues: { status: apt.status, date: apt.date, time: apt.time, patientId: apt.patientId, doctorId: apt.doctorId },
    });
    this.alert.success({ message: 'Cita deshabilitada', duration: 3000 });
    this.cdr.markForCheck();
  }

  protected formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }


}
