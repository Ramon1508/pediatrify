import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const functionsRequire = createRequire(new URL('../../functions/package.json', import.meta.url));
// Isolated compiled module, never index.js or production services.
const {changeStaffEmail, parseEmailRequest, updateStaffEmail} = require('../../functions/lib/staff-email-change.js');
const {createDeletionOperations} = require('../../functions/lib/staff-deletion.js');
const admin = {authUid: 'auth-admin', userId: 'admin', role: 'admin', active: true};
const doctor = {authUid: 'auth-doctor', userId: 'doctor', role: 'doctor', doctorId: 'doctor', active: true};
const assistant = {authUid: 'auth-assistant', userId: 'assistant', role: 'assistant', doctorId: 'doctor', active: true};
const request = {userId: 'doctor', expectedEmail: 'doctor@example.test', email: 'new@example.test', name: 'Doctor ficticio', operationId: 'op-one'};
const error = code => Object.assign(new Error('Synthetic failure'), {code});

function fixture() {
  const docs = new Map();
  const accounts = new Map();
  const events = [];
  for (const principal of [admin, doctor, assistant]) {
    docs.set('securityPrincipals/' + principal.authUid, {...principal});
    docs.set('users/' + principal.userId, {uid: principal.userId, firebaseUid: principal.authUid, role: principal.role,
      pending: false, profileComplete: true, email: principal.userId + '@example.test', name: 'Nombre ficticio',
      ...(principal.role === 'assistant' ? {createdBy: 'doctor'} : {}), logoPath: 'synthetic/logo', phone: 'synthetic'});
    accounts.set(principal.authUid, {uid: principal.authUid, email: principal.userId + '@example.test',
      passwordHash: 'synthetic-hash', customClaims: {synthetic: true}, emailVerified: true, disabled: false});
  }
  docs.set('patients/synthetic-child', {doctorId: 'doctor'});
  docs.set('appointments/synthetic', {doctorId: 'doctor', patientId: 'synthetic-child'});
  docs.set('clinicalRecords/synthetic', {patientId: 'synthetic-child'});
  const snapshot = path => ({exists: docs.has(path), id: path.split('/').at(-1),
    data: () => docs.has(path) ? {...structuredClone(docs.get(path)),
      ...(docs.get(path).expiresAt ? {expiresAt: docs.get(path).expiresAt} : {})} : undefined, ref: doc(path)});
  function doc(path) { return {path, get: async () => snapshot(path)}; }
  function query(collection, conditions = [], maximum = Infinity) {
    return {get: async () => ({docs: [...docs].filter(([path, value]) => path.split('/')[0] === collection &&
      conditions.every(([field, expected]) => value[field] === expected)).slice(0, maximum).map(([path]) => snapshot(path))}),
    where: (field, op, expected) => { assert.equal(op, '=='); return query(collection, [...conditions, [field, expected]], maximum); },
    limit: max => query(collection, conditions, max)};
  }
  const db = {
    doc, collection: name => query(name), transactions: 0,
    runTransaction: async callback => {
      db.transactions++;
      const writes = [];
      const result = await callback({
        get: async ref => { assert.equal(writes.length, 0, 'all reads precede writes'); return ref.get(); },
        set: (ref, value) => writes.push(() => { docs.set(ref.path, value); events.push('set:' + ref.path); }),
        update: (ref, value) => writes.push(() => {
          assert.ok(docs.has(ref.path)); docs.set(ref.path, {...docs.get(ref.path), ...value}); events.push('update:' + ref.path);
        }),
        delete: ref => writes.push(() => { docs.delete(ref.path); events.push('delete:' + ref.path); }),
      });
      if (db.failFinal && db.transactions === 3) {
        db.failFinal = false;
        throw error('synthetic-final-failure');
      }
      writes.forEach(write => write());
      return result;
    },
  };
  const auth = {
    getUserByEmail: async email => {
      events.push('lookup:' + email);
      const found = [...accounts.values()].find(account => account.email === email);
      if (!found) throw error('auth/user-not-found');
      return structuredClone(found);
    },
    getUser: async uid => {
      events.push('get:' + uid);
      if (!accounts.has(uid)) throw error('auth/user-not-found');
      return structuredClone(accounts.get(uid));
    },
    updateUser: async (uid, fields) => {
      events.push('auth-update:' + uid);
      assert.deepEqual(Object.keys(fields).sort(), ['email', 'emailVerified']);
      if (auth.failure) { const failure = auth.failure; auth.failure = null; throw error(failure); }
      if ([...accounts.values()].some(account => account.uid !== uid && account.email === fields.email)) throw error('auth/email-already-exists');
      Object.assign(accounts.get(uid), fields);
      await auth.afterUpdate?.();
      return structuredClone(accounts.get(uid));
    },
  };
  const change = (actor = admin, data = request, lease = 'lease-one') => changeStaffEmail(db, auth, actor, data, true, lease);
  return {docs, accounts, events, db, auth, change};
}

test('Admin changes email of a legacy Doctor document ID without recreating Auth or interpreting the ID as an email',async()=>{
  const f=fixture(); const userId='doctor.legacy+test@example.invalid';
  f.docs.set('users/'+userId,{...f.docs.get('users/doctor'),uid:userId});f.docs.delete('users/doctor');
  f.docs.set('securityPrincipals/auth-doctor',{...doctor,userId,doctorId:userId});
  const originalHash=f.accounts.get('auth-doctor').passwordHash;
  await f.change(admin,{...request,userId});
  assert.equal(f.docs.get('users/'+userId).email,request.email);
  assert.equal(f.accounts.get('auth-doctor').passwordHash,originalHash);
  assert.equal(f.accounts.get('auth-doctor').uid,'auth-doctor');
  assert.throws(()=>parseEmailRequest({...request,userId,operationId:'bad@example.invalid'}),{code:'invalid-argument'});
  assert.throws(()=>parseEmailRequest({...request,userId:'../doctor'}),{code:'invalid-argument'});
});

test('callable gate is disabled by default before Admin initialization', async () => {
  delete process.env.STAFF_EMAIL_CHANGE_ENABLED;
  await assert.rejects(updateStaffEmail.run({data: request, rawRequest: {headers: {}}}), {code: 'failed-precondition'});
});
test('disabled adapter does no reads or Auth work', async () => {
  const f = fixture();
  await assert.rejects(changeStaffEmail(f.db, f.auth, admin, request, false), {code: 'failed-precondition'});
  assert.equal(f.db.transactions, 0); assert.deepEqual(f.events, []);
});
for (const value of [null, [], {}, {...request, userId: '../doctor'}, {...request, operationId: ''},
  {...request, role: 'admin'}, {...request, firebaseUid: 'injected'}, {...request, password: 'synthetic'},
  {...request, email: 'invalid'}, {...request, email: 'x'.repeat(255)}, {...request, name: '   '}]) {
  test('rejects malformed or client authority payload ' + JSON.stringify(value), () => {
    assert.throws(() => parseEmailRequest(value), {code: 'invalid-argument'});
  });
}
test('normalizes email and name without resolving identity by email', () => {
  assert.deepEqual(parseEmailRequest({...request, email: ' NEW@example.test ', name: ' Name '}),
    {...request, email: 'new@example.test', name: 'Name'});
});
test('admin changes Doctor email/name on same Auth UID and preserves password, scope and medical data', async () => {
  const f = fixture();
  assert.deepEqual(await f.change(), {updated: true, pendingInvitation: false});
  assert.equal(f.accounts.get(doctor.authUid).email, request.email);
  assert.equal(f.accounts.get(doctor.authUid).passwordHash, 'synthetic-hash');
  assert.deepEqual(f.accounts.get(doctor.authUid).customClaims, {synthetic: true});
  assert.equal(f.accounts.get(doctor.authUid).emailVerified, false);
  assert.equal(f.docs.get('users/doctor').firebaseUid, doctor.authUid);
  assert.equal(f.docs.get('users/doctor').logoPath, 'synthetic/logo');
  assert.equal(f.docs.get('users/doctor').email, request.email);
  assert.equal(f.accounts.get(admin.authUid).email, 'admin@example.test');
  for (const path of ['patients/synthetic-child', 'appointments/synthetic', 'clinicalRecords/synthetic']) assert.ok(f.docs.has(path));
  assert.equal(f.docs.get('staffEmailChangeJobs/doctor').completed, true);
  assert.equal([...f.docs.keys()].filter(path => path.startsWith('staffEmailReservations/')).length, 0);
});
test('doctor can change only own Assistant email/name, preserving owner agenda', async () => {
  const f = fixture();
  await f.change(doctor, {...request, userId: 'assistant', expectedEmail: 'assistant@example.test'});
  assert.equal(f.accounts.get(assistant.authUid).email, request.email);
  assert.equal(f.docs.get('users/assistant').createdBy, 'doctor');
  assert.equal(f.accounts.get(doctor.authUid).email, 'doctor@example.test');
});
test('Admin self edit changes email only; its name remains unchanged', async () => {
  const f = fixture();
  const {name, ...input} = request;
  await f.change(admin, {...input, userId: 'admin', expectedEmail: 'admin@example.test'});
  assert.equal(f.docs.get('users/admin').name, 'Nombre ficticio');
  assert.equal(f.accounts.get(admin.authUid).email, request.email);
});
test('Admin self name injection is rejected, even with a valid changed email', async () => {
  const f = fixture();
  await assert.rejects(f.change(admin, {...request, userId: 'admin', expectedEmail: 'admin@example.test'}), {code: 'permission-denied'});
  assert.equal(f.accounts.get(admin.authUid).email, 'admin@example.test');
});
test('Assistant self edit changes name/email with verified owner', async () => {
  const f = fixture();
  await f.change(assistant, {...request, userId: 'assistant', expectedEmail: 'assistant@example.test'});
  assert.equal(f.docs.get('users/assistant').name, request.name);
});
for (const [label, actor, input] of [
  ['Doctor own email', doctor, request],
  ['Admin managing Assistant', admin, {...request, userId: 'assistant', expectedEmail: 'assistant@example.test'}],
  ['Assistant managing Doctor', assistant, request],
  ['inactive caller', {...admin, active: false}, request],
  ['patient caller', {...admin, role: 'patient'}, request],
]) test(label + ' denied', async () => {
  const f = fixture(); await assert.rejects(f.change(actor, input), {code: 'permission-denied'});
  assert.ok(!f.events.some(event => event.startsWith('auth-update')));
});
for (const [label, mutate, code] of [
  ['principal/profile mismatch', f => { f.docs.get('securityPrincipals/auth-doctor').userId = 'other'; }, 'failed-precondition'],
  ['stale operator', f => { f.docs.get('users/assistant').firebaseUid = 'other'; }, 'permission-denied'],
  ['invalid own Assistant owner', f => { f.docs.get('users/doctor').pending = true; }, 'failed-precondition'],
  ['owner deactivated', f => { f.docs.get('securityPrincipals/auth-doctor').active = false; }, 'failed-precondition'],
  ['target deletion job', f => { f.docs.set('staffDeletionJobs/assistant', {}); }, 'failed-precondition'],
  ['owner deletion job', f => { f.docs.set('staffDeletionJobs/doctor', {}); }, 'failed-precondition'],
]) test(label + ' blocks self Assistant change', async () => {
  const f = fixture(); mutate(f);
  await assert.rejects(f.change(assistant, {...request, userId: 'assistant', expectedEmail: 'assistant@example.test'}), {code});
  assert.ok(!f.events.some(event => event.startsWith('auth-update')));
});
test('unbound completed account is not looked up or recreated by email', async () => {
  const f = fixture(); delete f.docs.get('users/doctor').firebaseUid;
  await assert.rejects(f.change(), {code: 'failed-precondition'});
  assert.deepEqual(f.events, []);
});
test('pending invitation changes profile only without creating Auth account', async () => {
  const f = fixture();
  f.docs.set('users/invited', {role: 'doctor', pending: true, profileComplete: false, email: 'invited@example.test', name: 'Pendiente'});
  await f.change(admin, {...request, userId: 'invited', expectedEmail: 'invited@example.test'});
  assert.equal(f.docs.get('users/invited').email, request.email);
  assert.equal(f.accounts.size, 3);
  assert.ok(!f.events.some(event => event.startsWith('auth-update')));
});
test('pending invitation with an unbound existing Auth identity is rejected', async () => {
  const f = fixture();
  f.docs.set('users/invited', {role: 'doctor', pending: true, email: 'invited@example.test'});
  f.accounts.set('orphan', {uid: 'orphan', email: 'invited@example.test'});
  await assert.rejects(f.change(admin, {...request, userId: 'invited', expectedEmail: 'invited@example.test'}), {code: 'failed-precondition'});
});
for (const origin of ['Auth', 'profile', 'reservation']) test('duplicate from ' + origin + ' does not change profile or Auth', async () => {
  const f = fixture();
  if (origin === 'Auth') f.accounts.set('other', {uid: 'other', email: request.email});
  if (origin === 'profile') f.docs.set('users/other', {email: request.email});
  if (origin === 'reservation') {
    const {createHash} = await import('node:crypto');
    f.docs.set('staffEmailReservations/' + createHash('sha256').update(request.email).digest('hex'), {userId: 'other'});
  }
  await assert.rejects(f.change(), {code: 'already-exists'});
  assert.equal(f.docs.get('users/doctor').email, request.expectedEmail);
  assert.ok(!f.events.some(event => event.startsWith('auth-update')));
});
test('stale expected email is rejected before changing Auth', async () => {
  const f = fixture(); await assert.rejects(f.change(admin, {...request, expectedEmail: 'stale@example.test'}), {code: 'aborted'});
  assert.ok(!f.events.some(event => event.startsWith('auth-update')));
});
test('known Auth collision releases job/reservation', async () => {
  const f = fixture(); f.auth.failure = 'auth/email-already-exists';
  await assert.rejects(f.change(), {code: 'auth/email-already-exists'});
  assert.ok(!f.docs.has('staffEmailChangeJobs/doctor'));
  assert.equal([...f.docs.keys()].filter(path => path.startsWith('staffEmailReservations/')).length, 0);
});
test('partial Auth success preserves retry metadata; fresh login operation ID can complete without second Auth update', async () => {
  const f = fixture(); f.db.failFinal = true;
  await assert.rejects(f.change(), {code: 'synthetic-final-failure'});
  assert.equal(f.accounts.get(doctor.authUid).email, request.email);
  assert.equal(f.docs.get('users/doctor').email, request.expectedEmail);
  assert.equal(f.docs.get('staffEmailChangeJobs/doctor').leaseUntil, 0);
  await f.change(admin, {...request, operationId: 'op-after-login'}, 'new-lease');
  assert.equal(f.docs.get('users/doctor').email, request.email);
  assert.equal(f.events.filter(event => event === 'auth-update:auth-doctor').length, 1);
});
test('partial job rejects a changed retry payload and blocks deletion', async () => {
  const f = fixture(); f.db.failFinal = true; await assert.rejects(f.change());
  await assert.rejects(f.change(admin, {...request, email: 'different@example.test'}, 'new-lease'), {code: 'failed-precondition'});
  const ops = createDeletionOperations(f.db, f.auth, 'deletion-lease', () => ({}));
  await assert.rejects(ops.acquire({userId: 'doctor', role: 'doctor', doctorId: 'doctor', authUid: 'auth-doctor'}), {code: 'aborted'});
});
test('completed identical retry is idempotent even after reopening editor', async () => {
  const f = fixture(); await f.change();
  await f.change(admin, {...request, operationId: 'op-new-dialog'}, 'new-lease');
  assert.equal(f.events.filter(event => event === 'auth-update:auth-doctor').length, 1);
});
test('second invocation cannot claim an active lease', async () => {
  const f = fixture();
  f.auth.afterUpdate = async () => {
    await assert.rejects(f.change(admin, request, 'concurrent-lease'), {code: 'aborted'});
  };
  await f.change();
  assert.equal(f.events.filter(event => event === 'auth-update:auth-doctor').length, 1);
});
test('identity or owner change after Auth update prevents final profile overwrite', async () => {
  const f = fixture();
  f.auth.afterUpdate = async () => { f.docs.get('users/doctor').firebaseUid = 'changed-identity'; };
  await assert.rejects(f.change(), {code: 'failed-precondition'});
  assert.equal(f.docs.get('users/doctor').email, request.expectedEmail);
  assert.equal(f.docs.get('staffEmailChangeJobs/doctor').completed, false);
});
test('missing or disabled mapped Auth account fails without rewriting profile', async () => {
  for (const disable of [true, false]) {
    const f = fixture();
    if (disable) f.accounts.get(doctor.authUid).disabled = true; else f.accounts.delete(doctor.authUid);
    await assert.rejects(f.change());
    assert.equal(f.docs.get('users/doctor').email, request.expectedEmail);
  }
});
for (const [label, mutate, code] of [
  ['missing authentication', f => { f.request.auth = undefined; }, 'unauthenticated'],
  ['revoked token', f => { f.tokenError = 'auth/id-token-revoked'; }, 'unauthenticated'],
  ['token UID mismatch', f => { f.verifiedUid = 'different'; }, 'unauthenticated'],
  ['unbound principal', f => { f.docs.get('securityPrincipals/auth-admin').authUid = 'different'; }, 'permission-denied'],
  ['caller deactivated', f => { f.docs.get('securityPrincipals/auth-admin').active = false; }, 'permission-denied'],
  ['untrusted payload', f => { f.request.data = {...request, role: 'admin'}; }, 'invalid-argument'],
]) test('callable rejects ' + label + ' before writes', async t => {
  const {initializeApp, deleteApp} = functionsRequire('firebase-admin/app');
  const {getAuth} = functionsRequire('firebase-admin/auth');
  const {getFirestore} = functionsRequire('firebase-admin/firestore');
  const app = initializeApp({projectId: 'demo-lilcare-p09'});
  const auth = getAuth(app);
  const db = getFirestore(app);
  const f = fixture();
  f.verifiedUid = admin.authUid;
  const {Timestamp} = functionsRequire('firebase-admin/firestore');
  f.docs.set('clinicSessions/callable-admin', {authUid: admin.authUid, role: 'admin', active: true, expiresAt: Timestamp.fromMillis(Date.now() + 3600000)});
  f.request = {data: request, auth: {uid: admin.authUid}, rawRequest: {headers: {authorization: 'Bearer synthetic-token'}}};
  mutate(f);
  t.mock.method(auth, 'verifyIdToken', async (_token, revoked) => {
    assert.equal(revoked, true);
    if (f.tokenError) throw error(f.tokenError);
    return {uid: f.verifiedUid, clinicSessionId: 'callable-admin'};
  });
  t.mock.method(db, 'doc', path => f.db.doc(path));
  t.mock.method(db, 'runTransaction', fn => f.db.runTransaction(fn));
  process.env.STAFF_EMAIL_CHANGE_ENABLED = 'true';
  t.after(async () => { delete process.env.STAFF_EMAIL_CHANGE_ENABLED; await deleteApp(app); });
  await assert.rejects(updateStaffEmail.run(f.request), {code});
  assert.deepEqual(f.events, []);
});
