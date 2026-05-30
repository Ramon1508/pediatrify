import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { Header } from '../../shared/components/header/header';
import { FileUpload, UploadResult } from '../../shared/components/file-upload/file-upload';
import { AuthService } from '../../core/services/auth.service';
import { InvitationRepository } from '../../core/repositories/invitation.repository';
import { AlertService } from '../../core/services/alert.service';
import { UserRole } from '../../core/models/user';

@Component({
  selector: 'app-setup-profile',
  templateUrl: './setup-profile.html',
  styleUrl: './setup-profile.scss',
  standalone: true,
  imports: [
    FormsModule,
    Header,
    FileUpload,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatDividerModule,
  ],
})
export class SetupProfile implements OnInit {
  private authService = inject(AuthService);
  private invitationRepo = inject(InvitationRepository);
  private alert = inject(AlertService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  protected mode = signal<'invitation' | 'existing' | 'invalid'>('invalid');
  protected pendingUid = '';
  protected pendingRole: UserRole = 'employee';
  protected displayName = '';
  protected displayEmail = '';

  protected form = {
    sexo: '',
    especialidad: '',
    cedula: '',
    cedulaEspecialidad: '',
    consultorios: '',
    phone: '',
  };

  protected password = '';
  protected confirmPassword = '';
  protected finishing = false;
  protected error = '';
  protected logoPath: string | null = null;
  protected submitted = false;

  async ngOnInit() {
    try {
      const email = this.route.snapshot.queryParams['email'];

      if (email) {
        const pending = await this.invitationRepo.findPendingUserByEmail(email);
        if (pending) {
          this.mode.set('invitation');
          this.pendingUid = pending.uid;
          this.pendingRole = pending.role;
          this.displayName = pending.name;
          this.displayEmail = pending.email;
          return;
        }
      }

      const doctor = this.authService.currentDoctor;
      if (this.authService.isDoctor && doctor && !doctor.profileComplete) {
        this.mode.set('existing');
        this.displayName = doctor.name;
        this.displayEmail = doctor.email;
        return;
      }

      this.mode.set('invalid');
      this.router.navigate(['/login']);
    } catch (e) {
      console.error('SetupProfile init error:', e);
      this.mode.set('invalid');
      this.router.navigate(['/login']);
    }
  }

  onLogoUploaded(result: UploadResult | null) {
    this.logoPath = result?.path || null;
  }

  async finish() {
    this.submitted = true;

    if (!this.areRequiredFieldsValid()) return;

    this.finishing = true;
    this.error = '';

    try {
      if (this.mode() === 'invitation') {
        await this.authService.registerFromInvitation(
          this.displayEmail,
          this.password,
          {
            name: this.displayName,
            sexo: this.form.sexo,
            phone: this.form.phone,
            especialidad: this.form.especialidad,
            cedula: this.form.cedula,
            cedulaEspecialidad: this.form.cedulaEspecialidad,
            consultorios: this.form.consultorios,
            logoPath: this.logoPath || undefined,
            role: this.pendingRole,
          },
          this.pendingUid
        );
      } else if (this.mode() === 'existing') {
        await this.authService.completeProfile(
          {
            name: this.displayName,
            sexo: this.form.sexo,
            phone: this.form.phone,
            especialidad: this.form.especialidad,
            cedula: this.form.cedula,
            cedulaEspecialidad: this.form.cedulaEspecialidad,
            consultorios: this.form.consultorios,
            logoPath: this.logoPath || undefined,
          },
          this.password
        );
      }

      this.alert.success({
        message: 'Tu cuenta ha sido creada',
        duration: 5000,
      });
      this.router.navigate(['/login'], { queryParams: { registered: 'true' } });
    } catch (e: any) {
      this.error = this.getReadableError(e);
    } finally {
      this.finishing = false;
    }
  }

  private areRequiredFieldsValid(): boolean {
    return (
      !!this.form.sexo &&
      !!this.form.cedula &&
      !!this.form.consultorios &&
      /^\d{10}$/.test(this.form.phone) &&
      !!this.password &&
      this.password.length >= 6 &&
      this.password === this.confirmPassword
    );
  }

  private getReadableError(e: any): string {
    const map: Record<string, string> = {
      'auth/email-already-in-use': 'Este correo ya está registrado',
      'auth/weak-password': 'La contraseña es muy débil. Usa al menos 6 caracteres.',
      'auth/invalid-email': 'Correo electrónico inválido',
    };
    return map[e.code] || e.message || 'Error inesperado';
  }
}
