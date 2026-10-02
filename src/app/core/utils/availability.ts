import { AppUser, TimeSegment } from '../models/user';

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

function isSameDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Horas agendables de una fecha: si es HOY, solo las posteriores a la hora actual. */
export function futureSlotsForDate(
  byDay: Record<string, TimeSegment[]>,
  date: Date,
  duration: number,
  now: Date = new Date()
): string[] {
  const slots = buildSlots(segmentsForDate(byDay, date), duration);
  if (!isSameDate(date, now)) return slots;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return slots.filter((slot) => {
    const [h, m] = slot.split(':').map(Number);
    return h * 60 + m > nowMinutes;
  });
}

/**
 * ¿La fecha se puede seleccionar para agendar?
 * No si: ya pasó, el día no tiene segmentos (cerrado/sin configurar), o es HOY sin horarios futuros.
 */
export function isDateSelectable(
  byDay: Record<string, TimeSegment[]>,
  date: Date,
  duration: number,
  now: Date = new Date()
): boolean {
  const dayTime = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const todayTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (dayTime < todayTime) return false;
  if (!segmentsForDate(byDay, date).length) return false;
  if (isSameDate(date, now)) {
    return futureSlotsForDate(byDay, date, duration, now).length > 0;
  }
  return true;
}
