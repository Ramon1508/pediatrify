import { Component, inject, signal, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, FormControl } from '@angular/forms';
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
import { Appointment, Patient, TimeSegment } from '../../../../core/models/user';
import { dateStringToLocalDate } from '../../../../core/utils/date-utils';
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

  protected allPatients: Patient[] = [];
  protected selectedDoctorId = '';
  protected editingAppointment: Appointment | null = null;
  protected timeSegmentsByDay: Record<string, TimeSegment[]> = {};
  protected consultationDuration = 30;
  protected timeSlots: string[] = [];
  protected error = '';
  protected submitted = false;
  protected saving = false;
  protected patientSearchControl = new FormControl('');
  protected filteredPatients: Patient[] = [];
  protected overlapWarning = '';
  protected showNewPatient = signal(false);
  protected patientLocked = false;
  hideAddPatient = false;
  protected dialogDoctorName = '';
  protected dialogDoctorEmail = '';
  private existingAppointments: Appointment[] = [];
  private overlapSub: any = null;

  readonly dayNamesShort = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  protected patientScheduling = false;
  protected availableDays: string[] = [];
  protected occupiedSlots = new Set<string>();

  protected form = this.fb.group({
    patientId: ['', Validators.required],
    date: [null as unknown as string | Date, Validators.required],
    time: ['', Validators.required],
    notes: [''],
  });

  private toDateStr(value: unknown): string {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (value instanceof Date && !isNaN(value.getTime())) {
      const y = value.getFullYear();
      const m = String(value.getMonth() + 1).padStart(2, '0');
      const d = String(value.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    if (typeof (value as any).toDate === 'function') {
      return this.toDateStr((value as any).toDate());
    }
    return String(value);
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
    this.allPatients = data.allPatients;
    this.filteredPatients = data.allPatients;
    this.selectedDoctorId = data.selectedDoctorId;
    this.editingAppointment = data.editingAppointment ?? null;
    this.timeSegmentsByDay = data.timeSegmentsByDay ?? {};
    this.consultationDuration = data.consultationDuration ?? 30;
    this.existingAppointments = data.existingAppointments ?? [];
    this.dialogDoctorName = data.doctorName ?? '';
    this.dialogDoctorEmail = data.doctorEmail ?? '';
    this.patientScheduling = data.patientScheduling ?? false;
    this.availableDays = data.availableDays ?? [];
    this.occupiedSlots = new Set(data.occupiedSlots ?? []);
    this.computeTimeSlots();

    if (data.editingAppointment) {
      const apt = data.editingAppointment;
      this.form.setValue({
        patientId: apt.patientId,
        date: dateStringToLocalDate(apt.date),
        time: apt.time,
        notes: apt.notes || '',
      });
      this.form.markAsDirty();
      const patient = data.allPatients.find((p) => p.id === apt.patientId);
      this.patientSearchControl.setValue((patient || '') as any);
    }

    this.computeTimeSlots();
    this.patientSearchControl.valueChanges.subscribe((val) => this.filterPatients(val || ''));
    this.setupOverlapDetection();

    this.form.get('date')?.valueChanges.subscribe(() => {
      this.computeTimeSlots();
      const time = this.form.get('time')?.value;
      if (time && this.patientScheduling && !this.availableTimes.includes(time)) {
        this.form.patchValue({ time: '' });
      }
      this.cdr.markForCheck();
    });
  }

  private setupOverlapDetection() {
    this.overlapSub?.unsubscribe();
    this.overlapSub = this.form.valueChanges.subscribe(() => this.checkOverlap());
  }

  private checkOverlap() {
    const date = this.form.get('date')?.value;
    const time = this.form.get('time')?.value;
    if (!date || !time) {
      this.overlapWarning = '';
      return;
    }
    const dateStr = this.toDateStr(date);
    const editingId = this.editingAppointment?.id;
    const conflicted = this.existingAppointments.some(
      (a) => a.date === dateStr && a.time === time && a.id !== editingId
    );
    this.overlapWarning = conflicted
      ? 'Ya existe una cita agendada en esta fecha y hora. La nueva cita se sobrepondrá a la existente.'
      : '';
    this.cdr.markForCheck();
  }

  setPrefill(date: string, time: string) {
    this.form.patchValue({ date: dateStringToLocalDate(date), time });
    this.form.markAsDirty();
    this.computeTimeSlots();
    this.cdr.markForCheck();
  }

  /** Preselecciona al paciente y lo deja read-only (desde el perfil de un paciente). */
  lockPatient(patientId: string) {
    const patient = this.allPatients.find((p) => p.id === patientId);
    this.form.patchValue({ patientId });
    this.patientSearchControl.setValue((patient || '') as any);
    this.patientSearchControl.disable();
    this.form.get('patientId')?.disable();
    this.patientLocked = true;
    this.cdr.markForCheck();
  }

  /** Segmentos del día de la semana de la fecha elegida. */
  private segmentsForSelectedDate(): TimeSegment[] {
    const dateVal = this.form.get('date')?.value;
    if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
      const day = this.weekdayShort(dateVal);
      if (this.timeSegmentsByDay[day]?.length) return this.timeSegmentsByDay[day];
    } else if (typeof dateVal === 'string' && dateVal) {
      const day = this.weekdayShort(dateStringToLocalDate(dateVal));
      if (this.timeSegmentsByDay[day]?.length) return this.timeSegmentsByDay[day];
    }
    const first = Object.keys(this.timeSegmentsByDay)[0];
    return first ? this.timeSegmentsByDay[first] : [];
  }

  private computeTimeSlots() {
    const segs = this.segmentsForSelectedDate();
    if (!segs.length) {
      this.timeSlots = [];
      return;
    }
    const duration = this.consultationDuration;
    const slots: string[] = [];
    for (const seg of segs) {
      const [sh, sm] = seg.startTime.split(':').map(Number);
      let [eh, em] = seg.endTime.split(':').map(Number);
      if (eh === 0 && em === 0) eh = 24;
      let startMinutes = sh * 60 + sm;
      const endMinutes = eh * 60 + em;
      while (startMinutes + duration <= endMinutes) {
        const hour = Math.floor(startMinutes / 60);
        const minute = startMinutes % 60;
        slots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
        startMinutes += duration;
      }
    }
    this.timeSlots = slots;
  }

  private weekdayShort(date: Date): string {
    const idx = date.getDay();
    return this.dayNamesShort[idx === 0 ? 6 : idx - 1];
  }

  /** Permite en el datepicker los días laborales del doctor (las horas ocupadas se filtran aparte). */
  dateFilter = (date: Date | null): boolean => {
    if (!this.patientScheduling) return true;
    if (!date) return true;
    if (!this.availableDays.includes(this.weekdayShort(date))) return false;
    return true;
  };

  /** Horas disponibles del día seleccionado: excluye las que ya tienen cita registrada. */
  get availableTimes(): string[] {
    if (!this.patientScheduling) return this.timeSlots;
    const date = this.form.get('date')?.value;
    if (!date) return this.timeSlots;
    const dateStr = this.toDateStr(date);
    return this.timeSlots.filter((t) => !this.occupiedSlots.has(`${dateStr}|${t}`));
  }

  close() {
    this.dialogRef.close();
  }

  async save() {
    this.submitted = true;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const chosenDateValue = this.form.get('date')?.value;
    const chosenTime = this.form.get('time')?.value;
    if (this.patientScheduling) {
      if (chosenDateValue instanceof Date && !this.dateFilter(chosenDateValue)) {
        this.error = 'El día seleccionado no está disponible para citas. Elige un día dentro del horario del doctor.';
        this.cdr.markForCheck();
        return;
      }
      if (chosenTime && this.occupiedSlots.has(`${this.toDateStr(chosenDateValue)}|${chosenTime}`)) {
        this.error = 'Esa hora ya está ocupada. Elige otra hora disponible.';
        this.cdr.markForCheck();
        return;
      }
    }

    this.saving = true;
    this.error = '';

    try {
      const targetDoctor = this.authService.currentDoctor;
      const doctorId = this.selectedDoctorId || targetDoctor?.uid || '';
      const doctorName = this.dialogDoctorName || targetDoctor?.name || '';
      const doctorEmail = this.dialogDoctorEmail || targetDoctor?.email || '';
      // getRawValue() incluye controles deshabilitados: al usar lockPatient (paciente read-only)
      // el `patientId` está deshabilitado y `form.value` lo omitiría (rompería el guardado).
      const { patientId, date: rawDate, time, notes } = this.form.getRawValue();
      const date = this.toDateStr(rawDate);
      const patient = this.allPatients.find((p) => p.id === patientId);
      if (!doctorId || !patient) return;

      if (this.editingAppointment) {
        const updatedAppointment: Appointment = {
          ...this.editingAppointment,
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
        await this.appointmentRepo.updateAppointment(this.editingAppointment.id, updatedAppointment);
        if (
          updatedAppointment.date !== this.editingAppointment.date ||
          updatedAppointment.time !== this.editingAppointment.time
        ) {
          await this.notifications.notifyAppointmentRescheduled(
            updatedAppointment,
            this.editingAppointment.date,
            this.editingAppointment.time
          );
        }
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
      await this.notifications.notifyAppointmentCreated(newAppointment);

      this.alert.success({ message: 'Cita agendada', duration: 3000 });
      this.dialogRef.close(true);
    } catch (e: any) {
      this.error = e.message || 'Error al guardar la cita';
      this.cdr.markForCheck();
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }

  filterPatients(search: string | Patient) {
    if (!search || typeof search !== 'string') return;
    const term = search.toLowerCase();
    if (!term) {
      this.filteredPatients = this.allPatients;
    } else {
      this.filteredPatients = this.allPatients.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.lastName.toLowerCase().includes(term) ||
          `${p.name} ${p.lastName}`.toLowerCase().includes(term)
      );
    }
  }

  onPatientSelected(patient: Patient) {
    this.form.patchValue({ patientId: patient.id });
    this.form.markAsDirty();
    this.patientSearchControl.setValue(patient as any);
  }

  displayPatientFn(patient: Patient): string {
    return patient ? `${patient.name} ${patient.lastName}` : '';
  }

  onPatientSearchFocus() {
    const val = this.patientSearchControl.value;
    this.filterPatients(typeof val === 'string' ? val : '');
  }

  openNewPatient() {
    this.showNewPatient.set(true);
    this.cdr.markForCheck();
  }

  goBackToAppointment() {
    this.showNewPatient.set(false);
    this.cdr.markForCheck();
  }

  async onPatientCreated(patient: Patient) {
    this.allPatients = await this.patientRepo.getAllPatients();
    this.filteredPatients = this.allPatients;
    this.filterPatients('');
    this.patientSearchControl.setValue(patient as any);
    this.form.patchValue({ patientId: patient.id });
    this.goBackToAppointment();
  }
}
