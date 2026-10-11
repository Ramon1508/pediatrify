import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

// Import compiled isolated modules, never index.js (SMTP/environment side effects).
const require = createRequire(import.meta.url);
const functionsRequire = createRequire(new URL('../../functions/package.json', import.meta.url));
const {deleteStaffAccount} = require('../../functions/lib/staff-deletion-policy.js');
const {createDeletionOperations, deleteStaff} = require('../../functions/lib/staff-deletion.js');
const admin = {authUid: 'auth-admin', userId: 'admin', role: 'admin', active: true};
const doctor = {authUid: 'auth-doctor', userId: 'doctor', role: 'doctor', doctorId: 'doctor', active: true};
const doctorTarget = {userId: 'doctor', role: 'doctor', doctorId: 'doctor', authUid: 'auth-doctor'};
const assistantTarget = {userId: 'assistant', role: 'assistant', doctorId: 'doctor', authUid: 'auth-assistant'};

function policyOperations(target = doctorTarget) {
  const calls = [];
  const ops = {enabled: true, calls, resolveTarget: async () => { calls.push('resolve'); return target; }};
  for (const name of ['acquire', 'prepareRelatedStaff', 'disableAccess', 'invalidatePrincipal', 'deleteBusinessData', 'deleteAuth', 'complete', 'release']) {
    ops[name] = async () => { calls.push(name); return name === 'acquire' ? 'acquired' : undefined; };
  }
  return ops;
}

test('legacy staff IDs remain scoped to the resolved Doctor owner and reject unsafe document paths',async()=>{
  const doctorId='doctor.legacy+test@example.invalid';const userId='assistant.legacy@example.invalid';
  const actor={...doctor,userId:doctorId,doctorId};const target={...assistantTarget,userId,doctorId};
  const ops=policyOperations(target);
  await deleteStaffAccount({userId},actor,ops);
  assert.ok(ops.calls.includes('complete'));
  await assert.rejects(deleteStaffAccount({userId},doctor,policyOperations(target)),{code:'permission-denied'});
  await assert.rejects(deleteStaffAccount({userId:'../assistant'},actor,policyOperations(target)),{code:'invalid-argument'});
});

test('callable is disabled by default, before initializing Admin services', async () => {
  delete process.env.STAFF_DELETION_ENABLED;
  await assert.rejects(deleteStaff.run({data: {userId: 'doctor'}, rawRequest: {headers: {}}}), {code: 'failed-precondition'});
});

test('gate prevents every operation', async () => {
  const ops = policyOperations();
  ops.enabled = false;
  await assert.rejects(deleteStaffAccount({userId: 'doctor'}, admin, ops), {code: 'failed-precondition'});
  assert.deepEqual(ops.calls, []);
});

for (const [name, actor, target] of [
  ['assistant cannot delete staff', {...doctor, role: 'assistant'}, assistantTarget],
  ['patient cannot delete staff', {...doctor, role: 'patient'}, doctorTarget],
  ['inactive admin', {...admin, active: false}, doctorTarget],
  ['doctor cannot delete self', doctor, doctorTarget],
  ['doctor cannot delete another doctor', doctor, {...doctorTarget, userId: 'other', doctorId: 'other'}],
  ['doctor cannot delete a foreign assistant', doctor, {...assistantTarget, doctorId: 'other'}],
  ['admin cannot delete an assistant', admin, assistantTarget],
  ['unbound doctor authority', {...doctor, doctorId: 'other'}, assistantTarget],
  ['target Auth identity equals actor', admin, {...doctorTarget, authUid: 'auth-admin'}],
]) {
  test(name, async () => {
    const ops = policyOperations(target);
    await assert.rejects(deleteStaffAccount({userId: target.userId}, actor, ops), {code: 'permission-denied'});
    assert.ok(!ops.calls.includes('acquire'));
  });
}

for (const data of [null, [], {}, {userId: '../doctor'}, {userId: ''}, {userId: ' doctor'},
  {userId: 'doctor', role: 'admin'}, {userId: 'doctor', authUid: 'victim'}, {userId: 'a'.repeat(129)}]) {
  test(`rejects malformed/client authority payload ${JSON.stringify(data)}`, async () => {
    const ops = policyOperations();
    await assert.rejects(deleteStaffAccount(data, admin, ops), {code: 'invalid-argument'});
    assert.deepEqual(ops.calls, []);
  });
}

test('admin deletion follows access block, principal revocation, data, Auth, completion order', async () => {
  const ops = policyOperations();
  assert.deepEqual(await deleteStaffAccount({userId: 'doctor'}, admin, ops), {deleted: true});
  assert.deepEqual(ops.calls, ['resolve', 'acquire', 'prepareRelatedStaff', 'disableAccess', 'invalidatePrincipal', 'deleteBusinessData', 'deleteAuth', 'complete']);
});

test('doctor can delete only own assistant', async () => {
  assert.deepEqual(await deleteStaffAccount({userId: 'assistant'}, doctor, policyOperations(assistantTarget)), {deleted: true});
});

for (const phase of ['prepareRelatedStaff', 'disableAccess', 'invalidatePrincipal', 'deleteBusinessData', 'deleteAuth', 'complete']) {
  test(`failure at ${phase} stops deletion, releases lease and reports failure`, async () => {
    const ops = policyOperations();
    const failure = new Error(phase);
    ops[phase] = async () => { ops.calls.push(phase); throw failure; };
    await assert.rejects(deleteStaffAccount({userId: 'doctor'}, admin, ops), error => error === failure);
    assert.equal(ops.calls.at(-1), 'release');
    if (phase !== 'complete') assert.ok(!ops.calls.includes('complete'));
  });
}

test('completed retry is still authorized and performs no destructive operations', async () => {
  const ops = policyOperations();
  ops.acquire = async () => 'completed';
  assert.deepEqual(await deleteStaffAccount({userId: 'doctor'}, admin, ops), {deleted: true});
  assert.deepEqual(ops.calls, ['resolve']);
});

function fakeServices(target = doctorTarget) {
  const docs = new Map();
  const events = [];
  docs.set(`users/${target.userId}`, {role: target.role, createdBy: target.doctorId, firebaseUid: target.authUid, email: 'staff@example.invalid'});
  docs.set(`securityPrincipals/${target.authUid}`, {...target, userId: target.userId, authUid: target.authUid, active: true});
  const accounts = new Map([[target.authUid, {uid: target.authUid}]]);
  const files = new Set();
  const bucket = {
    getFiles: async options => {
      assert.equal(options.autoPaginate, false);
      assert.equal(options.versions, true);
      events.push(`storage-list:${options.prefix}`);
      return [[...files].filter(name => name.startsWith(options.prefix)).slice(0, options.maxResults).map(name => ({
        name, delete: async options => {
          assert.equal(options.ignoreNotFound, true);
          if (bucket.failFile === name) { bucket.failFile = null; throw new Error('synthetic Storage failure'); }
          events.push(`storage-delete:${name}`);
          files.delete(name);
        },
      }))];
    },
  };
  const missing = () => Object.assign(new Error('synthetic absent account'), {code: 'auth/user-not-found'});
  const auth = {
    getUser: async uid => { events.push(`getAuth:${uid}`); if (!accounts.has(uid)) throw missing(); return accounts.get(uid); },
    getUserByEmail: async () => { events.push('getByEmail'); throw missing(); },
    updateUser: async (uid, values) => { events.push(`disable:${uid}`); if (!accounts.has(uid)) throw missing(); Object.assign(accounts.get(uid), values); },
    revokeRefreshTokens: async uid => { events.push(`revoke:${uid}`); if (!accounts.has(uid)) throw missing(); },
    deleteUser: async uid => { events.push(`deleteAuth:${uid}`); if (!accounts.delete(uid)) throw missing(); },
  };
  const snapshot = path => ({data: () => docs.get(path), exists: docs.has(path), id: path.split('/').at(-1), ref: doc(path)});
  function doc(path) {
    return {path, get: async () => snapshot(path),
      update: async value => { assert.ok(docs.has(path)); docs.set(path, {...docs.get(path), ...value}); events.push(`update:${path}`); },
      delete: async () => { docs.delete(path); events.push(`delete:${path}`); },
    };
  }
  function query(collection, conditions = [], count = Infinity) {
    return {
      where: (field, op, value) => { assert.equal(op, '=='); return query(collection, [...conditions, [field, value]], count); },
      limit: limit => query(collection, conditions, limit),
      get: async () => {
        const found = [...docs].filter(([path, value]) => path.split('/')[0] === collection &&
          conditions.every(([field, expected]) => value[field] === expected)).slice(0, count).map(([path]) => snapshot(path));
        return {empty: found.length === 0, docs: found};
      },
    };
  }
  const db = {
    doc, collection: name => query(name),
    batch: () => {
      const paths = [];
      return {delete: ref => paths.push(ref.path), commit: async () => {
        events.push(`batch:${paths.length}`);
        if (db.failNextBatch) { db.failNextBatch = false; throw new Error('synthetic batch failure'); }
        paths.forEach(path => docs.delete(path));
      }};
    },
    runTransaction: async callback => {
      const writes = [];
      const result = await callback({
        get: async ref => { assert.equal(writes.length, 0, 'transaction reads must precede writes'); return snapshot(ref.path); },
        set: (ref, value) => writes.push(() => docs.set(ref.path, {...docs.get(ref.path), ...value})),
        update: (ref, value) => writes.push(() => docs.set(ref.path, {...docs.get(ref.path), ...value})),
        delete: ref => writes.push(() => docs.delete(ref.path)),
      });
      writes.forEach(write => write());
      return result;
    },
  };
  return {docs, events, accounts, auth, db, bucket, files, ops: createDeletionOperations(db, auth, 'test-lease', () => bucket)};
}

test('adapter deletes the mapped Auth UID, scoped patients/records/citas, preserves unrelated data', async () => {
  const state = fakeServices();
  state.docs.set('patients/child', {doctorId: 'doctor'});
  state.docs.set('patients/foreign', {doctorId: 'other'});
  state.docs.set('clinicalRecords/own', {patientId: 'child'});
  state.docs.set('clinicalRecords/foreign', {patientId: 'foreign'});
  state.docs.set('appointments/own', {patientId: 'child', doctorId: 'doctor'});
  state.docs.set('appointments/extra', {doctorId: 'doctor', disabled: true});
  state.docs.set('appointments/foreign', {patientId: 'foreign', doctorId: 'other'});
  state.docs.set('users/assistant', {role: 'assistant', createdBy: 'doctor', pending: true, email: 'invitation@example.invalid'});
  state.docs.set('users/foreign-assistant', {role: 'assistant', createdBy: 'other'});
  await deleteStaffAccount({userId: 'doctor'}, admin, state.ops);
  for (const path of ['patients/child', 'clinicalRecords/own', 'appointments/own', 'appointments/extra', 'users/doctor', 'users/assistant']) assert.ok(!state.docs.has(path));
  for (const path of ['patients/foreign', 'clinicalRecords/foreign', 'appointments/foreign', 'users/foreign-assistant']) assert.ok(state.docs.has(path));
  assert.equal(state.accounts.has('auth-doctor'), false);
  assert.equal(state.docs.get('securityPrincipals/auth-doctor').active, false);
  assert.equal(state.docs.get('staffDeletionJobs/doctor').completed, true);
  assert.ok(state.events.indexOf('revoke:auth-doctor') < state.events.indexOf('batch:1'));
});

test('assistant deletion never deletes patients even if their doctorId matches its UID', async () => {
  const state = fakeServices(assistantTarget);
  state.docs.set('patients/child', {doctorId: 'assistant'});
  state.docs.set('clinicalRecords/record', {patientId: 'child'});
  state.docs.set('appointments/doctor', {doctorId: 'doctor'});
  await deleteStaffAccount({userId: 'assistant'}, doctor, state.ops);
  assert.ok(state.docs.has('patients/child'));
  assert.ok(state.docs.has('clinicalRecords/record'));
  assert.ok(state.docs.has('appointments/doctor'));
  assert.ok(!state.accounts.has('auth-assistant'));
});

test('principal/profile identity mismatch does not disable or delete an account', async () => {
  const state = fakeServices();
  state.docs.get('securityPrincipals/auth-doctor').userId = 'different';
  await assert.rejects(deleteStaffAccount({userId: 'doctor'}, admin, state.ops), {code: 'failed-precondition'});
  assert.ok(!state.docs.has('staffDeletionJobs/doctor'));
  assert.ok(state.accounts.has('auth-doctor'));
  assert.deepEqual(state.events, []);
});

test('identity changes before reserving the job are rejected transactionally', async () => {
  const state = fakeServices();
  const target = await state.ops.resolveTarget('doctor');
  state.docs.get('users/doctor').firebaseUid = 'different';
  await assert.rejects(state.ops.acquire(target), {code: 'failed-precondition'});
  assert.ok(!state.docs.has('staffDeletionJobs/doctor'));
});

test('concurrent request is rejected; lease is released after a failed step', async () => {
  const state = fakeServices();
  await state.ops.acquire(doctorTarget);
  const second = createDeletionOperations(state.db, state.auth, 'second-lease', () => state.bucket);
  await assert.rejects(second.acquire({...doctorTarget}), {code: 'aborted'});
  await state.ops.release(doctorTarget);
  assert.equal(await second.acquire({...doctorTarget}), 'acquired');
  await assert.rejects(state.ops.complete(doctorTarget), {code: 'aborted'});
});

test('partial batch failure retains profile, disabled access and retry metadata', async () => {
  const state = fakeServices();
  state.docs.set('patients/child', {doctorId: 'doctor'});
  state.docs.set('clinicalRecords/record', {patientId: 'child'});
  state.db.failNextBatch = true;
  await assert.rejects(deleteStaffAccount({userId: 'doctor'}, admin, state.ops), /batch failure/);
  assert.equal(state.accounts.get('auth-doctor').disabled, true);
  assert.ok(state.docs.has('users/doctor'));
  assert.ok(state.docs.has('patients/child'));
  assert.equal(state.docs.get('staffDeletionJobs/doctor').leaseUntil, 0);
  await deleteStaffAccount({userId: 'doctor'}, admin, state.ops);
  assert.ok(!state.docs.has('users/doctor'));
  assert.ok(!state.accounts.has('auth-doctor'));
});

test('retry after Auth deletion uses stored UID, never a replacement account by email', async () => {
  const state = fakeServices();
  const complete = state.ops.complete;
  state.ops.complete = async () => { throw new Error('synthetic final transaction failure'); };
  await assert.rejects(deleteStaffAccount({userId: 'doctor'}, admin, state.ops), /transaction failure/);
  assert.ok(!state.accounts.has('auth-doctor'));
  assert.ok(state.docs.has('users/doctor'));
  state.accounts.set('replacement-auth', {uid: 'replacement-auth'});
  state.docs.get('users/doctor').email = 'replacement@example.invalid';
  state.ops.complete = complete;
  await deleteStaffAccount({userId: 'doctor'}, admin, state.ops);
  assert.ok(state.accounts.has('replacement-auth'));
  assert.ok(!state.events.includes('getByEmail'));
  await deleteStaffAccount({userId: 'doctor'}, admin, state.ops); // idempotent completed retry
});

test('batches remain bounded when deleting more than 400 records', async () => {
  const state = fakeServices();
  state.docs.set('patients/child', {doctorId: 'doctor'});
  for (let i = 0; i < 402; i++) state.docs.set(`clinicalRecords/record-${i}`, {patientId: 'child'});
  await deleteStaffAccount({userId: 'doctor'}, admin, state.ops);
  assert.ok(state.events.filter(event => event.startsWith('batch:')).every(event => Number(event.slice(6)) <= 400));
  assert.ok(state.events.includes('batch:2'));
  assert.equal([...state.docs.keys()].filter(key => key.startsWith('clinicalRecords/')).length, 0);
});

test('pending invitation without an Auth account removes no Auth identity', async () => {
  const state = fakeServices();
  state.docs.set('users/doctor', {role: 'doctor', pending: true, email: 'invitation@example.invalid'});
  state.accounts.clear();
  await deleteStaffAccount({userId: 'doctor'}, admin, state.ops);
  assert.ok(!state.docs.has('users/doctor'));
  assert.deepEqual(state.events.filter(event => event.includes('Auth:') || event.startsWith('disable:') || event.startsWith('revoke:')), []);
});

test('pending invitation with an unbound existing account fails closed', async () => {
  const state = fakeServices();
  state.docs.set('users/doctor', {role: 'doctor', pending: true, email: 'invitation@example.invalid'});
  state.auth.getUserByEmail = async () => ({uid: 'unbound'});
  await assert.rejects(deleteStaffAccount({userId: 'doctor'}, admin, state.ops), {code: 'failed-precondition'});
  assert.ok(!state.docs.has('staffDeletionJobs/doctor'));
  assert.ok(state.docs.has('users/doctor'));
});

function addAssistant(state, id, owner = 'doctor') {
  const uid = `auth-${id}`;
  state.docs.set(`users/${id}`, {role: 'assistant', createdBy: owner, firebaseUid: uid, email: `${id}@example.invalid`});
  state.docs.set(`securityPrincipals/${uid}`, {role: 'assistant', doctorId: owner, userId: id, authUid: uid, active: true});
  state.accounts.set(uid, {uid});
}

test('Doctor cascade blocks every associated access before deleting any resources', async () => {
  const state = fakeServices();
  addAssistant(state, 'a1');
  addAssistant(state, 'a2');
  addAssistant(state, 'foreign', 'other');
  state.docs.set('users/admin2', {role: 'admin', createdBy: 'doctor'});
  state.docs.set('patients/child', {doctorId: 'doctor'});
  state.docs.set('clinicalRecords/record', {patientId: 'child'});
  state.files.add('logos/a1/logo.png');
  const getFiles = state.bucket.getFiles;
  state.bucket.getFiles = async options => {
    for (const uid of ['auth-doctor', 'auth-a1', 'auth-a2']) {
      assert.ok(!state.accounts.has(uid) || state.accounts.get(uid).disabled);
      assert.equal(state.docs.get(`securityPrincipals/${uid}`).active, false);
    }
    return getFiles(options);
  };
  await deleteStaffAccount({userId: 'doctor'}, admin, state.ops);
  for (const id of ['a1', 'a2']) {
    assert.ok(!state.docs.has(`users/${id}`));
    assert.ok(!state.accounts.has(`auth-${id}`));
    assert.equal(state.docs.get(`staffDeletionJobs/${id}`).parentUserId, 'doctor');
    assert.equal(state.docs.get(`staffDeletionJobs/${id}`).completed, true);
  }
  assert.ok(state.accounts.has('auth-foreign'));
  assert.ok(state.docs.has('users/foreign'));
  assert.ok(state.docs.has('users/admin2'));
});

test('invalid assistant identity aborts preparation before blocking or deleting the Doctor', async () => {
  const state = fakeServices();
  addAssistant(state, 'a1');
  addAssistant(state, 'invalid');
  state.docs.get('securityPrincipals/auth-invalid').doctorId = 'other';
  state.docs.set('patients/child', {doctorId: 'doctor'});
  await assert.rejects(deleteStaffAccount({userId: 'doctor'}, admin, state.ops), {code: 'failed-precondition'});
  assert.ok(!state.accounts.get('auth-doctor').disabled);
  assert.ok(!state.accounts.get('auth-a1').disabled);
  assert.ok(state.docs.has('patients/child'));
  assert.equal(state.docs.get('staffDeletionJobs/a1').leaseUntil, 0);
  assert.equal(state.docs.get('staffDeletionJobs/doctor').leaseUntil, 0);
});

test('child Auth failure retains parent/profile bindings and can be resumed', async () => {
  const state = fakeServices();
  addAssistant(state, 'a1');
  addAssistant(state, 'a2');
  const remove = state.auth.deleteUser;
  let fail = true;
  state.auth.deleteUser = async uid => {
    if (uid === 'auth-a1' && fail) { fail = false; throw new Error('synthetic child Auth failure'); }
    return remove(uid);
  };
  await assert.rejects(deleteStaffAccount({userId: 'doctor'}, admin, state.ops), /child Auth failure/);
  assert.ok(state.docs.has('users/doctor'));
  assert.ok(state.docs.has('users/a1'));
  assert.equal(state.docs.get('staffDeletionJobs/a1').leaseUntil, 0);
  assert.equal(state.docs.get('staffDeletionJobs/a2').leaseUntil, 0);
  assert.equal(state.accounts.get('auth-a2').disabled, true);
  // Real retry uses a new adapter instance; persistent child jobs supply bindings.
  const retry = createDeletionOperations(state.db, state.auth, 'retry-lease', () => state.bucket);
  await deleteStaffAccount({userId: 'doctor'}, admin, retry);
  assert.ok(!state.docs.has('users/a1'));
  assert.ok(!state.docs.has('users/a2'));
  assert.ok(!state.docs.has('users/doctor'));
});

test('completed assistants are not deleted again after parent Storage failure', async () => {
  const state = fakeServices();
  addAssistant(state, 'a1');
  state.files.add('logos/doctor/logo.png');
  state.bucket.failFile = 'logos/doctor/logo.png';
  await assert.rejects(deleteStaffAccount({userId: 'doctor'}, admin, state.ops), /Storage failure/);
  assert.equal(state.docs.get('staffDeletionJobs/a1').completed, true);
  assert.ok(state.docs.has('users/doctor'));
  const count = state.events.filter(event => event === 'deleteAuth:auth-a1').length;
  const retry = createDeletionOperations(state.db, state.auth, 'retry-lease', () => state.bucket);
  await deleteStaffAccount({userId: 'doctor'}, admin, retry);
  assert.equal(state.events.filter(event => event === 'deleteAuth:auth-a1').length, count);
  assert.ok(!state.docs.has('users/doctor'));
});

test('independent child deletion prevents a concurrent Doctor cascade until retry', async () => {
  const state = fakeServices();
  addAssistant(state, 'a1');
  const child = createDeletionOperations(state.db, state.auth, 'child-lease', () => state.bucket);
  const target = await child.resolveTarget('a1');
  await child.acquire(target);
  await assert.rejects(deleteStaffAccount({userId: 'doctor'}, admin, state.ops), {code: 'aborted'});
  assert.ok(!state.accounts.get('auth-doctor').disabled);
  assert.equal(state.docs.get('staffDeletionJobs/a1').lease, 'child-lease');
  assert.ok(state.docs.get('staffDeletionJobs/a1').leaseUntil > Date.now());
});

test('independent child operation cannot enter an active Doctor deletion', async () => {
  const state = fakeServices();
  addAssistant(state, 'a1');
  await state.ops.acquire(doctorTarget);
  const child = createDeletionOperations(state.db, state.auth, 'child-lease', () => state.bucket);
  const target = await child.resolveTarget('a1');
  await assert.rejects(child.acquire(target), {code: 'aborted'});
  assert.ok(!state.docs.has('staffDeletionJobs/a1'));
});

test('notification cleanup removes owned inboxes and deleted appointment copies only', async () => {
  const state = fakeServices();
  addAssistant(state, 'a1');
  state.docs.set('patients/child', {doctorId: 'doctor'});
  state.docs.set('appointments/own', {doctorId: 'doctor', patientId: 'child'});
  state.docs.set('appointments/foreign', {doctorId: 'other', patientId: 'sibling'});
  for (const [id, recipientId, appointmentId] of [
    ['doctor', 'doctor', 'own'], ['assistant', 'a1', 'own'], ['child', 'child', 'own'],
    ['family-copy', 'sibling', 'own'], ['own-inbox', 'child', 'foreign'],
    ['foreign', 'sibling', 'foreign'],
  ]) state.docs.set(`notifications/${id}`, {recipientId, appointmentId});
  state.docs.set('auditLog/event', {entityId: 'doctor'});
  state.docs.set('emailCounter/daily', {count: 1});
  await deleteStaffAccount({userId: 'doctor'}, admin, state.ops);
  for (const id of ['doctor', 'assistant', 'child', 'family-copy', 'own-inbox']) assert.ok(!state.docs.has(`notifications/${id}`));
  assert.ok(state.docs.has('notifications/foreign'));
  assert.ok(state.docs.has('appointments/foreign'));
  assert.ok(state.docs.has('auditLog/event'));
  assert.ok(state.docs.has('emailCounter/daily'));
});

test('deleting an Assistant preserves other recipient copies for the Doctor appointment', async () => {
  const state = fakeServices(assistantTarget);
  state.docs.set('appointments/own', {doctorId: 'doctor', patientId: 'child'});
  state.docs.set('notifications/assistant', {recipientId: 'assistant', appointmentId: 'own', originatorId: 'assistant'});
  state.docs.set('notifications/doctor', {recipientId: 'doctor', appointmentId: 'own', originatorId: 'assistant'});
  await deleteStaffAccount({userId: 'assistant'}, doctor, state.ops);
  assert.ok(!state.docs.has('notifications/assistant'));
  assert.ok(state.docs.has('notifications/doctor'));
  assert.ok(state.docs.has('appointments/own'));
});

test('notifications disappear before appointments, and failure preserves the lookup for retry', async () => {
  const state = fakeServices();
  state.docs.set('appointments/own', {doctorId: 'doctor'});
  state.docs.set('notifications/copy', {appointmentId: 'own', recipientId: 'family'});
  state.db.failNextBatch = true;
  await assert.rejects(deleteStaffAccount({userId: 'doctor'}, admin, state.ops), /batch failure/);
  assert.ok(state.docs.has('appointments/own'));
  assert.ok(state.docs.has('notifications/copy'));
  const retry = createDeletionOperations(state.db, state.auth, 'retry-lease', () => state.bucket);
  await deleteStaffAccount({userId: 'doctor'}, admin, retry);
  assert.ok(!state.docs.has('appointments/own'));
  assert.ok(!state.docs.has('notifications/copy'));
});

test('logo cleanup covers canceled replacements without following a foreign logoPath', async () => {
  const state = fakeServices();
  state.docs.get('users/doctor').logoPath = 'logos/other/foreign.png';
  state.docs.get('users/doctor').printSettings = {logoUrl: 'https://example.invalid/foreign'};
  state.docs.get('users/doctor').timeSegmentsByDay = {Lun: []};
  for (const path of ['logos/doctor/logo.png', 'logos/doctor/replaced.png', 'logos/doctor2/logo.png', 'logos/other/foreign.png', 'logos/shared.png', 'images/Logo.jpg']) state.files.add(path);
  await deleteStaffAccount({userId: 'doctor'}, admin, state.ops);
  assert.ok(!state.files.has('logos/doctor/logo.png'));
  assert.ok(!state.files.has('logos/doctor/replaced.png'));
  for (const path of ['logos/doctor2/logo.png', 'logos/other/foreign.png', 'logos/shared.png', 'images/Logo.jpg']) assert.ok(state.files.has(path));
  assert.ok(!state.docs.has('users/doctor'));
});

test('Storage cleanup uses bounded pages and surfaces failure before deleting profile/Auth', async () => {
  const state = fakeServices();
  for (let i = 0; i < 103; i++) state.files.add(`logos/doctor/logo-${i}.png`);
  state.bucket.failFile = 'logos/doctor/logo-0.png';
  await assert.rejects(deleteStaffAccount({userId: 'doctor'}, admin, state.ops), /Storage failure/);
  assert.ok(state.docs.has('users/doctor'));
  assert.ok(state.accounts.has('auth-doctor'));
  assert.equal(state.accounts.get('auth-doctor').disabled, true);
  assert.equal(state.docs.get('staffDeletionJobs/doctor').leaseUntil, 0);
  const retry = createDeletionOperations(state.db, state.auth, 'retry-lease', () => state.bucket);
  await deleteStaffAccount({userId: 'doctor'}, admin, retry);
  assert.equal(state.files.size, 0);
});

test('an unexpected foreign object from a Storage listing is never deleted', async () => {
  const state = fakeServices();
  let deleted = false;
  state.bucket.getFiles = async () => [[{name: 'logos/other/logo.png', delete: async () => { deleted = true; }}]];
  await assert.rejects(deleteStaffAccount({userId: 'doctor'}, admin, state.ops), {code: 'failed-precondition'});
  assert.equal(deleted, false);
  assert.ok(state.docs.has('users/doctor'));
});

for (const [name, change, expected] of [
  ['missing authentication', state => { state.request.auth = undefined; }, 'unauthenticated'],
  ['revoked token', state => { state.verifyError = 'auth/id-token-revoked'; }, 'unauthenticated'],
  ['disabled caller', state => { state.verifyError = 'auth/user-disabled'; }, 'unauthenticated'],
  ['token UID mismatch', state => { state.verifiedUid = 'other'; }, 'unauthenticated'],
  ['absent trusted principal', state => { state.docs.delete('securityPrincipals/auth-admin'); }, 'permission-denied'],
  ['principal Auth binding mismatch', state => { state.docs.get('securityPrincipals/auth-admin').authUid = 'other'; }, 'permission-denied'],
  ['inactive trusted caller', state => { state.docs.get('securityPrincipals/auth-admin').active = false; }, 'permission-denied'],
  ['staff role mismatch', state => { state.docs.get('users/admin').role = 'doctor'; }, 'permission-denied'],
  ['incomplete profile', state => { state.docs.get('users/admin').profileComplete = false; }, 'permission-denied'],
  ['verified request still rejects client role', () => {}, 'invalid-argument'],
]) {
  test(`callable rejects ${name} without business writes`, async t => {
    const {initializeApp, deleteApp} = functionsRequire('firebase-admin/app');
    const {getAuth} = functionsRequire('firebase-admin/auth');
    const {getFirestore} = functionsRequire('firebase-admin/firestore');
    // Demo initialization plus mocked methods: no credentials, network or real data.
    const app = initializeApp({projectId: 'demo-lilcare-p04'});
    const auth = getAuth(app);
    const db = getFirestore(app);
    const state = fakeServices();
    state.docs.set('securityPrincipals/auth-admin', {...admin});
    state.docs.set('users/admin', {uid: 'admin', firebaseUid: 'auth-admin', role: 'admin', pending: false, profileComplete: true});
    const {Timestamp} = functionsRequire('firebase-admin/firestore');
    state.docs.set('clinicSessions/callable-admin', {authUid: 'auth-admin', role: 'admin', active: true, expiresAt: Timestamp.fromMillis(Date.now() + 3600000)});
    state.verifiedUid = 'auth-admin';
    state.request = {data: {userId: 'doctor', role: 'admin'}, auth: {uid: 'auth-admin'}, rawRequest: {headers: {authorization: 'Bearer synthetic-test-token'}}};
    t.mock.method(auth, 'verifyIdToken', async (_token, checkRevoked) => {
      assert.equal(checkRevoked, true);
      if (state.verifyError) throw {code: state.verifyError};
      return {uid: state.verifiedUid, clinicSessionId: 'callable-admin'};
    });
    t.mock.method(db, 'doc', path => state.db.doc(path));
    t.mock.method(db, 'runTransaction', fn => state.db.runTransaction(fn));
    process.env.STAFF_DELETION_ENABLED = 'true';
    t.after(async () => { delete process.env.STAFF_DELETION_ENABLED; await deleteApp(app); });
    change(state);
    await assert.rejects(deleteStaff.run(state.request), {code: expected});
    assert.equal(state.events.length, 0);
    assert.ok(!state.docs.has('staffDeletionJobs/doctor'));
  });
}
