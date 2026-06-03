import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { AlertService } from './alert.service';
import { AlertDialog } from '../../shared/components/alert-dialog/alert-dialog';

describe('AlertService', () => {
  let service: AlertService;
  let dialog: { open: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    dialog = { open: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        AlertService,
        { provide: MatDialog, useValue: dialog },
      ],
    });

    service = TestBed.inject(AlertService);

    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    service.clear();
  });

  function getAlerts() {
    return service.alerts();
  }

  describe('success', () => {
    it('adds a success alert', () => {
      service.success({ message: 'OK' });
      expect(getAlerts().length).toBe(1);
      expect(getAlerts()[0].message).toBe('OK');
      expect(getAlerts()[0].type).toBe('success');
    });

    it('uses default duration of 5000', () => {
      service.success({ message: 'OK' });
      expect(getAlerts()[0].duration).toBe(5000);
    });

    it('respects custom duration', () => {
      service.success({ message: 'OK', duration: 3000 });
      expect(getAlerts()[0].duration).toBe(3000);
    });

    it('includes title when provided', () => {
      service.success({ message: 'OK', title: 'Hecho' });
      expect(getAlerts()[0].title).toBe('Hecho');
    });
  });

  describe('error', () => {
    it('adds an error alert', () => {
      service.error({ message: 'Fail' });
      expect(getAlerts().length).toBe(1);
      expect(getAlerts()[0].message).toBe('Fail');
      expect(getAlerts()[0].type).toBe('error');
    });
  });

  describe('dismiss', () => {
    it('removes an alert by id', () => {
      service.success({ message: 'A' });
      const id = getAlerts()[0].id;
      service.dismiss(id);
      expect(getAlerts().length).toBe(0);
    });

    it('does nothing for unknown id', () => {
      service.success({ message: 'A' });
      service.dismiss('non-existent');
      expect(getAlerts().length).toBe(1);
    });
  });

  describe('max alerts cap', () => {
    it('keeps at most 5 alerts', () => {
      for (let i = 0; i < 7; i++) {
        service.success({ message: `Alert ${i}` });
      }
      expect(getAlerts().length).toBe(5);
    });

    it('keeps the last 5 alerts', () => {
      for (let i = 0; i < 7; i++) {
        service.success({ message: `Alert ${i}` });
      }
      const messages = getAlerts().map((a) => a.message);
      expect(messages).toEqual([
        'Alert 2',
        'Alert 3',
        'Alert 4',
        'Alert 5',
        'Alert 6',
      ]);
    });
  });

  describe('auto-dismiss with timers', () => {
    it('removes alert after duration', () => {
      service.success({ message: 'Timed', duration: 1000 });
      expect(getAlerts().length).toBe(1);

      vi.advanceTimersByTime(1000);

      expect(getAlerts().length).toBe(0);
    });

    it('dismiss clears the timer', () => {
      service.success({ message: 'Timed', duration: 5000 });
      service.dismiss(getAlerts()[0].id);

      vi.advanceTimersByTime(5000);
      expect(getAlerts().length).toBe(0);
    });

    it('does not set timer when duration is 0', () => {
      service.success({ message: 'Sticky', duration: 0 });
      expect(getAlerts().length).toBe(1);

      vi.advanceTimersByTime(99999);
      expect(getAlerts().length).toBe(1);
    });
  });

  describe('clear', () => {
    it('removes all alerts and clears timers', () => {
      service.success({ message: 'A' });
      service.error({ message: 'B' });
      service.clear();

      expect(getAlerts().length).toBe(0);
    });
  });

  describe('confirm', () => {
    it('opens MatDialog with AlertDialog', () => {
      const dialogRefSpy = { afterClosed: vi.fn() };
      dialog.open.mockReturnValue(dialogRefSpy);

      const result = service.confirm({
        title: 'Confirm',
        message: 'Sure?',
      });

      expect(dialog.open).toHaveBeenCalledWith(AlertDialog, {
        width: '400px',
        disableClose: true,
        data: { title: 'Confirm', message: 'Sure?' },
      });
    });
  });
});
