import { TestBed } from '@angular/core/testing';
import { CascadeService } from './cascade.service';
import { StaffDeletionService } from './staff-deletion.service';
import { PatientRepository } from '../repositories/patient.repository';
import { ClinicalRecordRepository } from '../repositories/clinical-record.repository';
import { AppointmentRepository } from '../repositories/appointment.repository';

describe('CascadeService staff deletion', () => {
  const staff = { deleteStaff: vi.fn() };
  const patients = { getPatientsByDoctor: vi.fn(), deletePatient: vi.fn() };
  const records = { getByPatient: vi.fn(), deleteMany: vi.fn() };
  const appointments = { getAllByDoctor: vi.fn(), deleteAppointments: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({ providers: [
      { provide: StaffDeletionService, useValue: staff },
      { provide: PatientRepository, useValue: patients },
      { provide: ClinicalRecordRepository, useValue: records },
      { provide: AppointmentRepository, useValue: appointments },
    ] });
  });

  it('delegates staff deletion to the server without touching client records', async () => {
    staff.deleteStaff.mockResolvedValue(undefined);
    await TestBed.inject(CascadeService).deleteDoctorCascade('staff-id');
    expect(staff.deleteStaff).toHaveBeenCalledWith('staff-id');
    expect(patients.getPatientsByDoctor).not.toHaveBeenCalled();
    expect(records.deleteMany).not.toHaveBeenCalled();
    expect(appointments.deleteAppointments).not.toHaveBeenCalled();
  });

  it('does not perform the former client cascade after server failure', async () => {
    const error = new Error('blocked');
    staff.deleteStaff.mockRejectedValue(error);
    await expect(TestBed.inject(CascadeService).deleteDoctorCascade('staff-id')).rejects.toBe(error);
    expect(patients.deletePatient).not.toHaveBeenCalled();
    expect(appointments.deleteAppointments).not.toHaveBeenCalled();
  });
});
