import { AppUser, TimeSegment } from '../models/user';
import { clinicTimeAt } from './clinic-time';
import { dateToString } from './date-utils';

const DEFAULT_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DEFAULT_SEGMENT: TimeSegment = { startTime: '06:00', endTime: '00:00' };

export function cloneTimeSegmentsByDay(
  source: Record<string, TimeSegment[]> | null | undefined
): Record<string, TimeSegment[]> {
  return Object.fromEntries(
    Object.entries(source ?? {}).map(([day, segments]) => [
      day,
      segments.map((segment) => ({ ...segment })),
    ])
  );
}

/**
 * Normaliza el horario de un doctor a segmentos POR DÍA.
 * - Si el doc ya tiene `timeSegmentsByDay`, lo usa tal cual.
 * - Si no (modelo viejo con `timeSegments` global), lo reparte a sus `availableDays`.
 * Devuelve también el listado de días realmente disponibles (con segmentos).
 */
export function buildAvailabilityFromUser(
  user: Partial<AppUser> | null | undefined
): { timeSegmentsByDay: Record<string, TimeSegment[]>; availableDays: string[] } {
  const days = user?.availableDays?.length ? user.availableDays : DEFAULT_DAYS;
  let byDay: Record<string, TimeSegment[]> = {};

  if (user?.timeSegmentsByDay && Object.keys(user.timeSegmentsByDay).length) {
    byDay = cloneTimeSegmentsByDay(user.timeSegmentsByDay);
  } else {
    const glob = user?.timeSegments?.length ? user.timeSegments : [DEFAULT_SEGMENT];
    for (const d of days) byDay[d] = glob.map((s) => ({ ...s }));
  }

  for (const d of Object.keys(byDay)) {
    if (!byDay[d]?.length) delete byDay[d];
  }
  return { timeSegmentsByDay: byDay, availableDays: Object.keys(byDay) };
}

export const WEEKDAYS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** Día de la semana corto ('Lun'…'Dom') de una fecha. */
export function weekdayShortOf(date: Date): string {
  const idx = date.getDay();
  return WEEKDAYS_SHORT[idx === 0 ? 6 : idx - 1];
}

/** Segmentos configurados para el día de la semana de la fecha (fuente de verdad: timeSegmentsByDay). */
export function segmentsForDate(
  byDay: Record<string, TimeSegment[]>,
  date: Date
): TimeSegment[] {
  return byDay?.[weekdayShortOf(date)] ?? [];
}

/** Slots del día según los segmentos y la duración de consulta. */
export function buildSlots(segments: TimeSegment[], duration: number): string[] {
  if (!segments?.length || !duration || duration <= 0) return [];
  const slots: string[] = [];
  for (const seg of segments) {
    const [sh, sm] = seg.startTime.split(':').map(Number);
    let [eh, em] = seg.endTime.split(':').map(Number);
    if (eh === 0 && em === 0) eh = 24;
    let start = sh * 60 + sm;
    const end = eh * 60 + em;
    while (start + duration <= end) {
      const h = Math.floor(start / 60);
      const m = start % 60;
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      start += duration;
    }
  }
  return slots;
}

/** La fecha seleccionada es civil; HOY y el minuto actual corresponden al consultorio. */
export function futureSlotsForDate(
  byDay: Record<string, TimeSegment[]>,
  date: Date,
  duration: number,
  now: Date = new Date()
): string[] {
  const slots = buildSlots(segmentsForDate(byDay, date), duration);
  const selectedDate = dateToString(date);
  const clinic = clinicTimeAt(now);
  if (!selectedDate || selectedDate < clinic.date) return [];
  if (selectedDate !== clinic.date) return slots;
  return slots.filter((slot) => {
    const [h, m] = slot.split(':').map(Number);
    return h * 60 + m > clinic.minutes;
  });
}

/**
 * ¿La fecha se puede seleccionar para agendar?
 * No si: ya pasó o el día no tiene segmentos (cerrado/sin configurar).
 * Hoy permanece seleccionable aunque ya no queden horas futuras; las horas se filtran por separado.
 */
export function isDateSelectable(
  byDay: Record<string, TimeSegment[]>,
  date: Date,
  _duration: number,
  now: Date = new Date()
): boolean {
  const selectedDate = dateToString(date);
  const today = clinicTimeAt(now).date;
  if (!selectedDate || selectedDate < today) return false;
  if (!segmentsForDate(byDay, date).length) return false;
  return true;
}
