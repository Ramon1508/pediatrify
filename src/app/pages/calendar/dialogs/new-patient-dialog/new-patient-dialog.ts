import { Component, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PatientRepository } from '../../../../core/repositories/patient.repository';
import { AlertService } from '../../../../core/services/alert.service';
import { Patient } from '../../../../core/models/user';
import { normalizeEmail } from '../../../../core/utils/normalize-email';

@Component({
  selector: 'app-new-patient-dialog',
  templateUrl: './new-patient-dialog.html',
  styleUrl: './new-patient-dialog.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatProgressSpinnerModule,
  ],
})
export class NewPatientDialog {
  private fb = inject(FormBuilder);
  private patientRepo = inject(PatientRepository);
  private alert = inject(AlertService);
  private cdr = inject(ChangeDetectorRef);
  private dialogRef = inject(MatDialogRef<NewPatientDialog>);

  protected allPatients: Patient[] = [];
  protected editingPatient: Patient | null = null;

  protected saving = false;
  protected submitted = false;
  protected alertMsg = '';

  protected form = this.fb.group({
    name: ['', Validators.required],
    lastName: ['', Validators.required],
    birthDate: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    secondaryEmail: ['', Validators.email],
    fatherName: ['', Validators.required],
    motherName: ['', Validators.required],
    phone: ['', [Validators.required, Validators.minLength(10)]],
  });

  setPatients(patients: Patient[]) {
    this.allPatients = patients;
  }

  setEditData(patient: Patient) {
    this.editingPatient = patient;
    this.allPatients = this.allPatients.filter((p) => p.id !== patient.id);
    this.form.patchValue({
      name: patient.name,
      lastName: patient.lastName,
      birthDate: patient.birthDate,
      email: patient.email,
      secondaryEmail: patient.secondaryEmail || '',
      fatherName: patient.fatherName,
      motherName: patient.motherName,
      phone: patient.phone,
    });
  }

  close() {
    this.dialogRef.close();
  }

  async save() {
    this.submitted = true;
    if (this.form.invalid) return;

    const f = this.form.value;
    const email = normalizeEmail(f.email!);
    const secondaryEmail = f.secondaryEmail ? normalizeEmail(f.secondaryEmail) : '';

    if (!this.editingPatient) {
      const existingByEmail = this.allPatients.filter(
        (p) => p.email === email || (secondaryEmail && p.email === secondaryEmail) || p.secondaryEmail === email || (secondaryEmail && p.secondaryEmail === secondaryEmail)
      );

      if (existingByEmail.length > 0 && !this.alertMsg) {
        this.alertMsg = 'El o los correos electrónicos ingresados ya tienen una cuenta, por lo que este nuevo paciente se asociará a las cuentas existentes.';
        this.cdr.markForCheck();
        return;
      }

      const nameExists = this.allPatients.some(
        (p) => p.name.toLowerCase() === f.name!.toLowerCase() && p.lastName.toLowerCase() === f.lastName!.toLowerCase()
      );

      if (nameExists && !this.alertMsg) {
        this.alertMsg = 'Ya existe un paciente con ese nombre. Verifica los datos ingresados.';
        this.cdr.markForCheck();
        return;
      }
    }

    this.saving = true;
    try {
      if (this.editingPatient) {
        const updated: Partial<Patient> = {
          name: f.name!,
          lastName: f.lastName!,
          birthDate: f.birthDate!,
          email,
          secondaryEmail,
          fatherName: f.fatherName!,
          motherName: f.motherName!,
          phone: f.phone!,
        };
        await this.patientRepo.updatePatient(this.editingPatient.id, updated);
        this.alert.success({ message: 'Paciente actualizado', duration: 3000 });
        this.dialogRef.close({ ...this.editingPatient, ...updated });
      } else {
        const id = crypto.randomUUID();
        const otpPassword = this.generateOtpPassword();
        const newPatient: Patient = {
          id,
          name: f.name!,
          lastName: f.lastName!,
          birthDate: f.birthDate!,
          email,
          secondaryEmail,
          fatherName: f.fatherName!,
          motherName: f.motherName!,
          phone: f.phone!,
          otpPassword,
        };

        await this.patientRepo.createPatient(id, newPatient);
        this.alert.success({ message: `Paciente creado. Contraseña OTP: ${otpPassword}`, duration: 5000 });
        this.dialogRef.close(newPatient);
      }
    } catch (e: any) {
      this.alertMsg = e.message || 'Error al guardar paciente';
      this.cdr.markForCheck();
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }

  continueWithExisting() {
    this.alertMsg = '';
    this.save();
  }

  private generateOtpPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let pwd = '';
    for (let i = 0; i < 6; i++) {
      pwd += chars[Math.floor(Math.random() * chars.length)];
    }
    return pwd;
  }
}
