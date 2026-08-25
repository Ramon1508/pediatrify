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
import { NotificationService } from '../../core/services/notification.service';
import { CalendarFocusService } from '../../core/services/calendar-focus.service';
import { AppointmentDetailCard } from '../../shared/components/appointment-detail-card/appointment-detail-card';
import { AppointmentDialog } from './dialogs/appointment-dialog/appointment-dialog';
import { SettingsDialog, SettingsData } from './dialogs/settings-dialog/settings-dialog';

import { Subscription, combineLatest } from 'rxjs';

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
  private notifications = inject(NotificationService);
  private dialog = inject(MatDialog);
  private cdr = inject(ChangeDetectorRef);
  private focusService = inject(CalendarFocusService);

  readonly dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  readonly dayNamesShort = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  readonly monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  protected weekStart = signal<Date>(this.getWeekStart(new Date()));
  protected isCurrentWeek = computed(
    () => this.getWeekStart(new Date()).getTime() === this.weekStart().getTime()
  );
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
  protected patientMode = false;
  protected allowScheduling = signal(false);
  protected patientChildren = signal<Patient[]>([]);
  protected occupiedDays = signal<Set<string>>(new Set());
  protected occupiedSlots = signal<Set<string>>(new Set());
  protected doctorName = '';
  protected doctorEmail = '';

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
  protected focusedAppointmentId = signal<string | null>(null);

  private pendingFocus: { date: string; time: string; appointmentId: string } | null = null;

  private appointmentSub: Subscription | null = null;
  private focusSub: Subscription | null = null;

  @ViewChild('picker') materialPicker!: any;

  protected onDateSelected(event: any) {
    const d = event?.value;
    if (!d || isNaN(d.getTime())) return;
    // Desktop: la semana se ancla al día elegido. Mobile: el día seleccionado
    // muestra SOLO esas citas (getAppointmentsForDay usa selectedDay).
    this.weekStart.set(this.getWeekStart(d));
    this.selectedDay.set(d);
  }

  protected openDatePicker() {
    this.materialPicker?.open();
  }

  protected openSettingsDialog() {
    const doctor = this.authService.currentDoctor;
    const isAssistant = doctor?.role === 'assistant';
    const selectedDoctor = this.allDoctors.find(d => d.uid === this.selectedDoctorId());
    const data: SettingsData = {
      consultationDuration: this.settingsForm.value.consultationDuration ?? 30,
      allowPatientScheduling: this.settingsForm.value.allowPatientScheduling ?? false,
      timeSegments: (this.settingsForm.value.timeSegments ?? []) as TimeSegment[],
      availableDays: this.availableDaysSignal(),
      doctorId: this.selectedDoctorId(),
      doctorEmail: selectedDoctor?.email ?? (isAssistant ? undefined : doctor?.email),
    };
    const dialogRef = this.dialog.open(SettingsDialog, {
      width: '400px',
      disableClose: false,
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

  protected selectedDayFormatted = computed(() => this.formatDate(this.selectedDay()));

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

  /** Al tocar un chip en mobile: foca/azul, ajusta la fecha y hace auto-scroll. */
  protected focusMobileAppointment(apt: Appointment) {
    this.focusedAppointmentId.set(apt.id);
    const d = new Date(apt.date + 'T12:00:00');
    if (!isNaN(d.getTime())) {
      this.selectedDay.set(d);
      this.weekStart.set(this.getWeekStart(d));
    }
    this.toggleExpand(apt.id);
    setTimeout(() => {
      const el = document.querySelector(`[data-appointment-id="${apt.id}"]`);
      if (el && typeof (el as HTMLElement).scrollIntoView === 'function') {
        (el as HTMLElement).scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      this.cdr.markForCheck();
    }, 50);
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

  protected gridTemplateColumns = '90px repeat(7, 1fr)';

  protected headerDays = computed(() =>
    this.weekDays().map((day) => ({
      day,
      date: day.getDate(),
      name: this.dayNames[day.getDay()],
      isToday: this.isToday(day),
      isAvailable: this.isDayAvailable(day),
    }))
  );

  protected gridRows = computed(() =>
    this.timeSlots().map((slot) => {
      const cells = this.weekDays().map((day) => {
        const appointments = this.getAppointmentsForCell(day, slot);
        return {
          day,
          slot,
          isToday: this.isToday(day),
          isCurrentHour: this.isToday(day) && this.isCurrentHour(slot),
          isAvailable: this.isDayAvailable(day),
          canInteract: this.canInteractWithCell(day),
          isTaken: this.isCellTaken(day, slot),
          appointments,
          isHovered: this.isHovered(day, slot),
        };
      });
      return { slot, cells };
    })
  );

  protected mobileDayAppointments = computed(() =>
    this.getAppointmentsForDay()
      .slice()
      .sort((a, b) => a.time.localeCompare(b.time))
      .map((apt) => ({
        apt,
        timeLabel: this.formatTime(apt.time),
      }))
  );

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

  protected hoveredCell = signal<{ date: Date; slot: TimeSlot } | null>(null);

  protected timeSlots = computed(() => {
    const segments = this.timeSegmentsSignal();
    const duration = this.consultationDurationSignal();
    const allAppts = this.allAppointments();

    let overallStart = 1440;
    let overallEnd = 0;
    for (const seg of segments) {
      const [sh, sm] = seg.startTime.split(':').map(Number);
      let [eh, em] = seg.endTime.split(':').map(Number);
      if (eh === 0 && em === 0) eh = 24;
      overallStart = Math.min(overallStart, sh * 60 + sm);
      overallEnd = Math.max(overallEnd, eh * 60 + em);
    }
    for (const apt of allAppts) {
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

  protected canInteractWithCell(date: Date): boolean {
    if (this.patientMode) {
      return this.allowScheduling() && this.isDayAvailable(date);
    }
    return true;
  }

  protected isCellTaken(day: Date, slot: TimeSlot): boolean {
    if (!this.patientMode) return false;
    return this.occupiedSlots().has(`${this.formatDate(day)}|${slot.key}`);
  }

  protected onDoctorSelected(doctorId: string) {
    this.selectedDoctorId.set(doctorId);
    this.loadDoctorData(doctorId);
  }

  private get timeSegmentsFormArray() {
    return this.settingsForm.get('timeSegments') as FormArray;
  }

  private async loadDoctorData(doctorId: string, patientIds?: string[]) {
    const user = await this.userRepo.getUser(doctorId);
    const email = user?.email ?? '';

    if (this.appointmentSub) {
      this.appointmentSub.unsubscribe();
      this.appointmentSub = null;
    }

    if (this.patientMode) {
      // Modo paciente: realtime del doctor; solo sus hijos (chips) y deshabilita SOLO las horas
      // con citas registradas (sin mostrar info ajena).
      const patientSet = new Set(patientIds ?? []);
      this.appointmentSub = this.appointmentRepo
        .watchAppointmentsByDoctor(doctorId)
        .subscribe((appts) => {
          const valid = appts.filter((a) => a.disabled !== true);
          this.occupiedSlots.set(new Set(valid.map((a) => `${a.date}|${a.time}`)));
          const mine = valid.filter((a) => patientSet.has(a.patientId));
          this.occupiedDays.set(new Set(valid.map((a) => a.date)));
          this.allAppointments.set(mine);
          this.applyPendingFocus();
          this.cdr.markForCheck();
        });
    } else {
      const byDoctor = this.appointmentRepo.watchAppointmentsByDoctor(doctorId);
      const byEmail = email
        ? this.appointmentRepo.watchAppointmentsByUpdatedBy(email)
        : byDoctor;

      this.appointmentSub = combineLatest([byDoctor, byEmail]).subscribe(([fromDoctor, fromEmail]) => {
        const seen = new Set<string>();
        const merged = [...fromDoctor, ...fromEmail].filter((a) => {
          if (a.disabled) return false;
          if (seen.has(a.id)) return false;
          seen.add(a.id);
          return true;
        });
        this.allAppointments.set(merged);
        this.applyPendingFocus();
        this.cdr.markForCheck();
      });
    }

    this.allowScheduling.set(user?.allowPatientScheduling ?? false);
    this.doctorName = user?.name ?? '';
    this.doctorEmail = user?.email ?? '';

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
    const patient = this.authService.currentPatient;
    // eslint-disable-next-line no-console
    console.log('[calendar ngOnInit]', {
      sessionType: this.authService.isPatient ? 'patient' : 'doctor',
      hasPatient: !!patient,
      patientId: patient?.id,
      patientDoctorId: patient?.doctorId,
      hasDoctor: !!doctor,
      doctorId: doctor?.uid,
    });

    // Modo paciente: calendario de US citas con el doctor con el que se logueó.
    if (patient) {
      this.patientMode = true;
      this.isAdmin = false;
      const doctorId = patient.doctorId ?? '';
      this.selectedDoctorId.set(doctorId);
      const loginEmail = this.authService.currentPatientLoginEmail ?? patient.email;
      console.log('[calendar patient]', { loginEmail, patientId: patient.id, doctorId: patient.doctorId });
      const group = await this.patientRepo.getChildrenGroup(loginEmail, patient.doctorId ?? '');
      this.patientChildren.set(group);
      this.allPatients = group;
      await this.loadDoctorData(doctorId, group.map((c) => c.id));

      this.focusSub = this.focusService.target$.subscribe((focus) => {
        if (!focus) return;
        this.focusService.clear();
        this.applyFocus(focus);
      });
      return;
    }

    if (!doctor) return;

    this.isAdmin = doctor.role === 'admin';

    const isAssistant = doctor.role === 'assistant';
    const doctorId = isAssistant ? ((doctor as any).createdBy || doctor.uid) : doctor.uid;
    this.selectedDoctorId.set(doctorId);

    this.allPatients = await this.patientRepo.getAllPatients();
    this.cdr.markForCheck();

    if (this.isAdmin) {
      this.userRepo.watchAllUsers().subscribe((users) => {
        this.allDoctors = users.filter(u => u.role === 'admin' || u.role === 'doctor');
        this.cdr.markForCheck();
      });
    }

    this.loadDoctorData(doctorId);

    this.focusSub = this.focusService.target$.subscribe((focus) => {
      if (!focus) return;
      this.focusService.clear();
      this.applyFocus(focus);
    });
  }

  private applyFocus(focus: { date: string; time: string; appointmentId: string }) {
    this.pendingFocus = this.pendingFocus ?? focus;
    const d = new Date(focus.date + 'T12:00:00');
    if (!isNaN(d.getTime())) {
      this.weekStart.set(this.getWeekStart(d));
      this.selectedDay.set(d);
    }
    this.applyPendingFocus();
  }

  private applyPendingFocus() {
    if (!this.pendingFocus) return;
    const target = this.pendingFocus;

    const found = this.allAppointments().find(
      (a) => a.id === target.appointmentId
    );

    this.focusedAppointmentId.set(target.appointmentId);
    this.selectedDay.set(new Date(target.date + 'T12:00:00'));
    setTimeout(() => {
      const now = this.weekStart();
      const currentWeek = new Date(now);
      currentWeek.setDate(currentWeek.getDate() + 7);
      const targetDate = new Date(target.date + 'T12:00:00');
      if (targetDate < now || targetDate >= currentWeek) {
        this.weekStart.set(this.getWeekStart(targetDate));
      }
      setTimeout(() => {
        const el = document.querySelector(`[data-appointment-id="${target.appointmentId}"]`);
        if (el && typeof (el as HTMLElement).scrollIntoView === 'function') {
          (el as HTMLElement).scrollIntoView({ block: 'center', behavior: 'smooth' });
          this.cdr.markForCheck();
          this.pendingFocus = null;
        } else if (found) {
          this.pendingFocus = null;
        }
        if (found) {
          this.selectedAppointment.set(found);
        }
      }, 50);
    }, 50);
  }

  ngOnDestroy() {
    if (this.appointmentSub) {
      this.appointmentSub.unsubscribe();
    }
    this.focusSub?.unsubscribe();
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
    this.selectedDay.set(new Date());
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
    this.hoveredCell.set({ date, slot });
  }

  onCellLeave() {
    this.hoveredCell.set(null);
  }

  getAppointmentsForCell(date: Date, slot: TimeSlot): Appointment[] {
    const dateStr = this.formatDate(date);
    const timeStr = `${slot.hour.toString().padStart(2, '0')}:${slot.minute.toString().padStart(2, '0')}`;
    const all = this.allAppointments();
    const result = all.filter(
      (a) => a.date === dateStr && a.time === timeStr && a.status !== 'cancelled'
    );
    return result;
  }

  isHovered(date: Date, slot: TimeSlot): boolean {
    const hovered = this.hoveredCell();
    if (!hovered) return false;
    return (
      hovered.date.getTime() === date.getTime() &&
      hovered.slot.key === slot.key
    );
  }

  private openAppointmentDialog(editingAppointment?: Appointment | null, prefill?: { date: Date; slot: TimeSlot }) {
    const dialogRef = this.dialog.open(AppointmentDialog, {
      width: '400px',
      disableClose: false,
      panelClass: 'right-panel',
    });
    const instance = dialogRef.componentInstance;
    const segments = this.timeSegmentsSignal();
    const patient = this.patientMode ? this.authService.currentPatient : null;
    const patients = this.patientMode ? this.patientChildren() : this.allPatients;

    const baseData = {
      allPatients: patients,
      selectedDoctorId: this.patientMode ? (patient?.doctorId ?? this.selectedDoctorId()) : this.selectedDoctorId(),
      timeSegments: segments,
      consultationDuration: this.consultationDurationSignal(),
      existingAppointments: this.allAppointments(),
      doctorName: this.doctorName,
      doctorEmail: this.doctorEmail,
      patientScheduling: this.patientMode ? this.allowScheduling() : false,
      availableDays: this.patientMode ? this.availableDaysSignal() : [],
      occupiedSlots: this.patientMode ? [...this.occupiedSlots()] : [],
    };
    if (prefill) {
      const dateStr = this.formatDate(prefill.date);
      const timeStr = `${prefill.slot.hour.toString().padStart(2, '0')}:${prefill.slot.minute.toString().padStart(2, '0')}`;
      instance.setData({ ...baseData, editingAppointment: null });
      instance.setPrefill(dateStr, timeStr);
    } else if (editingAppointment) {
      instance.setData({ ...baseData, editingAppointment });
    } else {
      instance.setData({ ...baseData, editingAppointment: null });
    }
    if (this.patientMode) {
      instance.hideAddPatient = true;
      const kids = this.patientChildren();
      if (kids.length === 1) {
        instance.lockPatient(kids[0].id);
      }
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

  protected async cancelAppointment(apt: Appointment) {
    this.selectedAppointment.set(null);
    this.overlayPosition.set(null);
    const dialogRef = this.alert.confirm({
      title: 'Cancelar consulta',
      message: 'Al cancelar una consulta el padre o tutor del paciente recibirá una notificación de la cancelación y podrá seleccionar un nuevo día y horario para la consulta si así lo desea.',
      confirmText: 'Cancelar consulta',
      cancelText: 'Cerrar',
      confirmClass: 'btn-danger dialog-btn',
    });
    const result = await dialogRef.afterClosed().toPromise();
    if (!result) return;
    await this.doCancelAppointment(apt);
  }

  private async doCancelAppointment(apt: Appointment) {
    await this.appointmentRepo.updateAppointment(apt.id, { status: 'cancelled' });
    await this.notifications.notifyAppointmentCancelled(apt);
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
