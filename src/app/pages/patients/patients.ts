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
import { CascadeService } from '../../core/services/cascade.service';
import { EmailService } from '../../core/services/email.service';
import { PatientAccessService, PatientAccessRenewal } from '../../core/services/patient-access.service';
import { NotificationService } from '../../core/services/notification.service';
import { ClinicClockService } from '../../core/services/clinic-clock.service';
import { formatLocalDate } from '../../core/utils/date-utils';

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
  private readonly patientAccess = inject(PatientAccessService);
  private readonly renewalAttempts = new Map<string, { request: PatientAccessRenewal; renewed: boolean; busy: boolean }>();
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private patientRepo = inject(PatientRepository);
  private appointmentRepo = inject(AppointmentRepository);
  private auditRepo = inject(AuditRepository);
  private authService = inject(AuthService);
  private alert = inject(AlertService);
  private clipboard = inject(Clipboard);
  private cascade = inject(CascadeService);
  private emailService = inject(EmailService);
  private notifications = inject(NotificationService);
  private readonly clock = inject(ClinicClockService);

  protected patients = signal<Patient[]>([]);
  protected patientsWithAge = signal<(Patient & { ageDisplay: string })[]>([]);
  protected loading = signal(true);
  protected isAdmin = signal(false);
  protected searchControl = new FormControl('');
  protected searchTerm = signal('');

  private readonly agendaAppointments = signal<Appointment[]>([]);
  protected readonly todayAppointments = computed(() => this.agendaAppointments().filter(
    appointment => appointment.date === this.clock.now().date && appointment.status === 'scheduled'));
  protected readonly todayDateLabel = computed(() => formatLocalDate(this.clock.now().date));

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
    const doctor = this.authService.currentDoctor;
    const currentDoctorUid = doctor?.uid;
    if (doctor?.role !== 'doctor' || !currentDoctorUid) {
      this.patients.set([]);
      this.patientsWithAge.set([]);
      this.agendaAppointments.set([]);
      this.loading.set(false);
      return;
    }

    this.subs.push(
      this.searchControl.valueChanges.subscribe((val) => {
        this.searchTerm.set(val || '');
      })
    );

    this.subs.push(this.patientRepo.watchPatientsByDoctor(currentDoctorUid).subscribe({
      next: (patients) => {
        const current = this.authService.currentDoctor;
        const filtered = current?.role === 'doctor' && current.uid === currentDoctorUid
          ? patients.filter((p) => p.doctorId === currentDoctorUid)
          : [];
        this.patients.set(filtered);
        this.patientsWithAge.set(filtered.map((p) => ({ ...p, ageDisplay: calcAge(p.birthDate) })));
        this.loading.set(false);
      },
      error: () => {
        this.patients.set([]);
        this.patientsWithAge.set([]);
        this.loading.set(false);
        this.alert.error({ message: 'No fue posible cargar tus pacientes. Intenta abrir la página nuevamente.', duration: 5000 });
      },
    }));

    if (currentDoctorUid) {
      this.subs.push(
        this.appointmentRepo.watchAppointmentsByDoctor(currentDoctorUid).subscribe((appts) => {
          this.agendaAppointments.set(appts);
        })
      );
    }
  }

  ngOnDestroy() {
    this.renewalAttempts.clear();
    for (const s of this.subs) s.unsubscribe();
  }

  protected scheduleAppointment() {
    this.router.navigate(['/app/calendar'], { state: { openAppointment: true } });
  }

  async openNewPatient() {
    const dialogRef = this.dialog.open(NewPatientDialog, {
      width: '400px',
      disableClose: false,
      panelClass: 'right-panel',
    });
    dialogRef.componentInstance.setPatients(this.patients());

    const result = await dialogRef.afterClosed().toPromise();
    if (result) {
      this.alert.success({ message: 'Paciente agregado', duration: 3000 });
    }
  }

  async openCompleteProfile(patient: Patient) {
    const dialogRef = this.dialog.open(CompleteProfileDialog, {
      width: '736px',
      disableClose: false,
      panelClass: 'right-panel',
    });
    dialogRef.componentInstance.setPatient(patient);

    await dialogRef.afterClosed().toPromise();
  }

  async openEditPatient(patient: Patient) {
    const dialogRef = this.dialog.open(EditPatientDialog, {
      width: '736px',
      disableClose: false,
      panelClass: 'right-panel',
    });
    dialogRef.componentInstance.setPatient(patient);
    dialogRef.componentInstance.switchToEdit();

    await dialogRef.afterClosed().toPromise();
  }

  async cancelAppointment(appt: Appointment) {
    const dialogRef = this.dialog.open(ConfirmDialog, {
      panelClass: 'context-card-panel',
      width: '100%',
      maxWidth: '552px',
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
    const actor = this.authService.currentDoctor;
    if (actor?.role !== 'doctor' || actor.uid !== patient.doctorId) return;
    const key = actor.uid + ':' + patient.id;
    let attempt = this.renewalAttempts.get(key);
    if (attempt?.busy) return;
    try {
      if (!attempt) {
        // Reserve the local attempt before awaiting so a double click cannot rotate twice.
        attempt = { request: { patientId: patient.id, operationId: crypto.randomUUID(), expectedVersion: 0, expectedEpoch: '' }, renewed: false, busy: true };
        this.renewalAttempts.set(key, attempt);
        const current = await this.patientAccess.read(patient.id);
        if (this.authService.currentDoctor?.uid !== actor.uid || this.authService.currentDoctor?.role !== 'doctor' || this.renewalAttempts.get(key) !== attempt) return;
        attempt.request.expectedVersion = current.credentialVersion;
        attempt.request.expectedEpoch = current.credentialEpoch;
      }
      attempt.busy = true;
      if (!attempt.renewed) {
        await this.patientAccess.renew(attempt.request);
        if (this.authService.currentDoctor?.uid !== actor.uid || this.authService.currentDoctor?.role !== 'doctor' || this.renewalAttempts.get(key) !== attempt) return;
        attempt.renewed = true;
      }
      await this.emailService.sendPatientAccessEmail({
        patientId: patient.id, operationId: attempt.request.operationId,
      });
      this.renewalAttempts.delete(key);
      if (this.authService.currentDoctor?.uid === actor.uid) this.alert.success({ message: 'Contraseña renovada. Acceso enviado a los correos guardados.', duration: 5000 });
    } catch (failure) {
      if (!attempt?.request.expectedVersion || (failure as { code?: string }).code === 'functions/aborted') this.renewalAttempts.delete(key);
      if (this.authService.currentDoctor?.uid === actor.uid) this.alert.error({ message: attempt?.renewed
        ? 'Contraseña renovada, pero faltan envíos por confirmar. Vuelve a pulsar Regenerar para reintentar el envío sin cambiarla.'
        : 'No se pudo confirmar la renovación. Reintenta la operación.', duration: 5000 });
    } finally {
      if (attempt) attempt.busy = false;
    }
  }

  async viewPatientAccess(patient: Patient) {
    const dialogRef = this.dialog.open(ViewOtpDialog, {
      width: '400px',
      disableClose: false,
      panelClass: 'context-card-panel',
    });
    dialogRef.componentInstance.setPatient(patient);
    await dialogRef.afterClosed().toPromise();
  }

  async deletePatient(patient: Patient) {
    const dialogRef = this.dialog.open(ConfirmDialog, {
      panelClass: 'context-card-panel',
      width: '552px',
      maxWidth: '552px',
      data: {
        title: 'Eliminar paciente',
        message: 'Al eliminar un paciente, su historial también será eliminado, además, los padres o tutores asociados a él, perderán acceso a la plataforma a menos que otro paciente esté asociado a ellos.',
        confirmLabel: 'Eliminar paciente',
        cancelLabel: 'Cerrar',
        confirmButtonClass: 'btn-danger dialog-btn',
      } as ConfirmDialogData,
    });

    const confirmed = await dialogRef.afterClosed().toPromise();
    if (!confirmed) return;

    await this.cascade.deletePatientCascade(patient.id);
    this.alert.success({ message: 'Paciente eliminado', duration: 3000 });
  }

  copyOtp(password: string) {
    this.clipboard.copy(password);
    this.alert.success({ message: 'Copiado al portapapeles', duration: 2000 });
  }


}
