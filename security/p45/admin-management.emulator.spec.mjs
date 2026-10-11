import {after, before, beforeEach, test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';

const PROJECT = 'demo-lilcare-p01';
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8187' ||
    (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== PROJECT)) {
  throw new Error('P45 tests require only the isolated demo project and local emulator on 127.0.0.1:8187.');
}
const functionsRequire = createRequire(new URL('../../functions/package.json', import.meta.url));
const rulesRequire = createRequire(new URL('../p01/package.json', import.meta.url));
const {initializeApp, deleteApp} = functionsRequire('firebase-admin/app');
const {getFirestore} = functionsRequire('firebase-admin/firestore');
const {initializeTestEnvironment} = rulesRequire('@firebase/rules-unit-testing');
const {createDeletionOperations} = functionsRequire('./lib/staff-deletion.js');
const {deleteStaffAccount} = functionsRequire('./lib/staff-deletion-policy.js');
let env, app, db, accounts;
const admin = id => ({authUid:'auth-'+id, userId:id, role:'admin', active:true});
const a = admin('admin-a'), b = admin('admin-b');

before(async () => {
  env = await initializeTestEnvironment({projectId:PROJECT, firestore:{host:'127.0.0.1',port:8187,
    rules:readFileSync(new URL('../p01/firestore.prototype.rules',import.meta.url),'utf8')}});
  app = initializeApp({projectId:PROJECT},'p45-isolated-emulator');
  db = getFirestore(app);
});
beforeEach(async () => {
  await env.clearFirestore();
  accounts = new Map();
  for (const actor of [a,b]) {
    await db.doc('securityPrincipals/'+actor.authUid).set(actor);
    await db.doc('users/'+actor.userId).set({uid:actor.userId,firebaseUid:actor.authUid,
      role:'admin',name:'Operador sintético',email:actor.userId+'@example.test',pending:false,profileComplete:true});
    accounts.set(actor.authUid,{uid:actor.authUid,disabled:false});
  }
});
after(async () => {
  await db?.terminate();
  if(app) await deleteApp(app);
  await env?.cleanup();
});
const missing = () => Object.assign(new Error('Synthetic missing account'),{code:'auth/user-not-found'});
const auth = {
  getUser:async uid => {if(!accounts.has(uid)) throw missing();return {...accounts.get(uid)};},
  getUserByEmail:async () => {throw missing();},
  updateUser:async (uid,fields) => {if(!accounts.has(uid)) throw missing();Object.assign(accounts.get(uid),fields);},
  revokeRefreshTokens:async () => {},
  deleteUser:async uid => {if(!accounts.delete(uid)) throw missing();},
};
const operations = actor => createDeletionOperations(db,auth,'lease-'+actor.userId,
  () => {throw new Error('Admin deletion must not touch Storage.');},undefined,actor);

test('real Firestore concurrent mutual deletions preserve one operational Admin (P45)',async () => {
  const opsA = operations(a), opsB = operations(b);
  // Both start with valid targets. The real acquire transactions arbitrate the race.
  const [targetB,targetA] = await Promise.all([opsA.resolveTarget(b.userId),opsB.resolveTarget(a.userId)]);
  const results = await Promise.allSettled([
    deleteStaffAccount({userId:b.userId},a,{...opsA,resolveTarget:async()=>targetB}),
    deleteStaffAccount({userId:a.userId},b,{...opsB,resolveTarget:async()=>targetA}),
  ]);
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
  const rejected = results.find(result=>result.status==='rejected');
  assert.ok(['permission-denied','failed-precondition'].includes(rejected.reason.code));
  const profiles = await db.collection('users').where('role','==','admin').get();
  assert.equal(profiles.size,1);
  const remaining = profiles.docs[0].data();
  assert.equal((await db.doc('securityPrincipals/'+remaining.firebaseUid).get()).data().active,true);
  assert.equal(accounts.get(remaining.firebaseUid)?.disabled,false);
  assert.equal((await db.doc('staffAdminControl/roster').get()).data().revision,1);
});

test('pending and revoked Admins cannot satisfy the last operational Admin check (P45)',async () => {
  await db.doc('securityPrincipals/'+a.authUid).update({active:false});
  await db.doc('users/pending-admin').set({uid:'pending-admin',role:'admin',pending:true,profileComplete:false});
  // Trusted caller metadata alone does not suffice: authority is re-read in Firestore.
  await assert.rejects(operations(a).acquire(await operations(a).resolveTarget(b.userId)),{code:'permission-denied'});
  assert.equal((await db.doc('staffDeletionJobs/'+b.userId).get()).exists,false);
  assert.equal(accounts.get(b.authUid).disabled,false);
});

test('a failed cleanup can be retried without affecting the surviving Admin (P45)',async () => {
  const ops = operations(a);
  await assert.rejects(deleteStaffAccount({userId:b.userId},a,{...ops,
    deleteBusinessData:async()=>{throw new Error('Synthetic cleanup failure');}}),/Synthetic cleanup failure/);
  assert.equal((await db.doc('staffDeletionJobs/'+b.userId).get()).data().leaseUntil,0);
  assert.equal((await db.doc('securityPrincipals/'+b.authUid).get()).data().active,false);
  assert.deepEqual(await deleteStaffAccount({userId:b.userId},a,operations(a)),{deleted:true});
  assert.equal((await db.doc('users/'+b.userId).get()).exists,false);
  assert.equal(accounts.has(b.authUid),false);
  assert.equal((await db.doc('securityPrincipals/'+a.authUid).get()).data().active,true);
});
