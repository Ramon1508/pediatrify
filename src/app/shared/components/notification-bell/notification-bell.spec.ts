import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { signal } from '@angular/core';
import { NotificationBell } from './notification-bell';
import { NotificationService } from '../../../core/services/notification.service';
import { NotificationsDialog } from '../notifications-dialog/notifications-dialog';

describe('NotificationBell', () => {
  let fixture: ComponentFixture<NotificationBell>;
  let component: any;
  let serviceMock: any;

  function createFixture(options: { unread?: number; recipient?: string | null } = {}) {
    const unread = options.unread ?? 0;
    const recipient = options.recipient === undefined ? 'doc1' : options.recipient;
    serviceMock = {
      unreadCount: signal(unread),
      recipientId: signal(recipient),
    };
    const dialogSpy = { open: vi.fn() } as any;

    TestBed.configureTestingModule({
      imports: [NotificationBell, NoopAnimationsModule],
      providers: [
        { provide: NotificationService, useValue: serviceMock },
        { provide: MatDialog, useValue: dialogSpy },
      ],
    });

    fixture = TestBed.createComponent(NotificationBell);
    component = fixture.componentInstance;
    fixture.detectChanges();
    return { dialogSpy, serviceMock };
  }

  it('hides the bell entirely for admin users (null recipient)', () => {
    createFixture({ recipient: null });
    const bell = fixture.nativeElement.querySelector('button[aria-label="Abrir notificaciones"]');
    expect(bell).toBeNull();
    expect(component.unreadCount()).toBe(0);
  });

  it('hides the badge when there are no unread notifications', () => {
    createFixture({ unread: 0 });
    const badge = fixture.nativeElement.querySelector('.notification-badge');
    expect(badge).toBeNull();
  });

  it('shows the unread count on the badge', () => {
    createFixture({ unread: 3 });
    const badge = fixture.nativeElement.querySelector('.notification-badge');
    expect(badge).toBeTruthy();
    expect(badge.textContent).toBe('3');
  });

  it('reacts when the global unread count changes', () => {
    const { serviceMock } = createFixture({ unread: 1 });
    expect(component.unreadCount()).toBe(1);
    serviceMock.unreadCount.set(27);
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('.notification-badge');
    expect(badge.textContent).toBe('27');
  });

  it('opens the notifications dialog on click', () => {
    const { dialogSpy } = createFixture({ unread: 1 });
    const bell = fixture.nativeElement.querySelector('button[aria-label="Abrir notificaciones"]');
    bell.click();
    expect(dialogSpy.open).toHaveBeenCalledWith(NotificationsDialog, expect.objectContaining({
      panelClass: 'notif-panel',
    }));
  });
});
