import { Component, computed, inject, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PatientRepository } from '../../../../core/repositories/patient.repository';
import { AlertService } from '../../../../core/services/alert.service';
import { AuthService } from '../../../../core/services/auth.service';
import { EmailService, ClinicEmailDeliveryError } from '../../../../core/services/email.service';
import { Patient } from '../../../../core/models/user';
import { normalizeEmail } from '../../../../core/utils/normalize-email';
import { dateStringToLocalDate, dateToString } from '../../../../core/utils/date-utils';
import { clinicTodayDate } from '../../../../core/utils/clinic-time';

interface ParentInfo {
  email: string;
  secondaryEmail: string;
  phone: string;
  spouseName: string;
}

type DuplicateKind = 'email' | 'name';
interface DuplicateWarning {
  kind: DuplicateKind;
  fingerprint: string;
}

@Component({
  selector: 'app-new-patient-dialog',
  templateUrl: './new-patient-dialog.html',
  styleUrl: './new-patient-dialog.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatDatepickerModule,
    MatProgressSpinnerModule,
  ],
})
export class NewPatientDialog {
  private fb = inject(FormBuilder);
  private patientRepo = inject(PatientRepository);
  private authService = inject(AuthService);
  private alert = inject(AlertService);
  private emailService = inject(EmailService);
  private cdr = inject(ChangeDetectorRef);
  private dialogRef = inject(MatDialogRef<NewPatientDialog>, { optional: true });

  protected readonly editingPatient = signal<Patient | null>(null);
  protected readonly embeddedMode = signal(false);
  protected readonly createdPatient = signal<Patient | null>(null);
  protected readonly deliveryMessage = signal('');
  protected readonly title = computed(() => this.createdPatient() ? 'Paciente creado' : this.editingPatient() ? 'Editar paciente' : 'Añadir nuevo paciente');
  protected readonly saveLabel = computed(() => this.editingPatient() ? 'Actualizar' : 'Añadir paciente');
  private creationAttempt: { draft: string; operationId: string } | null = null;
  private originalUserId: string | null = null;
  private originalScope = '';
  private destroyed = false;
  private readonly destroyRef = inject(DestroyRef);

  @Input() set embedded(value: boolean) { this.embeddedMode.set(value); }
  get embedded(): boolean { return this.embeddedMode(); }
  @Input() set allPatients(patients: Patient[]) {
    this.setPatients(patients);
  }
  get allPatients(): Patient[] {
    return this._allPatients;
  }
  @Output() back = new EventEmitter<void>();
  @Output() saved = new EventEmitter<Patient>();

  private _allPatients: Patient[] = [];
  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);
  private readonly duplicateWarning = signal<DuplicateWarning | null>(null);
  protected readonly alertMsg = computed(() => {
    const warning = this.duplicateWarning();
    if (!warning) return '';
    return warning.kind === 'email'
      ? 'El o los correos electrónicos ingresados ya tienen una cuenta, por lo que este nuevo paciente se asociará a las cuentas existentes.'
      : 'Ya existe un paciente con ese nombre. Verifica los datos ingresados.';
  });
  protected readonly saveError = signal('');
  private readonly acceptedWarnings = new Set<DuplicateKind>();
  private confirmationFingerprint = '';

  private parentCache = new Map<string, ParentInfo>();
  private uniqueFatherNames: string[] = [];
  private uniqueMotherNames: string[] = [];
  protected readonly filteredFatherNames = signal<string[]>([]);
  protected readonly filteredMotherNames = signal<string[]>([]);

  /** Máximo del datepicker de nacimiento: el día de hoy del consultorio. */
  protected readonly maxBirthDate = signal(clinicTodayDate());

  protected form = this.fb.group({
    fullName: ['', Validators.required],
    birthDate: [null as unknown as string | Date, Validators.required],
    email: ['', [Validators.required, Validators.email]],
    secondaryEmail: ['', Validators.email],
    fatherName: ['', Validators.required],
    motherName: ['', Validators.required],
    phone: ['', [Validators.required, Validators.minLength(10)]],
  });

  private readonly formState = signal({ invalid: this.form.invalid, pristine: this.form.pristine });
  private readonly fieldState = signal<Record<string, { invalid: boolean; touched: boolean; dateMax: boolean }>>({});
  protected readonly fieldErrors = computed(() => Object.fromEntries(Object.entries(this.fieldState()).map(([key, state]) =>
    [key, state.invalid && (state.touched || this.submitted())])));
  protected readonly birthDateMaxError = computed(() => !!this.fieldErrors()['birthDate'] && this.fieldState()['birthDate']?.dateMax);
  protected readonly saveDisabled = computed(() => this.formState().invalid || this.formState().pristine || this.saving() || !!this.duplicateWarning() || !!this.createdPatient());
  protected readonly continueDisabled = computed(() => this.formState().invalid || this.saving());

  constructor() {
    this.destroyRef.onDestroy(() => { this.destroyed = true; });
    this.form.events.pipe(takeUntilDestroyed()).subscribe(() => {
      this.formState.set({ invalid: this.form.invalid, pristine: this.form.pristine });
      this.fieldState.set(Object.fromEntries(Object.entries(this.form.controls).map(([key, control]) =>
        [key, { invalid: control.invalid, touched: control.touched, dateMax: !!control.errors?.['matDatepickerMax'] }])));
      this.refreshConfirmation();
    });
  }

  private currentConfirmationFingerprint(): string {
    const value = this.form.getRawValue();
    const { name, lastName } = this.splitFullName(value.fullName ?? '');
    return JSON.stringify([this.doctorScope, normalizeEmail(value.email ?? ''), normalizeEmail(value.secondaryEmail ?? ''),
      name.toLowerCase(), lastName.toLowerCase()]);
  }

  private refreshConfirmation(): void {
    const fingerprint = this.currentConfirmationFingerprint();
    if (fingerprint === this.confirmationFingerprint) return;
    this.confirmationFingerprint = fingerprint;
    this.acceptedWarnings.clear();
    this.duplicateWarning.set(null);
    this.saveError.set('');
  }

  setPatients(patients: Patient[]) {
    this.acceptedWarnings.clear();
    this.duplicateWarning.set(null);
    this._allPatients = patients;
    this.buildParentCache();
  }

  private get doctorScope(): string {
    const currentUser = this.authService.currentDoctor;
    if (!currentUser) return '';
    if (currentUser.role === 'assistant') return currentUser.createdBy ?? '';
    return currentUser.role === 'doctor' ? currentUser.uid : '';
  }

  private get scopePatients(): Patient[] {
    const scope = this.doctorScope;
    if (!scope) return [];
    return this.allPatients.filter((p) => p.doctorId === scope);
  }

  private buildParentCache() {
    this.parentCache.clear();
    for (const p of this.allPatients) {
      if (p.fatherName) {
        const key = p.fatherName.trim().toLowerCase();
        if (!this.parentCache.has(key)) {
          this.parentCache.set(key, {
            email: p.email || '',
            secondaryEmail: p.secondaryEmail || '',
            phone: p.phone || '',
            spouseName: p.motherName || '',
          });
        }
      }
      if (p.motherName) {
        const key = p.motherName.trim().toLowerCase();
        if (!this.parentCache.has(key)) {
          this.parentCache.set(key, {
            email: p.secondaryEmail || p.email || '',
            secondaryEmail: p.email || '',
            phone: p.phone || '',
            spouseName: p.fatherName || '',
          });
        }
      }
    }
    this.uniqueFatherNames = [...new Set(this.allPatients.map(p => p.fatherName).filter((n): n is string => !!n))];
    this.uniqueMotherNames = [...new Set(this.allPatients.map(p => p.motherName).filter((n): n is string => !!n))];
    this.filteredFatherNames.set([...this.uniqueFatherNames]);
    this.filteredMotherNames.set([...this.uniqueMotherNames]);
  }

  protected filterFathers() {
    const val = this.form.get('fatherName')?.value?.toLowerCase().trim() || '';
    this.filteredFatherNames.set(this.uniqueFatherNames.filter(n => n.toLowerCase().includes(val)));
  }

  protected filterMothers() {
    const val = this.form.get('motherName')?.value?.toLowerCase().trim() || '';
    this.filteredMotherNames.set(this.uniqueMotherNames.filter(n => n.toLowerCase().includes(val)));
  }

  protected onFatherSelected(name: string) {
    const info = this.parentCache.get(name.trim().toLowerCase());
    if (!info) return;
    const emailCtrl = this.form.get('email');
    const phoneCtrl = this.form.get('phone');
    if (!emailCtrl?.value && info.email) emailCtrl?.setValue(info.email);
    if (!phoneCtrl?.value && info.phone) phoneCtrl?.setValue(info.phone);
    if (info.spouseName && !this.form.get('motherName')?.value) {
      this.form.get('motherName')?.setValue(info.spouseName);
      this.onMotherSelected(info.spouseName);
    }
  }

  protected onMotherSelected(name: string) {
    const info = this.parentCache.get(name.trim().toLowerCase());
    if (!info) return;
    const secEmailCtrl = this.form.get('secondaryEmail');
    const phoneCtrl = this.form.get('phone');
    if (!secEmailCtrl?.value && info.email) secEmailCtrl?.setValue(info.email);
    if (!phoneCtrl?.value && info.phone) phoneCtrl?.setValue(info.phone);
    if (info.spouseName && !this.form.get('fatherName')?.value) {
      this.form.get('fatherName')?.setValue(info.spouseName);
      this.onFatherSelected(info.spouseName);
    }
  }

  setEditData(patient: Patient) {
    this.editingPatient.set(patient);
    this.allPatients = this.allPatients.filter((p) => p.id !== patient.id);
    this.form.patchValue({
      fullName: `${patient.name} ${patient.lastName}`.trim(),
      birthDate: dateStringToLocalDate(dateToString(patient.birthDate)) as any,
      email: patient.email,
      secondaryEmail: patient.secondaryEmail || '',
      fatherName: patient.fatherName,
      motherName: patient.motherName,
      phone: patient.phone,
    });
  }

  private splitFullName(fullName: string): { name: string; lastName: string } {
    const trimmed = fullName.trim();
    const lastSpace = trimmed.lastIndexOf(' ');
    if (lastSpace === -1) return { name: trimmed, lastName: '' };
    return { name: trimmed.substring(0, lastSpace), lastName: trimmed.substring(lastSpace + 1) };
  }

  close() {
    if (this.saving()) return;
    if (this.createdPatient()) { this.complete(this.createdPatient()!); return; }
    if (this.embedded) {
      this.back.emit();
    } else {
      this.dialogRef?.close();
    }
  }

  /** El botón X cierra el diálogo; en modo embedded sale del sub-paso. */
  closeDialog() {
    this.close();
  }

  async save() {
    if (this.saving() || this.createdPatient() || this.destroyed) return;
    this.refreshConfirmation();
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    if (!this.editingPatient() && !this.doctorScope) {
      this.alert.error({ message: 'Solicita que se asigne un Doctor a tu cuenta antes de agregar pacientes.', duration: 5000 });
      return;
    }

    const f = this.form.value;
    const email = normalizeEmail(f.email!);
    const secondaryEmail = f.secondaryEmail ? normalizeEmail(f.secondaryEmail) : '';
    const { name, lastName } = this.splitFullName(f.fullName!);

    if (!this.editingPatient()) {
      const existingByEmail = this.scopePatients.filter(
        (p) => normalizeEmail(p.email ?? '') === email || (secondaryEmail && normalizeEmail(p.email ?? '') === secondaryEmail) ||
          (p.secondaryEmail && normalizeEmail(p.secondaryEmail) === email) || (secondaryEmail && normalizeEmail(p.secondaryEmail ?? '') === secondaryEmail)
      );

      if (existingByEmail.length > 0 && !this.acceptedWarnings.has('email')) {
        this.duplicateWarning.set({ kind: 'email', fingerprint: this.confirmationFingerprint });
        this.cdr.markForCheck();
        return;
      }

      const nameExists = this.scopePatients.some(
        (p) => p.name.toLowerCase() === name.toLowerCase() && p.lastName.toLowerCase() === lastName.toLowerCase()
      );

      if (nameExists && !this.acceptedWarnings.has('name')) {
        this.duplicateWarning.set({ kind: 'name', fingerprint: this.confirmationFingerprint });
        this.cdr.markForCheck();
        return;
      }
    }

    this.duplicateWarning.set(null);
    this.saveError.set('');
    this.saving.set(true);
    this.form.disable();
    if (this.dialogRef) this.dialogRef.disableClose = true;
    const sessionScope = JSON.stringify([this.authService.currentDoctor?.uid, this.authService.currentDoctor?.role, this.doctorScope]);
    try {
      const editingPatient = this.editingPatient();
      if (editingPatient) {
        const updated: Partial<Patient> = {
          name,
          lastName,
          birthDate: dateToString(f.birthDate),
          email,
          secondaryEmail,
          fatherName: f.fatherName!,
          motherName: f.motherName!,
          phone: f.phone!,
        };
        await this.patientRepo.updatePatient(editingPatient.id, updated);
        if (this.destroyed || sessionScope !== JSON.stringify([this.authService.currentDoctor?.uid, this.authService.currentDoctor?.role, this.doctorScope])) return;
        this.alert.success({ message: 'Paciente actualizado', duration: 3000 });
        this.complete({ ...editingPatient, ...updated });
      } else {
        const registration: Partial<Patient> = {
          name,
          lastName,
          birthDate: dateToString(f.birthDate),
          email,
          secondaryEmail,
          fatherName: f.fatherName!,
          motherName: f.motherName!,
          phone: f.phone!,
        };
        const draft = JSON.stringify(registration);
        const actor = this.authService.currentDoctor?.uid ?? '';
        if (!this.creationAttempt || this.creationAttempt.draft !== draft || this.originalUserId !== actor || this.originalScope !== sessionScope) {
          this.creationAttempt = { draft, operationId: crypto.randomUUID() };
          this.originalUserId = actor;
          this.originalScope = sessionScope;
        }
        const result = await this.patientRepo.createPatient(this.creationAttempt.operationId, registration, [...this.acceptedWarnings]);
        if (!this.isOriginalSession()) return;
        if (result.status === 'confirmation-required') {
          this.duplicateWarning.set({ kind: result.warnings[0], fingerprint: this.confirmationFingerprint });
          return;
        }
        this.createdPatient.set(result.patient);
        this.form.disable();
        await this.deliverCreatedAccess();
      }
    } catch (e: any) {
      if (!this.destroyed && sessionScope === JSON.stringify([this.authService.currentDoctor?.uid, this.authService.currentDoctor?.role, this.doctorScope])) {
        this.saveError.set(e.message || 'Error al guardar paciente');
        this.cdr.markForCheck();
      }
    } finally {
      this.saving.set(false);
      if (this.dialogRef) this.dialogRef.disableClose = false;
      if (!this.destroyed) {
        if (!this.createdPatient()) this.form.enable();
        this.cdr.markForCheck();
      }
    }
  }

  private complete(patient: Patient) {
    if (this.embedded) {
      this.saved.emit(patient);
    } else {
      this.dialogRef?.close(patient);
    }
  }

  async continueWithExisting() {
    if (this.saving() || this.form.invalid) return;
    const warning = this.duplicateWarning();
    this.refreshConfirmation();
    if (!warning || warning !== this.duplicateWarning() || warning.fingerprint !== this.confirmationFingerprint) return;
    this.acceptedWarnings.add(warning.kind);
    this.duplicateWarning.set(null);
    await this.save();
  }

  private isOriginalSession(): boolean {
    return !this.destroyed && !!this.originalUserId && this.originalScope ===
      JSON.stringify([this.authService.currentDoctor?.uid, this.authService.currentDoctor?.role, this.doctorScope]);
  }

  private async deliverCreatedAccess(): Promise<void> {
    const patient = this.createdPatient();
    if (!patient || !this.creationAttempt || !this.isOriginalSession()) return;
    this.deliveryMessage.set('Enviando acceso a los correos guardados…');
    try {
      await this.emailService.sendPatientAccessEmail({ patientId: patient.id,
        creationOperationId: this.creationAttempt.operationId, operationId: this.creationAttempt.operationId });
      if (!this.isOriginalSession()) return;
      this.alert.success({ message: 'Paciente creado. Se envió el acceso a los correos guardados.', duration: 5000 });
      this.complete(patient);
    } catch (failure) {
      if (!this.isOriginalSession()) return;
      const statuses = failure instanceof ClinicEmailDeliveryError ? failure.deliveries : [];
      this.deliveryMessage.set(statuses.length ? statuses.map(item =>
        'Correo ' + (item.destination === 'primary' ? 'principal' : 'secundario') + ': ' +
        (item.sent ? 'envío confirmado.' : 'envío no confirmado.')).join(' ') :
        'El paciente ya está creado, pero no se pudo confirmar el envío del acceso. Reintenta el envío.');
    }
  }

  async retryEmail(): Promise<void> {
    if (this.saving() || !this.createdPatient() || !this.isOriginalSession()) return;
    this.saving.set(true);
    if (this.dialogRef) this.dialogRef.disableClose = true;
    try { await this.deliverCreatedAccess(); } finally {
      this.saving.set(false);
      if (this.dialogRef) this.dialogRef.disableClose = false;
    }
  }

  continueAfterCreation(): void {
    const patient = this.createdPatient();
    if (patient && !this.saving() && this.isOriginalSession()) this.complete(patient);
  }
}
