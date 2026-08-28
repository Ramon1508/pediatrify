import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ClinicalRecordRepository } from '../../../../core/repositories/clinical-record.repository';
import { AuthService } from '../../../../core/services/auth.service';
import { AlertService } from '../../../../core/services/alert.service';
import { dateToString } from '../../../../core/utils/date-utils';

@Component({
  selector: 'app-add-clinical-entry',
  templateUrl: './add-clinical-entry.html',
  styleUrl: './add-clinical-entry.scss',
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
export class AddClinicalEntry {
  private fb = inject(FormBuilder);
  private repo = inject(ClinicalRecordRepository);
  private authService = inject(AuthService);
  private alert = inject(AlertService);
  private dialogRef = inject(MatDialogRef<AddClinicalEntry>);

  protected patientId = '';
  protected saving = false;

  protected form = this.fb.group({
    date: [null as unknown as string | Date],
    motivoConsulta: [''],
    diagnosis: [''],
    notas: [''],
  });

  setPatientId(id: string) {
    this.patientId = id;
  }

  close() {
    this.dialogRef.close();
  }

  async save() {
    if (!this.patientId) return;

    this.saving = true;
    try {
      const f = this.form.value;
      const doctor = this.authService.currentDoctor;
      const id = crypto.randomUUID();
      await this.repo.create(id, {
        id,
        patientId: this.patientId,
        date: dateToString(f.date),
        motivoConsulta: f.motivoConsulta ?? '',
        diagnosis: f.diagnosis ?? '',
        notas: f.notas ?? '',
        createdBy: doctor?.email ?? '',
      });
      this.alert.success({ message: 'Entrada agregada', duration: 3000 });
      this.dialogRef.close(true);
    } catch {
      this.alert.error({ message: 'Error al guardar la entrada', duration: 5000 });
    } finally {
      this.saving = false;
    }
  }
}
