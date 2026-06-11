import { Component, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, FormArray } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { UserRepository } from '../../../../core/repositories/user.repository';
import { AuditRepository } from '../../../../core/repositories/audit.repository';
import { AuthService } from '../../../../core/services/auth.service';
import { AlertService } from '../../../../core/services/alert.service';
import { AppUser, TimeSegment } from '../../../../core/models/user';

export interface SettingsData {
  consultationDuration: number;
  allowPatientScheduling: boolean;
  timeSegments: { startTime: string; endTime: string }[];
  availableDays: string[];
  doctorId: string;
}

@Component({
  selector: 'app-settings-dialog',
  templateUrl: './settings-dialog.html',
  styleUrl: './settings-dialog.scss',
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
    MatSlideToggleModule,
    MatProgressSpinnerModule,
  ],
})
export class SettingsDialog {
  private fb = inject(FormBuilder);
  private userRepo = inject(UserRepository);
  private auditRepo = inject(AuditRepository);
  private authService = inject(AuthService);
  private alert = inject(AlertService);
  private cdr = inject(ChangeDetectorRef);
  private dialogRef = inject(MatDialogRef<SettingsDialog>);

  readonly dayNamesShort = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  protected availableDays: string[] = [];
  protected saving = false;

  protected form = this.fb.group({
    consultationDuration: [30, Validators.required],
    allowPatientScheduling: [false],
    timeSegments: this.fb.array<{ startTime: string; endTime: string }>([]),
  });

  private doctorId = '';

  setData(data: SettingsData) {
    this.doctorId = data.doctorId;
    this.availableDays = [...data.availableDays];
    this.form.patchValue({
      consultationDuration: data.consultationDuration,
      allowPatientScheduling: data.allowPatientScheduling,
    });
    this.timeSegments.clear();
    for (const seg of data.timeSegments) {
      this.timeSegments.push(this.fb.group({ startTime: seg.startTime, endTime: seg.endTime }));
    }
  }

  get timeSegments(): FormArray {
    return this.form.get('timeSegments') as FormArray;
  }

  toggleDay(day: string) {
    const idx = this.availableDays.indexOf(day);
    if (idx >= 0) {
      this.availableDays.splice(idx, 1);
    } else {
      this.availableDays.push(day);
    }
    this.cdr.markForCheck();
  }

  addSegment() {
    this.timeSegments.push(this.fb.group({ startTime: '06:00', endTime: '00:00' }));
  }

  removeSegment(index: number) {
    this.timeSegments.removeAt(index);
  }

  close() {
    this.dialogRef.close();
  }

  async save() {
    this.saving = true;
    try {
      const raw = this.form.value;
      const segments = (raw.timeSegments ?? []) as TimeSegment[];
      const currentUser = this.authService.currentDoctor;
      const oldUser = await this.userRepo.getUser(this.doctorId);
      await this.userRepo.updateUser(this.doctorId, {
        consultationDuration: raw.consultationDuration ?? 30,
        allowPatientScheduling: raw.allowPatientScheduling ?? false,
        availableDays: this.availableDays,
        timeSegments: segments,
      });
      await this.auditRepo.log({
        id: crypto.randomUUID(),
        action: 'update',
        entityType: 'doctor_settings',
        entityId: this.doctorId,
        performedBy: currentUser?.email ?? '',
        performedByUid: currentUser?.uid ?? '',
        timestamp: new Date() as any,
        oldValues: {
          consultationDuration: oldUser?.consultationDuration,
          allowPatientScheduling: oldUser?.allowPatientScheduling,
          availableDays: oldUser?.availableDays,
          timeSegments: oldUser?.timeSegments,
        },
        newValues: {
          consultationDuration: raw.consultationDuration,
          allowPatientScheduling: raw.allowPatientScheduling,
          availableDays: this.availableDays,
          timeSegments: segments,
        },
      });
      this.alert.success({ message: 'Configuración guardada', duration: 3000 });
      this.dialogRef.close(true);
    } catch (e: any) {
      this.alert.error({ message: 'Error al guardar configuración' });
      this.cdr.markForCheck();
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }
}
