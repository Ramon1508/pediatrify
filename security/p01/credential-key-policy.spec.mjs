import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {credentialContextFingerprint,rotateCredentialKeys,reservationBelongsTo,validateRotationKeys} from './credential-key-policy.mjs';
const require=createRequire(new URL('../../functions/package.json',import.meta.url));
const {encryptPatientPassword,decryptPatientPassword,patientPasswordFingerprint}=require('./lib/patient-credentials.js');
const keys={previousEncryption:'1'.repeat(64),nextEncryption:'2'.repeat(64),previousUniqueness:'3'.repeat(64),nextUniqueness:'4'.repeat(64)};
const rotationId='a'.repeat(32);const password='ABC234';
function fixture(){const credential={patientId:'p1',doctorId:'d1',credentialEpoch:'b'.repeat(32),credentialVersion:3,
  loginEmails:['synthetic@example.test'],verifier:{preserved:true},updatedAt:123};
  return {...credential,passwordFingerprint:patientPasswordFingerprint(password,keys.previousUniqueness),
    encryptedPassword:encryptPatientPassword(password,keys.previousEncryption,credential)};}
test('offline rotation keeps the password, login verifier, revision and business context',()=>{
  const source=fixture();const next=rotateCredentialKeys(source,keys,rotationId);
  assert.equal(decryptPatientPassword(next.credential,keys.nextEncryption),password);
  assert.deepEqual(next.credential.verifier,source.verifier);assert.equal(next.credential.credentialVersion,source.credentialVersion);
  assert.equal(credentialContextFingerprint(next.credential),credentialContextFingerprint(source));
  assert.notEqual(next.nextFingerprint,source.passwordFingerprint);assert.equal(next.alreadyRotated,false);
  assert.throws(()=>decryptPatientPassword(next.credential,keys.previousEncryption));
});
test('repeating the same reviewed rotation reuses its ciphertext and does not renew access',()=>{
  const first=rotateCredentialKeys(fixture(),keys,rotationId);const repeated=rotateCredentialKeys(first.credential,keys,rotationId);
  assert.equal(repeated.alreadyRotated,true);assert.deepEqual(repeated.credential,first.credential);
  assert.throws(()=>rotateCredentialKeys(first.credential,{...keys,nextEncryption:'5'.repeat(64)},rotationId));
});
test('AES-only rotation preserves the reservation; wrong uniqueness key or tampered context fails',()=>{
  const source=fixture();const next=rotateCredentialKeys(source,{...keys,nextUniqueness:keys.previousUniqueness},rotationId);
  assert.equal(next.nextFingerprint,source.passwordFingerprint);
  assert.throws(()=>rotateCredentialKeys(source,{...keys,previousUniqueness:'5'.repeat(64)},rotationId));
  assert.throws(()=>rotateCredentialKeys({...source,doctorId:'foreign'},keys,rotationId));
  assert.notEqual(credentialContextFingerprint({...source,credentialVersion:4}),credentialContextFingerprint(source));
});
test('reservation checks reject another patient, epoch or revision even with the same fingerprint',()=>{
  assert.throws(()=>validateRotationKeys({}));
  assert.throws(()=>validateRotationKeys({...keys,nextEncryption:undefined}));
  assert.doesNotThrow(()=>validateRotationKeys(keys));
  const credential=fixture();const reservation=Object.fromEntries(['patientId','doctorId','credentialEpoch','credentialVersion'].map(key=>[key,credential[key]]));
  assert.equal(reservationBelongsTo(reservation,credential),true);
  for(const field of Object.keys(reservation))assert.equal(reservationBelongsTo({...reservation,[field]:'foreign'},credential),false);
  assert.equal(reservationBelongsTo(undefined,credential),false);
});
