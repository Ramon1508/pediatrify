import { Component, computed, inject, signal, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
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
import { AuthService } from '../../../../core/services/auth.service';
import { AlertService } from '../../../../core/services/alert.service';
import { AppUser, TimeSegment } from '../../../../core/models/user';
import { cloneTimeSegmentsByDay } from '../../../../core/utils/availability';

export interface SettingsData {
  consultationDuration: number;
  allowPatientScheduling: boolean;
  timeSegmentsByDay: Record<string, TimeSegment[]>;
  availableDays: string[];
  doctorId: string;
  doctorEmail?: string;
}

export type SettingsSaveResult = Pick<
  SettingsData,
  'consultationDuration' | 'allowPatientScheduling' | 'timeSegmentsByDay' | 'availableDays'
>;

const DEFAULT_EMPTY: TimeSegment[] = [{ startTime: '06:00', endTime: '00:00' }];
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

type SegmentIssue = { start: string; end: string; range: string; overlap: string };

function segmentIssues(segments: TimeSegment[]): SegmentIssue[] {
  const issues = segments.map(segment => ({
    start: TIME_PATTERN.test(segment.startTime ?? '') ? '' : 'Ingresa una hora de inicio válida en formato HH:mm.',
    end: TIME_PATTERN.test(segment.endTime ?? '') ? '' : 'Ingresa una hora de fin válida en formato HH:mm.',
    range: '', overlap: '',
  }));
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  const intervals = segments.map((segment, index) => {
    if (issues[index].start || issues[index].end) return null;
    const start = minutes(segment.startTime);
    const end = segment.endTime === '00:00' ? 1440 : minutes(segment.endTime);
    if (start >= end) {
      issues[index].range = 'Elige una hora de fin posterior a la de inicio. Usa 00:00 para el final del día.';
      return null;
    }
    return { start, end };
  });
  intervals.forEach((interval, index) => {
    if (!interval) return;
    for (let other = index + 1; other < intervals.length; other++) {
      const candidate = intervals[other];
      if (candidate && interval.start < candidate.end && candidate.start < interval.end) {
        const message = 'Modifica este segmento para que no se superponga con otro del mismo día.';
        issues[index].overlap = message;
        issues[other].overlap = message;
      }
    }
  });
  return issues;
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
  private authService = inject(AuthService);
  private alert = inject(AlertService);
  private cdr = inject(ChangeDetectorRef);
  private dialogRef = inject(MatDialogRef<SettingsDialog>);
  private readonly session = toSignal(this.authService.session$, { initialValue: null });

  protected readonly canManagePatientScheduling = computed(() => {
    const session = this.session();
    return session?.type === 'doctor' && session.user.role === 'doctor';
  });

  readonly dayNamesShort = signal(['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']);

  protected readonly timeSegmentsByDay = signal<Record<string, TimeSegment[]>>({});
  protected readonly selectedDay = signal('');
  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);

  protected form = this.fb.group({
    consultationDuration: [30, [Validators.required, Validators.min(1)]],
    allowPatientScheduling: [false],
    timeSegments: this.fb.array<{ startTime: string; endTime: string }>([]),
  }, { validators: form => this.weekIssuesFor((form.get('timeSegments') as FormArray).getRawValue()).length
    ? { invalidWeekSegments: true } : null });

  private readonly formState = signal({ invalid: this.form.invalid, pristine: this.form.pristine,
    values: [] as TimeSegment[], controls: [...this.timeSegments.controls], durationInvalid: false });
  protected readonly saveDisabled = computed(() => this.formState().invalid || this.formState().pristine || this.saving());
  protected readonly durationInvalid = computed(() => this.formState().durationInvalid);
  protected readonly weekErrors = computed(() => this.weekIssuesFor(this.formState().values));
  protected readonly dayChips = computed(() => this.dayNamesShort().map(day => ({ day,
    active: day === this.selectedDay(), configured: day === this.selectedDay()
      ? this.formState().values.length > 0 : !!this.timeSegmentsByDay()[day]?.length })));
  protected readonly segmentRows = computed(() => {
    const state = this.formState();
    const issues = segmentIssues(state.values);
    return state.controls.map((control, index) => ({ control, index, ...issues[index] }));
  });

  constructor() {
    this.form.events.pipe(takeUntilDestroyed()).subscribe(() => {
      this.formState.set({ invalid: this.form.invalid, pristine: this.form.pristine,
        values: this.timeSegments.getRawValue(), controls: [...this.timeSegments.controls],
        durationInvalid: this.form.controls.consultationDuration.invalid });
    });
  }

  private weekIssuesFor(activeSegments: TimeSegment[]) {
    const draft = { ...this.timeSegmentsByDay() };
    if (this.selectedDay()) draft[this.selectedDay()] = activeSegments;
    return Object.entries(draft).flatMap(([day, segments]) => segmentIssues(segments).flatMap((issue, index) =>
      Object.entries(issue).filter(([, message]) => !!message).map(([kind, message]) => ({
        key: `${day}-${index}-${kind}`, message: `${day}, segmento ${index + 1}: ${message}`,
      }))));
  }

  private createSegment(segment: TimeSegment) {
    return this.fb.group({
      startTime: [segment.startTime, [Validators.required, Validators.pattern(TIME_PATTERN)]],
      endTime: [segment.endTime, [Validators.required, Validators.pattern(TIME_PATTERN)]],
    });
  }

  private doctorId = '';
  private doctorEmail = '';
  private initialAllowPatientScheduling = false;

  setData(data: SettingsData) {
    this.doctorId = data.doctorId;
    this.doctorEmail = data.doctorEmail ?? '';
    this.initialAllowPatientScheduling = data.allowPatientScheduling;
    const byDay = cloneTimeSegmentsByDay(data.timeSegmentsByDay);
    // Compatibilidad: si el doc no tiene segmentos por día pero sí globales, los reparte a sus días.
    if (Object.keys(byDay).length === 0 && data.availableDays.length) {
      const legacy = (data as any).legacyTimeSegments as TimeSegment[] | undefined;
      const segs = legacy?.length ? legacy : DEFAULT_EMPTY;
      for (const day of data.availableDays) {
        byDay[day] = segs.map((s) => ({ ...s }));
      }
    }
    this.timeSegmentsByDay.set(byDay);
    this.form.patchValue({
      consultationDuration: data.consultationDuration,
      allowPatientScheduling: data.allowPatientScheduling,
    });
    if (this.canManagePatientScheduling()) {
      this.form.controls.allowPatientScheduling.enable();
    } else {
      this.form.controls.allowPatientScheduling.disable();
    }
    this.selectedDay.set(this.availableDaysList()[0] ?? this.dayNamesShort()[0]);
    this.applyDayToForm(this.selectedDay());
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.submitted.set(false);
  }

  get timeSegments(): FormArray {
    return this.form.get('timeSegments') as FormArray;
  }

  protected availableDaysList(): string[] {
    return Object.keys(this.timeSegmentsByDay()).filter((d) => this.timeSegmentsByDay()[d]?.length);
  }

  toggleDay(day: string) {
    this.syncSelectedDaySegments();
    this.selectedDay.set(day);
    this.applyDayToForm(day);
    this.cdr.markForCheck();
  }

  private syncSelectedDaySegments() {
    if (!this.selectedDay()) return;
    this.timeSegmentsByDay.update(byDay => ({ ...byDay, [this.selectedDay()]: this.timeSegments.getRawValue() }));
  }

  private applyDayToForm(day: string) {
    this.timeSegments.clear({ emitEvent: false });
    for (const seg of this.timeSegmentsByDay()[day] ?? []) {
      this.timeSegments.push(this.createSegment(seg), { emitEvent: false });
    }
    this.form.updateValueAndValidity();
  }

  addSegment() {
    this.timeSegments.push(this.createSegment(DEFAULT_EMPTY[0]));
    this.form.markAsDirty();
    this.syncSelectedDaySegments();
    this.cdr.markForCheck();
  }

  removeSegment(index: number) {
    this.timeSegments.removeAt(index);
    this.form.markAsDirty();
    this.syncSelectedDaySegments();
    this.cdr.markForCheck();
  }

  close() {
    this.dialogRef.close();
  }

  async save() {
    if (this.saving()) return;
    this.syncSelectedDaySegments();
    this.submitted.set(true);
    this.form.markAllAsTouched();
    this.form.updateValueAndValidity();
    if (this.form.invalid || this.form.pristine) return;
    this.saving.set(true);
    try {
      const raw = this.form.getRawValue();
      const availableDays = this.availableDaysList();
      const currentUser = this.authService.currentDoctor;
      const canManagePatientScheduling = currentUser?.role === 'doctor';

      const targetUid = this.doctorId;

      const oldUser = await this.userRepo.getUser(targetUid);
      const availabilitySettings = {
        consultationDuration: raw.consultationDuration ?? 30,
        availableDays,
        timeSegmentsByDay: cloneTimeSegmentsByDay(this.timeSegmentsByDay()),
      };
      const savedSettings: SettingsSaveResult = {
        ...availabilitySettings,
        allowPatientScheduling: canManagePatientScheduling
          ? raw.allowPatientScheduling ?? false
          : oldUser?.allowPatientScheduling ?? this.initialAllowPatientScheduling,
      };
      const updateData = {
        ...availabilitySettings,
        ...(canManagePatientScheduling
          ? { allowPatientScheduling: savedSettings.allowPatientScheduling }
          : {}),
        timeSegments: [],
      };
      await this.userRepo.updateSchedule(targetUid, updateData);

      this.alert.success({ message: 'Configuración guardada', duration: 5000 });
      if (currentUser?.uid === targetUid) {
        this.authService.updateCurrentDoctor(savedSettings);
      }
      this.dialogRef.close(savedSettings);
    } catch (e: any) {
      console.error('Settings save error:', e);
      this.alert.error({ message: 'Error al guardar configuración' });
      this.cdr.markForCheck();
    } finally {
      this.saving.set(false);
      this.cdr.markForCheck();
    }
  }
}
