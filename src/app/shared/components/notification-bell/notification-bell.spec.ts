import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { of, BehaviorSubject } from 'rxjs';
import { NotificationBell } from './notification-bell';
import { NotificationRepository } from '../../../core/repositories/notification.repository';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationsDialog } from '../notifications-dialog/notifications-dialog';
import { AppNotification } from '../../../core/models/notification';

describe('NotificationBell', () => {
let fixture: ComponentFixture<NotificationBell>;
  let component: any;

  const unread: AppNotification = {
    id: 'n1',
    type: 'appointment-cancelled',
    title: 'Consulta cancelada',
    description: 'Ana Rangel canceló su consulta programada para el 08/08/2026 a las 10:00.',
    appointmentId: 'apt1',
    createdAt: new Date(),
    originatorId: 'doc2',
    originatorName: 'Otro',
    recipientIds: ['doc1'],
    recipients: [{ recipientId: 'doc1', recipientType: 'doctor', read: false }],
  };

  const readOne: AppNotification = {
    ...unread,
    id: 'n2',
    recipients: [{ recipientId: 'doc1', recipientType: 'doctor', read: true }],
  };

function createFixture(list: AppNotification[], options: { doctor?: any; patient?: any } = {}) {
    const doctor = 'doctor' in options ? (options.doctor ?? null) : { uid: 'doc1', role: 'doctor' } as any;
    const patient = options.patient ?? null as any;
    const session = new BehaviorSubject<any>(
      doctor ? { type: 'doctor', user: doctor } : patient ? { type: 'patient', patient } : null
    );
    const authSpy = {
      get currentDoctor() {
        const s = session.value;
        return s?.type === 'doctor' ? s.user : null;
      },
      get currentPatient() {
        const s = session.value;
        return s?.type === 'patient' ? s.patient : null;
      },
      session$: session.asObservable(),
    } as any;
    const dialogSpy = { open: vi.fn() } as any;

    TestBed.configureTestingModule({
      imports: [NotificationBell, NoopAnimationsModule],
      providers: [
        { provide: AuthService, useValue: authSpy },
        { provide: MatDialog, useValue: dialogSpy },
        { provide: NotificationRepository, useValue: { watchForRecipient: vi.fn().mockReturnValue(of(list)) } },
      ],
    });

    fixture = TestBed.createComponent(NotificationBell);
    component = fixture.componentInstance;
    fixture.detectChanges();
    return { dialogSpy, session };
  }

  it('hides the bell entirely for admin users', () => {
    createFixture([unread], { doctor: { uid: 'admin1', role: 'admin' } });
    const bell = fixture.nativeElement.querySelector('button[aria-label="Abrir notificaciones"]');
    expect(bell).toBeNull();
    expect(component.unreadCount()).toBe(0);
  });

it('hides the badge when there are no unread notifications', () => {
    createFixture([readOne]);
    expect(component.unreadCount()).toBe(0);
    const badge = fixture.nativeElement.querySelector('.notification-badge');
    expect(badge).toBeNull();
  });

it('shows the unread count on the badge', () => {
    createFixture([unread, readOne]);
    expect(component.unreadCount()).toBe(1);
    const badge = fixture.nativeElement.querySelector('.notification-badge');
    expect(badge).toBeTruthy();
    expect(badge.textContent).toBe('1');
  });

it('opens the notifications dialog on click', () => {
    const { dialogSpy } = createFixture([unread]);
    const bell = fixture.nativeElement.querySelector('button[aria-label="Abrir notificaciones"]');
    bell.click();
    expect(dialogSpy.open).toHaveBeenCalledWith(NotificationsDialog, expect.objectContaining({
      panelClass: 'notif-panel',
    }));
  });

  it('subscribes and shows the badge when the session arrives late', () => {
    const { session } = createFixture([unread], { doctor: null });
    expect(component.unreadCount()).toBe(0);

    session.next({ type: 'doctor', user: { uid: 'doc1', role: 'doctor' } });
    fixture.detectChanges();

    expect(component.unreadCount()).toBe(1);
    const badge = fixture.nativeElement.querySelector('.notification-badge');
    expect(badge).toBeTruthy();
    expect(badge.textContent).toBe('1');
  });
});
