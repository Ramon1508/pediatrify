import { Component, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
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
import { NewPatientDialog } from '../new-patient-dialog/new-patient-dialog';
import { MatDialog } from '@angular/material/dialog';

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
  private dialog = inject(MatDialog);
  private cdr = inject(ChangeDetectorRef);
  private dialogRef = inject(MatDialogRef<AppointmentDialog>);

  protected allPatients: Patient[] = [];
  protected selectedDoctorId = '';
  protected editingAppointment: Appointment | null = null;
  protected timeSegments: TimeSegment[] = [];
  protected consultationDuration = 30;
  protected timeSlots: string[] = [];
  protected error = '';
  protected submitted = false;
  protected saving = false;
  protected patientSearchControl = new FormControl('');
  protected filteredPatients: Patient[] = [];
  protected overlapWarning = '';
  private existingAppointments: Appointment[] = [];
  private overlapSub: any = null;

  protected form = this.fb.group({
    patientId: ['', Validators.required],
    date: ['', Validators.required],
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
    timeSegments?: TimeSegment[];
    consultationDuration?: number;
    existingAppointments?: Appointment[];
  }) {
    this.allPatients = data.allPatients;
    this.filteredPatients = data.allPatients;
    this.selectedDoctorId = data.selectedDoctorId;
    this.editingAppointment = data.editingAppointment ?? null;
    this.timeSegments = data.timeSegments ?? [];
    this.consultationDuration = data.consultationDuration ?? 30;
    this.existingAppointments = data.existingAppointments ?? [];
    this.computeTimeSlots();

    if (data.editingAppointment) {
      const apt = data.editingAppointment;
      this.form.setValue({
        patientId: apt.patientId,
        date: this.toDateStr(apt.date),
        time: apt.time,
        notes: apt.notes || '',
      });
      this.form.markAsDirty();
      const patient = data.allPatients.find((p) => p.id === apt.patientId);
      this.patientSearchControl.setValue((patient || '') as any);
    }

    this.patientSearchControl.valueChanges.subscribe((val) => this.filterPatients(val || ''));
    this.setupOverlapDetection();
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
    console.log(this.existingAppointments);
    const conflicted = this.existingAppointments.some(
      (a) => a.date === dateStr && a.time === time && a.id !== editingId
    );
    this.overlapWarning = conflicted
      ? 'Ya existe una cita agendada en esta fecha y hora. La nueva cita se sobrepondrá a la existente.'
      : '';
    this.cdr.markForCheck();
  }

  setPrefill(date: string, time: string) {
    this.form.patchValue({ date, time });
    this.form.markAsDirty();
  }

  private computeTimeSlots() {
    if (!this.timeSegments.length) {
      this.timeSlots = [];
      return;
    }
    const duration = this.consultationDuration;
    const slots: string[] = [];
    for (const seg of this.timeSegments) {
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

  close() {
    this.dialogRef.close();
  }

  async save() {
    this.submitted = true;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.saving = true;
    this.error = '';

    try {
      const targetDoctor = this.authService.currentDoctor;
      const { patientId, date: rawDate, time, notes } = this.form.value;
      const date = this.toDateStr(rawDate);
      const patient = this.allPatients.find((p) => p.id === patientId);
      if (!targetDoctor || !patient) return;

      const currentUser = this.authService.currentDoctor;

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
          doctorId: targetDoctor.uid,
          doctorName: targetDoctor.name,
          date: date!,
          time: time!,
          notes: notes || '',
          updatedBy: currentUser?.email ?? '',
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
        doctorId: targetDoctor.uid,
        doctorName: targetDoctor.name,
        date: date!,
        time: time!,
        status: 'scheduled',
        type: 'scheduled',
        notes: notes || '',
        disabled: false,
        updatedBy: currentUser?.email ?? '',
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

  openNewPatientDialog() {
    const dialogRef = this.dialog.open(NewPatientDialog, {
      width: '400px',
      disableClose: true,
      panelClass: 'right-panel',
    });
    const instance = dialogRef.componentInstance;
    instance.setPatients(this.allPatients);

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        this.allPatients = await this.patientRepo.getAllPatients();
        this.filteredPatients = this.allPatients;
        this.filterPatients('');
        this.patientSearchControl.setValue(result as any);
        this.form.patchValue({ patientId: result.id });
        this.cdr.markForCheck();
      }
    });
  }
}
