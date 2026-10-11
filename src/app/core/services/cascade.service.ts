import { Injectable, inject } from '@angular/core';
import { PatientRepository } from '../repositories/patient.repository';
import { StaffDeletionService } from './staff-deletion.service';

@Injectable({
  providedIn: 'root',
})
export class CascadeService {
  private patientRepo = inject(PatientRepository);
  private staffDeletion = inject(StaffDeletionService);

  async deletePatientCascade(patientId: string): Promise<void> {
    await this.patientRepo.deletePatient(patientId);
  }

  async deleteDoctorCascade(doctorUid: string): Promise<void> {
    await this.staffDeletion.deleteStaff(doctorUid);
  }
}
