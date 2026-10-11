import { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * Rechaza valores numéricos menores o iguales a cero.
 * No se pronuncia ante un valor vacío o no numérico (esos los cubren required/pattern).
 */
export function greaterThanZero(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : parseFloat(String(value));
  if (Number.isNaN(parsed)) return null;
  return parsed > 0 ? null : { greaterThanZero: true };
}

/** Exige que al menos uno de los controles 'fatherName'/'motherName' tenga valor. */
export function atLeastOneParent(group: AbstractControl): ValidationErrors | null {
  const hasFather = String(group.get('fatherName')?.value ?? '').trim().length > 0;
  const hasMother = String(group.get('motherName')?.value ?? '').trim().length > 0;
  return hasFather || hasMother ? null : { atLeastOneParent: true };
}
