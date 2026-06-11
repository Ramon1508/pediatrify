import { Component, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, FormControl } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CommonModule } from '@angular/common';
import { AppointmentRepository } from '../../../../core/repositories/appointment.repository';
import { AuditRepository } from '../../../../core/repositories/audit.repository';
import { PatientRepository } from '../../../../core/repositories/patient.repository';
import { AuthService } from '../../../../core/services/auth.service';
import { AlertService } from '../../../../core/services/alert.service';
import { Appointment, Patient } from '../../../../core/models/user';
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
  ],
})
export class AppointmentDialog {
  private fb = inject(FormBuilder);
  private appointmentRepo = inject(AppointmentRepository);
  private auditRepo = inject(AuditRepository);
  private patientRepo = inject(PatientRepository);
  private authService = inject(AuthService);
  private alert = inject(AlertService);
  private dialog = inject(MatDialog);
  private cdr = inject(ChangeDetectorRef);
  private dialogRef = inject(MatDialogRef<AppointmentDialog>);

  protected allPatients: Patient[] = [];
  protected selectedDoctorId = '';
  protected editingAppointment: Appointment | null = null;
  protected error = '';
  protected submitted = false;
  protected saving = false;
  protected patientSearchControl = new FormControl('');
  protected filteredPatients: Patient[] = [];

  protected form = this.fb.group({
    patientId: ['', Validators.required],
    date: ['', Validators.required],
    time: ['', Validators.required],
    notes: [''],
  });

  setData(data: {
    allPatients: Patient[];
    selectedDoctorId: string;
    editingAppointment?: Appointment | null;
  }) {
    this.allPatients = data.allPatients;
    this.filteredPatients = data.allPatients;
    this.selectedDoctorId = data.selectedDoctorId;
    this.editingAppointment = data.editingAppointment ?? null;

    if (data.editingAppointment) {
      const apt = data.editingAppointment;
      this.form.setValue({
        patientId: apt.patientId,
        date: apt.date,
        time: apt.time,
        notes: apt.notes || '',
      });
      this.form.markAsDirty();
      const patient = data.allPatients.find((p) => p.id === apt.patientId);
      this.patientSearchControl.setValue((patient || '') as any);
    }

    this.patientSearchControl.valueChanges.subscribe((val) => this.filterPatients(val || ''));
  }

  setPrefill(date: string, time: string) {
    this.form.patchValue({ date, time });
    this.form.markAsDirty();
  }

  close() {
    this.dialogRef.close();
  }

  async save() {
    this.submitted = true;
    if (this.form.invalid) return;

    this.saving = true;
    this.error = '';

    try {
      const targetDoctor = this.authService.currentDoctor;
      const { patientId, date, time, notes } = this.form.value;
      const patient = this.allPatients.find((p) => p.id === patientId);
      if (!targetDoctor || !patient) return;

      const currentUser = this.authService.currentDoctor;

      if (this.editingAppointment) {
        await this.appointmentRepo.updateAppointment(this.editingAppointment.id, {
          patientId: patient.id,
          patientName: `${patient.name} ${patient.lastName}`,
          doctorId: targetDoctor.uid,
          doctorName: targetDoctor.name,
          date: date!,
          time: time!,
          notes: notes || '',
          updatedBy: currentUser?.email ?? '',
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
        doctorId: targetDoctor.uid,
        doctorName: targetDoctor.name,
        date: date!,
        time: time!,
        status: 'scheduled',
        type: 'scheduled',
        notes: notes || '',
        disabled: false,
        updatedBy: currentUser?.email ?? '',
      });

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
