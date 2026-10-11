import {createHash, randomUUID} from "node:crypto";
import {Auth, getAuth} from "firebase-admin/auth";
import {DocumentData, FieldValue, Firestore, Transaction, getFirestore} from "firebase-admin/firestore";
import {defineBoolean} from "firebase-functions/params";
import {HttpsError, onCall} from "firebase-functions/v2/https";
import {StaffPrincipal} from "./staff-deletion-policy";
import {readClinicPrincipal, verifyClinicToken} from "./clinic-auth";
import {writeClinicUserProjections} from "./clinic-data";
import {readStaffOperationLease} from "./clinic-leases";
import {validStaffId} from "./clinic-identifiers";

// Authority, jobs, reservations and every competing writer must be protected by P01.
const enabled = defineBoolean("STAFF_EMAIL_CHANGE_ENABLED", {default: false});
interface EmailRequest {userId: string; email: string; expectedEmail: string; operationId: string; name?: string}
const validId = (id: unknown): id is string => typeof id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(id);
const normalized = (email: string) => email.trim().toLowerCase();

/** Validates concurrency metadata, never client authority or Auth identity.
 * @param {unknown} data Untrusted callable payload.
 * @return {EmailRequest} Bounded, normalized fields.
 */
export function parseEmailRequest(data: unknown): EmailRequest {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new HttpsError("invalid-argument", "Revisa los datos del cambio de correo.");
  const value = data as Record<string, unknown>;
  if (Object.keys(value).some((key) => !["userId", "email", "expectedEmail", "operationId", "name"].includes(key)) ||
      !validStaffId(value.userId) || !validId(value.operationId) ||
      [value.email, value.expectedEmail].some((email) => typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) ||
      ("name" in value && (typeof value.name !== "string" || !value.name.trim() || value.name.length > 300))) {
    throw new HttpsError("invalid-argument", "Ingresa un nombre y correo válidos.");
  }
  return {userId: value.userId, operationId: value.operationId, email: normalized(value.email as string),
    expectedEmail: normalized(value.expectedEmail as string),
    ...("name" in value ? {name: (value.name as string).trim()} : {})};
}

/** Reads fresh protected identities and deletion markers in a transaction.
 * @param {Transaction} tx Transaction with all reads before writes.
 * @param {Firestore} db Standard Firestore instance.
 * @param {StaffPrincipal} actor Server-derived principal.
 * @param {EmailRequest} input Validated request.
 * @return {Promise<DocumentData>} Canonical target profile.
 */
async function checkContext(tx: Transaction, db: Firestore, actor: StaffPrincipal, input: EmailRequest): Promise<DocumentData> {
  await readStaffOperationLease(tx, db, actor);
  if (!actor.active || !validId(actor.authUid) || !validStaffId(actor.userId) || !["admin", "doctor", "assistant"].includes(actor.role)) {
    throw new HttpsError("permission-denied", "Tu cuenta no puede realizar esta operación.");
  }
  const authority = (await tx.get(db.doc(`securityPrincipals/${actor.authUid}`))).data();
  const operator = (await tx.get(db.doc(`users/${actor.userId}`))).data();
  if (!authority || authority.active !== true || authority.authUid !== actor.authUid || authority.userId !== actor.userId ||
      authority.role !== actor.role || authority.doctorId !== actor.doctorId || !operator || operator.firebaseUid !== actor.authUid ||
      operator.role !== actor.role || operator.pending !== false || operator.profileComplete !== true ||
      (actor.role === "doctor" && actor.doctorId !== actor.userId) ||
      (actor.role === "assistant" && actor.doctorId !== operator.createdBy)) {
    throw new HttpsError("permission-denied", "Tu sesión o perfil ya no tienen autorización.");
  }
  const target = (await tx.get(db.doc(`users/${input.userId}`))).data();
  const invitation = (await tx.get(db.doc(`staffInvitations/${input.userId}`))).data();
  if (invitation?.status === "redeeming") throw new HttpsError("aborted", "Completa el registro en curso antes de cambiar el correo.");
  const own = actor.userId === input.userId;
  const allowed = own ? actor.role === "admin" || actor.role === "assistant" :
    (actor.role === "admin" && ["admin", "doctor"].includes(target?.role)) ||
    (actor.role === "doctor" && target?.role === "assistant" && target.createdBy === actor.userId);
  if (!target || !allowed || (own && target.role !== actor.role) || (own && actor.role === "admin" && input.name !== undefined)) {
    throw new HttpsError("permission-denied", "No puedes modificar esta cuenta.");
  }
  if (!own && input.name && input.name.length > 200) throw new HttpsError("invalid-argument", "Ingresa un nombre de hasta 200 caracteres.");
  for (const id of new Set([actor.userId, input.userId, target.role === "assistant" ? target.createdBy : input.userId])) {
    if (!validStaffId(id)) throw new HttpsError("failed-precondition", "La asociación de la cuenta no es válida.");
    if ((await tx.get(db.doc(`staffDeletionJobs/${id}`))).exists) throw new HttpsError("failed-precondition", "La cuenta o su Doctor están en proceso de baja.");
  }
  if (target.role === "assistant") {
    const owner = (await tx.get(db.doc(`users/${target.createdBy}`))).data();
    if (!owner || !["doctor", "admin"].includes(owner.role) || owner.pending !== false || owner.profileComplete !== true || !validId(owner.firebaseUid)) {
      throw new HttpsError("failed-precondition", "El Doctor asociado no está disponible.");
    }
    const ownerAuthority = (await tx.get(db.doc(`securityPrincipals/${owner.firebaseUid}`))).data();
    if (!ownerAuthority || ownerAuthority.active !== true || ownerAuthority.authUid !== owner.firebaseUid ||
        ownerAuthority.userId !== target.createdBy || ownerAuthority.role !== owner.role ||
        ownerAuthority.doctorId !== (owner.role === "doctor" ? target.createdBy : undefined)) {
      throw new HttpsError("failed-precondition", "El Doctor asociado no está disponible.");
    }
  }
  if (target.firebaseUid) {
    if (!validId(target.firebaseUid) || target.pending !== false || target.profileComplete !== true) {
      throw new HttpsError("failed-precondition", "Completa el registro antes de cambiar el correo.");
    }
    const principal = (await tx.get(db.doc(`securityPrincipals/${target.firebaseUid}`))).data();
    if (!principal || principal.active !== true || principal.authUid !== target.firebaseUid || principal.userId !== input.userId ||
        principal.role !== target.role || (target.role !== "admin" && principal.doctorId !== (target.role === "doctor" ? input.userId : target.createdBy))) {
      throw new HttpsError("failed-precondition", "No se pudo verificar la cuenta de acceso.");
    }
    if (!own && target.firebaseUid === actor.authUid) throw new HttpsError("permission-denied", "La identidad de la cuenta no es válida.");
  } else if (own || target.pending !== true || target.profileComplete === true) {
    throw new HttpsError("failed-precondition", "No se pudo verificar la cuenta de acceso.");
  }
  return target;
}

/** Changes only the mapped UID's email, then atomically completes the profile/job.
 * @param {Firestore} db Admin Firestore, protected by P01 before activation.
 * @param {Auth} auth Admin Auth; never the browser's current user.
 * @param {StaffPrincipal} actor Verified actor.
 * @param {unknown} data Untrusted payload.
 * @param {boolean} isEnabled Activation gate, false by default in the callable.
 * @param {string} lease Unique invocation identity for retries/concurrency.
 * @return {Promise<object>} Confirmation only after both systems agree.
 */
export async function changeStaffEmail(db: Firestore, auth: Auth, actor: StaffPrincipal, data: unknown,
  isEnabled: boolean, lease = randomUUID()): Promise<{updated: true; pendingInvitation: boolean}> {
  if (!isEnabled) throw new HttpsError("failed-precondition", "El cambio de correo todavía no está habilitado.");
  const input = parseEmailRequest(data);
  const jobRef = db.doc(`staffEmailChangeJobs/${input.userId}`);
  const reservationRef = db.doc(`staffEmailReservations/${createHash("sha256").update(input.email).digest("hex")}`);
  const identity = await db.runTransaction(async (tx) => checkContext(tx, db, actor, input));
  // Auth uniqueness is checked before any reservation; no account is created or found by email as an identity fallback.
  try {
    const existing = await auth.getUserByEmail(input.email);
    if (!identity.firebaseUid || existing.uid !== identity.firebaseUid) throw new HttpsError("already-exists", "Ese correo ya está asociado a otra cuenta.");
  } catch (error) {
    if ((error as {code?: string}).code !== "auth/user-not-found") throw error;
  }
  if (!identity.firebaseUid && input.expectedEmail !== input.email) {
    try {
      await auth.getUserByEmail(input.expectedEmail);
      throw new HttpsError("failed-precondition", "La invitación tiene un acceso sin vínculo verificado.");
    } catch (error) {
      if ((error as {code?: string}).code !== "auth/user-not-found") throw error;
    }
  }
  let acquired = false;
  let operationId = input.operationId;
  let authUid: string | null = null;
  try {
    const state = await db.runTransaction(async (tx) => {
      const target = await checkContext(tx, db, actor, input);
      if (target.firebaseUid !== identity.firebaseUid || target.role !== identity.role || target.createdBy !== identity.createdBy) {
        throw new HttpsError("aborted", "La cuenta cambió. Abre la edición nuevamente.");
      }
      const job = (await tx.get(jobRef)).data();
      const reservation = (await tx.get(reservationRef)).data();
      const duplicates = await tx.get(db.collection("users").where("email", "==", input.email).limit(2));
      if (duplicates.docs.some((doc) => doc.id !== input.userId) || (reservation && reservation.userId !== input.userId)) {
        throw new HttpsError("already-exists", "Ese correo ya está asociado a otra cuenta.");
      }
      const same = job && job.email === input.email && job.expectedEmail === input.expectedEmail &&
        job.name === (input.name ?? null) && job.authUid === (target.firebaseUid ?? null) && job.role === target.role &&
        job.doctorId === (target.role === "assistant" ? target.createdBy : input.userId);
      if (job && !job.completed && !same) throw new HttpsError("failed-precondition", "Hay un cambio pendiente. Reintenta con los mismos datos.");
      if (same && job.completed) {
        if (normalized(target.email) !== input.email) throw new HttpsError("aborted", "La cuenta cambió después de esta operación.");
        return {completed: true, authUid: target.firebaseUid ?? null};
      }
      if (job && !job.completed && job.leaseUntil > Date.now()) throw new HttpsError("aborted", "El cambio ya se está procesando. Reintenta en unos minutos.");
      if (typeof target.email !== "string" || normalized(target.email) !== input.expectedEmail || input.email === input.expectedEmail) {
        throw new HttpsError("aborted", "El correo cambió. Abre la edición nuevamente.");
      }
      operationId = same ? job.operationId : input.operationId;
      tx.set(jobRef, {...input, operationId, name: input.name ?? null, authUid: target.firebaseUid ?? null, role: target.role,
        doctorId: target.role === "assistant" ? target.createdBy : input.userId,
        completed: false, lease, leaseUntil: Date.now() + 600_000, updatedAt: FieldValue.serverTimestamp()});
      tx.set(reservationRef, {userId: input.userId, operationId});
      return {completed: false, authUid: target.firebaseUid ?? null};
    });
    authUid = state.authUid;
    if (state.completed) return {updated: true, pendingInvitation: !authUid};
    acquired = true;
    const job = (await jobRef.get()).data();
    if (job?.lease !== lease || job.leaseUntil <= Date.now()) throw new HttpsError("aborted", "El cambio requiere un nuevo intento.");
    if (authUid) {
      const account = await auth.getUser(authUid);
      if (account.uid !== authUid || account.disabled || !account.email ||
          ![input.expectedEmail, input.email].includes(normalized(account.email))) {
        throw new HttpsError("failed-precondition", "La cuenta de acceso cambió. Contacta al responsable del sistema.");
      }
      if (normalized(account.email) !== input.email) {
        // Preserve UID, password, roles, claims and business references. The new email is not pre-verified.
        await auth.updateUser(authUid, {email: input.email, emailVerified: false});
      }
      const confirmed = await auth.getUser(authUid);
      if (normalized(confirmed.email ?? "") !== input.email) throw new HttpsError("aborted", "No se confirmó el cambio de correo.");
    }
    await db.runTransaction(async (tx) => {
      const target = await checkContext(tx, db, actor, input);
      const job = (await tx.get(jobRef)).data();
      const reservation = (await tx.get(reservationRef)).data();
      if (job?.lease !== lease || job.authUid !== (target.firebaseUid ?? null) || job.role !== target.role ||
          job.doctorId !== (target.role === "assistant" ? target.createdBy : input.userId) ||
          normalized(target.email) !== input.expectedEmail || reservation?.userId !== input.userId || reservation.operationId !== operationId) {
        throw new HttpsError("aborted", "No se completó la sincronización. Reintenta con los mismos datos.");
      }
      const invitationRef = db.doc(`staffInvitations/${input.userId}`);
      const invitation = (await tx.get(invitationRef)).data();
      const oldReservationRef = db.doc(`staffEmailReservations/${createHash("sha256").update(input.expectedEmail).digest("hex")}`);
      const oldReservation = (await tx.get(oldReservationRef)).data();
      tx.update(db.doc(`users/${input.userId}`), {email: input.email, ...(input.name === undefined ? {} : {name: input.name}), updatedAt: FieldValue.serverTimestamp()});
      writeClinicUserProjections(tx, db, {...target, uid: input.userId, email: input.email,
        ...(input.name === undefined ? {} : {name: input.name}), updatedAt: FieldValue.serverTimestamp()});
      tx.update(jobRef, {completed: true, leaseUntil: 0, completedAt: FieldValue.serverTimestamp()});
      if (!authUid && invitation) {
        if (typeof invitation.tokenHash === "string" && /^[a-f0-9]{64}$/.test(invitation.tokenHash)) tx.delete(db.doc("staffInvitationTokens/" + invitation.tokenHash));
        tx.update(invitationRef, {status: "revoked", email: input.email, leaseUntil: 0});
        if (oldReservation?.userId === input.userId && oldReservation.kind === "invitation") tx.delete(oldReservationRef);
        tx.set(reservationRef, {userId: input.userId, kind: "invitation", operationId: "invitation-" + input.userId});
      } else {
        tx.delete(reservationRef);
      }
    });
    return {updated: true, pendingInvitation: !authUid};
  } catch (error) {
    if (acquired) {
      await db.runTransaction(async (tx) => {
        const job = (await tx.get(jobRef)).data();
        if (job?.lease !== lease || job.completed) return;
        if ((error as {code?: string}).code === "auth/email-already-exists") {
          tx.delete(jobRef);
          tx.delete(reservationRef);
        } else {
          tx.update(jobRef, {leaseUntil: 0});
        }
      }).catch(() => undefined);
    }
    throw error;
  }
}

export const updateStaffEmail = onCall({region: "us-central1", timeoutSeconds: 90}, async (request) => {
  if (!enabled.value()) throw new HttpsError("failed-precondition", "El cambio de correo todavía no está habilitado.");
  const header = request.rawRequest.headers.authorization;
  if (!request.auth || !header?.startsWith("Bearer ")) throw new HttpsError("unauthenticated", "Inicia sesión para cambiar un correo.");
  const auth = getAuth();
  let authUid: string;
  try {
    const token = await auth.verifyIdToken(header.slice(7), true);
    if (token.uid !== request.auth.uid) throw new Error("Identity mismatch");
    authUid = token.uid;
  } catch {
    throw new HttpsError("unauthenticated", "Tu sesión ya no es válida. Inicia sesión nuevamente.");
  }
  const db = getFirestore();
  const currentToken = await verifyClinicToken(auth, header);
  const principal = await db.runTransaction((tx) => readClinicPrincipal(tx, db, currentToken));
  if (principal.role === "patient" || !principal.userId || principal.authUid !== authUid) throw new HttpsError("permission-denied", "Tu cuenta no puede realizar esta operación.");
  const actor: StaffPrincipal = {...principal, role: principal.role, userId: principal.userId, clinicSessionId: currentToken.clinicSessionId};
  try {
    return await changeStaffEmail(db, auth, actor, request.data, true);
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    const code = (error as {code?: string}).code;
    if (code === "auth/email-already-exists") throw new HttpsError("already-exists", "Ese correo ya está asociado a otra cuenta.");
    console.error("staff-email-change-failed", code ?? "unknown");
    throw new HttpsError("internal", "No se completó el cambio. Reintenta con los mismos datos; si cambiaste tu propio correo, puede ser necesario iniciar sesión con el nuevo correo y tu contraseña actual.");
  }
});
