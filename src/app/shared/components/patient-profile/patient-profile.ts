import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { SessionUser } from '../../../core/models/user';
import { PatientRepository } from '../../../core/repositories/patient.repository';
import { AuthService } from '../../../core/services/auth.service';
import { AlertService } from '../../../core/services/alert.service';
import { normalizeEmail } from '../../../core/utils/normalize-email';

interface PatientAccess {
  patientId: string;
  doctorId: string;
  email: string;
}

@Component({
  selector: 'app-patient-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './patient-profile.html',
  styleUrl: './patient-profile.scss',
})
export class PatientProfile implements OnInit, OnDestroy {
  readonly asPage = input(false);
  protected readonly email = signal('');
  protected readonly patients = signal<{ id: string; name: string }[]>([]);
  protected readonly patientSession = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly loggingOut = signal(false);

  private readonly auth = inject(AuthService);
  private readonly repository = inject(PatientRepository);
  private readonly router = inject(Router);
  private readonly alert = inject(AlertService);
  private readonly dialogRef = inject(MatDialogRef<PatientProfile>, { optional: true });
  private sessionSubscription?: Subscription;
  private requestVersion = 0;
  private destroyed = false;

  ngOnInit(): void {
    this.sessionSubscription = this.auth.session$.subscribe(session => {
      const access = this.getAccess(session);
      this.patientSession.set(!!access);
      this.email.set(access?.email ?? '');
      void this.loadPatients(access);
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.requestVersion++;
    this.sessionSubscription?.unsubscribe();
  }

  protected retry(): void {
    if (this.loading() || this.loggingOut()) return;
    void this.loadPatients(this.getAccess(this.auth.session));
  }

  protected close(): void {
    if (this.loggingOut()) return;
    this.dialogRef?.close();
  }

  protected async logout(): Promise<void> {
    if (this.loggingOut() || this.auth.session?.type !== 'patient') return;
    this.loggingOut.set(true);
    if (this.dialogRef) this.dialogRef.disableClose = true;
    try {
      await this.auth.logout();
      // Do not navigate away from a new session established during the request.
      if (this.auth.session !== null) return;
      if (!this.destroyed) this.dialogRef?.close();
      await this.router.navigate(['/patient-login']);
    } catch {
      if (!this.destroyed) {
        this.alert.error({ message: 'No fue posible cerrar sesión. Intenta nuevamente.', duration: 5000 });
      }
    } finally {
      if (!this.destroyed) {
        this.loggingOut.set(false);
        if (this.dialogRef) this.dialogRef.disableClose = false;
      }
    }
  }

  private getAccess(session: SessionUser): PatientAccess | null {
    if (session?.type !== 'patient') return null;
    return {
      patientId: session.patient.id,
      doctorId: session.patient.doctorId?.trim() ?? '',
      email: normalizeEmail(session.loginEmail ?? session.patient.email ?? ''),
    };
  }

  private async loadPatients(access: PatientAccess | null): Promise<void> {
    const version = ++this.requestVersion;
    this.patients.set([]);
    this.error.set('');
    this.loading.set(false);
    if (!access) return;
    if (!access.email || !access.doctorId) {
      this.error.set('No fue posible identificar los pacientes de este acceso. Consulta al consultorio.');
      return;
    }
    this.loading.set(true);
    try {
      const group = await this.repository.getChildrenGroup(access.email, access.doctorId);
      if (!this.isCurrentRequest(version, access)) return;
      const seen = new Set<string>();
      this.patients.set(group
        .filter(patient => {
          if (!patient.id || seen.has(patient.id) || patient.doctorId !== access.doctorId) return false;
          if (normalizeEmail(patient.email ?? '') !== access.email
            && normalizeEmail(patient.secondaryEmail ?? '') !== access.email) return false;
          seen.add(patient.id);
          return true;
        })
        .map(patient => ({
          id: patient.id,
          name: [patient.name, patient.lastName].filter(Boolean).join(' ').trim() || 'Paciente sin nombre',
        })));
    } catch {
      if (this.isCurrentRequest(version, access)) {
        this.error.set('No fue posible cargar los pacientes asociados. Intenta nuevamente.');
      }
    } finally {
      if (this.isCurrentRequest(version, access)) this.loading.set(false);
    }
  }

  private isCurrentRequest(version: number, access: PatientAccess): boolean {
    const current = this.getAccess(this.auth.session);
    return !this.destroyed && version === this.requestVersion && !!current
      && current.patientId === access.patientId && current.doctorId === access.doctorId
      && current.email === access.email;
  }
}
