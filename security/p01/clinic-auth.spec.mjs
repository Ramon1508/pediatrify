import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomBytes} from 'node:crypto';

const require = createRequire(new URL('../../functions/package.json', import.meta.url));
const {derivePatientVerifier, matchesPatientVerifier, verifyClinicToken, clinicPatientSummary,
  authenticateClinicPatient, consumePatientLoginBudget} = require('./lib/clinic-auth.js');

test('patient verifiers are salted, fixed-parameter and accept the reusable password', async () => {
  const password = randomBytes(18).toString('base64url');
  const [first, second] = await Promise.all([derivePatientVerifier(password), derivePatientVerifier(password)]);
  assert.equal(first.algorithm, 'scrypt-v1');
  assert.notEqual(first.salt, second.salt);
  assert.notEqual(first.hash, second.hash);
  assert.equal(await matchesPatientVerifier(password, first), true);
  assert.equal(await matchesPatientVerifier(password, first), true);
  assert.equal(await matchesPatientVerifier('wrong-password', first), false);
  assert.equal(JSON.stringify(first).includes(password), false);
});

test('malformed verifier or oversized password is never accepted', async () => {
  for (const value of [null, {}, {algorithm:'scrypt-v2'}, {algorithm:'scrypt-v1',salt:'bad',hash:'bad'}]) {
    assert.equal(await matchesPatientVerifier('synthetic-password', value), false);
  }
  await assert.rejects(derivePatientVerifier(''), {code:'unauthenticated'});
  await assert.rejects(derivePatientVerifier('x'.repeat(257)), {code:'unauthenticated'});
  assert.equal(await matchesPatientVerifier('x'.repeat(257), {}), false);
});

test('protected caller verification checks Auth revocation, not only callable claims', async () => {
  const calls = [];
  const auth = {verifyIdToken:async (token, revoked) => {calls.push([token,revoked]);return {uid:'synthetic-uid'};}};
  const result = await verifyClinicToken(auth, 'Bearer synthetic-id-token');
  assert.equal(result.uid,'synthetic-uid');
  assert.deepEqual(calls,[['synthetic-id-token',true]]);
});

test('invalid or revoked identity has one generic safe error and no verifier fallback', async () => {
  let calls = 0;
  const auth = {verifyIdToken:async()=>{calls++;throw new Error('private synthetic SDK detail');}};
  for (const header of [null,'','Basic synthetic','Bearer token extra','Bearer '+ 'x'.repeat(16000)]) {
    await assert.rejects(verifyClinicToken(auth,header),{code:'permission-denied'});
  }
  assert.equal(calls,0);
  await assert.rejects(verifyClinicToken(auth,'Bearer synthetic'), error =>
    error.code === 'permission-denied' && !error.message.includes('SDK'));
  assert.equal(calls,1);
});

test('family summary excludes access passwords, contacts, clinical data and actor metadata', () => {
  const summary = clinicPatientSummary({id:'child',doctorId:'doctor',name:'Sintético',lastName:'Ejemplo',
    birthDate:'2020-01-01',fatherName:'Tutor',motherName:'Tutora',email:'synthetic@example.test',
    phone:'not-real',otpPassword:'never-return',vaccinationRecord:{},diagnosis:'private',createdBy:'private'});
  assert.deepEqual(Object.keys(summary),['id','doctorId','name','lastName','birthDate','fatherName','motherName']);
});

test('activation gate rejects before database or credential access', async () => {
  const db = new Proxy({}, {get:()=>{throw new Error('Database must not be consulted');}});
  await assert.rejects(authenticateClinicPatient(db, {},
    {enabled:false,limiterSecret:'',transportAddress:''}),{code:'failed-precondition'});
});

test('caller cannot choose role, Doctor, session UID or family membership at login', async () => {
  const db = new Proxy({}, {get:()=>{throw new Error('Database must not be consulted');}});
  for (const field of ['role','doctorId','authUid','familyPatientIds']) {
    await assert.rejects(authenticateClinicPatient(db, {email:'synthetic@example.test',password:'synthetic',[field]:'forged'},
      {enabled:true,limiterSecret:'',transportAddress:''}),{code:'unauthenticated'});
  }
});

test('missing secret or platform transport fails closed before persisting any budget', async () => {
  const db = new Proxy({}, {get:()=>{throw new Error('Database must not be consulted');}});
  await assert.rejects(consumePatientLoginBudget(db,'','127.0.0.1','synthetic@example.test'),{code:'unauthenticated'});
  await assert.rejects(consumePatientLoginBudget(db,randomBytes(32).toString('hex'),'','synthetic@example.test'),{code:'unauthenticated'});
});
