import { Component, inject, signal, computed, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
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
import { Patient, Appointment } from '../../core/models/user';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { Clipboard } from '@angular/cdk/clipboard';
import { NewPatientDialog } from '../calendar/dialogs/new-patient-dialog/new-patient-dialog';

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
  ],
})
export class Patients implements OnInit, OnDestroy {
  private dialog = inject(MatDialog);
  private patientRepo = inject(PatientRepository);
  private appointmentRepo = inject(AppointmentRepository);
  private auditRepo = inject(AuditRepository);
  private authService = inject(AuthService);
  private alert = inject(AlertService);
  private clipboard = inject(Clipboard);
  private cdr = inject(ChangeDetectorRef);

  protected patients = signal<Patient[]>([]);
  protected loading = true;
  protected isAdmin = false;
  protected searchControl = new FormControl('');
  protected searchTerm = signal('');

  protected todayAppointments = signal<Appointment[]>([]);
  protected todayDateLabel = '';

  protected filteredPatients = computed(() => {
    const term = this.searchTerm().toLowerCase();
    if (!term) return this.patients();
    return this.patients().filter(
      (p) => (p.name + ' ' + p.lastName).toLowerCase().includes(term)
    );
  });

  private subs: any[] = [];

  async ngOnInit() {
    this.isAdmin = this.authService.currentDoctor?.role === 'admin';
    const currentDoctorUid = this.authService.currentDoctor?.uid;

    this.subs.push(
      this.searchControl.valueChanges.subscribe((val) => {
        this.searchTerm.set(val || '');
      })
    );

    this.patientRepo.watchAllPatients().subscribe((patients) => {
      this.patients.set(patients);
      this.loading = false;
      this.cdr.markForCheck();
    });

    if (currentDoctorUid) {
      this.subs.push(
        this.appointmentRepo.watchAppointmentsByDoctor(currentDoctorUid).subscribe((appts) => {
          const today = new Date();
          const todayStr = this.formatDateStr(today);
          this.todayAppointments.set(
            appts.filter((a) => a.date === todayStr && a.status === 'scheduled')
          );
          this.todayDateLabel = today.toLocaleDateString('es-MX', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          });
          this.cdr.markForCheck();
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
    }
  }

  async openEditPatient(patient: Patient) {
    const dialogRef = this.dialog.open(NewPatientDialog, {
      width: '400px',
      disableClose: true,
      panelClass: 'right-panel',
    });
    dialogRef.componentInstance.setPatients(this.patients());
    dialogRef.componentInstance.setEditData(patient);

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

  viewHistory(appt: Appointment) {
    const patient = this.patients().find((p) => p.id === appt.patientId);
    if (patient) {
      this.openEditPatient(patient);
    } else {
      this.alert.error({ message: 'Paciente no encontrado', duration: 3000 });
    }
  }

  async regenerateOtp(patient: Patient) {
    const newOtp = this.generateOtpPassword();
    await this.patientRepo.updatePatient(patient.id, { otpPassword: newOtp });
    this.alert.success({ message: `Nueva contraseña OTP: ${newOtp}`, duration: 5000 });
  }

  async setCustomOtp(patient: Patient) {
    const pwd = prompt('Ingresa la nueva contraseña OTP (mín. 4 caracteres):');
    if (!pwd || pwd.length < 4) return;
    await this.patientRepo.updatePatient(patient.id, { otpPassword: pwd });
    this.alert.success({ message: `Contraseña OTP actualizada: ${pwd}`, duration: 5000 });
  }

  async deletePatient(patient: Patient) {
    if (confirm(`¿Eliminar a ${patient.name} ${patient.lastName}?`)) {
      await this.patientRepo.deletePatient(patient.id);
      this.alert.success({ message: 'Paciente eliminado', duration: 3000 });
    }
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
