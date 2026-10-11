import {after, before, beforeEach, test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';

const PROJECT = 'demo-lilcare-p01';
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8187' ||
    (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== PROJECT)) throw new Error('Local synthetic emulator only.');
const require = createRequire(new URL('../../functions/package.json', import.meta.url));
const rulesRequire = createRequire(new URL('./package.json', import.meta.url));
const {initializeApp, deleteApp} = require('firebase-admin/app');
const {getFirestore, Timestamp} = require('firebase-admin/firestore');
const {initializeTestEnvironment} = rulesRequire('@firebase/rules-unit-testing');
const {authenticateClinicPatient, derivePatientVerifier, readClinicPrincipal} = require('./lib/clinic-auth.js');
const {readPatientBearer} = require('./lib/clinic-patient-token.js');
const {readPatientPortal, operatePatientPortal, streamPatientPortal} = require('./lib/clinic-patient-portal.js');
let app, db, env, token;
const limiterSecret = randomBytes(32).toString('hex');
const password = randomBytes(12).toString('hex');
const credentialEpoch = randomBytes(16).toString('hex');
const read = (action, data = {}, sessionToken = token, now = Date.now()) => readPatientPortal(db, {sessionToken, action, data}, now);
const login = () => authenticateClinicPatient(db, {email: 'family@example.test', password},
  {enabled: true, limiterSecret, transportAddress: '127.0.0.1'});
before(async () => {
  env = await initializeTestEnvironment({projectId: PROJECT, firestore: {host: '127.0.0.1', port: 8187,
    rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8')}});
  app = initializeApp({projectId: PROJECT}); db = getFirestore(app);
});
beforeEach(async () => {
  await env.clearFirestore();
  const days = ['Dom','Lun','Mar','Mie','Jue','Vie','Sab'];
  for (const uid of ['doctor','foreign']) {
    await db.doc('users/'+uid).set({uid, firebaseUid: 'auth-'+uid, role: 'doctor', profileComplete: true, pending: false,
      name: 'Doctor ficticio', allowPatientScheduling: true, consultationDuration: 30,
      timeSegmentsByDay: Object.fromEntries(days.map(day => [day,[{startTime:'09:00',endTime:'12:00'}]]))});
    await db.doc('securityPrincipals/auth-'+uid).set({authUid:'auth-'+uid,userId:uid,doctorId:uid,role:'doctor',active:true});
    await db.doc('doctorProfiles/'+uid).set({uid,name:'Doctor ficticio',role:'doctor',logoPath:'',phone:'5555555555'});
  }
  for (const [id,doctorId,email,secondaryEmail] of [['child','doctor','family@example.test',''],['sibling','doctor','other@example.test','family@example.test'],['unrelated','doctor','foreign@example.test',''],['foreign','foreign','family@example.test','']]) {
    await db.doc('patients/'+id).set({id,doctorId,email,secondaryEmail,name:'Paciente ficticio',lastName:'Ejemplo',birthDate:'2020-01-01',diagnosis:'never expose',phone:'5555555555'});
  }
  await db.doc('patientCredentials/child').set({patientId:'child',doctorId:'doctor',loginEmails:['family@example.test'],credentialEpoch,credentialVersion:1,verifier:await derivePatientVerifier(password)});
  token=(await login()).token;
});
after(async () => {await db?.terminate(); if(app) await deleteApp(app); await env?.cleanup();});

test('OTP login makes no Firebase Auth user/token and persists only the session digest',async()=>{
  const session=await read('session');
  assert.match(token,/^[a-f0-9]{48}\.[a-f0-9]{64}$/);
  const lease=(await db.doc('clinicSessions/'+session.lease.id).get()).data();
  assert.equal(JSON.stringify(lease).includes(token),false);
  assert.match(lease.patientTokenHash,/^[a-f0-9]{64}$/);
  const again=await login(); assert.notEqual(again.token,token);
  assert.equal((await read('session',{},token)).session.patient.id,'child');
  assert.equal((await read('session',{},again.token)).session.patient.id,'child');
});
test('forged/modified bearers and cloned Firebase identities cannot establish a Patient session',async()=>{
  for(const bearer of ['', 'Bearer firebase-token', token.slice(0,-1)+(token.endsWith('0')?'1':'0')]) await assert.rejects(read('session',{},bearer),{code:'unauthenticated'});
  const internal=await db.runTransaction(tx=>readPatientBearer(tx,db,token));
  await assert.rejects(db.runTransaction(tx=>readClinicPrincipal(tx,db,{...internal})),{code:'permission-denied'});
});
test('family reads exclude medical/contact/credential fields and enforce current Doctor/email',async()=>{
  const family=await read('family'); assert.deepEqual(family.patients.map(child=>child.id).sort(),['child','sibling']);
  for(const child of family.patients) for(const field of ['email','phone','diagnosis','otpPassword']) assert.equal(field in child,false);
  for(const id of ['unrelated','foreign']) await assert.rejects(read('patient',{id}),{code:'permission-denied'});
  await db.doc('patients/sibling').update({secondaryEmail:'changed@example.test'});
  assert.deepEqual((await read('family')).patients.map(child=>child.id),['child']);
  await assert.rejects(read('doctor',{doctorId:'foreign'}),{code:'permission-denied'});
});
test('calendar exposes own family appointments and masked slots, never other patients',async()=>{
  for(const patientId of ['child','sibling','unrelated','foreign']) {
    const doctorId=patientId==='foreign'?'foreign':'doctor';
    const id='visit-'+patientId;
    await db.doc('appointments/'+id).set({id,doctorId,patientId,date:'2030-01-07',time:'09:00',status:'scheduled',disabled:false,notes:'private to family'});
    await db.doc('appointmentSlots/'+id).set({id,doctorId,date:'2030-01-07',time:'09:00',patientId,notes:'never expose'});
  }
  assert.deepEqual((await read('appointments')).value.map(item=>item.patientId).sort(),['child','sibling']);
  await assert.rejects(read('appointment',{id:'visit-unrelated'}),{code:'permission-denied'});
  const slots=(await read('slots')).value; assert.equal(slots.length,3);
  assert.equal(slots.every(item=>Object.keys(item).sort().join(',')==='date,doctorId,id,time'),true);
});
test('notifications paginate within the own inbox and only become read through authorized operations',async()=>{
  for(let i=0;i<4;i++) await db.doc('notifications/n'+i).set({id:'n'+i,doctorId:'doctor',recipientId:i===3?'sibling':'child',recipientType:'patient',createdAt:Timestamp.fromMillis(1000+i),read:false,type:i===0?'appointment-cancelled':'appointment-created'});
  assert.equal((await read('notifications.count')).value,3);
  const page=await read('notifications.page',{pageSize:2}); assert.deepEqual(page.value.map(n=>n.id),['n2','n1']);
  assert.equal((await read('notifications.count')).value,3);
  assert.deepEqual((await read('notifications.page',{pageSize:2,cursor:page.cursor})).value.map(n=>n.id),['n0']);
  await assert.rejects(read('notifications.page',{cursor:'n3'}),{code:'permission-denied'});
  await assert.rejects(read('notification.read',{id:'n3'}),{code:'permission-denied'});
  await read('notification.read',{id:'n2'}); assert.equal((await read('notifications.count')).value,2);
  assert.deepEqual((await read('notifications.read-cancelled')).value,['n0']);
});
test('the server expires at one hour, reads never renew, activity renews and logout revokes',async()=>{
  const session=await read('session'); const expires=session.lease.expiresAt;
  assert.equal((await read('session',{},token,expires-1)).lease.expiresAt,expires);
  await assert.rejects(read('session',{},token,expires),{code:'permission-denied'});
  const touched=await read('touch',{},token,expires-1000); assert.equal(touched.expiresAt,expires-1000+3600000);
  await read('touch',{close:true}); await assert.rejects(read('session'),{code:'permission-denied'});
});
test('rotation/deletion/Doctor deactivation invalidate an already issued server session',async()=>{
  await db.doc('patientCredentials/child').update({credentialVersion:2}); await assert.rejects(read('session'),{code:'permission-denied'});
  await db.doc('patientCredentials/child').update({credentialVersion:1});
  await db.doc('patientDeletionJobs/child').set({blocked:true}); await assert.rejects(read('session'),{code:'permission-denied'});
  await db.doc('patientDeletionJobs/child').delete();
  await db.doc('securityPrincipals/auth-doctor').update({active:false}); await assert.rejects(read('session'),{code:'permission-denied'});
});
test('Patient appointment writes use current server policy and cannot invoke staff operations',async()=>{
  const save=(operation,entityId,data)=>operatePatientPortal(db,{sessionToken:token,action:'save',data:{operation,entityId,data,operationId:entityId+'-'+operation.replaceAll('.','-')}});
  await save('appointment.create','own',{patientId:'child',date:'2030-01-07',time:'09:00'});
  assert.equal((await read('appointment',{id:'own'})).value.patientId,'child');
  await assert.rejects(save('appointment.create','foreign',{patientId:'unrelated',date:'2030-01-07',time:'09:30'}),{code:'permission-denied'});
  await assert.rejects(save('schedule.update','doctor',{}),{code:'permission-denied'});
  await db.doc('users/doctor').update({allowPatientScheduling:false});
  await assert.rejects(save('appointment.update','own',{status:'cancelled'}),{code:'permission-denied'});
});
test('stream pushes changes from server snapshots, revokes on rotation and releases its connection',async()=>{
  const controller=new AbortController(); const values=[];
  let first; const initial=new Promise(resolve=>{first=resolve;});
  const stream=streamPatientPortal(db,{sessionToken:token,action:'doctor',data:{}},{signal:controller.signal,sendChunk:async chunk=>{values.push(chunk);first();return true;}});
  void stream.catch(()=>undefined);
  await initial;
  await db.doc('doctorProfiles/doctor').update({name:'Cambio ficticio'});
  const deadline=Date.now()+5000;
  while(!values.some(item=>item.value?.name==='Cambio ficticio') && Date.now()<deadline) await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(values.some(item=>item.value?.name==='Cambio ficticio'),true);
  await db.doc('patientCredentials/child').update({credentialVersion:2});
  await assert.rejects(stream,{code:'permission-denied'});
  controller.abort();
});
