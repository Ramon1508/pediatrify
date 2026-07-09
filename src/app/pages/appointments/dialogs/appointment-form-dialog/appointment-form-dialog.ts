import { Component, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AppointmentRepository } from '../../../../core/repositories/appointment.repository';
import { PatientRepository } from '../../../../core/repositories/patient.repository';
import { UserRepository } from '../../../../core/repositories/user.repository';
import { Appointment, Patient, TimeSegment } from '../../../../core/models/user';
import { AuthService } from '../../../../core/services/auth.service';
import { AlertService } from '../../../../core/services/alert.service';

@Component({
  selector: 'app-appointment-form-dialog',
  templateUrl: './appointment-form-dialog.html',
  styleUrl: './appointment-form-dialog.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
  ],
})
export class AppointmentFormDialog {
  private fb = inject(FormBuilder);
  private appointmentRepo = inject(AppointmentRepository);
  private patientRepo = inject(PatientRepository);
  private userRepo = inject(UserRepository);
  private authService = inject(AuthService);
  private alert = inject(AlertService);
  private cdr = inject(ChangeDetectorRef);
  private dialogRef = inject(MatDialogRef<AppointmentFormDialog>);

  protected allPatients: Patient[] = [];
  protected editingAppointment: Appointment | null = null;
  protected saving = false;
  protected submitted = false;
  protected error = '';
  protected timeSlots: string[] = [];

  protected form = this.fb.group({
    patientId: ['', Validators.required],
    date: ['', Validators.required],
    time: ['', Validators.required],
    notes: [''],
  });

  constructor() {
    this.loadDoctorSettings();
  }

  private async loadDoctorSettings() {
    const doctor = this.authService.currentDoctor;
    if (!doctor) return;
    const user = await this.userRepo.getUser(doctor.uid);
    if (!user) return;
    const segments = user.timeSegments?.length ? user.timeSegments : [{ startTime: '06:00', endTime: '00:00' }];
    const duration = user.consultationDuration ?? 30;
    const slots: string[] = [];
    for (const seg of segments) {
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

  setPatients(patients: Patient[]) {
    this.allPatients = patients;
  }

  selectPatient(patientId: string) {
    this.form.patchValue({ patientId });
  }

  setEditData(appointment: Appointment) {
    this.editingAppointment = appointment;
    this.form.setValue({
      patientId: appointment.patientId,
      date: appointment.date,
      time: appointment.time,
      notes: appointment.notes || '',
    });
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
      const doctor = this.authService.currentDoctor;
      const { patientId, date, time, notes } = this.form.value;
      const patient = this.allPatients.find((p) => p.id === patientId);
      if (!doctor || !patient) return;

      if (this.editingAppointment) {
        await this.appointmentRepo.updateAppointment(this.editingAppointment.id, {
          patientId: patient.id,
          patientName: `${patient.name} ${patient.lastName}`,
          patientLastName: patient.lastName,
          patientFatherName: patient.fatherName ?? '',
          patientMotherName: patient.motherName ?? '',
          patientBirthDate: patient.birthDate,
          patientPhone: patient.phone ?? '',
          doctorId: doctor.firebaseUid ?? doctor.uid,
          doctorName: doctor.name,
          date: date!,
          time: time!,
          notes: notes || '',
          updatedBy: doctor.email,
        });
        this.alert.success({ message: 'Cita actualizada', duration: 3000 });
        this.dialogRef.close(true);
        return;
      }

      const id = crypto.randomUUID();
      await this.appointmentRepo.createAppointment(id, {
        id,
        patientId: patient.id,
        patientName: `${patient.name} ${patient.lastName}`,
        patientLastName: patient.lastName,
        patientFatherName: patient.fatherName ?? '',
        patientMotherName: patient.motherName ?? '',
        patientBirthDate: patient.birthDate,
        patientPhone: patient.phone ?? '',
        doctorId: doctor.firebaseUid ?? doctor.uid,
        doctorName: doctor.name,
        date: date!,
        time: time!,
        status: 'scheduled',
        type: 'scheduled',
        notes: notes || '',
        disabled: false,
        updatedBy: doctor.email,
      });

      this.alert.success({ message: 'Cita agendada', duration: 3000 });
      this.dialogRef.close(true);
    } catch (e: any) {
      this.error = e.message || 'Error al guardar';
      this.cdr.markForCheck();
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }
}
