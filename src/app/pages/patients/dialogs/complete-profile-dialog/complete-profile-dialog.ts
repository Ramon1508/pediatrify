import { Component, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatRadioModule } from '@angular/material/radio';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { Patient, VaccineDose } from '../../../../core/models/user';
import { Sexo } from '../../../../core/models/sexo';
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
  selector: 'app-complete-profile-dialog',
  templateUrl: './complete-profile-dialog.html',
  styleUrl: './complete-profile-dialog.scss',
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
    MatDatepickerModule,
    MatRadioModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatAutocompleteModule,
  ],
})
export class CompleteProfileDialog {
  private fb = inject(FormBuilder);
  private patientRepo = inject(PatientRepository);
  private alert = inject(AlertService);
  private cdr = inject(ChangeDetectorRef);
  private dialogRef = inject(MatDialogRef<CompleteProfileDialog>);

  protected bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  protected vaccines = VACCINES;
  protected ages = AGES;
  protected hasDoseAt = hasDoseAt;
  protected step = 1;
  protected submitting = false;
  protected submittedSteps = { 1: false, 2: false };
  protected patient: Patient | null = null;
  protected vaccinationMap = new Map<string, VaccineDose>();

  protected referredBySearchControl = new FormControl('');
  protected filteredPatients: Patient[] = [];
  private allPatients: Patient[] = [];

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
    email: ['', [Validators.required, Validators.email]],
    secondaryEmail: ['', [Validators.email]],
    phone: ['', Validators.required],
    secondaryPhone: [''],
    fatherName: ['', Validators.required],
    motherName: ['', Validators.required],
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
    this.cdr.markForCheck();
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

  private loadVaccination(p: Patient): void {
    this.vaccinationMap.clear();
    const record = p.vaccinationRecord;
    for (const vac of VACCINES) {
      const validAges = VACCINE_AGES[vac] ?? [];
      for (const age of validAges) {
        const key = `${vac}|${age}`;
        const dose: VaccineDose = record?.[vac]?.[age] ?? { applied: false };
        this.vaccinationMap.set(key, dose);
      }
    }
  }

  protected isVaccineApplied(vaccine: string, age: string): boolean {
    if (!hasDoseAt(vaccine, age)) return false;
    return this.vaccinationMap.get(`${vaccine}|${age}`)?.applied ?? false;
  }

  protected toggleDose(vaccine: string, age: string): void {
    if (!hasDoseAt(vaccine, age)) return;
    const key = `${vaccine}|${age}`;
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
        const key = `${vac}|${age}`;
        const dose = this.vaccinationMap.get(key);
        if (dose) ageMap[age] = dose;
      }
      record[vac] = ageMap;
    }
    return record;
  }

  protected nextStep(): void {
    this.submittedSteps[this.step as 1 | 2] = true;
    if (this.step === 1) {
      this.markStep1Touched();
      if (this.isStep1Invalid()) { this.cdr.markForCheck(); return; }
    }
    if (this.step === 2) {
      this.markStep2Touched();
      if (this.isStep2Invalid()) { this.cdr.markForCheck(); return; }
    }
    this.step++;
    this.cdr.markForCheck();
  }

  private markStep1Touched(): void {
    const c = this.form.controls;
    c.name.markAsTouched();
    c.birthDate.markAsTouched();
    c.bloodType.markAsTouched();
    c.birthWeight.markAsTouched();
    c.birthHeight.markAsTouched();
    c.sex.markAsTouched();
    c.birthMethod.markAsTouched();
    c.hasAllergies.markAsTouched();
    c.hasBeenHospitalized.markAsTouched();
    c.hasDisease.markAsTouched();
    c.takesMedication.markAsTouched();
  }

  private markStep2Touched(): void {
    const c = this.form.controls;
    c.email.markAsTouched();
    c.phone.markAsTouched();
    c.fatherName.markAsTouched();
    c.motherName.markAsTouched();
  }

  protected prevStep(): void {
    if (this.step > 1) this.step--;
  }

  private isStep1Invalid(): boolean {
    const c = this.form.controls;
    const step1Fields = [
      c.name, c.birthDate, c.bloodType, c.birthWeight, c.birthHeight,
      c.sex, c.birthMethod, c.hasAllergies, c.hasBeenHospitalized,
      c.hasDisease, c.takesMedication,
    ];
    if (c.hasAllergies.value && !c.allergies.value) return true;
    if (c.hasBeenHospitalized.value && !c.hospitalizationReason.value) return true;
    if (c.hasDisease.value && !c.diseaseDescription.value) return true;
    if (c.takesMedication.value && !c.medicationDescription.value) return true;
    return step1Fields.some((f) => f.invalid);
  }

  private isStep2Invalid(): boolean {
    const c = this.form.controls;
    return !!(!c.email.value || c.email.invalid || !c.phone.value || !c.fatherName.value || !c.motherName.value);
  }

  async save(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const p = this.patient;
    if (!p) return;

    this.submitting = true;
    const v = this.form.value;

    try {
      await this.patientRepo.updatePatient(p.id, {
        name: v.name ?? '',
        lastName: v.lastName ?? '',
        birthDate: typeof v.birthDate === 'string' ? v.birthDate : p.birthDate,
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
        profileComplete: true,
      });
      this.alert.success({ message: 'Perfil del paciente guardado.', duration: 3000 });
      this.dialogRef.close(true);
    } catch {
      this.alert.error({ message: 'Error al guardar el perfil del paciente', duration: 5000 });
    } finally {
      this.submitting = false;
      this.cdr.markForCheck();
    }
  }

  close(): void {
    this.dialogRef.close(false);
  }
}
