import { TestBed } from '@angular/core/testing';
import { ClinicClockService } from './clinic-clock.service';

describe('ClinicClockService (P28)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-10T05:59:45Z'));
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('advances the clinic day at the minute boundary without a Firestore update', () => {
    const clock = TestBed.inject(ClinicClockService);
    expect(clock.now()).toEqual({ date: '2026-10-09', minutes: 1439 });
    vi.advanceTimersByTime(14_999);
    expect(clock.now().date).toBe('2026-10-09');
    vi.advanceTimersByTime(1);
    expect(clock.now()).toEqual({ date: '2026-10-10', minutes: 0 });
    vi.advanceTimersByTime(60_000);
    expect(clock.now().minutes).toBe(1);
  });

  it.each(['visibilitychange', 'focus'])('refreshes a resumed page on %s', event => {
    const clock = TestBed.inject(ClinicClockService);
    vi.setSystemTime(new Date('2026-10-10T16:30:00Z'));
    (event === 'focus' ? window : document).dispatchEvent(new Event(event));
    expect(clock.now()).toEqual({ date: '2026-10-10', minutes: 630 });
  });

  it('removes the timer and resume listeners when its injector is destroyed', () => {
    const clock = TestBed.inject(ClinicClockService);
    const last = clock.now();
    TestBed.resetTestingModule();
    vi.advanceTimersByTime(120_000);
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
    expect(clock.now()).toEqual(last);
    expect(vi.getTimerCount()).toBe(0);
  });
});
