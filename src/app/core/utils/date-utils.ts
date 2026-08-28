type TimestampLike = {
  toDate: () => Date;
};

const LOCAL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isTimestampLike(value: unknown): value is TimestampLike {
  return !!value && typeof (value as TimestampLike).toDate === 'function';
}

function formatDateParts(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseLocalDate(value: string): Date | null {
  const match = LOCAL_DATE_RE.exec(value.trim());
  if (!match) return null;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  const date = new Date(year, month - 1, day);
  if (
    isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

/**
 * Converts a civil date string to a local Date for Material datepickers.
 * Passing 'YYYY-MM-DD' directly can be deserialized as UTC by Material.
 */
export function dateStringToLocalDate(value: string | null | undefined): Date {
  if (!value) return new Date();
  return parseLocalDate(value) ?? new Date(value);
}

/** Civil date for today in the user's local timezone. */
export function todayLocalDateString(): string {
  return formatDateParts(new Date());
}

/**
 * Normalizes civil dates to 'YYYY-MM-DD'.
 * Accepts strings, local Date objects, and legacy Firestore Timestamp values.
 */
export function dateToString(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';
    const local = parseLocalDate(trimmed);
    if (local) return formatDateParts(local);
    if (trimmed.includes('T')) return trimmed.split('T')[0];
    return trimmed;
  }
  if (value instanceof Date && !isNaN(value.getTime())) {
    return formatDateParts(value);
  }
  if (isTimestampLike(value)) {
    return dateToString(value.toDate());
  }
  return '';
}

/** Formats a civil date without DatePipe or UTC conversion. */
export function formatLocalDate(value: unknown): string {
  const date = dateToString(value);
  const [y, m, d] = date.split('-');
  return y && m && d ? `${d}/${m}/${y}` : '';
}

/** Converts a civil date to a local midnight timestamp for calculations. */
export function localDateStringToTime(value: unknown): number {
  const date = dateToString(value);
  const local = parseLocalDate(date);
  return local ? local.getTime() : NaN;
}
