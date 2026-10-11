import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { Calendar } from './calendar';
import { UserRepository } from '../../core/repositories/user.repository';
import { PatientRepository } from '../../core/repositories/patient.repository';
import { AppointmentRepository } from '../../core/repositories/appointment.repository';
import { AuditRepository } from '../../core/repositories/audit.repository';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { NotificationService } from '../../core/services/notification.service';
import { CalendarFocusService } from '../../core/services/calendar-focus.service';
import { AppUser } from '../../core/models/user';

describe('Calendar assistant association (P06)', () => {
  const doctor = { uid: 'doctor-test', name: 'Doctor de prueba', role: 'doctor', profileComplete: true } as AppUser;
  const appointment = { id: 'appointment-test', doctorId: doctor.uid, patientId: 'child-test', date: '2026-10-08', time: '10:00', status: 'scheduled' };
  let fixture: ComponentFixture<Calendar>;
  let component: any;
  let auth: any;
  let users: any;
  let patients: any;
  let appointments: any;
  let dialog: any;
  let alert: any;
  let router: any;
  let ownerChanges: Subject<AppUser | null>;
  let sessions: BehaviorSubject<unknown>;

  beforeEach(async () => {
    ownerChanges = new Subject();
    sessions = new BehaviorSubject<unknown>(null);
    auth = {
      currentDoctor: { uid: 'assistant-test', role: 'assistant', createdBy: doctor.uid, profileComplete: true },
      session$: sessions.asObservable(), logout: vi.fn().mockResolvedValue(undefined),
      updateCurrentDoctor: vi.fn((user) => {
        auth.currentDoctor = { ...auth.currentDoctor, ...user };
        sessions.next({ type: 'doctor', user: auth.currentDoctor });
      }),
    };
    users = {
      getUser: vi.fn(async (uid) => uid === 'assistant-test' ? { ...auth.currentDoctor } : doctor),
      watchUser: vi.fn().mockReturnValue(ownerChanges),
    };
    patients = { getPatientsByDoctor: vi.fn().mockResolvedValue([{ id: 'child-test', doctorId: doctor.uid }]) };
    appointments = {
      watchAppointmentsByDoctor: vi.fn().mockReturnValue(of([appointment])),
      watchAppointmentsByUpdatedBy: vi.fn().mockReturnValue(of([appointment])),
      updateAppointment: vi.fn().mockResolvedValue(undefined),
    };
    dialog = { open: vi.fn() };
    alert = { confirm: vi.fn(), error: vi.fn(), success: vi.fn() };
    router = { navigate: vi.fn().mockResolvedValue(true) };
    TestBed.configureTestingModule({
      imports: [Calendar, NoopAnimationsModule],
      providers: [
        provideNativeDateAdapter(),
        { provide: AuthService, useValue: auth },
        { provide: UserRepository, useValue: users },
        { provide: PatientRepository, useValue: patients },
        { provide: AppointmentRepository, useValue: appointments },
        { provide: AuditRepository, useValue: { log: vi.fn() } },
        { provide: MatDialog, useValue: dialog },
        { provide: AlertService, useValue: alert },
        { provide: Router, useValue: router },
        { provide: NotificationService, useValue: { notifyAppointmentCancelled: vi.fn() } },
        { provide: CalendarFocusService, useValue: new CalendarFocusService() },
      ],
    });
    TestBed.overrideProvider(MatDialog, { useValue: dialog });
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(Calendar);
    component = fixture.componentInstance;
  });

  async function start(expectedState = 'ready') {
    fixture.detectChanges();
    await vi.waitFor(() => expect(component.assistantAccessState()).toBe(expectedState));
    if (expectedState === 'ready') await vi.waitFor(() => expect(component.configLoading()).toBe(false));
    fixture.detectChanges();
  }

  function expectNoOperations() {
    component.openSettingsDialog();
    component.openSideAppointment();
    component.editAppointment(appointment);
    void component.cancelAppointment(appointment);
    void component.deleteAppointment(appointment);
    expect(dialog.open).not.toHaveBeenCalled();
    expect(alert.confirm).not.toHaveBeenCalled();
    expect(appointments.updateAppointment).not.toHaveBeenCalled();
    expect(component.canInteractWithCell(new Date())).toBe(false);
  }

  it.each([undefined, '', '   '])('blocks an assistant without an owner (%s), with retry and logout', async (createdBy) => {
    auth.currentDoctor.createdBy = createdBy;
    await start('blocked');
    expect(users.getUser).not.toHaveBeenCalled();
    expect(patients.getPatientsByDoctor).not.toHaveBeenCalled();
    expect(appointments.watchAppointmentsByDoctor).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Tu cuenta no tiene un Doctor válido asociado.');
    expect(fixture.nativeElement.textContent).toContain('Reintentar');
    expect(fixture.nativeElement.textContent).toContain('Cerrar sesión');
    expect(fixture.nativeElement.querySelector('.calendar-toolbar')).toBeNull();
    expect(fixture.nativeElement.querySelector('.mobile-view')).toBeNull();
    expectNoOperations();
  });

  it.each([
    null,
    { ...doctor, role: 'assistant' },
    { ...doctor, role: 'admin' },
    { ...doctor, pending: true },
    { ...doctor, profileComplete: false },
    { ...doctor, profileComplete: undefined },
    { ...doctor, uid: 'different-doctor' },
  ])('rejects a nonexistent or inactive/wrong owner (%j) before reading patients or appointments', async (owner) => {
    users.getUser.mockResolvedValue(owner);
    await start('blocked');
    expect(patients.getPatientsByDoctor).not.toHaveBeenCalled();
    expect(appointments.watchAppointmentsByDoctor).not.toHaveBeenCalled();
    expectNoOperations();
  });

  it('shows verification without operational controls while the owner read is pending', async () => {
    let resolve!: (owner: AppUser) => void;
    users.getUser.mockReturnValue(new Promise<AppUser>((done) => { resolve = done; }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Verificando el Doctor asociado');
    expect(fixture.nativeElement.querySelector('.calendar-toolbar')).toBeNull();
    expectNoOperations();
    await component.retryAssistantAccess();
    expect(users.getUser).toHaveBeenCalledOnce();
    resolve(doctor);
    await vi.waitFor(() => expect(component.assistantAccessState()).toBe('ready'));
  });

  it('loads only the validated owner and keeps the normal calendar available', async () => {
    await start();
    expect(users.getUser).toHaveBeenCalledExactlyOnceWith(doctor.uid);
    expect(users.watchUser).toHaveBeenCalledWith(doctor.uid);
    expect(patients.getPatientsByDoctor).toHaveBeenCalledWith(doctor.uid);
    expect(appointments.watchAppointmentsByDoctor).toHaveBeenCalledWith(doctor.uid);
    expect(fixture.nativeElement.querySelector('.calendar-toolbar')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.mobile-view')).toBeTruthy();
  });

  it('distinguishes a failed verification and allows a successful retry', async () => {
    users.getUser.mockRejectedValueOnce(new Error('Synthetic read failure'));
    await start('error');
    expect(fixture.nativeElement.textContent).toContain('No fue posible verificar el Doctor asociado.');
    expectNoOperations();
    await component.retryAssistantAccess();
    fixture.detectChanges();
    expect(component.assistantAccessState()).toBe('ready');
    expect(component.allPatients()).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('.association-state')).toBeNull();
  });

  it('refreshes an externally corrected association on retry without writing a profile', async () => {
    auth.currentDoctor.createdBy = undefined;
    await start('blocked');
    users.getUser.mockImplementation(async (uid: string) => uid === 'assistant-test'
      ? { ...auth.currentDoctor, createdBy: doctor.uid } : doctor);
    await component.retryAssistantAccess();
    expect(auth.updateCurrentDoctor).toHaveBeenCalledWith(expect.objectContaining({ createdBy: doctor.uid }));
    expect(component.assistantAccessState()).toBe('ready');
    expect(patients.getPatientsByDoctor).toHaveBeenCalledWith(doctor.uid);
  });

  it('keeps a deleted assistant blocked when retrying', async () => {
    auth.currentDoctor.createdBy = undefined;
    await start('blocked');
    users.getUser.mockResolvedValue(null);
    await component.retryAssistantAccess();
    expect(component.assistantAccessState()).toBe('blocked');
    expect(auth.updateCurrentDoctor).not.toHaveBeenCalled();
    expect(patients.getPatientsByDoctor).not.toHaveBeenCalled();
  });

  it.each([null, { uid: 'another-assistant', role: 'assistant' }])('does not refresh another session from a pending retry (%j)', async (nextSession) => {
    auth.currentDoctor.createdBy = undefined;
    await start('blocked');
    const original = { ...auth.currentDoctor, createdBy: doctor.uid };
    let resolve!: (user: AppUser) => void;
    users.getUser.mockReturnValue(new Promise<AppUser>((done) => { resolve = done; }));
    const retry = component.retryAssistantAccess();
    auth.currentDoctor = nextSession;
    sessions.next(nextSession);
    resolve(original);
    await retry;
    expect(component.assistantAccessState()).toBe('blocked');
    expect(auth.updateCurrentDoctor).not.toHaveBeenCalled();
    expect(patients.getPatientsByDoctor).not.toHaveBeenCalled();
  });

  it('clears data and closes an open scheduling panel when the owner disappears', async () => {
    await start();
    const closed = new Subject();
    const ref = { componentInstance: { setData: vi.fn() }, afterClosed: () => closed, close: vi.fn(() => { closed.next(null); closed.complete(); }) };
    dialog.open.mockReturnValue(ref);
    component.openSideAppointment();
    expect(component.allAppointments()).toHaveLength(1);
    ownerChanges.next(null);
    fixture.detectChanges();
    expect(ref.close).toHaveBeenCalledOnce();
    expect(component.assistantAccessState()).toBe('blocked');
    expect(component.selectedDoctorId()).toBe('');
    expect(component.allPatients()).toEqual([]);
    expect(component.allAppointments()).toEqual([]);
    expect(component.selectedAppointment()).toBeNull();
    expect(fixture.nativeElement.querySelector('.mobile-view')).toBeNull();
    expect(patients.getPatientsByDoctor).toHaveBeenCalledOnce();
  });

  it('blocks after the owner listener fails and releases its subscription', async () => {
    await start();
    ownerChanges.error(new Error('Synthetic denied listener'));
    fixture.detectChanges();
    expect(component.assistantAccessState()).toBe('error');
    expect(component.allAppointments()).toEqual([]);
    expectNoOperations();
  });

  it('does not restore patients from an in-flight read after owner invalidation', async () => {
    let resolve!: (items: unknown[]) => void;
    patients.getPatientsByDoctor.mockReturnValue(new Promise((done) => { resolve = done; }));
    fixture.detectChanges();
    await vi.waitFor(() => expect(users.watchUser).toHaveBeenCalled());
    ownerChanges.next(null);
    resolve([{ id: 'child-test', doctorId: doctor.uid }]);
    await vi.waitFor(() => expect(component.configLoading()).toBe(false));
    expect(component.allPatients()).toEqual([]);
    expect(appointments.watchAppointmentsByDoctor).not.toHaveBeenCalled();
    expect(component.assistantAccessState()).toBe('blocked');
  });

  it('prevents cancellation confirmed after the association was invalidated', async () => {
    await start();
    const confirmed = new Subject<boolean>();
    const close = vi.fn();
    alert.confirm.mockReturnValue({ afterClosed: () => confirmed, close });
    const pending = component.cancelAppointment(appointment);
    ownerChanges.next(null);
    expect(close).toHaveBeenCalledOnce();
    confirmed.next(true);
    confirmed.complete();
    await pending;
    expect(appointments.updateAppointment).not.toHaveBeenCalled();
  });

  it('withdraws the calendar on a session/association change', async () => {
    await start();
    auth.currentDoctor = { ...auth.currentDoctor, createdBy: 'another-doctor' };
    sessions.next({ type: 'doctor', user: auth.currentDoctor });
    fixture.detectChanges();
    expect(component.assistantAccessState()).toBe('blocked');
    expect(component.allAppointments()).toEqual([]);
    expect(fixture.nativeElement.querySelector('.calendar-toolbar')).toBeNull();
    expectNoOperations();
  });

  it('waits for sign-out before navigating and reports a failed sign-out', async () => {
    auth.currentDoctor.createdBy = undefined;
    await start('blocked');
    auth.logout.mockRejectedValueOnce(new Error('Synthetic sign-out error'));
    await component.logoutAssistant();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(alert.error).toHaveBeenCalledWith(expect.objectContaining({ message: 'No fue posible cerrar sesión. Intenta nuevamente.' }));
    expect(component.signingOut()).toBe(false);
    await component.logoutAssistant();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('unsubscribes owner/session listeners when destroyed', async () => {
    await start();
    fixture.destroy();
    expect(ownerChanges.observed).toBe(false);
    expect(sessions.observed).toBe(false);
  });

  it('ignores a pending owner result after the view is destroyed', async () => {
    let resolve!: (owner: AppUser) => void;
    users.getUser.mockReturnValue(new Promise<AppUser>((done) => { resolve = done; }));
    fixture.detectChanges();
    fixture.destroy();
    resolve(doctor);
    await Promise.resolve();
    expect(users.watchUser).not.toHaveBeenCalled();
    expect(patients.getPatientsByDoctor).not.toHaveBeenCalled();
    expect(appointments.watchAppointmentsByDoctor).not.toHaveBeenCalled();
  });
});
