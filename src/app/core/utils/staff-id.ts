/** A document identifier; matching an email-shaped value never establishes account authority. */
export function validStaffId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_@.+-]{1,128}$/.test(value) &&
    value !== '.' && !value.includes('..') && !/^__.*__$/.test(value);
}
