import { Component, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { PatientRepository } from '../../../../core/repositories/patient.repository';
import { AlertService } from '../../../../core/services/alert.service';
import { Patient } from '../../../../core/models/user';

@Component({
  selector: 'app-view-otp-dialog',
  templateUrl: './view-otp-dialog.html',
  styleUrl: './view-otp-dialog.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    FormsModule,
  ],
})
export class ViewOtpDialog {
  private patientRepo = inject(PatientRepository);
  private alert = inject(AlertService);
  private cdr = inject(ChangeDetectorRef);
  private dialogRef = inject(MatDialogRef<ViewOtpDialog>);

  protected patient: Patient | null = null;
  protected editing = false;
  protected otpValue = '';

  setPatient(p: Patient) {
    this.patient = p;
    this.otpValue = p.otpPassword ?? '';
  }

  protected toggleEdit() {
    if (this.editing) {
      this.save();
    } else {
      this.editing = true;
      this.cdr.markForCheck();
    }
  }

  private async save() {
    if (!this.patient) return;
    if (!this.otpValue || this.otpValue.length < 4) {
      this.alert.error({ message: 'La contraseña OTP debe tener al menos 4 caracteres', duration: 3000 });
      return;
    }
    await this.patientRepo.updatePatient(this.patient.id, { otpPassword: this.otpValue });
    this.alert.success({ message: 'Contraseña OTP actualizada', duration: 3000 });
    this.editing = false;
    this.cdr.markForCheck();
  }

  protected copyOtp() {
    navigator.clipboard.writeText(this.otpValue);
    this.alert.success({ message: 'Copiado al portapapeles', duration: 2000 });
  }

  close() {
    this.dialogRef.close(false);
  }
}
