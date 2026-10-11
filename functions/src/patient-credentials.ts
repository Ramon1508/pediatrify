import {createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt} from "node:crypto";
import {Auth, DecodedIdToken, getAuth} from "firebase-admin/auth";
import {DocumentData, Firestore, Timestamp, Transaction, getFirestore} from "firebase-admin/firestore";
import {defineSecret} from "firebase-functions/params";
import {HttpsError, onCall} from "firebase-functions/v2/https";
import {clinicSecurityEnabled, derivePatientVerifier, readClinicPrincipal,
  trustedClinicDoctor, validCredentialRevision, verifyClinicToken} from "./clinic-auth";
import {validStaffId} from "./clinic-identifiers";

const encryptionKey = defineSecret("PATIENT_CREDENTIAL_ENCRYPTION_KEY");
const uniquenessKey = defineSecret("PATIENT_PASSWORD_UNIQUENESS_KEY");
export {encryptionKey as patientCredentialEncryptionKey, uniquenessKey as patientPasswordUniquenessKey};
const validId = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const denied = () => new HttpsError("permission-denied", "No tienes permiso para consultar o renovar este acceso.");
const unavailable = () => new HttpsError("failed-precondition", "El acceso del paciente requiere configuración del servidor.");
const conflict = () => new HttpsError("aborted", "El acceso cambió. Consulta la contraseña actual antes de renovar nuevamente.");
type CredentialAction = "read" | "rotate";
interface CredentialRequest {patientId: string; operationId?: string; expectedVersion?: number; expectedEpoch?: string}

/** Internal retry signal; never disclose another patient's reservation to a caller. */
export class PatientPasswordCollision extends Error {}

/** Uniform cryptographic generation; the caller cannot provide a password.
 * @return {string} Six-character clinic access password.
 */
export function generatePatientPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({length: 6}, () => alphabet[randomInt(alphabet.length)]).join("");
}

/** Secret-key fingerprint for an atomic global reservation, never a public password lookup.
 * @param {string} password Generated password.
 * @param {string} secret Stable server-only uniqueness key, separate from encryption.
 * @return {string} Reservation document ID.
 */
export function patientPasswordFingerprint(password: string, secret: string): string {
  if (!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(password)) throw unavailable();
  return createHmac("sha256", keyBytes(secret)).update("clinic-patient-password-v1:").update(password).digest("hex");
}

/** Validate a server secret without printing it or deriving a key from weak input.
 * @param {string} secret Secret Manager key encoded as 32 hexadecimal bytes.
 * @return {Buffer} Encryption key.
 */
function keyBytes(secret: string): Buffer {
  if (typeof secret !== "string" || !/^[a-fA-F0-9]{64}$/.test(secret)) throw unavailable();
  return Buffer.from(secret, "hex");
}

/** Bind ciphertext to the patient, Doctor and credential incarnation/revision.
 * @param {DocumentData} credential Private credential metadata.
 * @return {Buffer} Authenticated context.
 */
function associatedData(credential: DocumentData): Buffer {
  if (!validId(credential.patientId) || !validStaffId(credential.doctorId) || !validCredentialRevision(credential)) throw unavailable();
  return Buffer.from(JSON.stringify(["patient-access-v1", credential.patientId, credential.doctorId,
    credential.credentialEpoch, credential.credentialVersion]), "utf8");
}

/** Server-only encrypted recoverable password, for the existing Doctor copy/view operation and authorized mail.
 * @param {string} password Reusable password.
 * @param {string} secret Server-only key.
 * @param {DocumentData} credential Trusted metadata.
 * @return {object} Ciphertext; never a public projection.
 */
export function encryptPatientPassword(password: string, secret: string, credential: DocumentData) {
  if (typeof password !== "string" || password.length < 4 || password.length > 256) throw unavailable();
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(secret), nonce);
  cipher.setAAD(associatedData(credential));
  const ciphertext = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  return {algorithm: "aes-256-gcm-v1", nonce: nonce.toString("hex"),
    ciphertext: ciphertext.toString("hex"), tag: cipher.getAuthTag().toString("hex")};
}

/** Decrypt only after a fresh ownership check. Invalid metadata/key/ciphertext fails without SDK details.
 * @param {DocumentData} credential Private credential.
 * @param {string} secret Server-only key.
 * @return {string} Password for the authorized caller.
 */
export function decryptPatientPassword(credential: DocumentData, secret: string): string {
  const key = keyBytes(secret);
  try {
    const value = credential.encryptedPassword;
    if (!value || value.algorithm !== "aes-256-gcm-v1" || typeof value.nonce !== "string" ||
        !/^[a-f0-9]{24}$/.test(value.nonce) || typeof value.tag !== "string" || !/^[a-f0-9]{32}$/.test(value.tag) ||
        typeof value.ciphertext !== "string" || !/^(?:[a-f0-9]{2}){4,1024}$/.test(value.ciphertext)) throw unavailable();
    const cipher = createDecipheriv("aes-256-gcm", key, Buffer.from(value.nonce, "hex"));
    cipher.setAAD(associatedData(credential));
    cipher.setAuthTag(Buffer.from(value.tag, "hex"));
    const password = Buffer.concat([cipher.update(Buffer.from(value.ciphertext, "hex")), cipher.final()]).toString("utf8");
    if (password.length < 4 || password.length > 256) throw unavailable();
    return password;
  } catch {
    throw unavailable();
  }
}

/** Derive login aliases from trusted normalized patient contacts, never request authority fields.
 * @param {DocumentData} patient Current private patient record.
 * @return {string[]} Canonical primary and optional secondary email.
 */
export function patientCredentialEmails(patient: DocumentData): string[] {
  if (typeof patient.email !== "string" || !patient.email) throw unavailable();
  const emails = [patient.email, patient.secondaryEmail === undefined ? "" : patient.secondaryEmail].filter((email) => email !== "");
  if (emails.some((email) => typeof email !== "string" || email !== email.trim().toLowerCase() ||
      email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw unavailable();
  return [...new Set(emails)];
}

/** Prepare a credential for a NEW server-authorized patient; caller must create both in one transaction.
 * Not an endpoint and not a migration of legacy plaintext passwords.
 * @param {DocumentData} patient Validated patient assembled by the trusted writer.
 * @param {string} secret Server-only key.
 * @param {string} uniquenessSecret Stable private uniqueness key.
 * @param {number} now Server time.
 * @return {Promise<DocumentData>} Private credential, generated password intentionally omitted.
 */
export async function prepareNewPatientCredential(patient: DocumentData, secret: string, uniquenessSecret: string,
  now = Date.now()): Promise<DocumentData> {
  keyBytes(secret);
  if (!validId(patient.id) || !validStaffId(patient.doctorId) || !Number.isFinite(now)) throw unavailable();
  const password = generatePatientPassword();
  const credential: DocumentData = {patientId: patient.id, doctorId: patient.doctorId,
    loginEmails: patientCredentialEmails(patient), passwordFingerprint: patientPasswordFingerprint(password, uniquenessSecret),
    credentialVersion: 1, credentialEpoch: randomBytes(16).toString("hex"),
    createdAt: Timestamp.fromMillis(now), updatedAt: Timestamp.fromMillis(now)};
  credential.verifier = await derivePatientVerifier(password);
  credential.encryptedPassword = encryptPatientPassword(password, secret, credential);
  return credential;
}

/** Claim a NEW globally unique password and credential in the patient writer transaction.
 * Call after all other reads and before other writes; a collision requires generating another candidate.
 * @param {Transaction} tx Authorized patient creation transaction.
 * @param {Firestore} db Database.
 * @param {DocumentData} credential Prepared private credential.
 * @return {Promise<void>} Both records queued atomically.
 */
export async function claimNewPatientCredential(tx: Transaction, db: Firestore, credential: DocumentData): Promise<void> {
  associatedData(credential);
  if (typeof credential.passwordFingerprint !== "string" || !/^[a-f0-9]{64}$/.test(credential.passwordFingerprint)) throw unavailable();
  const credentialRef = db.doc("patientCredentials/" + credential.patientId);
  const reservationRef = db.doc("patientPasswordReservations/" + credential.passwordFingerprint);
  const [existing, reservation] = await Promise.all([tx.get(credentialRef), tx.get(reservationRef)]);
  if (existing.exists) throw conflict();
  if (reservation.exists) throw new PatientPasswordCollision();
  tx.create(reservationRef, {patientId: credential.patientId, doctorId: credential.doctorId,
    credentialEpoch: credential.credentialEpoch, credentialVersion: credential.credentialVersion});
  tx.create(credentialRef, credential);
  tx.set(db.doc("patientSessionStatus/" + credential.patientId), {active: true,
    credentialEpoch: credential.credentialEpoch, credentialVersion: credential.credentialVersion});
}

/** Prepare the credential part of an authorized atomic patient-contact update; preserve the reusable password.
 * The patient writer must read both documents first, then commit patient + returned credential together.
 * @param {DocumentData} credential Current private credential.
 * @param {DocumentData} patient Validated next patient record.
 * @param {string} secret Server-only key.
 * @param {number} now Server time.
 * @return {DocumentData} Next private credential; unchanged contacts retain the original revision.
 */
export function preparePatientCredentialContacts(credential: DocumentData, patient: DocumentData,
  secret: string, now = Date.now()): DocumentData {
  if (credential.patientId !== patient.id || credential.doctorId !== patient.doctorId ||
      !validCredentialRevision(credential) || !Number.isFinite(now)) throw unavailable();
  const loginEmails = patientCredentialEmails(patient);
  if (JSON.stringify(loginEmails) === JSON.stringify(credential.loginEmails)) return credential;
  const password = decryptPatientPassword(credential, secret);
  if (!Number.isSafeInteger(credential.credentialVersion + 1)) throw unavailable();
  const next = {...credential, loginEmails, credentialVersion: credential.credentialVersion + 1,
    updatedAt: Timestamp.fromMillis(now)};
  return {...next, encryptedPassword: encryptPatientPassword(password, secret, next)};
}

/** Exact request schema; no role, Doctor, email, principal, expiration or arbitrary hash configuration.
 * @param {CredentialAction} action Trusted endpoint action.
 * @param {unknown} input Caller payload.
 * @return {CredentialRequest} Validated business request.
 */
function parseRequest(action: CredentialAction, input: unknown): CredentialRequest {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw denied();
  const value = input as Record<string, unknown>;
  const fields = action === "read" ? ["patientId"] : ["patientId", "operationId", "expectedVersion", "expectedEpoch"];
  if (Object.keys(value).some((field) => !fields.includes(field)) || !validId(value.patientId)) throw denied();
  if (action === "rotate" && (!validId(value.operationId) || !Number.isSafeInteger(value.expectedVersion) ||
      (value.expectedVersion as number) < 1 || typeof value.expectedEpoch !== "string" ||
      !/^[a-f0-9]{32}$/.test(value.expectedEpoch))) throw denied();
  return value as unknown as CredentialRequest;
}

/** Every read and commit checks current principal, patient, credential and deletion state in a transaction.
 * @param {Transaction} tx Transaction.
 * @param {Firestore} db Database.
 * @param {DecodedIdToken} token Server-verified token.
 * @param {string} patientId Child ID.
 * @return {Promise<object>} Protected scope and credential.
 */
async function readOwnedCredential(tx: Transaction, db: Firestore, token: DecodedIdToken, patientId: string) {
  const principal = await readClinicPrincipal(tx, db, token);
  if (principal.role !== "doctor" || principal.userId !== principal.doctorId) throw denied();
  await trustedClinicDoctor(tx, db, principal.doctorId);
  const patient = (await tx.get(db.doc("patients/" + patientId))).data();
  if (!patient || patient.id !== patientId || patient.doctorId !== principal.doctorId) throw denied();
  if ((await tx.get(db.doc("patientDeletionJobs/" + patientId))).exists) throw denied();
  const credential = (await tx.get(db.doc("patientCredentials/" + patientId))).data();
  if (!credential || credential.patientId !== patientId || credential.doctorId !== principal.doctorId ||
      !validCredentialRevision(credential) || !Array.isArray(credential.loginEmails) ||
      JSON.stringify(credential.loginEmails) !== JSON.stringify(patientCredentialEmails(patient))) throw unavailable();
  if (typeof credential.passwordFingerprint !== "string" || !/^[a-f0-9]{64}$/.test(credential.passwordFingerprint)) throw unavailable();
  const reservation = (await tx.get(db.doc("patientPasswordReservations/" + credential.passwordFingerprint))).data();
  if (!reservation || reservation.patientId !== patientId || reservation.doctorId !== credential.doctorId ||
      reservation.credentialEpoch !== credential.credentialEpoch) throw unavailable();
  return {principal, credential};
}

/** Execute authorized access retrieval/renewal. Same operation retry reuses the committed result, never rotates twice.
 * @param {Firestore} db Database.
 * @param {Auth} auth Auth adapter.
 * @param {unknown} authorization Platform Authorization header.
 * @param {CredentialAction} action Trusted endpoint action.
 * @param {unknown} input Untrusted payload.
 * @param {object} security Server activation and secret.
 * @return {Promise<object>} Current reusable password and revision for the owner Doctor only.
 */
export async function managePatientCredential(db: Firestore, auth: Auth, authorization: unknown,
  action: CredentialAction, input: unknown,
  security: {enabled: boolean; encryptionSecret: string; uniquenessSecret?: string; now?: number; generatePassword?: () => string}) {
  if (!security.enabled) throw new HttpsError("failed-precondition", "El acceso seguro aún no está habilitado.");
  const request = parseRequest(action, input);
  const token = await verifyClinicToken(auth, authorization);
  const key = keyBytes(security.encryptionSecret);
  const now = security.now ?? Date.now();
  if (!Number.isFinite(now)) throw unavailable();
  const operationKey = createHash("sha256").update(JSON.stringify([token.uid, request.patientId, request.operationId])).digest("hex");
  const operationRef = db.doc("patientCredentialOperations/" + operationKey);
  const requestHash = createHmac("sha256", key).update(JSON.stringify([request.patientId, request.operationId,
    request.expectedEpoch, request.expectedVersion])).digest("hex");
  const inspect = async (tx: Transaction) => {
    const {principal, credential} = await readOwnedCredential(tx, db, token, request.patientId);
    const receipt = action === "rotate" ? (await tx.get(operationRef)).data() : undefined;
    if (receipt) {
      if (receipt.requestHash !== requestHash || receipt.credentialEpoch !== credential.credentialEpoch ||
          receipt.credentialVersion !== credential.credentialVersion) throw conflict();
    } else if (action === "rotate" && (request.expectedVersion !== credential.credentialVersion ||
        request.expectedEpoch !== credential.credentialEpoch)) throw conflict();
    const password = decryptPatientPassword(credential, security.encryptionSecret);
    return {principal, credential, receipt, password};
  };
  const existing = await db.runTransaction(inspect);
  if (action === "read" || existing.receipt) {
    return {password: existing.password,
      credentialVersion: existing.credential.credentialVersion, credentialEpoch: existing.credential.credentialEpoch};
  }
  keyBytes(security.uniquenessSecret ?? "");
  if (patientPasswordFingerprint(existing.password, security.uniquenessSecret ?? "") !== existing.credential.passwordFingerprint) {
    throw unavailable();
  }
  for (let attempt = 0; attempt < 8; attempt++) {
    const password = (security.generatePassword ?? generatePatientPassword)();
    const fingerprint = patientPasswordFingerprint(password, security.uniquenessSecret ?? "");
    const verifier = await derivePatientVerifier(password);
    try {
      return await db.runTransaction(async (tx) => {
        const current = await inspect(tx);
        if (current.receipt) {
          return {password: current.password,
            credentialVersion: current.credential.credentialVersion, credentialEpoch: current.credential.credentialEpoch};
        }
        if (current.credential.credentialEpoch !== existing.credential.credentialEpoch ||
        current.credential.credentialVersion !== existing.credential.credentialVersion ||
        !Number.isSafeInteger(current.credential.credentialVersion + 1)) throw conflict();
        const reservationRef = db.doc("patientPasswordReservations/" + fingerprint);
        if ((await tx.get(reservationRef)).exists) throw new PatientPasswordCollision();
        const credential: DocumentData = {...current.credential, verifier, passwordFingerprint: fingerprint,
          credentialVersion: current.credential.credentialVersion + 1,
          updatedAt: Timestamp.fromMillis(now)};
        credential.encryptedPassword = encryptPatientPassword(password, security.encryptionSecret, credential);
        tx.set(db.doc("patientCredentials/" + request.patientId), credential);
        tx.set(db.doc("patientSessionStatus/" + request.patientId), {active: true,
          credentialEpoch: credential.credentialEpoch, credentialVersion: credential.credentialVersion});
        tx.create(reservationRef, {patientId: request.patientId, doctorId: credential.doctorId,
          credentialEpoch: credential.credentialEpoch, credentialVersion: credential.credentialVersion});
        tx.delete(db.doc("patientPasswordReservations/" + current.credential.passwordFingerprint));
        tx.create(operationRef, {requestHash, patientId: request.patientId, actorId: current.principal.userId,
          credentialEpoch: credential.credentialEpoch, credentialVersion: credential.credentialVersion, createdAt: Timestamp.fromMillis(now)});
        tx.create(db.doc("auditLog/patient-access-" + operationKey), {id: "patient-access-" + operationKey,
          action: "patient.credential.rotate", entityType: "patient", entityId: request.patientId,
          performedBy: current.principal.userId, performedByUid: token.uid, timestamp: Timestamp.fromMillis(now)});
        return {password, credentialVersion: credential.credentialVersion, credentialEpoch: credential.credentialEpoch};
      });
    } catch (error) {
      if (!(error instanceof PatientPasswordCollision)) throw error;
    }
  }
  throw new HttpsError("resource-exhausted", "No fue posible generar un acceso único. Intenta nuevamente.");
}

export const getClinicPatientAccess = onCall({secrets: [encryptionKey], maxInstances: 2, concurrency: 8},
  (request) => {
    if (!clinicSecurityEnabled.value()) throw new HttpsError("failed-precondition", "El acceso seguro aún no está habilitado.");
    return managePatientCredential(getFirestore(), getAuth(), request.rawRequest.get("authorization"), "read", request.data,
      {enabled: true, encryptionSecret: encryptionKey.value()});
  });
export const renewClinicPatientAccess = onCall({secrets: [encryptionKey, uniquenessKey], maxInstances: 2, concurrency: 8, memory: "512MiB"},
  (request) => {
    if (!clinicSecurityEnabled.value()) throw new HttpsError("failed-precondition", "El acceso seguro aún no está habilitado.");
    return managePatientCredential(getFirestore(), getAuth(), request.rawRequest.get("authorization"), "rotate", request.data,
      {enabled: true, encryptionSecret: encryptionKey.value(), uniquenessSecret: uniquenessKey.value()});
  });
