import { Injectable, inject, Signal } from '@angular/core';
import { SignalStore } from './signal-store';
import { AppointmentRepository } from '../repositories/appointment.repository';
import { Appointment } from '../models/user';

@Injectable({ providedIn: 'root' })
export class AppointmentStore extends SignalStore<Appointment> {
  constructor() {
    const repo = inject(AppointmentRepository);
    super(null, (id) => repo.watchOneAppointment(id));
    this.repo = repo;
  }

  private repo!: AppointmentRepository;

  watchByDoctor(doctorId: string): Signal<Appointment[]> {
    return this.watchQuery(
      `byDoctor:${doctorId}`,
      () => this.repo.watchAppointmentsByDoctor(doctorId),
    );
  }

  watchByUpdatedBy(email: string): Signal<Appointment[]> {
    return this.watchQuery(
      `byUpdatedBy:${email}`,
      () => this.repo.watchAppointmentsByUpdatedBy(email),
    );
  }
}
