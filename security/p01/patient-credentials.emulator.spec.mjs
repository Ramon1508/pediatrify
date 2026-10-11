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
const {prepareNewPatientCredential, preparePatientCredentialContacts, decryptPatientPassword,
  managePatientCredential, claimNewPatientCredential, patientPasswordFingerprint} = require('./lib/patient-credentials.js');
const {authenticateClinicPatient, readClinicPrincipal, readClinicFamilyPatient} = require('./lib/clinic-auth.js');
const {createClinicPatientRecord}=require('./lib/clinic-patients.js');
let app, db, env, auth, initial, issued;
const encryptionSecret = randomBytes(32).toString('hex');
const uniquenessSecret = randomBytes(32).toString('hex');
const limiterSecret = randomBytes(32).toString('hex');
const options = () => ({enabled:true,encryptionSecret,uniquenessSecret,now:1790000000000});
const loginOptions = () => ({enabled:true,limiterSecret,transportAddress:'127.0.0.1',now:Date.now()});
const ownedPatient = {id:'p1',doctorId:'d1',name:'Niño sintético',lastName:'Ejemplo',birthDate:'2020-01-01',
  email:'family@example.test',secondaryEmail:'secondary@example.test',fatherName:'Tutor',motherName:'Tutora'};
const staff = (uid,role='doctor') => ({uid,firebaseUid:'auth-'+uid,role,pending:false,profileComplete:true,name:'Usuario sintético',
  ...(role==='assistant'?{createdBy:'d1'}:{})});
const principal = (uid,role='doctor') => ({authUid:'auth-'+uid,userId:uid,role,active:true,
  ...(role==='doctor'?{doctorId:uid}:role==='assistant'?{doctorId:'d1'}:{})});

before(async()=> {
  env = await initializeTestEnvironment({projectId:PROJECT,firestore:{host:'127.0.0.1',port:8187,
    rules:readFileSync(new URL('./firestore.prototype.rules',import.meta.url),'utf8')}});
  app = initializeApp({projectId:PROJECT},'p01-patient-credentials-isolated');
  db = getFirestore(app);
});
beforeEach(async()=> {
  await env.clearFirestore();
  issued = [];
  auth = {
    verifyIdToken:async(token,revoked)=> {
      assert.equal(revoked,true);
      if(token==='revoked') throw new Error('Private SDK detail');
      return {uid:token,clinicSessionId:'lease-'+token};
    },
    createCustomToken:async(uid,claims)=>{issued.push({uid,...claims});return 'synthetic-not-a-real-token';},
  };
  for(const [uid,role] of [['d1','doctor'],['d2','doctor'],['admin','admin'],['assistant','assistant']]) {
    await db.doc('users/'+uid).set(staff(uid,role));
    await db.doc('securityPrincipals/auth-'+uid).set(principal(uid,role));
    await db.doc('clinicSessions/lease-auth-'+uid).set({authUid:'auth-'+uid,role,active:true,expiresAt:Timestamp.fromMillis(Date.now()+3600000)});
  }
  for(const child of [ownedPatient,{...ownedPatient,id:'p2',doctorId:'d2'},
    {...ownedPatient,id:'sibling',secondaryEmail:'',email:'family@example.test'}]) {
    await db.doc('patients/'+child.id).set(child);
    const credential=await prepareNewPatientCredential(child,encryptionSecret,uniquenessSecret);
    await db.runTransaction(tx=>claimNewPatientCredential(tx,db,credential));
  }
  initial = (await db.doc('patientCredentials/p1').get()).data();
});
after(async()=> {await db?.terminate();if(app) await deleteApp(app);await env?.cleanup();});
const access = (uid='auth-d1',patientId='p1') => managePatientCredential(db,auth,'Bearer '+uid,'read',{patientId},options());
const rotation = (patch={}) => ({patientId:'p1',operationId:'rotate-1',expectedVersion:initial.credentialVersion,
  expectedEpoch:initial.credentialEpoch,...patch});
const renew = (input=rotation(),uid='auth-d1') => managePatientCredential(db,auth,'Bearer '+uid,'rotate',input,options());
const {readPatientBearer}=require('./lib/clinic-patient-token.js');
const login = async (password=decryptPatientPassword(initial,encryptionSecret),email=ownedPatient.email) => {
  const result=await authenticateClinicPatient(db,{email,password},loginOptions());
  issued.push(await db.runTransaction(tx=>readPatientBearer(tx,db,result.token))); return result;
};
const validSession = (token) => db.runTransaction(tx=>readClinicPrincipal(tx,db,token));

test('authorized creation commits credential, global reservation, minimal projections and audit without returning a password',async()=> {
  const patient={name:'Nuevo',lastName:'Ejemplo',birthDate:'2020-01-01',email:'new@example.test',fatherName:'Tutor',motherName:'Tutora',phone:'5555555555'};
  const input={operationId:'new-patient-op',patient};
  const result=await createClinicPatientRecord(db,auth,'Bearer auth-assistant',input,options());
  assert.equal(result.status,'created');assert.equal(result.patient.doctorId,'d1');
  assert.equal('otpPassword' in result.patient,false);assert.equal('password' in result.patient,false);
  const credential=(await db.doc('patientCredentials/'+result.patient.id).get()).data();
  const password=decryptPatientPassword(credential,encryptionSecret);
  assert.equal(JSON.stringify(result).includes(password),false);
  assert.equal((await db.doc('patientPasswordReservations/'+credential.passwordFingerprint).get()).data().patientId,result.patient.id);
  const portal=(await db.doc('patientPortal/'+result.patient.id).get()).data();
  assert.equal('email' in portal,false);assert.equal('verifier' in portal,false);
  assert.deepEqual(await createClinicPatientRecord(db,auth,'Bearer auth-assistant',input,options()),result);
  assert.equal((await db.collection('patientCreationOperations').get()).size,1);
  assert.equal((await db.collection('auditLog').get()).size,1);
});

test('Admin cannot create a patient and an Admin-owned testing Assistant cannot use a Doctor agenda',async()=> {
  const patient={name:'Nuevo',lastName:'Ejemplo',birthDate:'2020-01-01',email:'new@example.test',fatherName:'Tutor',motherName:'Tutora',phone:'5555555555'};
  const input={operationId:'new-patient-op',patient};
  await assert.rejects(createClinicPatientRecord(db,auth,'Bearer auth-admin',input,options()),{code:'permission-denied'});
  await db.doc('users/assistant').update({createdBy:'admin'});
  await db.doc('securityPrincipals/auth-assistant').update({doctorId:'admin'});
  await assert.rejects(createClinicPatientRecord(db,auth,'Bearer auth-assistant',input,options()),{code:'permission-denied'});
  assert.equal((await db.collection('patientCreationOperations').get()).empty,true);
});

test('current email and name duplicates require separate confirmations, scoped to the Doctor',async()=> {
  await db.doc('patients/p1').update({fullNameKey:JSON.stringify(['nuevo','ejemplo'])});
  const patient={name:'Nuevo',lastName:'Ejemplo',birthDate:'2020-01-01',email:'family@example.test',fatherName:'Tutor',motherName:'Tutora',phone:'5555555555'};
  const input={operationId:'confirmed-patient-op',patient};
  const first=await createClinicPatientRecord(db,auth,'Bearer auth-d1',input,options());
  assert.deepEqual(first,{status:'confirmation-required',warnings:['email','name']});
  const second=await createClinicPatientRecord(db,auth,'Bearer auth-d1',{...input,confirmedDuplicates:['email']},options());
  assert.deepEqual(second,{status:'confirmation-required',warnings:['name']});
  assert.equal((await db.collection('patientCreationOperations').get()).empty,true);
  const result=await createClinicPatientRecord(db,auth,'Bearer auth-d1',{...input,confirmedDuplicates:['email','name']},options());
  assert.equal(result.status,'created');
  await assert.rejects(createClinicPatientRecord(db,auth,'Bearer auth-d1',{...input,patient:{...patient,phone:'6666666666'},confirmedDuplicates:['email','name']},options()),{code:'aborted'});
});

test('parallel retries of a new patient create a single patient/credential with the same server-derived ID',async()=> {
  const patient={name:'Nuevo',lastName:'Ejemplo',birthDate:'2020-01-01',email:'new@example.test',fatherName:'Tutor',motherName:'Tutora',phone:'5555555555'};
  const input={operationId:'parallel-create',patient};
  const results=await Promise.all([createClinicPatientRecord(db,auth,'Bearer auth-d1',input,options()),
    createClinicPatientRecord(db,auth,'Bearer auth-d1',input,options())]);
  assert.deepEqual(results[0],results[1]);
  assert.equal((await db.collection('patients').get()).size,4);
  assert.equal((await db.collection('patientCredentials').get()).size,4);
  assert.equal((await db.collection('patientPasswordReservations').get()).size,4);
});

test('a collision with another Doctor or the previous access generates another candidate without overwriting either',async()=> {
  const foreign=(await db.doc('patientCredentials/p2').get()).data();
  const otherPassword=decryptPatientPassword(foreign,encryptionSecret);
  const ownPassword=decryptPatientPassword(initial,encryptionSecret);
  const passwords=[otherPassword,ownPassword,'Z9Z9Z9'];
  let generated=0;
  const result=await managePatientCredential(db,auth,'Bearer auth-d1','rotate',rotation(),
    {...options(),generatePassword:()=>passwords[generated++]});
  assert.equal(generated,3);
  assert.equal(result.password,'Z9Z9Z9');
  assert.equal((await db.doc('patientCredentials/p2').get()).data().verifier.hash,foreign.verifier.hash);
  const reservation=await db.doc('patientPasswordReservations/'+patientPasswordFingerprint(result.password,uniquenessSecret)).get();
  assert.equal(reservation.data().patientId,'p1');
  assert.equal((await db.doc('patientPasswordReservations/'+initial.passwordFingerprint).get()).exists,false);
  assert.equal((await db.collection('patientPasswordReservations').get()).size,3);
});

test('concurrent renewals in different Doctors cannot commit the same generated password',async()=> {
  const second=(await db.doc('patientCredentials/p2').get()).data();
  const generator=(next)=> {let calls=0;return ()=>calls++===0?'Z9Z9Z9':next;};
  const results=await Promise.all([
    managePatientCredential(db,auth,'Bearer auth-d1','rotate',rotation(),{...options(),generatePassword:generator('Y8Y8Y8')}),
    managePatientCredential(db,auth,'Bearer auth-d2','rotate',{patientId:'p2',operationId:'rotate-other',
      expectedVersion:second.credentialVersion,expectedEpoch:second.credentialEpoch},
      {...options(),generatePassword:generator('X7X7X7')}),
  ]);
  assert.notEqual(results[0].password,results[1].password);
  assert.equal((await db.collection('patientPasswordReservations').get()).size,3);
});

test('bounded generation failure makes no partial credential, receipt or audit changes',async()=> {
  const password=decryptPatientPassword(initial,encryptionSecret);let attempts=0;
  await assert.rejects(managePatientCredential(db,auth,'Bearer auth-d1','rotate',rotation(),
    {...options(),generatePassword:()=>{attempts++;return password;}}),{code:'resource-exhausted'});
  assert.equal(attempts,8);
  assert.equal((await db.doc('patientCredentials/p1').get()).data().credentialVersion,1);
  assert.equal((await db.collection('patientCredentialOperations').get()).empty,true);
  assert.equal((await db.collection('auditLog').get()).empty,true);
});

test('new credentials claim a global reservation atomically and never overwrite a colliding patient',async()=> {
  const next=await prepareNewPatientCredential({...ownedPatient,id:'new-child'},encryptionSecret,uniquenessSecret);
  next.passwordFingerprint=initial.passwordFingerprint;
  await assert.rejects(db.runTransaction(tx=>claimNewPatientCredential(tx,db,next)),error=>error.constructor.name==='PatientPasswordCollision');
  assert.equal((await db.doc('patientCredentials/new-child').get()).exists,false);
  assert.equal((await db.doc('patientPasswordReservations/'+initial.passwordFingerprint).get()).data().patientId,'p1');
});

test('only the owner Doctor retrieves the current password; response has no contact or clinical fields',async()=> {
  const result = await access();
  assert.equal(result.password,decryptPatientPassword(initial,encryptionSecret));
  assert.deepEqual(Object.keys(result).sort(),['credentialEpoch','credentialVersion','password']);
  for(const uid of ['auth-d2','auth-admin','auth-assistant','unknown','revoked']) {
    await assert.rejects(access(uid),{code:'permission-denied'});
    await assert.rejects(renew(rotation(),uid),{code:'permission-denied'});
  }
  await login();
  await assert.rejects(access(issued[0].uid),{code:'permission-denied'});
  assert.equal((await db.collection('patientCredentialOperations').get()).empty,true);
});

test('renewing invalidates every device authenticated with that credential; the new password stays reusable',async()=> {
  await login();await login();
  const old = [...issued];
  for(const token of old) assert.equal((await validSession(token)).patientId,'p1');
  const result = await renew();
  assert.equal(result.credentialVersion,2);
  for(const token of old) await assert.rejects(validSession(token),{code:'permission-denied'});
  await assert.rejects(login(),{code:'unauthenticated'});
  await login(result.password);await login(result.password);
  for(const token of issued.slice(2)) assert.equal((await validSession(token)).credentialVersion,2);
  assert.equal((await access()).password,result.password);
});

test('renewal affects its access credential, preserving another sibling login and another Doctor scope',async()=> {
  const sibling = (await db.doc('patientCredentials/sibling').get()).data();
  await login(decryptPatientPassword(sibling,encryptionSecret));
  const token = issued[0];
  await renew();
  assert.equal((await validSession(token)).patientId,'sibling');
  assert.equal((await db.doc('patientCredentials/p2').get()).data().credentialVersion,1);
});

test('parallel retries of the same operation rotate once and return exactly the committed password',async()=> {
  const results = await Promise.all([renew(),renew(),renew()]);
  assert.deepEqual(results[0],results[1]);assert.deepEqual(results[1],results[2]);
  assert.equal(results[0].credentialVersion,2);
  assert.equal((await db.collection('patientCredentialOperations').get()).size,1);
  const audit = await db.collection('auditLog').get();
  assert.equal(audit.size,1);
  assert.equal(JSON.stringify(audit.docs[0].data()).includes(results[0].password),false);
  const reordered = {expectedEpoch:initial.credentialEpoch,expectedVersion:1,operationId:'rotate-1',patientId:'p1'};
  assert.deepEqual(await renew(reordered),results[0]);
});

test('distinct concurrent operations cannot overwrite each other using a stale revision',async()=> {
  const result = await Promise.allSettled([renew(rotation({operationId:'operation-a'})),renew(rotation({operationId:'operation-b'}))]);
  assert.equal(result.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(result.find(x=>x.status==='rejected').reason.code,'aborted');
  assert.equal((await db.doc('patientCredentials/p1').get()).data().credentialVersion,2);
});

test('caller-provided passwords are rejected without rotating or writing an audit',async()=> {
    for(const password of ['SYN234',' 1234 ','different']) await assert.rejects(renew(rotation({password})),{code:'permission-denied'});
    assert.equal((await db.doc('patientCredentials/p1').get()).data().credentialVersion,1);
    assert.equal((await db.collection('auditLog').get()).empty,true);
  });

test('retrying an older successful renewal after a newer renewal cannot return an obsolete password',async()=> {
  await renew();
  await renew(rotation({operationId:'rotate-2',expectedVersion:2}));
  await assert.rejects(renew(),{code:'aborted'});
  assert.equal((await db.doc('patientCredentials/p1').get()).data().credentialVersion,3);
});

test('deleted/recreated credentials cannot resurrect old sessions or accept a stale dialog revision',async()=> {
  await login();const token = issued[0];
  await db.doc('patientCredentials/p1').delete();
  await assert.rejects(validSession(token),{code:'permission-denied'});
  const next=await prepareNewPatientCredential(ownedPatient,encryptionSecret,uniquenessSecret);
  await db.runTransaction(tx=>claimNewPatientCredential(tx,db,next));
  await assert.rejects(validSession(token),{code:'permission-denied'});
  await assert.rejects(renew(),{code:'aborted'});
});

test('current owner/role, deletion jobs and revoked authority are checked before access/rotation',async()=> {
  for(const change of [{role:'assistant'},{pending:true},{profileComplete:false},{firebaseUid:'other-auth'}]) {
    await db.doc('users/d1').set({...staff('d1'),...change});
    await assert.rejects(access(),{code:'permission-denied'});
    await assert.rejects(renew(),{code:'permission-denied'});
  }
  await db.doc('users/d1').set(staff('d1'));
  for(const path of ['staffDeletionJobs/d1','patientDeletionJobs/p1']) {
    await db.doc(path).set({completed:false});
    await assert.rejects(access(),{code:'permission-denied'});
    await assert.rejects(renew(),{code:'permission-denied'});
    await db.doc(path).delete();
  }
  await db.doc('securityPrincipals/auth-d1').update({active:false});
  await assert.rejects(access(),{code:'permission-denied'});
  assert.equal((await db.collection('auditLog').get()).empty,true);
});

test('a deletion in progress prevents login and invalidates a previously issued session',async()=> {
  await login();const token=issued[0];
  await db.doc('patientDeletionJobs/p1').set({completed:false});
  await assert.rejects(validSession(token),{code:'permission-denied'});
  await assert.rejects(login(),{code:'unauthenticated'});
});

test('current family contact validation excludes a sibling that no longer shares the login email',async()=> {
  await login();const token=issued[0];
  const current = await validSession(token);
  await db.doc('patients/sibling').update({email:'changed@example.test'});
  await assert.rejects(db.runTransaction(tx=>readClinicFamilyPatient(tx,db,current,'sibling')),{code:'permission-denied'});
  assert.equal((await validSession(token)).patientId,'p1');
  await db.doc('patients/p1').update({email:'changed@example.test',secondaryEmail:''});
  await assert.rejects(validSession(token),{code:'permission-denied'});
  await assert.rejects(access(),{code:'failed-precondition'});
});

test('an atomic contact update preserves the password, revokes old aliases/sessions and permits login with the new alias',async()=> {
  const password = decryptPatientPassword(initial,encryptionSecret);
  await login();const old=issued[0];
  await db.runTransaction(async tx=> {
    const patientRef=db.doc('patients/p1');const credentialRef=db.doc('patientCredentials/p1');
    const patient=(await tx.get(patientRef)).data();const credential=(await tx.get(credentialRef)).data();
    const next={...patient,email:'new@example.test',secondaryEmail:''};
    tx.set(patientRef,next);
    tx.set(credentialRef,preparePatientCredentialContacts(credential,next,encryptionSecret));
  });
  await assert.rejects(validSession(old),{code:'permission-denied'});
  await assert.rejects(login(password,'family@example.test'),{code:'unauthenticated'});
  await assert.rejects(login(password,'secondary@example.test'),{code:'unauthenticated'});
  await login(password,'new@example.test');
  assert.equal((await validSession(issued[1])).credentialVersion,2);
  assert.equal((await access()).password,password);
});

test('an unavailable encryption key or tampered ciphertext produces no rotation, audit or receipt',async()=> {
  await assert.rejects(managePatientCredential(db,auth,'Bearer auth-d1','rotate',rotation(),
    {...options(),encryptionSecret:randomBytes(32).toString('hex')}),{code:'failed-precondition'});
  await db.doc('patientCredentials/p1').update({'encryptedPassword.tag':'0'.repeat(32)});
  await assert.rejects(renew(),{code:'failed-precondition'});
  assert.equal((await db.collection('auditLog').get()).empty,true);
  assert.equal((await db.collection('patientCredentialOperations').get()).empty,true);
  assert.equal((await db.doc('patientCredentials/p1').get()).data().credentialVersion,1);
});

test('ownership changes during password hashing are rechecked in the committing transaction',async()=> {
  const original = db.runTransaction.bind(db);
  let calls = 0;
  db.runTransaction = async(...args)=> {
    calls++;
    if(calls===2) await db.doc('patients/p1').update({doctorId:'d2'});
    return original(...args);
  };
  try {
    await assert.rejects(renew(),{code:'permission-denied'});
    assert.equal((await db.doc('patientCredentials/p1').get()).data().credentialVersion,1);
    assert.equal((await db.collection('auditLog').get()).empty,true);
  } finally {db.runTransaction=original;}
});
