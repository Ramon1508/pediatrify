import { Component, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { KeyValuePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TextFieldModule } from '@angular/cdk/text-field';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../../../core/services/auth.service';
import { AlertService } from '../../../core/services/alert.service';
import { UserRepository } from '../../../core/repositories/user.repository';
import { Sexo, SexoLabel } from '../../../core/models/sexo';
import { AppUser } from '../../../core/models/user';
import { FirebaseService } from '../../../core/firebase/firebase.service';
import { ref, getDownloadURL } from 'firebase/storage';
import { FileUpload, UploadResult } from '../file-upload/file-upload';

@Component({
  selector: 'app-profile-dialog',
  templateUrl: './profile-dialog.html',
  styleUrl: './profile-dialog.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    KeyValuePipe,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    TextFieldModule,
    MatDividerModule,
    FileUpload,
  ],
})
export class ProfileDialog {
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  private dialogRef = inject(MatDialogRef<ProfileDialog>);
  private authService = inject(AuthService);
  private alert = inject(AlertService);
  private userRepo = inject(UserRepository);
  private firebase = inject(FirebaseService);
  private router = inject(Router);

  protected SexoLabel = SexoLabel;
  protected readOnly = true;
  protected saving = false;
  protected showSaved = false;
  protected isSimpleProfile = this.authService.currentDoctor?.role !== 'doctor';
  protected roleDisplay = this.authService.currentDoctor?.role === 'admin' ? 'Administrador' : 'Asistente';

  protected doctor: AppUser | null = null;
  protected logoFileName = '';
  protected logoUrl = '';
  private logoUpload: UploadResult | null | undefined = undefined;

  protected form = this.fb.group({
    name: ['', Validators.required],
    sexo: [null as Sexo | null],
    phone: [''],
    especialidad: [''],
    cedula: [''],
    cedulaEspecialidad: [''],
    email: ['', [Validators.email]],
    consultorios: [''],
  });

  constructor() {
    this.doctor = this.authService.currentDoctor;
    if (this.doctor) {
      this.form.patchValue({
        name: this.doctor.name ?? '',
        sexo: this.doctor.sexo ?? null,
        phone: this.doctor.phone ?? '',
        especialidad: this.doctor.especialidad ?? '',
        cedula: this.doctor.cedula ?? '',
        cedulaEspecialidad: this.doctor.cedulaEspecialidad ?? '',
        email: this.doctor.email ?? '',
        consultorios: this.doctor.consultorios ?? '',
      });
      const logo = this.doctor.logoPath;
      if (logo) {
        this.logoFileName = this.extractFileName(logo);
        this.resolveLogoUrl(logo).then((url) => {
          this.logoUrl = url;
          this.cdr.markForCheck();
        });
      }
    }
    this.form.disable();
  }

  private extractFileName(value: string): string {
    const base = value.split('?')[0];
    const name = base.split('/').pop() ?? value;
    try {
      return decodeURIComponent(name);
    } catch {
      return name;
    }
  }

  private async resolveLogoUrl(pathOrUrl: string): Promise<string> {
    if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;
    try {
      const storageRef = ref(this.firebase.storage, pathOrUrl);
      return await getDownloadURL(storageRef);
    } catch {
      return '';
    }
  }

  switchToEdit() {
    this.readOnly = false;
    this.form.enable();
    if (!this.logoUrl && this.doctor?.logoPath) {
      this.resolveLogoUrl(this.doctor.logoPath).then((url) => {
        this.logoUrl = url;
        this.cdr.markForCheck();
      });
    }
    this.cdr.markForCheck();
  }

  cancelEdit() {
    if (this.doctor) {
      this.form.patchValue({
        name: this.doctor.name ?? '',
        sexo: this.doctor.sexo ?? null,
        phone: this.doctor.phone ?? '',
        especialidad: this.doctor.especialidad ?? '',
        cedula: this.doctor.cedula ?? '',
        cedulaEspecialidad: this.doctor.cedulaEspecialidad ?? '',
        email: this.doctor.email ?? '',
        consultorios: this.doctor.consultorios ?? '',
      });
    }
    const logo = this.doctor?.logoPath;
    this.logoFileName = logo ? this.extractFileName(logo) : '';
    this.logoUrl = '';
    if (logo) {
      this.resolveLogoUrl(logo).then((url) => {
        this.logoUrl = url;
        this.cdr.markForCheck();
      });
    }
    this.logoUpload = undefined;
    this.readOnly = true;
    this.form.disable();
    this.cdr.markForCheck();
  }

  onLogoUploaded(result: UploadResult | null) {
    this.logoUpload = result;
    if (result) {
      this.logoFileName = this.extractFileName(result.url);
      this.logoUrl = result.url;
    } else {
      this.logoFileName = '';
      this.logoUrl = '';
    }
    this.cdr.markForCheck();
  }

  async save() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    if (!this.doctor) return;

    this.saving = true;
    this.cdr.markForCheck();

    try {
      let logoPath = this.doctor.logoPath;
      if (this.logoUpload !== undefined) {
        logoPath = this.logoUpload ? this.logoUpload.url : '';
      }

      const v = this.form.value;
      await this.userRepo.updateUser(this.doctor.uid, {
        name: v.name ?? '',
        sexo: v.sexo ?? undefined,
        phone: v.phone ?? '',
        especialidad: v.especialidad ?? '',
        cedula: v.cedula ?? '',
        cedulaEspecialidad: v.cedulaEspecialidad ?? '',
        consultorios: v.consultorios ?? '',
        logoPath,
      });

      this.doctor = { ...this.doctor, ...this.form.value, logoPath } as AppUser;
      this.logoFileName = logoPath ? this.extractFileName(logoPath) : '';
      this.logoUrl = '';
      if (logoPath) {
        this.resolveLogoUrl(logoPath).then((url) => {
          this.logoUrl = url;
          this.cdr.markForCheck();
        });
      }
      this.logoUpload = undefined;

      this.readOnly = true;
      this.form.disable();
      this.showSaved = true;
      setTimeout(() => {
        this.showSaved = false;
        this.cdr.markForCheck();
      }, 4000);
    } catch {
      this.alert.error({ message: 'Error al guardar los cambios', duration: 5000 });
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }

  dismissSaved() {
    this.showSaved = false;
    this.cdr.markForCheck();
  }

  logout() {
    this.dialogRef.close();
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  close() {
    if (!this.readOnly) {
      const confirmed = confirm('¿Descartar cambios?');
      if (!confirmed) return;
    }
    this.dialogRef.close();
  }
}
