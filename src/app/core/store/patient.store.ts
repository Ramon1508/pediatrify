import { Injectable, inject } from '@angular/core';
import { SignalStore } from './signal-store';
import { PatientRepository } from '../repositories/patient.repository';
import { Patient } from '../models/user';

@Injectable({ providedIn: 'root' })
export class PatientStore extends SignalStore<Patient> {
  constructor() {
    const repo = inject(PatientRepository);
    super(
      () => repo.watchAllPatients(),
      (id) => repo.watchPatient(id),
    );
  }
}
