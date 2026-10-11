import {createHash, createHmac, randomBytes, scrypt, timingSafeEqual} from "node:crypto";
import {Auth, DecodedIdToken, getAuth} from "firebase-admin/auth";
import {DocumentData, Firestore, Timestamp, Transaction, getFirestore} from "firebase-admin/firestore";
import {defineBoolean, defineSecret} from "firebase-functions/params";
import {HttpsError, onCall} from "firebase-functions/v2/https";
import {CLINIC_IDLE_MS, readClinicLease} from "./clinic-leases";
import {isServerPatientToken} from "./clinic-patient-token";
import {validStaffId} from "./clinic-identifiers";

// Activate ONLY with the coordinated P01 client/writer/rules rollout.
const enabled = defineBoolean("CLINIC_SECURITY_ENABLED", {default: false});
export {enabled as clinicSecurityEnabled};
const limiterKey = defineSecret("PATIENT_LOGIN_LIMITER_KEY");
const LOGIN_ERROR = "Credenciales inválidas. Verifica tu correo y contraseña.";
const MAX_FAMILY = 100;
const HASH_OPTIONS = {N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024};
const id = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const normalized = (value: string) => value.trim().toLowerCase();
const denied = () => new HttpsError("permission-denied", "Tu sesión ya no tiene acceso. Inicia sesión nuevamente.");
const failedLogin = () => new HttpsError("unauthenticated", LOGIN_ERROR);

export interface PasswordVerifier {algorithm: "scrypt-v1"; salt: string; hash: string}
export interface ClinicPrincipal {
  authUid: string; active: true; role: "admin" | "doctor" | "assistant" | "patient";
  userId?: string; doctorId?: string; patientId?: string; loginEmail?: string; sessionVersion?: number;
  credentialVersion?: number; credentialEpoch?: string;
}

/** Stable incarnation plus monotonic revision prevent reuse of an old session after rotation/recreation.
 * @param {unknown} value Credential or protected principal.
 * @return {boolean} Valid revision.
 */
export function validCredentialRevision(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const data = value as DocumentData;
  return Number.isSafeInteger(data.credentialVersion) && data.credentialVersion >= 1 &&
    typeof data.credentialEpoch === "string" && /^[a-f0-9]{32}$/.test(data.credentialEpoch);
}

/** Derive a salted verifier without storing a password in a public projection.
 * @param {string} password Access password.
 * @return {Promise<PasswordVerifier>} Server-private verifier.
 */
export async function derivePatientVerifier(password: string): Promise<PasswordVerifier> {
  if (typeof password !== "string" || password.length < 1 || password.length > 256) throw failedLogin();
  const salt = randomBytes(16).toString("hex");
  return {algorithm: "scrypt-v1", salt, hash: (await derive(password, Buffer.from(salt, "hex"))).toString("hex")};
}

/** Fixed server parameters; no request controls memory, work factor or output length.
 * @param {string} password Access password.
 * @param {Buffer} salt Random salt.
 * @return {Promise<Buffer>} Derived key.
 */
function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, 64, HASH_OPTIONS,
    (error, result) => error ? reject(error) : resolve(result)));
}

/** Constant-time comparison of valid fixed-length verifiers.
 * @param {string} password Access password.
 * @param {unknown} value Private stored verifier.
 * @return {Promise<boolean>} Match.
 */
export async function matchesPatientVerifier(password: string, value: unknown): Promise<boolean> {
  if (!value || typeof value !== "object" || typeof password !== "string" || !password || password.length > 256) return false;
  const verifier = value as Partial<PasswordVerifier>;
  if (verifier.algorithm !== "scrypt-v1" || typeof verifier.salt !== "string" || typeof verifier.hash !== "string" ||
      !/^[a-f0-9]{32}$/.test(verifier.salt) || !/^[a-f0-9]{128}$/.test(verifier.hash)) return false;
  return timingSafeEqual(await derive(password, Buffer.from(verifier.salt, "hex")), Buffer.from(verifier.hash, "hex"));
}

/** Validate caller token again, including Auth revocation. No identity from request.data.
 * @param {Auth} auth Admin Auth adapter.
 * @param {string} authorization Platform Authorization header.
 * @return {Promise<DecodedIdToken>} Verified Firebase ID token.
 */
export async function verifyClinicToken(auth: Auth, authorization: unknown): Promise<DecodedIdToken> {
  if (typeof authorization !== "string" || authorization.length > 16000 || !/^Bearer [^\s]+$/.test(authorization)) throw denied();
  try {
    return await auth.verifyIdToken(authorization.slice(7), true);
  } catch {
    throw denied();
  }
}

/** Read a fresh active Doctor, binding and deletion state within the caller transaction.
 * @param {Transaction} tx Transaction.
 * @param {Firestore} db Database.
 * @param {string} doctorId Canonical business ID.
 * @return {Promise<DocumentData>} Current owner profile.
 */
export async function trustedClinicDoctor(tx: Transaction, db: Firestore, doctorId: unknown): Promise<DocumentData> {
  if (!validStaffId(doctorId)) throw denied();
  const profile = (await tx.get(db.doc("users/" + doctorId))).data();
  const deletion = await tx.get(db.doc("staffDeletionJobs/" + doctorId));
  if (!profile || profile.uid !== doctorId || profile.role !== "doctor" || profile.pending === true ||
      profile.profileComplete !== true || !id(profile.firebaseUid) || deletion.exists) throw denied();
  const authority = (await tx.get(db.doc("securityPrincipals/" + profile.firebaseUid))).data();
  if (authority?.active !== true || authority.authUid !== profile.firebaseUid || authority.userId !== doctorId ||
      authority.doctorId !== doctorId || authority.role !== "doctor") throw denied();
  return profile;
}

/** Verify protected authority and current binding in the SAME transaction as a business mutation.
 * Assistants owned by an Admin may open their own profile; requiring a Doctor is a separate agenda check.
 * @param {Transaction} tx Transaction.
 * @param {Firestore} db Database.
 * @param {DecodedIdToken} token Verified token, never caller-selected.
 * @return {Promise<ClinicPrincipal>} Current authority.
 * @param {number} now Trusted current instant in milliseconds.
 * @param {boolean} openingStaffSession Allow a verified password provider to open a device lease.
 * @param {boolean} profileOnly Allow incomplete staff to finish their own profile.
 */
export async function readClinicPrincipal(tx: Transaction, db: Firestore, token: DecodedIdToken, now = Date.now(), openingStaffSession = false, profileOnly = false): Promise<ClinicPrincipal> {
  if (!id(token.uid)) throw denied();
  const deviceLease = openingStaffSession ? undefined : await readClinicLease(tx, db, token, now);
  if (openingStaffSession && token.firebase?.sign_in_provider !== "password") throw denied();
  const data = (await tx.get(db.doc("securityPrincipals/" + token.uid))).data();
  if (!data || data.active !== true || data.authUid !== token.uid) throw denied();
  if (deviceLease && deviceLease.role !== data.role) throw denied();
  if (data.role === "patient") {
    if (openingStaffSession || !isServerPatientToken(token)) throw denied();
    if (!validStaffId(data.doctorId) || !id(data.patientId) || typeof data.loginEmail !== "string" ||
        normalized(data.loginEmail) !== data.loginEmail || !Number.isSafeInteger(data.sessionVersion) ||
        data.sessionVersion < 1 || token.patientSessionVersion !== data.sessionVersion || !validCredentialRevision(data)) throw denied();
    const credential = (await tx.get(db.doc("patientCredentials/" + data.patientId))).data();
    if (!credential || !validCredentialRevision(credential) || credential.patientId !== data.patientId ||
        credential.doctorId !== data.doctorId || credential.credentialEpoch !== data.credentialEpoch ||
        credential.credentialVersion !== data.credentialVersion || !Array.isArray(credential.loginEmails) ||
        !credential.loginEmails.includes(data.loginEmail)) throw denied();
    await trustedClinicDoctor(tx, db, data.doctorId);
    await readClinicFamilyPatient(tx, db, data as ClinicPrincipal, data.patientId);
    return data as ClinicPrincipal;
  }
  if (!["admin", "doctor", "assistant"].includes(data.role) || !validStaffId(data.userId)) throw denied();
  const user = (await tx.get(db.doc("users/" + data.userId))).data();
  const deletion = await tx.get(db.doc("staffDeletionJobs/" + data.userId));
  if (!user || deletion.exists || user.uid !== data.userId || user.firebaseUid !== token.uid || user.role !== data.role ||
      ((!openingStaffSession && !profileOnly) && (user.pending === true || user.profileComplete !== true)) ||
      (data.role === "doctor" && data.doctorId !== data.userId) ||
      (data.role === "assistant" && (!validStaffId(user.createdBy) || user.createdBy !== data.doctorId)) ||
      (data.role === "admin" && data.doctorId !== undefined)) throw denied();
  return data as ClinicPrincipal;
}

/** Check a server-established membership against current contact/ownership, not a cached family list.
 * @param {Transaction} tx Transaction.
 * @param {Firestore} db Database.
 * @param {ClinicPrincipal} principal Protected current identity.
 * @param {string} patientId Requested child.
 * @return {Promise<DocumentData>} Private record, NEVER return it to the family.
 */
export async function readClinicFamilyPatient(tx: Transaction, db: Firestore, principal: ClinicPrincipal,
  patientId: string): Promise<DocumentData> {
  if (principal.role !== "patient" || !id(patientId)) throw denied();
  const membership = await tx.get(db.doc("familyAccess/" + principal.authUid + "/patients/" + patientId));
  const patient = (await tx.get(db.doc("patients/" + patientId))).data();
  const deletion = await tx.get(db.doc("patientDeletionJobs/" + patientId));
  if (deletion.exists || !membership.exists || !patient || patient.id !== patientId || patient.doctorId !== principal.doctorId ||
      ![patient.email, patient.secondaryEmail].some((email) => typeof email === "string" && normalized(email) === principal.loginEmail)) {
    throw denied();
  }
  return patient;
}

/** Explicit allowlist avoids returning credentials, diagnostics, measurements or contact details.
 * @param {DocumentData} patient Private source.
 * @return {DocumentData} Family summary.
 */
export function clinicPatientSummary(patient: DocumentData): DocumentData {
  const fields = ["id", "doctorId", "name", "lastName", "birthDate", "fatherName", "motherName"];
  return Object.fromEntries(fields.filter((field) => field in patient).map((field) => [field, patient[field]]));
}

/** Atomic account and transport budgets. No raw email/IP, password or token is stored or logged.
 * @param {Firestore} db Database.
 * @param {string} secret Server-only HMAC key.
 * @param {string} transport Platform socket address, NOT an untrusted forwarded header.
 * @param {string} email Normalized account name.
 * @param {number} now Trusted server time.
 * @return {Promise<void>} Budget consumed even for failed credentials.
 */
export async function consumePatientLoginBudget(db: Firestore, secret: string, transport: string, email: string,
  now = Date.now()): Promise<void> {
  if (typeof secret !== "string" || secret.length < 32 || typeof transport !== "string" || !transport ||
      typeof email !== "string" || !Number.isFinite(now)) throw failedLogin();
  const digest = (scope: string, value: string) => createHmac("sha256", secret).update(scope + ":" + value).digest("hex");
  const start = Math.floor(now / 300000) * 300000;
  const budgets = [{key: digest("account", email), max: 8}, {key: digest("transport", transport), max: 80}];
  await db.runTransaction(async (tx) => {
    const reads = await Promise.all(budgets.map((budget) => tx.get(db.doc("patientLoginBudgets/" + budget.key))));
    const counts = reads.map((snapshot) => snapshot.data()?.windowStart === start ? snapshot.data()?.count : 0);
    if (counts.some((count, index) => !Number.isSafeInteger(count) || count < 0 || count >= budgets[index].max)) throw failedLogin();
    budgets.forEach((budget, index) => tx.set(reads[index].ref, {windowStart: start, count: counts[index] + 1,
      expiresAt: Timestamp.fromMillis(start + 600000)}));
  }).catch(() => {
    throw failedLogin();
  });
}

/** Authenticate a reusable per-child password and establish trusted per-Doctor family access.
 * @param {Firestore} db Database.
 * @param {unknown} input Untrusted email/password, no role/Doctor supplied.
 * @param {object} security Server-derived limiter settings.
 * @return {Promise<object>} Opaque in-memory session and minimal summary.
 */
export async function authenticateClinicPatient(db: Firestore, input: unknown,
  security: {enabled: boolean; limiterSecret: string; transportAddress: string; now?: number}) {
  if (!security.enabled) throw new HttpsError("failed-precondition", "El acceso seguro aún no está habilitado.");
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      Object.keys(input).some((key) => !["email", "password"].includes(key))) throw failedLogin();
  const data = input as Record<string, unknown>;
  if (typeof data.email !== "string" || data.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim()) ||
      typeof data.password !== "string" || !data.password || data.password.length > 256) throw failedLogin();
  const email = normalized(data.email);
  const password = data.password;
  await consumePatientLoginBudget(db, security.limiterSecret, security.transportAddress, email, security.now);
  const credentials = await db.collection("patientCredentials").where("loginEmails", "array-contains", email).limit(MAX_FAMILY + 1).get();
  if (credentials.size > MAX_FAMILY) throw failedLogin();
  let chosen: {ref: FirebaseFirestore.DocumentReference; data: DocumentData} | undefined;
  let ambiguous = false;
  for (const snapshot of credentials.docs) {
    const candidate = snapshot.data();
    if (await matchesPatientVerifier(password, candidate.verifier)) {
      if (chosen && chosen.data.doctorId !== candidate.doctorId) ambiguous = true;
      chosen ??= {ref: snapshot.ref, data: candidate};
    }
  }
  if (credentials.empty) await derive(password, Buffer.alloc(16));
  if (ambiguous || !chosen || !validStaffId(chosen.data.doctorId) || !id(chosen.data.patientId) ||
      chosen.ref.id !== chosen.data.patientId || !validCredentialRevision(chosen.data)) throw failedLogin();
  const selected = chosen;
  const uid = "patient-" + randomBytes(24).toString("hex");
  const clinicSessionId = randomBytes(24).toString("hex");
  const bearer = clinicSessionId + "." + randomBytes(32).toString("hex");
  const sessionVersion = 1;
  const patient = await db.runTransaction(async (tx) => {
    // A password rotation / contact change racing with hashing must invalidate this attempt.
    const current = (await tx.get(selected.ref)).data();
    if (!current || current.patientId !== selected.data.patientId || current.doctorId !== selected.data.doctorId ||
        current.verifier?.hash !== selected.data.verifier.hash || current.verifier?.salt !== selected.data.verifier.salt ||
        current.credentialVersion !== selected.data.credentialVersion || current.credentialEpoch !== selected.data.credentialEpoch ||
        !Array.isArray(current.loginEmails) || !current.loginEmails.includes(email)) throw failedLogin();
    try {
      await trustedClinicDoctor(tx, db, current.doctorId);
    } catch {
      throw failedLogin();
    }
    const primary = await tx.get(db.collection("patients").where("doctorId", "==", current.doctorId).where("email", "==", email).limit(MAX_FAMILY + 1));
    const secondary = await tx.get(db.collection("patients").where("doctorId", "==", current.doctorId).where("secondaryEmail", "==", email).limit(MAX_FAMILY + 1));
    const family = new Map([...primary.docs, ...secondary.docs].map((snapshot) => [snapshot.id, {...snapshot.data(), id: snapshot.id}]));
    if (primary.size > MAX_FAMILY || secondary.size > MAX_FAMILY || family.size > MAX_FAMILY || !family.has(current.patientId)) throw failedLogin();
    if ((await tx.get(db.doc("patientDeletionJobs/" + current.patientId))).exists) throw failedLogin();
    const principal: ClinicPrincipal = {authUid: uid, active: true, role: "patient", doctorId: current.doctorId,
      patientId: current.patientId, loginEmail: email, sessionVersion,
      credentialVersion: current.credentialVersion, credentialEpoch: current.credentialEpoch};
    tx.create(db.doc("securityPrincipals/" + uid), {...principal, serverOnly: true, createdAt: Timestamp.fromMillis(security.now ?? Date.now())});
    tx.create(db.doc("clinicSessions/" + clinicSessionId), {authUid: uid, active: true, role: "patient",
      patientTokenHash: createHash("sha256").update(bearer).digest("hex"),
      createdAt: Timestamp.fromMillis(security.now ?? Date.now()), expiresAt: Timestamp.fromMillis((security.now ?? Date.now()) + CLINIC_IDLE_MS)});
    for (const child of family.values()) tx.create(db.doc("familyAccess/" + uid + "/patients/" + child.id), {patientId: child.id, doctorId: current.doctorId});
    const root = family.get(current.patientId);
    if (!root) throw failedLogin();
    return clinicPatientSummary(root);
  });
  return {token: bearer, patient};
}

export const loginClinicPatient = onCall({secrets: [limiterKey], maxInstances: 2, concurrency: 8, memory: "512MiB", timeoutSeconds: 90},
  (request) => authenticateClinicPatient(getFirestore(), request.data,
    {enabled: enabled.value(), limiterSecret: limiterKey.value(), transportAddress: request.rawRequest.socket.remoteAddress ?? ""}));

export const getClinicSession = onCall(async (request) => {
  if (!enabled.value()) throw new HttpsError("failed-precondition", "El acceso seguro aún no está habilitado.");
  if (!request.data || typeof request.data !== "object" || Array.isArray(request.data) || Object.keys(request.data).length !== 0) throw denied();
  const token = await verifyClinicToken(getAuth(), request.rawRequest.get("authorization"));
  const db = getFirestore();
  return db.runTransaction(async (tx) => {
    const principal = await readClinicPrincipal(tx, db, token, Date.now(), false, true);
    const lease = await readClinicLease(tx, db, token);
    if (principal.role === "patient") {
      if (!principal.patientId) throw denied();
      const patient = await readClinicFamilyPatient(tx, db, principal, principal.patientId);
      return {principal, lease: {id: token.clinicSessionId, expiresAt: lease.expiresAt.toMillis()}, session: {type: "patient", patient: clinicPatientSummary(patient), loginEmail: principal.loginEmail}};
    }
    const profile = (await tx.get(db.doc("users/" + principal.userId))).data();
    return {principal, lease: {id: token.clinicSessionId, expiresAt: lease.expiresAt.toMillis()}, session: {type: "doctor", user: profile}};
  });
});
