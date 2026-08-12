import { TestBed } from '@angular/core/testing';
import { NotificationService } from './notification.service';
import { NotificationRepository } from '../repositories/notification.repository';
import { UserRepository } from '../repositories/user.repository';
import { PatientRepository } from '../repositories/patient.repository';
import { AuthService } from './auth.service';
import { AppUser, Appointment } from '../models/user';
import { AppNotification } from '../models/notification';

describe('NotificationService', () => {
  let service: NotificationService;
  let repoMock: { create: ReturnType<typeof vi.fn> };
  let userRepoMock: { getUser: ReturnType<typeof vi.fn>; getAssistantsByDoctor: ReturnType<typeof vi.fn> };
  let patientRepoMock: { getPatient: ReturnType<typeof vi.fn>; findPatientsByLoginEmail: ReturnType<typeof vi.fn> };
  let captured: AppNotification | undefined;

  const doctor: AppUser = { uid: 'doc1', name: 'Dr. Uno', email: 'doc@test.com', role: 'doctor' };
  const appointment: Appointment = {
    id: 'apt1',
    patientId: 'p1',
    patientName: 'Ana',
    patientLastName: 'Rangel',
    patientFatherName: '',
    patientMotherName: '',
    patientBirthDate: '2020-01-01',
    patientPhone: '',
    doctorId: 'doc1',
    doctorName: 'Dr. Uno',
    date: '2026-08-08',
    time: '10:00',
    status: 'scheduled',
    type: 'scheduled',
  };

  beforeEach(() => {
    captured = undefined;
    repoMock = {
      create: vi.fn().mockImplementation((n: AppNotification) => {
        captured = n;
        return Promise.resolve();
      }),
    };
    userRepoMock = {
      getUser: vi.fn().mockResolvedValue({ uid: 'doc1', name: 'Dr. Uno', role: 'doctor' } as AppUser),
      getAssistantsByDoctor: vi.fn().mockResolvedValue([
        { uid: 'a1', name: 'Asistente 1', role: 'assistant', createdBy: 'doc1' } as AppUser,
      ]),
    };
    patientRepoMock = {
      getPatient: vi.fn().mockResolvedValue({ id: 'p1', name: 'Ana', lastName: 'Rangel', email: 'parent@test.com', secondaryEmail: '' }),
      findPatientsByLoginEmail: vi.fn().mockResolvedValue([
        { id: 'p1', name: 'Ana', lastName: 'Rangel', email: 'parent@test.com', secondaryEmail: '' },
      ]),
    };
    const authMock = {
      currentDoctor: { uid: 'doc1', name: 'Dr. Uno', role: 'doctor' },
      currentPatient: null,
    };

    TestBed.configureTestingModule({
      providers: [
        NotificationService,
        { provide: NotificationRepository, useValue: repoMock },
        { provide: UserRepository, useValue: userRepoMock },
        { provide: PatientRepository, useValue: patientRepoMock },
        { provide: AuthService, useValue: authMock },
      ],
    });
    service = TestBed.inject(NotificationService);
  });

  it('generates a notification for appointment creation with all recipients unread', async () => {
    await service.notifyAppointmentCreated(appointment);

    expect(repoMock.create).toHaveBeenCalledTimes(1);
    captured = repoMock.create.mock.calls[0][0] as AppNotification;
    expect(captured.type).toBe('appointment-created');
    expect(captured.title).toBe('Consulta agendada');
    expect(captured.description).toBe('Nueva consulta agendada con Ana Rangel para el 08/08/2026 a las 10:00.');
    expect(captured.appointmentId).toBe('apt1');
    expect(captured.originatorId).toBe('doc1');
    expect(captured.recipientIds).toEqual(expect.arrayContaining(['doc1', 'a1', 'p1']));

    const doc = captured.recipients.find((r) => r.recipientId === 'doc1');
    const assistant = captured.recipients.find((r) => r.recipientId === 'a1');
    const patient = captured.recipients.find((r) => r.recipientId === 'p1');
    expect(doc?.read).toBe(false);
    expect(assistant?.read).toBe(false);
    expect(patient?.read).toBe(false);
  });

  it('notifies a cancellation', async () => {
    await service.notifyAppointmentCancelled(appointment);
    captured = repoMock.create.mock.calls[0][0] as AppNotification;
    expect(captured.type).toBe('appointment-cancelled');
    expect(captured.title).toBe('Consulta cancelada');
    expect(captured.description).toBe('Ana Rangel canceló su consulta programada para el 08/08/2026 a las 10:00.');
  });

  it('notifies a reschedule with old and new datetime', async () => {
    await service.notifyAppointmentRescheduled(appointment, '2026-08-01', '09:00');
    captured = repoMock.create.mock.calls[0][0] as AppNotification;
    expect(captured.type).toBe('appointment-rescheduled');
    expect(captured.title).toBe('Consulta reagendada');
    expect(captured.description).toBe(
      'Ana Rangel reagendó su consulta del 01/08/2026 a las 09:00 al 08/08/2026 a las 10:00.'
    );
  });

  it('notifies all family children (siblings) sharing the parent login email', async () => {
    patientRepoMock.getPatient.mockResolvedValue({
      id: 'p1',
      name: 'Ana',
      lastName: 'Rangel',
      email: 'parent@test.com',
      secondaryEmail: '',
    });
    patientRepoMock.findPatientsByLoginEmail.mockResolvedValue([
      { id: 'p1', name: 'Ana', lastName: 'Rangel', email: 'parent@test.com', secondaryEmail: '' },
      { id: 'p2', name: 'Luis', lastName: 'Rangel', email: 'parent@test.com', secondaryEmail: '' },
      { id: 'p3', name: 'Luis', lastName: 'Rangel', email: 'parent@test.com', secondaryEmail: 'other@test.com' },
    ]);

    await service.notifyAppointmentCreated(appointment);
    captured = repoMock.create.mock.calls[0][0] as AppNotification;

    expect(patientRepoMock.findPatientsByLoginEmail).toHaveBeenCalledWith('parent@test.com');
    expect(captured.recipientIds).toEqual(expect.arrayContaining(['p1', 'p2', 'p3']));
    const p2 = captured.recipients.find((r) => r.recipientId === 'p2');
    expect(p2?.read).toBe(false);
  });

  it('does not add the admin user as a recipient', async () => {
    userRepoMock.getUser.mockResolvedValue({ uid: 'admin1', name: 'Admin', role: 'admin' } as AppUser);
    userRepoMock.getAssistantsByDoctor.mockResolvedValue([
      { uid: 'a1', name: 'Asistente 1', role: 'assistant', createdBy: 'admin1' } as AppUser,
    ]);

    await service.notifyAppointmentCreated({ ...appointment, doctorId: 'admin1' });
    captured = repoMock.create.mock.calls[0][0] as AppNotification;

    expect(captured.recipientIds).not.toContain('admin1');
    expect(captured.recipientIds).toContain('p1');
  });

  it('keeps notification failures isolated (no throw to caller)', async () => {
    userRepoMock.getUser.mockRejectedValue(new Error('network'));
    await expect(service.notifyAppointmentCreated(appointment)).resolves.toBeUndefined();
    expect(repoMock.create).not.toHaveBeenCalled();
  });

  it('notifies the owner doctor when an assistant creates the appointment', async () => {
    userRepoMock.getUser.mockImplementation(async (uid: string) => {
      if (uid === 'assist1') {
        return { uid: 'assist1', name: 'Asistente', role: 'assistant', createdBy: 'doc1' } as AppUser;
      }
      if (uid === 'doc1') {
        return { uid: 'doc1', name: 'Dr. Uno', role: 'doctor' } as AppUser;
      }
      return null as any;
    });
    userRepoMock.getAssistantsByDoctor.mockResolvedValue([
      { uid: 'assist1', name: 'Asistente', role: 'assistant', createdBy: 'doc1' } as AppUser,
    ]);
    const authMock = {
      currentDoctor: { uid: 'assist1', name: 'Asistente', role: 'assistant' },
      currentPatient: null,
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        NotificationService,
        { provide: NotificationRepository, useValue: repoMock },
        { provide: UserRepository, useValue: userRepoMock },
        { provide: PatientRepository, useValue: patientRepoMock },
        { provide: AuthService, useValue: authMock },
      ],
    });
    service = TestBed.inject(NotificationService);

    const assistAppointment: Appointment = {
      ...appointment,
      doctorId: 'assist1',
    };
    await service.notifyAppointmentCreated(assistAppointment);
    captured = repoMock.create.mock.calls[0][0] as AppNotification;

    const doctorRecipient = captured.recipients.find((r) => r.recipientId === 'doc1');
    const assistantRecipient = captured.recipients.find((r) => r.recipientId === 'assist1');
    expect(doctorRecipient).toBeDefined();
    expect(doctorRecipient?.read).toBe(false);
    expect(assistantRecipient?.read).toBe(false);
  });
});