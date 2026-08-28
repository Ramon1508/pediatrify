import { Component, inject, signal, ChangeDetectionStrategy, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { TextFieldModule, CdkTextareaAutosize } from '@angular/cdk/text-field';
import { Subscription } from 'rxjs';
import { ClinicalRecordRepository } from '../../../../core/repositories/clinical-record.repository';
import { AuthService } from '../../../../core/services/auth.service';
import { AlertService } from '../../../../core/services/alert.service';
import { ClinicalRecord } from '../../../../core/models/clinical-record';
import { dateStringToLocalDate, dateToString, formatLocalDate, todayLocalDateString } from '../../../../core/utils/date-utils';
import { RichTextEditor } from '../../../../shared/components/rich-text-editor/rich-text-editor';

@Component({
  selector: 'app-clinical-entry-dialog',
  templateUrl: './clinical-entry-dialog.html',
  styleUrl: './clinical-entry-dialog.scss',
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
    MatTabsModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    TextFieldModule,
    CdkTextareaAutosize,
    RichTextEditor,
  ],
})
export class ClinicalEntryDialog implements OnDestroy {
  private fb = inject(FormBuilder);
  private repo = inject(ClinicalRecordRepository);
  private authService = inject(AuthService);
  private alert = inject(AlertService);
  private dialogRef = inject(MatDialogRef<ClinicalEntryDialog>);
  private cdr = inject(ChangeDetectorRef);
  private statusSub: Subscription | null = null;

  protected record: ClinicalRecord | null = null;
  protected patientId = '';
  protected ageDisplay = '';
  protected today = new Date();
  protected step = 1;
  protected selectedTab = 0;
  protected saving = false;
  protected submitted = false;
  protected editContext: 'general' | 'recommendations' | 'prescription' = 'general';

  protected get isEdit(): boolean {
    return this.record !== null;
  }

  protected get editTitle(): string {
    return this.isEdit ? 'Editar datos de la consulta' : 'Nueva entrada';
  }

  protected tabsInvalid = signal<boolean[]>([false, false, false]);

  private refreshTabsInvalid(): void {
    const forms = [this.step1Form, this.step2Form, this.step3Form];
    this.tabsInvalid.set(
      forms.map((form) => {
        if (!form) return false;
        return Object.values(form.controls).some((c) => c.invalid);
      })
    );
  }

  constructor() {
    this.statusSub = [
      this.step1Form,
      this.step2Form,
      this.step3Form,
    ].reduce((acc, form) => {
      if (form) acc.add(form.statusChanges.subscribe(() => {
        if (this.submitted) this.refreshTabsInvalid();
      }));
      return acc;
    }, new Subscription());
  }

  ngOnDestroy() {
    this.statusSub?.unsubscribe();
  }

  protected noPastDates = (date: Date | null): boolean => {
    if (this.isEdit) return true;
    return date ? date >= new Date(new Date().toDateString()) : true;
  };

  protected formatCivilDate(value: unknown): string {
    return formatLocalDate(value);
  }

  protected step1Form = this.fb.group({
    headCircumference: ['', [Validators.required, Validators.pattern(/^\d+(\.\d+)?$/)]],
    weight: ['', [Validators.required, Validators.pattern(/^\d+(\.\d+)?$/)]],
    height: ['', [Validators.required, Validators.pattern(/^\d+(\.\d+)?$/)]],
    bmi: [''],
    saturation: ['', [Validators.required, Validators.pattern(/^\d+(\.\d+)?$/)]],
    temperature: ['', [Validators.required, Validators.pattern(/^\d+(\.\d+)?$/)]],
    motivoConsulta: ['', Validators.required],
    diagnosis: ['', Validators.required],
    notas: [''],
  });

  protected step2Form = this.fb.group({
    visibleUntil: [null as unknown as string | Date, Validators.required],
    recommendations: [''],
  });

  protected step3Form = this.fb.group({
    visibleUntilRx: [null as unknown as string | Date, Validators.required],
    prescription: [''],
  });

  get stepLabel(): string {
    switch (this.step) {
      case 1: return 'Datos y diagnóstico';
      case 2: return 'Recomendaciones';
      case 3: return 'Receta';
      default: return '';
    }
  }

  setPatientId(id: string) {
    this.patientId = id;
  }

  setRecord(record: ClinicalRecord) {
    this.record = record;
    this.step1Form.patchValue({
      headCircumference: record.headCircumference != null ? String(record.headCircumference) : '',
      weight: record.weight != null ? String(record.weight) : '',
      height: record.height != null ? String(record.height) : '',
      bmi: record.bmi != null ? String(record.bmi) : '',
      saturation: record.saturation != null ? String(record.saturation) : '',
      temperature: record.temperature != null ? String(record.temperature) : '',
      motivoConsulta: record.motivoConsulta ?? '',
      diagnosis: record.diagnosis ?? '',
      notas: record.notas ?? '',
    });
    this.step2Form.patchValue({
      visibleUntil: this.parseDate(record.visibleUntil),
      recommendations: record.recommendations ?? '',
    });
    this.step3Form.patchValue({
      visibleUntilRx: this.parseDate(record.visibleUntilRx),
      prescription: record.prescription ?? '',
    });
    this.cdr.markForCheck();
  }

  setEditContext(context: 'general' | 'recommendations' | 'prescription') {
    this.editContext = context;
  }

  setAge(age: string) {
    this.ageDisplay = age;
  }

  close() {
    this.dialogRef.close();
  }

  calcBMI() {
    const w = parseFloat(this.step1Form.get('weight')?.value ?? '');
    const h = parseFloat(this.step1Form.get('height')?.value ?? '');
    if (w && h && h > 0) {
      const hMeters = h / 100;
      const bmi = w / (hMeters * hMeters);
      this.step1Form.get('bmi')?.setValue(String(Math.round(bmi * 100) / 100));
    }
  }

  nextStep() {
    this.submitted = true;
    this.refreshTabsInvalid();
    this.cdr.markForCheck();
    if (this.step === 1 && this.step1Form.invalid) return;
    if (this.step === 2 && this.step2Form.invalid) return;
    if (this.step === 3 && this.step3Form.invalid) return;
    if (this.step < 3) {
      this.step++;
      this.submitted = false;
      this.refreshTabsInvalid();
      this.cdr.markForCheck();
    }
  }

  prevStep() {
    if (this.step > 1) this.step--;
  }

  private parseDate(value: unknown): Date | string {
    if (!value) return '';
    const date = dateToString(value);
    return date ? dateStringToLocalDate(date) : '';
  }

  async save() {
    this.submitted = true;
    this.refreshTabsInvalid();
    this.cdr.markForCheck();
    if (this.isEdit) {
      if (this.editContext === 'recommendations') {
        if (this.step2Form.invalid) {
          this.alert.error({ message: 'Completa todos los campos requeridos', duration: 5000 });
          return;
        }
      } else if (this.editContext === 'prescription') {
        if (this.step3Form.invalid) {
          this.alert.error({ message: 'Completa todos los campos requeridos', duration: 5000 });
          return;
        }
      } else {
        if (this.step1Form.invalid || this.step2Form.invalid || this.step3Form.invalid) {
          this.alert.error({ message: 'Completa todos los campos requeridos', duration: 5000 });
          return;
        }
      }
      if (!this.record) return;
    } else {
      if (this.step3Form.invalid) {
        this.alert.error({ message: 'Completa todos los campos requeridos', duration: 5000 });
        return;
      }
      if (!this.patientId) {
        throw new Error('No hay paciente seleccionado');
      }
    }
    this.saving = true;
    this.cdr.markForCheck();
    try {
      const s1 = this.step1Form.getRawValue();
      const s2 = this.step2Form.value;
      const s3 = this.step3Form.value;
      const doctor = this.authService.currentDoctor;
      if (!doctor?.email) {
        throw new Error('No hay doctor autenticado');
      }

      const data = {
        headCircumference: s1.headCircumference ? parseFloat(s1.headCircumference) : undefined,
        weight: s1.weight ? parseFloat(s1.weight) : undefined,
        height: s1.height ? parseFloat(s1.height) : undefined,
        bmi: s1.bmi ? parseFloat(s1.bmi) : undefined,
        saturation: s1.saturation ? parseFloat(s1.saturation) : undefined,
        temperature: s1.temperature ? parseFloat(s1.temperature) : undefined,
        motivoConsulta: s1.motivoConsulta ?? '',
        diagnosis: s1.diagnosis ?? '',
        notas: s1.notas ?? '',
        recommendations: s2.recommendations ?? '',
        visibleUntil: dateToString(s2.visibleUntil),
        prescription: s3.prescription ?? '',
        visibleUntilRx: dateToString(s3.visibleUntilRx),
      };

      if (this.isEdit) {
        await this.repo.update(this.record!.id, {
          ...data,
          updatedBy: doctor.email,
        });
      } else {
        const id = crypto.randomUUID();
        await this.repo.create(id, {
          id,
          ...data,
          patientId: this.patientId,
          date: todayLocalDateString(),
          createdBy: doctor.email,
        });
      }

      this.dialogRef.close(true);
    } catch (e) {
      console.error('Save error:', e);
      const msg = e instanceof Error ? e.message : 'Error al guardar la entrada';
      this.alert.error({ message: msg, duration: 5000 });
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }

  async saveAndPrint() {
    this.submitted = true;
    this.refreshTabsInvalid();
    this.cdr.markForCheck();
    if (this.isEdit) {
      if (this.editContext === 'recommendations') {
        if (this.step2Form.invalid) {
          this.alert.error({ message: 'Completa todos los campos requeridos', duration: 5000 });
          return;
        }
      } else if (this.editContext === 'prescription') {
        if (this.step3Form.invalid) {
          this.alert.error({ message: 'Completa todos los campos requeridos', duration: 5000 });
          return;
        }
      } else {
        if (this.step1Form.invalid || this.step2Form.invalid || this.step3Form.invalid) {
          this.alert.error({ message: 'Completa todos los campos requeridos', duration: 5000 });
          return;
        }
      }
      if (!this.record) return;
    } else {
      if (this.step3Form.invalid) {
        this.alert.error({ message: 'Completa todos los campos requeridos', duration: 5000 });
        return;
      }
      if (!this.patientId) {
        throw new Error('No hay paciente seleccionado');
      }
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      this.alert.error({ message: 'Permite ventanas emergentes para imprimir', duration: 5000 });
      return;
    }
    this.saving = true;
    this.cdr.markForCheck();
    try {
      const s1 = this.step1Form.getRawValue();
      const s2 = this.step2Form.value;
      const s3 = this.step3Form.value;
      const doctor = this.authService.currentDoctor;
      if (!doctor?.email) {
        throw new Error('No hay doctor autenticado');
      }

      const data = {
        headCircumference: s1.headCircumference ? parseFloat(s1.headCircumference) : undefined,
        weight: s1.weight ? parseFloat(s1.weight) : undefined,
        height: s1.height ? parseFloat(s1.height) : undefined,
        bmi: s1.bmi ? parseFloat(s1.bmi) : undefined,
        saturation: s1.saturation ? parseFloat(s1.saturation) : undefined,
        temperature: s1.temperature ? parseFloat(s1.temperature) : undefined,
        motivoConsulta: s1.motivoConsulta ?? '',
        diagnosis: s1.diagnosis ?? '',
        notas: s1.notas ?? '',
        recommendations: s2.recommendations ?? '',
        visibleUntil: dateToString(s2.visibleUntil),
        prescription: s3.prescription ?? '',
        visibleUntilRx: dateToString(s3.visibleUntilRx),
      };

      let recordId: string;

      if (this.isEdit) {
        recordId = this.record!.id;
        await this.repo.update(recordId, {
          ...data,
          updatedBy: doctor.email,
        });
      } else {
        recordId = crypto.randomUUID();
        await this.repo.create(recordId, {
          id: recordId,
          ...data,
          patientId: this.patientId,
          date: todayLocalDateString(),
          createdBy: doctor.email,
        });
      }

      this.dialogRef.close(true);
      printWindow.location.href = `/print/${recordId}`;
      printWindow.focus();
    } catch (e) {
      console.error('Save and print error:', e);
      const msg = e instanceof Error ? e.message : 'Error al guardar la entrada';
      printWindow.close();
      this.alert.error({ message: msg, duration: 5000 });
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }

  print() {
    if (!this.record) return;
    const printWindow = window.open(`/print/${this.record.id}`, '_blank');
    if (!printWindow) {
      this.alert.error({ message: 'Permite ventanas emergentes para imprimir', duration: 5000 });
      return;
    }
    printWindow.focus();
    this.dialogRef.close();
  }
}
