import { Component, inject, signal, computed, OnInit, ViewChild, ChangeDetectorRef, ChangeDetectionStrategy, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators, FormArray } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
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
import { ClinicClockService } from '../../core/services/clinic-clock.service';
import { dateStringToLocalDate, dateToString } from '../../core/utils/date-utils';
import { AppointmentDetailCard } from '../../shared/components/appointment-detail-card/appointment-detail-card';
import { AppointmentDialog } from './dialogs/appointment-dialog/appointment-dialog';
import { SettingsDialog, SettingsData, SettingsSaveResult } from './dialogs/settings-dialog/settings-dialog';
import { buildAvailabilityFromUser } from '../../core/utils/availability';

import { Observable, Subscription, combineLatest } from 'rxjs';

export interface TimeSlot {
  hour: number;
  minute: number;
  label: string;
  key: string;
}

const DEFAULT_AVAILABILITY = buildAvailabilityFromUser({});

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
  private router = inject(Router);
  private readonly clock = inject(ClinicClockService);
  protected readonly calendarToday = computed(() => dateStringToLocalDate(this.clock.now().date));

  protected assistantAccessState = signal<'not-required' | 'checking' | 'ready' | 'blocked' | 'error'>(
    this.authService.currentDoctor?.role === 'assistant' ? 'checking' : 'not-required'
  );
  protected assistantAccessMessage = computed(() => this.assistantAccessState() === 'error'
    ? 'No fue posible verificar el Doctor asociado. Reintenta o contacta al responsable del consultorio.'
    : 'Tu cuenta no tiene un Doctor válido asociado. Contacta al responsable del consultorio.');
  protected signingOut = signal(false);
  private assistantUid: string | null = null;
  private associationVersion = 0;
  private destroyed = false;
  private doctorAssociationSub: Subscription | null = null;
  private assistantSessionSub: Subscription | null = null;
  private associationDialogs = new Set<{ close(): void }>();
  private patientAppointmentDialogs = new Map<AppointmentDialog, string | undefined>();

  readonly dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  readonly dayNamesShort = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  readonly monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  protected weekStart = signal<Date>(this.getWeekStart(this.calendarToday()));
  protected isCurrentWeek = computed(
    () => this.getWeekStart(this.calendarToday()).getTime() === this.weekStart().getTime()
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
  protected allPatients = signal<Patient[]>([]);
  protected allDoctors: AppUser[] = [];
  protected selectedDoctorId = signal<string>('');
  protected isAdmin = false;
  protected patientMode = signal(false);
  protected allowScheduling = signal(false);
  protected patientChildren = signal<Patient[]>([]);
  private readonly patientOccupancy = signal<ReadonlyArray<Pick<Appointment, 'id' | 'date' | 'time'>>>([]);
  protected readonly occupiedDays = computed(() => new Set(this.patientOccupancy().map((a) => a.date)));
  protected readonly occupiedSlots = computed(() => new Set(this.patientOccupancy().map((a) => `${a.date}|${a.time}`)));
  protected doctorName = '';
  protected doctorEmail = '';

  protected settingsForm = this.fb.group({
    consultationDuration: [30, Validators.required],
    allowPatientScheduling: [false],
    timeSegments: this.fb.array<{ startTime: string; endTime: string }>([]),
  });

  protected availableDaysSignal = signal<string[]>(DEFAULT_AVAILABILITY.availableDays);

  protected timeSegmentsByDaySignal = signal<Record<string, TimeSegment[]>>(DEFAULT_AVAILABILITY.timeSegmentsByDay);
  protected consultationDurationSignal = signal(30);
  protected configLoading = signal(true);

  protected selectedDay = signal<Date>(this.calendarToday());
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
    if (!this.canUseAssociation()) return;
    const doctor = this.authService.currentDoctor;
    const isAssistant = doctor?.role === 'assistant';
    const selectedDoctor = this.allDoctors.find(d => d.uid === this.selectedDoctorId());
    const data: SettingsData = {
      consultationDuration: this.settingsForm.value.consultationDuration ?? 30,
      allowPatientScheduling: this.settingsForm.value.allowPatientScheduling ?? false,
      timeSegmentsByDay: this.timeSegmentsByDaySignal(),
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
    this.trackAssociationDialog(dialogRef);
    dialogRef.afterClosed().subscribe((result) => {
      if (result && this.canUseAssociation()) {
        this.applySavedSettings(result);
      }
    });
  }

  private applySavedSettings(settings: SettingsSaveResult) {
    const availability = buildAvailabilityFromUser(settings);
    this.settingsForm.patchValue({
      consultationDuration: settings.consultationDuration,
      allowPatientScheduling: settings.allowPatientScheduling,
    });
    this.allowScheduling.set(settings.allowPatientScheduling);
    this.consultationDurationSignal.set(settings.consultationDuration);
    this.timeSegmentsByDaySignal.set(availability.timeSegmentsByDay);
    this.availableDaysSignal.set(availability.availableDays);

    this.timeSegmentsFormArray.clear();
    const firstDay = this.getDayShort(this.calendarToday());
    const firstSegments = availability.timeSegmentsByDay[firstDay]
      ?? availability.timeSegmentsByDay[availability.availableDays[0]]
      ?? [];
    for (const segment of firstSegments) {
      this.timeSegmentsFormArray.push(this.fb.group({
        startTime: segment.startTime,
        endTime: segment.endTime,
      }));
    }
    this.cdr.markForCheck();
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
    if (!this.canUseAssociation()) return;
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

  protected gridTemplateColumns = signal('90px repeat(7, 1fr)');

  protected headerDays = computed(() =>
    this.weekDays().map((day) => ({
      day,
      key: day.getTime(),
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
          key: day.getTime(),
          day,
          slot,
          isToday: this.isToday(day),
          isCurrentHour: this.isToday(day) && this.isCurrentHour(slot),
          isAvailable: this.isCellAvailable(day, slot),
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
    const byDay = this.timeSegmentsByDaySignal();
    const duration = this.consultationDurationSignal();
    const allAppts = this.allAppointments();

    let overallStart = 1440;
    let overallEnd = 0;
    for (const day of Object.keys(byDay)) {
      for (const seg of byDay[day] ?? []) {
        const [sh, sm] = seg.startTime.split(':').map(Number);
        let [eh, em] = seg.endTime.split(':').map(Number);
        if (eh === 0 && em === 0) eh = 24;
        overallStart = Math.min(overallStart, sh * 60 + sm);
        overallEnd = Math.max(overallEnd, eh * 60 + em);
      }
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

  private segmentsForDay(dayShort: string): TimeSegment[] {
    return this.timeSegmentsByDaySignal()[dayShort] ?? [];
  }

  protected isDayAvailable(date: Date): boolean {
    return this.segmentsForDay(this.getDayShort(date)).length > 0;
  }

  private isSlotInSegments(dayShort: string, slotKey: string): boolean {
    const [shh, smm] = slotKey.split(':').map(Number);
    const t = shh * 60 + smm;
    for (const seg of this.segmentsForDay(dayShort)) {
      const [sh, sm] = seg.startTime.split(':').map(Number);
      let [eh, em] = seg.endTime.split(':').map(Number);
      if (eh === 0 && em === 0) eh = 24;
      if (t >= sh * 60 + sm && t < eh * 60 + em) return true;
    }
    return false;
  }

  protected isCellAvailable(day: Date, slot: TimeSlot): boolean {
    if (!this.isDayAvailable(day)) return false;
    return this.isSlotInSegments(this.getDayShort(day), slot.key);
  }

  protected canInteractWithCell(date: Date): boolean {
    if (!this.canUseAssociation()) return false;
    if (this.patientMode()) {
      return this.allowScheduling() && this.isDayAvailable(date);
    }
    return true;
  }

  protected isCellTaken(day: Date, slot: TimeSlot): boolean {
    if (!this.patientMode()) return false;
    return this.occupiedSlots().has(`${this.formatDate(day)}|${slot.key}`);
  }

  private get timeSegmentsFormArray() {
    return this.settingsForm.get('timeSegments') as FormArray;
  }

  private canUseAssociation(): boolean {
    if (this.destroyed) return false;
    const user = this.authService.currentDoctor;
    if (this.assistantAccessState() === 'not-required') return user?.role !== 'assistant';
    return this.assistantAccessState() === 'ready' && user?.role === 'assistant'
      && user.uid === this.assistantUid && user.createdBy === this.selectedDoctorId();
  }

  private isActiveDoctor(user: AppUser | null, doctorId: string): user is AppUser {
    return !!user && user.uid === doctorId && user.role === 'doctor'
      && user.pending !== true && user.profileComplete === true;
  }

  private closeAssociationDialogs() {
    const dialogs = [...this.associationDialogs];
    this.associationDialogs.clear();
    dialogs.forEach((dialog) => dialog.close());
  }

  private trackAssociationDialog(dialog: { close(): void; afterClosed(): Observable<unknown> }) {
    if (!this.assistantUid) return;
    this.associationDialogs.add(dialog);
    dialog.afterClosed().subscribe(() => this.associationDialogs.delete(dialog));
  }

  private clearAssistantCalendar(state: 'checking' | 'blocked' | 'error') {
    this.associationVersion++;
    this.assistantAccessState.set(state);
    this.appointmentSub?.unsubscribe();
    this.appointmentSub = null;
    this.doctorAssociationSub?.unsubscribe();
    this.doctorAssociationSub = null;
    this.focusSub?.unsubscribe();
    this.focusSub = null;
    this.selectedDoctorId.set('');
    this.allPatients.set([]);
    this.allAppointments.set([]);
    this.availableDaysSignal.set([]);
    this.timeSegmentsByDaySignal.set({});
    this.allowScheduling.set(false);
    this.doctorName = '';
    this.doctorEmail = '';
    this.pendingFocus = null;
    this.focusedAppointmentId.set(null);
    this.expandedAppointmentId.set(null);
    this.closeAppointmentDetails();
    this.configLoading.set(state === 'checking');
    this.closeAssociationDialogs();
  }

  private async loadAssistantCalendar() {
    if (this.destroyed) return;
    this.assistantSessionSub?.unsubscribe();
    const assistant = this.authService.currentDoctor;
    if (assistant?.role !== 'assistant') return;
    this.assistantUid = assistant.uid;
    this.clearAssistantCalendar('checking');
    const doctorId = assistant.createdBy ?? '';
    const version = this.associationVersion;
    this.assistantSessionSub = this.authService.session$.subscribe(() => {
      const current = this.authService.currentDoctor;
      if (current?.role !== 'assistant' || current.uid !== this.assistantUid || (current.createdBy ?? '') !== doctorId) {
        this.clearAssistantCalendar('blocked');
      }
    });
    if (!doctorId.trim()) {
      this.clearAssistantCalendar('blocked');
      return;
    }
    try {
      const doctor = await this.userRepo.getUser(doctorId);
      if (this.destroyed || version !== this.associationVersion) return;
      if (!this.isActiveDoctor(doctor, doctorId)) {
        this.clearAssistantCalendar('blocked');
        return;
      }
      this.selectedDoctorId.set(doctorId);
      this.assistantAccessState.set('ready');
      const watch = this.userRepo.watchUser(doctorId).subscribe({
        next: (currentDoctor) => {
          if (!this.destroyed && version === this.associationVersion && !this.isActiveDoctor(currentDoctor, doctorId)) {
            this.clearAssistantCalendar('blocked');
          }
        },
        error: () => {
          if (!this.destroyed && version === this.associationVersion) this.clearAssistantCalendar('error');
        },
      });
      if (this.destroyed || version !== this.associationVersion) {
        watch.unsubscribe();
        return;
      }
      this.doctorAssociationSub = watch;
      await this.reloadPatients();
      if (this.destroyed || version !== this.associationVersion || !this.canUseAssociation()) return;
      await this.loadDoctorData(doctorId, undefined, doctor);
      if (!this.canUseAssociation()) return;
      if (history.state?.openAppointment) {
        this.openSideAppointment();
        const { openAppointment: _openAppointment, ...navigationState } = history.state;
        history.replaceState(navigationState, '');
      }
      this.focusSub = this.focusService.target$.subscribe((focus) => {
        if (!focus || !this.canUseAssociation()) return;
        this.focusService.clear();
        this.applyFocus(focus);
      });
    } catch {
      if (!this.destroyed && version === this.associationVersion) this.clearAssistantCalendar('error');
    }
  }

  protected async retryAssistantAccess() {
    if (this.assistantAccessState() === 'checking' || this.signingOut()) return;
    const assistant = this.authService.currentDoctor;
    if (assistant?.role !== 'assistant') return;
    const uid = assistant.uid;
    const previousDoctorId = assistant.createdBy;
    this.assistantSessionSub?.unsubscribe();
    this.clearAssistantCalendar('checking');
    const version = this.associationVersion;
    try {
      const current = await this.userRepo.getUser(uid);
      if (this.destroyed || version !== this.associationVersion) return;
      const sessionUser = this.authService.currentDoctor;
      if (sessionUser?.role !== 'assistant' || sessionUser.uid !== uid || sessionUser.createdBy !== previousDoctorId) {
        this.clearAssistantCalendar('blocked');
        return;
      }
      if (!current || current.uid !== uid || current.role !== 'assistant'
        || current.pending === true || current.profileComplete !== true) {
        this.clearAssistantCalendar('blocked');
        return;
      }
      this.authService.updateCurrentDoctor(current);
      await this.loadAssistantCalendar();
    } catch {
      if (!this.destroyed && version === this.associationVersion) this.clearAssistantCalendar('error');
    }
  }

  protected async logoutAssistant() {
    if (this.signingOut()) return;
    this.signingOut.set(true);
    try {
      await this.authService.logout();
      await this.router.navigate(['/login']);
    } catch {
      this.alert.error({ message: 'No fue posible cerrar sesión. Intenta nuevamente.', duration: 5000 });
    } finally {
      this.signingOut.set(false);
    }
  }

  private async loadDoctorData(doctorId: string, patientIds?: string[], verifiedDoctor?: AppUser) {
    const version = this.associationVersion;
    const user = verifiedDoctor ?? await this.userRepo.getUser(doctorId);
    if (this.destroyed || version !== this.associationVersion || !this.canUseAssociation()) return;

    if (this.appointmentSub) {
      this.appointmentSub.unsubscribe();
      this.appointmentSub = null;
    }

    if (this.patientMode()) {
      // Family appointments and anonymous occupied slots use separate live queries.
      const patientSet = new Set(patientIds ?? []);
      this.appointmentSub = combineLatest([
        this.appointmentRepo.watchAppointmentsByDoctor(doctorId),
        this.appointmentRepo.watchOccupiedSlots(doctorId),
      ]).subscribe(([appts, occupied]) => {
          if (this.destroyed || version !== this.associationVersion || !this.canUseAssociation()) return;
          const valid = appts.filter((a) => a.disabled !== true && a.status !== 'cancelled');
          this.patientOccupancy.set(occupied.map(({ id, date, time }) => ({ id, date, time })));
          const mine = valid.filter((a) => patientSet.has(a.patientId));
          for (const [dialog, editingId] of this.patientAppointmentDialogs) {
            dialog.setOccupiedSlots(this.patientOccupiedSlotsExcept(editingId), mine);
          }
          this.allAppointments.set(mine);
          this.applyPendingFocus();
          this.cdr.markForCheck();
        });
    } else {
      this.appointmentSub = this.appointmentRepo.watchAppointmentsByDoctor(doctorId).subscribe((fromDoctor) => {
        if (this.destroyed || version !== this.associationVersion || !this.canUseAssociation()) return;
        const seen = new Set<string>();
        const merged = fromDoctor.filter((a) => {
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

    this.configLoading.set(true);
    if (user) {
      this.settingsForm.patchValue({
        consultationDuration: user.consultationDuration ?? 30,
        allowPatientScheduling: user.allowPatientScheduling ?? false,
      });
      this.consultationDurationSignal.set(user.consultationDuration ?? 30);

      const availability = buildAvailabilityFromUser(user);
      this.timeSegmentsByDaySignal.set(availability.timeSegmentsByDay);
      this.availableDaysSignal.set(availability.availableDays);

      this.timeSegmentsFormArray.clear();
      const firstDay = this.getDayShort(this.calendarToday());
      const firstSegs = availability.timeSegmentsByDay[firstDay] ?? availability.timeSegmentsByDay[Object.keys(availability.timeSegmentsByDay)[0]] ?? [];
      for (const seg of firstSegs) {
        this.timeSegmentsFormArray.push(this.fb.group({ startTime: seg.startTime, endTime: seg.endTime }));
      }
    }
    this.configLoading.set(false);
    this.cdr.markForCheck();
  }

  async ngOnInit() {
    const doctor = this.authService.currentDoctor;
    const patient = this.authService.currentPatient;

    // Modo paciente: calendario de US citas con el doctor con el que se logueó.
    if (patient) {
      this.patientMode.set(true);
      this.isAdmin = false;
      const doctorId = patient.doctorId ?? '';
      this.selectedDoctorId.set(doctorId);
      const loginEmail = this.authService.currentPatientLoginEmail ?? patient.email;
      const group = await this.patientRepo.getChildrenGroup(loginEmail, patient.doctorId ?? '');
      this.patientChildren.set(group);
      this.allPatients.set(group);
      await this.loadDoctorData(doctorId, group.map((c) => c.id));

      this.focusSub = this.focusService.target$.subscribe((focus) => {
        if (!focus) return;
        this.focusService.clear();
        this.applyFocus(focus);
      });
      return;
    }

    if (!doctor) return;

    if (doctor.role === 'assistant') {
      await this.loadAssistantCalendar();
      return;
    }

    this.isAdmin = doctor.role === 'admin';

    const doctorId = doctor.role === 'doctor' ? doctor.uid : '';
    this.selectedDoctorId.set(doctorId);
    if (!doctorId) {
      this.allPatients.set([]);
      this.allAppointments.set([]);
      this.configLoading.set(false);
      return;
    }

    await this.reloadPatients();
    this.cdr.markForCheck();

    if (this.isAdmin) {
      this.userRepo.watchAllUsers().subscribe((users) => {
        this.allDoctors = users.filter(u => u.role === 'admin' || u.role === 'doctor');
        this.cdr.markForCheck();
      });
    }

    await this.loadDoctorData(doctorId);

    if (history.state?.openAppointment) {
      this.openSideAppointment();
      const { openAppointment: _openAppointment, ...navigationState } = history.state;
      history.replaceState(navigationState, '');
    }

    this.focusSub = this.focusService.target$.subscribe((focus) => {
      if (!focus) return;
      this.focusService.clear();
      this.applyFocus(focus);
    });
  }

  private async reloadPatients() {
    if (this.destroyed || !this.canUseAssociation()) return;
    const version = this.associationVersion;
    const doctorId = this.selectedDoctorId();
    const user = this.authService.currentDoctor;
    const scope = user?.role === 'doctor' ? user.uid : user?.role === 'assistant' ? user.createdBy : '';
    if (!doctorId || doctorId !== scope) {
      this.allPatients.set([]);
      return;
    }
    try {
      const patients = await this.patientRepo.getPatientsByDoctor(doctorId);
      const current = this.authService.currentDoctor;
      const currentScope = current?.role === 'doctor' ? current.uid : current?.role === 'assistant' ? current.createdBy : '';
      if (!this.destroyed && version === this.associationVersion && this.canUseAssociation()
        && this.selectedDoctorId() === doctorId && currentScope === doctorId) {
        this.allPatients.set(patients.filter((patient) => patient.doctorId === doctorId));
      }
    } catch {
      if (this.destroyed || version !== this.associationVersion || !this.canUseAssociation()) return;
      this.allPatients.set([]);
      this.alert.error({ message: 'No fue posible cargar los pacientes de esta agenda. Intenta abrir la página nuevamente.', duration: 5000 });
    }
  }

  private applyFocus(focus: { date: string; time: string; appointmentId: string }) {
    if (this.destroyed || !this.canUseAssociation()) return;
    this.pendingFocus = this.pendingFocus ?? focus;
    const d = new Date(focus.date + 'T12:00:00');
    if (!isNaN(d.getTime())) {
      this.weekStart.set(this.getWeekStart(d));
      this.selectedDay.set(d);
    }
    this.applyPendingFocus();
  }

  private applyPendingFocus() {
    if (!this.pendingFocus || this.destroyed || !this.canUseAssociation()) return;
    const version = this.associationVersion;
    const target = this.pendingFocus;

    const found = this.allAppointments().find(
      (a) => a.id === target.appointmentId
    );

    this.focusedAppointmentId.set(target.appointmentId);
    this.selectedDay.set(new Date(target.date + 'T12:00:00'));
    setTimeout(() => {
      if (this.destroyed || version !== this.associationVersion || !this.canUseAssociation()) return;
      const now = this.weekStart();
      const currentWeek = new Date(now);
      currentWeek.setDate(currentWeek.getDate() + 7);
      const targetDate = new Date(target.date + 'T12:00:00');
      if (targetDate < now || targetDate >= currentWeek) {
        this.weekStart.set(this.getWeekStart(targetDate));
      }
      setTimeout(() => {
        if (this.destroyed || version !== this.associationVersion || !this.canUseAssociation()) return;
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
    this.destroyed = true;
    this.associationVersion++;
    this.doctorAssociationSub?.unsubscribe();
    this.assistantSessionSub?.unsubscribe();
    this.closeAssociationDialogs();
    this.patientAppointmentDialogs.clear();
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
    this.clock.refresh();
    this.weekStart.set(this.getWeekStart(this.calendarToday()));
    this.selectedDay.set(this.calendarToday());
  }

  jumpToWeek(dateValue: string) {
    const d = new Date(dateValue + 'T12:00:00');
    if (isNaN(d.getTime())) return;
    this.weekStart.set(this.getWeekStart(d));
  }

  isToday(date: Date): boolean {
    return dateToString(date) === this.clock.now().date;
  }

  isCurrentHour(slot: TimeSlot): boolean {
    const duration = this.consultationDurationSignal();
    const nowMinutes = this.clock.now().minutes;
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

  private patientOccupiedSlotsExcept(editingId?: string): string[] {
    // Excluir por ID antes de agrupar: otra cita en la misma hora sigue ocupándola.
    return [...new Set(this.patientOccupancy()
      .filter((a) => a.id !== editingId)
      .map((a) => `${a.date}|${a.time}`))];
  }

  private openAppointmentDialog(editingAppointment?: Appointment | null, prefill?: { date: Date; slot: TimeSlot }) {
    if (!this.selectedDoctorId() || !this.canUseAssociation()) return;
    const dialogRef = this.dialog.open(AppointmentDialog, {
      width: '400px',
      disableClose: false,
      panelClass: 'right-panel',
    });
    const instance = dialogRef.componentInstance;
    this.trackAssociationDialog(dialogRef);
    const patient = this.patientMode() ? this.authService.currentPatient : null;
    const patients = this.patientMode() ? this.patientChildren() : this.allPatients();

    const baseData = {
      allPatients: patients,
      selectedDoctorId: this.patientMode() ? (patient?.doctorId ?? this.selectedDoctorId()) : this.selectedDoctorId(),
      timeSegmentsByDay: this.timeSegmentsByDaySignal(),
      consultationDuration: this.consultationDurationSignal(),
      existingAppointments: this.allAppointments().filter((a) => !a.disabled && a.status !== 'cancelled'),
      doctorName: this.doctorName,
      doctorEmail: this.doctorEmail,
      patientScheduling: this.patientMode() ? this.allowScheduling() : false,
      availableDays: this.patientMode() ? this.availableDaysSignal() : [],
      occupiedSlots: this.patientMode() ? this.patientOccupiedSlotsExcept(editingAppointment?.id) : [],
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
    if (this.patientMode()) {
      this.patientAppointmentDialogs.set(instance, editingAppointment?.id);
      instance.hideAddPatient.set(true);
      const kids = this.patientChildren();
      if (kids.length === 1) {
        instance.lockPatient(kids[0].id);
      }
    }

    dialogRef.afterClosed().subscribe(async (result) => {
      this.patientAppointmentDialogs.delete(instance);
      if (this.destroyed || !this.canUseAssociation()) return;
      // A patient may have been created even if the appointment was closed without saving.
      if (!this.patientMode()) await this.reloadPatients();
      if (result) {
        this.cdr.markForCheck();
      }
    });
  }

  protected selectAppointment(apt: Appointment, event: MouseEvent) {
    if (!this.canUseAssociation()) return;
    this.selectedAppointment.set(apt);
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.overlayPosition.set({ top: rect.bottom + 4, left: rect.left });
  }

  protected closeAppointmentDetails() {
    this.selectedAppointment.set(null);
    this.overlayPosition.set(null);
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
    if (this.patientMode() && !this.allowScheduling()) return;
    this.selectedAppointment.set(null);
    this.overlayPosition.set(null);
    this.expandedAppointmentId.set(null);
    this.openAppointmentDialog(apt);
  }

  protected async cancelAppointment(apt: Appointment) {
    if (this.patientMode() && !this.allowScheduling()) {
      this.alert.error({ message: 'Solicita al consultorio la cancelación de tu consulta.', duration: 5000 });
      return;
    }
    if (!this.canUseAssociation()) return;
    const version = this.associationVersion;
    this.selectedAppointment.set(null);
    this.overlayPosition.set(null);
    const dialogRef = this.alert.confirm({
      title: 'Cancelar consulta',
      message: this.patientMode()
        ? 'Al cancelar una consulta el o la doctora recibirá una notificación de la cancelación.'
        : 'Al cancelar una consulta el padre o tutor del paciente recibirá una notificación de la cancelación y podrá seleccionar un nuevo día y horario para la consulta si así lo desea.',
      confirmText: 'Cancelar consulta',
      cancelText: 'Cerrar',
      confirmClass: 'btn-danger dialog-btn',
    });
    this.trackAssociationDialog(dialogRef);
    const result = await dialogRef.afterClosed().toPromise();
    if (!result || version !== this.associationVersion || !this.canUseAssociation()) return;
    await this.doCancelAppointment(apt);
  }

  private async doCancelAppointment(apt: Appointment) {
    if (this.patientMode() && !this.allowScheduling()) {
      this.alert.error({ message: 'Solicita al consultorio la cancelación de tu consulta.', duration: 5000 });
      return;
    }
    try {
      await this.appointmentRepo.updateAppointment(apt.id, { status: 'cancelled' });

      this.alert.success({ message: 'Cita cancelada', duration: 3000 });
    } catch {
      this.alert.error({ message: 'No fue posible cancelar la consulta. Intenta nuevamente.', duration: 5000 });
    }
  }

  async deleteAppointment(apt: Appointment) {
    if (!this.canUseAssociation()) return;
    const version = this.associationVersion;
    this.selectedAppointment.set(null);
    this.overlayPosition.set(null);
    const dialogRef = this.alert.confirm({
      title: 'Eliminar cita',
      message: `¿Deshabilitar la cita de ${apt.patientName}? No se borrará, solo se ocultará.`,
      confirmText: 'Eliminar',
    });
    this.trackAssociationDialog(dialogRef);
    const result = await dialogRef.afterClosed().toPromise();
    if (!result || version !== this.associationVersion || !this.canUseAssociation()) return;
    try {
      await this.appointmentRepo.updateAppointment(apt.id, { disabled: true });
      const currentUser = this.authService.currentDoctor;

      this.alert.success({ message: 'Cita deshabilitada', duration: 3000 });
    } catch {
      this.alert.error({ message: 'No fue posible eliminar la consulta. Intenta nuevamente.', duration: 5000 });
    }
    this.cdr.markForCheck();
  }

  protected formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }


}
