import { Injectable, inject } from '@angular/core';
import { PatientRepository } from '../repositories/patient.repository';
import { ClinicalRecordRepository } from '../repositories/clinical-record.repository';
import { AppointmentRepository } from '../repositories/appointment.repository';
import { UserRepository } from '../repositories/user.repository';

@Injectable({
  providedIn: 'root',
})
export class CascadeService {
  private patientRepo = inject(PatientRepository);
  private clinicalRepo = inject(ClinicalRecordRepository);
  private appointmentRepo = inject(AppointmentRepository);
  private userRepo = inject(UserRepository);

  async deletePatientCascade(patientId: string): Promise<void> {
    const records = await this.clinicalRepo.getByPatient(patientId);
    const appointments = await this.appointmentRepo.getByPatient(patientId);
    await Promise.all([
      this.clinicalRepo.deleteMany(records.map((r) => r.id)),
      this.appointmentRepo.deleteAppointments(appointments.map((a) => a.id)),
      this.patientRepo.deletePatient(patientId),
    ]);
  }

  async deleteDoctorCascade(doctorUid: string): Promise<void> {
    const patients = await this.patientRepo.getPatientsByDoctor(doctorUid);
    for (const p of patients) {
      await this.deletePatientCascade(p.id);
    }
    const appointments = await this.appointmentRepo.getAllByDoctor(doctorUid);
    await Promise.all([
      this.appointmentRepo.deleteAppointments(appointments.map((a) => a.id)),
      this.userRepo.deleteUser(doctorUid),
    ]);
  }
}
