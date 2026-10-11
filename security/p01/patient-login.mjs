import { randomBytes, scrypt as derive, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { AccessDenied, patientPortalProjection } from './policy.mjs';
const scrypt = promisify(derive);
const ERROR = 'Credenciales inválidas. Verifica tu correo y contraseña.';
const PARAMETERS = { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 };

// Credential migration/generation is server-only. Values never appear in logs.
export async function passwordVerifier(password) {
  if (typeof password !== 'string' || password.length < 1 || password.length > 256) throw new AccessDenied(ERROR);
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64, PARAMETERS);
  return { algorithm: 'scrypt-v1', salt: salt.toString('hex'), hash: hash.toString('hex') };
}
async function matches(password, verifier) {
  if (verifier?.algorithm !== 'scrypt-v1' || !/^[a-f0-9]{32}$/.test(verifier.salt ?? '') || !/^[a-f0-9]{128}$/.test(verifier.hash ?? '')) return false;
  const actual = await scrypt(password, Buffer.from(verifier.salt, 'hex'), 64, PARAMETERS);
  return timingSafeEqual(actual, Buffer.from(verifier.hash, 'hex'));
}

/**
 * Executable server-side prototype. Dependencies MUST be trusted Admin SDK
 * adapters. activatePrincipal atomically establishes UID + family membership
 * and returns {authUid, sessionVersion}; createCustomToken is Admin Auth.
 * No client-supplied role/doctor/family IDs are accepted.
 */
export async function authenticatePatient(input, dependencies) {
  if (!input || Object.keys(input).some((key) => !['email', 'password'].includes(key))
    || typeof input.email !== 'string' || input.email.length > 254
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())
    || typeof input.password !== 'string' || input.password.length < 1 || input.password.length > 256) throw new AccessDenied(ERROR);
  const email = input.email.trim().toLowerCase();
  // Required limiter must include platform-derived IP + account budgets and
  // persistent atomic counters. Missing limiter never becomes a bypass.
  try { await dependencies.limiter.consume(email); } catch { throw new AccessDenied(ERROR); }
  const candidates = await dependencies.findCredentialsByEmail(email);
  if (!Array.isArray(candidates) || candidates.length > 100) throw new AccessDenied(ERROR);
  let selected = null;
  for (const candidate of candidates) {
    if (await matches(input.password, candidate.verifier)) selected ??= candidate;
  }
  // Dummy derivation makes an unknown account perform comparable hash work.
  if (candidates.length === 0) await scrypt(input.password, Buffer.alloc(16), 64, PARAMETERS);
  if (!selected) throw new AccessDenied(ERROR);
  const doctor = await dependencies.getDoctor(selected.doctorId);
  if (!doctor || doctor.uid !== selected.doctorId || doctor.role !== 'doctor' || doctor.pending === true || doctor.profileComplete !== true) throw new AccessDenied(ERROR);
  const family = await dependencies.findFamily(email, selected.doctorId);
  if (!Array.isArray(family) || family.length > 100) throw new AccessDenied(ERROR);
  const filtered = family.filter((child) => child.doctorId === selected.doctorId
    && [child.email, child.secondaryEmail].some((address) => typeof address === 'string' && address.trim().toLowerCase() === email));
  const root = filtered.find((child) => child.id === selected.patientId);
  if (!root) throw new AccessDenied(ERROR);
  const activation = await dependencies.activatePrincipal({
    role: 'patient', doctorId: selected.doctorId, loginEmail: email,
    patientId: root.id, familyPatientIds: filtered.map((child) => child.id),
  });
  if (typeof activation?.authUid !== 'string' || !Number.isSafeInteger(activation.sessionVersion) || activation.sessionVersion < 1) throw new AccessDenied(ERROR);
  const token = await dependencies.createCustomToken(activation.authUid, {
    patientSessionVersion: activation.sessionVersion,
  });
  return { token, patient: patientPortalProjection(root) };
}
