import {createHash, randomBytes, randomUUID} from "node:crypto";
import {Auth, getAuth} from "firebase-admin/auth";
import {DocumentData, FieldValue, Firestore, Transaction, getFirestore} from "firebase-admin/firestore";
import {defineBoolean} from "firebase-functions/params";
import {CallableRequest, HttpsError, onCall} from "firebase-functions/v2/https";
import {StaffPrincipal} from "./staff-deletion-policy";
import {readClinicPrincipal, verifyClinicToken} from "./clinic-auth";
import {writeClinicUserProjections} from "./clinic-data";
import {readStaffOperationLease} from "./clinic-leases";
import {validStaffId} from "./clinic-identifiers";

// P01 must protect metadata, registration and every competing writer before activation.
const enabled = defineBoolean("STAFF_INVITATIONS_ENABLED", {default: false});
export const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const validId = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const normalized = (value: string) => value.trim().toLowerCase();
const emailRef = (db: Firestore, email: string) => db.doc("staffEmailReservations/" + hash(email));
const unavailable = () => new HttpsError("failed-precondition", "El enlace no es válido o ya fue utilizado. Solicita una nueva invitación.");
const gated = (value: boolean) => {
  if (!value) throw new HttpsError("failed-precondition", "Las invitaciones seguras todavía no están habilitadas.");
};
const exact = (data: unknown, keys: string[]): data is Record<string, unknown> =>
  !!data && typeof data === "object" && !Array.isArray(data) && Object.keys(data).every((key) => keys.includes(key));
interface IssueInput {action: "create" | "resend"; operationId: string; name?: string; email?: string; userId?: string;
  role?: "admin" | "doctor" | "assistant"}
interface RegistrationProfile {sexo: number; phone: string; especialidad: string; cedula: string; cedulaEspecialidad: string; consultorios: string}

/** Validate a capability, never a caller-selected role or email.
 * @param {unknown} data Untrusted input.
 * @return {string} Token; never persisted or logged as plaintext.
 */
export function invitationToken(data: unknown): string {
  if (!exact(data, ["token"]) || typeof data.token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(data.token)) throw unavailable();
  return data.token;
}

/** Read fresh protected issuer authority before any mutation.
 * @param {Transaction} tx Transaction.
 * @param {Firestore} db Database.
 * @param {StaffPrincipal} actor Verified caller identity.
 * @return {Promise<DocumentData>} Issuer profile.
 */
async function issuer(tx: Transaction, db: Firestore, actor: StaffPrincipal): Promise<DocumentData> {
  await readStaffOperationLease(tx, db, actor);
  if (!actor.active || !validId(actor.authUid) || !validStaffId(actor.userId) || !["admin", "doctor"].includes(actor.role)) {
    throw new HttpsError("permission-denied", "Tu cuenta no puede gestionar invitaciones.");
  }
  const principal = (await tx.get(db.doc("securityPrincipals/" + actor.authUid))).data();
  const user = (await tx.get(db.doc("users/" + actor.userId))).data();
  const deletion = await tx.get(db.doc("staffDeletionJobs/" + actor.userId));
  const change = (await tx.get(db.doc("staffEmailChangeJobs/" + actor.userId))).data();
  if (!principal || !user || principal.active !== true || principal.authUid !== actor.authUid ||
      principal.userId !== actor.userId || principal.role !== actor.role || principal.doctorId !== actor.doctorId ||
      user.firebaseUid !== actor.authUid || user.role !== actor.role || user.pending !== false || user.profileComplete !== true ||
      (actor.role === "doctor" && actor.doctorId !== actor.userId) || deletion.exists || (change && !change.completed)) {
    throw new HttpsError("permission-denied", "Tu cuenta ya no tiene autorización para invitar.");
  }
  return user;
}

/** Issue or rotate one protected invitation; never duplicate a pending user.
 * @param {Firestore} db Database.
 * @param {Auth} auth Admin Auth.
 * @param {StaffPrincipal} actor Verified issuer.
 * @param {unknown} data Untrusted request.
 * @param {boolean} isEnabled Activation gate.
 * @param {number} now Server clock, injectable in synthetic tests.
 * @return {Promise<object>} New capability and recipient snapshot.
 */
export async function issueInvitation(db: Firestore, auth: Auth, actor: StaffPrincipal, data: unknown,
  isEnabled: boolean, now = Date.now()) {
  gated(isEnabled);
  if (!exact(data, ["action", "operationId", "name", "email", "userId", "role"]) || !validId(data.operationId) ||
      !["create", "resend"].includes(data.action as string)) throw new HttpsError("invalid-argument", "Revisa los datos de la invitación.");
  const input = data as unknown as IssueInput;
  if (input.action === "create" ? input.userId !== undefined || typeof input.name !== "string" || !input.name.trim() ||
      input.name.length > 200 || typeof input.email !== "string" || input.email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()) ||
      (input.role !== undefined && !["admin", "doctor", "assistant"].includes(input.role)) :
    !validStaffId(input.userId) || input.email !== undefined || input.name !== undefined || input.role !== undefined) {
    throw new HttpsError("invalid-argument", "Ingresa un nombre y correo válidos.");
  }
  // P45: solo admin crea admin/doctor; el doctor crea asistentes; el admin también puede crear asistentes.
  if (actor.role !== "admin" && input.role !== undefined && input.role !== "assistant") {
    throw new HttpsError("permission-denied", "Tu cuenta no puede crear ese rol.");
  }
  await db.runTransaction((tx) => issuer(tx, db, actor));
  const issueRef = db.doc("staffInvitationIssueJobs/" + hash(actor.authUid + ":" + input.operationId));
  const previous = (await issueRef.get()).data();
  if (previous?.retired === true) throw new HttpsError("failed-precondition", "Esta operación terminó. Abre la gestión de invitaciones e inicia un intento nuevo.");
  const userId = input.action === "resend" ? (input.userId as string) : previous?.userId ?? randomUUID();
  if (!validStaffId(userId)) throw new HttpsError("failed-precondition", "No se pudo verificar la invitación.");
  const before = (await db.doc("users/" + userId).get()).data();
  const priorInvitation = (await db.doc("staffInvitations/" + userId).get()).data();
  const email = input.action === "create" ? normalized((input.email as string)) : before?.email;
  if (typeof email !== "string") throw unavailable();
  try {
    const account = await auth.getUserByEmail(email);
    // Only an interrupted registration for this protected invitation may reuse its reserved UID.
    if (!priorInvitation?.creationIntent || account.uid !== priorInvitation.authUid) {
      throw new HttpsError("already-exists", "Ese correo ya tiene una cuenta de acceso.");
    }
  } catch (error) {
    if ((error as {code?: string}).code !== "auth/user-not-found") throw error;
  }
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hash(token);
  const expiresAt = now + INVITATION_LIFETIME_MS;
  return db.runTransaction(async (tx) => {
    const operator = await issuer(tx, db, actor);
    const job = (await tx.get(issueRef)).data();
    if (job?.retired === true) throw new HttpsError("failed-precondition", "Esta operación terminó. Abre la gestión de invitaciones e inicia un intento nuevo.");
    const userRef = db.doc("users/" + userId);
    const target = (await tx.get(userRef)).data();
    const invRef = db.doc("staffInvitations/" + userId);
    const inv = (await tx.get(invRef)).data();
    const reservation = (await tx.get(emailRef(db, email))).data();
    const deleted = await tx.get(db.doc("staffDeletionJobs/" + userId));
    const emailJob = (await tx.get(db.doc("staffEmailChangeJobs/" + userId))).data();
    const duplicates = await tx.get(db.collection("users").where("email", "==", email).limit(2));
    const role = input.action === "resend" ? target?.role : input.role ?? (actor.role === "admin" ? "doctor" : "assistant");
    if (!["admin", "doctor", "assistant"].includes(role)) throw unavailable();
    if (actor.role !== "admin" && role !== "assistant") throw new HttpsError("permission-denied", "Tu cuenta no puede gestionar ese rol.");
    if (job && (job.userId !== userId || job.action !== input.action || job.email !== email || job.role !== role ||
        (input.action === "create" && job.name !== (input.name as string).trim()))) {
      throw new HttpsError("aborted", "Reintenta con los mismos datos de invitación.");
    }
    if (duplicates.docs.some((doc) => doc.id !== userId) || (reservation && reservation.userId !== userId)) {
      throw new HttpsError("already-exists", "Ese correo ya está registrado o tiene una invitación pendiente. Revisa el directorio y reenvía la invitación correspondiente.");
    }
    if (target && (target.pending !== true || target.profileComplete === true || target.role !== role ||
        (role === "assistant" && target.createdBy !== actor.userId) || target.email !== email ||
        (input.action === "create" && !job))) throw new HttpsError("already-exists", "Esa cuenta ya existe. Utiliza Reenviar invitación para una cuenta pendiente.");
    if (input.action === "resend" && !target) throw unavailable();
    if (deleted.exists || (emailJob && !emailJob.completed) || (inv && inv.leaseUntil > now)) {
      throw new HttpsError("aborted", "La cuenta tiene una operación en curso. Intenta nuevamente en unos minutos.");
    }
    if (inv?.status === "consumed" || (target?.firebaseUid && target.firebaseUid !== inv?.authUid)) throw unavailable();
    const authUid = inv?.authUid ?? randomUUID();
    if (!validId(authUid)) throw unavailable();
    const name = target?.name ?? (input.name as string).trim();
    if (!target) {
      const pendingUser = {uid: userId, name, email, role, createdBy: actor.userId,
        pending: true, profileComplete: false, createdAt: FieldValue.serverTimestamp()};
      tx.set(userRef, pendingUser);
      writeClinicUserProjections(tx, db, pendingUser);
    }
    if (inv?.tokenHash) tx.delete(db.doc("staffInvitationTokens/" + inv.tokenHash));
    tx.set(invRef, {userId, authUid, name, email, role, createdBy: target?.createdBy ?? actor.userId,
      issuerUserId: actor.userId, issuerAuthUid: actor.authUid, issuerRole: actor.role,
      tokenHash, expiresAt, status: "pending", creationIntent: inv?.creationIntent === true,
      leaseUntil: 0, issuedAt: FieldValue.serverTimestamp()});
    tx.set(db.doc("staffInvitationTokens/" + tokenHash), {userId});
    tx.set(emailRef(db, email), {userId, kind: "invitation", operationId: "invitation-" + userId});
    tx.set(issueRef, {userId, action: input.action, email, name, role, createdBy: actor.userId,
      completed: true, updatedAt: FieldValue.serverTimestamp()});
    return {userId, name, email, role, doctorName: operator.name ?? "", token, expiresAt};
  });
}

/** Validate latest token, current pending profile and issuer/owner.
 * @param {Transaction} tx Transaction.
 * @param {Firestore} db Database.
 * @param {string} token Capability.
 * @param {number} now Server time.
 * @param {boolean} allowConsumed Used solely to acknowledge the identical completed request.
 * @return {Promise<DocumentData>} Protected invitation.
 */
async function readInvitation(tx: Transaction, db: Firestore, token: string, now: number, allowConsumed = false): Promise<DocumentData> {
  const tokenHash = hash(token);
  const lookup = (await tx.get(db.doc("staffInvitationTokens/" + tokenHash))).data();
  if (!lookup || !validStaffId(lookup.userId)) throw unavailable();
  const inv = (await tx.get(db.doc("staffInvitations/" + lookup.userId))).data();
  const user = (await tx.get(db.doc("users/" + lookup.userId))).data();
  if (!inv || !user || inv.tokenHash !== tokenHash || inv.userId !== lookup.userId || !validId(inv.authUid) ||
      !["admin", "doctor", "assistant"].includes(inv.role) || user.role !== inv.role || user.email !== inv.email ||
      user.createdBy !== inv.createdBy || !validStaffId(inv.issuerUserId) ||
      (inv.role === "assistant" && inv.issuerUserId !== inv.createdBy)) throw unavailable();
  if (!Number.isFinite(inv.expiresAt) || now >= inv.expiresAt) {
    throw new HttpsError("deadline-exceeded", "Esta invitación caducó. Solicita una nueva al Administrador o a tu Doctor.", {reason: "invitation-expired"});
  }
  const issuerRole = inv.issuerRole ?? (inv.role === "assistant" ? "doctor" : "admin");
  if (!["admin", "doctor"].includes(issuerRole) || (inv.role !== "assistant" && issuerRole !== "admin")) throw unavailable();
  await issuer(tx, db, {authUid: inv.issuerAuthUid, userId: inv.issuerUserId, role: issuerRole,
    ...(issuerRole === "doctor" ? {doctorId: inv.createdBy} : {}), active: true});
  if ((await tx.get(db.doc("staffDeletionJobs/" + inv.userId))).exists) throw unavailable();
  const emailJob = (await tx.get(db.doc("staffEmailChangeJobs/" + inv.userId))).data();
  if (emailJob && !emailJob.completed) throw unavailable();
  if (inv.status === "consumed") {
    if (!allowConsumed || user.pending !== false || user.profileComplete !== true || user.firebaseUid !== inv.authUid) throw unavailable();
  } else if (!["pending", "redeeming"].includes(inv.status) || user.pending !== true || user.profileComplete === true || user.firebaseUid) {
    throw unavailable();
  }
  return inv;
}

/** Return only the data needed for this invitee's registration screen.
 * @param {Firestore} db Database.
 * @param {unknown} data Untrusted token request.
 * @param {boolean} isEnabled Gate.
 * @param {number} now Server time.
 * @return {Promise<object>} Minimal registration summary.
 */
export async function resolveInvitation(db: Firestore, data: unknown, isEnabled: boolean, now = Date.now()) {
  gated(isEnabled);
  const token = invitationToken(data);
  const inv = await db.runTransaction((tx) => readInvitation(tx, db, token, now));
  return {userId: inv.userId, name: inv.name, email: inv.email, role: inv.role, expiresAt: inv.expiresAt};
}

/** Validate bounded professional data, never role, identity, email or logo authority.
 * @param {unknown} value Untrusted profile.
 * @param {string} role Protected invitation role.
 * @return {RegistrationProfile} Canonical fields.
 */
function profileData(value: unknown, role: string): RegistrationProfile {
  if (!exact(value, ["sexo", "phone", "especialidad", "cedula", "cedulaEspecialidad", "consultorios"]) ||
      ![1, 2, 3].includes(value.sexo as number)) throw new HttpsError("invalid-argument", "Completa los datos del perfil.");
  for (const field of ["phone", "especialidad", "cedula", "cedulaEspecialidad", "consultorios"]) {
    if (typeof value[field] !== "string" || (value[field] as string).length > (field === "consultorios" ? 5000 : 300)) {
      throw new HttpsError("invalid-argument", "Revisa la longitud de los datos del perfil.");
    }
  }
  if (role === "doctor" ? !/^\d{10}$/.test(value.phone as string) || !(value.cedula as string).trim() || !(value.consultorios as string).trim() :
    value.sexo !== 3 || ["phone", "especialidad", "cedula", "cedulaEspecialidad", "consultorios"].some((field) => value[field] !== "")) {
    throw new HttpsError("invalid-argument", "Completa los campos correspondientes a tu registro.");
  }
  return {sexo: value.sexo as number, phone: value.phone as string, especialidad: value.especialidad as string,
    cedula: value.cedula as string, cedulaEspecialidad: value.cedulaEspecialidad as string, consultorios: value.consultorios as string};
}

/** Complete the one invited account; reserve, provision disabled, then consume atomically.
 * @param {Firestore} db Database.
 * @param {Auth} auth Admin Auth.
 * @param {unknown} data Untrusted capability/password/profile.
 * @param {boolean} isEnabled Gate.
 * @param {string} lease Invocation lease.
 * @param {number} now Server clock for tests; runtime always rechecks current time.
 * @return {Promise<object>} Confirmed account creation.
 */
export async function completeInvitation(db: Firestore, auth: Auth, data: unknown, isEnabled: boolean,
  lease = randomUUID(), now?: number) {
  gated(isEnabled);
  const currentTime = () => now ?? Date.now();
  if (!exact(data, ["token", "password", "profile", "operationId"]) || !validId(data.operationId) ||
      typeof data.password !== "string" || data.password.length > 256 ||
      !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>_]).{8,}$/.test(data.password)) {
    throw new HttpsError("invalid-argument", "Ingresa una contraseña de al menos 8 caracteres con mayúscula, minúscula, número y símbolo.");
  }
  const token = invitationToken({token: data.token});
  const password = data.password;
  const first = await db.runTransaction((tx) => readInvitation(tx, db, token, currentTime(), true));
  const profile = profileData(data.profile, first.role);
  const fingerprint = hash(JSON.stringify(profile));
  if (first.status === "consumed") {
    if (first.registrationOperationId !== data.operationId || first.profileFingerprint !== fingerprint) throw unavailable();
    return {registered: true};
  }
  // A pre-existing unrelated Auth identity is never deleted, linked or recreated.
  try {
    const account = await auth.getUserByEmail(first.email);
    if (!first.creationIntent || account.uid !== first.authUid) throw new HttpsError("already-exists", "Ese correo ya tiene una cuenta de acceso.");
  } catch (error) {
    if ((error as {code?: string}).code !== "auth/user-not-found") throw error;
  }
  const invRef = db.doc("staffInvitations/" + first.userId);
  const state = await db.runTransaction(async (tx) => {
    const inv = await readInvitation(tx, db, token, currentTime());
    const principal = (await tx.get(db.doc("securityPrincipals/" + inv.authUid))).data();
    const reservation = (await tx.get(emailRef(db, inv.email))).data();
    if (principal?.active === true || (principal && (principal.userId !== inv.userId || principal.authUid !== inv.authUid)) ||
        reservation?.userId !== inv.userId || reservation?.kind !== "invitation") throw unavailable();
    if (inv.leaseUntil > currentTime()) throw new HttpsError("aborted", "El registro ya se está procesando. Intenta nuevamente en unos minutos.");
    if (inv.status === "redeeming" && inv.profileFingerprint !== fingerprint) {
      throw new HttpsError("failed-precondition", "Reintenta el registro con los mismos datos del perfil.");
    }
    tx.update(invRef, {status: "redeeming", lease, leaseUntil: currentTime() + 600000,
      registrationOperationId: data.operationId, profileFingerprint: fingerprint, creationIntent: true});
    tx.set(db.doc("securityPrincipals/" + inv.authUid), {authUid: inv.authUid, userId: inv.userId, role: inv.role,
      ...(inv.role === "admin" ? {} : {doctorId: inv.role === "assistant" ? inv.createdBy : inv.userId}), active: false});
    return inv;
  });
  try {
    let account;
    try {
      account = await auth.getUser(state.authUid);
      if (!state.creationIntent || account.email !== state.email) throw unavailable();
    } catch (error) {
      if ((error as {code?: string}).code !== "auth/user-not-found") throw error;
      account = await auth.createUser({uid: state.authUid, email: state.email, password,
        displayName: state.name, emailVerified: false, disabled: true});
    }
    if (account.uid !== state.authUid || account.email !== state.email) throw unavailable();
    // Recheck protected lease and authority before enabling the provisional account.
    await db.runTransaction(async (tx) => {
      const inv = await readInvitation(tx, db, token, currentTime());
      const principal = (await tx.get(db.doc("securityPrincipals/" + inv.authUid))).data();
      if (inv.lease !== lease || inv.leaseUntil <= currentTime() || principal?.active !== false || principal.userId !== inv.userId) throw unavailable();
    });
    await auth.updateUser(state.authUid, {password, disabled: false});
    const confirmed = await auth.getUser(state.authUid);
    if (confirmed.disabled || confirmed.email !== state.email) throw unavailable();
    await db.runTransaction(async (tx) => {
      const inv = await readInvitation(tx, db, token, currentTime());
      const principalRef = db.doc("securityPrincipals/" + inv.authUid);
      const principal = (await tx.get(principalRef)).data();
      const reservation = (await tx.get(emailRef(db, inv.email))).data();
      const currentUser = (await tx.get(db.doc("users/" + inv.userId))).data();
      if (inv.lease !== lease || inv.leaseUntil <= currentTime() || inv.profileFingerprint !== fingerprint || principal?.active !== false ||
          principal.userId !== inv.userId || reservation?.userId !== inv.userId || reservation?.kind !== "invitation") throw unavailable();
      tx.update(db.doc("users/" + inv.userId), {...profile, firebaseUid: inv.authUid, phoneVerified: false,
        pending: false, profileComplete: true, updatedAt: FieldValue.serverTimestamp()});
      writeClinicUserProjections(tx, db, {...currentUser, ...profile, uid: inv.userId, firebaseUid: inv.authUid,
        pending: false, profileComplete: true, updatedAt: FieldValue.serverTimestamp()});
      tx.update(principalRef, {active: true});
      tx.update(invRef, {status: "consumed", leaseUntil: 0, consumedAt: FieldValue.serverTimestamp()});
      tx.delete(emailRef(db, inv.email));
    });
    return {registered: true};
  } catch (error) {
    await db.runTransaction(async (tx) => {
      const inv = (await tx.get(invRef)).data();
      if (inv?.lease === lease && inv.status === "redeeming") tx.update(invRef, {leaseUntil: 0});
    }).catch(() => undefined);
    throw error;
  }
}

/** Limit public capability requests without logging tokens or passwords.
 * @param {Firestore} db Database.
 * @param {string} address Server-derived requester address.
 * @return {Promise<void>} Resolves within the shared five-minute window.
 */
async function limitPublic(db: Firestore, address: string): Promise<void> {
  const ref = db.doc("staffInvitationRateLimits/" + hash(address));
  const now = Date.now();
  await db.runTransaction(async (tx) => {
    const value = (await tx.get(ref)).data();
    const fresh = !value || now - value.startedAt >= 300000;
    const count = fresh ? 0 : value.count;
    if (!Number.isInteger(count) || count >= 30) throw new HttpsError("resource-exhausted", "Espera unos minutos antes de intentar nuevamente.");
    tx.set(ref, {startedAt: fresh ? now : value.startedAt, count: count + 1});
  });
}

/** Translate failures without returning input, infrastructure details or credentials.
 * @param {unknown} error Failure.
 * @return {HttpsError} Safe client message.
 */
function readable(error: unknown): HttpsError {
  if (error instanceof HttpsError) return error;
  const code = (error as {code?: string}).code;
  if (code === "auth/email-already-exists") return new HttpsError("already-exists", "Ese correo ya tiene una cuenta de acceso.");
  return new HttpsError("internal", "No se pudo completar la operación. Reintenta con los mismos datos.");
}

export const manageStaffInvitation = onCall({region: "us-central1", timeoutSeconds: 90}, async (request) => {
  gated(enabled.value());
  const header = request.rawRequest.headers.authorization;
  if (!request.auth || !header?.startsWith("Bearer ")) throw new HttpsError("unauthenticated", "Inicia sesión para invitar.");
  const auth = getAuth();
  let uid: string;
  try {
    const token = await auth.verifyIdToken(header.slice(7), true);
    if (token.uid !== request.auth.uid) throw unavailable();
    uid = token.uid;
  } catch {
    throw new HttpsError("unauthenticated", "Inicia sesión nuevamente para invitar.");
  }
  const db = getFirestore();
  const currentToken = await verifyClinicToken(auth, header);
  const principal = await db.runTransaction((tx) => readClinicPrincipal(tx, db, currentToken));
  if (principal.role === "patient" || !principal.userId || principal.authUid !== uid) throw new HttpsError("permission-denied", "No puedes gestionar invitaciones.");
  const actor: StaffPrincipal = {...principal, role: principal.role, userId: principal.userId, clinicSessionId: currentToken.clinicSessionId};
  try {
    return await issueInvitation(db, auth, actor, request.data, true);
  } catch (error) {
    throw readable(error);
  }
});

/** Public token endpoints are gated and rate-limited; no email-based fallback.
 * @param {CallableRequest} request Callable request.
 * @param {boolean} completing Whether the request consumes the invitation.
 * @return {Promise<object>} Validated result.
 */
async function publicInvitation(request: CallableRequest, completing: boolean) {
  gated(enabled.value());
  const db = getFirestore();
  await limitPublic(db, request.rawRequest.ip ?? "unknown");
  try {
    return completing ? await completeInvitation(db, getAuth(), request.data, true) : await resolveInvitation(db, request.data, true);
  } catch (error) {
    throw readable(error);
  }
}
export const inspectStaffInvitation = onCall({region: "us-central1"}, (request) => publicInvitation(request, false));
export const redeemStaffInvitation = onCall({region: "us-central1", timeoutSeconds: 90}, (request) => publicInvitation(request, true));
