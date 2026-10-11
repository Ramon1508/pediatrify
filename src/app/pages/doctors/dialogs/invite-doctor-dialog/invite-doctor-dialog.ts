import { Component, inject, signal, computed, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { Clipboard } from '@angular/cdk/clipboard';
import { Subscription } from 'rxjs';
import { StaffInvitationService } from '../../../../core/services/staff-invitation.service';
import { AlertService } from '../../../../core/services/alert.service';
import { AuthService } from '../../../../core/services/auth.service';
import { EmailService } from '../../../../core/services/email.service';
import { AppUser, UserRole } from '../../../../core/models/user';
import { normalizeEmail } from '../../../../core/utils/normalize-email';

interface CreatedInvitation {
  readonly token: string;
  readonly operationId: string;
  readonly email: string;
  readonly inviteeName: string;
  readonly doctorName: string;
  readonly link: string;
  readonly userId: string;
  readonly actorUid: string;
  readonly actorRole: UserRole;
}
type DeliveryStatus = 'idle' | 'sending' | 'sent' | 'failed';

@Component({
  selector: 'app-invite-doctor-dialog',
  templateUrl: './invite-doctor-dialog.html',
  styleUrl: './invite-doctor-dialog.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatProgressSpinnerModule, MatTooltipModule, MatDividerModule],
})
export class InviteDoctorDialog implements OnDestroy {
  private fb = inject(FormBuilder);
  private invitations = inject(StaffInvitationService);
  private issueAttempt: { draft: string; operationId: string } | null = null;
  private readonly resendId = signal<string | null>(null);
  private authService = inject(AuthService);
  private alert = inject(AlertService);
  private email = inject(EmailService);
  private clipboard = inject(Clipboard);
  private dialogRef = inject(MatDialogRef<InviteDoctorDialog>);
  private subscription: Subscription;
  private destroyed = false;
  private readonly inviter = signal(this.authService.currentDoctor);
  private readonly invitation = signal<CreatedInvitation | null>(null);
  private readonly targetRoleOverride = signal<'admin' | 'doctor' | 'assistant' | null>(null);

  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);
  protected readonly error = signal('');
  protected readonly deliveryStatus = signal<DeliveryStatus>('idle');
  protected readonly invitationLink = computed(() => this.invitation()?.link ?? '');
  protected readonly targetRole = computed<UserRole>(() =>
    this.targetRoleOverride() ?? (this.inviter()?.role === 'admin' ? 'doctor' : 'assistant'));
  protected readonly title = computed(() => this.resendId() ? 'Reenviar invitación'
    : this.targetRole() === 'admin' ? 'Invitar administrador'
      : this.targetRole() === 'doctor' ? 'Invitar doctor' : 'Invitar asistente');
  protected readonly createLabel = computed(() => this.resendId() ? 'Reenviar invitación' : 'Crear invitación');
  protected readonly fieldsReadOnly = computed(() => this.saving() || !!this.invitation() || !!this.resendId());
  protected readonly canRetry = computed(() => !!this.invitation() && this.deliveryStatus() === 'failed');
  protected readonly showSendButton = computed(() => this.canRetry() || this.deliveryStatus() === 'sending');
  protected readonly deliveryMessage = computed(() => {
    const invitation = this.invitation();
    if (!invitation) return '';
    switch (this.deliveryStatus()) {
      case 'sending': return 'Invitación creada. Enviando el correo…';
      case 'sent': return 'Se envió el enlace al correo ' + invitation.email + '. Si no le llegó, puedes copiarlo desde aquí.';
      case 'failed': return 'La invitación está creada, pero no se pudo confirmar el envío del correo. Reintenta el envío o copia el enlace manualmente.';
      default: return 'Invitación creada. Puedes copiar el enlace.';
    }
  });

  protected readonly form = signal(this.fb.group({
    name: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(200)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
  }));
  private readonly formState = signal({ invalid: true, pristine: true, nameInvalid: true, nameTouched: false,
    emailInvalid: true, emailTouched: false });
  protected readonly nameError = computed(() => this.formState().nameInvalid && (this.formState().nameTouched || this.submitted()));
  protected readonly emailError = computed(() => this.formState().emailInvalid && (this.formState().emailTouched || this.submitted()));
  protected readonly saveDisabled = computed(() => this.formState().invalid || (this.formState().pristine && !this.resendId()) ||
    this.saving() || !!this.invitation() || !['admin', 'doctor'].includes(this.inviter()?.role ?? ''));

  constructor() {
    this.subscription = this.form().events.subscribe(() => {
      const form = this.form();
      this.formState.set({ invalid: form.invalid, pristine: form.pristine,
        nameInvalid: form.controls.name.invalid, nameTouched: form.controls.name.touched,
        emailInvalid: form.controls.email.invalid, emailTouched: form.controls.email.touched });
    });
  }

  setResendTarget(user: AppUser) {
    if (this.saving() || this.invitation() || user.pending !== true) return;
    this.resendId.set(user.uid);
    if (['admin', 'doctor', 'assistant'].includes(user.role)) this.targetRoleOverride.set(user.role as 'admin' | 'doctor' | 'assistant');
    this.form().setValue({ name: user.name, email: user.email });
  }

  /** P45: crear un administrador desde el directorio de Administradores. */
  setTargetRole(role: 'admin' | 'doctor' | 'assistant') {
    if (this.saving() || this.invitation() || this.resendId()) return;
    const actor = this.inviter();
    if (!(actor?.role === 'admin' && ['admin', 'doctor'].includes(role) || actor?.role === 'doctor' && role === 'assistant')) return;
    this.targetRoleOverride.set(role);
  }

  close() {
    if (!this.saving()) this.dialogRef.close();
  }

  async save() {
    if (this.destroyed || this.saving() || this.invitation()) return;
    this.submitted.set(true);
    this.form().markAllAsTouched();
    if (this.saveDisabled() || !this.isOriginalSession()) return;
    const actor = this.inviter()!;
    const name = (this.form().controls.name.value ?? '').trim();
    const email = normalizeEmail(this.form().controls.email.value ?? '');
    const draft = JSON.stringify({ name, email, userId: this.resendId(), role: this.targetRole() });
    if (this.issueAttempt?.draft !== draft) this.issueAttempt = { draft, operationId: crypto.randomUUID() };
    this.saving.set(true);
    this.error.set('');
    this.dialogRef.disableClose = true;
    try {
      const issued = await this.invitations.issue(this.resendId() ?
        { action: 'resend', userId: this.resendId()!, operationId: this.issueAttempt.operationId } :
        { action: 'create', name, email, operationId: this.issueAttempt.operationId,
          ...(this.targetRoleOverride() ? { role: this.targetRoleOverride()! } : {}) });
      const invitation: CreatedInvitation = Object.freeze({ userId: issued.userId, actorUid: actor.uid, actorRole: actor.role,
        inviteeName: issued.name, email: issued.email, doctorName: issued.doctorName, link: issued.link,
        token: issued.token, operationId: this.issueAttempt.operationId });
      if (this.destroyed || !this.isOriginalSession()) return;
      this.invitation.set(invitation);
      this.form().reset({ name: issued.name, email: issued.email });
      await this.sendEmail(invitation);
    } catch (failure: unknown) {
      if (!this.destroyed && this.isOriginalSession()) {
        const code = (failure as { code?: string }).code;
        const message = ['functions/already-exists', 'functions/failed-precondition', 'functions/permission-denied', 'functions/aborted'].includes(code ?? '')
          ? (failure as { message?: string }).message : undefined;
        this.error.set(message || 'No fue posible crear la invitación. Intenta nuevamente.');
      }
    } finally {
      this.saving.set(false);
      this.dialogRef.disableClose = false;
    }
  }

  async retryEmail() {
    const invitation = this.invitation();
    if (this.destroyed || this.saving() || !this.canRetry() || !invitation || !this.isOriginalSession()) return;
    this.saving.set(true);
    this.dialogRef.disableClose = true;
    try {
      await this.sendEmail(invitation);
    } finally {
      this.saving.set(false);
      this.dialogRef.disableClose = false;
    }
  }

  private async sendEmail(invitation: CreatedInvitation) {
    this.deliveryStatus.set('sending');
    try {
      await this.email.sendInvitationEmail({
        userId: invitation.userId, token: invitation.token, operationId: invitation.operationId,
      });
      if (this.destroyed || !this.isOriginalSession()) return;
      this.deliveryStatus.set('sent');
      this.alert.success({ message: 'Invitación enviada por correo a ' + invitation.inviteeName, duration: 4000 });
    } catch {
      if (this.destroyed || !this.isOriginalSession()) return;
      this.deliveryStatus.set('failed');
      this.alert.error({
        message: 'Invitación creada, pero no se pudo confirmar el envío del correo. Reintenta el envío o copia el enlace manualmente.',
        duration: 5000,
      });
    }
  }

  copyLink() {
    if (this.destroyed || !this.isOriginalSession() || !this.invitationLink()) return;
    if (this.clipboard.copy(this.invitationLink())) {
      this.alert.success({ message: 'Enlace copiado al portapapeles', duration: 2000 });
    } else {
      this.alert.error({ message: 'No se pudo copiar el enlace. Selecciónalo y cópialo manualmente.', duration: 5000 });
    }
  }

  private isOriginalSession(): boolean {
    const original = this.inviter();
    const current = this.authService.currentDoctor;
    return !!original && !!current && ['admin', 'doctor'].includes(current.role) &&
      original.uid === current.uid && original.role === current.role;
  }

  ngOnDestroy() {
    this.destroyed = true;
    this.subscription.unsubscribe();
  }
}
