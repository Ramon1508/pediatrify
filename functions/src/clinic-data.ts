import {DocumentData, Firestore, Timestamp, Transaction} from "firebase-admin/firestore";
import sanitizeHtml from "sanitize-html";
import {HttpsError} from "firebase-functions/v2/https";

export const BASIC_PATIENT_FIELDS = ["name", "lastName", "birthDate", "email", "secondaryEmail", "fatherName", "motherName", "phone", "secondaryPhone", "referredBy"];
export const MEDICAL_PATIENT_FIELDS = ["bloodType", "birthWeight", "birthHeight", "headCircumference", "sex", "birthMethod", "hasAllergies", "allergies", "hasBeenHospitalized", "hospitalizationReason", "hasDisease", "diseaseDescription", "takesMedication", "medicationDescription", "vaccinationRecord", "profileComplete"];
export const RECORD_FIELDS = ["date", "weight", "height", "headCircumference", "bmi", "saturation", "temperature", "motivoConsulta", "diagnosis", "notas", "recommendations", "visibleUntil", "prescription", "visibleUntilRx"];
export const SCHEDULE_FIELDS = ["consultationDuration", "allowPatientScheduling", "availableDays", "timeSegmentsByDay", "timeSegments"];
export const PROFILE_FIELDS = ["name", "sexo", "phone", "especialidad", "cedula", "cedulaEspecialidad", "consultorios", "logoPath", "printSettings"];
export const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
export const validClinicId = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
export const clinicDenied = () => new HttpsError("permission-denied", "Tu cuenta no puede realizar esta operación.");
export const clinicInvalid = () => new HttpsError("invalid-argument", "Revisa los datos antes de guardar.");
export const pickClinicFields = (data: DocumentData, fields: string[]) => Object.fromEntries(fields.filter((key) => data[key] !== undefined).map((key) => [key, data[key]]));

/** Validate an exact bounded object before using fields or serializing it.
 * @param {object} value Validated value for this operation.
 * @param {string[]} fields Exact accepted field names.
 * @return {object} Result of the validated clinic operation.
 */
export function clinicObject(value: unknown, fields: string[]): DocumentData {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((key) => !fields.includes(key)) ||
      Buffer.byteLength(JSON.stringify(value), "utf8") > 262144) throw clinicInvalid();
  return value as DocumentData;
}

/** Civil date validation, independent of the server or browser time zone.
 * @param {object} value Validated value for this operation.
 * @return {object} Result of the validated clinic operation.
 */
export function validClinicDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

/** clinicClock: apply the server-side clinic contract.
 * @param {number} now Trusted current instant in milliseconds.
 * @return {object} Result of the validated clinic operation.
 */
export function clinicClock(now = Date.now()): {date: string; minutes: number} {
  const parts = new Intl.DateTimeFormat("en-CA", {timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"}).formatToParts(now);
  const p = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute)};
}

/** Preserve supported editor formatting; never publish executable HTML.
 * @param {string} value Validated value for this operation.
 * @return {object} Result of the validated clinic operation.
 */
export function sanitizeClinicDocument(value: string): string {
  return sanitizeHtml(value, {allowedTags: [...sanitizeHtml.defaults.allowedTags, "img", "span"],
    allowedAttributes: {"*": ["class", "style"], "a": ["href", "title", "target"], "img": ["src", "alt", "width", "height"], "li": ["data-list"], "td": ["colspan", "rowspan"], "th": ["colspan", "rowspan"]},
    allowedStyles: {"*": {color: [/^#[0-9a-f]{3,8}$/i, /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/]}},
    allowedSchemes: ["https", "http", "mailto"], allowedSchemesByTag: {img: ["https", "http", "data"]},
    exclusiveFilter: (frame) => frame.tag === "img" && frame.attribs.src?.startsWith("data:") &&
      !/^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(frame.attribs.src),
    allowProtocolRelative: false, enforceHtmlBoundary: true});
}

/** validateClinicSchedule: apply the server-side clinic contract.
 * @param {unknown} input Untrusted operation payload.
 * @param {object} current Validated current for this operation.
 * @return {object} Result of the validated clinic operation.
 */
export function validateClinicSchedule(input: unknown, current: DocumentData): DocumentData {
  const data = clinicObject(input, SCHEDULE_FIELDS);
  const next = {...current, ...data};
  if (!Number.isSafeInteger(next.consultationDuration) || next.consultationDuration < 1 ||
      typeof next.allowPatientScheduling !== "boolean") throw clinicInvalid();
  const requestedDays = clinicObject(next.timeSegmentsByDay, DAYS);
  const byDay = Object.fromEntries(DAYS.map((day) => [day, requestedDays[day] ?? []]));
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  for (const segments of Object.values(byDay)) {
    if (!Array.isArray(segments)) throw clinicInvalid();
    let end = -1;
    const ranges = segments.map((s) => {
      const segment = clinicObject(s, ["startTime", "endTime"]);
      if (![segment.startTime, segment.endTime].every((t) => typeof t === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t))) throw clinicInvalid();
      return {start: minutes(segment.startTime), end: segment.endTime === "00:00" ? 1440 : minutes(segment.endTime)};
    }).sort((a, b) => a.start - b.start);
    for (const range of ranges) {
      if (range.start >= range.end || range.start < end) throw clinicInvalid();
      end = range.end;
    }
  }
  return {...pickClinicFields(next, ["consultationDuration", "allowPatientScheduling"]), timeSegmentsByDay: byDay,
    availableDays: DAYS.filter((day) => byDay[day]?.length), timeSegments: []};
}

/** clinicScheduleFromUser: apply the server-side clinic contract.
 * @param {object} user Validated user for this operation.
 * @return {object} Result of the validated clinic operation.
 */
export function clinicScheduleFromUser(user: DocumentData): DocumentData {
  const days = user.availableDays?.length ? user.availableDays : DAYS.filter((day) => day !== "Dom");
  const byDay = user.timeSegmentsByDay && Object.keys(user.timeSegmentsByDay).length ? user.timeSegmentsByDay :
    Object.fromEntries(days.map((day: string) => [day, user.timeSegments?.length ? user.timeSegments : [{startTime: "06:00", endTime: "00:00"}]]));
  return {doctorId: user.uid, consultationDuration: user.consultationDuration ?? 30, allowPatientScheduling: user.allowPatientScheduling ?? false,
    availableDays: Object.keys(byDay).filter((day) => byDay[day].length), timeSegmentsByDay: byDay, timeSegments: []};
}

/** clinicSlotAllowed: apply the server-side clinic contract.
 * @param {object} schedule Validated schedule for this operation.
 * @param {string} date Validated date for this operation.
 * @param {string} time Validated time for this operation.
 * @param {number} now Trusted current instant in milliseconds.
 * @return {object} Result of the validated clinic operation.
 */
export function clinicSlotAllowed(schedule: DocumentData, date: string, time: string, now = Date.now()): boolean {
  if (!validClinicDate(date) || typeof time !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return false;
  const clock = clinicClock(now);
  const minute = Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  if (date < clock.date || (date === clock.date && minute <= clock.minutes)) return false;
  const day = DAYS[new Date(date + "T12:00:00Z").getUTCDay()];
  const duration = schedule.consultationDuration ?? 30;
  if (!Number.isInteger(duration) || duration < 1) return false;
  return (schedule.timeSegmentsByDay?.[day] ?? []).some((segment: DocumentData) => {
    const start = Number(segment.startTime.slice(0, 2)) * 60 + Number(segment.startTime.slice(3));
    const end = segment.endTime === "00:00" ? 1440 : Number(segment.endTime.slice(0, 2)) * 60 + Number(segment.endTime.slice(3));
    return minute >= start && minute + duration <= end && (minute - start) % duration === 0;
  });
}

/** clinicStaffDirectory: apply the server-side clinic contract.
 * @param {object} user Validated user for this operation.
 * @return {object} Result of the validated clinic operation.
 */
export function clinicStaffDirectory(user: DocumentData): DocumentData {
  return pickClinicFields(user, ["uid", "name", "email", "role", "createdBy", "pending", "profileComplete", "createdAt"]);
}

/** writeClinicUserProjections: apply the server-side clinic contract.
 * @param {Transaction} tx Transaction containing the authority checks and writes.
 * @param {Firestore} db Database adapter.
 * @param {object} user Validated user for this operation.
 */
export function writeClinicUserProjections(tx: Transaction, db: Firestore, user: DocumentData): void {
  tx.set(db.doc("staffDirectory/" + user.uid), clinicStaffDirectory(user));
  if (user.role === "doctor" && user.pending !== true && user.profileComplete === true) {
    tx.set(db.doc("doctorProfiles/" + user.uid), {...pickClinicFields(user, ["uid", "name", "role", "profileComplete", "pending", "logoPath", "phone", "especialidad", "cedula", "cedulaEspecialidad", "consultorios", "printSettings"]), ...clinicScheduleFromUser(user)});
    tx.set(db.doc("schedules/" + user.uid), clinicScheduleFromUser(user));
  }
}

/** Midnight after a civil Mexico City date; modern clinic dates have UTC-06:00.
 * @param {string} date Validated date for this operation.
 * @return {object} Result of the validated clinic operation.
 */
export function clinicPublicationExpiry(date: string): Timestamp {
  if (!validClinicDate(date)) throw clinicInvalid();
  // Resolve civil midnight through Intl rather than assuming historical DST offsets.
  const following = new Date(new Date(date + "T12:00:00Z").valueOf() + 86400000).toISOString().slice(0, 10);
  let instant = new Date(following + "T00:00:00Z").valueOf();
  for (let i = 0; i < 3; i++) {
    const civil = clinicClock(instant);
    const represented = new Date(civil.date + "T00:00:00Z").valueOf() + civil.minutes * 60000;
    instant += new Date(following + "T00:00:00Z").valueOf() - represented;
  }
  return Timestamp.fromMillis(instant);
}
