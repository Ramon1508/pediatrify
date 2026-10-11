import { Component, inject, signal, computed, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription } from 'rxjs';
import { UserRepository } from '../../../../core/repositories/user.repository';
import { AuthService } from '../../../../core/services/auth.service';
import { StaffEmailChangeService } from '../../../../core/services/staff-email-change.service';
import { AppUser } from '../../../../core/models/user';
import { AlertService } from '../../../../core/services/alert.service';
import { normalizeEmail } from '../../../../core/utils/normalize-email';

@Component({
  selector: 'app-edit-doctor-dialog',
  templateUrl: './edit-doctor-dialog.html',
  styleUrl: './edit-doctor-dialog.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatProgressSpinnerModule],
})
export class EditDoctorDialog implements OnDestroy {
  private fb = inject(FormBuilder);
  private userRepo = inject(UserRepository);
  private auth = inject(AuthService);
  private emailChange = inject(StaffEmailChangeService);
  private alert = inject(AlertService);
  private dialogRef = inject(MatDialogRef<EditDoctorDialog>);
  private subscription: Subscription;
  private destroyed = false;
  private attempt: { key: string; id: string } | null = null;

  protected doctor = signal<AppUser | null>(null);
  protected saving = signal(false);
  protected error = signal('');
  protected submitted = signal(false);
  protected title = computed(() => {
    const role = this.doctor()?.role;
    return role === 'doctor' ? 'Editar doctor' : role === 'admin' ? 'Editar administrador' : 'Editar asistente';
  });
  protected subjectTitleCase = computed(() => {
    const role = this.doctor()?.role;
    return role === 'doctor' ? 'Doctor' : role === 'admin' ? 'Administrador' : 'Asistente';
  });
  protected pendingInvitation = computed(() => this.doctor()?.pending === true && !this.doctor()?.firebaseUid);
  protected form = signal(this.fb.group({
    name: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(200)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
  }));
  private formState = signal({ invalid: true, pristine: true, nameError: false, emailError: false, name: '', email: '' });
  protected nameError = computed(() => this.formState().nameError);
  protected emailError = computed(() => this.formState().emailError);
  protected emailChanged = computed(() => normalizeEmail(this.formState().email) !== normalizeEmail(this.doctor()?.email ?? ''));
  protected saveDisabled = computed(() => this.formState().invalid || this.formState().pristine || this.saving() ||
    (!this.emailChanged() && this.formState().name.trim() === this.doctor()?.name));

  constructor() {
    this.subscription = this.form().events.subscribe(() => {
      const form = this.form();
      this.formState.set({ invalid: form.invalid, pristine: form.pristine,
        nameError: form.controls.name.invalid && (form.controls.name.touched || this.submitted()),
        emailError: form.controls.email.invalid && (form.controls.email.touched || this.submitted()),
        name: form.controls.name.value ?? '', email: form.controls.email.value ?? '' });
    });
  }

  setDoctor(doctor: AppUser) {
    if (this.saving()) return;
    this.doctor.set(doctor);
    this.form().reset({ name: doctor.name, email: normalizeEmail(doctor.email) });
    this.attempt = null;
  }

  close() {
    if (!this.saving()) this.dialogRef.close();
  }

  async save() {
    if (this.destroyed || this.saving()) return;
    this.submitted.set(true);
    this.form().markAllAsTouched();
    if (this.saveDisabled()) return;
    const target = this.doctor();
    const actor = this.auth.currentDoctor;
    if (!target || !actor || actor.uid === target.uid ||
        !((actor.role === 'admin' && (target.role === 'doctor' || target.role === 'admin')) ||
          (actor.role === 'doctor' && target.role === 'assistant' && target.createdBy === actor.uid))) return;
    const name = (this.form().controls.name.value ?? '').trim();
    const email = normalizeEmail(this.form().controls.email.value ?? '');
    const key = JSON.stringify([target.uid, name, email, target.email]);
    if (this.attempt?.key !== key) this.attempt = { key, id: crypto.randomUUID() };
    this.saving.set(true);
    this.error.set('');
    this.dialogRef.disableClose = true;
    try {
      if (this.emailChanged() || target.role === 'admin') {
        const result = await this.emailChange.changeEmail({ userId: target.uid, name, email,
          expectedEmail: target.email, operationId: this.attempt.id });
        if (this.destroyed || this.auth.currentDoctor?.uid !== actor.uid) return;
        this.alert.success({ message: !this.emailChanged()
          ? result.pendingInvitation ? 'Administrador actualizado. Reenvía la invitación actualizada.' : 'Administrador actualizado.'
          : result.pendingInvitation
          ? this.subjectTitleCase() + ' actualizado. Reenvía la invitación al nuevo correo.'
          : this.subjectTitleCase() + ' actualizado. Su próximo acceso será con el nuevo correo y su contraseña actual.', duration: 5000 });
      } else {
        await this.userRepo.updateUser(target.uid, { name });
        if (this.destroyed || this.auth.currentDoctor?.uid !== actor.uid) return;
        this.alert.success({ message: this.subjectTitleCase() + ' actualizado.', duration: 3000 });
      }
      this.dialogRef.close(true);
    } catch (error) {
      if (this.destroyed || this.auth.currentDoctor?.uid !== actor.uid) return;
      const code = (error as { code?: string }).code;
      this.error.set(code === 'functions/already-exists' ? 'Ingresa un correo que no esté asociado a otra cuenta.'
        : code === 'functions/failed-precondition' || code === 'functions/aborted'
          ? (error as Error).message
          : 'No fue posible guardar los cambios. Reintenta con los mismos datos.');
    } finally {
      this.saving.set(false);
      this.dialogRef.disableClose = false;
    }
  }

  ngOnDestroy() {
    this.destroyed = true;
    this.subscription.unsubscribe();
  }
}
