import {after,before,test} from 'node:test';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc,updateDoc,deleteDoc} from 'firebase/firestore';
import {ref,uploadBytes,getBytes,deleteObject,listAll} from 'firebase/storage';
const PROJECT='demo-lilcare-p01';
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8187'||process.env.FIREBASE_STORAGE_EMULATOR_HOST!=='127.0.0.1:9199')throw new Error('Local synthetic emulators only.');
let env;const bytes=new Uint8Array([1,2,3]);
before(async()=>{
  env=await initializeTestEnvironment({projectId:PROJECT,
    firestore:{host:'127.0.0.1',port:8187,rules:readFileSync(new URL('./maintenance.firestore.rules',import.meta.url),'utf8')},
    storage:{host:'127.0.0.1',port:9199,rules:readFileSync(new URL('./maintenance.storage.rules',import.meta.url),'utf8')}});
  await env.clearFirestore();await env.clearStorage();
  await env.withSecurityRulesDisabled(async context=>{
    await setDoc(doc(context.firestore(),'patients/synthetic'),{name:'Synthetic'});
    await uploadBytes(ref(context.storage(),'logos/synthetic/current.png'),bytes,{contentType:'image/png'});
  });
});
after(async()=>{await env?.cleanup();});
test('maintenance blocks old and new client reads/writes for every role and anonymous requests',async()=>{
  const contexts=['admin','doctor','assistant','patient'].map(role=>env.authenticatedContext('synthetic-'+role,{role,clinicSessionId:'synthetic'}));
  contexts.push(env.unauthenticatedContext());
  for(const context of contexts){
    const target=doc(context.firestore(),'patients/synthetic');
    await assertFails(getDoc(target));await assertFails(setDoc(target,{name:'changed'}));
    await assertFails(updateDoc(target,{name:'changed'}));await assertFails(deleteDoc(target));
  }
});
test('maintenance retains public logo links while blocking upload, deletion and object listing',async()=>{
  for(const context of [env.authenticatedContext('synthetic-doctor',{role:'doctor'}),env.unauthenticatedContext()]){
    const target=ref(context.storage(),'logos/synthetic/current.png');
    await assertSucceeds(getBytes(target));await assertFails(uploadBytes(target,bytes,{contentType:'image/png'}));
    await assertFails(deleteObject(target));await assertFails(listAll(ref(context.storage(),'logos/synthetic')));
    await assertFails(uploadBytes(ref(context.storage(),'documents/synthetic/private.png'),bytes,{contentType:'image/png'}));
  }
});
