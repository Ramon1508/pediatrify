/**
 * Convierte una fecha 'YYYY-MM-DD' a un `Date` local (medianoche LOCAL).
 *
 * El `mat-datepicker` convierte el valor del control a `Date` con su propia
 * lógica (`Date.parse`), que interpreta 'YYYY-MM-DD' como medianoche UTC y en
 * zonas negativas (GMT-7) muestra el día ANTERIOR. Pasando un `Date` local
 * (`new Date(año, mes-1, día)`) el picker muestra el día correcto.
 */
export function dateStringToLocalDate(value: string | null | undefined): Date {
  if (!value) return new Date();
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Convierte un `Date` local o 'YYYY-MM-DD' a string 'YYYY-MM-DD' (para guardar). */
export function dateToString(value: string | Date | null | undefined): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
