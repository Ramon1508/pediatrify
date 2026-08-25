import { Component, inject, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
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
import { EmailService } from '../../../../core/services/email.service';
import { Patient } from '../../../../core/models/user';
import { normalizeEmail } from '../../../../core/utils/normalize-email';

interface ParentInfo {
  email: string;
  secondaryEmail: string;
  phone: string;
  spouseName: string;
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

  protected editingPatient: Patient | null = null;

  @Input() embedded = false;
  @Input() set allPatients(patients: Patient[]) {
    this.setPatients(patients);
  }
  get allPatients(): Patient[] {
    return this._allPatients;
  }
  @Output() back = new EventEmitter<void>();
  @Output() saved = new EventEmitter<Patient>();

  private _allPatients: Patient[] = [];
  protected saving = false;
  protected submitted = false;
  protected alertMsg = '';

  private parentCache = new Map<string, ParentInfo>();
  protected uniqueFatherNames: string[] = [];
  protected uniqueMotherNames: string[] = [];
  protected filteredFatherNames: string[] = [];
  protected filteredMotherNames: string[] = [];

  protected form = this.fb.group({
    fullName: ['', Validators.required],
    birthDate: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    secondaryEmail: ['', Validators.email],
    fatherName: ['', Validators.required],
    motherName: ['', Validators.required],
    phone: ['', [Validators.required, Validators.minLength(10)]],
  });

  setPatients(patients: Patient[]) {
    this._allPatients = patients;
    this.buildParentCache();
  }

  private get doctorScope(): string {
    const currentUser = this.authService.currentDoctor;
    if (!currentUser) return '';
    return currentUser.role === 'assistant'
      ? ((currentUser as any).createdBy || currentUser.uid)
      : currentUser.uid;
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
    this.filteredFatherNames = [...this.uniqueFatherNames];
    this.filteredMotherNames = [...this.uniqueMotherNames];
  }

  protected filterFathers() {
    const val = this.form.get('fatherName')?.value?.toLowerCase().trim() || '';
    this.filteredFatherNames = this.uniqueFatherNames.filter(n => n.toLowerCase().includes(val));
  }

  protected filterMothers() {
    const val = this.form.get('motherName')?.value?.toLowerCase().trim() || '';
    this.filteredMotherNames = this.uniqueMotherNames.filter(n => n.toLowerCase().includes(val));
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
    this.editingPatient = patient;
    this.allPatients = this.allPatients.filter((p) => p.id !== patient.id);
    this.form.patchValue({
      fullName: `${patient.name} ${patient.lastName}`.trim(),
      birthDate: patient.birthDate,
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
    if (this.embedded) {
      this.back.emit();
    } else {
      this.dialogRef?.close();
    }
  }

  /** El botón X cierra el diálogo; en modo embedded sale del sub-paso. */
  closeDialog() {
    if (this.embedded) {
      this.back.emit();
    } else {
      this.dialogRef?.close();
    }
  }

  async save() {
    this.submitted = true;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const f = this.form.value;
    const email = normalizeEmail(f.email!);
    const secondaryEmail = f.secondaryEmail ? normalizeEmail(f.secondaryEmail) : '';
    const { name, lastName } = this.splitFullName(f.fullName!);

    if (!this.editingPatient) {
      const existingByEmail = this.scopePatients.filter(
        (p) => p.email === email || (secondaryEmail && p.email === secondaryEmail) || p.secondaryEmail === email || (secondaryEmail && p.secondaryEmail === secondaryEmail)
      );

      if (existingByEmail.length > 0 && !this.alertMsg) {
        this.alertMsg = 'El o los correos electrónicos ingresados ya tienen una cuenta, por lo que este nuevo paciente se asociará a las cuentas existentes.';
        this.cdr.markForCheck();
        return;
      }

      const nameExists = this.scopePatients.some(
        (p) => p.name.toLowerCase() === name.toLowerCase() && p.lastName.toLowerCase() === lastName.toLowerCase()
      );

      if (nameExists && !this.alertMsg) {
        this.alertMsg = 'Ya existe un paciente con ese nombre. Verifica los datos ingresados.';
        this.cdr.markForCheck();
        return;
      }
    }

    this.saving = true;
    try {
      if (this.editingPatient) {
        const updated: Partial<Patient> = {
          doctorId: this.editingPatient.doctorId,
          name,
          lastName,
          birthDate: f.birthDate!,
          email,
          secondaryEmail,
          fatherName: f.fatherName!,
          motherName: f.motherName!,
          phone: f.phone!,
        };
        await this.patientRepo.updatePatient(this.editingPatient.id, updated);
        this.alert.success({ message: 'Paciente actualizado', duration: 3000 });
        this.complete({ ...this.editingPatient, ...updated });
      } else {
        const id = crypto.randomUUID();
        const otpPassword = this.generateOtpPassword();
        const currentUser = this.authService.currentDoctor;
        const doctorId = currentUser?.role === 'assistant'
          ? ((currentUser as any).createdBy || currentUser.uid)
          : (currentUser?.uid ?? '');
        const newPatient: Patient = {
          id,
          doctorId,
          name,
          lastName,
          birthDate: f.birthDate!,
          email,
          secondaryEmail,
          fatherName: f.fatherName!,
          motherName: f.motherName!,
          phone: f.phone!,
          otpPassword,
        };

        await this.patientRepo.createPatient(id, newPatient);
        try {
          await this.emailService.sendPatientAccessEmail({
            email,
            otpPassword,
            patientName: `${name} ${lastName}`.trim(),
            doctorName: currentUser?.name ?? '',
          });
          this.alert.success({ message: `Paciente creado. Contraseña OTP: ${otpPassword}`, duration: 5000 });
        } catch {
          this.alert.error({ message: 'Paciente creado, pero no se pudo enviar el correo de acceso', duration: 5000 });
        }
        this.complete(newPatient);
      }
    } catch (e: any) {
      this.alertMsg = e.message || 'Error al guardar paciente';
      this.cdr.markForCheck();
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }

  private complete(patient: Patient) {
    if (this.embedded) {
      this.saved.emit(patient);
    } else {
      this.dialogRef?.close(patient);
    }
  }

  continueWithExisting() {
    this.alertMsg = '';
    this.save();
  }

  private generateOtpPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let pwd = '';
    for (let i = 0; i < 6; i++) {
      pwd += chars[Math.floor(Math.random() * chars.length)];
    }
    return pwd;
  }
}
