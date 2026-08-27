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
import { setDoc, doc } from 'firebase/firestore';
import { UserRepository } from '../../../../core/repositories/user.repository';
import { FirebaseService } from '../../../../core/firebase/firebase.service';
import { AuditRepository } from '../../../../core/repositories/audit.repository';
import { AuthService } from '../../../../core/services/auth.service';
import { AlertService } from '../../../../core/services/alert.service';
import { AppUser, TimeSegment } from '../../../../core/models/user';
import { normalizeEmail } from '../../../../core/utils/normalize-email';

export interface SettingsData {
  consultationDuration: number;
  allowPatientScheduling: boolean;
  timeSegmentsByDay: Record<string, TimeSegment[]>;
  availableDays: string[];
  doctorId: string;
  doctorEmail?: string;
}

const DEFAULT_EMPTY: TimeSegment[] = [{ startTime: '06:00', endTime: '00:00' }];

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
  private firebase = inject(FirebaseService);
  private userRepo = inject(UserRepository);
  private auditRepo = inject(AuditRepository);
  private authService = inject(AuthService);
  private alert = inject(AlertService);
  private cdr = inject(ChangeDetectorRef);
  private dialogRef = inject(MatDialogRef<SettingsDialog>);

  readonly dayNamesShort = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  protected timeSegmentsByDay: Record<string, TimeSegment[]> = {};
  protected selectedDay = '';
  protected saving = false;

  protected form = this.fb.group({
    consultationDuration: [30, Validators.required],
    allowPatientScheduling: [false],
    timeSegments: this.fb.array<{ startTime: string; endTime: string }>([]),
  });

  private doctorId = '';
  private doctorEmail = '';

  setData(data: SettingsData) {
    this.doctorId = data.doctorId;
    this.doctorEmail = data.doctorEmail ?? '';
    this.timeSegmentsByDay = { ...(data.timeSegmentsByDay ?? {}) };
    // Compatibilidad: si el doc no tiene segmentos por día pero sí globales, los reparte a sus días.
    if (Object.keys(this.timeSegmentsByDay).length === 0 && data.availableDays.length) {
      const legacy = (data as any).legacyTimeSegments as TimeSegment[] | undefined;
      const segs = legacy?.length ? legacy : DEFAULT_EMPTY;
      for (const day of data.availableDays) {
        this.timeSegmentsByDay[day] = segs.map((s) => ({ ...s }));
      }
    }
    this.form.patchValue({
      consultationDuration: data.consultationDuration,
      allowPatientScheduling: data.allowPatientScheduling,
    });
    this.selectedDay = this.availableDaysList()[0] ?? this.dayNamesShort[0];
    if (!this.timeSegmentsByDay[this.selectedDay]) {
      this.timeSegmentsByDay[this.selectedDay] = DEFAULT_EMPTY.map((s) => ({ ...s }));
    }
    this.applyDayToForm(this.selectedDay);
  }

  get timeSegments(): FormArray {
    return this.form.get('timeSegments') as FormArray;
  }

  protected availableDaysList(): string[] {
    return Object.keys(this.timeSegmentsByDay).filter((d) => this.timeSegmentsByDay[d]?.length);
  }

  protected isConfigured(day: string): boolean {
    return !!this.timeSegmentsByDay[day]?.length;
  }

  toggleDay(day: string) {
    this.syncSelectedDaySegments();
    this.selectedDay = day;
    if (!this.timeSegmentsByDay[day]?.length) {
      this.timeSegmentsByDay[day] = DEFAULT_EMPTY.map((s) => ({ ...s }));
    }
    this.applyDayToForm(day);
    this.cdr.markForCheck();
  }

  private syncSelectedDaySegments() {
    if (!this.selectedDay) return;
    this.timeSegmentsByDay[this.selectedDay] = this.timeSegments.controls.map((c) => ({
      startTime: c.get('startTime')?.value ?? '06:00',
      endTime: c.get('endTime')?.value ?? '00:00',
    }));
  }

  private applyDayToForm(day: string) {
    this.timeSegments.clear();
    for (const seg of this.timeSegmentsByDay[day] ?? []) {
      this.timeSegments.push(this.fb.group({ startTime: seg.startTime, endTime: seg.endTime }));
    }
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
    this.syncSelectedDaySegments();
    this.saving = true;
    try {
      const raw = this.form.value;
      const availableDays = this.availableDaysList();
      const currentUser = this.authService.currentDoctor;

      let targetUid = this.doctorId;
      if (this.doctorEmail) {
        const userByEmail = await this.userRepo.getUserByEmail(normalizeEmail(this.doctorEmail));
        if (userByEmail) {
          targetUid = (userByEmail as any).uid ?? targetUid;
        }
      }

      const oldUser = await this.userRepo.getUser(targetUid);
      const updateData = {
        consultationDuration: raw.consultationDuration ?? 30,
        allowPatientScheduling: raw.allowPatientScheduling ?? false,
        availableDays,
        timeSegmentsByDay: this.timeSegmentsByDay,
        timeSegments: [],
        updatedAt: new Date(),
      };
      await setDoc(doc(this.firebase.firestore, 'users', targetUid), updateData, { merge: true });
      await this.auditRepo.log({
        id: crypto.randomUUID(),
        action: 'update',
        entityType: 'doctor_settings',
        entityId: targetUid,
        performedBy: currentUser?.email ?? '',
        performedByUid: currentUser?.uid ?? '',
        timestamp: new Date() as any,
        oldValues: {
          consultationDuration: oldUser?.consultationDuration,
          allowPatientScheduling: oldUser?.allowPatientScheduling,
          availableDays: oldUser?.availableDays,
          timeSegmentsByDay: (oldUser as any)?.timeSegmentsByDay,
        },
        newValues: {
          consultationDuration: raw.consultationDuration,
          allowPatientScheduling: raw.allowPatientScheduling,
          availableDays,
          timeSegmentsByDay: this.timeSegmentsByDay,
        },
      });
      this.alert.success({ message: 'Configuración guardada', duration: 5000 });
      this.dialogRef.close(true);
    } catch (e: any) {
      console.error('Settings save error:', e);
      this.alert.error({ message: 'Error al guardar configuración' });
      this.cdr.markForCheck();
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }
}
