import {after, before, beforeEach, test} from 'node:test';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment, assertSucceeds, assertFails} from '@firebase/rules-unit-testing';
import {doc, setDoc, Timestamp} from 'firebase/firestore';
import {ref, uploadBytes, getBytes, deleteObject, listAll, updateMetadata} from 'firebase/storage';

const PROJECT='demo-lilcare-p01';
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8187'||process.env.FIREBASE_STORAGE_EMULATOR_HOST!=='127.0.0.1:9199')throw new Error('Local synthetic emulators only.');
let env;
const bytes=new Uint8Array([1,2,3]);
const storage=(uid='auth-d1',extra={})=>env.authenticatedContext(uid,{clinicSessionId:'lease-'+uid,...extra}).storage();
const upload=(uid,path='logos/d1/unique.png',type='image/png',body=bytes,extra={})=>uploadBytes(ref(storage(uid,extra),path),body,{contentType:type});
const trusted=async(path,data)=>env.withSecurityRulesDisabled(context=>setDoc(doc(context.firestore(),path),data,{merge:true}));
before(async()=>{
  env=await initializeTestEnvironment({projectId:PROJECT,
    firestore:{host:'127.0.0.1',port:8187,rules:readFileSync(new URL('../../firestore.rules',import.meta.url),'utf8')},
    storage:{host:'127.0.0.1',port:9199,rules:readFileSync(new URL('../../storage.rules',import.meta.url),'utf8')}});
});
beforeEach(async()=>{
  await env.clearFirestore();await env.clearStorage();
  for(const [id,role]of[['d1','doctor'],['d2','doctor'],['admin','admin'],['s1','assistant'],['patient','patient']]){
    const uid='auth-'+id;
    await trusted('securityPrincipals/'+uid,{authUid:uid,userId:id,doctorId:role==='doctor'?id:'d1',role,active:true});
    await trusted('clinicSessions/lease-'+uid,{authUid:uid,role,active:true,expiresAt:Timestamp.fromMillis(Date.now()+3600000)});
  }
});
after(async()=>{await env?.cleanup();});

test('legacy Doctor document ID uploads only its own path with a separate protected Auth UID',async()=>{
  const doctorId='doctor.legacy+test@example.invalid';const authUid='auth-legacy-doctor';
  await trusted('securityPrincipals/'+authUid,{authUid,userId:doctorId,doctorId,role:'doctor',active:true});
  await trusted('clinicSessions/lease-'+authUid,{authUid,role:'doctor',active:true,expiresAt:Timestamp.fromMillis(Date.now()+3600000)});
  const path='logos/'+doctorId+'/unique.png';
  await assertSucceeds(upload(authUid,path));
  await assertSucceeds(getBytes(ref(env.unauthenticatedContext().storage(),path)));
  await assertFails(upload('auth-d1',path));
  await assertFails(upload(authUid,'logos/d1/foreign.png'));
  await assertFails(upload(doctorId,path));
  await assertSucceeds(deleteObject(ref(storage(authUid),path)));
});
test('Doctor uploads/replaces/deletes its own logo; public can read but nobody can list',async()=>{
  await assertSucceeds(upload('auth-d1'));
  await assertSucceeds(upload('auth-d1'));
  await assertSucceeds(getBytes(ref(env.unauthenticatedContext().storage(),'logos/d1/unique.png')));
  await assertFails(listAll(ref(storage(),'logos/d1')));
  await assertFails(listAll(ref(env.unauthenticatedContext().storage(),'logos/d1')));
  await assertSucceeds(deleteObject(ref(storage(),'logos/d1/unique.png')));
});
test('Only the owner Doctor can upload/delete; Admin/Assistant/Patient and anonymous cannot',async()=>{
  await assertSucceeds(upload('auth-d1'));
  for(const uid of ['auth-d2','auth-admin','auth-s1','auth-patient']){
    await assertFails(upload(uid));
    await assertFails(deleteObject(ref(storage(uid),'logos/d1/unique.png')));
  }
  await assertFails(uploadBytes(ref(env.unauthenticatedContext().storage(),'logos/d1/anon.png'),bytes,{contentType:'image/png'}));
});
test('Invalid size/MIME/path and metadata mutation cannot bypass upload validation',async()=>{
  for(const type of ['image/png','image/jpeg','image/svg+xml'])await assertSucceeds(upload('auth-d1','logos/d1/supported-'+type.split('/')[1],type));
  await assertFails(upload('auth-d1','logos/d1/empty.png','image/png',new Uint8Array(0)));
  await assertFails(upload('auth-d1','logos/d1/large.png','image/png',new Uint8Array(1048577)));
  await assertFails(upload('auth-d1','logos/d1/file.html','text/html'));
  await assertFails(upload('auth-d1','logos/d1/dot..png'));
  await assertFails(upload('auth-d1','documents/d1/file.png'));
  await assertFails(upload('auth-d1','logos/unowned.png'));
  await assertSucceeds(upload('auth-d1'));
  await assertFails(updateMetadata(ref(storage(),'logos/d1/unique.png'),{contentType:'text/html'}));
});
test('Expired/revoked/swapped lease and inactive protected authority stop upload and deletion',async()=>{
  await assertSucceeds(upload('auth-d1'));
  await assertFails(upload('auth-d1','logos/d1/other.png','image/png',bytes,{clinicSessionId:'lease-auth-d2'}));
  await trusted('clinicSessions/lease-auth-d1',{expiresAt:Timestamp.fromMillis(Date.now()-1)});
  await assertFails(upload('auth-d1'));
  await assertFails(deleteObject(ref(storage(),'logos/d1/unique.png')));
  await trusted('clinicSessions/lease-auth-d1',{expiresAt:Timestamp.fromMillis(Date.now()+3600000),active:false});
  await assertFails(upload('auth-d1'));
  await trusted('clinicSessions/lease-auth-d1',{active:true});
  await trusted('securityPrincipals/auth-d1',{active:false});
  await assertFails(upload('auth-d1'));
  await assertFails(deleteObject(ref(storage(),'logos/d1/unique.png')));
  await assertSucceeds(getBytes(ref(env.unauthenticatedContext().storage(),'logos/d1/unique.png')));
});
