import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { UserRepository } from '../../../../core/repositories/user.repository';
import { AppUser } from '../../../../core/models/user';
import { AlertService } from '../../../../core/services/alert.service';

@Component({
  selector: 'app-delete-doctor-dialog',
  templateUrl: './delete-doctor-dialog.html',
  styleUrl: './delete-doctor-dialog.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule],
})
export class DeleteDoctorDialog {
  private userRepo = inject(UserRepository);
  private alert = inject(AlertService);
  private dialogRef = inject(MatDialogRef<DeleteDoctorDialog>);

  protected doctor: AppUser | null = null;

  setDoctor(doctor: AppUser) {
    this.doctor = doctor;
  }

  close() {
    this.dialogRef.close(false);
  }

  async confirm() {
    if (!this.doctor) return;
    try {
      await this.userRepo.deleteUser(this.doctor.uid);
      this.alert.success({ message: 'Asistente eliminado', duration: 3000 });
      this.dialogRef.close(true);
    } catch {
      this.alert.error({ message: 'Error al eliminar asistente' });
    }
  }
}
