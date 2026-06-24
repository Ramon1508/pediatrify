import { Component, inject, signal, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { PatientRepository } from '../../core/repositories/patient.repository';
import { ClinicalRecordRepository } from '../../core/repositories/clinical-record.repository';
import { AppointmentRepository } from '../../core/repositories/appointment.repository';
import { AuditRepository } from '../../core/repositories/audit.repository';
import { Patient } from '../../core/models/user';
import { ClinicalRecord } from '../../core/models/clinical-record';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { AppointmentFormDialog } from '../appointments/dialogs/appointment-form-dialog/appointment-form-dialog';
import { EditPatientDialog } from '../patients/dialogs/edit-patient-dialog/edit-patient-dialog';
import { CompleteProfileDialog } from '../patients/dialogs/complete-profile-dialog/complete-profile-dialog';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog';
import { ClinicalEntryDialog } from './dialogs/clinical-entry-dialog/clinical-entry-dialog';
import { PatientHistoryCard } from './components/patient-history-card/patient-history-card';

function calcAge(birthDate: unknown): string {
  let d: Date | null = null;
  if (typeof birthDate === 'string') {
    const parts = birthDate.split('-');
    if (parts.length === 3) d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
  } else if (birthDate && typeof (birthDate as any).toDate === 'function') {
    d = (birthDate as any).toDate();
  }
  if (!d || isNaN(d.getTime())) return '';
  const now = new Date();
  let months = (now.getFullYear() - d.getFullYear()) * 12;
  months += now.getMonth() - d.getMonth();
  if (now.getDate() < d.getDate()) months--;
  if (months < 0) return '0 meses';
  if (months < 24) return `${months} meses`;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return remainingMonths > 0
    ? `${years} años ${remainingMonths} meses`
    : `${years} años`;
}

@Component({
  selector: 'app-patient-history',
  templateUrl: './patient-history.html',
  styleUrl: './patient-history.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTabsModule,
    PatientHistoryCard,
  ],
})
export class PatientHistory implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private dialog = inject(MatDialog);
  private patientRepo = inject(PatientRepository);
  private appointmentRepo = inject(AppointmentRepository);
  private clinicalRepo = inject(ClinicalRecordRepository);
  private auditRepo = inject(AuditRepository);
  private authService = inject(AuthService);
  private alert = inject(AlertService);
  private sanitizer = inject(DomSanitizer);

  protected patient = signal<(Patient & { ageDisplay: string }) | null>(null);
  protected records = signal<ClinicalRecord[]>([]);
  protected loading = signal(true);
  protected isAdmin = signal(false);

  private subs: any[] = [];

  async ngOnInit() {
    this.isAdmin.set(this.authService.currentDoctor?.role === 'admin');
    const patientId = this.route.snapshot.paramMap.get('patientId');
    if (!patientId) return;

    const p = await this.patientRepo.getPatient(patientId);
    if (p) {
      this.patient.set({ ...p, ageDisplay: calcAge(p.birthDate) });
    }
    this.loading.set(false);

    this.subs.push(
      this.clinicalRepo.watchByPatient(patientId).subscribe((items) => {
        this.records.set(items);
      })
    );
  }

  ngOnDestroy() {
    for (const s of this.subs) s.unsubscribe();
  }

  protected sanitize(html: string | undefined): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html ?? '');
  }

  protected async openNewAppointment() {
    const allPatients = await this.patientRepo.getAllPatients();
    const dialogRef = this.dialog.open(AppointmentFormDialog, {
      width: '400px',
      disableClose: true,
    });
    dialogRef.componentInstance.setPatients(allPatients);
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.alert.success({ message: 'Cita agendada', duration: 3000 });
      }
    });
  }

  protected openAddEntry() {
    const patientId = this.route.snapshot.paramMap.get('patientId');
    if (!patientId) return;
    const p = this.patient();
    const age = p?.ageDisplay ?? '';

    const dialogRef = this.dialog.open(ClinicalEntryDialog, {
      width: '736px',
      disableClose: true,
      panelClass: 'right-panel',
    });
    dialogRef.componentInstance.setPatientId(patientId);
    dialogRef.componentInstance.setAge(age);
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.alert.success({ message: 'Entrada agregada', duration: 3000 });
      }
    });
  }

  protected openEditEntry(record: ClinicalRecord) {
    const p = this.patient();
    const age = p?.ageDisplay ?? '';

    const dialogRef = this.dialog.open(ClinicalEntryDialog, {
      width: '736px',
      disableClose: true,
      panelClass: 'right-panel',
    });
    dialogRef.componentInstance.setRecord(record);
    dialogRef.componentInstance.setAge(age);
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.alert.success({ message: 'Entrada actualizada', duration: 3000 });
      }
    });
  }

  protected viewProfile(patient: Patient) {
    const dialogRef = this.dialog.open(EditPatientDialog, {
      width: '736px',
      disableClose: true,
      panelClass: 'right-panel',
    });
    dialogRef.componentInstance.setPatient(patient);
    dialogRef.componentInstance.setMode('view');
  }

  protected editProfile(patient: Patient) {
    const dialogRef = this.dialog.open(EditPatientDialog, {
      width: '736px',
      disableClose: true,
      panelClass: 'right-panel',
    });
    dialogRef.componentInstance.setPatient(patient);
    dialogRef.componentInstance.setMode('edit');
  }

  protected async openCompleteProfile(patient: Patient) {
    const dialogRef = this.dialog.open(CompleteProfileDialog, {
      width: '736px',
      disableClose: true,
      panelClass: 'right-panel',
    });
    dialogRef.componentInstance.setPatient(patient);
    await dialogRef.afterClosed().toPromise();
  }

  protected async deletePatient(patient: Patient) {
    const dialogRef = this.dialog.open(ConfirmDialog, {
      data: {
        title: 'Eliminar paciente',
        message: `¿Eliminar a ${patient.name} ${patient.lastName}?`,
        confirmLabel: 'Eliminar',
        cancelLabel: 'Cancelar',
        confirmButtonClass: 'btn-danger dialog-btn',
      } as ConfirmDialogData,
    });

    const confirmed = await dialogRef.afterClosed().toPromise();
    if (!confirmed) return;

    await this.patientRepo.deletePatient(patient.id);
    this.alert.success({ message: 'Paciente eliminado', duration: 3000 });
  }
}
