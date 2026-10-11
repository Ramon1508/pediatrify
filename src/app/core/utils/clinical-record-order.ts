import { ClinicalRecord } from '../models/clinical-record';

/** Preserve Firestore sub-millisecond precision; missing legacy dates have no invented chronology. */
function creationTime(value: unknown): { seconds: number; nanoseconds: number } {
  if (value && typeof value === 'object' && 'seconds' in value && 'nanoseconds' in value) {
    const timestamp = value as { seconds: unknown; nanoseconds: unknown };
    if (typeof timestamp.seconds === 'number' && Number.isFinite(timestamp.seconds)
      && typeof timestamp.nanoseconds === 'number' && Number.isFinite(timestamp.nanoseconds)) {
      return { seconds: timestamp.seconds, nanoseconds: timestamp.nanoseconds };
    }
  }
  const milliseconds = value instanceof Date ? value.getTime()
    : typeof value === 'number' ? value : typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(milliseconds)
    ? { seconds: Math.floor(milliseconds / 1000), nanoseconds: (milliseconds % 1000) * 1_000_000 }
    : { seconds: 0, nanoseconds: 0 };
}

/** Consultation day, original creation instant, then stable ID. updatedAt never reorders a document. */
export function compareClinicalRecordsNewestFirst(a: ClinicalRecord, b: ClinicalRecord): number {
  const date = (b.date ?? '').localeCompare(a.date ?? '');
  if (date) return date;
  const first = creationTime(a.createdAt);
  const second = creationTime(b.createdAt);
  return second.seconds - first.seconds || second.nanoseconds - first.nanoseconds
    || a.id.localeCompare(b.id);
}
