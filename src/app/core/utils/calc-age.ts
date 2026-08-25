export function calcAge(birthDate: unknown): string {
  let d: Date | null = null;
  if (typeof birthDate === 'string') {
    const parts = birthDate.split('-');
    if (parts.length === 3) d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
  } else if (birthDate && typeof (birthDate as any).toDate === 'function') {
    d = (birthDate as any).toDate();
  }
  if (!d || isNaN(d.getTime())) return '';
  const now = new Date();
  let months = (now.getFullYear() - d.getFullYear()) * 12;
  months += now.getMonth() - d.getMonth();
  if (now.getDate() < d.getDate()) months--;
  if (months < 0) return '0 meses';
  if (months < 24) return `${months} meses`;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return remainingMonths > 0
    ? `${years} años ${remainingMonths} meses`
    : `${years} años`;
}
