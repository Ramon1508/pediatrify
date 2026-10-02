import {
  buildSlots,
  futureSlotsForDate,
  isDateSelectable,
  segmentsForDate,
  weekdayShortOf,
} from './availability';
import { TimeSegment } from '../models/user';

const D = (y: number, m: number, d: number, h = 0, min = 0): Date =>
  new Date(y, m - 1, d, h, min, 0, 0);

const seg = (startTime: string, endTime: string): TimeSegment => ({ startTime, endTime });

describe('availability utils', () => {
  // now = 10 de junio de 2026, 10:00 (hora local)
  const now = D(2026, 6, 10, 10, 0);
  const todayKey = weekdayShortOf(now);
  const byDay: Record<string, TimeSegment[]> = { [todayKey]: [seg('09:00', '13:00')] };

  describe('weekdayShortOf / segmentsForDate', () => {
    it('maps a date to its weekday key', () => {
      expect(weekdayShortOf(now)).toBe(todayKey);
    });

    it('returns the configured segments for the date weekday', () => {
      expect(segmentsForDate(byDay, now)).toEqual([seg('09:00', '13:00')]);
    });

    it('returns empty when the weekday has no segments', () => {
      expect(segmentsForDate(byDay, D(2026, 6, 11))).toEqual([]);
    });
  });

  describe('buildSlots', () => {
    it('builds slots within the segment by duration', () => {
      expect(buildSlots([seg('09:00', '11:00')], 30)).toEqual(['09:00', '09:30', '10:00', '10:30']);
    });

    it('treats 00:00 end as midnight', () => {
      const slots = buildSlots([seg('22:00', '00:00')], 60);
      expect(slots).toEqual(['22:00', '23:00']);
    });
  });

  describe('isDateSelectable', () => {
    it('past date → not selectable', () => {
      expect(isDateSelectable(byDay, D(2026, 6, 9), 30, now)).toBe(false);
    });

    it('today with past and future hours → selectable', () => {
      expect(isDateSelectable(byDay, now, 30, now)).toBe(true);
    });

    it('today without any future hour → not selectable', () => {
      const onlyPast: Record<string, TimeSegment[]> = { [todayKey]: [seg('08:00', '10:00')] };
      expect(isDateSelectable(onlyPast, now, 30, now)).toBe(false);
    });

    it('day without calendar configuration → not selectable', () => {
      expect(isDateSelectable({}, D(2026, 6, 11), 30, now)).toBe(false);
    });

    it('weekly day without segments → not selectable', () => {
      // byDay solo tiene el día de hoy; el 11 pertenece a otro día de la semana
      expect(isDateSelectable(byDay, D(2026, 6, 11), 30, now)).toBe(false);
    });

    it('future day configured and available → selectable', () => {
      const future = D(2026, 6, 11);
      const map: Record<string, TimeSegment[]> = { [weekdayShortOf(future)]: [seg('09:00', '13:00')] };
      expect(isDateSelectable(map, future, 30, now)).toBe(true);
    });
  });

  describe('futureSlotsForDate', () => {
    it('today → only future hours', () => {
      const slots = futureSlotsForDate(byDay, now, 30, now);
      expect(slots).not.toContain('09:00');
      expect(slots).not.toContain('10:00');
      expect(slots).toContain('10:30');
      expect(slots).toContain('12:30');
    });

    it('future day → all hours remain available', () => {
      const future = D(2026, 6, 11);
      const map: Record<string, TimeSegment[]> = { [weekdayShortOf(future)]: [seg('09:00', '11:00')] };
      expect(futureSlotsForDate(map, future, 30, now)).toEqual(['09:00', '09:30', '10:00', '10:30']);
    });

    it('selecting a valid date yields only its valid hours', () => {
      // día futuro con dos segmentos → solo esos slots
      const future = D(2026, 6, 12);
      const map: Record<string, TimeSegment[]> = {
        [weekdayShortOf(future)]: [seg('09:00', '10:00'), seg('16:00', '17:00')],
      };
      expect(futureSlotsForDate(map, future, 30, now)).toEqual(['09:00', '09:30', '16:00', '16:30']);
    });
  });
});
