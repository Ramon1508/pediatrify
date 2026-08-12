import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { MatDialogRef } from '@angular/material/dialog';
import { NotificationsDialog } from './notifications-dialog';
import { NotificationRepository } from '../../../core/repositories/notification.repository';
import { AppointmentRepository } from '../../../core/repositories/appointment.repository';
import { AuthService } from '../../../core/services/auth.service';
import { Router } from '@angular/router';
import { CalendarFocusService } from '../../../core/services/calendar-focus.service';
import { AppNotification } from '../../../core/models/notification';

describe('NotificationsDialog', () => {
  let fixture: ComponentFixture<NotificationsDialog>;
  let component: any;
  let dialogRef: any;
  let repoMock: {
    watchForRecipient: ReturnType<typeof vi.fn>;
    markRead: ReturnType<typeof vi.fn>;
  };
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
    recipientIds: ['doc1', 'a1', 'p1'],
    recipients: [
      { recipientId: 'doc1', recipientType: 'doctor', read: false },
      { recipientId: 'a1', recipientType: 'assistant', read: false },
      { recipientId: 'p1', recipientType: 'patient', read: false },
    ],
  };

  function createFixture(
    list: AppNotification[],
    options: { appointments?: any[]; doctor?: any } = {}
  ) {
    repoMock = {
      watchForRecipient: vi.fn().mockReturnValue(of(list)),
      markRead: vi.fn().mockResolvedValue(undefined),
    };
    appointmentRepoMock = { getAppointment: vi.fn() };
    if (options.appointments) {
      for (const val of options.appointments) {
        appointmentRepoMock.getAppointment.mockResolvedValueOnce(val);
      }
    }
    const routerMock = { navigate: vi.fn() };
    const focusMock = new CalendarFocusService();
    dialogRef = { close: vi.fn() } as any;

    TestBed.configureTestingModule({
      imports: [NotificationsDialog, NoopAnimationsModule],
      providers: [
        { provide: NotificationRepository, useValue: repoMock },
        { provide: AppointmentRepository, useValue: appointmentRepoMock },
        { provide: AuthService, useValue: { currentDoctor: options.doctor ?? { uid: 'doc1', role: 'doctor' }, currentPatient: null } },
        { provide: Router, useValue: routerMock },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: CalendarFocusService, useValue: focusMock },
      ],
    });

    fixture = TestBed.createComponent(NotificationsDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
    return { router: routerMock, focus: focusMock };
  }

  it('shows the empty state when there are no notifications', () => {
    createFixture([]);
    expect(fixture.nativeElement.textContent).toContain('Aún no tienes notificaciones.');
  });

  it('lists notifications without marking them as read on open', () => {
    const list = [baseNotification];
    createFixture(list);
    expect(fixture.nativeElement.textContent).toContain('Consulta agendada');
    expect(fixture.nativeElement.textContent).toContain('Ana Rangel');
    expect(repoMock.markRead).not.toHaveBeenCalled();
  });

  it('shows only unread items when the filter is set to unread', () => {
    const readOne: AppNotification = { ...baseNotification, id: 'n1', recipients: [{ recipientId: 'doc1', recipientType: 'doctor', read: true }] };
    const unreadOne = { ...baseNotification, id: 'n2' };
    createFixture([unreadOne, readOne]);
    component.filterMode.set('unread');
    fixture.detectChanges();
    const titles = Array.from(fixture.nativeElement.querySelectorAll('.notif-item-title')).map((el: any) => el.textContent);
    expect(titles).toEqual(['Consulta agendada']);
  });

  it('reveals "Ver detalles" only when the appointment still exists', async () => {
    createFixture(
      [
        baseNotification,
        { ...baseNotification, id: 'nDel', appointmentId: 'apt-del', recipients: [{ recipientId: 'doc1', recipientType: 'doctor', read: true }] },
      ],
      { appointments: [{ id: 'apt1', patientId: 'p1', disabled: false }, null] }
    );
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();

    const buttons = Array.from(fixture.nativeElement.querySelectorAll('.notif-details-btn')) as HTMLElement[];
    expect(buttons.length).toBe(1);
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
    expect(repoMock.markRead).toHaveBeenCalledWith('n1', 'doc1');
    expect(focus.peek()).toEqual({ date: '2026-08-08', time: '10:00', appointmentId: 'apt1' });
    expect(router.navigate).toHaveBeenCalledWith(['/app/calendar']);
    expect(dialogRef.close).toHaveBeenCalled();
  });

  it('shows the empty state and does not mark anything read for admin users', () => {
    createFixture([baseNotification], { doctor: { uid: 'admin1', role: 'admin' } });
    expect(fixture.nativeElement.textContent).toContain('Aún no tienes notificaciones.');
    expect(repoMock.markRead).not.toHaveBeenCalled();
  });

  it('closes the dialog', () => {
    createFixture([]);
    component.close();
    expect(dialogRef.close).toHaveBeenCalled();
  });
});