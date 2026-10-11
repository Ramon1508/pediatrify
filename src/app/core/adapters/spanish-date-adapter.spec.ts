import { TestBed } from '@angular/core/testing';
import { DateAdapter, MAT_DATE_LOCALE } from '@angular/material/core';
import { SpanishDateAdapter } from './spanish-date-adapter';
import { dateToString } from '../utils/date-utils';

describe('SpanishDateAdapter clinic day (P28)', () => {
  afterEach(() => vi.useRealTimers());

  it('highlights the clinic day while preserving parsed and deserialized civil dates', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-10T05:30:00Z'));
    TestBed.configureTestingModule({ providers: [
      { provide: MAT_DATE_LOCALE, useValue: 'es-MX' },
      { provide: DateAdapter, useClass: SpanishDateAdapter },
    ] });
    const adapter = TestBed.inject(DateAdapter);
    expect(dateToString(adapter.today())).toBe('2026-10-09');
    expect(dateToString(adapter.parse('2020-01-15', null))).toBe('2020-01-15');
    expect(dateToString(adapter.deserialize('2026-10-10'))).toBe('2026-10-10');
    expect(adapter.getFirstDayOfWeek()).toBe(0);
  });
});
