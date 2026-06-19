import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TextFieldModule, CdkTextareaAutosize } from '@angular/cdk/text-field';
import { ClinicalRecordRepository } from '../../../../core/repositories/clinical-record.repository';
import { AuthService } from '../../../../core/services/auth.service';
import { AlertService } from '../../../../core/services/alert.service';
import { RichTextEditor } from '../../../../shared/components/rich-text-editor/rich-text-editor';

@Component({
  selector: 'app-new-entry-dialog',
  templateUrl: './new-entry-dialog.html',
  styleUrl: './new-entry-dialog.scss',
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
    MatProgressSpinnerModule,
    MatSnackBarModule,
    TextFieldModule,
    CdkTextareaAutosize,
    RichTextEditor,
  ],
})
export class NewEntryDialog {
  private fb = inject(FormBuilder);
  private repo = inject(ClinicalRecordRepository);
  private authService = inject(AuthService);
  private alert = inject(AlertService);
  private snackBar = inject(MatSnackBar);
  private dialogRef = inject(MatDialogRef<NewEntryDialog>);

  protected patientId = '';
  protected ageDisplay = '';
  protected today = new Date();
  protected step = 1;
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

  get stepLabel(): string {
    switch (this.step) {
      case 1: return 'Datos y diagn\u00f3stico';
      case 2: return 'Recomendaciones';
      case 3: return 'Receta';
      default: return '';
    }
  }

  setPatientId(id: string) {
    this.patientId = id;
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
    if (this.step === 1 && this.step1Form.invalid) return;
    if (this.step === 2 && this.step2Form.invalid) return;
    if (this.step === 3 && this.step3Form.invalid) return;
    if (this.step < 3) {
      this.step++;
      this.submitted = false;
    }
  }

  prevStep() {
    if (this.step > 1) this.step--;
  }

  private toDateString(value: unknown): string | undefined {
    if (!value) return undefined;
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString().split('T')[0];
    return undefined;
  }

  async save() {
    this.submitted = true;
    if (this.step3Form.invalid) return;
    this.saving = true;
    try {
      const s1 = this.step1Form.getRawValue();
      const s2 = this.step2Form.value;
      const s3 = this.step3Form.value;
      const doctor = this.authService.currentDoctor;
      if (!doctor?.email) {
        throw new Error('No hay doctor autenticado');
      }
      if (!this.patientId) {
        throw new Error('No hay paciente seleccionado');
      }
      const id = crypto.randomUUID();
      await this.repo.create(id, {
        id,
        patientId: this.patientId,
        date: this.today.toISOString().split('T')[0],
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
        createdBy: doctor.email,
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
    if (this.step3Form.invalid) return;
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
      if (!this.patientId) {
        throw new Error('No hay paciente seleccionado');
      }
      const id = crypto.randomUUID();
      await this.repo.create(id, {
        id,
        patientId: this.patientId,
        date: this.today.toISOString().split('T')[0],
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
        createdBy: doctor.email,
      });
      this.dialogRef.close(true);
      printWindow.location.href = `/print/${id}`;
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
}
