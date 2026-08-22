import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, Subject } from 'rxjs';
import { signal } from '@angular/core';
import { NotificationService } from './notification.service';
import { NotificationRepository, NotificationPage } from '../repositories/notification.repository';
import { UserRepository } from '../repositories/user.repository';
import { PatientRepository } from '../repositories/patient.repository';
import { AuthService } from './auth.service';
import { AppUser, Appointment } from '../models/user';
import { AppNotification } from '../models/notification';

describe('NotificationService', () => {
  let service: NotificationService;
  let repoMock: {
    createMany: ReturnType<typeof vi.fn>;
    getPage: ReturnType<typeof vi.fn>;
    watchUnreadCount: ReturnType<typeof vi.fn>;
    markRead: ReturnType<typeof vi.fn>;
    watchForRecipient: ReturnType<typeof vi.fn>;
    markAllCancelledRead: ReturnType<typeof vi.fn>;
  };
  let userRepoMock: { getUser: ReturnType<typeof vi.fn>; getAssistantsByDoctor: ReturnType<typeof vi.fn> };
  let patientRepoMock: { getPatient: ReturnType<typeof vi.fn>; findPatientsByLoginEmail: ReturnType<typeof vi.fn> };
  let session$: BehaviorSubject<any>;
  let count$: Subject<number>;
  let captured: any;
  let capturedRecipients: any;

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

  function makeNotification(id: string, overrides: Partial<AppNotification> = {}): AppNotification {
    return {
      id,
      type: 'appointment-created',
      title: 'Consulta agendada',
      description: 'Nueva consulta agendada con Ana Rangel.',
      appointmentId: 'apt1',
      createdAt: new Date(),
      originatorId: 'doc2',
      originatorName: 'Otro',
      recipientId: 'doc1',
      recipientType: 'doctor',
      read: false,
      ...overrides,
    };
  }

  function flush() {
    return new Promise((r) => setTimeout(r, 0));
  }

  function configure(
    auth: any = { currentDoctor: doctor, currentPatient: null },
    firstPage: NotificationPage = { items: [], lastVisible: null },
    realtimeFn?: (cb: (list: AppNotification[]) => void) => { unsubscribe: () => void }
  ) {
    TestBed.resetTestingModule();
    session$ = new BehaviorSubject<any>(
      auth.currentDoctor ? { type: 'doctor', user: auth.currentDoctor }
        : auth.currentPatient ? { type: 'patient', patient: auth.currentPatient }
        : null
    );
    const authMock = {
      ...auth,
      get currentDoctor() {
        const s = session$.value;
        return s?.type === 'doctor' ? s.user : null;
      },
      get currentPatient() {
        const s = session$.value;
        return s?.type === 'patient' ? s.patient : null;
      },
      session$: session$.asObservable(),
    } as any;

    captured = undefined;
    capturedRecipients = undefined;
    count$ = new Subject<number>();
    repoMock = {
      createMany: vi.fn().mockImplementation((payload: any, recipients: any) => {
        captured = payload;
        capturedRecipients = recipients;
        return Promise.resolve();
      }),
      getPage: vi.fn().mockResolvedValue(firstPage),
      watchUnreadCount: vi.fn().mockReturnValue(count$),
      markRead: vi.fn().mockResolvedValue(undefined),
      markAllCancelledRead: vi.fn().mockResolvedValue([]),
      watchForRecipient: vi.fn().mockReturnValue({
        subscribe: (cb: (list: AppNotification[]) => void) => {
          if (realtimeFn) return realtimeFn(cb);
          return { unsubscribe: vi.fn() };
        },
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
    count$.next(3);
    return { authMock };
  }

  describe('generación de notificaciones', () => {
    it('generates a notification per recipient (fan-out) for appointment creation', async () => {
      configure();
      await service.notifyAppointmentCreated(appointment);

      expect(repoMock.createMany).toHaveBeenCalledTimes(1);
      captured = repoMock.createMany.mock.calls[0][0] as any;
      capturedRecipients = repoMock.createMany.mock.calls[0][1] as any;
      expect(captured.type).toBe('appointment-created');
      expect(captured.title).toBe('Consulta agendada');
      expect(captured.description).toBe('Nueva consulta agendada con Ana Rangel para el 08/08/2026 a las 10:00.');
      expect(captured.appointmentId).toBe('apt1');
      expect(captured.originatorId).toBe('doc1');

      const ids = capturedRecipients.map((r: any) => r.recipientId);
      expect(ids).toEqual(expect.arrayContaining(['doc1', 'a1', 'p1']));
      // Cada doc de destinatario arranca read=false (lo setea el repo).
      const doctor = capturedRecipients.find((r: any) => r.recipientId === 'doc1');
      expect(doctor.recipientType).toBe('doctor');
    });

    it('notifies a cancellation', async () => {
      configure();
      await service.notifyAppointmentCancelled(appointment);
      captured = repoMock.createMany.mock.calls[0][0] as any;
      expect(captured.type).toBe('appointment-cancelled');
      expect(captured.title).toBe('Consulta cancelada');
      expect(captured.description).toBe('Ana Rangel canceló su consulta programada para el 08/08/2026 a las 10:00.');
    });

    it('notifies a reschedule with old and new datetime', async () => {
      configure();
      await service.notifyAppointmentRescheduled(appointment, '2026-08-01', '09:00');
      captured = repoMock.createMany.mock.calls[0][0] as any;
      expect(captured.type).toBe('appointment-rescheduled');
      expect(captured.title).toBe('Consulta reagendada');
      expect(captured.description).toBe(
        'Ana Rangel reagendó su consulta del 01/08/2026 a las 09:00 al 08/08/2026 a las 10:00.'
      );
    });

    it('notifies all family children (siblings) sharing the parent login email', async () => {
      configure();
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
      capturedRecipients = repoMock.createMany.mock.calls[0][1] as any;

      expect(patientRepoMock.findPatientsByLoginEmail).toHaveBeenCalledWith('parent@test.com');
      const ids = capturedRecipients.map((r: any) => r.recipientId);
      expect(ids).toEqual(expect.arrayContaining(['p1', 'p2', 'p3']));
    });

    it('does not add the admin user as a recipient', async () => {
      configure();
      userRepoMock.getUser.mockResolvedValue({ uid: 'admin1', name: 'Admin', role: 'admin' } as AppUser);
      userRepoMock.getAssistantsByDoctor.mockResolvedValue([
        { uid: 'a1', name: 'Asistente 1', role: 'assistant', createdBy: 'admin1' } as AppUser,
      ]);

      await service.notifyAppointmentCreated({ ...appointment, doctorId: 'admin1' });
      capturedRecipients = repoMock.createMany.mock.calls[0][1] as any;
      const ids = capturedRecipients.map((r: any) => r.recipientId);

      expect(ids).not.toContain('admin1');
      expect(ids).toContain('p1');
    });

    it('keeps notification failures isolated (no throw to caller)', async () => {
      configure();
      userRepoMock.getUser.mockRejectedValue(new Error('network'));
      await expect(service.notifyAppointmentCreated(appointment)).resolves.toBeUndefined();
      expect(repoMock.createMany).not.toHaveBeenCalled();
    });

    it('notifies the owner doctor when an assistant creates the appointment', async () => {
      configure({ currentDoctor: { uid: 'assist1', name: 'Asistente', role: 'assistant' } });
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

      const assistAppointment: Appointment = {
        ...appointment,
        doctorId: 'assist1',
      };
      await service.notifyAppointmentCreated(assistAppointment);
      capturedRecipients = repoMock.createMany.mock.calls[0][1] as any;
      const ids = capturedRecipients.map((r: any) => r.recipientId);

      expect(ids).toContain('doc1');
      expect(ids).toContain('assist1');
    });
  });

  describe('estado de carga y paginación', () => {
    function loadPageResponse(ids: string[]): NotificationPage {
      return {
        items: ids.map((id) => makeNotification(id)),
        lastVisible: { id: ids[ids.length - 1] } as any,
      };
    }

    it('resolves recipient on session and loads first page for "Todos"', async () => {
      const { authMock } = configure(undefined, loadPageResponse(['n1', 'n2', 'n3']));
      await flush();
      expect(authMock.currentDoctor.uid).toBe('doc1');
      expect(repoMock.getPage).toHaveBeenCalledWith('doc1', 'all', 3, null);
      expect(service.notifications()).toHaveLength(3);
      expect(service.hasMore()).toBe(true);
    });

    it('sets unreadCount from the backend count on session start', async () => {
      configure();
      await flush();
      expect(service.unreadCount()).toBe(3);
    });

    it('reconciles unreadCount when the realtime count subscription emits a new value', async () => {
      configure();
      await flush();
      count$.next(27);
      expect(service.unreadCount()).toBe(27);
    });

    it('keeps unreadCount decoupled from the number of loaded notifications', async () => {
      configure(undefined, loadPageResponse(['n1', 'n2', 'n3']));
      await flush();
      expect(service.notifications()).toHaveLength(3);
      expect(service.unreadCount()).toBe(3);
    });

    it('appends the next page without duplicating already-loaded notifications', async () => {
      configure(undefined, loadPageResponse(['n1', 'n2', 'n3']));
      await flush();
      expect(service.notifications()).toHaveLength(3);

      repoMock.getPage.mockResolvedValueOnce(loadPageResponse(['n4', 'n5', 'n6']));
      await service.loadMore();
      expect(repoMock.getPage).toHaveBeenLastCalledWith('doc1', 'all', 3, expect.anything());
      expect(service.notifications()).toHaveLength(6);
    });

    it('sets hasMore=false when the page has fewer items than the page size', async () => {
      configure(undefined, loadPageResponse(['n1', 'n2']));
      await flush();
      expect(service.notifications()).toHaveLength(2);
      expect(service.hasMore()).toBe(false);
    });

    it('treats "Todos" and "Sin leer" pagination as independent states', async () => {
      configure(undefined, loadPageResponse(['n1', 'n2', 'n3']));
      await flush();
      expect(repoMock.getPage).toHaveBeenLastCalledWith('doc1', 'all', 3, null);

      // "Sin leer" consulta por separado al backend con filtro 'unread'.
      repoMock.getPage.mockResolvedValue(loadPageResponse(['n2']));
      await service.setFilter('unread');
      expect(repoMock.getPage).toHaveBeenLastCalledWith('doc1', 'unread', 3, null);
      expect(service.notifications().map((n) => n.id)).toEqual(['n2']);
      expect(service.activeFilter()).toBe('unread');

      await service.setFilter('all');
      expect(service.notifications()).toHaveLength(3);
    });

    it('"Sin leer" devuelve solo los ítems no leídos que consulta al backend', async () => {
      const unreadPage = loadPageResponse(['n1', 'n2', 'n3']);
      unreadPage.items = [makeNotification('n1', { read: false }), makeNotification('n3', { read: false })];
      configure(undefined, { items: [], lastVisible: null });
      await flush();
      expect(service.notifications()).toHaveLength(0);

      repoMock.getPage.mockResolvedValue(unreadPage);
      await service.setFilter('unread');
      expect(repoMock.getPage).toHaveBeenCalledWith('doc1', 'unread', 3, null);
      expect(service.notifications().map((n) => n.id)).toEqual(['n1', 'n3']);
    });

    it('ignores loadMore while already loading more', async () => {
      let resolvePage: (p: NotificationPage) => void;
      configure(undefined, { items: [], lastVisible: null });
      await flush();

      repoMock.getPage
        .mockResolvedValueOnce(loadPageResponse(['n1', 'n2', 'n3']))
        .mockImplementationOnce(() => new Promise((res) => { resolvePage = res; }));
      await service.loadFirstPage();

      const p1 = service.loadMore();
      const p2 = service.loadMore();
      resolvePage!(loadPageResponse(['n4', 'n5', 'n6']));
      await Promise.all([p1, p2]);
      expect(service.notifications()).toHaveLength(6);
      expect(repoMock.getPage).toHaveBeenCalledTimes(3);
    });

    it('refresh() clears the cache and rebuilds the first page', async () => {
      repoMock.getPage.mockResolvedValue(loadPageResponse(['n1', 'n2', 'n3']));
      configure();
      await flush();

      repoMock.getPage.mockResolvedValue(loadPageResponse(['n9', 'n8', 'n7']));
      await service.refresh();
      expect(service.notifications().map((n) => n.id)).toEqual(['n9', 'n8', 'n7']);
    });
  });

  describe('lectura y contador', () => {
    function unreadList(): NotificationPage {
      return {
        items: [makeNotification('n1')],
        lastVisible: { id: 'n1' } as any,
      };
    }

    it('markAsRead updates the cache and the DB without touching the badge', async () => {
      configure(undefined, unreadList());
      await flush();
      expect(service.unreadCount()).toBe(3);

      await service.markAsRead('n1');
      expect(repoMock.markRead).toHaveBeenCalledWith('n1');
      // El badge NO lo toca markAsRead: lo mantiene la subscripción onSnapshot.
      // Aquí la DB ya cambió, así que la subscripción emite 2.
      count$.next(2);
      expect(service.unreadCount()).toBe(2);
      const item = service.notifications().find((n) => n.id === 'n1');
      expect(item?.read).toBe(true);
    });

    it('markAsRead removes the notification from the unread cache', async () => {
      configure(undefined, unreadList());
      await flush();
      await service.setFilter('unread');
      expect(service.notifications()).toHaveLength(1);

      await service.markAsRead('n1');
      expect(service.notifications()).toHaveLength(0);
    });

    it('markCancelledRead marks only the unread cancelled notifications as read', async () => {
      const cancelled: AppNotification = {
        ...makeNotification('nCanc', { type: 'appointment-cancelled' }),
        appointmentId: 'apt1',
      };
      const rescheduled: AppNotification = {
        ...makeNotification('nRes', { type: 'appointment-rescheduled' }),
      };
      configure(undefined, { items: [cancelled, rescheduled], lastVisible: { id: 'nRes' } as any });
      await flush();
      expect(service.notifications()).toHaveLength(2);
      const initialCount = service.unreadCount();

      await service.markCancelledRead();
      expect(repoMock.markAllCancelledRead).toHaveBeenCalledWith('doc1');
      expect(repoMock.markRead).toHaveBeenCalledWith('nCanc');
      expect(repoMock.markRead).not.toHaveBeenCalledWith('nRes');
      // El badge lo baja la subscripción al detectar el cambio en la DB.
      count$.next(initialCount - 1);
      expect(service.unreadCount()).toBe(initialCount - 1);
      const cancelledItem = service.notifications().find((n) => n.id === 'nCanc');
      expect(cancelledItem?.read).toBe(true);
      const rescheduledItem = service.notifications().find((n) => n.id === 'nRes');
      expect(rescheduledItem?.read).toBe(false);
    });

    it('markCancelledRead marks cancelled notifications present in Firestore but outside the cache', async () => {
      const rescheduled: AppNotification = {
        ...makeNotification('nRes', { type: 'appointment-rescheduled' }),
      };
      configure(undefined, { items: [rescheduled], lastVisible: null });
      await flush();
      repoMock.markAllCancelledRead.mockResolvedValue(['nOldCanc']);
      expect(service.notifications()).toHaveLength(1);
      const initialCount = service.unreadCount();

      await service.markCancelledRead();
      expect(repoMock.markRead).toHaveBeenCalledWith('nOldCanc');
      count$.next(initialCount - 1);
      const cachedRes = service.notifications().find((n) => n.id === 'nRes');
      expect(cachedRes?.read).toBe(false);
    });

    it('reproduces the real badge flow: the badge only changes when the subscription emits', async () => {
      const n1 = makeNotification('n1');
      const n2 = makeNotification('n2');
      const n3 = makeNotification('n3');
      const n4 = makeNotification('n4');
      const nCanc: AppNotification = {
        ...makeNotification('nCanc', { type: 'appointment-cancelled', title: 'Consulta cancelada' }),
      };
      configure(undefined, {
        items: [n1, n2, n3, n4, nCanc],
        lastVisible: { id: 'nCanc' } as any,
      });
      await flush();

      // La subscripción emite el conteo real de la DB.
      count$.next(5);
      expect(service.unreadCount()).toBe(5);

      // El usuario lee 2 notificaciones (created) desde "Ver detalles".
      await service.markAsRead('n1');
      await service.markAsRead('n2');
      // El badge no cambia hasta que la subscripción se entera del cambio en la DB.
      count$.next(3);
      expect(service.unreadCount()).toBe(3);

      // Al cerrar el diálogo, la cancelada se marca leída.
      repoMock.markAllCancelledRead.mockResolvedValue(['nCanc']);
      await service.markCancelledRead();
      expect(repoMock.markRead).toHaveBeenCalledWith('nCanc');
      count$.next(2);
      expect(service.unreadCount()).toBe(2);
      const cancelled = service.notifications().find((n) => n.id === 'nCanc');
      expect(cancelled?.read).toBe(true);
    });
  });

  describe('realtime', () => {
    it('prepends new notifications received in realtime without duplicating', async () => {
      const listeners: Array<(list: AppNotification[]) => void> = [];
      configure(
        undefined,
        {
          items: [
            makeNotification('n1', { createdAt: new Date('2026-08-12T10:00:00') }),
            makeNotification('n2', { createdAt: new Date('2026-08-12T09:00:00') }),
          ],
          lastVisible: { id: 'n2' } as any,
        },
        (cb) => {
          listeners.push(cb);
          return { unsubscribe: vi.fn() };
        }
      );
      await flush();
      expect(service.notifications().map((n) => n.id)).toEqual(['n1', 'n2']);

      const newer = makeNotification('nD', { createdAt: new Date('2026-08-12T11:00:00') });
      listeners[0]([newer, ...service.notifications()]);
      expect(service.notifications().map((n) => n.id)).toEqual(['nD', 'n1', 'n2']);
      // El badge lo mantiene la subscripción watchUnreadCount, no prependNew.
      count$.next(4);
      expect(service.unreadCount()).toBe(4);
    });

    it('ignores realtime items older than the newest loaded (no bulk prepend)', async () => {
      const listeners: Array<(list: AppNotification[]) => void> = [];
      configure(
        undefined,
        {
          items: [
            makeNotification('n1', { createdAt: new Date('2026-08-12T10:00:00') }),
            makeNotification('n2', { createdAt: new Date('2026-08-12T09:00:00') }),
          ],
          lastVisible: { id: 'n2' } as any,
        },
        (cb) => {
          listeners.push(cb);
          return { unsubscribe: vi.fn() };
        }
      );
      await flush();

      const old = makeNotification('nOld', { createdAt: new Date('2026-08-12T08:00:00') });
      listeners[0]([makeNotification('n1', { createdAt: new Date('2026-08-12T10:00:00') }), old]);
      expect(service.notifications().map((n) => n.id)).toEqual(['n1', 'n2']);
    });
  });
});
