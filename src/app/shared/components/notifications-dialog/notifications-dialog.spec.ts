import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { of, Subject } from 'rxjs';
import { MatDialogRef } from '@angular/material/dialog';
import { NotificationsDialog } from './notifications-dialog';
import { NotificationService } from '../../../core/services/notification.service';
import { AppointmentRepository } from '../../../core/repositories/appointment.repository';
import { Router } from '@angular/router';
import { CalendarFocusService } from '../../../core/services/calendar-focus.service';
import { AppNotification } from '../../../core/models/notification';

describe('NotificationsDialog', () => {
  let fixture: ComponentFixture<NotificationsDialog>;
  let component: any;
  let dialogRef: any;
  let close$: Subject<void>;
  let serviceMock: any;
  let appointmentRepoMock: { getAppointment: ReturnType<typeof vi.fn> };

  const baseNotification: AppNotification = {
    id: 'n1',
    type: 'appointment-created',
    title: 'Consulta agendada',
    description: 'Nueva consulta agendada con Ana Rangel para el 08/08/2026 a las 10:00.',
    appointmentId: 'apt1',
    createdAt: new Date(),
    originatorId: 'doc1',
    originatorName: 'Dr. Uno',
    recipientId: 'doc1',
    recipientType: 'doctor',
    read: false,
  };

  function createFixture(
    list: AppNotification[],
    options: {
      appointments?: any[];
      recipient?: string | null;
      initialLoading?: boolean;
      getAppointment?: (id: string) => any;
    } = {}
  ) {
    const recipient = options.recipient ?? 'doc1';
    serviceMock = {
      notifications: signal(list),
      activeFilter: signal<'all' | 'unread'>('all'),
      isInitialLoading: signal(options.initialLoading ?? false),
      isLoadingMore: signal(false),
      hasMore: signal(true),
      recipientId: signal(recipient),
      loadFirstPage: vi.fn().mockResolvedValue(undefined),
      loadMore: vi.fn().mockResolvedValue(undefined),
      setFilter: vi.fn().mockResolvedValue(undefined),
      markAsRead: vi.fn().mockResolvedValue(undefined),
      markCancelledRead: vi.fn().mockResolvedValue(undefined),
      refreshUnreadCount: vi.fn().mockResolvedValue(undefined),
    };
    appointmentRepoMock = { getAppointment: vi.fn() };
    if (options.getAppointment) {
      appointmentRepoMock.getAppointment.mockImplementation(options.getAppointment);
    } else if (options.appointments) {
      for (const val of options.appointments) {
        appointmentRepoMock.getAppointment.mockResolvedValueOnce(val);
      }
    }
    const routerMock = { navigate: vi.fn() };
    const focusMock = new CalendarFocusService();
    close$ = new Subject<void>();
    dialogRef = {
      close: vi.fn(() => close$.next()),
      afterClosed: () => close$.asObservable(),
    } as any;

    TestBed.configureTestingModule({
      imports: [NotificationsDialog, NoopAnimationsModule],
      providers: [
        { provide: NotificationService, useValue: serviceMock },
        { provide: AppointmentRepository, useValue: appointmentRepoMock },
        { provide: Router, useValue: routerMock },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: CalendarFocusService, useValue: focusMock },
      ],
    });

    fixture = TestBed.createComponent(NotificationsDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
    return { router: routerMock, focus: focusMock, serviceMock };
  }

  it('shows the empty state when there are no notifications', () => {
    createFixture([]);
    expect(fixture.nativeElement.textContent).toContain('Aún no tienes notificaciones.');
  });

  it('shows skeleton items while initial loading is in progress', () => {
    createFixture([], { initialLoading: true });
    expect(fixture.nativeElement.querySelector('.notif-skeleton')).toBeTruthy();
    expect(fixture.nativeElement.textContent).not.toContain('Aún no tienes notificaciones.');
  });

  it('lists notifications without marking them as read on open', () => {
    const list = [baseNotification];
    createFixture(list);
    expect(fixture.nativeElement.textContent).toContain('Consulta agendada');
    expect(fixture.nativeElement.textContent).toContain('Ana Rangel');
    expect(serviceMock.markAsRead).not.toHaveBeenCalled();
    expect(serviceMock.loadFirstPage).not.toHaveBeenCalled();
  });

  it('requests the first page when the dialog opens with an empty unloaded cache', () => {
    createFixture([], { recipient: 'doc1' });
    expect(serviceMock.loadFirstPage).toHaveBeenCalled();
  });

  it('renders only what the service provides for the active filter', () => {
    const readOne: AppNotification = { ...baseNotification, id: 'n1', read: true };
    const { serviceMock } = createFixture([readOne]);
    serviceMock.notifications.set([readOne]);
    fixture.detectChanges();
    const titles = Array.from(fixture.nativeElement.querySelectorAll('.notif-item-title')).map((el: any) => el.textContent);
    expect(titles).toEqual(['Consulta agendada']);
  });

  it('delegates filter changes to the service without marking read', async () => {
    createFixture([baseNotification]);
    component.setFilter('unread');
    expect(serviceMock.setFilter).toHaveBeenCalledWith('unread');
    expect(serviceMock.markAsRead).not.toHaveBeenCalled();
  });

  it('triggers loadMore when scrolling near the bottom', () => {
    createFixture([baseNotification]);
    const el = fixture.nativeElement.querySelector('.notifications-list') as HTMLElement;
    Object.defineProperty(el, 'scrollHeight', { value: 1000 });
    Object.defineProperty(el, 'scrollTop', { value: 900 });
    Object.defineProperty(el, 'clientHeight', { value: 100 });
    component.onScroll({ target: el } as unknown as Event);
    expect(serviceMock.loadMore).toHaveBeenCalled();
  });

  it('does not trigger loadMore when far from the bottom', async () => {
    createFixture([baseNotification]);
    const el = fixture.nativeElement.querySelector('.notifications-list') as HTMLElement;
    Object.defineProperty(el, 'scrollHeight', { value: 1000 });
    Object.defineProperty(el, 'scrollTop', { value: 10 });
    Object.defineProperty(el, 'clientHeight', { value: 100 });
    component.onScroll({ target: el } as unknown as Event);
    await new Promise((r) => setTimeout(r, 0));
    expect(serviceMock.loadMore).not.toHaveBeenCalled();
  });

  it('auto-loads more when the list does not fill the container', async () => {
    createFixture([baseNotification]);
    const el = fixture.nativeElement.querySelector('.notifications-list') as HTMLElement;
    Object.defineProperty(el, 'scrollHeight', { value: 120 });
    Object.defineProperty(el, 'scrollTop', { value: 0 });
    Object.defineProperty(el, 'clientHeight', { value: 200 });
    serviceMock.hasMore.set(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(serviceMock.loadMore).toHaveBeenCalled();
  });

  it('marks cancelled notifications as read when the dialog closes', async () => {
    const cancelled: AppNotification = {
      ...baseNotification,
      id: 'nCanc',
      type: 'appointment-cancelled',
    };
    createFixture([baseNotification, cancelled]);
    component.close();
    expect(dialogRef.close).toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 0));
    expect(serviceMock.markCancelledRead).toHaveBeenCalled();
  });

  it('marks cancelled notifications as read on ESC / backdrop close (afterClosed path)', async () => {
    const cancelled: AppNotification = {
      ...baseNotification,
      id: 'nCanc',
      type: 'appointment-cancelled',
    };
    createFixture([baseNotification, cancelled]);
    expect(serviceMock.markCancelledRead).not.toHaveBeenCalled();
    dialogRef.close(); // simulate ESC / backdrop click calling dialogRef.close() directly
    await new Promise((r) => setTimeout(r, 0));
    expect(serviceMock.markCancelledRead).toHaveBeenCalled();
  });

  it('does not mark anything read before the dialog is closed', () => {
    const cancelled: AppNotification = {
      ...baseNotification,
      id: 'nCanc',
      type: 'appointment-cancelled',
    };
    createFixture([baseNotification, cancelled]);
    expect(serviceMock.markAsRead).not.toHaveBeenCalled();
    expect(serviceMock.markCancelledRead).not.toHaveBeenCalled();
  });

  it('reveals "Ver detalles" only when the appointment still exists', async () => {
    createFixture(
      [
        baseNotification,
        { ...baseNotification, id: 'nDel', appointmentId: 'apt-del', read: true },
      ],
      { appointments: [{ id: 'apt1', patientId: 'p1', disabled: false }, null] }
    );
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();

    const buttons = Array.from(fixture.nativeElement.querySelectorAll('.notif-details-btn')) as HTMLElement[];
    expect(buttons.length).toBe(1);
  });

  it('reveals "Ver detalles" immediately, without waiting for the appointment fetch', async () => {
    let resolveApt1: (v: any) => void = () => {};
    const pending = new Promise((r) => (resolveApt1 = r));
    createFixture(
      [
        baseNotification,
        { ...baseNotification, id: 'nDel', appointmentId: 'apt-del' },
      ],
      { getAppointment: (id: string) => (id === 'apt1' ? pending : Promise.resolve(null)) }
    );
    expect(fixture.nativeElement.querySelectorAll('.notif-details-btn').length).toBe(2);

    resolveApt1({ id: 'apt1', patientId: 'p1', disabled: false });
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('.notif-details-btn')) as HTMLElement[];
    expect(buttons.length).toBe(1);
  });

  it('resolves the appointment on demand when clicking details before it was fetched', async () => {
    const { router, focus } = createFixture(
      [baseNotification],
      { getAppointment: (id: string) => Promise.resolve({ id, patientId: 'p1', date: '2026-08-08', time: '10:00', disabled: false }) }
    );
    expect(appointmentRepoMock.getAppointment).toHaveBeenCalledWith('apt1');
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();

    await component.openDetails(baseNotification);
    expect(serviceMock.markAsRead).toHaveBeenCalledWith('n1');
    expect(focus.peek()).toEqual({ date: '2026-08-08', time: '10:00', appointmentId: 'apt1' });
    expect(router.navigate).toHaveBeenCalledWith(['/app/calendar']);
    expect(dialogRef.close).toHaveBeenCalled();
    expect(appointmentRepoMock.getAppointment).toHaveBeenCalledTimes(1);
  });

  it('does not reveal "Ver detalles" for cancelled notifications', async () => {
    createFixture(
      [
        baseNotification,
        { ...baseNotification, id: 'nCancel', type: 'appointment-cancelled', appointmentId: 'apt1' },
      ],
      { appointments: [{ id: 'apt1', patientId: 'p1', disabled: false }] }
    );
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();

    const buttons = Array.from(fixture.nativeElement.querySelectorAll('.notif-details-btn')) as HTMLElement[];
    expect(buttons.length).toBe(1);
    const item = (Array.from(fixture.nativeElement.querySelectorAll('.notif-item'))[1] as HTMLElement | undefined);
    expect(item?.textContent).not.toContain('Ver detalles');
  });

  it('marks the notification read, sets the focus service and navigates to calendar when opening details', async () => {
    const { router, focus } = createFixture(
      [baseNotification],
      { appointments: [{ id: 'apt1', patientId: 'p1', date: '2026-08-08', time: '10:00', disabled: false }] }
    );
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();

    await component.openDetails(baseNotification);
    expect(serviceMock.markAsRead).toHaveBeenCalledWith('n1');
    expect(focus.peek()).toEqual({ date: '2026-08-08', time: '10:00', appointmentId: 'apt1' });
    expect(router.navigate).toHaveBeenCalledWith(['/app/calendar']);
    expect(dialogRef.close).toHaveBeenCalled();
  });

  it('resolves the appointment on demand when clicking details before the fetch resolved', async () => {
    let resolveApt1: (v: any) => void = () => {};
    const pending = new Promise((r) => (resolveApt1 = r));
    const { router, focus } = createFixture(
      [baseNotification],
      { getAppointment: (id: string) => pending }
    );

    const opening = component.openDetails(baseNotification);
    expect(appointmentRepoMock.getAppointment).toHaveBeenCalledWith('apt1');
    expect(appointmentRepoMock.getAppointment).toHaveBeenCalledTimes(1);

    resolveApt1({ id: 'apt1', patientId: 'p1', date: '2026-08-08', time: '10:00', disabled: false });
    await opening;
    expect(serviceMock.markAsRead).toHaveBeenCalledWith('n1');
    expect(focus.peek()).toEqual({ date: '2026-08-08', time: '10:00', appointmentId: 'apt1' });
    expect(router.navigate).toHaveBeenCalledWith(['/app/calendar']);
    expect(dialogRef.close).toHaveBeenCalled();
    expect(appointmentRepoMock.getAppointment).toHaveBeenCalledTimes(1);
  });

  it('shows the empty state and does not mark anything read when there is no recipient', () => {
    createFixture([], { recipient: null });
    expect(fixture.nativeElement.textContent).toContain('Aún no tienes notificaciones.');
    expect(serviceMock.markAsRead).not.toHaveBeenCalled();
  });

  it('closes the dialog', () => {
    createFixture([]);
    component.close();
    expect(dialogRef.close).toHaveBeenCalled();
  });
});
