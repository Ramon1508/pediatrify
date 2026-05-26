import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { AppointmentRepository } from '../../core/repositories/appointment.repository';
import { PatientRepository } from '../../core/repositories/patient.repository';
import { Appointment, Patient } from '../../core/models/user';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';

@Component({
  selector: 'app-appointments',
  templateUrl: './appointments.html',
  styleUrl: './appointments.scss',
  standalone: true,
  imports: [
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTabsModule,

  ],
})
export class Appointments implements OnInit {
  private appointmentRepo = inject(AppointmentRepository);
  private patientRepo = inject(PatientRepository);
  private authService = inject(AuthService);
  private alert = inject(AlertService);

  protected allAppointments = signal<Appointment[]>([]);
  protected allPatients: Patient[] = [];
  protected selectedTab = 0;

  protected showDialog = false;
  protected showWalkIn = false;
  protected dialogError = '';
  protected newAppointment = { patientId: '', date: '', time: '', notes: '' };

  protected selectedPatientId = '';
  protected walkInDate = '';
  protected walkInTime = '';
  protected walkInNotes = '';

  pendingAppointments = computed(() =>
    this.allAppointments().filter((a) => a.status === 'scheduled')
  );

  attendedAppointments = computed(() =>
    this.allAppointments().filter((a) => a.status === 'attended')
  );

  async ngOnInit() {
    const doctor = this.authService.currentDoctor;
    if (!doctor) return;

    this.allPatients = await this.patientRepo.getAllPatients();

    this.appointmentRepo.watchAppointmentsByDoctor(doctor.uid).subscribe((apps) => {
      this.allAppointments.set(apps);
    });
  }

  openNewAppointment() {
    this.newAppointment = { patientId: '', date: '', time: '', notes: '' };
    this.dialogError = '';
    this.showDialog = true;
  }

  closeDialog() {
    this.showDialog = false;
  }

  async saveAppointment() {
    if (!this.newAppointment.patientId || !this.newAppointment.date || !this.newAppointment.time) return;

    const doctor = this.authService.currentDoctor;
    const patient = this.allPatients.find((p) => p.id === this.newAppointment.patientId);
    if (!doctor || !patient) return;

    const id = crypto.randomUUID();
    await this.appointmentRepo.createAppointment(id, {
      id,
      patientId: patient.id,
      patientName: `${patient.name} ${patient.lastName}`,
      doctorId: doctor.uid,
      doctorName: doctor.name,
      date: this.newAppointment.date,
      time: this.newAppointment.time,
      status: 'scheduled',
      type: 'scheduled',
      notes: this.newAppointment.notes,
    });

    this.alert.success({ message: 'Cita agendada', duration: 3000 });
    this.showDialog = false;
  }

  async registerWalkIn() {
    if (!this.selectedPatientId) return;

    const doctor = this.authService.currentDoctor;
    const patient = this.allPatients.find((p) => p.id === this.selectedPatientId);
    if (!doctor || !patient) return;

    const id = crypto.randomUUID();
    const date = this.walkInDate || new Date().toISOString().split('T')[0];
    const time = this.walkInTime || new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

    await this.appointmentRepo.createAppointment(id, {
      id,
      patientId: patient.id,
      patientName: `${patient.name} ${patient.lastName}`,
      doctorId: doctor.uid,
      doctorName: doctor.name,
      date,
      time,
      status: 'attended',
      type: 'walk-in',
      notes: this.walkInNotes || 'Atención sin cita',
    });

    this.alert.success({ message: 'Atención registrada', duration: 3000 });
    this.showWalkIn = false;
    this.selectedPatientId = '';
    this.walkInDate = '';
    this.walkInTime = '';
    this.walkInNotes = '';
  }

  async markAttended(appointment: Appointment) {
    await this.appointmentRepo.updateAppointment(appointment.id, { status: 'attended' });
    this.alert.success({ message: 'Cita marcada como atendida', duration: 3000 });
  }

  async cancelAppointment(appointment: Appointment) {
    await this.appointmentRepo.updateAppointment(appointment.id, { status: 'cancelled' });
    this.alert.success({ message: 'Cita cancelada', duration: 3000 });
  }
}
