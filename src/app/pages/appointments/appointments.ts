import { Component, inject, signal, computed, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { AppointmentRepository } from '../../core/repositories/appointment.repository';
import { PatientRepository } from '../../core/repositories/patient.repository';
import { UserRepository } from '../../core/repositories/user.repository';
import { AuditRepository } from '../../core/repositories/audit.repository';
import { Appointment, Patient } from '../../core/models/user';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { NotificationService } from '../../core/services/notification.service';
import { AppointmentFormDialog } from './dialogs/appointment-form-dialog/appointment-form-dialog';

@Component({
  selector: 'app-appointments',
  templateUrl: './appointments.html',
  styleUrl: './appointments.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTabsModule,
    MatDialogModule,
  ],
})
export class Appointments implements OnInit {
  private dialog = inject(MatDialog);
  private fb = inject(FormBuilder);
  private appointmentRepo = inject(AppointmentRepository);
  private patientRepo = inject(PatientRepository);
  private userRepo = inject(UserRepository);
  private auditRepo = inject(AuditRepository);
  private authService = inject(AuthService);
  private alert = inject(AlertService);
  private notifications = inject(NotificationService);
  private cdr = inject(ChangeDetectorRef);

  protected allAppointments = signal<Appointment[]>([]);
  protected allPatients = signal<Patient[]>([]);
  protected selectedTab = signal(0);
  protected isAdmin = false;
  protected walkInTimeSlots: string[] = [];

  protected showWalkIn = signal(false);
  protected submitted = signal(false);
  protected saving = signal(false);

  protected walkInForm = this.fb.group({
    patientId: ['', Validators.required],
    date: [''],
    time: [''],
    notes: [''],
  });

  pendingAppointments = computed(() =>
    this.allAppointments().filter((a) => a.status === 'scheduled')
  );

  attendedAppointments = computed(() =>
    this.allAppointments().filter((a) => a.status === 'attended')
  );

  async ngOnInit() {
    const doctor = this.authService.currentDoctor;
    if (!doctor) return;

    this.isAdmin = doctor.role === 'admin';
    this.allPatients.set(await this.patientRepo.getAllPatients());

    this.appointmentRepo.watchAppointmentsByDoctor(doctor.uid).subscribe((apps) => {
      this.allAppointments.set(apps);
    });

    const user = await this.userRepo.getUser(doctor.uid);
    if (user) {
      const segments = user.timeSegments?.length ? user.timeSegments : [{ startTime: '06:00', endTime: '00:00' }];
      const duration = user.consultationDuration ?? 30;
      const slots: string[] = [];
      for (const seg of segments) {
        const [sh, sm] = seg.startTime.split(':').map(Number);
        let [eh, em] = seg.endTime.split(':').map(Number);
        if (eh === 0 && em === 0) eh = 24;
        let startMinutes = sh * 60 + sm;
        const endMinutes = eh * 60 + em;
        while (startMinutes + duration <= endMinutes) {
          const hour = Math.floor(startMinutes / 60);
          const minute = startMinutes % 60;
          slots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
          startMinutes += duration;
        }
      }
      this.walkInTimeSlots = slots;
    }
  }

  async openNewAppointment() {
    const dialogRef = this.dialog.open(AppointmentFormDialog, {
      width: '400px',
      disableClose: false,
    });
    dialogRef.componentInstance.setPatients(this.allPatients());
    await dialogRef.afterClosed().toPromise();
  }

  async editAppointment(apt: Appointment) {
    const dialogRef = this.dialog.open(AppointmentFormDialog, {
      width: '400px',
      disableClose: false,
    });
    dialogRef.componentInstance.setPatients(this.allPatients());
    dialogRef.componentInstance.setEditData(apt);
    await dialogRef.afterClosed().toPromise();
  }

  async deleteAppointment(apt: Appointment) {
    const dialogRef = this.alert.confirm({
      title: 'Eliminar cita',
      message: `¿Deshabilitar la cita de ${apt.patientName}? No se borrará, solo se ocultará.`,
      confirmText: 'Eliminar',
    });
    const result = await dialogRef.afterClosed().toPromise();
    if (!result) return;
    await this.appointmentRepo.updateAppointment(apt.id, { disabled: true });
    const currentUser = this.authService.currentDoctor;
    await this.auditRepo.log({
      id: crypto.randomUUID(),
      action: 'delete',
      entityType: 'appointment',
      entityId: apt.id,
      performedBy: currentUser?.email ?? '',
      performedByUid: currentUser?.uid ?? '',
      timestamp: new Date() as any,
      oldValues: { status: apt.status, date: apt.date, time: apt.time, patientId: apt.patientId, doctorId: apt.doctorId },
    });
    this.alert.success({ message: 'Cita deshabilitada', duration: 3000 });
  }

  async registerWalkIn() {
    this.submitted.set(true);
    this.walkInForm.markAllAsTouched();
    if (this.walkInForm.invalid) return;

    this.saving.set(true);
    try {
      const doctor = this.authService.currentDoctor;
      const { patientId, date, time, notes } = this.walkInForm.value;
      const patient = this.allPatients().find((p) => p.id === patientId);
      if (!doctor || !patient) return;

      const id = crypto.randomUUID();
      const finalDate = date || new Date().toISOString().split('T')[0];
      const finalTime = time || new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

      await this.appointmentRepo.createAppointment(id, {
        id,
        patientId: patient.id,
        patientName: `${patient.name} ${patient.lastName}`,
        patientLastName: patient.lastName,
        patientFatherName: patient.fatherName ?? '',
        patientMotherName: patient.motherName ?? '',
        patientBirthDate: patient.birthDate,
        patientPhone: patient.phone ?? '',
        doctorId: doctor.uid,
        doctorName: doctor.name,
        date: finalDate,
        time: finalTime,
        status: 'attended',
        type: 'walk-in',
        notes: notes || 'Atención sin cita',
        disabled: false,
        updatedBy: doctor.email,
      });

      this.alert.success({ message: 'Atención registrada', duration: 3000 });
      this.showWalkIn.set(false);
      this.walkInForm.reset({ patientId: '', date: '', time: '', notes: '' });
    } finally {
      this.saving.set(false);
      this.cdr.markForCheck();
    }
  }

  async markAttended(appointment: Appointment) {
    await this.appointmentRepo.updateAppointment(appointment.id, { status: 'attended' });
    this.alert.success({ message: 'Cita marcada como atendida', duration: 3000 });
  }

  async cancelAppointment(appointment: Appointment) {
    const dialogRef = this.alert.confirm({
      title: 'Cancelar consulta',
      message: 'Al cancelar una consulta el padre o tutor del paciente recibirá una notificación de la cancelación y podrá seleccionar un nuevo día y horario para la consulta si así lo desea.',
      confirmText: 'Cancelar consulta',
      cancelText: 'Cerrar',
      confirmClass: 'btn-danger dialog-btn',
    });
    const result = await dialogRef.afterClosed().toPromise();
    if (!result) return;
    await this.appointmentRepo.updateAppointment(appointment.id, { status: 'cancelled' });
    await this.notifications.notifyAppointmentCancelled(appointment);
    this.alert.success({ message: 'Cita cancelada', duration: 3000 });
  }

  protected get walkInPatientControl() { return this.walkInForm.get('patientId')!; }
}
