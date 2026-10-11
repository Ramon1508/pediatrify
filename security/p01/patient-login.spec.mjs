import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { authenticatePatient, passwordVerifier } from './patient-login.mjs';
import { AccessDenied } from './policy.mjs';

async function setup() {
  const password = randomBytes(24).toString('hex');
  const verifier = await passwordVerifier(password);
  const children = [
    { id: 'p1', doctorId: 'd1', email: 'family@example.test', name: 'Synthetic child', otpPassword: password, diagnosis: 'Synthetic private field' },
    { id: 'p2', doctorId: 'd1', email: 'other@example.test', secondaryEmail: 'family@example.test', name: 'Synthetic sibling' },
    { id: 'p3', doctorId: 'd2', email: 'family@example.test', name: 'Synthetic other Doctor child' },
    { id: 'p4', doctorId: 'd1', email: 'unrelated@example.test', name: 'Synthetic unrelated child' },
  ];
  let activation = null;
  let tokenClaims = null;
  let consumed = 0;
  const deps = {
    limiter: { consume: async () => { consumed++; } },
    findCredentialsByEmail: async () => [{ patientId: 'p1', doctorId: 'd1', verifier }],
    getDoctor: async () => ({ uid: 'd1', role: 'doctor', profileComplete: true, pending: false }),
    findFamily: async () => children,
    activatePrincipal: async (data) => { activation = data; return { authUid: 'synthetic-family-auth', sessionVersion: 1 }; },
    createCustomToken: async (_uid, claims) => { tokenClaims = claims; return randomBytes(24).toString('hex'); },
  };
  return { password, deps, state: () => ({ activation, tokenClaims, consumed }) };
}
test('server validates credentials then grants only same-Doctor family, including secondary email', async () => {
  const { password, deps, state } = await setup();
  const result = await authenticatePatient({ email: ' FAMILY@example.test ', password }, deps);
  assert.equal(state().consumed, 1);
  assert.deepEqual(state().activation.familyPatientIds, ['p1', 'p2']);
  assert.equal(state().activation.doctorId, 'd1');
  assert.deepEqual(state().tokenClaims, { patientSessionVersion: 1 });
  assert.ok(typeof result.token === 'string');
  assert.ok(!('otpPassword' in result.patient));
  assert.ok(!('diagnosis' in result.patient));
});
test('malicious role, family, owner, or UID parameters are rejected before credential lookup', async () => {
  const { password, deps } = await setup();
  for (const field of ['role', 'doctorId', 'authUid', 'familyPatientIds', 'active']) await assert.rejects(
    () => authenticatePatient({ email: 'family@example.test', password, [field]: 'injected' }, deps), AccessDenied);
});
test('incorrect credentials and unknown accounts return the same generic error without activation', async () => {
  const { deps, state } = await setup();
  const input = { email: 'family@example.test', password: randomBytes(24).toString('hex') };
  const errors = [];
  for (const candidateDeps of [deps, { ...deps, findCredentialsByEmail: async () => [] }]) {
    try { await authenticatePatient(input, candidateDeps); } catch (error) { errors.push(error.message); }
  }
  assert.equal(errors.length, 2);
  assert.equal(errors[0], errors[1]);
  assert.equal(state().activation, null);
});
test('missing or rejecting rate limiter never silently disables brute-force protection', async () => {
  const { password, deps, state } = await setup();
  for (const limiter of [undefined, { consume: async () => { throw new Error('Synthetic limit'); } }]) await assert.rejects(
    () => authenticatePatient({ email: 'family@example.test', password }, { ...deps, limiter }), AccessDenied);
  assert.equal(state().activation, null);
});
test('inactive or deleted Doctor rejects otherwise matching credentials', async () => {
  const { password, deps } = await setup();
  for (const value of [null, { uid: 'd1', role: 'doctor', profileComplete: false }, { uid: 'd1', role: 'doctor', profileComplete: true, pending: true }]) await assert.rejects(
    () => authenticatePatient({ email: 'family@example.test', password }, { ...deps, getDoctor: async () => value }), AccessDenied);
});
test('stale email relation or missing matched child does not create family authority', async () => {
  const { password, deps } = await setup();
  await assert.rejects(() => authenticatePatient({ email: 'family@example.test', password }, { ...deps,
    findFamily: async () => [{ id: 'p1', doctorId: 'd1', email: 'someoneelse@example.test' }] }), AccessDenied);
});
test('credential corruption, oversized inputs and forged activation results fail closed', async () => {
  const { password, deps } = await setup();
  await assert.rejects(() => authenticatePatient({ email: 'family@example.test', password: 'x'.repeat(1000000) }, deps), AccessDenied);
  await assert.rejects(() => authenticatePatient({ email: 'family@example.test', password }, { ...deps,
    findCredentialsByEmail: async () => [{ patientId: 'p1', doctorId: 'd1', verifier: { algorithm: 'scrypt-v1', salt: 'malformed', hash: 'malformed' } }] }), AccessDenied);
  await assert.rejects(() => authenticatePatient({ email: 'family@example.test', password }, { ...deps,
    activatePrincipal: async () => ({ authUid: 'synthetic', sessionVersion: -1 }) }), AccessDenied);
});
test('credential verifier uses a fresh salt and does not contain the password', async () => {
  const password = randomBytes(24).toString('hex');
  const one = await passwordVerifier(password);
  const two = await passwordVerifier(password);
  assert.notEqual(one.salt, two.salt);
  assert.notEqual(one.hash, two.hash);
  assert.ok(!JSON.stringify(one).includes(password));
});
