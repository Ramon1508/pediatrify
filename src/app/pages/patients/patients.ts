import { Component, inject, signal, computed, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { PatientRepository } from '../../core/repositories/patient.repository';
import { AppointmentRepository } from '../../core/repositories/appointment.repository';
import { AuditRepository } from '../../core/repositories/audit.repository';

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
import { Patient, Appointment } from '../../core/models/user';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { Clipboard } from '@angular/cdk/clipboard';
import { NewPatientDialog } from '../calendar/dialogs/new-patient-dialog/new-patient-dialog';
import { EditPatientDialog } from './dialogs/edit-patient-dialog/edit-patient-dialog';
import { CompleteProfileDialog } from './dialogs/complete-profile-dialog/complete-profile-dialog';
import { ViewOtpDialog } from './dialogs/view-otp-dialog/view-otp-dialog';
import { PatientCard } from '../../shared/components/patient-card/patient-card';
import { AppointmentCard } from '../../shared/components/appointment-card/appointment-card';
import { Carousel } from '../../shared/components/carousel/carousel';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-patients',
  templateUrl: './patients.html',
  styleUrl: './patients.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatMenuModule,
    PatientCard,
    AppointmentCard,
    Carousel,
  ],
})
export class Patients implements OnInit, OnDestroy {
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private patientRepo = inject(PatientRepository);
  private appointmentRepo = inject(AppointmentRepository);
  private auditRepo = inject(AuditRepository);
  private authService = inject(AuthService);
  private alert = inject(AlertService);
  private clipboard = inject(Clipboard);

  protected patients = signal<Patient[]>([]);
  protected patientsWithAge = signal<(Patient & { ageDisplay: string })[]>([]);
  protected loading = signal(true);
  protected isAdmin = signal(false);
  protected searchControl = new FormControl('');
  protected searchTerm = signal('');

  protected todayAppointments = signal<Appointment[]>([]);
  protected todayDateLabel = signal('');

  protected filteredPatients = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const all = this.patientsWithAge();
    if (!term) return all;
    return all.filter(
      (p) =>
        (p.name + ' ' + p.lastName).toLowerCase().includes(term) ||
        (p.fatherName || '').toLowerCase().includes(term) ||
        (p.motherName || '').toLowerCase().includes(term)
    );
  });

  private subs: any[] = [];

  async ngOnInit() {
    this.isAdmin.set(this.authService.currentDoctor?.role === 'admin');
    const currentDoctorUid = this.authService.currentDoctor?.uid;

    this.subs.push(
      this.searchControl.valueChanges.subscribe((val) => {
        this.searchTerm.set(val || '');
      })
    );

    this.patientRepo.watchAllPatients().subscribe((patients) => {
      this.patients.set(patients);
      this.patientsWithAge.set(patients.map((p) => ({ ...p, ageDisplay: calcAge(p.birthDate) })));
      this.loading.set(false);
    });

    if (currentDoctorUid) {
      this.subs.push(
        this.appointmentRepo.watchAppointmentsByDoctor(currentDoctorUid).subscribe((appts) => {
          const today = new Date();
          const todayStr = this.formatDateStr(today);
          const filtered = appts.filter((a) => a.date === todayStr && a.status === 'scheduled');
          this.todayAppointments.set(filtered);
          this.todayDateLabel.set(today.toLocaleDateString('es-MX', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          }));
        })
      );
    }
  }

  ngOnDestroy() {
    for (const s of this.subs) s.unsubscribe();
  }

  private formatDateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  async openNewPatient() {
    const dialogRef = this.dialog.open(NewPatientDialog, {
      width: '400px',
      disableClose: true,
      panelClass: 'right-panel',
    });
    dialogRef.componentInstance.setPatients(this.patients());

    const result = await dialogRef.afterClosed().toPromise();
    if (result) {
      const currentUser = this.authService.currentDoctor;
      await this.auditRepo.log({
        id: crypto.randomUUID(),
        action: 'create',
        entityType: 'patient',
        entityId: result.id,
        performedBy: currentUser?.email ?? '',
        performedByUid: currentUser?.uid ?? '',
        timestamp: new Date() as any,
        newValues: { name: result.name, lastName: result.lastName, email: result.email, phone: result.phone, fatherName: result.fatherName, motherName: result.motherName },
      });
      this.alert.success({ message: 'Paciente agregado', duration: 3000 });
    }
  }

  async openCompleteProfile(patient: Patient) {
    const dialogRef = this.dialog.open(CompleteProfileDialog, {
      width: '736px',
      disableClose: true,
      panelClass: 'right-panel',
    });
    dialogRef.componentInstance.setPatient(patient);

    await dialogRef.afterClosed().toPromise();
  }

  async openEditPatient(patient: Patient) {
    const dialogRef = this.dialog.open(EditPatientDialog, {
      width: '736px',
      disableClose: true,
      panelClass: 'right-panel',
    });
    dialogRef.componentInstance.setPatient(patient);

    const result = await dialogRef.afterClosed().toPromise();
    if (result) {
      const currentUser = this.authService.currentDoctor;
      await this.auditRepo.log({
        id: crypto.randomUUID(),
        action: 'update',
        entityType: 'patient',
        entityId: patient.id,
        performedBy: currentUser?.email ?? '',
        performedByUid: currentUser?.uid ?? '',
        timestamp: new Date() as any,
        oldValues: { name: patient.name, lastName: patient.lastName, email: patient.email, phone: patient.phone, fatherName: patient.fatherName, motherName: patient.motherName },
        newValues: { name: result.name, lastName: result.lastName, email: result.email, phone: result.phone, fatherName: result.fatherName, motherName: result.motherName },
      });
    }
  }

  async cancelAppointment(appt: Appointment) {
    const dialogRef = this.dialog.open(ConfirmDialog, {
      data: {
        title: 'Cancelar consulta',
        message: 'Al cancelar una consulta el padre o tutor del paciente recibirá una notificación de la cancelación y podrá seleccionar un nuevo día y horario para la consulta si así lo desea.',
        confirmLabel: 'Cancelar consulta',
        cancelLabel: 'Cerrar',
        confirmButtonClass: 'btn-danger dialog-btn',
      } as ConfirmDialogData,
    });

    const confirmed = await dialogRef.afterClosed().toPromise();
    if (!confirmed) return;

    try {
      await this.appointmentRepo.updateAppointment(appt.id, { status: 'cancelled' });
      await this.auditRepo.log({
        id: crypto.randomUUID(),
        action: 'update',
        entityType: 'appointment',
        entityId: appt.id,
        performedBy: this.authService.currentDoctor?.email ?? '',
        performedByUid: this.authService.currentDoctor?.uid ?? '',
        timestamp: new Date() as any,
        oldValues: { status: appt.status },
        newValues: { status: 'cancelled' },
      });
      this.alert.success({ message: 'Cita cancelada', duration: 3000 });
    } catch (e: any) {
      this.alert.error({ message: 'Error al cancelar la cita', duration: 5000 });
    }
  }

  viewHistory(appt: Appointment): void;
  viewHistory(patient: Patient): void;
  viewHistory(item: Appointment | Patient): void {
    const patientId = 'patientId' in item ? item.patientId : (item as Patient).id;
    this.router.navigate(['/app/patients/history', patientId]);
  }

  async regenerateOtp(patient: Patient) {
    const newOtp = this.generateOtpPassword();
    await this.patientRepo.updatePatient(patient.id, { otpPassword: newOtp });
    this.alert.success({ message: `Nueva contraseña OTP: ${newOtp}`, duration: 5000 });
  }

  async setCustomOtp(patient: Patient) {
    const dialogRef = this.dialog.open(ViewOtpDialog, {
      width: '400px',
      disableClose: true,
    });
    dialogRef.componentInstance.setPatient(patient);
    await dialogRef.afterClosed().toPromise();
  }

  async deletePatient(patient: Patient) {
    const dialogRef = this.dialog.open(ConfirmDialog, {
      panelClass: 'cancel-dialog',
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

  copyOtp(password: string) {
    this.clipboard.copy(password);
    this.alert.success({ message: 'Copiado al portapapeles', duration: 2000 });
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
