// Server-side authorization prototype. The principal and context MUST come
// from trusted server reads after verifying a Firebase ID token. Never accept
// them from request.data, browser caches, URLs, or client-supplied claims.
export class AccessDenied extends Error {
  constructor(message = 'Operación no autorizada.') { super(message); this.name = 'AccessDenied'; }
}

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DURATIONS = [10, 15, 30, 45, 60, 120];
const BASIC_PATIENT_FIELDS = ['name', 'lastName', 'birthDate', 'email', 'secondaryEmail',
  'fatherName', 'motherName', 'phone', 'secondaryPhone', 'referredBy'];
const CLINICAL_PATIENT_FIELDS = ['bloodType', 'birthWeight', 'birthHeight', 'headCircumference',
  'sex', 'birthMethod', 'hasAllergies', 'allergies', 'hasBeenHospitalized', 'hospitalizationReason',
  'hasDisease', 'diseaseDescription', 'takesMedication', 'medicationDescription', 'vaccinationRecord', 'profileComplete'];
const PROFILE_FIELDS = ['name', 'sexo', 'phone', 'especialidad', 'cedula', 'cedulaEspecialidad',
  'consultorios', 'logoPath'];
const RECORD_FIELDS = ['date', 'weight', 'height', 'headCircumference', 'bmi', 'saturation',
  'temperature', 'motivoConsulta', 'diagnosis', 'notas', 'recommendations', 'visibleUntil',
  'prescription', 'visibleUntilRx'];
const PRINT_BOOLEANS = ['usePreloadedLogo', 'showDoctorName', 'showSpecialty', 'showProfessionalId',
  'showSpecialtyId', 'showDoctorPhone', 'showDoctorOffice', 'showPatientName', 'showConsultDate',
  'showPatientAge', 'showPatientWeight', 'showPatientHeight', 'showPatientHeadCircumference', 'showPatientTemperature'];

function check(condition, message) { if (!condition) throw new AccessDenied(message); }
function text(value, max, min = 0) { return typeof value === 'string' && value.length >= min && value.length <= max; }
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function exactFields(value, fields) { return object(value) && Object.keys(value).every((key) => fields.includes(key)); }
function pick(value, fields) {
  return Object.fromEntries(fields.filter((key) => key in value).map((key) => [key, value[key]]));
}
export function validDate(value) {
  if (!text(value, 10, 10) || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}
function validTime(value) { return typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value); }
function email(value) { return text(value, 254, 3) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
function normalizedEmail(value) { return value.trim().toLowerCase(); }
function numeric(value, max) { return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max; }

function validateVaccineRecord(record) {
  check(object(record) && Object.keys(record).length <= 100);
  for (const [vaccine, doses] of Object.entries(record)) {
    check(text(vaccine, 100, 1) && object(doses) && Object.keys(doses).length <= 50);
    for (const [age, dose] of Object.entries(doses)) {
      check(text(age, 100, 1) && exactFields(dose, ['applied', 'applicationDate', 'batchNumber', 'institution', 'notes']));
      check(typeof dose.applied === 'boolean');
      if ('applicationDate' in dose) check(validDate(dose.applicationDate));
      for (const field of ['batchNumber', 'institution', 'notes']) {
        if (field in dose) check(text(dose[field], field === 'notes' ? 2000 : 200));
      }
    }
  }
}

function validatePatient(data, clinical = false, creating = false) {
  check(exactFields(data, [...BASIC_PATIENT_FIELDS, ...(clinical ? CLINICAL_PATIENT_FIELDS : [])]));
  if (creating) check(['name', 'lastName', 'birthDate', 'email', 'fatherName', 'motherName', 'phone'].every((key) => key in data));
  for (const [field, value] of Object.entries(data)) {
    if (field === 'birthDate') check(validDate(value));
    else if (field === 'email') check(email(value));
    else if (field === 'secondaryEmail') check(value === '' || email(value));
    else if (field === 'sex') check([1, 2, 3].includes(value));
    else if (field === 'birthMethod') check(['vaginal', 'cesarean'].includes(value));
    else if (['birthWeight', 'birthHeight', 'headCircumference'].includes(field)) check(numeric(value, 1000));
    else if (['hasAllergies', 'hasBeenHospitalized', 'hasDisease', 'takesMedication', 'profileComplete'].includes(field)) check(typeof value === 'boolean');
    else if (field === 'vaccinationRecord') validateVaccineRecord(value);
    else check(text(value, ['allergies', 'hospitalizationReason', 'diseaseDescription', 'medicationDescription'].includes(field) ? 5000 : 300, ['name', 'lastName'].includes(field) ? 1 : 0));
  }
}

function validateSchedule(data) {
  check(exactFields(data, ['consultationDuration', 'timeSegmentsByDay', 'allowPatientScheduling']));
  if ('consultationDuration' in data) check(DURATIONS.includes(data.consultationDuration));
  if ('allowPatientScheduling' in data) check(typeof data.allowPatientScheduling === 'boolean');
  if ('timeSegmentsByDay' in data) {
    check(exactFields(data.timeSegmentsByDay, DAYS));
    for (const segments of Object.values(data.timeSegmentsByDay)) {
      check(Array.isArray(segments) && segments.length <= 12);
      for (const segment of segments) {
        check(exactFields(segment, ['startTime', 'endTime']) && validTime(segment.startTime) && validTime(segment.endTime));
        check(segment.endTime === '00:00' || segment.startTime < segment.endTime);
      }
    }
  }
}

function validateRecord(data) {
  check(exactFields(data, RECORD_FIELDS));
  check(validDate(data.date) && text(data.motivoConsulta, 10000, 1));
  for (const [field, value] of Object.entries(data)) {
    if (field === 'date') check(validDate(value));
    else if (['visibleUntil', 'visibleUntilRx'].includes(field)) check(value === '' || validDate(value));
    else if (['weight', 'height', 'headCircumference', 'bmi', 'saturation', 'temperature'].includes(field)) check(numeric(value, 1000));
    else check(text(value, ['recommendations', 'prescription'].includes(field) ? 50000 : 10000));
  }
}

function validPrincipal(principal, context) {
  return object(principal) && principal.active === true
    && text(principal.authUid, 128, 1) && ['admin', 'doctor', 'assistant', 'patient'].includes(principal.role)
    && (principal.role === 'admin' || (
      context.doctor?.uid === principal.doctorId && context.doctor.role === 'doctor'
      && context.doctor.pending !== true && context.doctor.profileComplete === true
    ));
}
function doctor(principal) { return principal.role === 'doctor' && principal.userId === principal.doctorId; }
function staff(principal) { return ['doctor', 'assistant'].includes(principal.role); }
function owned(principal, target) { return target?.doctorId === principal.doctorId; }
function family(principal, target, context) {
  return principal.role === 'patient' && owned(principal, target)
    && context.familyPatientIds?.includes(target.id) === true
    && [target.email, target.secondaryEmail].some((value) => typeof value === 'string' && normalizedEmail(value) === principal.loginEmail);
}
function canManageStaff(principal, target) {
  return (principal.role === 'admin' && ['admin', 'doctor'].includes(target?.role) && target.uid !== principal.userId)
    || (doctor(principal) && target?.role === 'assistant' && target.createdBy === principal.userId);
}

/** Returns a validated request; requested roles require protected caller authority. */
export function authorize(principal, operation, payload = {}, context = {}) {
  check(validPrincipal(principal, context));
  check(object(payload));
  const target = context.target;
  const patient = context.patient;
  const result = structuredClone(payload);
  switch (operation) {
    case 'profile.email.change':
      check(['admin', 'assistant'].includes(principal.role) && target?.uid === principal.userId && target.role === principal.role);
      if (principal.role === 'assistant') check(target.createdBy === principal.doctorId);
      check(exactFields(payload, principal.role === 'admin' ? ['email'] : ['name', 'email']) && email(payload.email));
      if ('name' in payload) check(text(payload.name, 300, 1) && payload.name.trim().length > 0);
      result.email = normalizedEmail(payload.email);
      break;
    case 'profile.update':
      if (principal.role === 'assistant') {
        check(target?.uid === principal.userId && target.role === 'assistant' && target.createdBy === principal.doctorId
          && exactFields(payload, ['name']) && text(payload.name, 300, 1) && payload.name.trim().length > 0);
        break;
      }
      check(doctor(principal) && target?.uid === principal.userId && exactFields(payload, PROFILE_FIELDS));
      for (const [field, value] of Object.entries(payload)) {
        if (field === 'sexo') check([1, 2, 3].includes(value));
        else if (field === 'logoPath') check(text(value, 500) && (value === '' || value.startsWith(`logos/${principal.userId}/`)) && !value.includes('..'));
        else check(text(value, field === 'consultorios' ? 5000 : 300, field === 'name' ? 1 : 0));
      }
      break;
    case 'staff.invite':
      check(principal.role === 'admin' || doctor(principal));
      check(exactFields(payload, ['name', 'email', 'role']) && text(payload.name, 200, 1) && email(payload.email));
      check(payload.role === undefined || ['admin', 'doctor', 'assistant'].includes(payload.role));
      check(principal.role === 'admin' || payload.role === undefined || payload.role === 'assistant');
      result.email = normalizedEmail(payload.email);
      result.role = payload.role ?? (principal.role === 'admin' ? 'doctor' : 'assistant');
      result.createdBy = principal.userId;
      break;
    case 'staff.update':
      check(canManageStaff(principal, target) && exactFields(payload, ['name', 'email']));
      if ('name' in payload) check(text(payload.name, 200, 1));
      if ('email' in payload) { check(email(payload.email)); result.email = normalizedEmail(payload.email); }
      break;
    case 'staff.delete':
      check(canManageStaff(principal, target) && Object.keys(payload).length === 0);
      // The deployed adapter must read/count and reserve in one transaction.
      if (target.role === 'admin') check(Number.isInteger(context.remainingActiveAdminCount) && context.remainingActiveAdminCount >= 1);
      break;
    case 'patient.create':
      check(staff(principal));
      validatePatient(payload, false, true);
      result.doctorId = principal.doctorId;
      result.email = normalizedEmail(payload.email);
      if (payload.secondaryEmail) result.secondaryEmail = normalizedEmail(payload.secondaryEmail);
      break;
    case 'patient.update':
      check(doctor(principal) && owned(principal, target));
      validatePatient(payload, true);
      validatePatient({ ...pick(target, [...BASIC_PATIENT_FIELDS, ...CLINICAL_PATIENT_FIELDS]), ...payload }, true, true);
      break;
    case 'patient.delete':
      check(doctor(principal) && owned(principal, target) && Object.keys(payload).length === 0);
      break;
    case 'patient.credential.read':
    case 'patient.credential.rotate':
      check(doctor(principal) && owned(principal, target) && Object.keys(payload).length === 0);
      break;
    case 'patient.readClinical':
      check(doctor(principal) && owned(principal, target));
      break;
    case 'clinical.create':
    case 'clinical.update':
      check(doctor(principal) && owned(principal, patient));
      if (operation === 'clinical.update') check(target?.patientId === patient.id);
      check(exactFields(payload, RECORD_FIELDS));
      validateRecord(operation === 'clinical.create' ? payload : { ...pick(target, RECORD_FIELDS), ...payload });
      result.patientId = patient.id;
      break;
    case 'clinical.delete':
      check(doctor(principal) && owned(principal, patient) && target?.patientId === patient.id && Object.keys(payload).length === 0);
      break;
    case 'appointment.create':
    case 'appointment.update':
    case 'appointment.cancel': {
      check(owned(principal, patient) && (staff(principal) || (family(principal, patient, context) && context.schedule?.allowPatientScheduling === true)));
      if (operation !== 'appointment.create') {
        check(target?.doctorId === principal.doctorId && target.patientId === patient.id && target.disabled !== true && target.status === 'scheduled');
      }
      check(exactFields(payload, operation === 'appointment.cancel' ? [] : ['date', 'time', 'notes']));
      if (operation === 'appointment.create') check('date' in payload && 'time' in payload);
      if ('date' in payload) check(validDate(payload.date));
      if ('time' in payload) check(validTime(payload.time));
      if ('notes' in payload) check(text(payload.notes, 5000));
      result.doctorId = principal.doctorId;
      result.patientId = patient.id;
      result.status = operation === 'appointment.cancel' ? 'cancelled' : 'scheduled';
      break;
    }
    case 'schedule.update':
      check(staff(principal) && target?.uid === principal.doctorId);
      check(principal.role === 'doctor' || !('allowPatientScheduling' in payload));
      validateSchedule(payload);
      break;
    case 'printing.update':
      check(doctor(principal) && target?.uid === principal.userId);
      check(exactFields(payload, [...PRINT_BOOLEANS, 'paperSize', 'orientation', 'customWidth', 'customHeight',
        'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'logoPosition', 'logoWidth']));
      for (const [field, value] of Object.entries(payload)) {
        if (PRINT_BOOLEANS.includes(field)) check(typeof value === 'boolean');
        else if (field === 'paperSize') check(['media-carta', 'carta', 'oficio', 'custom'].includes(value));
        else if (field === 'orientation') check(['horizontal', 'vertical'].includes(value));
        else if (field === 'logoPosition') check(['top-left', 'top-right'].includes(value));
        else check(numeric(value, 100) && (field.startsWith('margin') || value > 0));
      }
      break;
    default: throw new AccessDenied();
  }
  return result;
}

/** Validate again on the server; browser validation is not an access control. */
export async function authenticateRequest(idToken, dependencies) {
  check(typeof idToken === 'string' && idToken.length > 0 && idToken.length < 16000);
  let verified;
  try { verified = await dependencies.verifyIdToken(idToken, true); } catch { throw new AccessDenied(); }
  const principal = await dependencies.getPrincipal(verified.uid);
  check(principal?.active === true && principal.authUid === verified.uid);
  if (principal.role === 'patient') check(verified.patientSessionVersion === principal.sessionVersion);
  else {
    check(['admin', 'doctor', 'assistant'].includes(principal.role) && typeof dependencies.getStaffUser === 'function');
    const current = await dependencies.getStaffUser(principal.userId);
    check(current?.uid === principal.userId && current.firebaseUid === verified.uid && current.role === principal.role
      && current.pending !== true && current.profileComplete === true);
    if (principal.role === 'doctor') check(current.uid === principal.doctorId);
    if (principal.role === 'assistant') check(current.createdBy === principal.doctorId);
  }
  return principal;
}

/** Basic appointment selector data. Never return OTP or clinical fields. */
export function patientDirectoryProjection(patient) {
  const result = {};
  for (const key of ['id', 'doctorId', ...BASIC_PATIENT_FIELDS]) if (key in patient) result[key] = patient[key];
  return result;
}

/** The portal needs a child summary, not the private Patient document. */
export function patientPortalProjection(patient) {
  const result = {};
  for (const key of ['id', 'doctorId', 'name', 'lastName', 'birthDate', 'fatherName', 'motherName']) if (key in patient) result[key] = patient[key];
  return result;
}

/** Occupancy contains no names, contact details, reason, or patient IDs. */
export function occupiedTimesProjection(appointments) {
  return [...new Set(appointments.filter((item) => item.disabled !== true && item.status === 'scheduled')
    .map((item) => item.time).filter(validTime))].sort();
}
