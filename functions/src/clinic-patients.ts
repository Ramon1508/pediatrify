import {createHash, createHmac} from "node:crypto";
import {Auth, DecodedIdToken, getAuth} from "firebase-admin/auth";
import {DocumentData, Firestore, Timestamp, Transaction, getFirestore} from "firebase-admin/firestore";
import {HttpsError, onCall} from "firebase-functions/v2/https";
import {clinicSecurityEnabled, clinicPatientSummary, readClinicPrincipal, trustedClinicDoctor, verifyClinicToken} from "./clinic-auth";
import {claimNewPatientCredential, PatientPasswordCollision, patientCredentialEncryptionKey,
  patientPasswordUniquenessKey, prepareNewPatientCredential} from "./patient-credentials";
import {validStaffId} from "./clinic-identifiers";

const validId = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const denied = () => new HttpsError("permission-denied", "No tienes permiso para crear pacientes en esta agenda.");
const invalid = () => new HttpsError("invalid-argument", "Revisa los datos del paciente antes de guardar.");
const basicFields = ["name", "lastName", "birthDate", "email", "secondaryEmail", "fatherName", "motherName", "phone", "secondaryPhone", "referredBy"];
type DuplicateKind = "email" | "name";

/** Canonical civil date of the consultorio, independent of browser/server machine timezone.
 * @param {number} now Trusted server instant.
 * @return {string} Mexico City civil date.
 */
export function clinicServerDate(now = Date.now()): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {timeZone: "America/Mexico_City",
    year: "numeric", month: "2-digit", day: "2-digit"}).formatToParts(new Date(now)).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Validate basic registration without accepting clinical fields, credentials or ownership.
 * @param {unknown} input Caller basic fields.
 * @param {number} now Server instant.
 * @return {DocumentData} Canonical registration.
 */
export function validateNewClinicPatient(input: unknown, now = Date.now()): DocumentData {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw invalid();
  const value = input as DocumentData;
  if (Object.keys(value).some((key) => !basicFields.includes(key)) ||
      ["name", "lastName", "birthDate", "email", "fatherName", "motherName", "phone"].some((key) => typeof value[key] !== "string") ||
      Object.values(value).some((field) => typeof field !== "string") || Buffer.byteLength(JSON.stringify(value), "utf8") > 262144) throw invalid();
  const result = Object.fromEntries(Object.entries(value).map(([key, field]) => [key, (field as string).trim()]));
  const validEmail = (email: string) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  result.email = result.email.toLowerCase();
  result.secondaryEmail = (result.secondaryEmail ?? "").toLowerCase();
  const birth = new Date(result.birthDate + "T00:00:00.000Z");
  if (!result.name || !result.fatherName || !result.motherName || !/^\d{10}$/.test(result.phone) ||
      !validEmail(result.email) || (result.secondaryEmail && !validEmail(result.secondaryEmail)) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(result.birthDate) || !Number.isFinite(birth.valueOf()) ||
      birth.toISOString().slice(0, 10) !== result.birthDate || result.birthDate > clinicServerDate(now)) throw invalid();
  return result;
}

/** Current staff association must resolve to a real active Doctor; Admin-owned test Assistants have no agenda.
 * @param {Transaction} tx Transaction.
 * @param {Firestore} db Database.
 * @param {DecodedIdToken} token Verified token.
 * @return {Promise<object>} Trusted patient creator.
 */
async function patientCreator(tx: Transaction, db: Firestore, token: DecodedIdToken) {
  const principal = await readClinicPrincipal(tx, db, token);
  if (!["doctor", "assistant"].includes(principal.role) || !validStaffId(principal.doctorId)) throw denied();
  await trustedClinicDoctor(tx, db, principal.doctorId);
  return principal;
}

/** Query current duplicates scoped to the verified Doctor; no details of existing patients returned.
 * @param {Transaction} tx Transaction.
 * @param {Firestore} db Database.
 * @param {string} doctorId Trusted Doctor.
 * @param {DocumentData} data Validated registration.
 * @return {Promise<DuplicateKind[]>} Separate email/name confirmations.
 */
async function duplicateKinds(tx: Transaction, db: Firestore, doctorId: string, data: DocumentData): Promise<DuplicateKind[]> {
  const emails = [...new Set([data.email, data.secondaryEmail].filter(Boolean))];
  const byEmail = await Promise.all(emails.flatMap((email) => ["email", "secondaryEmail"].map((field) =>
    tx.get(db.collection("patients").where("doctorId", "==", doctorId).where(field, "==", email).limit(1)))));
  const byName = await tx.get(db.collection("patients").where("doctorId", "==", doctorId)
    .where("fullNameKey", "==", JSON.stringify([data.name.toLowerCase(), data.lastName.toLowerCase()])).limit(1));
  return [...(byEmail.some((snapshot) => !snapshot.empty) ? ["email" as const] : []), ...(!byName.empty ? ["name" as const] : [])];
}

/** Authorized idempotent creation: patient, projections, private credential, unique reservation and audit commit together.
 * @param {Firestore} db Database.
 * @param {Auth} auth Auth adapter.
 * @param {unknown} authorization Platform Authorization header.
 * @param {unknown} input Untrusted creation request.
 * @param {object} security Server gate, keys and time.
 * @return {Promise<DocumentData>} Basic patient or separate confirmation requirements; NEVER a password.
 */
export async function createClinicPatientRecord(db: Firestore, auth: Auth, authorization: unknown, input: unknown,
  security: {enabled: boolean; encryptionSecret: string; uniquenessSecret: string; now?: number}): Promise<DocumentData> {
  if (!security.enabled) throw new HttpsError("failed-precondition", "El acceso seguro aún no está habilitado.");
  if (!input || typeof input !== "object" || Array.isArray(input)) throw invalid();
  const request = input as DocumentData;
  if (Object.keys(request).some((key) => !["operationId", "patient", "confirmedDuplicates"].includes(key)) || !validId(request.operationId) ||
      (request.confirmedDuplicates !== undefined && (!Array.isArray(request.confirmedDuplicates) || request.confirmedDuplicates.length > 2 ||
      request.confirmedDuplicates.some((kind: unknown) => !["email", "name"].includes(kind as string))))) throw invalid();
  const now = security.now ?? Date.now();
  const data = validateNewClinicPatient(request.patient, now);
  const token = await verifyClinicToken(auth, authorization);
  if (!/^[a-fA-F0-9]{64}$/.test(security.uniquenessSecret)) throw new HttpsError("failed-precondition", "La generación de acceso requiere configuración del servidor.");
  const digest = createHash("sha256").update(JSON.stringify([token.uid, request.operationId])).digest("hex");
  const patientId = "patient-" + digest.slice(0, 40);
  const operationRef = db.doc("patientCreationOperations/" + digest);
  const inputHash = createHmac("sha256", Buffer.from(security.uniquenessSecret, "hex"))
    .update(JSON.stringify(basicFields.map((field) => [field, data[field] ?? ""]))).digest("hex");
  const inspect = async (tx: Transaction) => {
    const principal = await patientCreator(tx, db, token);
    const receipt = (await tx.get(operationRef)).data();
    if ((await tx.get(db.doc("patientDeletionJobs/" + patientId))).exists) throw denied();
    const existing = (await tx.get(db.doc("patients/" + patientId))).data();
    if (receipt) {
      if (receipt.inputHash !== inputHash || receipt.actorUid !== token.uid || receipt.doctorId !== principal.doctorId ||
          receipt.patientId !== patientId || !existing || existing.doctorId !== principal.doctorId) {
        throw new HttpsError("aborted", "La operación cambió. Revisa los datos antes de guardar nuevamente.");
      }
      return {principal, existing, warnings: [] as DuplicateKind[]};
    }
    if (existing) throw new HttpsError("already-exists", "La operación ya tiene un paciente asociado.");
    const duplicates = await duplicateKinds(tx, db, principal.doctorId as string, data);
    const warnings = duplicates.filter((kind) => !request.confirmedDuplicates?.includes(kind));
    return {principal, existing: undefined, warnings};
  };
  const response = (patient: DocumentData) => ({status: "created", patient: Object.fromEntries(
    ["id", "doctorId", ...basicFields, "profileComplete"].filter((field) => field in patient).map((field) => [field, patient[field]]))});
  const initial = await db.runTransaction(inspect);
  if (initial.existing) return response(initial.existing);
  if (initial.warnings.length) return {status: "confirmation-required", warnings: initial.warnings};
  for (let attempt = 0; attempt < 8; attempt++) {
    const patient = {...data, id: patientId, doctorId: initial.principal.doctorId, profileComplete: false,
      fullNameKey: JSON.stringify([data.name.toLowerCase(), data.lastName.toLowerCase()]),
      createdAt: Timestamp.fromMillis(now), updatedAt: Timestamp.fromMillis(now)};
    const credential = await prepareNewPatientCredential(patient, security.encryptionSecret, security.uniquenessSecret, now);
    try {
      return await db.runTransaction(async (tx) => {
        const current = await inspect(tx);
        if (current.existing) return response(current.existing);
        if (current.warnings.length) return {status: "confirmation-required", warnings: current.warnings};
        if (current.principal.doctorId !== patient.doctorId) throw denied();
        await claimNewPatientCredential(tx, db, credential);
        tx.create(db.doc("patients/" + patientId), patient);
        tx.create(db.doc("patientDirectory/" + patientId), {...data, id: patientId, doctorId: patient.doctorId, profileComplete: false});
        tx.create(db.doc("patientPortal/" + patientId), clinicPatientSummary(patient));
        tx.create(operationRef, {patientId, actorUid: token.uid, doctorId: patient.doctorId, inputHash,
          credentialEpoch: credential.credentialEpoch, createdAt: Timestamp.fromMillis(now)});
        tx.create(db.doc("auditLog/patient-create-" + digest), {id: "patient-create-" + digest,
          action: "patient.create", entityType: "patient", entityId: patientId, performedBy: current.principal.userId,
          performedByUid: token.uid, timestamp: Timestamp.fromMillis(now)});
        return response(patient);
      });
    } catch (error) {
      if (!(error instanceof PatientPasswordCollision)) throw error;
    }
  }
  throw new HttpsError("resource-exhausted", "No fue posible generar un acceso único. Intenta nuevamente.");
}

export const createClinicPatient = onCall({secrets: [patientCredentialEncryptionKey, patientPasswordUniquenessKey],
  maxInstances: 2, concurrency: 8, memory: "512MiB", timeoutSeconds: 90}, (request) => {
  if (!clinicSecurityEnabled.value()) throw new HttpsError("failed-precondition", "El acceso seguro aún no está habilitado.");
  return createClinicPatientRecord(getFirestore(), getAuth(), request.rawRequest.get("authorization"), request.data,
    {enabled: true, encryptionSecret: patientCredentialEncryptionKey.value(), uniquenessSecret: patientPasswordUniquenessKey.value()});
});
