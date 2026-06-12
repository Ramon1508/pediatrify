import { Component, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { Clipboard } from '@angular/cdk/clipboard';
import { setDoc, doc, Timestamp } from 'firebase/firestore';
import { FirebaseService } from '../../../../core/firebase/firebase.service';
import { AlertService } from '../../../../core/services/alert.service';
import { UserRole } from '../../../../core/models/user';

@Component({
  selector: 'app-invite-doctor-dialog',
  templateUrl: './invite-doctor-dialog.html',
  styleUrl: './invite-doctor-dialog.scss',
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
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDividerModule,
  ],
})
export class InviteDoctorDialog {
  private fb = inject(FormBuilder);
  private firebase = inject(FirebaseService);
  private alert = inject(AlertService);
  private clipboard = inject(Clipboard);
  private cdr = inject(ChangeDetectorRef);
  private dialogRef = inject(MatDialogRef<InviteDoctorDialog>);

  protected roles: { value: UserRole; label: string }[] = [
    { value: 'admin', label: 'Administrador' },
    { value: 'employee', label: 'Asistente' },
  ];

  protected saving = false;
  protected submitted = false;
  protected error = '';
  protected invitationLink = '';

  protected form = this.fb.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    role: ['employee', Validators.required],
  });

  close() {
    this.dialogRef.close();
  }

  async save() {
    this.submitted = true;
    if (this.form.invalid) return;

    this.saving = true;
    this.error = '';

    try {
      const { name, email, role } = this.form.value;

      const uid = crypto.randomUUID();
      await setDoc(doc(this.firebase.firestore, 'users', uid), {
        uid,
        email,
        name,
        role: role ?? 'employee',
        pending: true,
        createdAt: Timestamp.now(),
      });

      const origin = window.location.origin;
      this.invitationLink = `${origin}/setup-profile?email=${encodeURIComponent(email!)}`;
      this.alert.success({ message: `Invitación creada para ${name}`, duration: 3000 });
      this.cdr.markForCheck();
    } catch (e: any) {
      this.error = e.message || 'Error al crear invitación';
      this.cdr.markForCheck();
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }

  copyLink() {
    this.clipboard.copy(this.invitationLink);
    this.alert.success({ message: 'Enlace copiado al portapapeles', duration: 2000 });
  }
}
