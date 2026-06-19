import { Component, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TextFieldModule, CdkTextareaAutosize } from '@angular/cdk/text-field';
import { ClinicalRecordRepository } from '../../../../core/repositories/clinical-record.repository';
import { AuthService } from '../../../../core/services/auth.service';
import { AlertService } from '../../../../core/services/alert.service';
import { ClinicalRecord } from '../../../../core/models/clinical-record';
import { RichTextEditor } from '../../../../shared/components/rich-text-editor/rich-text-editor';

@Component({
  selector: 'app-edit-entry-dialog',
  templateUrl: './edit-entry-dialog.html',
  styleUrl: './edit-entry-dialog.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
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
export class EditEntryDialog {
  private fb = inject(FormBuilder);
  private repo = inject(ClinicalRecordRepository);
  private authService = inject(AuthService);
  private alert = inject(AlertService);
  private snackBar = inject(MatSnackBar);
  private dialogRef = inject(MatDialogRef<EditEntryDialog>);
  private cdr = inject(ChangeDetectorRef);

  protected record: ClinicalRecord | null = null;
  protected ageDisplay = '';
  protected selectedTab = 0;
  protected saving = false;
  protected submitted = false;

  protected noPastDates = (date: Date | null): boolean => {
    return date ? date >= new Date(new Date().toDateString()) : true;
  };

  protected step1Form = this.fb.group({
    headCircumference: ['', [Validators.required, Validators.pattern(/^\d+(\.\d+)?$/)]],
    weight: ['', [Validators.required, Validators.pattern(/^\d+(\.\d+)?$/)]],
    height: ['', [Validators.required, Validators.pattern(/^\d+(\.\d+)?$/)]],
    bmi: [{ value: '', disabled: true }],
    saturation: ['', [Validators.required, Validators.pattern(/^\d+(\.\d+)?$/)]],
    temperature: ['', [Validators.required, Validators.pattern(/^\d+(\.\d+)?$/)]],
    motivoConsulta: ['', Validators.required],
    diagnosis: ['', Validators.required],
    notas: [''],
  });

  protected step2Form = this.fb.group({
    visibleUntil: ['', Validators.required],
    recommendations: [''],
  });

  protected step3Form = this.fb.group({
    visibleUntilRx: ['', Validators.required],
    prescription: [''],
  });

  private parseDate(value: string | undefined): string {
    if (!value) return '';
    const d = new Date(value);
    return isNaN(d.getTime()) ? '' : value;
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

  private toDateString(value: unknown): string | undefined {
    if (!value) return undefined;
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString().split('T')[0];
    return undefined;
  }

  async save() {
    this.submitted = true;
    if (this.step1Form.invalid || this.step2Form.invalid || this.step3Form.invalid) return;
    if (!this.record) return;
    this.saving = true;
    try {
      const s1 = this.step1Form.getRawValue();
      const s2 = this.step2Form.value;
      const s3 = this.step3Form.value;
      const doctor = this.authService.currentDoctor;
      if (!doctor?.email) {
        throw new Error('No hay doctor autenticado');
      }
      await this.repo.update(this.record.id, {
        headCircumference: s1.headCircumference ? parseFloat(s1.headCircumference) : undefined,
        weight: s1.weight ? parseFloat(s1.weight) : undefined,
        height: s1.height ? parseFloat(s1.height) : undefined,
        bmi: s1.bmi ? parseFloat(s1.bmi) : undefined,
        saturation: s1.saturation ? parseFloat(s1.saturation) : undefined,
        temperature: s1.temperature ? parseFloat(s1.temperature) : undefined,
        motivoConsulta: s1.motivoConsulta ?? '',
        diagnosis: s1.diagnosis ?? '',
        notas: s1.notas || undefined,
        recommendations: s2.recommendations || undefined,
        visibleUntil: this.toDateString(s2.visibleUntil),
        prescription: s3.prescription || undefined,
        visibleUntilRx: this.toDateString(s3.visibleUntilRx),
        updatedBy: doctor.email,
      });
      this.snackBar.open('Se han guardado los cambios.', 'Cerrar', {
        duration: 5000,
        panelClass: 'success-snackbar',
      });
      this.dialogRef.close(true);
    } catch (e) {
      console.error('Save error:', e);
      const msg = e instanceof Error ? e.message : 'Error al guardar la entrada';
      this.alert.error({ message: msg, duration: 5000 });
    } finally {
      this.saving = false;
    }
  }

  async saveAndPrint() {
    this.submitted = true;
    if (this.step1Form.invalid || this.step2Form.invalid || this.step3Form.invalid) return;
    if (!this.record) return;
    // Open popup before async to avoid popup blockers
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      this.alert.error({ message: 'Permite ventanas emergentes para imprimir', duration: 5000 });
      return;
    }
    this.saving = true;
    try {
      const s1 = this.step1Form.getRawValue();
      const s2 = this.step2Form.value;
      const s3 = this.step3Form.value;
      const doctor = this.authService.currentDoctor;
      if (!doctor?.email) {
        throw new Error('No hay doctor autenticado');
      }
      await this.repo.update(this.record.id, {
        headCircumference: s1.headCircumference ? parseFloat(s1.headCircumference) : undefined,
        weight: s1.weight ? parseFloat(s1.weight) : undefined,
        height: s1.height ? parseFloat(s1.height) : undefined,
        bmi: s1.bmi ? parseFloat(s1.bmi) : undefined,
        saturation: s1.saturation ? parseFloat(s1.saturation) : undefined,
        temperature: s1.temperature ? parseFloat(s1.temperature) : undefined,
        motivoConsulta: s1.motivoConsulta ?? '',
        diagnosis: s1.diagnosis ?? '',
        notas: s1.notas || undefined,
        recommendations: s2.recommendations || undefined,
        visibleUntil: this.toDateString(s2.visibleUntil),
        prescription: s3.prescription || undefined,
        visibleUntilRx: this.toDateString(s3.visibleUntilRx),
        updatedBy: doctor.email,
      });
      this.dialogRef.close(true);
      printWindow.location.href = `/print/${this.record.id}`;
      printWindow.focus();
    } catch (e) {
      console.error('Save and print error:', e);
      const msg = e instanceof Error ? e.message : 'Error al guardar la entrada';
      printWindow.close();
      this.alert.error({ message: msg, duration: 5000 });
    } finally {
      this.saving = false;
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
