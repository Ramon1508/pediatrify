import { Component, DestroyRef, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PatientAccessService } from '../../../../core/services/patient-access.service';
import { AlertService } from '../../../../core/services/alert.service';
import { Patient } from '../../../../core/models/user';

@Component({
  selector: 'app-view-otp-dialog',
  templateUrl: './view-otp-dialog.html',
  styleUrl: './view-otp-dialog.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
})
export class ViewOtpDialog {
  private readonly access = inject(PatientAccessService);
  private readonly alert = inject(AlertService);
  private readonly dialogRef = inject(MatDialogRef<ViewOtpDialog>);
  private readonly destroyRef = inject(DestroyRef);
  private patientId = '';
  private requestVersion = 0;
  private closed = false;
  protected readonly patientFullName = signal('');
  protected readonly password = signal('');
  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly copying = signal(false);

  constructor() {
    this.destroyRef.onDestroy(() => { this.closed = true; this.requestVersion++; this.password.set(''); });
  }

  setPatient(patient: Patient): void {
    this.patientId = patient.id;
    this.patientFullName.set([patient.name, patient.lastName].join(' ').trim());
    void this.load();
  }

  protected async load(): Promise<void> {
    if (!this.patientId || this.closed) return;
    const version = ++this.requestVersion;
    this.password.set('');
    this.loadFailed.set(false);
    this.loading.set(true);
    try {
      const result = await this.access.read(this.patientId);
      if (!this.closed && version === this.requestVersion) this.password.set(result.password);
    } catch {
      if (!this.closed && version === this.requestVersion) this.loadFailed.set(true);
    } finally {
      if (!this.closed && version === this.requestVersion) this.loading.set(false);
    }
  }

  protected async copyOtp(): Promise<void> {
    if (!this.password() || this.copying() || this.closed) return;
    this.copying.set(true);
    try {
      await navigator.clipboard.writeText(this.password());
      if (!this.closed) this.alert.success({ message: 'Copiado al portapapeles', duration: 2000 });
    } catch {
      if (!this.closed) this.alert.error({ message: 'No fue posible copiar la contrase\u00f1a. Intenta nuevamente.', duration: 5000 });
    } finally {
      this.copying.set(false);
    }
  }

  close(): void {
    this.closed = true;
    this.requestVersion++;
    this.password.set('');
    this.dialogRef.close(false);
  }
}
