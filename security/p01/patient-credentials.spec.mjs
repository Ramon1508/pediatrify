import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomBytes} from 'node:crypto';

const require = createRequire(new URL('../../functions/package.json', import.meta.url));
const {encryptPatientPassword, decryptPatientPassword, prepareNewPatientCredential,
  preparePatientCredentialContacts, patientCredentialEmails, patientPasswordFingerprint, generatePatientPassword,
  managePatientCredential} = require('./lib/patient-credentials.js');
const {matchesPatientVerifier, validCredentialRevision} = require('./lib/clinic-auth.js');
const secret = randomBytes(32).toString('hex');
const uniquenessSecret = randomBytes(32).toString('hex');
const patient = {id:'p1',doctorId:'d1',email:'family@example.test',secondaryEmail:'second@example.test'};
const metadata = {...patient,patientId:patient.id,credentialVersion:1,credentialEpoch:randomBytes(16).toString('hex')};

test('new server credentials preserve six-character access, canonical aliases, no expiry and no plaintext',async()=> {
  const credential = await prepareNewPatientCredential(patient,secret,uniquenessSecret,1790000000000);
  const password = decryptPatientPassword(credential,secret);
  assert.match(password,/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  assert.equal(await matchesPatientVerifier(password,credential.verifier),true);
  assert.deepEqual(credential.loginEmails,['family@example.test','second@example.test']);
  assert.equal(validCredentialRevision(credential),true);
  assert.equal(JSON.stringify(credential).includes(password),false);
  for(const key of ['password','otpPassword','expiresAt','expiration']) assert.equal(key in credential,false);
  const other = await prepareNewPatientCredential(patient,secret,uniquenessSecret);
  assert.notEqual(credential.credentialEpoch,other.credentialEpoch);
});

test('encryption is randomized, preserves a custom reusable password and binds Doctor/child/revision',()=> {
  const password = randomBytes(16).toString('base64url');
  const first = encryptPatientPassword(password,secret,metadata);
  const second = encryptPatientPassword(password,secret,metadata);
  assert.notEqual(first.nonce,second.nonce);
  assert.equal(decryptPatientPassword({...metadata,encryptedPassword:first},secret),password);
  for(const patch of [{doctorId:'d2'},{patientId:'p2'},{credentialVersion:2},{credentialEpoch:randomBytes(16).toString('hex')}]) {
    assert.throws(()=>decryptPatientPassword({...metadata,...patch,encryptedPassword:first},secret),{code:'failed-precondition'});
  }
});

test('wrong key, malformed ciphertext and tampered tag fail without leaking cryptographic detail',()=> {
  const encryptedPassword = encryptPatientPassword('synthetic-password',secret,metadata);
  assert.throws(()=>decryptPatientPassword({...metadata,encryptedPassword},randomBytes(32).toString('hex')),
    error=>error.code==='failed-precondition' && !error.message.includes('authenticate'));
  for(const patch of [{nonce:'bad'},{ciphertext:'bad'},{tag:'0'.repeat(32)},{algorithm:'forged'}]) {
    assert.throws(()=>decryptPatientPassword({...metadata,encryptedPassword:{...encryptedPassword,...patch}},secret),
      {code:'failed-precondition'});
  }
});

test('missing key and noncanonical contacts are rejected; primary/secondary duplicates collapse',async()=> {
  for(const key of ['', 'short', 'g'.repeat(64)]) {
    await assert.rejects(prepareNewPatientCredential(patient,key,uniquenessSecret),{code:'failed-precondition'});
  }
  for(const patch of [{email:' UPPER@example.test '},{email:''},{secondaryEmail:null},{secondaryEmail:42}]) {
    assert.throws(()=>patientCredentialEmails({...patient,...patch}),{code:'failed-precondition'});
  }
  assert.deepEqual(patientCredentialEmails({...patient,secondaryEmail:patient.email}),[patient.email]);
  assert.deepEqual(patientCredentialEmails({...patient,secondaryEmail:''}),[patient.email]);
});

test('disabled integration never verifies identity or accesses a database',async()=> {
  const untouched = new Proxy({}, {get:()=>{throw new Error('Must not be used');}});
  await assert.rejects(managePatientCredential(untouched,untouched,'Bearer synthetic','read',{},
    {enabled:false,encryptionSecret:''}),{code:'failed-precondition'});
});

test('contact updates preserve password and verifier while changing the credential revision; unchanged contacts retain it',async()=> {
  const original = await prepareNewPatientCredential(patient,secret,uniquenessSecret);
  const password = decryptPatientPassword(original,secret);
  assert.equal(preparePatientCredentialContacts(original,{...patient,name:'Edited name'},secret),original);
  const next = preparePatientCredentialContacts(original,{...patient,email:'new@example.test',secondaryEmail:''},secret);
  assert.equal(next.credentialVersion,2);
  assert.equal(next.credentialEpoch,original.credentialEpoch);
  assert.deepEqual(next.loginEmails,['new@example.test']);
  assert.deepEqual(next.verifier,original.verifier);
  assert.equal(decryptPatientPassword(next,secret),password);
  assert.equal(JSON.stringify(next).includes(password),false);
  assert.throws(()=>preparePatientCredentialContacts(original,{...patient,doctorId:'d2'},secret),{code:'failed-precondition'});
  assert.throws(()=>preparePatientCredentialContacts(original,{...patient,id:'p2'},secret),{code:'failed-precondition'});
});

test('strict request schema rejects authority injection, expiration and malformed rotation before any SDK call',async()=> {
  const untouched = new Proxy({}, {get:()=>{throw new Error('Must not be used');}});
  const options = {enabled:true,encryptionSecret:secret};
  for(const field of ['role','doctorId','email','authUid','expiresAt','verifier']) {
    await assert.rejects(managePatientCredential(untouched,untouched,'Bearer synthetic','read',
      {patientId:'p1',[field]:'forged'},options),{code:'permission-denied'});
  }
  const valid = {patientId:'p1',operationId:'operation-1',expectedVersion:1,expectedEpoch:metadata.credentialEpoch};
  for(const patch of [{password:''},{password:'123'},{password:'x'.repeat(257)},{expectedVersion:0},
    {expectedVersion:1.5},{expectedEpoch:'forged'},{operationId:'../escape'}]) {
    await assert.rejects(managePatientCredential(untouched,untouched,'Bearer synthetic','rotate',{...valid,...patch},options),
      {code:'permission-denied'});
  }
});

test('global reservation fingerprints are keyed, stable and never derived from public password hashes',()=> {
  const password=generatePatientPassword();
  const fingerprint=patientPasswordFingerprint(password,uniquenessSecret);
  assert.match(fingerprint,/^[a-f0-9]{64}$/);
  assert.equal(patientPasswordFingerprint(password,uniquenessSecret),fingerprint);
  assert.notEqual(patientPasswordFingerprint(password,randomBytes(32).toString('hex')),fingerprint);
  assert.equal(fingerprint.includes(password),false);
  assert.throws(()=>patientPasswordFingerprint('custom-password',uniquenessSecret),{code:'failed-precondition'});
});
