import {after,before,beforeEach,test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomBytes} from 'node:crypto';
import {fingerprint} from './operator-policy.mjs';
import {credentialContextFingerprint,rotateCredentialKeys,applyReviewedCredentialRotation} from './credential-key-policy.mjs';
const PROJECT='demo-lilcare-p01';
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8187'||process.env.GCLOUD_PROJECT&&process.env.GCLOUD_PROJECT!==PROJECT)throw new Error('Synthetic local emulator only.');
const require=createRequire(new URL('../../functions/package.json',import.meta.url));
const {initializeApp,deleteApp}=require('firebase-admin/app');const {getFirestore}=require('firebase-admin/firestore');
const {prepareNewPatientCredential,claimNewPatientCredential,decryptPatientPassword}=require('./lib/patient-credentials.js');
let app,db,source,row;const rotationId=randomBytes(16).toString('hex');
const keys={previousEncryption:randomBytes(32).toString('hex'),nextEncryption:randomBytes(32).toString('hex'),
  previousUniqueness:randomBytes(32).toString('hex'),nextUniqueness:randomBytes(32).toString('hex')};
before(()=>{app=initializeApp({projectId:PROJECT},'p01-key-rotation-isolated');db=getFirestore(app);});
beforeEach(async()=>{
  for(const collection of ['patientCredentials','patientPasswordReservations','patientSessionStatus']){
    for(const document of (await db.collection(collection).get()).docs)await document.ref.delete();
  }
  source=await prepareNewPatientCredential({id:'p1',doctorId:'d1',email:'synthetic@example.test'},keys.previousEncryption,keys.previousUniqueness);
  await db.runTransaction(tx=>claimNewPatientCredential(tx,db,source));
  row={patientId:'p1',sourceFingerprint:fingerprint(source),contextFingerprint:credentialContextFingerprint(source),
    previousFingerprint:source.passwordFingerprint,nextFingerprint:rotateCredentialKeys(source,keys,rotationId).nextFingerprint};
});
after(async()=>{await db.terminate();await deleteApp(app);});
test('key rotation moves the private reservation atomically and resumes the same reviewed attempt',async()=>{
  const password=decryptPatientPassword(source,keys.previousEncryption);
  await applyReviewedCredentialRotation(db,row,keys,rotationId);
  const first=(await db.doc('patientCredentials/p1').get()).data();
  assert.equal(decryptPatientPassword(first,keys.nextEncryption),password);
  assert.equal((await db.doc('patientPasswordReservations/'+row.previousFingerprint).get()).exists,false);
  assert.equal((await db.doc('patientPasswordReservations/'+row.nextFingerprint).get()).data().patientId,'p1');
  const status=(await db.doc('patientSessionStatus/p1').get()).data();
  assert.equal(status.credentialVersion,source.credentialVersion);assert.equal(status.credentialEpoch,source.credentialEpoch);
  await applyReviewedCredentialRotation(db,row,keys,rotationId);
  assert.equal(fingerprint((await db.doc('patientCredentials/p1').get()).data()),fingerprint(first));
});
test('a conflicting reservation aborts both rewrites without modifying another patient',async()=>{
  await db.doc('patientPasswordReservations/'+row.nextFingerprint).set({patientId:'foreign',doctorId:'d2',credentialEpoch:'foreign',credentialVersion:1});
  await assert.rejects(applyReviewedCredentialRotation(db,row,keys,rotationId),/reservation-conflict/);
  assert.equal(fingerprint((await db.doc('patientCredentials/p1').get()).data()),fingerprint(source));
  assert.equal((await db.doc('patientPasswordReservations/'+row.previousFingerprint).get()).exists,true);
  assert.equal((await db.doc('patientPasswordReservations/'+row.nextFingerprint).get()).data().patientId,'foreign');
});
test('a changed reviewed credential or different next key is rejected without writes',async()=>{
  await assert.rejects(applyReviewedCredentialRotation(db,row,{...keys,nextUniqueness:randomBytes(32).toString('hex')},rotationId),/reviewed-key-or-credential-changed/);
  await db.doc('patientCredentials/p1').update({loginEmails:['changed@example.test']});
  await assert.rejects(applyReviewedCredentialRotation(db,row,keys,rotationId),/reviewed-credential-changed/);
  assert.equal((await db.doc('patientPasswordReservations/'+row.nextFingerprint).get()).exists,false);
});
