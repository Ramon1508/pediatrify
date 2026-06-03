import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
    ReactiveFormsModule,
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
  private fb = inject(FormBuilder);
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

  protected appointmentForm = this.fb.group({
    patientId: ['', Validators.required],
    date: ['', Validators.required],
    time: ['', Validators.required],
    notes: [''],
  });

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

    this.allPatients = await this.patientRepo.getAllPatients();

    this.appointmentRepo.watchAppointmentsByDoctor(doctor.uid).subscribe((apps) => {
      this.allAppointments.set(apps);
    });
  }

  openNewAppointment() {
    this.appointmentForm.reset({ patientId: '', date: '', time: '', notes: '' });
    this.dialogError = '';
    this.showDialog = true;
  }

  closeDialog() {
    this.showDialog = false;
  }

  async saveAppointment() {
    if (this.appointmentForm.invalid) return;

    const doctor = this.authService.currentDoctor;
    const { patientId, date, time, notes } = this.appointmentForm.value;
    const patient = this.allPatients.find((p) => p.id === patientId);
    if (!doctor || !patient) return;

    const id = crypto.randomUUID();
    await this.appointmentRepo.createAppointment(id, {
      id,
      patientId: patient.id,
      patientName: `${patient.name} ${patient.lastName}`,
      doctorId: doctor.uid,
      doctorName: doctor.name,
      date: date!,
      time: time!,
      status: 'scheduled',
      type: 'scheduled',
      notes: notes || '',
    });

    this.alert.success({ message: 'Cita agendada', duration: 3000 });
    this.showDialog = false;
  }

  async registerWalkIn() {
    if (this.walkInForm.invalid) return;

    const doctor = this.authService.currentDoctor;
    const { patientId, date, time, notes } = this.walkInForm.value;
    const patient = this.allPatients.find((p) => p.id === patientId);
    if (!doctor || !patient) return;

    const id = crypto.randomUUID();
    const finalDate = date || new Date().toISOString().split('T')[0];
    const finalTime = time || new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

    await this.appointmentRepo.createAppointment(id, {
      id,
      patientId: patient.id,
      patientName: `${patient.name} ${patient.lastName}`,
      doctorId: doctor.uid,
      doctorName: doctor.name,
      date: finalDate,
      time: finalTime,
      status: 'attended',
      type: 'walk-in',
      notes: notes || 'Atención sin cita',
    });

    this.alert.success({ message: 'Atención registrada', duration: 3000 });
    this.showWalkIn = false;
    this.walkInForm.reset({ patientId: '', date: '', time: '', notes: '' });
  }

  async markAttended(appointment: Appointment) {
    await this.appointmentRepo.updateAppointment(appointment.id, { status: 'attended' });
    this.alert.success({ message: 'Cita marcada como atendida', duration: 3000 });
  }

  async cancelAppointment(appointment: Appointment) {
    await this.appointmentRepo.updateAppointment(appointment.id, { status: 'cancelled' });
    this.alert.success({ message: 'Cita cancelada', duration: 3000 });
  }

  protected get walkInPatientControl() { return this.walkInForm.get('patientId')!; }
  protected get newPatientControl() { return this.appointmentForm.get('patientId')!; }
}
