import { Component, inject, ChangeDetectionStrategy, signal, computed } from '@angular/core';
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

  protected doctor = signal<AppUser | null>(null);
  protected saving = signal(false);
  protected subjectLabel = computed(() => {
    const role = this.doctor()?.role;
    return role === 'doctor' ? 'doctor' : role === 'admin' ? 'administrador' : 'asistente';
  });
  protected title = computed(() => `Eliminar ${this.subjectLabel()}`);
  protected confirmLabel = computed(() => this.saving() ? 'Eliminando…' : this.title());
  protected subjectTitleCase = computed(() => {
    const role = this.doctor()?.role;
    return role === 'doctor' ? 'Doctor' : role === 'admin' ? 'Administrador' : 'Asistente';
  });
  protected cannotConfirm = computed(() => !this.doctor() || this.saving());
  protected confirmationMessage = computed(() => {
    const role = this.doctor()?.role;
    if (role === 'doctor') {
      return 'Al eliminar este doctor, también se eliminarán sus asistentes, sus cuentas de acceso, pacientes, historiales, citas, logos y notificaciones asociadas. Esta acción no es reversible.';
    }
    if (role === 'admin') {
      return 'Al eliminar este administrador, se eliminarán su cuenta de acceso y su perfil. Esta acción no es reversible.';
    }
    return 'Al eliminar este asistente, se eliminarán su cuenta de acceso, su perfil y sus recursos asociados. Los pacientes, historiales y citas de la agenda del doctor se conservarán. Esta acción no es reversible.';
  });

  setDoctor(doctor: AppUser) {
    if (!this.saving()) this.doctor.set(doctor);
  }

  close() {
    if (!this.saving()) this.dialogRef.close(false);
  }

  async confirm() {
    const doctor = this.doctor();
    if (!doctor || this.saving()) return;
    this.saving.set(true);
    this.dialogRef.disableClose = true;
    try {
      await this.cascade.deleteDoctorCascade(doctor.uid);
      this.alert.success({ message: `${this.subjectTitleCase()} eliminado`, duration: 3000 });
      this.dialogRef.close(true);
    } catch (error) {
      const code = (error as { code?: string })?.code;
      const serverMessage = (error as { message?: string })?.message;
      const message = code === 'functions/failed-precondition'
        ? serverMessage?.startsWith('Debe permanecer al menos un administrador activo') ? serverMessage
          : 'La baja no está habilitada o la cuenta de acceso no pudo verificarse. Contacta al administrador.'
        : code === 'functions/permission-denied'
          ? 'No tienes permiso para eliminar esta cuenta.'
          : code === 'functions/unauthenticated'
            ? 'Inicia sesión nuevamente para eliminar esta cuenta.'
            : code === 'functions/aborted'
              ? 'La baja ya se está procesando. Intenta nuevamente en unos minutos.'
              : `No se completó la baja del ${this.subjectLabel()}. Su acceso puede estar bloqueado; vuelve a intentar.`;
      this.alert.error({ message });
    } finally {
      this.saving.set(false);
      this.dialogRef.disableClose = false;
    }
  }
}
