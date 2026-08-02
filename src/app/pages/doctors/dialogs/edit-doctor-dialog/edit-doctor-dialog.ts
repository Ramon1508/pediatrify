import { Component, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { UserRepository } from '../../../../core/repositories/user.repository';
import { FirebaseService } from '../../../../core/firebase/firebase.service';
import { AppUser } from '../../../../core/models/user';
import { AlertService } from '../../../../core/services/alert.service';

@Component({
  selector: 'app-edit-doctor-dialog',
  templateUrl: './edit-doctor-dialog.html',
  styleUrl: './edit-doctor-dialog.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
})
export class EditDoctorDialog {
  private fb = inject(FormBuilder);
  private userRepo = inject(UserRepository);
  private firebase = inject(FirebaseService);
  private alert = inject(AlertService);
  private cdr = inject(ChangeDetectorRef);
  private dialogRef = inject(MatDialogRef<EditDoctorDialog>);

  protected doctor: AppUser | null = null;
  protected originalEmail = '';
  protected saving = false;
  protected error = '';
  protected submitted = false;
  protected showPasswordSection = false;

  protected get subjectLabel(): string {
    return this.doctor?.role === 'doctor' ? 'doctor' : 'asistente';
  }

  protected get title(): string {
    return this.doctor?.role === 'doctor' ? 'Editar doctor' : 'Editar asistente';
  }

  protected get subjectTitleCase(): string {
    return this.doctor?.role === 'doctor' ? 'Doctor' : 'Asistente';
  }

  protected form = this.fb.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
  });

  protected passwordForm = this.fb.group({
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]],
  });

  setDoctor(doctor: AppUser) {
    this.doctor = doctor;
    this.originalEmail = doctor.email;
    this.form.patchValue({ name: doctor.name, email: doctor.email });
  }

  onEmailChange() {
    const currentEmail = this.form.get('email')?.value;
    this.showPasswordSection = currentEmail !== this.originalEmail;
    if (!this.showPasswordSection) {
      this.passwordForm.reset({ newPassword: '', confirmPassword: '' });
    }
  }

  close() {
    this.dialogRef.close();
  }

  async save() {
    this.submitted = true;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.saving = true;
    this.error = '';

    try {
      if (!this.doctor) return;
      const { name, email } = this.form.value;
      const emailChanged = email !== this.originalEmail;

      if (emailChanged) {
        if (this.passwordForm.invalid) {
          this.error = 'Ingresa una contraseña de al menos 8 caracteres y confírmala.';
          this.saving = false;
          return;
        }
        const newPassword = this.passwordForm.get('newPassword')?.value;
        const confirmPassword = this.passwordForm.get('confirmPassword')?.value;
        if (newPassword !== confirmPassword) {
          this.error = 'Las contraseñas no coinciden.';
          this.saving = false;
          return;
        }

        const credential = await createUserWithEmailAndPassword(this.firebase.auth, email!, newPassword!);
        await this.userRepo.updateUser(this.doctor.uid, {
          name: name!,
          email: email!,
          firebaseUid: credential.user.uid,
        });
        await signOut(this.firebase.auth);
        this.alert.success({ message: `${this.subjectTitleCase} actualizado. Inicia sesión nuevamente.`, duration: 5000 });
        this.dialogRef.close(true);
        return;
      }

      await this.userRepo.updateUser(this.doctor.uid, { name: name! });
      this.alert.success({ message: `${this.subjectTitleCase} actualizado`, duration: 3000 });
      this.dialogRef.close(true);
    } catch (e: any) {
      this.error = e.message || 'Error al guardar';
      this.cdr.markForCheck();
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }
}
