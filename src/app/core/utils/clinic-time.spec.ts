import { clinicTimeAt, clinicTodayDate, todayClinicDateString } from './clinic-time';
import { dateStringToLocalDate, dateToString } from './date-utils';

describe('clinic time (P28)', () => {
  it.each([
    ['2026-10-10T05:59:59Z', '2026-10-09', 1439],
    ['2026-10-10T06:00:00Z', '2026-10-10', 0],
    ['2026-01-10T16:15:00Z', '2026-01-10', 615],
    ['2026-07-10T16:15:00Z', '2026-07-10', 615],
  ])('uses Mexico City civil time for %s', (instant, date, minutes) => {
    expect(clinicTimeAt(new Date(instant))).toEqual({ date, minutes });
  });

  it('gives the same clinic time for the same instant expressed in different offsets', () => {
    expect(clinicTimeAt(new Date('2026-10-10T14:15:00+09:00')))
      .toEqual(clinicTimeAt(new Date('2026-10-09T22:15:00-07:00')));
  });

  it('provides a civil Date for pickers without shifting a selected day', () => {
    const instant = new Date('2026-10-10T05:30:00Z');
    expect(todayClinicDateString(instant)).toBe('2026-10-09');
    expect(dateToString(clinicTodayDate(instant))).toBe('2026-10-09');
    expect(dateToString(dateStringToLocalDate('2026-10-10'))).toBe('2026-10-10');
  });
});
