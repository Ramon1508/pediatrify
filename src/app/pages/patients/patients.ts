import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PatientRepository } from '../../core/repositories/patient.repository';
import { Patient } from '../../core/models/user';
import { AlertService } from '../../core/services/alert.service';
import { Clipboard } from '@angular/cdk/clipboard';

@Component({
  selector: 'app-patients',
  templateUrl: './patients.html',
  styleUrl: './patients.scss',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
})
export class Patients implements OnInit {
  private fb = inject(FormBuilder);
  private patientRepo = inject(PatientRepository);
  private alert = inject(AlertService);
  private clipboard = inject(Clipboard);

  protected patients = signal<Patient[]>([]);
  protected loading = true;
  protected displayedColumns = ['name', 'email', 'phone', 'otpPassword', 'actions'];

  protected showDialog = false;
  protected editingPatient: Patient | null = null;
  protected saving = false;
  protected dialogError = '';

  protected form = this.fb.group({
    name: ['', Validators.required],
    lastName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.minLength(10)]],
  });

  private idCounter = 0;

  async ngOnInit() {
    this.patientRepo.watchAllPatients().subscribe((patients) => {
      this.patients.set(patients);
      this.loading = false;
    });
  }

  openNewPatient() {
    this.editingPatient = null;
    this.form.reset({ name: '', lastName: '', email: '', phone: '' });
    this.dialogError = '';
    this.showDialog = true;
  }

  closeDialog() {
    this.showDialog = false;
  }

  async savePatient() {
    if (this.form.invalid) return;

    this.saving = true;
    this.dialogError = '';

    try {
      if (this.editingPatient) {
        await this.patientRepo.updatePatient(this.editingPatient.id, this.form.value as any);
        this.alert.success({ message: 'Paciente actualizado', duration: 3000 });
      } else {
        const id = crypto.randomUUID();
        const otpPassword = this.generateOtpPassword();
        await this.patientRepo.createPatient(id, {
          id,
          ...this.form.value as any,
          otpPassword,
        });
        this.alert.success({ message: `Paciente creado. Contraseña OTP: ${otpPassword}`, duration: 5000 });
      }
      this.showDialog = false;
    } catch (e: any) {
      this.dialogError = e.message || 'Error al guardar';
    } finally {
      this.saving = false;
    }
  }

  async regenerateOtp(patient: Patient) {
    const newOtp = this.generateOtpPassword();
    await this.patientRepo.updatePatient(patient.id, { otpPassword: newOtp });
    this.alert.success({ message: `Nueva contraseña OTP: ${newOtp}`, duration: 5000 });
  }

  async deletePatient(patient: Patient) {
    if (confirm(`¿Eliminar a ${patient.name} ${patient.lastName}?`)) {
      await this.patientRepo.deletePatient(patient.id);
      this.alert.success({ message: 'Paciente eliminado', duration: 3000 });
    }
  }

  copyOtp(password: string) {
    this.clipboard.copy(password);
    this.alert.success({ message: 'Copiado al portapapeles', duration: 2000 });
  }

  private generateOtpPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let pwd = '';
    for (let i = 0; i < 6; i++) {
      pwd += chars[Math.floor(Math.random() * chars.length)];
    }
    return pwd;
  }

  protected get nameControl() { return this.form.get('name')!; }
  protected get lastNameControl() { return this.form.get('lastName')!; }
  protected get emailControl() { return this.form.get('email')!; }
  protected get phoneControl() { return this.form.get('phone')!; }
}
