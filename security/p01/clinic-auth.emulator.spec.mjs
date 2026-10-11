import {after, before, beforeEach, test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';

const PROJECT = 'demo-lilcare-p01';
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8187' ||
    (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== PROJECT)) {
  throw new Error('Only the isolated synthetic demo project and local emulator are permitted.');
}
const require = createRequire(new URL('../../functions/package.json', import.meta.url));
const rulesRequire = createRequire(new URL('./package.json', import.meta.url));
const {initializeApp, deleteApp} = require('firebase-admin/app');
const {getFirestore,Timestamp} = require('firebase-admin/firestore');
const {initializeTestEnvironment} = rulesRequire('@firebase/rules-unit-testing');
const {derivePatientVerifier, authenticateClinicPatient, consumePatientLoginBudget,
  readClinicPrincipal, trustedClinicDoctor, readClinicFamilyPatient} = require('./lib/clinic-auth.js');
const {readPatientBearer}=require('./lib/clinic-patient-token.js');
let app, db, env, password, signingCalls, auth;
const secret = randomBytes(32).toString('hex');
const credentialEpoch = randomBytes(16).toString('hex');
const security = () => ({enabled:true,limiterSecret:secret,transportAddress:'127.0.0.1',now:Date.now()});
const doctor = (uid) => ({uid,firebaseUid:'auth-'+uid,role:'doctor',pending:false,profileComplete:true,name:'Doctor sintético'});
const principal = (uid,role='doctor') => ({authUid:'auth-'+uid,active:true,role,userId:uid,
  ...(role === 'doctor' ? {doctorId:uid}: {})});

before(async () => {
  env = await initializeTestEnvironment({projectId:PROJECT,firestore:{host:'127.0.0.1',port:8187,
    rules:readFileSync(new URL('./firestore.prototype.rules',import.meta.url),'utf8')}});
  app = initializeApp({projectId:PROJECT},'p01-clinic-auth-isolated');
  db = getFirestore(app);
});
beforeEach(async () => {
  await env.clearFirestore();
  signingCalls = [];
  auth = {createCustomToken:async (uid,claims) => {signingCalls.push({uid,claims});return 'synthetic-token-not-a-real-credential';}};
  password = randomBytes(16).toString('base64url');
  for (const uid of ['d1','d2']) {
    await db.doc('users/'+uid).set(doctor(uid));
    await db.doc('securityPrincipals/auth-'+uid).set(principal(uid));
    await db.doc('clinicSessions/lease-auth-'+uid).set({authUid:'auth-'+uid,role:'doctor',active:true,expiresAt:Timestamp.fromMillis(Date.now()+3600000)});
  }
  const base = {name:'Niño sintético',lastName:'Ejemplo',birthDate:'2020-01-01',fatherName:'Tutor',motherName:'Tutora',
    email:'family@example.test',otpPassword:'excluded-private-value',diagnosis:'excluded-private-value'};
  for (const child of [{id:'p1',doctorId:'d1'},{id:'p2',doctorId:'d1',email:'other@example.test',secondaryEmail:'family@example.test'},
    {id:'p3',doctorId:'d1',email:'foreign@example.test'},{id:'p4',doctorId:'d2'}]) {
    await db.doc('patients/'+child.id).set({...base,...child});
  }
  await db.doc('patientCredentials/p1').set({patientId:'p1',doctorId:'d1',loginEmails:['family@example.test'],
    credentialVersion:1,credentialEpoch,
    verifier:await derivePatientVerifier(password)});
});
after(async()=> {await db?.terminate();if(app) await deleteApp(app);await env?.cleanup();});
const login = async (input={email:' FAMILY@example.test ',password}) => {
  const result=await authenticateClinicPatient(db,input,security());
  const token=await db.runTransaction(tx=>readPatientBearer(tx,db,result.token));
  signingCalls.push({uid:token.uid,claims:token}); return result;
};

test('real transaction creates only the authenticated Doctor family and returns no private clinical fields', async () => {
  const result = await login();
  assert.equal(signingCalls.length,1);
  const {uid,claims} = signingCalls[0];
  assert.match(uid,/^patient-[a-f0-9]{48}$/);
  assert.equal(claims.patientSessionVersion,1);
  assert.match(result.token,/^[a-f0-9]{48}\.[a-f0-9]{64}$/);
  const lease=(await db.doc('clinicSessions/'+claims.clinicSessionId).get()).data();
  assert.equal(JSON.stringify(lease).includes(result.token),false);
  assert.match(claims.clinicSessionId,/^[a-f0-9]{48}$/);
  assert.equal(result.patient.id,'p1');
  assert.equal('otpPassword' in result.patient,false);
  assert.equal('diagnosis' in result.patient,false);
  assert.equal('email' in result.patient,false);
  const memberships = await db.collection('familyAccess/'+uid+'/patients').get();
  assert.deepEqual(memberships.docs.map(d=>d.id).sort(),['p1','p2']);
  const current = await db.runTransaction(tx => readClinicPrincipal(tx,db,claims));
  assert.equal(current.doctorId,'d1');
  await assert.rejects(db.runTransaction(tx=>readClinicFamilyPatient(tx,db,current,'p3')),{code:'permission-denied'});
  await assert.rejects(db.runTransaction(tx=>readClinicFamilyPatient(tx,db,current,'p4')),{code:'permission-denied'});
});

test('password is reusable; another login does not revoke an existing authenticated device',async()=> {
  await login();
  await login();
  assert.equal(signingCalls.length,2);
  assert.notEqual(signingCalls[0].uid,signingCalls[1].uid);
  for(const call of signingCalls) assert.equal((await db.doc('securityPrincipals/'+call.uid).get()).data().active,true);
});

test('wrong and unknown credentials have the same generic response without Auth signing',async()=> {
  await assert.rejects(login({email:'family@example.test',password:'wrong'}),{code:'unauthenticated'});
  await assert.rejects(login({email:'unknown@example.test',password:'wrong'}),{code:'unauthenticated'});
  assert.equal(signingCalls.length,0);
});

test('matching credentials in different Doctors are rejected instead of choosing an arbitrary consultorio',async()=> {
  await db.doc('patientCredentials/p4').set({patientId:'p4',doctorId:'d2',loginEmails:['family@example.test'],
    credentialVersion:1,credentialEpoch,
    verifier:await derivePatientVerifier(password)});
  await assert.rejects(login(),{code:'unauthenticated'});
  assert.equal(signingCalls.length,0);
  assert.equal((await db.collection('securityPrincipals').where('role','==','patient').get()).empty,true);
});

test('revoked Doctor and a Doctor with a deletion in progress cannot issue family access',async()=> {
  await db.doc('securityPrincipals/auth-d1').update({active:false});
  await assert.rejects(login(),{code:'unauthenticated'});
  await db.doc('securityPrincipals/auth-d1').update({active:true});
  await db.doc('staffDeletionJobs/d1').set({completed:false});
  await assert.rejects(login(),{code:'unauthenticated'});
  assert.equal(signingCalls.length,0);
});

test('a contact or token-version change immediately invalidates protected current authority',async()=> {
  await login();
  const {uid,claims} = signingCalls[0];
  await db.doc('securityPrincipals/'+uid).update({sessionVersion:2});
  await assert.rejects(db.runTransaction(tx=>readClinicPrincipal(tx,db,{uid,...claims})),{code:'permission-denied'});
  await db.doc('securityPrincipals/'+uid).update({sessionVersion:1});
  await db.doc('patients/p1').update({email:'changed@example.test'});
  await assert.rejects(db.runTransaction(tx=>readClinicPrincipal(tx,db,{uid,...claims})),{code:'permission-denied'});
});

test('parallel attempts cannot bypass an account budget; persisted keys contain no raw addresses',async()=> {
  const attempts = await Promise.allSettled(Array.from({length:12},()=>consumePatientLoginBudget(db,secret,
    '127.0.0.1','new-family@example.test',1790000000000)));
  assert.equal(attempts.filter(x=>x.status==='fulfilled').length,8);
  assert.equal(attempts.filter(x=>x.status==='rejected').every(x=>x.reason.code==='unauthenticated'),true);
  const budgets = await db.collection('patientLoginBudgets').get();
  assert.equal(budgets.size,2);
  for(const snapshot of budgets.docs) {
    assert.match(snapshot.id,/^[a-f0-9]{64}$/);
    assert.equal(JSON.stringify(snapshot.data()).includes('example.test'),false);
    assert.equal(snapshot.data().count,8);
  }
});

test('a blocked window reopens after the server-side time window, without extending passwords',async()=> {
  for(let i=0;i<8;i++) await consumePatientLoginBudget(db,secret,'127.0.0.1','family@example.test',1790000000000);
  await assert.rejects(consumePatientLoginBudget(db,secret,'127.0.0.1','family@example.test',1790000000000),{code:'unauthenticated'});
  await consumePatientLoginBudget(db,secret,'127.0.0.1','family@example.test',1790000300000);
  const result = await authenticateClinicPatient(db,{email:'family@example.test',password},
    {...security(),now:1790000300000});
  assert.equal(result.patient.id,'p1');
});

test('Patient access never invokes Firebase Auth, even when all its methods fail',async()=> {
  auth=new Proxy({}, {get(){throw new Error('Patient must never use Firebase Auth');}});
  const result=await login();
  assert.equal(result.patient.id,'p1');
  const {claims}=signingCalls[0];
  await assert.rejects(db.runTransaction(tx=>readClinicPrincipal(tx,db,{...claims})),{code:'permission-denied'});
});

test('Admin may own a backend-only testing Assistant, who has a profile but no Doctor agenda',async()=> {
  await db.doc('users/admin').set({...doctor('admin'),role:'admin'});
  await db.doc('securityPrincipals/auth-admin').set(principal('admin','admin'));
  await db.doc('users/assistant').set({...doctor('assistant'),role:'assistant',createdBy:'admin'});
  await db.doc('securityPrincipals/auth-assistant').set({...principal('assistant','assistant'),doctorId:'admin'});
  await db.doc('clinicSessions/lease-auth-assistant').set({authUid:'auth-assistant',role:'assistant',active:true,expiresAt:Timestamp.fromMillis(Date.now()+3600000)});
  const current = await db.runTransaction(tx=>readClinicPrincipal(tx,db,{uid:'auth-assistant',clinicSessionId:'lease-auth-assistant'}));
  assert.equal(current.role,'assistant');
  await assert.rejects(db.runTransaction(tx=>trustedClinicDoctor(tx,db,current.doctorId)),{code:'permission-denied'});
});

test('staff cannot load an active principal after role/UID mismatch, pending state or deletion',async()=> {
  for(const change of [{firebaseUid:'auth-d2'},{role:'admin'},{pending:true},{profileComplete:false}]) {
    await db.doc('users/d1').set({...doctor('d1'),...change});
    await assert.rejects(db.runTransaction(tx=>readClinicPrincipal(tx,db,{uid:'auth-d1',clinicSessionId:'lease-auth-d1'})),{code:'permission-denied'});
  }
  await db.doc('users/d1').set(doctor('d1'));
  await db.doc('staffDeletionJobs/d1').set({completed:false});
  await assert.rejects(db.runTransaction(tx=>readClinicPrincipal(tx,db,{uid:'auth-d1',clinicSessionId:'lease-auth-d1'})),{code:'permission-denied'});
});
