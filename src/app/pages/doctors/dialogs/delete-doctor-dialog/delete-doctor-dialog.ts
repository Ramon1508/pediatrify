import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { AppUser } from '../../../../core/models/user';
import { AlertService } from '../../../../core/services/alert.service';
import { CascadeService } from '../../../../core/services/cascade.service';

@Component({
  selector: 'app-delete-doctor-dialog',
  templateUrl: './delete-doctor-dialog.html',
  styleUrl: './delete-doctor-dialog.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule],
})
export class DeleteDoctorDialog {
  private cascade = inject(CascadeService);
  private alert = inject(AlertService);
  private dialogRef = inject(MatDialogRef<DeleteDoctorDialog>);

  protected doctor: AppUser | null = null;

  protected get subjectLabel(): string {
    return this.doctor?.role === 'doctor' ? 'doctor' : 'asistente';
  }

  protected get title(): string {
    return this.doctor?.role === 'doctor' ? 'Eliminar doctor' : 'Eliminar asistente';
  }

  protected get confirmLabel(): string {
    return this.doctor?.role === 'doctor' ? 'Eliminar doctor' : 'Eliminar asistente';
  }

  protected get subjectTitleCase(): string {
    return this.doctor?.role === 'doctor' ? 'Doctor' : 'Asistente';
  }

  setDoctor(doctor: AppUser) {
    this.doctor = doctor;
  }

  close() {
    this.dialogRef.close(false);
  }

  async confirm() {
    if (!this.doctor) return;
    try {
      await this.cascade.deleteDoctorCascade(this.doctor.uid);
      this.alert.success({ message: `${this.subjectTitleCase} eliminado`, duration: 3000 });
      this.dialogRef.close(true);
    } catch {
      this.alert.error({ message: `Error al eliminar ${this.subjectLabel}` });
    }
  }
}
