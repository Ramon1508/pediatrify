import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const require = createRequire(import.meta.url);
const {issueInvitation, resolveInvitation, completeInvitation, INVITATION_LIFETIME_MS,
  manageStaffInvitation, inspectStaffInvitation, redeemStaffInvitation} = require('../../functions/lib/staff-invitations.js');
const {changeStaffEmail} = require('../../functions/lib/staff-email-change.js');
const {createDeletionOperations} = require('../../functions/lib/staff-deletion.js');
const admin = {authUid: 'auth-admin', userId: 'admin', role: 'admin', active: true};
const doctor = {authUid: 'auth-doctor', userId: 'doctor', doctorId: 'doctor', role: 'doctor', active: true};
const request = {action: 'create', name: 'Invitado ficticio', email: ' INVITED@example.test ', operationId: 'create-one'};
const profile = {sexo: 1, phone: '5512345678', especialidad: '', cedula: '123', cedulaEspecialidad: '', consultorios: 'Consultorio de prueba'};
const blank = {sexo: 3, phone: '', especialidad: '', cedula: '', cedulaEspecialidad: '', consultorios: ''};
const error = code => Object.assign(new Error('Synthetic error'), {code});
const hash = value => createHash('sha256').update(value).digest('hex');

function fixture() {
  const docs = new Map(); const accounts = new Map(); const events = [];
  for (const actor of [admin, doctor]) {
    docs.set('securityPrincipals/' + actor.authUid, {...actor});
    docs.set('users/' + actor.userId, {uid: actor.userId, firebaseUid: actor.authUid, name: 'Operador ficticio',
      email: actor.userId + '@example.test', role: actor.role, pending: false, profileComplete: true,
      ...(actor.role === 'doctor' ? {createdBy: 'admin'} : {})});
    accounts.set(actor.authUid, {uid: actor.authUid, email: actor.userId + '@example.test', disabled: false});
  }
  function doc(path) { return {path, get: async () => snapshot(path), delete: async () => docs.delete(path),
    update: async fields => docs.set(path, {...docs.get(path), ...fields})}; }
  function snapshot(path) { return {exists: docs.has(path), id: path.split('/').at(-1), ref: doc(path),
    data: () => docs.has(path) ? {...structuredClone(docs.get(path)),
      ...(docs.get(path).expiresAt ? {expiresAt: docs.get(path).expiresAt} : {})} : undefined}; }
  function query(name, conditions = [], limit = Infinity) {
    return {get: async () => { const items = [...docs].filter(([path, fields]) => path.split('/')[0] === name &&
      conditions.every(([field, value]) => fields[field] === value)).slice(0, limit).map(([path]) => snapshot(path));
      return {docs: items, empty: !items.length}; },
    where: (field, op, value) => { assert.equal(op, '=='); return query(name, [...conditions, [field, value]], limit); },
    limit: max => query(name, conditions, max)};
  }
  let transactionTail = Promise.resolve();
  const db = {doc, collection: name => query(name), transactions: 0,
    runTransaction: callback => {
      const operation = transactionTail.then(async () => {
      db.transactions++; const writes = [];
      const result = await callback({get: async ref => { assert.equal(writes.length, 0, 'all reads precede writes'); return ref.get(); },
        set: (ref, fields, options) => writes.push(() => docs.set(ref.path, options?.merge ? {...docs.get(ref.path), ...fields} : fields)),
        update: (ref, fields) => writes.push(() => { assert.ok(docs.has(ref.path)); docs.set(ref.path, {...docs.get(ref.path), ...fields}); }),
        delete: ref => writes.push(() => docs.delete(ref.path))});
      if (db.failAt && db.transactions === db.failAt) { db.failAt = null; throw error('synthetic-transaction-failure'); }
      writes.forEach(write => write()); return result;
      });
      transactionTail = operation.catch(() => undefined); return operation;
    },
    batch: () => { const paths=[]; return {delete: ref => paths.push(ref.path), commit: async () => paths.forEach(path => docs.delete(path))}; },
  };
  const auth = {
    getUserByEmail: async email => { events.push('lookup'); const account = [...accounts.values()].find(a => a.email === email);
      if (!account) throw error('auth/user-not-found'); return {...account}; },
    getUser: async uid => { events.push('get'); if (!accounts.has(uid)) throw error('auth/user-not-found'); return {...accounts.get(uid)}; },
    createUser: async fields => {
      events.push('create'); if ([...accounts.values()].some(a => a.email === fields.email)) throw error('auth/email-already-exists');
      assert.equal(fields.disabled, true); assert.equal(docs.get('securityPrincipals/' + fields.uid).active, false);
      accounts.set(fields.uid, {...fields}); await auth.afterCreate?.(); return {...fields};
    },
    updateUser: async (uid, fields) => { events.push('update');
      if (auth.failure) { const failure=auth.failure; auth.failure=null; throw error(failure); }
      Object.assign(accounts.get(uid), fields); await auth.afterUpdate?.(); return {...accounts.get(uid)}; },
    deleteUser: async () => { throw new Error('Invitations must never delete Auth identities'); },
  };
  const issue = (actor = admin, data = request, now = 1000) => issueInvitation(db, auth, actor, data, true, now);
  const complete = (issued, overrides = {}, now = 1001) => completeInvitation(db, auth, {
    token: issued.token, password: 'Synthetic123!', profile: issued.role === 'doctor' ? profile : blank,
    operationId: 'registration-one', ...overrides}, true, 'lease-one', now);
  return {docs, accounts, events, db, auth, issue, complete};
}

test('legacy Doctor document ID invites an Assistant using its protected Auth binding and preserves owner',async()=>{
  const f=fixture(); const userId='doctor.legacy+test@example.invalid';
  const actor={...doctor,userId,doctorId:userId};
  f.docs.set('users/'+userId,{...f.docs.get('users/doctor'),uid:userId});f.docs.delete('users/doctor');
  f.docs.set('securityPrincipals/auth-doctor',actor);
  const issued=await f.issue(actor);
  assert.equal(issued.role,'assistant');
  await f.complete(issued);
  assert.equal(f.docs.get('users/'+issued.userId).createdBy,userId);
  assert.equal(f.docs.get('securityPrincipals/'+f.docs.get('users/'+issued.userId).firebaseUid).doctorId,userId);
  assert.equal(f.accounts.get('auth-doctor').uid,'auth-doctor');
  await assert.rejects(f.issue(actor,{...request,operationId:'bad@example.invalid'}),{code:'invalid-argument'});
});

for (const endpoint of [manageStaffInvitation, inspectStaffInvitation, redeemStaffInvitation]) {
  test('callable is closed by default before SDK initialization', async () => {
    delete process.env.STAFF_INVITATIONS_ENABLED;
    await assert.rejects(endpoint.run({data: {}, rawRequest: {headers: {}}}), {code: 'failed-precondition'});
  });
}
test('closed adapters perform no reads or Auth operations', async () => {
  const f=fixture(); await assert.rejects(issueInvitation(f.db,f.auth,admin,request,false), {code:'failed-precondition'});
  await assert.rejects(resolveInvitation(f.db,{},false), {code:'failed-precondition'});
  await assert.rejects(completeInvitation(f.db,f.auth,{},false), {code:'failed-precondition'});
  assert.equal(f.db.transactions,0); assert.deepEqual(f.events,[]);
});
for (const value of [null, [], {}, {...request, role:'patient'}, {...request, userId:'spoofed'}, {...request, name:'   '},
  {...request,email:'invalid'}, {...request,operationId:'../bad'}, {...request, name:'x'.repeat(201)}]) {
  test('rejects invalid invitation payload ' + JSON.stringify(value), async () => {
    const f=fixture(); await assert.rejects(f.issue(admin,value), {code:'invalid-argument'}); assert.deepEqual(f.events,[]);
  });
}
test('canonical normalized invitation has 7-day expiry and stores only the token digest', async () => {
  const f=fixture(), issued=await f.issue(); const inv=f.docs.get('staffInvitations/'+issued.userId);
  assert.match(issued.token,/^[A-Za-z0-9_-]{43}$/); assert.equal(issued.expiresAt,1000+INVITATION_LIFETIME_MS);
  assert.equal(issued.role,'doctor'); assert.equal(issued.email,'invited@example.test');
  assert.equal(inv.tokenHash,hash(issued.token)); assert.equal(f.docs.get('users/'+issued.userId).createdBy,'admin');
  assert.ok(!JSON.stringify([...f.docs]).includes(issued.token));
  const resolved=await resolveInvitation(f.db,{token:issued.token},true,1001);
  assert.deepEqual(Object.keys(resolved).sort(),['email','expiresAt','name','role','userId']);
});

test('compacted invitation attempts cannot recreate a user or reuse a retired operation',async()=>{
  const f=fixture();const path='staffInvitationIssueJobs/'+hash(admin.authUid+':'+request.operationId);
  f.docs.set(path,{userId:'retired-user',completed:true,retired:true});
  await assert.rejects(f.issue(),{code:'failed-precondition'});
  assert.equal(f.docs.has('users/retired-user'),false);assert.equal(f.accounts.size,2);
});

test('retirement during the Auth lookup is rechecked in the invitation transaction',async()=>{
  const f=fixture();const path='staffInvitationIssueJobs/'+hash(admin.authUid+':'+request.operationId);
  f.auth.getUserByEmail=async()=>{f.docs.set(path,{userId:'retired-user',completed:true,retired:true});throw error('auth/user-not-found');};
  await assert.rejects(f.issue(),{code:'failed-precondition'});
  assert.equal([...f.docs.keys()].some(path=>path.startsWith('staffInvitations/')),false);
  assert.equal(f.accounts.size,2);
});
test('Doctor issues only their own Assistant', async () => {
  const f=fixture(), issued=await f.issue(doctor); assert.equal(issued.role,'assistant');
  assert.equal(f.docs.get('users/'+issued.userId).createdBy,'doctor');
  await f.complete(issued); assert.equal(f.docs.get('securityPrincipals/'+f.docs.get('users/'+issued.userId).firebaseUid).doctorId,'doctor');
});
for (const actor of [{...admin,role:'assistant'}, {...admin,active:false}, {...doctor,doctorId:'other'}, {...admin,authUid:'forged'}]) {
  test('untrusted or unauthorized issuer cannot create', async () => { const f=fixture();
    await assert.rejects(f.issue(actor), {code:'permission-denied'}); assert.ok(!f.events.includes('create')); });
}
test('duplicates and other issuer pending accounts do not create a second user', async () => {
  const f=fixture(), issued=await f.issue(); const count=f.docs.size;
  await assert.rejects(f.issue(admin,{...request,operationId:'create-two'}),{code:'already-exists'});
  await assert.rejects(f.issue(doctor,{...request,operationId:'create-three'}),{code:'already-exists'});
  assert.equal(f.docs.size,count); assert.equal(f.docs.get('staffEmailReservations/'+hash(issued.email)).userId,issued.userId);
});
test('pre-existing Auth identity is not linked, reset or deleted', async () => {
  const f=fixture(); f.accounts.set('unrelated',{uid:'unrelated',email:'invited@example.test',password:'Unchanged'});
  await assert.rejects(f.issue(),{code:'already-exists'}); assert.equal(f.accounts.get('unrelated').password,'Unchanged');
  assert.ok(!f.events.includes('create')); assert.ok(!f.events.includes('update'));
});
test('repeat issuance operation retains one user and rotates the capability', async () => {
  const f=fixture(), first=await f.issue(), second=await f.issue(); assert.equal(first.userId,second.userId);
  assert.notEqual(first.token,second.token); await assert.rejects(resolveInvitation(f.db,{token:first.token},true,1001),{code:'failed-precondition'});
});
test('resend retains pending account, resets expiry and rejects old token', async () => {
  const f=fixture(), first=await f.issue(), second=await f.issue(admin,{action:'resend',userId:first.userId,operationId:'resend-one'},2000);
  assert.equal(second.userId,first.userId); assert.equal(second.expiresAt,2000+INVITATION_LIFETIME_MS);
  await assert.rejects(f.complete(first),{code:'failed-precondition'}); await f.complete(second,{},2001);
});
test('Doctor cannot resend an Admin-owned Doctor invitation', async () => {
  const f=fixture(), issued=await f.issue();
  await assert.rejects(f.issue(doctor,{action:'resend',userId:issued.userId,operationId:'foreign'}),{code:'permission-denied'});
});
for(const offset of [0,1]) test('expiry is enforced at and after the exact deadline '+offset,async()=>{
  const f=fixture(), issued=await f.issue(); await assert.rejects(resolveInvitation(f.db,{token:issued.token},true,issued.expiresAt+offset),{code:'deadline-exceeded'});
  await assert.rejects(f.complete(issued,{},issued.expiresAt+offset),{code:'deadline-exceeded'}); assert.ok(!f.events.includes('create'));
});
test('successful registration consumes token, binds server UID/role and never persists password', async () => {
  const f=fixture(), issued=await f.issue(); assert.deepEqual(await f.complete(issued),{registered:true});
  const user=f.docs.get('users/'+issued.userId), inv=f.docs.get('staffInvitations/'+issued.userId);
  assert.equal(inv.status,'consumed'); assert.equal(user.firebaseUid,inv.authUid); assert.equal(user.pending,false);
  assert.equal(user.profileComplete,true); assert.equal(f.docs.get('securityPrincipals/'+user.firebaseUid).active,true);
  assert.equal(f.accounts.get(user.firebaseUid).disabled,false); assert.ok(!JSON.stringify([...f.docs]).includes('Synthetic123!'));
  await assert.rejects(resolveInvitation(f.db,{token:issued.token},true,1002),{code:'failed-precondition'});
  await assert.rejects(f.complete(issued,{operationId:'different'}),{code:'failed-precondition'});
  const events=f.events.length; assert.deepEqual(await f.complete(issued),{registered:true}); assert.equal(f.events.length,events);
  await assert.rejects(f.issue(admin,{action:'resend',userId:issued.userId,operationId:'late'}),{code:'already-exists'});
});
for(const override of [{role:'admin'},{email:'attacker@example.test'},{userId:'other'},{password:'weak'},
  {profile:{...profile,logoPath:'foreign'}},{profile:{...profile,sexo:99}},{profile:{...profile,phone:'123'}},
  {profile:{...profile,consultorios:''}},{profile:{...profile,cedula:'x'.repeat(301)}}]){
  test('registration rejects authority injection or invalid profile '+JSON.stringify(override), async()=>{
    const f=fixture(),issued=await f.issue(); await assert.rejects(f.complete(issued,override),{code:'invalid-argument'});
    assert.ok(!f.events.includes('create'));
  });
}
test('an Assistant cannot submit Doctor professional data',async()=>{
  const f=fixture(),issued=await f.issue(doctor); await assert.rejects(f.complete(issued,{profile}),{code:'invalid-argument'});
});
test('pending recipient cannot replace an unrelated Auth account that appeared after issuance',async()=>{
  const f=fixture(),issued=await f.issue();f.accounts.set('foreign',{uid:'foreign',email:issued.email,password:'Keep'});
  await assert.rejects(f.complete(issued),{code:'already-exists'});assert.equal(f.accounts.get('foreign').password,'Keep');
  assert.ok(!f.events.includes('update'));
});
test('interrupted provisioning retries same reserved UID and keeps principal inactive until confirmation',async()=>{
  const f=fixture(),issued=await f.issue(); f.auth.failure='synthetic-auth-failure';
  await assert.rejects(f.complete(issued));const inv=f.docs.get('staffInvitations/'+issued.userId);
  assert.equal(inv.status,'redeeming');assert.equal(inv.leaseUntil,0);assert.equal(f.docs.get('securityPrincipals/'+inv.authUid).active,false);
  await f.complete(issued);assert.equal(f.events.filter(e=>e==='create').length,1);assert.equal(f.docs.get('users/'+issued.userId).firebaseUid,inv.authUid);
});
test('partially created account can recover through an authorized rotated invitation',async()=>{
  const f=fixture(),first=await f.issue();f.auth.failure='synthetic';await assert.rejects(f.complete(first));
  const uid=f.docs.get('staffInvitations/'+first.userId).authUid;
  const second=await f.issue(admin,{action:'resend',userId:first.userId,operationId:'recover'});
  await f.complete(second);assert.equal(f.docs.get('users/'+second.userId).firebaseUid,uid);assert.equal(f.events.filter(e=>e==='create').length,1);
});
test('competing active lease blocks registration and rotation',async()=>{
  const f=fixture(),issued=await f.issue();Object.assign(f.docs.get('staffInvitations/'+issued.userId),{status:'redeeming',leaseUntil:2000,profileFingerprint:hash(JSON.stringify(profile))});
  await assert.rejects(f.complete(issued),{code:'aborted'});
  await assert.rejects(f.issue(admin,{action:'resend',userId:issued.userId,operationId:'resend'}),{code:'aborted'});
});
for(const path of ['users/admin','securityPrincipals/auth-admin'])test('issuer revocation stops registration '+path,async()=>{
  const f=fixture(),issued=await f.issue();f.docs.delete(path);await assert.rejects(f.complete(issued),{code:'permission-denied'});assert.ok(!f.events.includes('create'));
});
for(const marker of ['staffDeletionJobs','staffEmailChangeJobs'])test('target concurrent operation stops registration '+marker,async()=>{
  const f=fixture(),issued=await f.issue();f.docs.set(marker+'/'+issued.userId,{completed:false});
  await assert.rejects(f.complete(issued),{code:'failed-precondition'});assert.ok(!f.events.includes('create'));
});
test('partial registration blocks email change and deletion even after lease release',async()=>{
  const f=fixture(),issued=await f.issue();f.auth.failure='synthetic';await assert.rejects(f.complete(issued));
  await assert.rejects(changeStaffEmail(f.db,f.auth,admin,{userId:issued.userId,email:'new@example.test',expectedEmail:issued.email,operationId:'change'},true),{code:'aborted'});
  const ops=createDeletionOperations(f.db,f.auth,'delete',()=>({getFiles:async()=>[[]]}));
  await assert.rejects(ops.acquire({userId:issued.userId,authUid:null,doctorId:issued.userId,role:'doctor'}),{code:'aborted'});
});
test('pending email edit invalidates token and transfers its protected email claim',async()=>{
  const f=fixture(),issued=await f.issue();await changeStaffEmail(f.db,f.auth,admin,{userId:issued.userId,email:'new@example.test',expectedEmail:issued.email,operationId:'change'},true);
  assert.equal(f.docs.get('staffInvitations/'+issued.userId).status,'revoked');assert.ok(!f.docs.has('staffInvitationTokens/'+hash(issued.token)));
  assert.ok(!f.docs.has('staffEmailReservations/'+hash(issued.email)));assert.equal(f.docs.get('staffEmailReservations/'+hash('new@example.test')).userId,issued.userId);
  const second=await f.issue(admin,{action:'resend',userId:issued.userId,operationId:'new-address'});assert.equal(second.email,'new@example.test');await f.complete(second);
});
test('pending deletion cleans token lookup, metadata, issue jobs and own email claim',async()=>{
  const f=fixture(),issued=await f.issue();const ops=createDeletionOperations(f.db,f.auth,'delete',()=>({getFiles:async()=>[[]]}));
  const target=await ops.resolveTarget(issued.userId);await ops.acquire(target);await ops.deleteBusinessData(target);await ops.complete(target);
  assert.ok(!f.docs.has('staffInvitations/'+issued.userId));assert.ok(!f.docs.has('staffInvitationTokens/'+hash(issued.token)));
  assert.ok(!f.docs.has('staffEmailReservations/'+hash(issued.email)));assert.ok(!f.docs.has('users/'+issued.userId));
  assert.equal([...f.docs.keys()].filter(path=>path.startsWith('staffInvitationIssueJobs/')).length,0);
});
test('authority changed after Auth provisioning never activates the principal',async()=>{
  const f=fixture(),issued=await f.issue();f.auth.afterCreate=async()=>f.docs.delete('securityPrincipals/auth-admin');
  await assert.rejects(f.complete(issued),{code:'permission-denied'});const inv=f.docs.get('staffInvitations/'+issued.userId);
  assert.equal(f.docs.get('securityPrincipals/'+inv.authUid).active,false);assert.equal(f.accounts.get(inv.authUid).disabled,true);
});

test('parallel duplicate issuance has only one winner under serializable transactions',async()=>{
  const f=fixture();const results=await Promise.allSettled([f.issue(),f.issue(admin,{...request,operationId:'another'})]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
  assert.equal([...f.docs.entries()].filter(([path,value])=>path.startsWith('users/')&&value.email==='invited@example.test'&&value.pending===true).length,1);
});
test('parallel completion provisions only one Auth identity',async()=>{
  const f=fixture(),issued=await f.issue();const results=await Promise.allSettled([f.complete(issued),f.complete(issued)]);
  assert.ok(results.some(r=>r.status==='fulfilled'));assert.equal(f.events.filter(e=>e==='create').length,1);
});
test('a different authorized Admin can resend a Doctor without changing its creator',async()=>{
  const f=fixture(),issued=await f.issue();const secondAdmin={...admin,authUid:'auth-second',userId:'second'};
  f.docs.set('securityPrincipals/auth-second',secondAdmin);f.docs.set('users/second',{firebaseUid:'auth-second',role:'admin',name:'Otro Admin ficticio',email:'second@example.test',pending:false,profileComplete:true});
  const renewed=await f.issue(secondAdmin,{action:'resend',userId:issued.userId,operationId:'other-admin'});
  assert.equal(f.docs.get('users/'+issued.userId).createdBy,'admin');await f.complete(renewed);
});
test('pending deletion after email edit clears the transferred email claim',async()=>{
  const f=fixture(),issued=await f.issue();await changeStaffEmail(f.db,f.auth,admin,{userId:issued.userId,email:'new@example.test',expectedEmail:issued.email,operationId:'change'},true);
  const ops=createDeletionOperations(f.db,f.auth,'delete',()=>({getFiles:async()=>[[]]}));const target=await ops.resolveTarget(issued.userId);
  await ops.acquire(target);await ops.deleteBusinessData(target);await ops.complete(target);
  assert.ok(!f.docs.has('staffEmailReservations/'+hash('new@example.test')));
});
test('Auth creation followed by an acknowledgement failure retries reserved identity',async()=>{
  const f=fixture(),issued=await f.issue();f.auth.afterCreate=async()=>{f.auth.afterCreate=null;throw error('synthetic-lost-ack');};
  await assert.rejects(f.complete(issued));await f.complete(issued);assert.equal(f.events.filter(e=>e==='create').length,1);
});
test('final transaction failure retains inactive principal and completes safely on retry',async()=>{
  const f=fixture(),issued=await f.issue();f.auth.afterUpdate=async()=>{f.db.failAt=f.db.transactions+1;f.auth.afterUpdate=null;};
  await assert.rejects(f.complete(issued));const inv=f.docs.get('staffInvitations/'+issued.userId);
  assert.equal(f.docs.get('securityPrincipals/'+inv.authUid).active,false);assert.equal(f.docs.get('users/'+issued.userId).pending,true);
  await f.complete(issued);assert.equal(f.docs.get('securityPrincipals/'+inv.authUid).active,true);
});
const functionsRequire=createRequire(new URL('../../functions/package.json',import.meta.url));
for(const [label,mutate,code] of [
  ['missing authentication',f=>{f.request.auth=undefined;},'unauthenticated'],
  ['revoked token',f=>{f.tokenError='auth/id-token-revoked';},'unauthenticated'],
  ['token UID mismatch',f=>{f.uid='forged';},'unauthenticated'],
  ['unbound principal',f=>{f.docs.get('securityPrincipals/auth-admin').authUid='different';},'permission-denied'],
  ['inactive issuer',f=>{f.docs.get('securityPrincipals/auth-admin').active=false;},'permission-denied'],
  ['unsupported client role',f=>{f.request.data={...request,role:'patient'};},'invalid-argument'],
])test('management callable rejects '+label+' before business writes',async t=>{
  const {initializeApp,deleteApp}=functionsRequire('firebase-admin/app');
  const {getAuth}=functionsRequire('firebase-admin/auth');const {getFirestore}=functionsRequire('firebase-admin/firestore');
  const app=initializeApp({projectId:'demo-lilcare-p13'}),sdkAuth=getAuth(app),sdkDb=getFirestore(app),f=fixture();
  f.uid=admin.authUid;f.request={data:request,auth:{uid:admin.authUid},rawRequest:{headers:{authorization:'Bearer synthetic-token'}}};mutate(f);
  const {Timestamp}=functionsRequire('firebase-admin/firestore');
  f.docs.set('clinicSessions/callable-admin',{authUid:admin.authUid,role:'admin',active:true,expiresAt:Timestamp.fromMillis(Date.now()+3600000)});
  t.mock.method(sdkAuth,'verifyIdToken',async(_token,checkRevoked)=>{assert.equal(checkRevoked,true);if(f.tokenError)throw error(f.tokenError);return{uid:f.uid,clinicSessionId:'callable-admin'};});
  t.mock.method(sdkDb,'doc',path=>f.db.doc(path));t.mock.method(sdkDb,'runTransaction',fn=>f.db.runTransaction(fn));
  process.env.STAFF_INVITATIONS_ENABLED='true';t.after(async()=>{delete process.env.STAFF_INVITATIONS_ENABLED;await deleteApp(app);});
  await assert.rejects(manageStaffInvitation.run(f.request),{code});assert.deepEqual(f.events,[]);
});
test('public inspection shares a server-derived rate limit without persisting IP or token',async t=>{
  const {initializeApp,deleteApp}=functionsRequire('firebase-admin/app');const {getFirestore}=functionsRequire('firebase-admin/firestore');
  const app=initializeApp({projectId:'demo-lilcare-p13'}),sdkDb=getFirestore(app),f=fixture(),issued=await f.issue(admin,request,Date.now());
  t.mock.method(sdkDb,'doc',path=>f.db.doc(path));t.mock.method(sdkDb,'runTransaction',fn=>f.db.runTransaction(fn));
  process.env.STAFF_INVITATIONS_ENABLED='true';t.after(async()=>{delete process.env.STAFF_INVITATIONS_ENABLED;await deleteApp(app);});
  const req={data:{token:issued.token},rawRequest:{headers:{},ip:'192.0.2.17'}};
  for(let n=0;n<30;n++)assert.equal((await inspectStaffInvitation.run(req)).email,issued.email);
  await assert.rejects(inspectStaffInvitation.run(req),{code:'resource-exhausted'});
  assert.ok(!JSON.stringify([...f.docs]).includes('192.0.2.17'));assert.ok(!JSON.stringify([...f.docs]).includes(issued.token));
});
