import { Component, inject, signal, computed, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
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
import { dateStringToLocalDate, dateToString } from '../../../../core/utils/date-utils';
import { clinicTodayDate } from '../../../../core/utils/clinic-time';
import { greaterThanZero } from '../../../../core/utils/validators';
import { PatientRepository } from '../../../../core/repositories/patient.repository';
import { AlertService } from '../../../../core/services/alert.service';
import { AuthService } from '../../../../core/services/auth.service';

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
  private authService = inject(AuthService);
  private alert = inject(AlertService);
  private cdr = inject(ChangeDetectorRef);
  private dialogRef = inject(MatDialogRef<CompleteProfileDialog>);

  protected bloodTypes = signal(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']);
  protected vaccines = VACCINES;
  protected ages = signal(AGES);
  protected submitting = signal(false);
  protected patient: Patient | null = null;
  protected vaccinationMap = new Map<string, VaccineDose>();
  protected vaccinationVersion = signal(0);
  protected vaccineRows = computed(() =>
    VACCINES.map((vac) => ({
      vaccine: vac,
      doses: AGES.map((age) => ({
        age,
        hasDose: hasDoseAt(vac, age),
        applied: this.isVaccineApplied(vac, age),
      })),
    }))
  );
  protected step = signal(1);
  protected submittedSteps = signal<[boolean, boolean, boolean]>([false, false, false]);
  /** Máximo del datepicker de nacimiento: el día de hoy del consultorio. */
  protected maxBirthDate = signal(clinicTodayDate());

  protected referredBySearchControl = new FormControl('');
  protected filteredPatients = signal<Patient[]>([]);
  private allPatients: Patient[] = [];

  protected form = this.fb.group({
    fullName: ['', Validators.required],
    birthDate: [null as unknown as string | Date, Validators.required],
    bloodType: ['', Validators.required],
    birthWeight: [null as number | null, [Validators.required, Validators.pattern(/^\d+(\.\d+)?$/), greaterThanZero]],
    birthHeight: [null as number | null, [Validators.required, Validators.pattern(/^\d+(\.\d+)?$/), greaterThanZero]],
    headCircumference: [null as number | null, [Validators.pattern(/^\d+(\.\d+)?$/), greaterThanZero]],
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

  private splitFullName(fullName: string): { name: string; lastName: string } {
    const trimmed = fullName.trim();
    const lastSpace = trimmed.lastIndexOf(' ');
    if (lastSpace === -1) return { name: trimmed, lastName: '' };
    return { name: trimmed.substring(0, lastSpace), lastName: trimmed.substring(lastSpace + 1) };
  }

  setPatient(patient: Patient): void {
    this.patient = patient;
    const p = patient;
    const dateStr = dateToString(p.birthDate);
    this.form.patchValue({
      fullName: `${p.name} ${p.lastName}`.trim(),
      birthDate: dateStringToLocalDate(dateStr),
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
    this.allPatients = [];
    this.filteredPatients.set([]);
    const doctor = this.authService.currentDoctor;
    const patientsRequest = doctor?.role === 'doctor' && p.doctorId === doctor.uid
      ? this.patientRepo.getPatientsByDoctor(doctor.uid)
      : Promise.resolve([]);
    patientsRequest.then((patients) => {
      const current = this.authService.currentDoctor;
      this.allPatients = current?.role === 'doctor' && current.uid === doctor?.uid && this.patient?.doctorId === current.uid
        ? patients.filter((patient) => patient.doctorId === current.uid)
        : [];
      this.filteredPatients.set(this.allPatients);
      this.cdr.markForCheck();
    }).catch(() => {
      this.alert.error({ message: 'No fue posible cargar los pacientes para seleccionar quién lo recomendó.', duration: 5000 });
    });

    this.syncConditionalValidators(p);
    this.loadVaccination(p);
    this.cdr.markForCheck();
  }

  protected filterReferredBy(search: string): void {
    const term = search.toLowerCase();
    this.filteredPatients.set(this.allPatients.filter(
      (p) => (p.name + ' ' + p.lastName).toLowerCase().includes(term)
    ));
  }

  protected onReferredBySelected(p: Patient): void {
    const name = p.name + ' ' + p.lastName;
    this.form.patchValue({ referredBy: name });
    this.referredBySearchControl.setValue(name);
  }

  protected readonly displayReferredBy = signal((p: Patient): string => {
    return p ? p.name + ' ' + p.lastName : '';
  });

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
        const key = `${vac}|${ age}`;
        const dose: VaccineDose = record?.[vac]?.[age] ?? { applied: false };
        this.vaccinationMap.set(key, dose);
      }
    }
    this.vaccinationVersion.update((v) => v + 1);
  }

  protected isVaccineApplied(vaccine: string, age: string): boolean {
    if (!hasDoseAt(vaccine, age)) return false;
    this.vaccinationVersion();
    return this.vaccinationMap.get(`${vaccine}|${ age}`)?.applied ?? false;
  }

  protected toggleDose(vaccine: string, age: string): void {
    if (!hasDoseAt(vaccine, age)) return;
    const key = `${vaccine}|${age}`;
    const current = this.vaccinationMap.get(key) ?? { applied: false };
    this.vaccinationMap.set(key, { ...current, applied: !current.applied });
    this.vaccinationVersion.update((v) => v + 1);
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

  protected stepFields: Record<number, string[]> = {
    1: ['fullName', 'birthDate', 'bloodType', 'birthWeight', 'birthHeight', 'sex', 'birthMethod', 'hasAllergies', 'allergies', 'hasBeenHospitalized', 'hospitalizationReason', 'hasDisease', 'diseaseDescription', 'takesMedication', 'medicationDescription'],
    2: ['email', 'phone', 'fatherName', 'motherName'],
    3: [],
  };

  protected nextStep(): void {
    const idx = this.step() === 1 ? 0 : 1;
    const fields = this.stepFields[this.step()];
    this.submittedSteps.update(steps => steps.map((submitted, index) => index === idx || submitted) as [boolean, boolean, boolean]);
    for (const f of fields) {
      const ctrl = this.form.get(f);
      if (!ctrl?.valid) {
        ctrl?.markAsTouched();
      }
    }
    this.form.markAllAsTouched();
    const invalid = fields.some((f) => this.form.get(f)?.invalid);
    if (invalid) {
      this.cdr.markForCheck();
      return;
    }
    this.step.update(value => value + 1);
    window.scrollTo(0, 0);
    this.cdr.markForCheck();
  }

  protected prevStep(): void {
    this.step.update(value => value - 1);
    window.scrollTo(0, 0);
    this.cdr.markForCheck();
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

  async save(): Promise<void> {
    this.submittedSteps.update(([first, second]) => [first, second, true]);
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const p = this.patient;
    if (!p) return;

    this.submitting.set(true);
    const v = this.form.value;
    const { name, lastName } = this.splitFullName(v.fullName!);

    try {
      const birthDate = dateToString(v.birthDate) || p.birthDate;
      await this.patientRepo.updatePatient(p.id, {
        doctorId: p.doctorId,
        name,
        lastName,
        birthDate,
        bloodType: v.bloodType ?? '',
        birthWeight: v.birthWeight ?? 0,
        birthHeight: v.birthHeight ?? 0,
        headCircumference: v.headCircumference ?? null,
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
      this.submitting.set(false);
      this.cdr.markForCheck();
    }
  }

  close(): void {
    this.dialogRef.close(false);
  }
}
