import {createHash} from "node:crypto";
import {Auth, getAuth} from "firebase-admin/auth";
import {DocumentData, Firestore, Timestamp, Transaction, getFirestore} from "firebase-admin/firestore";
import {HttpsError, onCall} from "firebase-functions/v2/https";
import {ClinicPrincipal, clinicPatientSummary, clinicSecurityEnabled, readClinicFamilyPatient, readClinicPrincipal, trustedClinicDoctor, verifyClinicToken} from "./clinic-auth";
import {BASIC_PATIENT_FIELDS, MEDICAL_PATIENT_FIELDS, PROFILE_FIELDS, RECORD_FIELDS, SCHEDULE_FIELDS, clinicClock, clinicDenied, clinicInvalid, clinicObject, clinicPublicationExpiry, clinicScheduleFromUser, clinicSlotAllowed, pickClinicFields, sanitizeClinicDocument, validClinicDate, validClinicId, validateClinicSchedule, writeClinicUserProjections} from "./clinic-data";
import {patientCredentialEncryptionKey, preparePatientCredentialContacts} from "./patient-credentials";
import {deleteClinicPatientData} from "./clinic-patient-deletion";
import {validStaffId} from "./clinic-identifiers";

/** All business mutations derive actor/owner from verified authority; request IDs are never roles.
 * @param {Transaction} tx Transaction containing the authority checks and writes.
 * @param {Firestore} db Database adapter.
 * @param {ClinicPrincipal} principal Current protected identity.
 * @param {string} patientId Requested patient identifier.
 * @param {boolean} doctorOnly Require the Doctor role for clinical changes.
 * @return {object} Result of the validated clinic operation.
 */
async function ownedPatient(tx: Transaction, db: Firestore, principal: ClinicPrincipal, patientId: string, doctorOnly = true): Promise<DocumentData> {
  if (!validClinicId(patientId) || (doctorOnly && principal.role !== "doctor")) throw clinicDenied();
  if (principal.role === "patient") return readClinicFamilyPatient(tx, db, principal, patientId);
  if (!["doctor", "assistant"].includes(principal.role)) throw clinicDenied();
  await trustedClinicDoctor(tx, db, principal.doctorId);
  const patient = (await tx.get(db.doc("patients/" + patientId))).data();
  if (!patient || patient.doctorId !== principal.doctorId || (await tx.get(db.doc("patientDeletionJobs/" + patientId))).exists) throw clinicDenied();
  return patient;
}

/** validatePatientUpdate: apply the server-side clinic contract.
 * @param {unknown} input Untrusted operation payload.
 * @param {object} current Validated current for this operation.
 * @param {string} today Validated today for this operation.
 * @return {object} Result of the validated clinic operation.
 */
function validatePatientUpdate(input: unknown, current: DocumentData, today: string): DocumentData {
  const data = clinicObject(input, [...BASIC_PATIENT_FIELDS, ...MEDICAL_PATIENT_FIELDS]);
  const merged = {...current, ...data};
  for (const field of BASIC_PATIENT_FIELDS) {
    if (merged[field] !== undefined && typeof merged[field] !== "string") throw clinicInvalid();
  }
  if (!merged.name?.trim() || (!merged.fatherName?.trim() && !merged.motherName?.trim()) ||
      !validClinicDate(merged.birthDate) || merged.birthDate > today || !/^\d{10}$/.test(merged.phone)) throw clinicInvalid();
  for (const field of ["email", "secondaryEmail"]) {
    if (field in data) data[field] = data[field].trim().toLowerCase();
    const email = data[field] ?? merged[field];
    if ((field === "email" || email) && (typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw clinicInvalid();
  }
  for (const field of ["birthWeight", "birthHeight", "headCircumference"]) {
    if (field === "headCircumference" && data[field] === null) continue;
    if (field in data && (typeof data[field] !== "number" || !Number.isFinite(data[field]) || data[field] <= 0)) throw clinicInvalid();
  }
  if ("sex" in data && ![1, 2, 3].includes(data.sex)) throw clinicInvalid();
  if ("birthMethod" in data && !["vaginal", "cesarean"].includes(data.birthMethod)) throw clinicInvalid();
  for (const field of ["hasAllergies", "hasBeenHospitalized", "hasDisease", "takesMedication", "profileComplete"]) {
    if (field in data && typeof data[field] !== "boolean") throw clinicInvalid();
  }
  for (const field of ["bloodType", "allergies", "hospitalizationReason", "diseaseDescription", "medicationDescription"]) {
    if (field in data && typeof data[field] !== "string") throw clinicInvalid();
  }
  if ("vaccinationRecord" in data) {
    const record = data.vaccinationRecord;
    if (!record || typeof record !== "object" || Array.isArray(record)) throw clinicInvalid();
    for (const doses of Object.values(record) as DocumentData[]) {
      if (!doses || typeof doses !== "object" || Array.isArray(doses)) throw clinicInvalid();
      for (const value of Object.values(doses)) {
        const dose = clinicObject(value, ["applied", "applicationDate", "batchNumber", "institution", "notes"]);
        if (typeof dose.applied !== "boolean" || (dose.applicationDate && !validClinicDate(dose.applicationDate))) throw clinicInvalid();
        for (const field of ["batchNumber", "institution", "notes"]) if (field in dose && typeof dose[field] !== "string") throw clinicInvalid();
      }
    }
  }
  return data;
}

/** validateRecordUpdate: apply the server-side clinic contract.
 * @param {unknown} input Untrusted operation payload.
 * @param {object} current Validated current for this operation.
 * @param {string} today Validated today for this operation.
 * @return {object} Result of the validated clinic operation.
 */
function validateRecordUpdate(input: unknown, current: DocumentData | undefined, today: string): DocumentData {
  const data = clinicObject(input, RECORD_FIELDS);
  const next = {...current, ...data};
  if (typeof next.motivoConsulta !== "string" || !next.motivoConsulta.trim()) throw clinicInvalid();
  if (current && "date" in data && data.date !== current.date) throw clinicInvalid();
  if (!current) data.date = today;
  for (const [field, value] of Object.entries(data)) {
    if (["weight", "height", "headCircumference", "bmi", "saturation", "temperature"].includes(field)) {
      if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) throw clinicInvalid();
    } else if (["visibleUntil", "visibleUntilRx"].includes(field)) {
      if (value !== "" && (!validClinicDate(value) || (!current && value < today))) throw clinicInvalid();
    } else if (typeof value !== "string") throw clinicInvalid();
  }
  for (const field of ["recommendations", "prescription"]) if (field in data) data[field] = sanitizeClinicDocument(data[field]);
  return data;
}

/** writePublishedRecords: apply the server-side clinic contract.
 * @param {Transaction} tx Transaction containing the authority checks and writes.
 * @param {Firestore} db Database adapter.
 * @param {object} record Validated record for this operation.
 * @param {string} doctorId Verified owner Doctor identifier.
 */
function writePublishedRecords(tx: Transaction, db: Firestore, record: DocumentData, doctorId: string): void {
  for (const [kind, field, expiry] of [["recommendations", "recommendations", "visibleUntil"], ["prescription", "prescription", "visibleUntilRx"]]) {
    const ref = db.doc("patientDocuments/" + record.id + "-" + kind);
    if (!record[field]?.trim()) {
      tx.delete(ref); continue;
    }
    tx.set(ref, {id: record.id + "-" + kind, recordId: record.id, doctorId, patientId: record.patientId, kind, content: sanitizeClinicDocument(record[field]),
      date: record.date, createdAt: record.createdAt, sourceUpdatedAt: record.updatedAt,
      expiresAt: record[expiry] ? clinicPublicationExpiry(record[expiry]) : null,
      visibleUntil: record[expiry] ?? ""});
  }
}

/** notificationRecipients: apply the server-side clinic contract.
 * @param {Transaction} tx Transaction containing the authority checks and writes.
 * @param {Firestore} db Database adapter.
 * @param {object} patient Validated patient for this operation.
 * @return {object} Result of the validated clinic operation.
 */
async function notificationRecipients(tx: Transaction, db: Firestore, patient: DocumentData): Promise<Map<string, string>> {
  const recipients = new Map<string, string>([[patient.doctorId, "doctor"]]);
  const assistants = await tx.get(db.collection("users").where("createdBy", "==", patient.doctorId).where("role", "==", "assistant"));
  for (const doc of assistants.docs) {
    if (doc.data().pending !== true && doc.data().profileComplete === true) {
      const authority = (await tx.get(db.doc("securityPrincipals/" + doc.data().firebaseUid))).data();
      const deletion = await tx.get(db.doc("staffDeletionJobs/" + doc.id));
      if (authority?.active === true && !deletion.exists) recipients.set(doc.id, "assistant");
    }
  }
  for (const email of new Set([patient.email, patient.secondaryEmail].filter(Boolean))) {
    for (const field of ["email", "secondaryEmail"]) {
      const siblings = await tx.get(db.collection("patients").where("doctorId", "==", patient.doctorId).where(field, "==", email));
      for (const child of siblings.docs) if (!(await tx.get(db.doc("patientDeletionJobs/" + child.id))).exists) recipients.set(child.id, "patient");
    }
  }
  return recipients;
}

/** writeAppointmentNotifications: apply the server-side clinic contract.
 * @param {Transaction} tx Transaction containing the authority checks and writes.
 * @param {Firestore} db Database adapter.
 * @param {ClinicPrincipal} principal Current protected identity.
 * @param {object} appointment Validated appointment for this operation.
 * @param {object} recipients Validated recipients for this operation.
 * @param {string} kind Validated kind for this operation.
 * @param {string} operationId Validated operationId for this operation.
 * @param {number} now Trusted current instant in milliseconds.
 * @param {string} actorName Validated actorName for this operation.
 */
function writeAppointmentNotifications(tx: Transaction, db: Firestore, principal: ClinicPrincipal, appointment: DocumentData,
  recipients: Map<string, string>, kind: string, operationId: string, now: Timestamp, actorName: string): void {
  const titles: Record<string, string> = {"appointment-created": "Consulta agendada", "appointment-cancelled": "Consulta cancelada", "appointment-rescheduled": "Consulta reagendada"};
  for (const [recipientId, recipientType] of recipients) {
    const id = createHash("sha256").update(JSON.stringify([principal.authUid, operationId, recipientId])).digest("hex");
    tx.set(db.doc("notifications/" + id), {id, type: kind, title: titles[kind],
      description: `${appointment.patientName}: ${appointment.date.split("-").reverse().join("/")} a las ${appointment.time}.`,
      appointmentId: appointment.id, doctorId: appointment.doctorId, createdAt: now,
      originatorId: principal.userId ?? principal.patientId, originatorName: actorName,
      recipientId, recipientType, read: recipientId === (principal.userId ?? principal.patientId)});
  }
}

/** Atomic business source, projection, audit and operation receipt; no client authority is accepted.
 * @param {Firestore} db Database adapter.
 * @param {Auth} auth Admin Auth adapter.
 * @param {unknown} authorization Platform authorization header.
 * @param {unknown} input Untrusted operation payload.
 * @param {object} security Validated security for this operation.
 * @return {object} Result of the validated clinic operation.
 */
export async function mutateClinicData(db: Firestore, auth: Auth, authorization: unknown, input: unknown,
  security: {enabled: boolean; encryptionSecret: string; now?: number; patientToken?: import("firebase-admin/auth").DecodedIdToken}): Promise<DocumentData> {
  if (!security.enabled) throw new HttpsError("failed-precondition", "El acceso seguro aún no está habilitado.");
  const request = clinicObject(input, ["operation", "operationId", "entityId", "patientId", "data"]);
  const staffEntity = request.operation === "profile.update" || request.operation === "schedule.update";
  if (!validClinicId(request.operationId) || !(staffEntity ? validStaffId(request.entityId) : validClinicId(request.entityId)) ||
      typeof request.operation !== "string") throw clinicInvalid();
  const operations = ["patient.update", "patient.delete", "record.create", "record.update", "record.delete", "appointment.create", "appointment.update", "appointment.delete", "profile.update", "schedule.update"];
  if (!operations.includes(request.operation)) throw clinicDenied();
  const token = security.patientToken ?? await verifyClinicToken(auth, authorization);
  const now = security.now ?? Date.now();
  const stamp = Timestamp.fromMillis(now);
  const digest = createHash("sha256").update(JSON.stringify([token.uid, request.operationId])).digest("hex");
  const fingerprint = createHash("sha256").update(JSON.stringify([request.operation, request.entityId, request.patientId ?? "", request.data ?? {}])).digest("hex");
  const receiptRef = db.doc("clinicOperations/" + digest);
  const result = await db.runTransaction(async (tx) => {
    const principal = await readClinicPrincipal(tx, db, token, now);
    const receipt = (await tx.get(receiptRef)).data();
    if (receipt) {
      if (receipt.fingerprint !== fingerprint || receipt.actorUid !== token.uid) throw new HttpsError("aborted", "Reintenta la misma operación con sus datos originales.");
      return {saved: true, deletePatient: receipt.deletePatient === true, doctorId: receipt.doctorId};
    }
    const operation = request.operation as string;
    let doctorId = principal.doctorId;
    let actorName = "";
    let actorEmail = principal.loginEmail ?? "";
    if (principal.userId) {
      const actor = (await tx.get(db.doc("users/" + principal.userId))).data();
      actorName = actor?.name ?? "";
      actorEmail = actor?.email ?? "";
    } else if (principal.patientId) {
      const actor = (await tx.get(db.doc("patients/" + principal.patientId))).data();
      actorName = `${actor?.name ?? ""} ${actor?.lastName ?? ""}`.trim();
    }
    if (operation === "patient.update" || operation === "patient.delete") {
      const patient = await ownedPatient(tx, db, principal, request.entityId);
      if (operation === "patient.delete") {
        clinicObject(request.data ?? {}, []);
        tx.set(db.doc("patientDeletionJobs/" + request.entityId), {patientId: request.entityId, doctorId, blocked: true, completed: false, updatedAt: stamp});
        tx.set(db.doc("patientSessionStatus/" + request.entityId), {active: false});
      } else {
        const changes = validatePatientUpdate(request.data, patient, clinicClock(now).date);
        const credential = (await tx.get(db.doc("patientCredentials/" + patient.id))).data();
        if (!credential) throw clinicDenied();
        const next: DocumentData = {...patient, ...changes, updatedAt: stamp};
        next.fullNameKey = JSON.stringify([next.name.toLowerCase(), next.lastName.toLowerCase()]);
        const nextCredential = preparePatientCredentialContacts(credential, next, security.encryptionSecret, now);
        tx.update(db.doc("patients/" + patient.id), {...changes, fullNameKey: next.fullNameKey, updatedAt: stamp});
        tx.set(db.doc("patientCredentials/" + patient.id), nextCredential);
        tx.set(db.doc("patientSessionStatus/" + patient.id), {active: true,
          credentialEpoch: nextCredential.credentialEpoch, credentialVersion: nextCredential.credentialVersion});
        tx.set(db.doc("patientDirectory/" + patient.id), {...pickClinicFields(next, BASIC_PATIENT_FIELDS), id: patient.id, doctorId, profileComplete: next.profileComplete ?? false});
        tx.set(db.doc("patientPortal/" + patient.id), clinicPatientSummary(next));
      }
    } else if (operation.startsWith("record.")) {
      const current = (await tx.get(db.doc("clinicalRecords/" + request.entityId))).data();
      const creating = operation === "record.create";
      if ((creating && current) || (!creating && !current)) throw clinicDenied();
      const patientId = creating ? request.patientId : current?.patientId;
      const patient = await ownedPatient(tx, db, principal, patientId);
      doctorId = patient.doctorId;
      if (operation === "record.delete") {
        clinicObject(request.data ?? {}, []);
        tx.delete(db.doc("clinicalRecords/" + request.entityId));
        for (const kind of ["recommendations", "prescription"]) tx.delete(db.doc("patientDocuments/" + request.entityId + "-" + kind));
      } else {
        const changes = validateRecordUpdate(request.data, current, clinicClock(now).date);
        const record = {...current, ...changes, id: request.entityId, patientId, doctorId,
          createdBy: current?.createdBy ?? principal.userId, createdAt: current?.createdAt ?? stamp,
          updatedBy: principal.userId, updatedAt: stamp};
        tx.set(db.doc("clinicalRecords/" + request.entityId), record);
        writePublishedRecords(tx, db, record, doctorId as string);
      }
    } else if (operation.startsWith("appointment.")) {
      const old = (await tx.get(db.doc("appointments/" + request.entityId))).data();
      const creating = operation === "appointment.create";
      if ((creating && old) || (!creating && !old)) throw clinicDenied();
      const data = clinicObject(request.data ?? {}, ["patientId", "date", "time", "notes", "status", "disabled"]);
      if (old && "patientId" in data && data.patientId !== old.patientId) throw clinicDenied();
      const patient = await ownedPatient(tx, db, principal, old?.patientId ?? data.patientId, false);
      const doctor = await trustedClinicDoctor(tx, db, patient.doctorId);
      doctorId = patient.doctorId;
      if (old && old.doctorId !== doctorId) throw clinicDenied();
      if (old?.disabled === true || (old?.status === "cancelled" && data.status !== "cancelled")) throw clinicDenied();
      const cancelling = data.status === "cancelled";
      const deleting = operation === "appointment.delete" || data.disabled === true;
      if ("notes" in data && typeof data.notes !== "string") throw clinicInvalid();
      if ("disabled" in data && typeof data.disabled !== "boolean") throw clinicInvalid();
      if ("status" in data && !["scheduled", "cancelled", "attended"].includes(data.status)) throw clinicInvalid();
      if (creating && (cancelling || deleting || (data.status && data.status !== "scheduled"))) throw clinicInvalid();
      if (principal.role === "patient") {
        if (doctor.allowPatientScheduling !== true || deleting || ("status" in data && !["scheduled", "cancelled"].includes(data.status))) throw clinicDenied();
      }
      const appointment: DocumentData = {...old, ...data, id: request.entityId, doctorId,
        patientId: patient.id, patientName: `${patient.name} ${patient.lastName}`.trim(), patientLastName: patient.lastName,
        patientFatherName: patient.fatherName ?? "", patientMotherName: patient.motherName ?? "", patientBirthDate: patient.birthDate,
        patientPhone: patient.phone ?? "", doctorName: doctor.name, type: "scheduled", status: data.status ?? old?.status ?? "scheduled",
        disabled: deleting, createdAt: old?.createdAt ?? stamp, updatedAt: stamp, updatedBy: actorEmail};
      const rescheduling = !old || old.date !== appointment.date || old.time !== appointment.time;
      if (!cancelling && !deleting) {
        if (rescheduling && !clinicSlotAllowed(clinicScheduleFromUser(doctor), appointment.date, appointment.time, now)) throw new HttpsError("failed-precondition", "Elige un día y una hora disponibles en el horario del Doctor.");
        if (principal.role === "patient") {
          const occupied = await tx.get(db.collection("appointments").where("doctorId", "==", doctorId).where("date", "==", appointment.date).where("time", "==", appointment.time));
          if (occupied.docs.some((doc) => doc.id !== request.entityId && doc.data().disabled !== true && doc.data().status !== "cancelled")) throw new HttpsError("already-exists", "Esa hora ya está ocupada. Elige otra hora disponible.");
        }
      }
      const kind = deleting || cancelling ? "appointment-cancelled" : creating ? "appointment-created" : rescheduling ? "appointment-rescheduled" : undefined;
      const recipients = kind ? await notificationRecipients(tx, db, patient) : new Map<string, string>();
      tx.set(db.doc("appointments/" + appointment.id), appointment);
      if (deleting || cancelling) tx.delete(db.doc("appointmentSlots/" + appointment.id));
      else tx.set(db.doc("appointmentSlots/" + appointment.id), {id: appointment.id, doctorId, date: appointment.date, time: appointment.time});
      if (kind) writeAppointmentNotifications(tx, db, principal, appointment, recipients, kind, request.operationId, stamp, actorName || `${patient.name} ${patient.lastName}`.trim());
    } else {
      const user = (await tx.get(db.doc("users/" + request.entityId))).data();
      if (!user || (await tx.get(db.doc("staffDeletionJobs/" + request.entityId))).exists) throw clinicDenied();
      let changes: DocumentData;
      if (operation === "schedule.update") {
        if (!["doctor", "assistant"].includes(principal.role) || user.role !== "doctor" || principal.doctorId !== user.uid) throw clinicDenied();
        await trustedClinicDoctor(tx, db, user.uid);
        const data = clinicObject(request.data, SCHEDULE_FIELDS);
        if (principal.role === "assistant" && "allowPatientScheduling" in data) throw clinicDenied();
        changes = validateClinicSchedule(data, clinicScheduleFromUser(user));
      } else {
        const own = principal.userId === user.uid;
        const managed = (principal.role === "admin" && ["admin", "doctor"].includes(user.role) && !own) ||
          (principal.role === "doctor" && user.role === "assistant" && user.createdBy === principal.userId);
        if (!(managed || (own && ["doctor", "assistant"].includes(principal.role)))) throw clinicDenied();
        changes = clinicObject(request.data, managed || principal.role === "assistant" ? ["name"] : PROFILE_FIELDS);
        for (const [field, value] of Object.entries(changes)) {
          if (field === "sexo") {
            if (![1, 2, 3].includes(value)) throw clinicInvalid();
          } else if (field !== "printSettings" && typeof value !== "string") throw clinicInvalid();
        }
        if ("name" in changes && !changes.name.trim()) throw clinicInvalid();
        if (changes.logoPath && (!changes.logoPath.startsWith("logos/" + user.uid + "/") || changes.logoPath.includes(".."))) throw clinicDenied();
        if ("printSettings" in changes) {
          const ps = clinicObject(changes.printSettings, ["paperSize", "orientation", "customWidth", "customHeight", "marginTop", "marginBottom", "marginLeft", "marginRight", "usePreloadedLogo", "logoPosition", "logoWidth", "showDoctorName", "showSpecialty", "showProfessionalId", "showSpecialtyId", "showDoctorPhone", "showDoctorOffice", "showPatientName", "showConsultDate", "showPatientAge", "showPatientWeight", "showPatientHeight", "showPatientHeadCircumference", "showPatientTemperature"]);
          for (const [field, value] of Object.entries(ps)) {
            if (field.startsWith("show") || field === "usePreloadedLogo") {
              if (typeof value !== "boolean") throw clinicInvalid();
            } else if (!["paperSize", "orientation", "logoPosition"].includes(field) && (typeof value !== "number" || !Number.isFinite(value) || value < 0)) throw clinicInvalid();
          }
          if (!(["media-carta", "carta", "oficio", "custom"].includes(ps.paperSize) && ["horizontal", "vertical"].includes(ps.orientation) && ["top-left", "top-right"].includes(ps.logoPosition))) throw clinicInvalid();
          if (ps.logoWidth <= 0 || (ps.paperSize === "custom" && (!ps.customWidth || !ps.customHeight))) throw clinicInvalid();
        }
      }
      const next = {...user, ...changes, updatedAt: stamp};
      tx.update(db.doc("users/" + user.uid), {...changes, updatedAt: stamp});
      writeClinicUserProjections(tx, db, next);
    }
    const deletePatient = operation === "patient.delete";
    tx.create(receiptRef, {fingerprint, actorUid: token.uid, operation, entityId: request.entityId, doctorId: doctorId ?? null, deletePatient, createdAt: stamp});
    tx.create(db.doc("auditLog/clinic-" + digest), {id: "clinic-" + digest, action: operation, entityType: operation.split(".")[0], entityId: request.entityId,
      performedBy: principal.userId ?? principal.patientId, performedByUid: token.uid, timestamp: stamp});
    return {saved: true, deletePatient, doctorId};
  });
  if (result.deletePatient) await deleteClinicPatientData(db, request.entityId, result.doctorId);
  return {saved: true};
}

export const saveClinicData = onCall({secrets: [patientCredentialEncryptionKey], timeoutSeconds: 540, maxInstances: 4},
  (request) => mutateClinicData(getFirestore(), getAuth(), request.rawRequest.get("authorization"), request.data,
    {enabled: clinicSecurityEnabled.value(), encryptionSecret: patientCredentialEncryptionKey.value()}));

/** Return current publications only, never the private clinical record.
 * @param {Firestore} db Database.
 * @param {Auth} auth Auth adapter.
 * @param {unknown} authorization Platform authorization header.
 * @param {unknown} input Requested family member.
 * @param {object} security Server gate and clock.
 * @return {Promise<object>} Published documents grouped by original record.
 */
export async function readClinicPublications(db: Firestore, auth: Auth, authorization: unknown, input: unknown,
  security: {enabled: boolean; now?: number; patientToken?: import("firebase-admin/auth").DecodedIdToken}): Promise<{records: DocumentData[]}> {
  if (!security.enabled) throw new HttpsError("failed-precondition", "El acceso seguro aún no está habilitado.");
  const data = clinicObject(input, ["patientId"]);
  if (!validClinicId(data.patientId)) throw clinicInvalid();
  const token = security.patientToken ?? await verifyClinicToken(auth, authorization);
  const now = security.now ?? Date.now();
  return db.runTransaction(async (tx) => {
    const principal = await readClinicPrincipal(tx, db, token, now);
    if (principal.role !== "patient") throw clinicDenied();
    await ownedPatient(tx, db, principal, data.patientId, false);
    const projections = await tx.get(db.collection("patientDocuments").where("doctorId", "==", principal.doctorId).where("patientId", "==", data.patientId));
    const records = new Map<string, DocumentData>();
    for (const projection of projections.docs) {
      const item = projection.data();
      if (!validClinicId(item.recordId) || !["recommendations", "prescription"].includes(item.kind) ||
          (item.expiresAt !== null && (!(item.expiresAt instanceof Timestamp) || item.expiresAt.toMillis() <= now))) continue;
      const source = (await tx.get(db.doc("clinicalRecords/" + item.recordId))).data();
      if (!source || source.patientId !== data.patientId || source.doctorId !== principal.doctorId ||
          !(source.updatedAt instanceof Timestamp) || !(item.sourceUpdatedAt instanceof Timestamp) || !source.updatedAt.isEqual(item.sourceUpdatedAt)) continue;
      const record = records.get(item.recordId) ?? {id: item.recordId, patientId: data.patientId,
        date: item.date, createdAt: item.createdAt, createdBy: "", motivoConsulta: ""};
      record[item.kind] = sanitizeClinicDocument(item.content);
      record[item.kind === "prescription" ? "visibleUntilRx" : "visibleUntil"] = item.visibleUntil ?? "";
      records.set(item.recordId, record);
    }
    return {records: [...records.values()]};
  });
}

export const getClinicPublications = onCall((request) => readClinicPublications(getFirestore(), getAuth(),
  request.rawRequest.get("authorization"), request.data, {enabled: clinicSecurityEnabled.value()}));
