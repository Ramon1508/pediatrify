import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { AccessDenied, authorize, authenticateRequest, patientDirectoryProjection,
  patientPortalProjection, occupiedTimesProjection, validDate } from './policy.mjs';

const doctorUser = { uid: 'd1', role: 'doctor', profileComplete: true, pending: false };
const doctor = { authUid: 'auth-d1', active: true, role: 'doctor', userId: 'd1', doctorId: 'd1' };
const assistant = { authUid: 'auth-a1', active: true, role: 'assistant', userId: 'a1', doctorId: 'd1' };
const admin = { authUid: 'auth-admin', active: true, role: 'admin', userId: 'admin1' };
const patient = { authUid: 'auth-family', active: true, role: 'patient', doctorId: 'd1',
  loginEmail: 'family@example.test', sessionVersion: 1 };
const child = { id: 'p1', doctorId: 'd1', name: 'Synthetic child', lastName: 'Synthetic surname',
  birthDate: '2020-01-01', email: 'family@example.test', fatherName: '', motherName: '', phone: '',
  otpPassword: randomBytes(24).toString('hex'), diagnosis: 'Synthetic private field',
  vaccinationRecord: { sample: { age: { applied: false } } } };
const base = { doctor: doctorUser, patient: child, target: child, familyPatientIds: ['p1'],
  schedule: { allowPatientScheduling: true } };
const basic = { name: 'Synthetic child', lastName: 'Synthetic surname', birthDate: '2020-01-01',
  email: 'FAMILY@example.test', fatherName: '', motherName: '', phone: '' };
const appt = { id: 'apt1', doctorId: 'd1', patientId: 'p1', status: 'scheduled', disabled: false };
const denied = (action) => assert.throws(action, AccessDenied);

test('P45: only Admin requests Admin/Doctor roles; backend permits Admin/Doctor to invite Assistants', () => {
  const input = {name:'Invitado sintético',email:'invited@example.test'};
  for (const role of ['admin','doctor','assistant']) assert.equal(authorize(admin,'staff.invite',{...input,role}).role,role);
  assert.equal(authorize(doctor,'staff.invite',{...input,role:'assistant'},base).role,'assistant');
  for (const role of ['admin','doctor']) denied(()=>authorize(doctor,'staff.invite',{...input,role},base));
});

test('P45: managing another Admin requires Admin and deletion requires a remaining active Admin', () => {
  const context = {target:{uid:'admin2',role:'admin'},remainingActiveAdminCount:1};
  assert.doesNotThrow(()=>authorize(admin,'staff.update',{name:'Ejemplo'},context));
  assert.doesNotThrow(()=>authorize(admin,'staff.delete',{},context));
  denied(()=>authorize(admin,'staff.delete',{}, {...context,remainingActiveAdminCount:0}));
  denied(()=>authorize(admin,'staff.delete',{}, {...context,remainingActiveAdminCount:undefined}));
  denied(()=>authorize(admin,'staff.update',{name:'Ejemplo'}, {...context,target:{uid:admin.userId,role:'admin'}}));
  for (const principal of [doctor,assistant,patient]) {
    denied(()=>authorize(principal,'staff.update',{name:'Ejemplo'},{...base,...context}));
    denied(()=>authorize(principal,'staff.delete',{}, {...base,...context}));
  }
});

test('Doctor and Assistant create basic patients with the canonical Doctor as owner', () => {
  for (const principal of [doctor, assistant]) {
    const result = authorize(principal, 'patient.create', basic, base);
    assert.equal(result.doctorId, 'd1');
    assert.equal(result.email, 'family@example.test');
    assert.ok(!('otpPassword' in result));
  }
});
test('Admin and Patient cannot create or edit clinical patients', () => {
  for (const principal of [admin, patient]) {
    denied(() => authorize(principal, 'patient.create', basic, base));
    denied(() => authorize(principal, 'patient.update', { name: 'Synthetic' }, base));
  }
});
test('Assistant cannot edit existing patient, clinical data, or delete a patient', () => {
  for (const operation of ['patient.update', 'patient.delete', 'patient.readClinical', 'clinical.create', 'clinical.delete']) {
    denied(() => authorize(assistant, operation, {}, base));
  }
});
test('Doctor cannot read, edit, or delete another Doctor patient', () => {
  for (const operation of ['patient.update', 'patient.delete', 'patient.readClinical']) {
    denied(() => authorize(doctor, operation, {}, { ...base, target: { ...child, doctorId: 'd2' } }));
  }
});
test('unowned legacy patients receive no implicit access', () => {
  denied(() => authorize(doctor, 'patient.readClinical', {}, { ...base, target: { id: 'legacy' } }));
});
test('privilege, owner, credential, ID, and timestamp injection is rejected on create and update', () => {
  for (const field of ['role', 'doctorId', 'uid', 'otpPassword', 'createdAt', 'firebaseUid', 'active']) {
    denied(() => authorize(doctor, 'patient.create', { ...basic, [field]: 'injected' }, base));
    denied(() => authorize(doctor, 'patient.update', { [field]: 'injected' }, base));
  }
});
test('Assistant basic creation cannot smuggle clinical fields', () => {
  denied(() => authorize(assistant, 'patient.create', { ...basic, bloodType: 'synthetic' }, base));
  denied(() => authorize(assistant, 'patient.create', { ...basic, vaccinationRecord: {} }, base));
});
test('Doctor can edit bounded clinical values and every nested vaccine dose is validated', () => {
  assert.doesNotThrow(() => authorize(doctor, 'patient.update', { birthWeight: 3,
    vaccinationRecord: { synthetic: { syntheticAge: { applied: true, applicationDate: '2024-02-29', notes: 'Synthetic' } } } }, base));
  denied(() => authorize(doctor, 'patient.update', { vaccinationRecord: { synthetic: { age: { applied: 'yes' } } } }, base));
  denied(() => authorize(doctor, 'patient.update', { vaccinationRecord: { synthetic: { age: { applied: true, isAdmin: true } } } }, base));
});
test('sex values match the actual Sexo enum (1, 2, 3), including Otro', () => {
  for (const value of [1, 2, 3]) {
    assert.doesNotThrow(() => authorize(doctor, 'patient.update', { sex: value }, base));
    assert.doesNotThrow(() => authorize(doctor, 'profile.update', { sexo: value }, { ...base, target: doctorUser }));
  }
  denied(() => authorize(doctor, 'patient.update', { sex: 0 }, base));
  denied(() => authorize(doctor, 'profile.update', { sexo: 0 }, { ...base, target: doctorUser }));
});
test('Doctor and Assistant update duration and segments, but only Doctor can change patient scheduling', () => {
  const context = { ...base, target: doctorUser };
  for (const principal of [doctor, assistant]) assert.doesNotThrow(() => authorize(principal,
    'schedule.update', { consultationDuration: 45, timeSegmentsByDay: { Lun: [{ startTime: '10:00', endTime: '13:00' }], Mar: [] } }, context));
  assert.doesNotThrow(() => authorize(doctor, 'schedule.update', { allowPatientScheduling: true }, context));
  denied(() => authorize(assistant, 'schedule.update', { allowPatientScheduling: true }, context));
  denied(() => authorize(assistant, 'schedule.update', { allowPatientScheduling: false }, context));
  denied(() => authorize(assistant, 'schedule.update', {}, { ...base, target: { uid: 'd2' } }));
});
test('invalid duration, day, segment shape, and oversized arrays are denied', () => {
  const context = { ...base, target: doctorUser };
  for (const payload of [
    { consultationDuration: 0 }, { consultationDuration: '30' }, { allowPatientScheduling: 1 },
    { timeSegmentsByDay: { InvalidDay: [] } }, { timeSegmentsByDay: { Lun: [{ startTime: '25:00', endTime: '00:00' }] } },
    { timeSegmentsByDay: { Lun: [{ startTime: '13:00', endTime: '10:00' }] } },
    { timeSegmentsByDay: { Lun: [{ startTime: '10:00', endTime: '11:00', role: 'admin' }] } },
    { timeSegmentsByDay: { Lun: Array.from({ length: 13 }, () => ({ startTime: '10:00', endTime: '11:00' })) } },
  ]) denied(() => authorize(doctor, 'schedule.update', payload, context));
});
test('Admin defaults to Doctor invitations; Doctor invites only own Assistants', () => {
  const invitation = { name: 'Synthetic staff', email: 'STAFF@example.test' };
  assert.equal(authorize(admin, 'staff.invite', invitation).role, 'doctor');
  const result = authorize(doctor, 'staff.invite', invitation, base);
  assert.equal(result.role, 'assistant');
  assert.equal(result.createdBy, 'd1');
  denied(() => authorize(assistant, 'staff.invite', invitation, base));
  denied(() => authorize(patient, 'staff.invite', invitation, base));
  denied(() => authorize(doctor, 'staff.invite', { ...invitation, role: 'admin' }, base));
});
test('staff edits/deletion follow manager scope and cannot change role or creator', () => {
  const ownAssistant = { ...base, target: { uid: 'a1', role: 'assistant', createdBy: 'd1' } };
  assert.doesNotThrow(() => authorize(doctor, 'staff.update', { name: 'Synthetic assistant' }, ownAssistant));
  assert.doesNotThrow(() => authorize(doctor, 'staff.delete', {}, ownAssistant));
  denied(() => authorize(doctor, 'staff.delete', {}, { ...ownAssistant, target: { uid: 'a2', role: 'assistant', createdBy: 'd2' } }));
  denied(() => authorize(admin, 'staff.delete', {}, ownAssistant));
  assert.doesNotThrow(() => authorize(admin, 'staff.update', { email: 'new@example.test' }, { target: doctorUser }));
  for (const field of ['role', 'createdBy', 'firebaseUid', 'uid', 'doctorId']) denied(() => authorize(doctor, 'staff.update', { [field]: 'injected' }, ownAssistant));
});
test('Admin edits only own email and Assistant own name/email (revised P08)', () => {
  const context = { target: { uid: 'admin1', role: 'admin' } };
  assert.doesNotThrow(() => authorize(admin, 'profile.email.change', { email: 'new@example.test' }, context));
  for (const payload of [{ name: 'Synthetic admin' }, { email: 'new@example.test' }, {}]) {
    denied(() => authorize(admin, 'profile.update', payload, context));
  }
  denied(() => authorize(admin, 'profile.email.change', { name: 'Changed', email: 'new@example.test' }, context));
  denied(() => authorize(admin, 'profile.email.change', { email: 'new@example.test' }, { target: { uid: 'another-admin', role: 'admin' } }));
  const assistantContext = { ...base, target: { uid: 'a1', role: 'assistant', createdBy: 'd1' } };
  assert.doesNotThrow(() => authorize(assistant, 'profile.update', { name: 'Synthetic' }, assistantContext));
  assert.doesNotThrow(() => authorize(assistant, 'profile.email.change', { name: 'Synthetic', email: 'new@example.test' }, assistantContext));
  for (const payload of [{}, { name: '' }, { name: '   ' }, { name: 'x'.repeat(301) }, { name: 'Changed', phone: '999' }]) {
    denied(() => authorize(assistant, 'profile.update', payload, assistantContext));
  }
  denied(() => authorize(assistant, 'profile.update', { name: 'Changed', email: 'new@example.test' }, assistantContext));
  denied(() => authorize(assistant, 'profile.email.change', { email: 'new@example.test' }, { ...assistantContext, target: { uid: 'a1', role: 'assistant', createdBy: 'd2' } }));
});

test('only Doctor edits own professional profile and logo paths cannot cross owners', () => {
  const context = { ...base, target: doctorUser };
  assert.doesNotThrow(() => authorize(doctor, 'profile.update', { name: 'Synthetic doctor', logoPath: 'logos/d1/opaque.png' }, context));
  denied(() => authorize(doctor, 'profile.update', { logoPath: 'logos/d2/opaque.png' }, context));
  denied(() => authorize(doctor, 'profile.update', { logoPath: 'logos/d1/../d2/opaque.png' }, context));
  denied(() => authorize(doctor, 'profile.update', { role: 'admin' }, context));
  denied(() => authorize(assistant, 'profile.update', { name: 'Synthetic' }, context));
  denied(() => authorize(admin, 'profile.update', { logoPath: 'logos/admin1/opaque.png' }, { target: { uid: 'admin1', role: 'admin' } }));
});
test('staff creates and changes only own-owner appointments and patient reference cannot be swapped', () => {
  for (const principal of [doctor, assistant]) {
    assert.doesNotThrow(() => authorize(principal, 'appointment.create', { date: '2030-01-01', time: '10:00', notes: '' }, base));
    assert.doesNotThrow(() => authorize(principal, 'appointment.update', { time: '11:00' }, { ...base, target: appt }));
    assert.equal(authorize(principal, 'appointment.cancel', {}, { ...base, target: appt }).status, 'cancelled');
    denied(() => authorize(principal, 'appointment.update', { patientId: 'p2' }, { ...base, target: appt }));
    denied(() => authorize(principal, 'appointment.cancel', {}, { ...base, target: { ...appt, doctorId: 'd2' } }));
  }
});
test('Patient appointment access requires family membership AND Doctor scheduling permission', () => {
  assert.doesNotThrow(() => authorize(patient, 'appointment.create', { date: '2030-01-01', time: '10:00' }, base));
  assert.doesNotThrow(() => authorize(patient, 'appointment.cancel', {}, { ...base, target: appt }));
  for (const patch of [{ schedule: { allowPatientScheduling: false } }, { familyPatientIds: [] },
    { patient: { ...child, doctorId: 'd2' } }, { patient: { ...child, email: 'other@example.test' } }]) {
    denied(() => authorize(patient, 'appointment.create', { date: '2030-01-01', time: '10:00' }, { ...base, ...patch }));
  }
});
test('scheduling toggle does not disable staff scheduling', () => {
  for (const principal of [doctor, assistant]) assert.doesNotThrow(() => authorize(principal,
    'appointment.create', { date: '2030-01-01', time: '10:00' }, { ...base, schedule: { allowPatientScheduling: false } }));
});
test('disabled/cancelled/attended appointments cannot be resurrected by update', () => {
  for (const patch of [{ disabled: true }, { status: 'cancelled' }, { status: 'attended' }]) {
    denied(() => authorize(patient, 'appointment.update', { time: '11:00' }, { ...base, target: { ...appt, ...patch } }));
  }
});
test('dates are actual calendar dates and times use the bounded 24-hour format', () => {
  assert.equal(validDate('2024-02-29'), true);
  for (const date of ['2023-02-29', '2024-02-31', '2024-13-01', '01/01/2024']) {
    assert.equal(validDate(date), false);
    denied(() => authorize(doctor, 'appointment.create', { date, time: '10:00' }, base));
  }
  denied(() => authorize(doctor, 'appointment.create', { date: '2030-01-01', time: '24:00' }, base));
});
test('clinical create and update validate fields, immutable references, types, bounds and schema', () => {
  const context = { ...base, target: { id: 'r1', patientId: 'p1', date: '2030-01-01', motivoConsulta: 'Synthetic' } };
  assert.doesNotThrow(() => authorize(doctor, 'clinical.create', { date: '2030-01-01', motivoConsulta: 'Synthetic' }, base));
  assert.doesNotThrow(() => authorize(doctor, 'clinical.update', { weight: 10, visibleUntil: '2030-01-01' }, context));
  denied(() => authorize(doctor, 'clinical.create', { date: '2030-01-01' }, base));
  for (const payload of [{ date: '' }, { motivoConsulta: '' }, { patientId: 'p2' }, { createdAt: new Date() }, { weight: -1 }, { weight: Infinity },
    { weight: '10' }, { isAdmin: true }, { prescription: 'x'.repeat(1000000) }]) {
    denied(() => authorize(doctor, 'clinical.update', payload, context));
    denied(() => authorize(doctor, 'clinical.create', { date: '2030-01-01', motivoConsulta: 'Synthetic', ...payload }, base));
  }
});
test('unknown operations, inactive principals and orphaned Doctor scopes default to denial', () => {
  denied(() => authorize(doctor, 'made-up.operation', {}, base));
  denied(() => authorize({ ...doctor, active: false }, 'patient.create', basic, base));
  denied(() => authorize(assistant, 'patient.create', basic, { ...base, doctor: null }));
  denied(() => authorize(assistant, 'patient.create', basic, { ...base, doctor: { ...doctorUser, role: 'assistant' } }));
});
test('read projections remove credentials and all clinical fields', () => {
  const directory = patientDirectoryProjection(child);
  const portal = patientPortalProjection(child);
  for (const data of [directory, portal]) for (const field of ['otpPassword', 'diagnosis', 'vaccinationRecord']) assert.ok(!(field in data));
  assert.deepEqual(Object.keys(portal), ['id', 'doctorId', 'name', 'lastName', 'birthDate', 'fatherName', 'motherName']);
});
test('occupancy projections contain only times and exclude cancelled/disabled entries', () => {
  assert.deepEqual(occupiedTimesProjection([
    { time: '10:00', status: 'scheduled', patientId: 'p1' },
    { time: '10:00', status: 'scheduled', patientId: 'p2' },
    { time: '11:00', status: 'cancelled', patientId: 'p3' },
    { time: '12:00', status: 'scheduled', disabled: true },
    { time: '99:99', status: 'scheduled' },
  ]), ['10:00']);
});
test('printing configuration remains Doctor-only with bounded, typed fields', () => {
  const context = { ...base, target: doctorUser };
  assert.doesNotThrow(() => authorize(doctor, 'printing.update', { paperSize: 'carta', orientation: 'vertical',
    marginTop: 1, usePreloadedLogo: true, showDoctorName: true }, context));
  for (const principal of [assistant, admin, patient]) denied(() => authorize(principal, 'printing.update', { marginTop: 1 }, context));
  for (const payload of [{ marginTop: -1 }, { logoWidth: 0 }, { showDoctorName: 'yes' }, { paperSize: 'unknown' },
    { logoUrl: 'https://example.test/injected' }, { customWidth: 1000000 }]) denied(() => authorize(doctor, 'printing.update', payload, context));
});
test('patient credential administration is restricted to the owner Doctor', () => {
  for (const operation of ['patient.credential.read', 'patient.credential.rotate']) {
    assert.doesNotThrow(() => authorize(doctor, operation, {}, base));
    for (const principal of [assistant, admin, patient]) denied(() => authorize(principal, operation, {}, base));
    denied(() => authorize(doctor, operation, {}, { ...base, target: { ...child, doctorId: 'd2' } }));
    denied(() => authorize(doctor, operation, { role: 'admin' }, base));
  }
});
test('request verification checks revocation and authoritative UID, ignores forged token role', async () => {
  const opaque = randomBytes(24).toString('hex');
  let checkedRevocation = false;
  const result = await authenticateRequest(opaque, {
    verifyIdToken: async (_value, checkRevoked) => { checkedRevocation = checkRevoked; return { uid: 'auth-d1', role: 'admin' }; },
    getPrincipal: async () => doctor,
    getStaffUser: async () => ({ ...doctorUser, firebaseUid: 'auth-d1' }),
  });
  assert.equal(checkedRevocation, true);
  assert.equal(result.role, 'doctor');
  await assert.rejects(() => authenticateRequest(opaque, { verifyIdToken: async () => ({ uid: 'auth-d2' }), getPrincipal: async () => doctor }), AccessDenied);
});
test('missing, expired, inactive, and stale patient identities are rejected', async () => {
  const opaque = randomBytes(24).toString('hex');
  await assert.rejects(() => authenticateRequest('', {}), AccessDenied);
  await assert.rejects(() => authenticateRequest(opaque, { verifyIdToken: async () => { throw new Error('Synthetic expiration'); } }), AccessDenied);
  await assert.rejects(() => authenticateRequest(opaque, { verifyIdToken: async () => ({ uid: 'auth-d1' }), getPrincipal: async () => ({ ...doctor, active: false }) }), AccessDenied);
  await assert.rejects(() => authenticateRequest(opaque, { verifyIdToken: async () => ({ uid: 'auth-family', patientSessionVersion: 0 }), getPrincipal: async () => patient }), AccessDenied);
});
test('removed staff or changed role/identity cannot reuse a previously valid principal', async () => {
  const opaque = randomBytes(24).toString('hex');
  for (const value of [null, { ...doctorUser, firebaseUid: 'auth-other' }, { ...doctorUser, firebaseUid: 'auth-d1', role: 'admin' }]) {
    await assert.rejects(() => authenticateRequest(opaque, {
      verifyIdToken: async () => ({ uid: 'auth-d1' }), getPrincipal: async () => doctor,
      getStaffUser: async () => value,
    }), AccessDenied);
  }
});
test('reassigned Assistant cannot use an old Doctor scope on the server', async () => {
  const opaque = randomBytes(24).toString('hex');
  await assert.rejects(() => authenticateRequest(opaque, {
    verifyIdToken: async () => ({ uid: 'auth-a1' }), getPrincipal: async () => assistant,
    getStaffUser: async () => ({ uid: 'a1', firebaseUid: 'auth-a1', role: 'assistant', createdBy: 'd2', profileComplete: true }),
  }), AccessDenied);
});
