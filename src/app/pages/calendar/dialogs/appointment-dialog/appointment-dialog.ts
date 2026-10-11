import { Component, computed, effect, inject, signal, ChangeDetectionStrategy, ChangeDetectorRef, ElementRef, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CommonModule } from '@angular/common';
import { AppointmentRepository } from '../../../../core/repositories/appointment.repository';
import { AuditRepository } from '../../../../core/repositories/audit.repository';
import { PatientRepository } from '../../../../core/repositories/patient.repository';
import { AuthService } from '../../../../core/services/auth.service';
import { AlertService } from '../../../../core/services/alert.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ClinicClockService } from '../../../../core/services/clinic-clock.service';
import { Appointment, Patient, TimeSegment } from '../../../../core/models/user';
import { dateStringToLocalDate, dateToString } from '../../../../core/utils/date-utils';
import { futureSlotsForDate, isDateSelectable } from '../../../../core/utils/availability';
import { NewPatientDialog } from '../new-patient-dialog/new-patient-dialog';

@Component({
  selector: 'app-appointment-dialog',
  templateUrl: './appointment-dialog.html',
  styleUrl: './appointment-dialog.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatDatepickerModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    NewPatientDialog,
  ],
})
export class AppointmentDialog {
  private fb = inject(FormBuilder);
  private appointmentRepo = inject(AppointmentRepository);
  private auditRepo = inject(AuditRepository);
  private patientRepo = inject(PatientRepository);
  private authService = inject(AuthService);
  private alert = inject(AlertService);
  private notifications = inject(NotificationService);
  private cdr = inject(ChangeDetectorRef);
  private dialogRef = inject(MatDialogRef<AppointmentDialog>);
  private readonly clock = inject(ClinicClockService);

  protected allPatients = signal<Patient[]>([]);
  protected selectedDoctorId = '';
  protected editingAppointment = signal<Appointment | null>(null);
  private readonly availability = signal<{ byDay: Record<string, TimeSegment[]>; duration: number }>({ byDay: {}, duration: 30 });
  protected readonly timeSlots = signal<string[]>([]);
  protected readonly error = signal('');
  protected readonly submitted = signal(false);
  protected readonly saving = signal(false);
  protected filteredPatients = signal<Patient[]>([]);
  protected readonly overlapWarning = signal('');
  protected showNewPatient = signal(false);
  protected readonly patientLocked = signal(false);
  protected readonly lockedPatientName = signal('');
  hideAddPatient = signal(false);
  protected dialogDoctorName = '';
  protected dialogDoctorEmail = '';
  private existingAppointments: Appointment[] = [];
  private overlapSub: any = null;

  @ViewChild('patientInput') private patientInput?: ElementRef<HTMLInputElement>;

  protected readonly patientScheduling = signal(false);
  protected readonly occupiedSlots = signal<ReadonlySet<string>>(new Set());
  private readonly selectedDateKey = signal('');
  protected readonly availableTimes = computed(() => {
    const slots = this.timeSlots();
    if (!this.patientScheduling()) return slots;
    const date = this.selectedDateKey();
    if (!date) return slots;
    const occupied = this.occupiedSlots();
    return slots.filter(time => !occupied.has(`${date}|${time}`));
  });

  protected form = this.fb.group({
    patientId: ['', Validators.required],
    date: [null as unknown as string | Date, Validators.required],
    time: ['', Validators.required],
    notes: [''],
    patientSearch: this.fb.control<string | Patient>(''),
  });
  protected readonly patientSearchControl = this.form.controls.patientSearch;
  private readonly formState = signal({ invalid: this.form.invalid, pristine: this.form.pristine,
    patientInvalid: this.form.controls.patientId.invalid, patientTouched: this.form.controls.patientId.touched,
    dateInvalid: this.form.controls.date.invalid, dateTouched: this.form.controls.date.touched, dateUnavailable: false });
  protected readonly showPatientSelectionError = computed(() => this.formState().patientInvalid &&
    (this.formState().patientTouched || this.submitted()));
  protected readonly saveDisabled = computed(() => this.formState().invalid || this.formState().pristine || this.saving());
  protected readonly showDateError = computed(() => this.formState().dateInvalid &&
    (this.formState().dateTouched || this.submitted() || this.formState().dateUnavailable));
  protected readonly dateErrorMessage = computed(() => this.formState().dateUnavailable
    ? 'Selecciona un día con horarios disponibles del consultorio.' : 'Selecciona un día.');

  constructor() {
    effect(() => {
      this.clock.now();
      this.computeTimeSlots();
    });
    this.form.events.pipe(takeUntilDestroyed()).subscribe(() => {
      const dateControl = this.form.controls.date;
      this.formState.set({ invalid: this.form.invalid, pristine: this.form.pristine,
        patientInvalid: this.form.controls.patientId.invalid, patientTouched: this.form.controls.patientId.touched,
        dateInvalid: dateControl.invalid, dateTouched: dateControl.touched,
        dateUnavailable: dateControl.hasError('matDatepickerFilter') });
      if (dateControl.hasError('matDatepickerFilter') && !dateControl.touched) {
        // Material solo proyecta mat-error si el control está tocado; la fecha pudo
        // volverse no disponible por el paso del tiempo sin interacción del usuario.
        dateControl.markAsTouched();
      }
    });
    this.patientSearchControl.valueChanges.pipe(takeUntilDestroyed()).subscribe(value => {
      if (!this.patientLocked() && typeof value === 'string') {
        const hadSelection = !!this.form.controls.patientId.value;
        this.form.controls.patientId.setValue('');
        if (hadSelection) this.form.controls.patientId.markAsTouched();
      }
      this.filterPatients(value ?? '');
      this.cdr.markForCheck();
    });
  }

  private toDateStr(value: unknown): string {
    return dateToString(value);
  }

  setData(data: {
    allPatients: Patient[];
    selectedDoctorId: string;
    editingAppointment?: Appointment | null;
    timeSegmentsByDay?: Record<string, TimeSegment[]>;
    consultationDuration?: number;
    existingAppointments?: Appointment[];
    doctorName?: string;
    doctorEmail?: string;
    patientScheduling?: boolean;
    availableDays?: string[];
    occupiedSlots?: string[];
  }) {
    this.selectedDoctorId = data.selectedDoctorId === this.currentDoctorScope() ? data.selectedDoctorId : '';
    this.allPatients.set(this.selectedDoctorId
      ? data.allPatients.filter((patient) => patient.doctorId === this.selectedDoctorId)
      : []);
    this.filteredPatients.set(this.allPatients());
    this.editingAppointment.set(data.editingAppointment ?? null);
    this.availability.set({ byDay: data.timeSegmentsByDay ?? {}, duration: data.consultationDuration ?? 30 });
    this.existingAppointments = data.existingAppointments ?? [];
    this.dialogDoctorName = data.doctorName ?? '';
    this.dialogDoctorEmail = data.doctorEmail ?? '';
    this.patientScheduling.set(data.patientScheduling ?? false);
    this.setOccupiedSlots(data.occupiedSlots ?? []);
    this.computeTimeSlots();

    if (data.editingAppointment) {
      const apt = data.editingAppointment;
      this.form.setValue({
        patientId: apt.patientId,
        date: dateStringToLocalDate(apt.date),
        time: apt.time,
        notes: apt.notes || '',
        patientSearch: '',
      });
      this.form.markAsDirty();
      this.lockPatient(apt.patientId, apt.patientName);
    }

    this.computeTimeSlots();
    this.setupOverlapDetection();

    this.form.get('date')?.valueChanges.subscribe(() => {
      this.computeTimeSlots();
      const time = this.form.get('time')?.value;
      if (time && !this.availableTimes().includes(time)) {
        this.form.patchValue({ time: '' });
      }
      this.cdr.markForCheck();
    });
  }

  setOccupiedSlots(slots: string[], existingAppointments?: Appointment[]): void {
    this.occupiedSlots.set(new Set(slots));
    if (existingAppointments) this.existingAppointments = existingAppointments;
    this.checkOverlap();
  }

  private currentDoctorScope(): string {
    const user = this.authService.currentDoctor;
    if (user?.role === 'doctor') return user.uid;
    if (user?.role === 'assistant') return user.createdBy ?? '';
    return this.authService.currentPatient?.doctorId ?? '';
  }

  private setupOverlapDetection() {
    this.overlapSub?.unsubscribe();
    this.overlapSub = this.form.valueChanges.subscribe(() => this.checkOverlap());
  }

  private checkOverlap() {
    const date = this.form.get('date')?.value;
    const time = this.form.get('time')?.value;
    if (!date || !time) {
      this.overlapWarning.set('');
      return;
    }
    const dateStr = this.toDateStr(date);
    const editingId = this.editingAppointment()?.id;
    const conflicted = this.existingAppointments.some(
      (a) => !a.disabled && a.status !== 'cancelled' && a.date === dateStr && a.time === time && a.id !== editingId
    );
    this.overlapWarning.set(conflicted
      ? 'Ya existe una cita agendada en esta fecha y hora. La nueva cita se sobrepondrá a la existente.'
      : '');
    this.cdr.markForCheck();
  }

  setPrefill(date: string, time: string) {
    this.form.patchValue({ date: dateStringToLocalDate(date), time });
    this.form.markAsDirty();
    this.computeTimeSlots();
    this.cdr.markForCheck();
  }

  /** Muestra al paciente como texto al reagendar o al agendar desde su perfil. */
  lockPatient(patientId: string, fallbackName = '') {
    const patient = this.allPatients().find((p) => p.id === patientId);
    this.patientLocked.set(true);
    this.form.patchValue({ patientId });
    this.patientSearchControl.setValue(patient || '');
    this.lockedPatientName.set(patient ? `${patient.name} ${patient.lastName}` : fallbackName);
    this.cdr.markForCheck();
  }

  private selectedDate(): Date | null {
    const dateVal = this.form.get('date')?.value;
    if (dateVal instanceof Date && !isNaN(dateVal.getTime())) return dateVal;
    if (typeof dateVal === 'string' && dateVal) return dateStringToLocalDate(dateVal);
    return null;
  }

  private computeTimeSlots() {
    const date = this.selectedDate();
    // Horas válidas de la fecha elegida (fuente de verdad: timeSegmentsByDay + duración).
    // Si es hoy, solo las posteriores a la hora actual.
    this.selectedDateKey.set(date ? this.toDateStr(date) : '');
    const { byDay, duration } = this.availability();
    const slots = date && this.isDateAvailable(date) ? futureSlotsForDate(byDay, date, duration) : [];
    const original = this.editingAppointment();
    if (date && this.isOriginalDate(date) && original && !slots.includes(original.time)) slots.push(original.time);
    this.timeSlots.set(slots.sort());
  }

  private isOriginalDate(date: Date): boolean {
    const original = this.editingAppointment();
    return !!original && !original.disabled && original.status !== 'cancelled' && original.date === this.toDateStr(date);
  }

  /** Disponibilidad evaluada con el instante actual, para guardar y recalcular horas. */
  private isDateAvailable(date: Date): boolean {
    const { byDay, duration } = this.availability();
    return this.isOriginalDate(date) || isDateSelectable(byDay, date, duration);
  }

  /** Deshabilita en el datepicker fechas inválidas: pasado, día cerrado/sin segmentos, o hoy sin horas futuras. */
  readonly dateFilter = computed(() => {
    // Snapshot del instante para que Material revalide al cambiar la referencia del callback:
    // si el filtro releyera el reloj, el resultado no cambiaría y no volvería a validar.
    this.clock.now();
    const { byDay, duration } = this.availability();
    const original = this.editingAppointment();
    const originalDate = original && !original.disabled && original.status !== 'cancelled' ? original.date : '';
    const now = new Date();
    return (date: Date | null): boolean => date ? this.toDateStr(date) === originalDate || isDateSelectable(byDay, date, duration, now) : true;
  });

  close() {
    this.dialogRef.close();
  }

  async save() {
    if (this.saving()) return;
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.computeTimeSlots();
    const chosenDateValue = this.selectedDate();
    const chosenTime = this.form.get('time')?.value;
    if (!chosenDateValue || !this.isDateAvailable(chosenDateValue)) {
      this.error.set('El día seleccionado no está disponible para citas. Elige un día dentro del horario del doctor.');
      this.cdr.markForCheck();
      return;
    }
    if (this.patientScheduling() && chosenTime && this.occupiedSlots().has(`${this.toDateStr(chosenDateValue)}|${chosenTime}`)) {
      this.error.set('Esa hora ya está ocupada. Elige otra hora disponible.');
      this.cdr.markForCheck();
      return;
    }
    if (!chosenTime || !this.timeSlots().includes(chosenTime)) {
      this.error.set('Selecciona una hora disponible dentro del horario del doctor para el día elegido.');
      this.cdr.markForCheck();
      return;
    }

    this.saving.set(true);
    this.error.set('');

    try {
      const targetDoctor = this.authService.currentDoctor;
      const doctorId = this.selectedDoctorId;
      const doctorName = this.dialogDoctorName || targetDoctor?.name || '';
      const doctorEmail = this.dialogDoctorEmail || targetDoctor?.email || '';
      const { patientId, date: rawDate, time, notes } = this.form.getRawValue();
      const date = this.toDateStr(rawDate);
      const editingAppointment = this.editingAppointment();
      const appointmentPatientId = editingAppointment?.patientId ?? patientId;
      const patient = this.allPatients().find((p) => p.id === appointmentPatientId);
      if (!doctorId || doctorId !== this.currentDoctorScope() || !patient || patient.doctorId !== doctorId ||
          (editingAppointment && editingAppointment.doctorId !== doctorId)) {
        this.alert.error({ message: 'Selecciona un paciente asignado al Doctor de esta agenda.', duration: 5000 });
        return;
      }

      if (editingAppointment) {
        const updatedAppointment: Appointment = {
          ...editingAppointment,
          patientId: patient.id,
          patientName: `${patient.name} ${patient.lastName}`,
          patientLastName: patient.lastName,
          patientFatherName: patient.fatherName ?? '',
          patientMotherName: patient.motherName ?? '',
          patientBirthDate: patient.birthDate,
          patientPhone: patient.phone ?? '',
          doctorId,
          doctorName,
          date: date!,
          time: time!,
          notes: notes || '',
          updatedBy: doctorEmail,
        };
        await this.appointmentRepo.updateAppointment(editingAppointment.id, updatedAppointment);
        this.alert.success({ message: 'Cita actualizada', duration: 3000 });
        this.dialogRef.close(true);
        return;
      }

      const id = crypto.randomUUID();
      const newAppointment: Appointment = {
        id,
        patientId: patient.id,
        patientName: `${patient.name} ${patient.lastName}`,
        patientLastName: patient.lastName,
        patientFatherName: patient.fatherName ?? '',
        patientMotherName: patient.motherName ?? '',
        patientBirthDate: patient.birthDate,
        patientPhone: patient.phone ?? '',
        doctorId,
        doctorName,
        date: date!,
        time: time!,
        status: 'scheduled',
        type: 'scheduled',
        notes: notes || '',
        disabled: false,
        updatedBy: doctorEmail,
      };
      await this.appointmentRepo.createAppointment(id, newAppointment);


      this.alert.success({ message: 'Cita agendada', duration: 3000 });
      this.dialogRef.close(true);
    } catch (e: any) {
      this.error.set(e.message || 'Error al guardar la cita');
      this.cdr.markForCheck();
    } finally {
      this.saving.set(false);
      this.cdr.markForCheck();
    }
  }

  filterPatients(search: string | Patient) {
    if (typeof search !== 'string') return;
    const term = search.toLowerCase();
    if (!term) {
      this.filteredPatients.set(this.allPatients());
    } else {
      this.filteredPatients.set(this.allPatients().filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.lastName.toLowerCase().includes(term) ||
          `${p.name} ${p.lastName}`.toLowerCase().includes(term)
      ));
    }
  }

  onPatientSelected(patient: Patient) {
    if (this.patientLocked()) return;
    if (!this.allPatients().some((candidate) => candidate.id === patient.id && candidate.doctorId === this.selectedDoctorId)) return;
    this.form.patchValue({ patientId: patient.id });
    this.form.markAsDirty();
    this.patientSearchControl.setValue(patient);
  }

  readonly displayPatientFn = signal((patient: Patient): string => {
    return patient ? `${patient.name} ${patient.lastName}` : '';
  });

  onPatientSearchFocus() {
    if (this.patientLocked()) return;
    const val = this.patientSearchControl.value;
    this.filterPatients(typeof val === 'string' ? val : '');
  }

  focusPatientSearch(event: MouseEvent) {
    event.preventDefault();
    this.patientInput?.nativeElement.focus();
  }

  openNewPatient() {
    if (!this.selectedDoctorId || this.selectedDoctorId !== this.currentDoctorScope()) return;
    this.showNewPatient.set(true);
    this.cdr.markForCheck();
  }

  goBackToAppointment() {
    this.showNewPatient.set(false);
    this.cdr.markForCheck();
  }

  async onPatientCreated(patient: Patient) {
    const doctorId = this.selectedDoctorId;
    if (!doctorId || doctorId !== this.currentDoctorScope() || patient.doctorId !== doctorId) return;
    try {
      const patients = await this.patientRepo.getPatientsByDoctor(doctorId);
      if (doctorId !== this.selectedDoctorId || doctorId !== this.currentDoctorScope()) return;
      this.allPatients.set(patients.filter((candidate) => candidate.doctorId === doctorId));
      this.filterPatients('');
      const createdPatient = this.allPatients().find((candidate) => candidate.id === patient.id);
      if (createdPatient) this.onPatientSelected(createdPatient);
      this.goBackToAppointment();
    } catch {
      this.alert.error({ message: 'No fue posible actualizar los pacientes de esta agenda. Intenta abrir la cita nuevamente.', duration: 5000 });
    }
  }
}
