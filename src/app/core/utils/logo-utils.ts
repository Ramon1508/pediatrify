import { getDownloadURL, ref, FirebaseStorage } from 'firebase/storage';

export function isRemoteUrl(value: string): boolean {
  return /^(https?:\/\/|gs:\/\/|blob:|data:)/.test(value);
}

/**
 * Devuelve una URL utilizable para mostrar/ imprimir un logo dado su `logoPath`.
 * - Si el valor ya es una URL (casos viejos guardados así), lo devuelve tal cual.
 * - Si es un path de Storage (fuente de verdad), lo resuelve con `getDownloadURL`.
 * Es tolerante a errores (devuelve el valor original si no se puede resolver).
 */
export async function resolveLogoUrl(storage: FirebaseStorage, value: string): Promise<string> {
  if (!value) return '';
  if (isRemoteUrl(value)) return value;
  try {
    return await getDownloadURL(ref(storage, value));
  } catch {
    return value;
  }
}
