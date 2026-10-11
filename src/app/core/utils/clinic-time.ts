/** Referencia única del consultorio; las horas de cita son horas civiles de esta zona. */
export const CLINIC_TIME_ZONE = 'America/Mexico_City';

const clinicFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: CLINIC_TIME_ZONE, calendar: 'gregory', numberingSystem: 'latn',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export interface ClinicTime {
  date: string;
  minutes: number;
}

/** Convierte un instante, nunca una fecha civil seleccionada en un datepicker. */
export function clinicTimeAt(instant: Date = new Date()): ClinicTime {
  const parts = Object.fromEntries(clinicFormatter.formatToParts(instant).map(part => [part.type, part.value]));
  return { date: `${parts['year']}-${parts['month']}-${parts['day']}`,
    minutes: Number(parts['hour']) * 60 + Number(parts['minute']) };
}

export function todayClinicDateString(instant: Date = new Date()): string {
  return clinicTimeAt(instant).date;
}

/** Contenedor Date local para Material; representa un día civil, no el instante de medianoche en México. */
export function clinicTodayDate(instant: Date = new Date()): Date {
  const [year, month, day] = todayClinicDateString(instant).split('-').map(Number);
  return new Date(year, month - 1, day);
}
