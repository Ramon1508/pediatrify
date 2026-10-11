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
const {mutateClinicData, readClinicPublications} = require('./lib/clinic-operations.js');
const {createClinicPatientRecord} = require('./lib/clinic-patients.js');
const {prepareNewPatientCredential, claimNewPatientCredential, decryptPatientPassword, managePatientCredential} = require('./lib/patient-credentials.js');
const {authenticateClinicPatient, readClinicPrincipal} = require('./lib/clinic-auth.js');
const {readPatientBearer}=require('./lib/clinic-patient-token.js');
const {openClinicStaffSession} = require('./lib/clinic-sessions.js');
const {deliverClinicEmail} = require('./lib/clinic-mail.js');
const {clinicScheduleFromUser, clinicPublicationExpiry, sanitizeClinicDocument} = require('./lib/clinic-data.js');
const {requestClinicPasswordReset} = require('./lib/clinic-recovery.js');
const {issueInvitation} = require('./lib/staff-invitations.js');
const {changeStaffEmail} = require('./lib/staff-email-change.js');
const {readPatientPortal} = require('./lib/clinic-patient-portal.js');
const NOW = Date.parse('2030-01-07T12:00:00Z');
const encryptionSecret = randomBytes(32).toString('hex');
const uniquenessSecret = randomBytes(32).toString('hex');
const security = {enabled: true, encryptionSecret, uniquenessSecret, now: NOW};
let app, db, env, auth, claims, operation;
const profile = (uid, role, owner) => ({uid, firebaseUid: 'auth-' + uid, role, name: 'Nombre ficticio',
  email: uid + '@example.test', pending: false, profileComplete: true, ...(owner ? {createdBy: owner} : {}),
  ...(role === 'doctor' ? {consultationDuration: 30, allowPatientScheduling: true,
    timeSegmentsByDay: {Lun: [{startTime: '09:00', endTime: '12:00'}]}} : {})});
const child = (id, doctorId, email = 'family@example.test', secondaryEmail = '') => ({id, doctorId,
  name: 'Paciente ficticio', lastName: id, birthDate: '2020-01-01', fatherName: 'Tutor ficticio',
  motherName: 'Tutora ficticia', phone: '5555555555', email, secondaryEmail, profileComplete: false});
const header = actor => 'Bearer ' + actor;
const mutate = (actor, operationName, entityId, data = {}, patientId, operationId = 'op-' + (++operation)) =>
  mutateClinicData(db, auth, header(actor), {operation: operationName, entityId, data, operationId,
    ...(patientId ? {patientId} : {})}, {...security,...(actor.startsWith('patient-')?{patientToken:claims.get(actor)}:{})});
const read = async path => (await db.doc(path).get()).data();
const login = async () => {
  const credential = await read('patientCredentials/p1');
  const result = await authenticateClinicPatient(db, {email: 'family@example.test', password: decryptPatientPassword(credential, encryptionSecret)},
    {enabled: true, now: NOW, limiterSecret: uniquenessSecret, transportAddress: '127.0.0.1'});
  const token=await db.runTransaction(tx=>readPatientBearer(tx,db,result.token,NOW));
  claims.set(token.uid,token);return token.uid;
};
before(async () => {
  env = await initializeTestEnvironment({projectId: PROJECT, firestore: {host: '127.0.0.1', port: 8187,
    rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8')}});
  app = initializeApp({projectId: PROJECT}, 'p01-business-isolated');
  db = getFirestore(app);
});
beforeEach(async () => {
  await env.clearFirestore(); operation = 0; claims = new Map();
  auth = {
    verifyIdToken: async (uid, revoked) => {assert.equal(revoked, true); if (!claims.has(uid)) throw new Error('unbound'); return claims.get(uid);},
    createCustomToken: async (uid, tokenClaims) => {claims.set(uid, {uid, ...tokenClaims, firebase: {sign_in_provider: 'custom'}}); return 'synthetic-not-a-real-token';},
  };
  for (const [uid, role, owner] of [['d1','doctor'], ['d2','doctor'], ['admin','admin'], ['s1','assistant','d1'], ['s2','assistant','d2']]) {
    const user = profile(uid, role, owner);
    await db.doc('users/' + uid).set(user);
    await db.doc('securityPrincipals/auth-' + uid).set({authUid: 'auth-' + uid, userId: uid, role, active: true,
      ...(role === 'doctor' ? {doctorId: uid} : owner ? {doctorId: owner} : {})});
    await db.doc('clinicSessions/lease-' + uid).set({authUid: 'auth-' + uid, role, active: true,
      expiresAt: Timestamp.fromMillis(NOW + 3600000)});
    claims.set('auth-' + uid, {uid: 'auth-' + uid, clinicSessionId: 'lease-' + uid, firebase: {sign_in_provider: 'custom'}});
  }
  for (const patient of [child('p1','d1'), child('p2','d1','other@example.test','family@example.test'),
    child('p3','d1','unrelated@example.test'), child('p4','d2')]) {
    await db.doc('patients/' + patient.id).set(patient);
    await db.doc('patientDirectory/' + patient.id).set(patient);
    const credential = await prepareNewPatientCredential(patient, encryptionSecret, uniquenessSecret, NOW);
    await db.runTransaction(tx => claimNewPatientCredential(tx, db, credential));
  }
});
after(async () => {await db?.terminate(); if (app) await deleteApp(app); await env?.cleanup();});

async function legacyStaff() {
  const doctorId='doctor.legacy+test@example.invalid'; const assistantId='assistant.legacy@example.invalid';
  for(const [uid,authUid,role,owner] of [[doctorId,'auth-legacy-doctor','doctor'],[assistantId,'auth-legacy-assistant','assistant',doctorId]]) {
    const user={...profile(uid,role,owner),firebaseUid:authUid,email:role+'@example.invalid'};
    await db.doc('users/'+uid).set(user);
    await db.doc('securityPrincipals/'+authUid).set({authUid,userId:uid,role,active:true,doctorId:owner??uid});
    const sessionId='lease-'+authUid;
    await db.doc('clinicSessions/'+sessionId).set({authUid,role,active:true,expiresAt:Timestamp.fromMillis(NOW+3600000)});
    claims.set(authUid,{uid:authUid,clinicSessionId:sessionId,firebase:{sign_in_provider:'custom'}});
  }
  return {doctorId,assistantId};
}

test('legacy staff document IDs preserve Auth bindings, self/profile editing and Assistant schedule restrictions',async()=>{
  const {doctorId,assistantId}=await legacyStaff();
  claims.set('legacy-password',{uid:'auth-legacy-doctor',firebase:{sign_in_provider:'password'}});
  await openClinicStaffSession(db,auth,header('legacy-password'),NOW);
  assert.equal((await db.runTransaction(tx=>readClinicPrincipal(tx,db,claims.get('auth-legacy-doctor'),NOW))).userId,doctorId);
  await mutate('auth-legacy-doctor','profile.update',doctorId,{name:'Doctor revisado'});
  await mutate('auth-legacy-assistant','profile.update',assistantId,{name:'Asistente revisado'});
  await mutate('auth-legacy-assistant','schedule.update',doctorId,{consultationDuration:20});
  assert.equal((await read('users/'+doctorId)).firebaseUid,'auth-legacy-doctor');
  assert.equal((await read('users/'+doctorId)).consultationDuration,20);
  assert.equal((await read('users/'+assistantId)).createdBy,doctorId);
  await assert.rejects(mutate('auth-legacy-assistant','schedule.update',doctorId,{allowPatientScheduling:false}),{code:'permission-denied'});
  await assert.rejects(mutate('auth-d2','profile.update',doctorId,{name:'Ajeno'}),{code:'permission-denied'});
  await assert.rejects(mutate('auth-legacy-assistant','profile.update',doctorId,{name:'Ajeno'}),{code:'permission-denied'});
  await assert.rejects(mutate('auth-legacy-doctor','profile.update','../profile',{name:'Ajeno'}),{code:'invalid-argument'});
  await assert.rejects(mutate('auth-legacy-doctor','profile.update',doctorId,{name:'Inválido'},undefined,'op@example.invalid'),{code:'invalid-argument'});
});

test('legacy Doctor owner supports new credentials, Patient memory portal and appointments without widening clinical IDs',async()=>{
  const {doctorId}=await legacyStaff();
  const data={...child('not-sent',doctorId,'legacy-family@example.invalid')}; delete data.id;delete data.doctorId;delete data.profileComplete;
  const created=await createClinicPatientRecord(db,auth,header('auth-legacy-assistant'),{operationId:'legacy-new-patient',patient:data},security);
  const patient=created.patient;assert.equal(patient.doctorId,doctorId);assert.equal('password' in created,false);
  const credential=await read('patientCredentials/'+patient.id);
  const access=await authenticateClinicPatient(db,{email:data.email,password:decryptPatientPassword(credential,encryptionSecret)},
    {enabled:true,now:NOW,limiterSecret:uniquenessSecret,transportAddress:'127.0.0.1'});
  const token=await db.runTransaction(tx=>readPatientBearer(tx,db,access.token,NOW));claims.set(token.uid,token);
  await mutate('auth-legacy-assistant','appointment.create','legacy-a1',{patientId:patient.id,date:'2030-01-07',time:'09:00'});
  const portal=await readPatientPortal(db,{sessionToken:access.token,action:'appointments',data:{}},NOW);
  assert.equal(portal.value[0].doctorId,doctorId);
  assert.equal((await read('appointments/legacy-a1')).patientId,patient.id);
  await assert.rejects(mutate('auth-legacy-doctor','appointment.create','appointment@example.invalid',{patientId:patient.id,date:'2030-01-07',time:'10:00'}),{code:'invalid-argument'});
  await assert.rejects(mutate('auth-legacy-doctor','patient.update','patient@example.invalid',{name:'No'}),{code:'invalid-argument'});
  await assert.rejects(mutate('auth-legacy-assistant','record.create','legacy-r1',{motivoConsulta:'No'},patient.id),{code:'permission-denied'});
});

test('server derives owner and actor, commits minimal occupancy, audit and scoped notices once', async () => {
  const data = {patientId: 'p1', date: '2030-01-07', time: '09:00'};
  await mutate('auth-s1', 'appointment.create', 'a1', data, undefined, 'same-request');
  await mutate('auth-s1', 'appointment.create', 'a1', data, undefined, 'same-request');
  const appointment = await read('appointments/a1');
  assert.equal(appointment.doctorId, 'd1'); assert.equal(appointment.updatedBy, 's1@example.test');
  assert.deepEqual(await read('appointmentSlots/a1'), {id: 'a1', doctorId: 'd1', date: data.date, time: data.time});
  const notices = (await db.collection('notifications').get()).docs.map(doc => doc.data());
  assert.deepEqual(notices.map(n => n.recipientId).sort(), ['d1','p1','p2','s1']);
  assert.equal(notices.find(n => n.recipientId === 's1').read, true);
  assert.equal(notices.filter(n => n.recipientId !== 's1').every(n => n.read === false), true);
  assert.equal((await db.collection('auditLog').get()).size, 1);
  await assert.rejects(mutate('auth-s1','appointment.create','a1',{...data,time:'10:00'},undefined,'same-request'), {code:'aborted'});
  await assert.rejects(mutate('auth-s1','appointment.create','forged',{...data,doctorId:'d2'}), {code:'invalid-argument'});
});
test('Doctor isolation and clinical editing restrictions survive direct endpoint requests', async () => {
  await assert.rejects(mutate('auth-d2','patient.update','p1',{name:'Ajeno'}), {code:'permission-denied'});
  await assert.rejects(mutate('auth-s1','patient.update','p1',{name:'Ajeno'}), {code:'permission-denied'});
  await assert.rejects(mutate('auth-admin','record.create','r1',{motivoConsulta:'Consulta'},'p1'), {code:'permission-denied'});
  await assert.rejects(mutate('auth-s1','record.create','r1',{motivoConsulta:'Consulta'},'p1'), {code:'permission-denied'});
  await assert.rejects(mutate('auth-d1','patient.update','p1',{otpPassword:'manual'}), {code:'invalid-argument'});
  await assert.rejects(mutate('auth-s1','appointment.create','foreign',{patientId:'p4',date:'2030-01-07',time:'09:00'}), {code:'permission-denied'});
});
test('Assistant saves a closed week, cannot set patient permission, reopening preserves closure', async () => {
  await assert.rejects(mutate('auth-s1','schedule.update','d1',{allowPatientScheduling:false}), {code:'permission-denied'});
  await mutate('auth-s1','schedule.update','d1',{consultationDuration:45,timeSegmentsByDay:{}});
  const doctor = await read('users/d1'); const saved = await read('schedules/d1');
  assert.equal(doctor.allowPatientScheduling,true); assert.equal(saved.consultationDuration,45);
  assert.equal(Object.keys(saved.timeSegmentsByDay).length,7);
  assert.equal(Object.values(clinicScheduleFromUser(doctor).timeSegmentsByDay).every(list=>list.length===0),true);
  const patientActor = await login();
  await assert.rejects(mutate(patientActor,'appointment.create','a1',{patientId:'p1',date:'2030-01-07',time:'09:00'}),{code:'failed-precondition'});
});
test('cancelled appointment frees the slot, patient cannot book another live appointment', async () => {
  const data = {patientId:'p1',date:'2030-01-07',time:'09:00'};
  await mutate('auth-d1','appointment.create','a1',data);
  const patientActor = await login();
  await assert.rejects(mutate(patientActor,'appointment.create','a2',data),{code:'already-exists'});
  await mutate('auth-d1','appointment.update','a1',{status:'cancelled'});
  assert.equal(await read('appointmentSlots/a1'),undefined);
  await mutate(patientActor,'appointment.create','a2',data);
  assert.equal((await read('appointments/a2')).status,'scheduled');
});
test('patient may keep an own time excluded from availability, but another live booking still counts', async () => {
  const data = {patientId:'p1',date:'2030-01-07',time:'09:00'};
  await mutate('auth-d1','appointment.create','a1',data);
  await mutate('auth-d1','schedule.update','d1',{timeSegmentsByDay:{}});
  const patientActor = await login();
  await mutate(patientActor,'appointment.update','a1',{notes:'Conservar hora'});
  await db.doc('appointments/another').set({...data,id:'another',doctorId:'d1',disabled:false,status:'scheduled'});
  await assert.rejects(mutate(patientActor,'appointment.update','a1',{notes:'Otra modificación'}),{code:'already-exists'});
});
test('disabled patient scheduling also prevents cancellation while clinic staff can cancel', async () => {
  await mutate('auth-d1','appointment.create','a1',{patientId:'p1',date:'2030-01-07',time:'09:00'});
  await mutate('auth-d1','schedule.update','d1',{allowPatientScheduling:false});
  const patientActor = await login();
  await assert.rejects(mutate(patientActor,'appointment.update','a1',{status:'cancelled'}),{code:'permission-denied'});
  await mutate('auth-s1','appointment.update','a1',{status:'cancelled'});
});
test('patient cannot mark attendance, change patient, forge identity or use unrelated family records', async () => {
  const patientActor = await login();
  await mutate(patientActor,'appointment.create','a1',{patientId:'p2',date:'2030-01-07',time:'09:00'});
  assert.equal((await read('appointments/a1')).updatedBy,'family@example.test');
  const notices = (await db.collection('notifications').get()).docs.map(doc=>doc.data());
  assert.equal(notices[0].originatorName,'Paciente ficticio p1');
  await assert.rejects(mutate(patientActor,'appointment.update','a1',{patientId:'p1'}),{code:'permission-denied'});
  await assert.rejects(mutate(patientActor,'appointment.update','a1',{status:'attended'}),{code:'permission-denied'});
  await assert.rejects(mutate(patientActor,'appointment.create','a2',{patientId:'p3',date:'2030-01-07',time:'09:30'}),{code:'permission-denied'});
});
test('all same-day live publications remain accessible without private consultation fields', async () => {
  const data = {motivoConsulta:'Dato clínico privado ficticio', diagnosis:'Diagnóstico privado ficticio', notas:'Notas privadas ficticias', weight:10,
    prescription:'<p>Receta ficticia</p>', recommendations:'<p>Recomendación ficticia</p>', visibleUntil:'2030-01-07', visibleUntilRx:''};
  await mutate('auth-d1','record.create','older',data,'p1');
  const created = (await read('clinicalRecords/older')).createdAt;
  await mutateClinicData(db,auth,header('auth-d1'),{operation:'record.create',entityId:'newer',patientId:'p1',operationId:'later-record',data}, {...security,now:NOW+1000});
  await mutateClinicData(db,auth,header('auth-d1'),{operation:'record.update',entityId:'older',operationId:'edit-old',data:{prescription:'<p>Corrección</p>'}}, {...security,now:NOW+2000});
  assert.equal((await read('clinicalRecords/older')).createdAt.isEqual(created),true);
  const patientActor = await login();
  const result = await readClinicPublications(db,auth,header(patientActor),{patientId:'p1'},{...security,patientToken:claims.get(patientActor)});
  assert.equal(result.records.length,2);
  for (const record of result.records) {
    assert.equal('diagnosis' in record,false); assert.equal('notas' in record,false); assert.equal('weight' in record,false);
    assert.equal(record.motivoConsulta,''); assert.equal(record.createdBy,'');
    assert.ok(record.prescription); assert.ok(record.recommendations);
  }
  await assert.rejects(readClinicPublications(db,auth,header(patientActor),{patientId:'p3'},{...security,patientToken:claims.get(patientActor)}),{code:'permission-denied'});
  await assert.rejects(mutate('auth-d1','record.update','older',{date:'2030-01-08'}),{code:'invalid-argument'});
});
test('publication expiry uses inclusive Mexico day; stale or deleted sources are not served', async () => {
  assert.equal(clinicPublicationExpiry('2030-01-07').toMillis(),Date.parse('2030-01-08T06:00:00Z'));
  await mutate('auth-d1','record.create','r1',{motivoConsulta:'Consulta',recommendations:'<p>Consejo</p>',visibleUntil:'2030-01-07'},'p1');
  const patientActor = await login();
  const expires = clinicPublicationExpiry('2030-01-07').toMillis();
  await db.doc('clinicSessions/'+claims.get(patientActor).clinicSessionId).update({expiresAt:Timestamp.fromMillis(expires+3600000)});
  assert.equal((await readClinicPublications(db,auth,header(patientActor),{patientId:'p1'},{enabled:true,now:expires-1,patientToken:claims.get(patientActor)})).records.length,1);
  assert.equal((await readClinicPublications(db,auth,header(patientActor),{patientId:'p1'},{enabled:true,now:expires,patientToken:claims.get(patientActor)})).records.length,0);
  await db.doc('clinicalRecords/r1').update({updatedAt:Timestamp.fromMillis(NOW+1)});
  assert.equal((await readClinicPublications(db,auth,header(patientActor),{patientId:'p1'},{...security,patientToken:claims.get(patientActor)})).records.length,0);
  await db.doc('clinicalRecords/r1').delete();
  assert.equal((await readClinicPublications(db,auth,header(patientActor),{patientId:'p1'},{...security,patientToken:claims.get(patientActor)})).records.length,0);
});
test('sanitizer preserves supported editor formatting and excludes executable content',()=>{
  const html = sanitizeClinicDocument('<p class="ql-align-center" style="color: #ff0000" onclick="bad()">Consejo</p><script>bad()</script><img src="data:image/svg+xml;base64,AAAA"><a href="javascript:bad()">Enlace</a>');
  assert.ok(html.includes('ql-align-center')); assert.ok(html.includes('#ff0000'));
  assert.equal(/onclick|script|javascript:|svg\+xml/.test(html),false);
});
test('server metric validators reject zero and invalid date without invented physiological limits',async()=>{
  await assert.rejects(mutate('auth-d1','record.create','r1',{motivoConsulta:'Consulta',weight:0},'p1'),{code:'invalid-argument'});
  await assert.rejects(mutate('auth-d1','patient.update','p1',{birthDate:'2030-02-30'}),{code:'invalid-argument'});
  await mutate('auth-d1','record.create','r1',{motivoConsulta:'Consulta',weight:500},'p1');
});
test('optional patient circumference may be cleared without a zero measurement',async()=>{
  await mutate('auth-d1','patient.update','p1',{headCircumference:35});
  await mutate('auth-d1','patient.update','p1',{headCircumference:null});
  assert.equal((await read('patients/p1')).headCircumference,null);
  await assert.rejects(mutate('auth-d1','patient.update','p1',{headCircumference:0}),{code:'invalid-argument'});
});
test('Assistant-created patient mail retries only failed saved destinations, never returns password',async()=>{
  const fields = {...child('ignored','ignored','new@example.test','second@example.test')};
  for (const field of ['id','doctorId','profileComplete']) delete fields[field];
  const input = {operationId:'create-from-assistant',patient:fields};
  const created = await createClinicPatientRecord(db,auth,header('auth-s1'),input,security);
  assert.equal(created.status,'created'); assert.equal('otpPassword' in created.patient,false);
  const repeated = await createClinicPatientRecord(db,auth,header('auth-s1'),input,security);
  assert.equal(repeated.patient.id,created.patient.id);
  const sent = []; let secondaryFails = true;
  const sender = async mail => {sent.push(mail.to); if(mail.to==='second@example.test'&&secondaryFails) throw new Error('Synthetic failure');};
  const mailInput = {kind:'patient-access',patientId:created.patient.id,creationOperationId:input.operationId,operationId:'mail-original'};
  const first = await deliverClinicEmail(db,auth,header('auth-s1'),mailInput,security,sender);
  assert.deepEqual(first,{success:false,deliveries:[{destination:'primary',sent:true},{destination:'secondary',sent:false}]});
  assert.equal(JSON.stringify(first).includes('password'),false);
  secondaryFails = false;
  const retry = await deliverClinicEmail(db,auth,header('auth-s1'),mailInput,security,sender);
  assert.equal(retry.success,true); assert.deepEqual(sent,['new@example.test','second@example.test','second@example.test']);
  await assert.rejects(deliverClinicEmail(db,auth,header('auth-s1'),{...mailInput,creationOperationId:'wrong'},security,sender),{code:'permission-denied'});
  await assert.rejects(deliverClinicEmail(db,auth,header('auth-s2'),mailInput,security,sender),{code:'permission-denied'});
  assert.equal((await read('patientSessionStatus/'+created.patient.id)).credentialVersion,1);
});
test('identical saved primary/secondary emails produce one delivery and arbitrary addresses are rejected',async()=>{
  await db.doc('patients/p1').update({secondaryEmail:'family@example.test'});
  const sent=[]; const input={kind:'patient-access',patientId:'p1',operationId:'mail1'};
  const result=await deliverClinicEmail(db,auth,header('auth-d1'),input,security,async mail=>sent.push(mail.to));
  assert.equal(result.deliveries.length,1); assert.deepEqual(sent,['family@example.test']);
  await assert.rejects(deliverClinicEmail(db,auth,header('auth-d1'),{...input,email:'attacker@example.test'},security,async()=>{}),{code:'invalid-argument'});
});
test('contact update preserves password, rotates version, signals revocation and invalidates old session',async()=>{
  const before=await read('patientCredentials/p1'); const password=decryptPatientPassword(before,encryptionSecret);
  const patientActor=await login();
  await mutate('auth-d1','patient.update','p1',{email:'changed@example.test'});
  const after=await read('patientCredentials/p1');
  assert.equal(decryptPatientPassword(after,encryptionSecret),password); assert.equal(after.credentialVersion,2);
  assert.equal((await read('patientSessionStatus/p1')).credentialVersion,2);
  await assert.rejects(db.runTransaction(tx=>readClinicPrincipal(tx,db,claims.get(patientActor),NOW)),{code:'permission-denied'});
});
test('only owner Doctor renews access; renewal invalidates sessions and publishes minimal status',async()=>{
  const previous=await read('patientCredentials/p1'); const patientActor=await login();
  const input={patientId:'p1',operationId:'rotate',expectedVersion:1,expectedEpoch:previous.credentialEpoch};
  await assert.rejects(managePatientCredential(db,auth,header('auth-s1'),'rotate',input,security),{code:'permission-denied'});
  await managePatientCredential(db,auth,header('auth-d1'),'rotate',input,security);
  assert.equal((await read('patientSessionStatus/p1')).credentialVersion,2);
  assert.equal(await read('patientPasswordReservations/'+previous.passwordFingerprint),undefined);
  await assert.rejects(db.runTransaction(tx=>readClinicPrincipal(tx,db,claims.get(patientActor),NOW)),{code:'permission-denied'});
});
test('patient deletion removes sources/projections/active reservation while preserving audit and replay marker',async()=>{
  await mutate('auth-d1','appointment.create','a1',{patientId:'p1',date:'2030-01-07',time:'09:00'});
  await mutate('auth-d1','record.create','r1',{motivoConsulta:'Consulta',prescription:'<p>Receta</p>'},'p1');
  const credential=await read('patientCredentials/p1');
  await mutate('auth-d1','patient.delete','p1',{},undefined,'delete-once');
  await mutate('auth-d1','patient.delete','p1',{},undefined,'delete-once');
  for (const path of ['patients/p1','patientDirectory/p1','patientPortal/p1','patientSessionStatus/p1','patientCredentials/p1',
    'patientPasswordReservations/'+credential.passwordFingerprint,'clinicalRecords/r1','patientDocuments/r1-prescription','appointments/a1','appointmentSlots/a1']) assert.equal(await read(path),undefined,path);
  assert.equal((await read('patientDeletionJobs/p1')).completed,true);
  assert.equal((await db.collection('auditLog').get()).size,3);
  assert.equal((await db.collection('notifications').get()).empty,true);
});
test('inactive, expired and stale-role leases deny endpoint mutations',async()=>{
  await db.doc('clinicSessions/lease-d1').update({expiresAt:Timestamp.fromMillis(NOW)});
  await assert.rejects(mutate('auth-d1','patient.update','p1',{name:'Cambio'}),{code:'permission-denied'});
  await db.doc('clinicSessions/lease-d1').update({expiresAt:Timestamp.fromMillis(NOW+3600000),active:false});
  await assert.rejects(mutate('auth-d1','patient.update','p1',{name:'Cambio'}),{code:'permission-denied'});
  await db.doc('clinicSessions/lease-d1').update({active:true,role:'admin'});
  await assert.rejects(mutate('auth-d1','patient.update','p1',{name:'Cambio'}),{code:'permission-denied'});
});
test('staff opening requires password authentication and keeps the existing Auth UID',async()=>{
  await assert.rejects(openClinicStaffSession(db,auth,header('auth-d1'),NOW),{code:'permission-denied'});
  claims.set('auth-d1',{uid:'auth-d1',firebase:{sign_in_provider:'password'}});
  const result=await openClinicStaffSession(db,auth,header('auth-d1'),NOW);
  assert.equal(result.token,'synthetic-not-a-real-token'); assert.ok(claims.get('auth-d1').clinicSessionId);
  const lease=await read('clinicSessions/'+claims.get('auth-d1').clinicSessionId);
  assert.equal(lease.authUid,'auth-d1'); assert.equal(lease.expiresAt.toMillis(),NOW+3600000);
});
test('staff invitation and email changes recheck the signed device lease inside their transactions',async()=>{
  const actor={authUid:'auth-admin',userId:'admin',role:'admin',active:true,clinicSessionId:'lease-admin'};
  await db.doc('clinicSessions/lease-admin').update({expiresAt:Timestamp.fromMillis(Date.now()-1)});
  await assert.rejects(issueInvitation(db,auth,actor,{action:'create',name:'Ficticio',email:'invite@example.test',operationId:'invite'},true),{code:'permission-denied'});
  await assert.rejects(changeStaffEmail(db,auth,actor,{userId:'d1',email:'changed@example.test',expectedEmail:'d1@example.test',operationId:'email'},true),{code:'permission-denied'});
  assert.equal((await db.collection('staffInvitationIssueJobs').get()).empty,true);
  assert.equal((await db.collection('staffEmailChangeJobs').get()).empty,true);
});
test('recovery returns the same acknowledgement for unknown and known accounts; only trusted staff receive a link',async()=>{
  const sent=[];
  auth.getUserByEmail=async email=>{
    if(email!=='d1@example.test')throw Object.assign(new Error('Synthetic missing account'),{code:'auth/user-not-found'});
    return {uid:'auth-d1',email,disabled:false};
  };
  auth.generatePasswordResetLink=async()=> 'https://synthetic.example/action?oobCode=synthetic-code-not-real&apiKey=omitted';
  const options={enabled:true,limiterSecret:uniquenessSecret,transportAddress:'127.0.0.1',now:NOW};
  const unknown=await requestClinicPasswordReset(db,auth,{email:'unknown@example.test'},options,async mail=>sent.push(mail));
  assert.deepEqual(unknown,{success:true});assert.equal(sent.length,0);
  assert.deepEqual(await requestClinicPasswordReset(db,auth,{email:' D1@EXAMPLE.TEST '},options,async mail=>sent.push(mail)),unknown);
  assert.equal(sent.length,1);assert.equal(sent[0].to,'d1@example.test');
  assert.ok(sent[0].html.includes('https://lilcare.com.mx/reset-password?oobCode='));assert.equal(sent[0].html.includes('apiKey'),false);
  await db.doc('securityPrincipals/auth-d1').update({active:false});
  assert.deepEqual(await requestClinicPasswordReset(db,auth,{email:'d1@example.test'},options,async mail=>sent.push(mail)),unknown);
  assert.equal(sent.length,1);
  await assert.rejects(requestClinicPasswordReset(db,auth,{email:'d1@example.test',html:'arbitrary'},options,async()=>{}),{code:'invalid-argument'});
});
