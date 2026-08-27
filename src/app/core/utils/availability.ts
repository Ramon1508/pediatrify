import { AppUser, TimeSegment } from '../models/user';

const DEFAULT_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DEFAULT_SEGMENT: TimeSegment = { startTime: '06:00', endTime: '00:00' };

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
    byDay = { ...user.timeSegmentsByDay };
  } else {
    const glob = user?.timeSegments?.length ? user.timeSegments : [DEFAULT_SEGMENT];
    for (const d of days) byDay[d] = glob.map((s) => ({ ...s }));
  }

  for (const d of Object.keys(byDay)) {
    if (!byDay[d]?.length) delete byDay[d];
  }
  return { timeSegmentsByDay: byDay, availableDays: Object.keys(byDay) };
}
