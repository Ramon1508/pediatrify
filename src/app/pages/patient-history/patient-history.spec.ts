import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { PatientHistory } from './patient-history';
import { PatientRepository } from '../../core/repositories/patient.repository';
import { AppointmentRepository } from '../../core/repositories/appointment.repository';
import { ClinicalRecordRepository } from '../../core/repositories/clinical-record.repository';
import { AuditRepository } from '../../core/repositories/audit.repository';
import { UserRepository } from '../../core/repositories/user.repository';
import { PrintSettingsRepository } from '../../core/repositories/print-settings.repository';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { CascadeService } from '../../core/services/cascade.service';
import { FirebaseService } from '../../core/firebase/firebase.service';
import { PatientStore } from '../../core/store/patient.store';

describe('PatientHistory scoped appointment entry', () => {
  const own = { id: 'own-child', doctorId: 'doctor-one', name: 'Paciente sintético' };
  let repo: { getAllPatients: ReturnType<typeof vi.fn>; getPatientsByDoctor: ReturnType<typeof vi.fn> };
  let auth: any;
  let dialog: any;
  let alert: any;
  let route: any;

  beforeEach(() => {
    repo = { getAllPatients: vi.fn(), getPatientsByDoctor: vi.fn().mockResolvedValue([
      own, { ...own, id: 'other-child', doctorId: 'doctor-two' }, { ...own, id: 'legacy', doctorId: undefined },
    ]) };
    auth = { currentDoctor: { uid: 'doctor-one', role: 'doctor', name: 'Doctor sintético' } };
    route = { snapshot: { paramMap: convertToParamMap({ patientId: own.id }) } };
    dialog = { open: vi.fn().mockReturnValue({
      componentInstance: { setData: vi.fn(), lockPatient: vi.fn() }, afterClosed: () => of(null),
    }) };
    alert = { error: vi.fn(), success: vi.fn() };
    TestBed.configureTestingModule({
      imports: [PatientHistory],
      providers: [
        { provide: ActivatedRoute, useValue: route }, { provide: MatDialog, useValue: dialog },
        { provide: PatientRepository, useValue: repo },
        { provide: AppointmentRepository, useValue: { getAllByDoctor: vi.fn().mockResolvedValue([]) } },
        { provide: ClinicalRecordRepository, useValue: {} }, { provide: AuditRepository, useValue: {} },
        { provide: UserRepository, useValue: { getUser: vi.fn().mockResolvedValue({ uid: 'doctor-one' }) } },
        { provide: PrintSettingsRepository, useValue: {} }, { provide: AuthService, useValue: auth },
        { provide: AlertService, useValue: alert }, { provide: CascadeService, useValue: {} },
        { provide: FirebaseService, useValue: { storage: {} } },
        { provide: PatientStore, useValue: { watchOne: () => signal(null) } },
      ],
    }).overrideComponent(PatientHistory, { set: { template: '', imports: [] } });
  });

  it('loads only scoped patients before locking the profile patient', async () => {
    const component = TestBed.createComponent(PatientHistory).componentInstance as any;
    await component.openNewAppointment();
    expect(repo.getPatientsByDoctor).toHaveBeenCalledWith('doctor-one');
    expect(repo.getAllPatients).not.toHaveBeenCalled();
    const instance = dialog.open.mock.results[0].value.componentInstance;
    expect(instance.setData).toHaveBeenCalledWith(expect.objectContaining({ allPatients: [own], selectedDoctorId: 'doctor-one' }));
    expect(instance.lockPatient).toHaveBeenCalledWith(own.id);
  });

  it.each(['other-child', 'legacy'])('does not schedule from an out-of-scope profile (%s)', async (patientId) => {
    route.snapshot.paramMap = convertToParamMap({ patientId });
    const component = TestBed.createComponent(PatientHistory).componentInstance as any;
    await component.openNewAppointment();
    expect(dialog.open).not.toHaveBeenCalled();
    expect(alert.error).toHaveBeenCalled();
    expect(repo.getAllPatients).not.toHaveBeenCalled();
  });

  it.each(['admin', 'assistant'])('does not query patients for a %s profile entry', async (role) => {
    auth.currentDoctor.role = role;
    const component = TestBed.createComponent(PatientHistory).componentInstance as any;
    await component.openNewAppointment();
    expect(repo.getPatientsByDoctor).not.toHaveBeenCalled();
    expect(dialog.open).not.toHaveBeenCalled();
  });
});
