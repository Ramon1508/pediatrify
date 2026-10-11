import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, where, orderBy, limit, setDoc, updateDoc, deleteDoc,
  deleteField, Timestamp } from 'firebase/firestore';

const PROJECT = 'demo-lilcare-p01';
if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== PROJECT) throw new Error('Tests require the isolated demo project.');
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8187') throw new Error('Tests require the local emulator on 127.0.0.1:8187.');
let env;
const sourceTime = Timestamp.fromMillis(1700000000000);
const doctor = (uid) => ({ uid, firebaseUid: `auth-${uid}`, role: 'doctor', pending: false, profileComplete: true });
const principal = (authUid, role, userId, doctorId) => ({ authUid, active: true, role, userId, doctorId });
const child = (id, doctorId, email, secondaryEmail = '') => ({ id, doctorId, email, secondaryEmail,
  name: 'Synthetic child', lastName: 'Synthetic surname', birthDate: '2020-01-01',
  otpPassword: randomBytes(24).toString('hex'), diagnosis: 'Synthetic private field' });
const notice = (id, recipientId, recipientType, doctorId = 'd1') => ({ id, recipientId, recipientType,
  doctorId, type: 'appointment-created', title: 'Synthetic appointment', description: 'Synthetic event',
  originatorId: 'd1', originatorName: 'Synthetic doctor', createdAt: sourceTime, read: false, appointmentId: 'apt1' });

before(async () => {
  env = await initializeTestEnvironment({ projectId: PROJECT,
    firestore: { host: '127.0.0.1', port: 8187, rules: fs.readFileSync(new URL('./firestore.prototype.rules', import.meta.url), 'utf8') } });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const data = {
      'securityPrincipals/auth-d1': principal('auth-d1', 'doctor', 'd1', 'd1'),
      'securityPrincipals/auth-d2': principal('auth-d2', 'doctor', 'd2', 'd2'),
      'securityPrincipals/auth-a1': principal('auth-a1', 'assistant', 'a1', 'd1'),
      'securityPrincipals/auth-a2': principal('auth-a2', 'assistant', 'a2', 'd2'),
      'securityPrincipals/auth-admin': principal('auth-admin', 'admin', 'admin1', ''),
      'securityPrincipals/auth-family': { authUid: 'auth-family', role: 'patient', active: true,
        doctorId: 'd1', patientId: 'p1', loginEmail: 'family@example.test', sessionVersion: 1 },
      'users/d1': doctor('d1'), 'users/d2': doctor('d2'),
      'users/a1': { uid: 'a1', firebaseUid: 'auth-a1', role: 'assistant', createdBy: 'd1', profileComplete: true },
      'users/a2': { uid: 'a2', firebaseUid: 'auth-a2', role: 'assistant', createdBy: 'd2', profileComplete: true },
      'users/admin1': { uid: 'admin1', firebaseUid: 'auth-admin', role: 'admin', profileComplete: true },
      'staffDirectory/d1': { id: 'd1', role: 'doctor', name: 'Synthetic doctor', email: 'doctor@example.test' },
      'staffDirectory/d2': { id: 'd2', role: 'doctor', name: 'Synthetic doctor two', email: 'doctor2@example.test' },
      'staffDirectory/a1': { id: 'a1', role: 'assistant', createdBy: 'd1', name: 'Synthetic assistant' },
      'staffDirectory/a2': { id: 'a2', role: 'assistant', createdBy: 'd2', name: 'Synthetic assistant two' },
      'patients/p1': child('p1', 'd1', 'family@example.test'),
      'patients/p2': child('p2', 'd1', 'other@example.test', 'family@example.test'),
      'patients/p3': child('p3', 'd1', 'foreign@example.test'),
      'patients/p4': child('p4', 'd2', 'family@example.test'),
      'patientDirectory/p1': { id: 'p1', doctorId: 'd1', name: 'Synthetic child' },
      'patientDirectory/p4': { id: 'p4', doctorId: 'd2', name: 'Synthetic child two' },
      'patientPortal/p1': { id: 'p1', doctorId: 'd1', name: 'Synthetic child', birthDate: '2020-01-01' },
      'patientPortal/p2': { id: 'p2', doctorId: 'd1', name: 'Synthetic sibling', birthDate: '2020-01-01' },
      'patientPortal/p3': { id: 'p3', doctorId: 'd1', name: 'Synthetic unrelated child' },
      'patientPortal/p4': { id: 'p4', doctorId: 'd2', name: 'Synthetic other-doctor child' },
      'familyAccess/auth-family/patients/p1': { enabled: true },
      'familyAccess/auth-family/patients/p2': { enabled: true },
      'schedules/d1': { consultationDuration: 30, allowPatientScheduling: true, timeSegmentsByDay: { Lun: [{ startTime: '09:00', endTime: '12:00' }] } },
      'schedules/d2': { consultationDuration: 30, allowPatientScheduling: true },
      'appointmentSlots/d1/days/2030-01-01': { occupiedTimes: ['10:00'] },
      'appointmentSlots/d2/days/2030-01-01': { occupiedTimes: ['11:00'] },
      'appointments/apt1': { id: 'apt1', doctorId: 'd1', patientId: 'p1', date: '2030-01-01', time: '10:00', status: 'scheduled' },
      'appointments/apt2': { id: 'apt2', doctorId: 'd1', patientId: 'p3', date: '2030-01-01', time: '11:00', status: 'scheduled' },
      'appointments/apt3': { id: 'apt3', doctorId: 'd2', patientId: 'p4', date: '2030-01-01', time: '12:00', status: 'scheduled' },
      'clinicalRecords/r1': { id: 'r1', patientId: 'p1', diagnosis: 'Synthetic private content', updatedAt: sourceTime },
      'clinicalRecords/r2': { id: 'r2', patientId: 'p4', diagnosis: 'Synthetic private content', updatedAt: sourceTime },
      'patientDocuments/pub1': { id: 'pub1', patientId: 'p1', doctorId: 'd1', recordId: 'r1', kind: 'prescription',
        content: 'Synthetic published document', expiresAt: Timestamp.fromMillis(Date.now() + 86400000), sourceUpdatedAt: sourceTime },
      'notifications/nd1': notice('nd1', 'd1', 'doctor'),
      'notifications/nd2': notice('nd2', 'd2', 'doctor', 'd2'),
      'notifications/na1': notice('na1', 'a1', 'assistant'),
      'notifications/np1': notice('np1', 'p1', 'patient'),
      'notifications/np2': notice('np2', 'p2', 'patient'),
      'notifications/np3': notice('np3', 'p3', 'patient'),
      'notifications/np4': notice('np4', 'p4', 'patient', 'd2'),
      'auditLog/log1': { action: 'create' },
      'emailCounter/daily': { count: 1 },
      'patientCredentials/p1': { verifier: { hash: 'synthetic opaque hash' } },
      'invitations/i1': { role: 'doctor' },
    };
    await Promise.all(Object.entries(data).map(([key, value]) => setDoc(doc(db, key), value)));
  });
});

function db(uid, claims = {}) { return env.authenticatedContext(uid, uid === 'auth-family' ? { patientSessionVersion: 1, ...claims } : claims).firestore(); }
function get(uid, path, claims) { return getDoc(doc(db(uid, claims), path)); }
async function trustedUpdate(path, values) { await env.withSecurityRulesDisabled((context) => updateDoc(doc(context.firestore(), path), values)); }
async function trustedDelete(path) { await env.withSecurityRulesDisabled((context) => deleteDoc(doc(context.firestore(), path))); }

test('P45: Admin alone reads administrator directory; clients cannot mutate roles or the deletion roster', async () => {
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(),'staffDirectory/admin1'),{id:'admin1',role:'admin',name:'Admin sintético',email:'admin@example.test'});
    await setDoc(doc(context.firestore(),'staffAdminControl/roster'),{revision:0});
  });
  await assertSucceeds(get('auth-admin','staffDirectory/admin1'));
  await assertSucceeds(getDocs(query(collection(db('auth-admin'),'staffDirectory'),where('role','==','admin'))));
  for(const uid of ['auth-d1','auth-a1','auth-family']) await assertFails(get(uid,'staffDirectory/admin1'));
  for(const uid of ['auth-admin','auth-d1','auth-a1','auth-family']) {
    await assertFails(setDoc(doc(db(uid),'staffDirectory/forged'),{id:'forged',role:'admin'}));
    await assertFails(updateDoc(doc(db(uid),'users/admin1'),{role:'doctor'}));
    await assertFails(updateDoc(doc(db(uid),'staffAdminControl/roster'),{revision:99}));
    await assertFails(get(uid,'staffAdminControl/roster'));
  }
});

test('unauthenticated reads and collection scans are denied everywhere', async () => {
  const anonymous = env.unauthenticatedContext().firestore();
  for (const path of ['patients/p1', 'users/d1', 'patientDirectory/p1', 'patientPortal/p1', 'appointments/apt1', 'clinicalRecords/r1', 'patientDocuments/pub1', 'notifications/nd1', 'schedules/d1']) {
    await assertFails(getDoc(doc(anonymous, path)));
  }
  await assertFails(getDocs(collection(anonymous, 'patients')));
});
test('unprovisioned and forged role claims do not grant authority', async () => {
  await assertFails(get('unprovisioned', 'patients/p1', { role: 'doctor', doctorId: 'd1' }));
  await assertFails(get('auth-d1', 'patients/p4', { role: 'admin', doctorId: 'd2' }));
});
test('staff can read their own private profile via legacy ID, but no other profile', async () => {
  for (const [uid, id] of [['auth-d1', 'd1'], ['auth-a1', 'a1'], ['auth-admin', 'admin1']]) await assertSucceeds(get(uid, `users/${id}`));
  await assertFails(get('auth-a1', 'users/d1'));
  await assertFails(get('auth-admin', 'users/d1'));
  await assertFails(get('auth-family', 'users/d1'));
});
test('admin manages only the doctor directory and doctor manages own assistants', async () => {
  await assertSucceeds(getDocs(query(collection(db('auth-admin'), 'staffDirectory'), where('role', '==', 'doctor'))));
  await assertFails(get('auth-admin', 'staffDirectory/a1'));
  await assertSucceeds(getDocs(query(collection(db('auth-d1'), 'staffDirectory'), where('role', '==', 'assistant'), where('createdBy', '==', 'd1'))));
  await assertFails(get('auth-d1', 'staffDirectory/a2'));
  await assertFails(get('auth-a1', 'staffDirectory/a1'));
});
test('doctor reads only own patients; global scans and other ownership are denied', async () => {
  await assertSucceeds(get('auth-d1', 'patients/p1'));
  await assertSucceeds(getDocs(query(collection(db('auth-d1'), 'patients'), where('doctorId', '==', 'd1'))));
  await assertFails(get('auth-d1', 'patients/p4'));
  await assertFails(getDocs(collection(db('auth-d1'), 'patients')));
  await assertFails(get('auth-admin', 'patients/p1'));
});
test('assistant reads the scoped basic directory but never private patient or clinical data', async () => {
  await assertSucceeds(getDocs(query(collection(db('auth-a1'), 'patientDirectory'), where('doctorId', '==', 'd1'))));
  await assertFails(get('auth-a1', 'patientDirectory/p4'));
  await assertFails(get('auth-a1', 'patients/p1'));
  await assertFails(get('auth-a1', 'clinicalRecords/r1'));
  await assertFails(get('auth-a1', 'patientDocuments/pub1'));
});
test('family sees both authorized child summaries including secondary email, without private records', async () => {
  await assertSucceeds(get('auth-family', 'patientPortal/p1'));
  await assertSucceeds(get('auth-family', 'patientPortal/p2'));
  await assertFails(get('auth-family', 'patientPortal/p3'));
  await assertFails(get('auth-family', 'patientPortal/p4'));
  await assertFails(get('auth-family', 'patients/p1'));
  await assertFails(get('auth-family', 'clinicalRecords/r1'));
});
test('removed family email revokes access even when an old membership survives', async () => {
  await trustedUpdate('patients/p2', { secondaryEmail: '' });
  await assertFails(get('auth-family', 'patientPortal/p2'));
});
test('email coincidence across doctors does not grant family access', async () => {
  await env.withSecurityRulesDisabled((context) => setDoc(doc(context.firestore(), 'familyAccess/auth-family/patients/p4'), { enabled: true }));
  await assertFails(get('auth-family', 'patientPortal/p4'));
});
test('family appointment queries must identify their child and doctor', async () => {
  await assertSucceeds(getDocs(query(collection(db('auth-family'), 'appointments'), where('patientId', '==', 'p1'), where('doctorId', '==', 'd1'))));
  await assertFails(getDocs(query(collection(db('auth-family'), 'appointments'), where('doctorId', '==', 'd1'))));
  await assertFails(get('auth-family', 'appointments/apt2'));
  await assertFails(get('auth-family', 'appointments/apt3'));
});
test('doctor and assistant query the owner calendar but no cross-doctor calendar', async () => {
  for (const uid of ['auth-d1', 'auth-a1']) {
    await assertSucceeds(getDocs(query(collection(db(uid), 'appointments'), where('doctorId', '==', 'd1'))));
    await assertFails(get(uid, 'appointments/apt3'));
  }
  await assertFails(get('auth-admin', 'appointments/apt1'));
});
test('schedules and anonymized occupancy are restricted to the team or associated family', async () => {
  for (const uid of ['auth-d1', 'auth-a1', 'auth-family']) {
    await assertSucceeds(get(uid, 'schedules/d1'));
    const snapshot = await assertSucceeds(get(uid, 'appointmentSlots/d1/days/2030-01-01'));
    assert.deepEqual(Object.keys(snapshot.data()), ['occupiedTimes']);
    await assertFails(get(uid, 'schedules/d2'));
    await assertFails(get(uid, 'appointmentSlots/d2/days/2030-01-01'));
  }
});
test('doctor clinical query by owned patient succeeds but other patients are denied', async () => {
  await assertSucceeds(getDocs(query(collection(db('auth-d1'), 'clinicalRecords'), where('patientId', '==', 'p1'))));
  await assertFails(get('auth-d1', 'clinicalRecords/r2'));
  await assertFails(getDocs(collection(db('auth-d1'), 'clinicalRecords')));
});
test('family reads only current, unexpired published documents with an existing matching source', async () => {
  await assertSucceeds(get('auth-family', 'patientDocuments/pub1'));
  await trustedUpdate('patientDocuments/pub1', { expiresAt: Timestamp.fromMillis(Date.now() - 60000) });
  await assertFails(get('auth-family', 'patientDocuments/pub1'));
});
test('string expiration cannot bypass published document limits', async () => {
  await trustedUpdate('patientDocuments/pub1', { expiresAt: '2099-01-01' });
  await assertFails(get('auth-family', 'patientDocuments/pub1'));
});
test('changing a clinical source immediately invalidates its old publication', async () => {
  await trustedUpdate('clinicalRecords/r1', { updatedAt: Timestamp.fromMillis(sourceTime.toMillis() + 1) });
  await assertFails(get('auth-family', 'patientDocuments/pub1'));
});
test('deleting a clinical source denies old print/document links', async () => {
  await trustedDelete('clinicalRecords/r1');
  await assertFails(get('auth-family', 'patientDocuments/pub1'));
});
test('a publication cannot reference a different child clinical record', async () => {
  await trustedUpdate('patientDocuments/pub1', { recordId: 'r2' });
  await assertFails(get('auth-family', 'patientDocuments/pub1'));
});
test('recipient query succeeds; other recipients and doctors remain hidden', async () => {
  await assertSucceeds(getDocs(query(collection(db('auth-a1'), 'notifications'), where('recipientId', '==', 'a1'), where('doctorId', '==', 'd1'))));
  await assertSucceeds(get('auth-family', 'notifications/np1'));
  await assertSucceeds(get('auth-family', 'notifications/np2'));
  await assertFails(get('auth-family', 'notifications/np3'));
  await assertFails(get('auth-family', 'notifications/np4'));
  await assertFails(get('auth-a1', 'notifications/nd1'));
  await assertFails(get('auth-admin', 'notifications/nd1'));
});
test('scoped notification pagination and unread queries are allowed, legacy unscoped query is denied', async () => {
  const own = collection(db('auth-a1'), 'notifications');
  await assertSucceeds(getDocs(query(own, where('recipientId', '==', 'a1'), where('doctorId', '==', 'd1'), orderBy('createdAt', 'desc'), limit(3))));
  await assertSucceeds(getDocs(query(own, where('recipientId', '==', 'a1'), where('doctorId', '==', 'd1'), where('read', '==', false), orderBy('createdAt', 'desc'), limit(3))));
  await assertFails(getDocs(query(own, where('recipientId', '==', 'a1'), orderBy('createdAt', 'desc'), limit(3))));
});
test('legacy calendar query by updater email cannot read across owner boundaries', async () => {
  await assertFails(getDocs(query(collection(db('auth-a1'), 'appointments'), where('updatedBy', '==', 'assistant@example.test'))));
});
test('recipient can only mark its own notification read', async () => {
  const client = db('auth-a1');
  await assertSucceeds(updateDoc(doc(client, 'notifications/na1'), { read: true }));
  await assertFails(updateDoc(doc(client, 'notifications/na1'), { read: false }));
  await assertFails(updateDoc(doc(client, 'notifications/nd1'), { read: true }));
});
for (const [label, change] of [
  ['recipient hijacking', { recipientId: 'a2' }], ['owner hijacking', { doctorId: 'd2' }],
  ['actor spoofing', { originatorId: 'd2' }], ['timestamp replacement', { createdAt: Timestamp.now() }],
  ['oversized string', { title: 'x'.repeat(1000000) }], ['type corruption', { read: 1 }],
  ['required-field deletion', { recipientId: deleteField() }], ['schema pollution', { isAdmin: true }],
  ['required empty identifier', { id: '' }], ['invalid notification type', { type: 'made-up-event' }],
]) test(`notification update bypass denied: ${label}`, async () => {
  await assertFails(updateDoc(doc(db('auth-a1'), 'notifications/na1'), change));
});
test('valid-looking client notification creation is denied', async () => {
  await assertFails(setDoc(doc(db('auth-d1'), 'notifications/new'), notice('new', 'd1', 'doctor')));
});
test('clients cannot change identities, memberships, roles, or security counters', async () => {
  const client = db('auth-d1');
  for (const path of ['securityPrincipals/auth-d1', 'familyAccess/auth-d1/patients/p4', 'users/new-admin', 'emailCounter/daily', 'auditLog/new', 'patientCredentials/p1', 'invitations/new']) {
    await assertFails(setDoc(doc(client, path), { role: 'admin', doctorId: 'd2', active: true }));
  }
});
test('business writes require the trusted server policy even for the Doctor', async () => {
  for (const path of ['patients/p1', 'appointments/apt1', 'clinicalRecords/r1', 'schedules/d1']) {
    await assertFails(updateDoc(doc(db('auth-d1'), path), { updatedAt: Timestamp.now() }));
    await assertFails(deleteDoc(doc(db('auth-d1'), path)));
  }
  await assertFails(updateDoc(doc(db('auth-a1'), 'schedules/d1'), { allowPatientScheduling: false }));
});
test('inactive and mismatched principals do not grant access', async () => {
  await trustedUpdate('securityPrincipals/auth-a1', { active: false });
  await assertFails(get('auth-a1', 'appointments/apt1'));
  await trustedUpdate('securityPrincipals/auth-d1', { authUid: 'auth-d2' });
  await assertFails(get('auth-d1', 'patients/p1'));
});
test('patient session-version revocation takes effect without waiting for token expiry', async () => {
  await trustedUpdate('securityPrincipals/auth-family', { sessionVersion: 2 });
  await assertFails(get('auth-family', 'patientPortal/p1'));
  await assertSucceeds(get('auth-family', 'patientPortal/p1', { patientSessionVersion: 2 }));
});
test('deleted Doctor denies orphan Assistant and family calendar access', async () => {
  await trustedDelete('users/d1');
  await assertFails(get('auth-a1', 'appointments/apt1'));
  await assertFails(get('auth-a1', 'patientDirectory/p1'));
  await assertFails(get('auth-family', 'schedules/d1'));
});
test('removed or reassigned Assistant cannot reuse an old principal to read the former agenda', async () => {
  await trustedUpdate('users/a1', { createdBy: 'd2' });
  await assertFails(get('auth-a1', 'appointments/apt1'));
  await trustedDelete('users/a1');
  await assertFails(get('auth-a1', 'patientDirectory/p1'));
});
test('staff role or Firebase identity changes invalidate a stale authority mapping', async () => {
  await trustedUpdate('users/d1', { firebaseUid: 'auth-someone-else' });
  await assertFails(get('auth-d1', 'patients/p1'));
  await trustedUpdate('users/admin1', { role: 'assistant' });
  await assertFails(get('auth-admin', 'staffDirectory/d1'));
});
test('deleted patient denies old family projection and document access', async () => {
  await trustedDelete('patients/p1');
  await assertFails(get('auth-family', 'patientPortal/p1'));
  await assertFails(get('auth-family', 'patientDocuments/pub1'));
});
test('unknown paths and orphan subcollections default to denial', async () => {
  for (const path of ['futureCollection/item', 'users/missing/private/item', 'familyAccess/auth-family/patients/p1', 'patientCredentials/p1', 'emailCounter/daily', 'auditLog/log1']) {
    await assertFails(get('auth-d1', path));
    await assertFails(setDoc(doc(db('auth-d1'), path), { enabled: true }));
  }
});
