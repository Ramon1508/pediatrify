import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {issueInvitation, resolveInvitation, completeInvitation} = require('../../functions/lib/staff-invitations.js');
const {deleteStaffAccount} = require('../../functions/lib/staff-deletion-policy.js');
const {createDeletionOperations} = require('../../functions/lib/staff-deletion.js');
const {changeStaffEmail} = require('../../functions/lib/staff-email-change.js');
const admin = {authUid:'auth-admin-a', userId:'admin-a', role:'admin', active:true};
const otherAdmin = {authUid:'auth-admin-b', userId:'admin-b', role:'admin', active:true};
const doctor = {authUid:'auth-doctor', userId:'doctor', doctorId:'doctor', role:'doctor', active:true};
const blank = {sexo:3, phone:'', especialidad:'', cedula:'', cedulaEspecialidad:'', consultorios:''};
const professional = {...blank, sexo:1, phone:'5512345678', cedula:'123', consultorios:'Ejemplo sintético'};
const request = {action:'create', operationId:'create-admin', role:'admin', name:'Admin sintético', email:' NEW@example.test '};
const syntheticError = code => Object.assign(new Error('Synthetic failure'), {code});

// Standard Firestore transaction contract: serialize commits and reject reads after writes.
// No live SDK, credentials, emails or real accounts are used by these adapter tests.
function fixture() {
  const docs = new Map(), accounts = new Map(), events = [];
  for (const actor of [admin, otherAdmin, doctor]) {
    docs.set('securityPrincipals/'+actor.authUid, {...actor});
    docs.set('users/'+actor.userId, {uid:actor.userId, firebaseUid:actor.authUid, name:'Operador sintético',
      email:actor.userId+'@example.test', role:actor.role, pending:false, profileComplete:true, createdBy:admin.userId});
    accounts.set(actor.authUid, {uid:actor.authUid, email:actor.userId+'@example.test', disabled:false});
  }
  const snapshot = path => ({exists:docs.has(path), id:path.split('/').at(-1), ref:doc(path),
    data:()=> docs.has(path) ? structuredClone(docs.get(path)) : undefined});
  function doc(path) { return {path, get:async()=>snapshot(path), delete:async()=>docs.delete(path),
    update:async fields => docs.set(path,{...docs.get(path),...fields})}; }
  function query(name, conditions=[], max=Infinity) {
    return {get:async()=> {
      const matches=[...docs].filter(([path,value])=>path.split('/')[0]===name &&
        conditions.every(([field,expected])=>value[field]===expected)).slice(0,max).map(([path])=>snapshot(path));
      return {docs:matches, empty:matches.length===0};
    }, where:(field,op,value)=>{assert.equal(op,'==');return query(name,[...conditions,[field,value]],max);},
    limit:limit=>query(name,conditions,limit)};
  }
  let tail=Promise.resolve();
  const db = {doc, collection:query, runTransaction:callback=> {
    const operation=tail.then(async()=>{
      const writes=[];
      const result=await callback({get:async ref=>{assert.equal(writes.length,0);return ref.get();},
        set:(ref,value,options)=>writes.push(()=>docs.set(ref.path,options?.merge?{...docs.get(ref.path),...value}:value)),
        update:(ref,value)=>writes.push(()=>{assert.ok(docs.has(ref.path));docs.set(ref.path,{...docs.get(ref.path),...value});}),
        delete:ref=>writes.push(()=>docs.delete(ref.path))});
      writes.forEach(write=>write());return result;
    });tail=operation.catch(()=>undefined);return operation;
  }, batch:()=>{const refs=[];return {delete:ref=>refs.push(ref.path),commit:async()=>refs.forEach(path=>docs.delete(path))};}};
  const auth = {
    getUserByEmail:async email=>{events.push('lookup');const account=[...accounts.values()].find(a=>a.email===email);
      if(!account)throw syntheticError('auth/user-not-found');return {...account};},
    getUser:async uid=>{if(!accounts.has(uid))throw syntheticError('auth/user-not-found');return {...accounts.get(uid)};},
    createUser:async fields=>{events.push('create:'+fields.uid);assert.equal(fields.disabled,true);
      assert.equal(docs.get('securityPrincipals/'+fields.uid).active,false);accounts.set(fields.uid,{...fields});return {...fields};},
    updateUser:async(uid,fields)=>{if(!accounts.has(uid))throw syntheticError('auth/user-not-found');
      events.push('update:'+uid);Object.assign(accounts.get(uid),fields);return {...accounts.get(uid)};},
    revokeRefreshTokens:async uid=>{events.push('revoke:'+uid);},
    deleteUser:async uid=>{events.push('delete:'+uid);accounts.delete(uid);},
  };
  const issue=(actor=admin,input=request)=>issueInvitation(db,auth,actor,input,true,1000);
  const complete=issued=>completeInvitation(db,auth,{token:issued.token,password:'Synthetic123!',operationId:'register',
    profile:issued.role==='doctor'?professional:blank},true,'register-lease',1001);
  const ops=(actor,lease)=>createDeletionOperations(db,auth,lease,()=>({getFiles:async()=>[[]]}),undefined,actor);
  const remove=(actor,target,lease='delete-lease')=>deleteStaffAccount({userId:target},actor,ops(actor,lease));
  return {docs,accounts,events,db,auth,issue,complete,remove,ops};
}

for (const role of ['admin','doctor']) test('Admin can invite, resolve and complete '+role,async()=>{
  const f=fixture(), issued=await f.issue(admin,{...request,role});
  assert.equal(issued.role,role);
  assert.equal((await resolveInvitation(f.db,{token:issued.token},true,1001)).role,role);
  await f.complete(issued);
  const user=f.docs.get('users/'+issued.userId), principal=f.docs.get('securityPrincipals/'+user.firebaseUid);
  assert.equal(user.role,role);assert.equal(user.profileComplete,true);assert.equal(principal.active,true);
  assert.equal(principal.doctorId,role==='doctor'?issued.userId:undefined);
});

for(const role of ['admin','doctor']) test('Doctor cannot request '+role+' or forge an Admin issuer',async()=>{
  const f=fixture();await assert.rejects(f.issue(doctor,{...request,role}),{code:'permission-denied'});
  await assert.rejects(f.issue({...doctor,role:'admin'},{...request,role}),{code:'permission-denied'});
  assert.deepEqual(f.events,[]);
});

for(const actorRole of ['assistant','patient']) test(actorRole+' cannot create any staff',async()=>{
  const f=fixture();await assert.rejects(f.issue({...doctor,role:actorRole}),{code:'permission-denied'});
  assert.deepEqual(f.events,[]);
});

for(const actor of [admin,doctor]) test(actor.role+' creates an Assistant bound to its issuer',async()=>{
  const f=fixture(), issued=await f.issue(actor,{...request,role:'assistant'});
  await f.complete(issued);
  const user=f.docs.get('users/'+issued.userId), principal=f.docs.get('securityPrincipals/'+user.firebaseUid);
  assert.equal(user.createdBy,actor.userId);assert.equal(principal.doctorId,actor.userId);
  assert.equal(f.docs.get('users/'+principal.doctorId).role,actor.role);
  // For the Admin testing path, this is deliberately NOT a valid Doctor association.
});

test('resending an Admin invitation retains role, replaces the capability and registers the same account',async()=>{
  const f=fixture(), first=await f.issue();
  const next=await f.issue(admin,{action:'resend',userId:first.userId,operationId:'resend-admin'});
  assert.equal(next.userId,first.userId);assert.equal(next.role,'admin');
  await assert.rejects(resolveInvitation(f.db,{token:first.token},true,1001),{code:'failed-precondition'});
  await f.complete(next);assert.equal(f.docs.get('users/'+next.userId).role,'admin');
});

test('an invitation operation ID cannot be retried with a different role',async()=>{
  const f=fixture(), first=await f.issue();
  await assert.rejects(f.issue(admin,{...request,role:'doctor'}),{code:'aborted'});
  assert.equal(f.docs.get('users/'+first.userId).role,'admin');
});

test('Doctor cannot resend a pending Admin invitation',async()=>{
  const f=fixture(), issued=await f.issue();
  await assert.rejects(f.issue(doctor,{action:'resend',userId:issued.userId,operationId:'spoofed'}),{code:'permission-denied'});
});

test('Admin changes another Admin email and name in Auth and Firestore; its own name remains forbidden',async()=>{
  const f=fixture(), user=f.docs.get('users/'+otherAdmin.userId);
  await changeStaffEmail(f.db,f.auth,admin,{userId:user.uid,email:' CHANGED@example.test ',expectedEmail:user.email,
    name:'Nombre sintético',operationId:'change-other'},true,'email-lease');
  assert.equal(f.docs.get('users/'+user.uid).email,'changed@example.test');
  assert.equal(f.docs.get('users/'+user.uid).name,'Nombre sintético');
  assert.equal(f.accounts.get(otherAdmin.authUid).email,'changed@example.test');
  await assert.rejects(changeStaffEmail(f.db,f.auth,admin,{userId:admin.userId,email:'self@example.test',
    expectedEmail:'admin-a@example.test',name:'No permitido',operationId:'self-name'},true),{code:'permission-denied'});
});

test('Doctor and Assistant cannot edit an Admin via the server',async()=>{
  const f=fixture(), input={userId:otherAdmin.userId,email:'changed@example.test',expectedEmail:'admin-b@example.test',operationId:'foreign'};
  for(const actor of [doctor,{...doctor,role:'assistant'}])
    await assert.rejects(changeStaffEmail(f.db,f.auth,actor,input,true),{code:'permission-denied'});
  assert.deepEqual(f.events,[]);
});

test('Admin deletes another Admin without deleting the Doctors it created or their data',async()=>{
  const f=fixture();f.docs.set('patients/synthetic-child',{doctorId:doctor.userId});
  f.docs.set('auditLog/synthetic-audit',{actorId:otherAdmin.userId});
  const user=f.docs.get('users/'+doctor.userId);user.createdBy=otherAdmin.userId;
  await f.remove(admin,otherAdmin.userId);
  assert.equal(f.accounts.has(otherAdmin.authUid),false);assert.equal(f.docs.has('users/'+otherAdmin.userId),false);
  assert.equal(f.docs.get('securityPrincipals/'+otherAdmin.authUid).active,false);
  assert.ok(f.docs.has('users/'+doctor.userId));assert.ok(f.docs.has('patients/synthetic-child'));
  assert.ok(f.docs.has('auditLog/synthetic-audit'));
  assert.equal(f.docs.get('staffDeletionJobs/'+otherAdmin.userId).completed,true);
  await f.remove(admin,otherAdmin.userId,'retry-completed');
});

test('Admin cannot delete itself; Doctor cannot delete an Admin',async()=>{
  const f=fixture();await assert.rejects(f.remove(admin,admin.userId),{code:'permission-denied'});
  await assert.rejects(f.remove(doctor,otherAdmin.userId),{code:'permission-denied'});
  assert.ok(!f.events.some(event=>event.startsWith('update:')||event.startsWith('delete:')));
});

test('mutual concurrent Admin deletions leave one operational Admin',async()=>{
  const f=fixture(), results=await Promise.allSettled([
    f.remove(admin,otherAdmin.userId,'delete-b'),f.remove(otherAdmin,admin.userId,'delete-a'),
  ]);
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
  const remaining=[admin,otherAdmin].filter(actor=>f.accounts.has(actor.authUid)&&
    f.docs.get('securityPrincipals/'+actor.authUid)?.active===true);
  assert.equal(remaining.length,1);assert.ok(f.docs.has('users/'+remaining[0].userId));
});

test('pending Admin invitations can be removed while an operational Admin remains',async()=>{
  const f=fixture(), issued=await f.issue();await f.remove(admin,issued.userId);
  assert.equal(f.docs.has('users/'+issued.userId),false);
  await assert.rejects(resolveInvitation(f.db,{token:issued.token},true,1001),{code:'failed-precondition'});
  assert.ok(f.accounts.has(admin.authUid));
});

test('deletion reservations require current Admin authority and reject malformed roster state',async()=>{
  const f=fixture();f.docs.set('staffAdminControl/roster',{revision:'spoofed'});
  await assert.rejects(f.remove(admin,otherAdmin.userId),{code:'failed-precondition'});
  assert.equal(f.docs.has('staffDeletionJobs/'+otherAdmin.userId),false);
  f.docs.delete('staffAdminControl/roster');f.docs.get('securityPrincipals/'+admin.authUid).active=false;
  await assert.rejects(f.remove(admin,otherAdmin.userId),{code:'permission-denied'});
  assert.ok(f.accounts.has(otherAdmin.authUid));
});
