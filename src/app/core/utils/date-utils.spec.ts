import {
  dateStringToLocalDate,
  dateToString,
  formatLocalDate,
  localDateStringToTime,
  todayLocalDateString,
} from './date-utils';

describe('date-utils', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps a datepicker Date as the same local civil date', () => {
    expect(dateToString(new Date(2026, 7, 18))).toBe('2026-08-18');
  });

  it('normalizes legacy Timestamp-like values through their local Date', () => {
    const timestamp = { toDate: () => new Date(2026, 0, 15) };
    expect(dateToString(timestamp)).toBe('2026-01-15');
  });

  it('creates local Date objects from YYYY-MM-DD strings', () => {
    const date = dateStringToLocalDate('2026-08-18');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(7);
    expect(date.getDate()).toBe(18);
  });

  it('formats civil dates without DatePipe conversion', () => {
    expect(formatLocalDate('2026-08-18')).toBe('18/08/2026');
  });

  it('uses the local day for todayLocalDateString', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 18, 23, 30));
    expect(todayLocalDateString()).toBe('2026-08-18');
  });

  it('compares civil dates at local midnight', () => {
    expect(localDateStringToTime('2026-08-19')).toBeGreaterThan(
      localDateStringToTime('2026-08-18')
    );
  });
});
