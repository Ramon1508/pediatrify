import { Component, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatTabsModule } from '@angular/material/tabs';
import { MatRadioModule } from '@angular/material/radio';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { Patient, VaccineDose } from '../../../../core/models/user';
import { Sexo, SexoLabel } from '../../../../core/models/sexo';
import { PatientRepository } from '../../../../core/repositories/patient.repository';
import { AlertService } from '../../../../core/services/alert.service';

const VACCINES = [
  'BCG',
  'Hepatitis B',
  'Hexavalente',
  'DPaT',
  'Rotavirus monovalente',
  'Rotavirus pentavalente',
  'Neumococo conjugada',
  'Virus de influenza',
  'Covid-19 ARNm',
  'Sarampión, Rubéola y Parotiditis',
  'Varicela',
  'Hepatitis A',
  'Meningococo ACYW',
  'Neumococo Polisacáridos',
] as const;

const AGES = [
  'Al nacer',
  '2 meses',
  '4 meses',
  '6 meses',
  '7 meses',
  '9 meses',
  '12 meses',
  '18 meses',
  '2 años',
  '4-6 años',
  'Anual',
] as const;

const VACCINE_AGES: Record<string, string[]> = {
  'BCG': ['Al nacer'],
  'Hepatitis B': ['Al nacer'],
  'Hexavalente': ['2 meses', '4 meses', '6 meses', '18 meses'],
  'DPaT': ['4-6 años'],
  'Rotavirus monovalente': ['2 meses', '4 meses'],
  'Rotavirus pentavalente': ['2 meses', '4 meses', '6 meses'],
  'Neumococo conjugada': ['2 meses', '4 meses', '6 meses', '12 meses'],
  'Virus de influenza': ['6 meses', '7 meses', 'Anual'],
  'Covid-19 ARNm': ['6 meses', 'Anual'],
  'Sarampión, Rubéola y Parotiditis': ['12 meses', '18 meses'],
  'Varicela': ['12 meses', '18 meses'],
  'Hepatitis A': ['12 meses', '18 meses'],
  'Meningococo ACYW': ['9 meses', '12 meses'],
  'Neumococo Polisacáridos': ['2 años'],
};

type VaccineKey = `${(typeof VACCINES)[number]}|${(typeof AGES)[number]}`;

function makeKey(vaccine: string, age: string): VaccineKey {
  return `${vaccine}|${age}` as VaccineKey;
}

function hasDoseAt(vaccine: string, age: string): boolean {
  return (VACCINE_AGES[vaccine] ?? []).includes(age);
}

function toDateString(birthDate: unknown): string {
  if (typeof birthDate === 'string') return birthDate.split('T')[0];
  if (birthDate && typeof (birthDate as any).toDate === 'function') {
    const d = (birthDate as any).toDate() as Date;
    return d.toISOString().split('T')[0];
  }
  return '';
}

@Component({
  selector: 'app-edit-patient-dialog',
  templateUrl: './edit-patient-dialog.html',
  styleUrl: './edit-patient-dialog.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    DatePipe,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatTabsModule,
    MatRadioModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatAutocompleteModule,
  ],
})
export class EditPatientDialog {
  private fb = inject(FormBuilder);
  private patientRepo = inject(PatientRepository);
  private alert = inject(AlertService);
  private cdr = inject(ChangeDetectorRef);
  private dialogRef = inject(MatDialogRef<EditPatientDialog>);
  private snackBar = inject(MatSnackBar);

  protected SexoLabel = SexoLabel;
  protected bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  private tabControls = [
    ['name', 'lastName', 'birthDate', 'bloodType', 'birthWeight', 'birthHeight', 'headCircumference', 'sex', 'birthMethod', 'hasAllergies', 'allergies', 'hasBeenHospitalized', 'hospitalizationReason', 'hasDisease', 'diseaseDescription', 'takesMedication', 'medicationDescription'],
    ['email', 'secondaryEmail', 'phone', 'secondaryPhone', 'fatherName', 'motherName', 'referredBy'],
    [],
  ];

  protected tabHasInvalid(index: number): boolean {
    if (!this.saved) return false;
    return this.tabControls[index].some((name) => this.form.get(name)?.invalid ?? false);
  }
  protected vaccines = VACCINES;
  protected ages = AGES;
  protected submitting = false;
  protected saved = false;
  protected saveSuccess = '';
  protected referredBySearchControl = new FormControl('');
  protected filteredPatients: Patient[] = [];
  private allPatients: Patient[] = [];
  protected patient: Patient | null = null;
  protected vaccinationMap = new Map<VaccineKey, VaccineDose>();
  private initialFormValue: Record<string, any> | null = null;

  protected readOnly = true;

  protected get sexoLabel(): string {
    return this.patient?.sex ? SexoLabel[this.patient.sex] : '';
  }

  setMode(mode: 'view' | 'edit') {
    this.readOnly = mode === 'view';
    if (this.readOnly) {
      this.form.disable();
    } else {
      this.form.enable();
      if (this.patient) this.syncConditionalValidators(this.patient);
    }
    this.cdr.markForCheck();
  }

  switchToEdit() {
    this.setMode('edit');
  }

  protected form = this.fb.group({
    name: ['', Validators.required],
    lastName: ['', Validators.required],
    birthDate: ['', Validators.required],
    bloodType: ['', Validators.required],
    birthWeight: [null as number | null, [Validators.required, Validators.min(0), Validators.pattern(/^\d+(\.\d+)?$/)]],
    birthHeight: [null as number | null, [Validators.required, Validators.min(0), Validators.pattern(/^\d+(\.\d+)?$/)]],
    headCircumference: [null as number | null, [Validators.min(0), Validators.pattern(/^\d+(\.\d+)?$/)]],
    sex: [null as Sexo | null, Validators.required],
    birthMethod: ['', Validators.required],
    hasAllergies: [null as boolean | null, Validators.required],
    allergies: [''],
    hasBeenHospitalized: [null as boolean | null, Validators.required],
    hospitalizationReason: [''],
    hasDisease: [null as boolean | null, Validators.required],
    diseaseDescription: [''],
    takesMedication: [null as boolean | null, Validators.required],
    medicationDescription: [''],
    email: ['', [Validators.email]],
    secondaryEmail: ['', [Validators.email]],
    phone: [''],
    secondaryPhone: [''],
    fatherName: [''],
    motherName: [''],
    referredBy: [''],
  });

  setPatient(patient: Patient): void {
    this.patient = patient;
    const p = patient;
    const dateStr = toDateString(p.birthDate);
    this.form.patchValue({
      name: p.name ?? '',
      lastName: p.lastName ?? '',
      birthDate: dateStr,
      bloodType: p.bloodType ?? '',
      birthWeight: p.birthWeight ?? null,
      birthHeight: p.birthHeight ?? null,
      headCircumference: p.headCircumference ?? null,
      sex: p.sex ?? null,
      birthMethod: p.birthMethod ?? '',
      hasAllergies: p.hasAllergies ?? null,
      allergies: p.hasAllergies === true ? (p.allergies ?? '') : '',
      hasBeenHospitalized: p.hasBeenHospitalized ?? null,
      hospitalizationReason: p.hasBeenHospitalized === true ? (p.hospitalizationReason ?? '') : '',
      hasDisease: p.hasDisease ?? null,
      diseaseDescription: p.hasDisease === true ? (p.diseaseDescription ?? '') : '',
      takesMedication: p.takesMedication ?? null,
      medicationDescription: p.takesMedication === true ? (p.medicationDescription ?? '') : '',
      email: p.email ?? '',
      secondaryEmail: p.secondaryEmail ?? '',
      phone: p.phone ?? '',
      secondaryPhone: p.secondaryPhone ?? '',
      fatherName: p.fatherName ?? '',
      motherName: p.motherName ?? '',
      referredBy: p.referredBy ?? '',
    });

    this.referredBySearchControl.setValue(p.referredBy ?? '');
    this.patientRepo.getAllPatients().then((patients) => {
      this.allPatients = patients;
      this.filteredPatients = patients;
      this.cdr.markForCheck();
    });

    this.syncConditionalValidators(p);
    this.loadVaccination(p);
    this.initialFormValue = { ...this.form.value };
    this.cdr.markForCheck();
  }

  private syncConditionalValidators(p: Patient): void {
    const setRequired = (name: string, condition: boolean) => {
      const c = this.form.get(name);
      if (condition) {
        c?.setValidators(Validators.required);
      } else {
        c?.clearValidators();
      }
      c?.updateValueAndValidity();
    };
    setRequired('allergies', p.hasAllergies === true);
    setRequired('hospitalizationReason', p.hasBeenHospitalized === true);
    setRequired('diseaseDescription', p.hasDisease === true);
    setRequired('medicationDescription', p.takesMedication === true);
  }

  protected filterReferredBy(search: string): void {
    const term = search.toLowerCase();
    this.filteredPatients = this.allPatients.filter(
      (p) => (p.name + ' ' + p.lastName).toLowerCase().includes(term)
    );
  }

  protected onReferredBySelected(p: Patient): void {
    const name = p.name + ' ' + p.lastName;
    this.form.patchValue({ referredBy: name });
    this.referredBySearchControl.setValue(name);
  }

  protected displayReferredBy(p: Patient): string {
    return p ? p.name + ' ' + p.lastName : '';
  }

  protected onReferredByBlur(): void {
    const control = this.referredBySearchControl;
    const matched = this.allPatients.find(
      (p) => (p.name + ' ' + p.lastName) === control.value
    );
    if (!matched && control.value) {
      control.setValue('');
      this.form.patchValue({ referredBy: '' });
    }
  }

  private loadVaccination(p: Patient): void {
    this.vaccinationMap.clear();
    const record = p.vaccinationRecord;
    for (const vac of VACCINES) {
      const validAges = VACCINE_AGES[vac] ?? [];
      for (const age of validAges) {
        const key = makeKey(vac, age);
        const dose: VaccineDose = record?.[vac]?.[age] ?? { applied: false };
        this.vaccinationMap.set(key, dose);
      }
    }
  }

  protected hasDoseAt = hasDoseAt;

  protected isVaccineApplied(vaccine: string, age: string): boolean {
    if (!hasDoseAt(vaccine, age)) return false;
    return this.vaccinationMap.get(makeKey(vaccine, age))?.applied ?? false;
  }

  protected toggleDose(vaccine: string, age: string): void {
    if (this.readOnly) return;
    if (!hasDoseAt(vaccine, age)) return;
    const key = makeKey(vaccine, age);
    const current = this.vaccinationMap.get(key) ?? { applied: false };
    this.vaccinationMap.set(key, { ...current, applied: !current.applied });
  }

  protected onHasAllergiesChange(value: boolean): void {
    const c = this.form.get('allergies');
    if (value) {
      c?.setValidators(Validators.required);
    } else {
      c?.clearValidators();
      this.form.patchValue({ allergies: '' });
    }
    c?.updateValueAndValidity();
  }

  protected onHospitalizedChange(value: boolean): void {
    const c = this.form.get('hospitalizationReason');
    if (value) {
      c?.setValidators(Validators.required);
    } else {
      c?.clearValidators();
      this.form.patchValue({ hospitalizationReason: '' });
    }
    c?.updateValueAndValidity();
  }

  protected onHasDiseaseChange(value: boolean): void {
    const c = this.form.get('diseaseDescription');
    if (value) {
      c?.setValidators(Validators.required);
    } else {
      c?.clearValidators();
      this.form.patchValue({ diseaseDescription: '' });
    }
    c?.updateValueAndValidity();
  }

  protected onTakesMedicationChange(value: boolean): void {
    const c = this.form.get('medicationDescription');
    if (value) {
      c?.setValidators(Validators.required);
    } else {
      c?.clearValidators();
      this.form.patchValue({ medicationDescription: '' });
    }
    c?.updateValueAndValidity();
  }

  private buildVaccinationRecord(): Record<string, Record<string, VaccineDose>> {
    const record: Record<string, Record<string, VaccineDose>> = {};
    for (const vac of VACCINES) {
      const validAges = VACCINE_AGES[vac] ?? [];
      const ageMap: Record<string, VaccineDose> = {};
      for (const age of validAges) {
        const key = makeKey(vac, age);
        const dose = this.vaccinationMap.get(key);
        if (dose) ageMap[age] = dose;
      }
      record[vac] = ageMap;
    }
    return record;
  }

  async save(): Promise<void> {
    this.saved = true;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const p = this.patient;
    if (!p) return;

    const hasFormChanged = this.initialFormValue && JSON.stringify(this.form.value) !== JSON.stringify(this.initialFormValue);
    const hasVaccinationChanged = p && JSON.stringify(this.buildVaccinationRecord()) !== JSON.stringify(p.vaccinationRecord ?? {});
    if (!hasFormChanged && !hasVaccinationChanged) {
      this.snackBar.open('No hay cambios que guardar', 'Cerrar', {
        duration: 5000,
        panelClass: 'edit-snackbar',
      });
      return;
    }

    this.submitting = true;
    const v = this.form.value;

    try {
      await this.patientRepo.updatePatient(p.id, {
        name: v.name ?? '',
        lastName: v.lastName ?? '',
        bloodType: v.bloodType ?? '',
        birthWeight: v.birthWeight ?? 0,
        birthHeight: v.birthHeight ?? 0,
        headCircumference: v.headCircumference ?? 0,
        sex: v.sex ?? undefined,
        birthMethod: (v.birthMethod ?? '') as 'vaginal' | 'cesarean',
        hasAllergies: v.hasAllergies ?? false,
        allergies: v.hasAllergies ? (v.allergies ?? '') : '',
        hasBeenHospitalized: v.hasBeenHospitalized ?? false,
        hospitalizationReason: v.hasBeenHospitalized ? (v.hospitalizationReason ?? '') : '',
        hasDisease: v.hasDisease ?? false,
        diseaseDescription: v.hasDisease ? (v.diseaseDescription ?? '') : '',
        takesMedication: v.takesMedication ?? false,
        medicationDescription: v.takesMedication ? (v.medicationDescription ?? '') : '',
        email: v.email ?? '',
        secondaryEmail: v.secondaryEmail ?? undefined,
        phone: v.phone ?? '',
        secondaryPhone: v.secondaryPhone ?? undefined,
        fatherName: v.fatherName ?? '',
        motherName: v.motherName ?? '',
        referredBy: v.referredBy ?? undefined,
        vaccinationRecord: this.buildVaccinationRecord(),
      });
      this.setMode('view');
      this.saveSuccess = 'Cambios del perfil guardados.';
      setTimeout(() => { this.saveSuccess = ''; this.cdr.markForCheck(); }, 3000);
    } catch {
      this.alert.error({ message: 'Error al actualizar el paciente', duration: 5000 });
    } finally {
      this.submitting = false;
      this.cdr.markForCheck();
    }
  }

  close(): void {
    this.dialogRef.close(false);
  }
}
