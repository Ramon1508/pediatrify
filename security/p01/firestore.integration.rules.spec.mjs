import {after, before, beforeEach, test} from 'node:test';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment, assertSucceeds, assertFails} from '@firebase/rules-unit-testing';
import {doc, collection, getDoc, getDocs, query, where, orderBy, limit, setDoc, updateDoc, deleteDoc, writeBatch, Timestamp} from 'firebase/firestore';

const PROJECT='demo-lilcare-p01';
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8187'||(process.env.GCLOUD_PROJECT&&process.env.GCLOUD_PROJECT!==PROJECT)) throw new Error('Use only the local synthetic demo emulator.');
let env;
const epoch='a'.repeat(32);
const profile=(id,role,owner)=>({uid:id,firebaseUid:'auth-'+id,name:'Nombre ficticio',role,pending:false,profileComplete:true,...(owner?{createdBy:owner}:{})});
const authority=(id,role,owner)=>({authUid:'auth-'+id,userId:id,role,active:true,...(role==='doctor'?{doctorId:id}:owner?{doctorId:owner}:{})});
const child=(id,doctorId,email,secondaryEmail='')=>({id,doctorId,name:'Paciente ficticio',lastName:'Ejemplo',email,secondaryEmail,birthDate:'2020-01-01'});
const notice=(id,recipientId,recipientType)=>({id,recipientId,recipientType,doctorId:'d1',type:'appointment-created',title:'Consulta',description:'Aviso ficticio',appointmentId:'a1',originatorId:'d1',originatorName:'Nombre ficticio',read:false,createdAt:Timestamp.now()});
before(async()=>{env=await initializeTestEnvironment({projectId:PROJECT,firestore:{host:'127.0.0.1',port:8187,rules:readFileSync(new URL('../../firestore.rules',import.meta.url),'utf8')}});});
after(async()=>{await env?.cleanup();});
beforeEach(async()=>{
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context=>{
    const data={};
    for(const [id,role,owner] of [['d1','doctor'],['d2','doctor'],['admin','admin'],['s1','assistant','d1'],['s2','assistant','d2'],['test','assistant','admin']]) {
      data['users/'+id]=profile(id,role,owner);
      data['securityPrincipals/auth-'+id]=authority(id,role,owner);
      data['clinicSessions/lease-auth-'+id]={authUid:'auth-'+id,role,active:true,expiresAt:Timestamp.fromMillis(Date.now()+3600000)};
      data['staffDirectory/'+id]={uid:id,name:'Nombre ficticio',role,...(owner?{createdBy:owner}:{})};
    }
    data['securityPrincipals/auth-family']={authUid:'auth-family',active:true,role:'patient',doctorId:'d1',patientId:'p1',loginEmail:'family@example.test',sessionVersion:1,credentialVersion:1,credentialEpoch:epoch};
    data['clinicSessions/lease-auth-family']={authUid:'auth-family',role:'patient',active:true,expiresAt:Timestamp.fromMillis(Date.now()+3600000)};
    data['patientCredentials/p1']={patientId:'p1',doctorId:'d1',credentialVersion:1,credentialEpoch:epoch,loginEmails:['family@example.test']};
    data['patientSessionStatus/p1']={active:true,credentialVersion:1,credentialEpoch:epoch};
    for(const p of [child('p1','d1','family@example.test'),child('p2','d1','other@example.test','family@example.test'),child('p3','d1','foreign@example.test'),child('p4','d2','family@example.test')]) {
      data['patients/'+p.id]={...p,diagnosis:'Dato privado ficticio'};
      data['patientDirectory/'+p.id]=p;
      data['patientPortal/'+p.id]={id:p.id,doctorId:p.doctorId,name:p.name,birthDate:p.birthDate};
      data['clinicalRecords/r-'+p.id]={id:'r-'+p.id,patientId:p.id,doctorId:p.doctorId,diagnosis:'Dato privado ficticio'};
      data['appointments/a-'+p.id]={id:'a-'+p.id,patientId:p.id,doctorId:p.doctorId,date:'2030-01-01',time:'10:00',disabled:false,status:'scheduled'};
      data['appointmentSlots/a-'+p.id]={id:'a-'+p.id,doctorId:p.doctorId,date:'2030-01-01',time:'10:00'};
    }
    for(const id of ['p1','p2'])data['familyAccess/auth-family/patients/'+id]={patientId:id,doctorId:'d1'};
    for(const id of ['d1','d2']){data['doctorProfiles/'+id]={uid:id,name:'Nombre ficticio',role:'doctor'};data['schedules/'+id]={doctorId:id,consultationDuration:30};}
    for(const [id,recipient,type]of[['nd','d1','doctor'],['ns','s1','assistant'],['np','p1','patient'],['nsibling','p2','patient']])data['notifications/'+id]=notice(id,recipient,type);
    data['auditLog/event']={action:'appointment.create',timestamp:Timestamp.now()};
    await Promise.all(Object.entries(data).map(([path,value])=>setDoc(doc(context.firestore(),path),value)));
  });
});
function db(id,claims={}){return env.authenticatedContext(id,{clinicSessionId:'lease-'+id,...(id==='auth-family'?{patientSessionVersion:1}:{}),...claims}).firestore();}
const get=(id,path,claims)=>getDoc(doc(db(id,claims),path));
const trusted=(path,changes)=>env.withSecurityRulesDisabled(context=>updateDoc(doc(context.firestore(),path),changes));

test('email-shaped staff IDs require the exact protected binding and keep Doctor/Assistant isolation',async()=>{
  const doctorId='doctor.legacy+test@example.invalid'; const assistantId='assistant.legacy@example.invalid';
  await env.withSecurityRulesDisabled(async context=>{
    for(const [userId,authUid,role,owner] of [[doctorId,'auth-legacy-doctor','doctor'],[assistantId,'auth-legacy-assistant','assistant',doctorId]]){
      await setDoc(doc(context.firestore(),'users/'+userId),{uid:userId,firebaseUid:authUid,role,pending:false,profileComplete:true,...(owner?{createdBy:owner}:{})});
      await setDoc(doc(context.firestore(),'securityPrincipals/'+authUid),{authUid,userId,role,doctorId:owner??userId,active:true});
      await setDoc(doc(context.firestore(),'clinicSessions/lease-'+authUid),{authUid,role,active:true,expiresAt:Timestamp.fromMillis(Date.now()+3600000)});
      await setDoc(doc(context.firestore(),'staffDirectory/'+userId),{uid:userId,role,...(owner?{createdBy:owner}:{})});
    }
    await setDoc(doc(context.firestore(),'patients/p-legacy'),child('p-legacy',doctorId,'synthetic@example.invalid'));
    await setDoc(doc(context.firestore(),'patientDirectory/p-legacy'),{id:'p-legacy',doctorId,name:'Ficticio'});
  });
  await assertSucceeds(get('auth-legacy-doctor','patients/p-legacy'));
  await assertSucceeds(get('auth-legacy-assistant','patientDirectory/p-legacy'));
  await assertSucceeds(getDocs(query(collection(db('auth-legacy-doctor'),'staffDirectory'),where('role','==','assistant'),where('createdBy','==',doctorId))));
  await assertFails(get('auth-legacy-assistant','patients/p-legacy'));
  await assertFails(get('auth-d1','patients/p-legacy'));
  await assertFails(get('auth-legacy-doctor','patients/p1'));
  await assertFails(get(doctorId,'patients/p-legacy',{email:doctorId,role:'doctor'}));
  await assertFails(updateDoc(doc(db('auth-legacy-doctor'),'patients/p-legacy'),{name:'No directo'}));
});

test('anonymous and a signed-in account without authority cannot read or write business data',async()=>{
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'patients/p1')));
  await assertFails(get('unbound','patients/p1'));
  await assertFails(setDoc(doc(db('unbound'),'securityPrincipals/unbound'),{role:'admin',active:true}));
});
test('Doctor reads only own patients and clinical records; its actual directory queries succeed',async()=>{
  await assertSucceeds(get('auth-d1','patients/p1'));await assertSucceeds(get('auth-d1','clinicalRecords/r-p1'));
  await assertFails(get('auth-d1','patients/p4'));await assertFails(get('auth-d1','clinicalRecords/r-p4'));
  await assertSucceeds(getDocs(query(collection(db('auth-d1'),'patients'),where('doctorId','==','d1'))));
  await assertFails(getDocs(collection(db('auth-d1'),'patients')));
});
test('Assistant gets own calendar and basic directory, but no clinical or private patient data',async()=>{
  for(const path of ['patientDirectory/p1','appointments/a-p1','doctorProfiles/d1'])await assertSucceeds(get('auth-s1',path));
  for(const path of ['patients/p1','clinicalRecords/r-p1','patientDirectory/p4','appointments/a-p4','users/d1'])await assertFails(get('auth-s1',path));
  await assertSucceeds(getDocs(query(collection(db('auth-s1'),'appointments'),where('doctorId','==','d1'))));
});
test('Admin sees Doctor/Admin directory and audit only, never medical data or another private staff profile',async()=>{
  await assertSucceeds(getDocs(query(collection(db('auth-admin'),'staffDirectory'),where('role','in',['admin','doctor']))));
  await assertSucceeds(get('auth-admin','auditLog/event'));
  for(const path of ['patients/p1','appointments/a-p1','clinicalRecords/r-p1','users/d1','staffDirectory/s1'])await assertFails(get('auth-admin',path));
});
test('Doctor manages only own Assistant directory using role and owner filters',async()=>{
  await assertSucceeds(getDocs(query(collection(db('auth-d1'),'staffDirectory'),where('role','==','assistant'),where('createdBy','==','d1'))));
  await assertFails(getDocs(query(collection(db('auth-d1'),'staffDirectory'),where('role','==','assistant'))));
  await assertFails(get('auth-d1','staffDirectory/s2'));
});
test('Patient Firebase identities cannot read portal data; all access goes through the server',async()=>{
  for(const id of ['p1','p2'])await assertFails(get('auth-family','patientPortal/'+id));
  for(const id of ['p3','p4'])await assertFails(get('auth-family','patientPortal/'+id));
  for(const path of ['patients/p1','patientDirectory/p1','clinicalRecords/r-p1'])await assertFails(get('auth-family',path));
  await assertFails(getDocs(collection(db('auth-family'),'patientPortal')));
});
test('Patient Firebase identities cannot query appointments or occupancy',async()=>{
  for(const id of ['p1','p2'])await assertFails(getDocs(query(collection(db('auth-family'),'appointments'),where('doctorId','==','d1'),where('patientId','==',id))));
  await assertFails(getDocs(query(collection(db('auth-family'),'appointments'),where('doctorId','==','d1'))));
  await assertFails(get('auth-family','appointments/a-p3'));
  await assertFails(getDocs(query(collection(db('auth-family'),'appointmentSlots'),where('doctorId','==','d1'))));
  await assertFails(get('auth-family','appointmentSlots/a-p4'));
});
test('Inbox queries require own recipient role and Doctor; only read=true may be updated',async()=>{
  for(const [actor,recipient,role,id]of[['auth-d1','d1','doctor','nd'],['auth-s1','s1','assistant','ns']]){
    await assertSucceeds(getDocs(query(collection(db(actor),'notifications'),where('doctorId','==','d1'),where('recipientId','==',recipient),where('recipientType','==',role),where('read','==',false),orderBy('createdAt','desc'),limit(3))));
    await assertSucceeds(updateDoc(doc(db(actor),'notifications',id),{read:true}));
    await assertFails(updateDoc(doc(db(actor),'notifications',id),{read:false}));
    await assertFails(updateDoc(doc(db(actor),'notifications',id),{read:true,recipientId:'foreign'}));
  }
  await assertFails(get('auth-family','notifications/nsibling'));
});
test('All four roles cannot fabricate or mutate business, projection, credentials or audit documents',async()=>{
  for(const actor of ['auth-admin','auth-d1','auth-s1','auth-family']){
    for(const path of ['users/d1','patients/p1','appointments/a-p1','clinicalRecords/r-p1','patientPortal/p1','patientCredentials/p1','securityPrincipals/auth-d1','auditLog/event']){
      await assertFails(updateDoc(doc(db(actor),path),{name:'Cambio no autorizado'}));
    }
    await assertFails(setDoc(doc(db(actor),'notifications/forged'),notice('forged','d1','doctor')));
    await assertFails(deleteDoc(doc(db(actor),'patients/p1')));
  }
});
test('Expired, inactive, swapped and missing device leases fail even with otherwise valid authority',async()=>{
  await assertFails(get('auth-d1','patients/p1',{clinicSessionId:'lease-auth-d2'}));
  await assertFails(get('auth-d1','patients/p1',{clinicSessionId:''}));
  await trusted('clinicSessions/lease-auth-d1',{expiresAt:Timestamp.fromMillis(Date.now()-1)});
  await assertFails(get('auth-d1','patients/p1'));
  await trusted('clinicSessions/lease-auth-d1',{expiresAt:Timestamp.fromMillis(Date.now()+3600000),active:false});
  await assertFails(get('auth-d1','patients/p1'));
});
test('Current credential revision, epoch and allowed email govern the patient session',async()=>{
  await trusted('patientCredentials/p1',{credentialVersion:2});await assertFails(get('auth-family','patientPortal/p2'));
  await trusted('patientCredentials/p1',{credentialVersion:1,credentialEpoch:'b'.repeat(32)});await assertFails(get('auth-family','appointments/a-p1'));
  await trusted('patientCredentials/p1',{credentialEpoch:epoch,loginEmails:['changed@example.test']});await assertFails(get('auth-family','doctorProfiles/d1'));
});
test('Contact changes and deletion invalidate a previously established sibling membership',async()=>{
  await trusted('patientDirectory/p2',{secondaryEmail:'changed@example.test'});await assertFails(get('auth-family','patientPortal/p2'));
  await env.withSecurityRulesDisabled(context=>setDoc(doc(context.firestore(),'patientDeletionJobs/p1'),{blocked:true}));
  await assertFails(get('auth-family','patientPortal/p2'));
});
test('Owner deletion, role changes and binding changes stop linked calendars and patient access',async()=>{
  await trusted('users/d1',{role:'admin'});
  for(const actor of ['auth-d1','auth-s1','auth-family'])await assertFails(get(actor,'appointments/a-p1'));
  await trusted('users/d1',{role:'doctor',firebaseUid:'different'});
  await assertFails(get('auth-d1','patients/p1'));
});
test('An Admin-owned test Assistant reads its own profile but cannot obtain an agenda',async()=>{
  await assertSucceeds(get('auth-test','users/test'));
  await assertFails(get('auth-test','doctorProfiles/admin'));
  await assertFails(get('auth-test','appointments/a-p1'));
});
test('Own revocation metadata remains readable so a realtime listener can end the session',async()=>{
  await trusted('securityPrincipals/auth-d1',{active:false});
  await assertSucceeds(get('auth-d1','securityPrincipals/auth-d1'));
  await assertSucceeds(get('auth-d1','clinicSessions/lease-auth-d1'));
  await assertFails(get('auth-d1','patients/p1'));
  await assertFails(get('auth-d2','securityPrincipals/auth-d1'));
});

test('Patient Firebase identities cannot listen to revision metadata',async()=>{
  await assertFails(get('auth-family','patientSessionStatus/p1'));
  await assertFails(get('auth-family','patientSessionStatus/p2'));
  await assertFails(get('auth-s1','patientSessionStatus/p1'));
  await trusted('securityPrincipals/auth-family',{active:false});
  await assertFails(get('auth-family','patientSessionStatus/p1'));
  await assertFails(updateDoc(doc(db('auth-family'),'patientSessionStatus/p1'),{credentialVersion:1}));
});
test('A protected role change cannot reuse a lease issued for a different role',async()=>{
  await trusted('clinicSessions/lease-auth-d1',{role:'admin'});
  await assertFails(get('auth-d1','patients/p1'));
});
test('Large own calendar queries and twenty notification updates fit rule access limits',async()=>{
  await env.withSecurityRulesDisabled(async context=>{
    const batch=writeBatch(context.firestore());
    for(let i=0;i<24;i++){
      batch.set(doc(context.firestore(),'appointments/many-'+i),{id:'many-'+i,doctorId:'d1',patientId:'p2',date:'2030-01-01',time:'10:00'});
      batch.set(doc(context.firestore(),'notifications/many-'+i),notice('many-'+i,'d1','doctor'));
    }
    await batch.commit();
  });
  const source=db('auth-d1');
  const result=await assertSucceeds(getDocs(query(collection(source,'appointments'),where('doctorId','==','d1'),where('patientId','==','p2'))));
  if(result.size!==25)throw new Error('Expected complete synthetic own calendar.');
  const batch=writeBatch(source);
  for(let i=0;i<20;i++)batch.update(doc(source,'notifications/many-'+i),{read:true});
  await assertSucceeds(batch.commit());
});
