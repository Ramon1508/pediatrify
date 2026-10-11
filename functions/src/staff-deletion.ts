import {createHash, randomUUID} from "node:crypto";
import {Auth, getAuth} from "firebase-admin/auth";
import {FieldValue, Firestore, getFirestore, Query} from "firebase-admin/firestore";
import {getStorage, Storage} from "firebase-admin/storage";
import {defineBoolean} from "firebase-functions/params";
import {HttpsError, onCall} from "firebase-functions/v2/https";
import {deleteStaffAccount, DeletionOperations, DeletionTarget, StaffPrincipal} from "./staff-deletion-policy";
import {readClinicPrincipal, verifyClinicToken} from "./clinic-auth";
import {deleteClinicPatientData} from "./clinic-patient-deletion";
import {readStaffOperationLease} from "./clinic-leases";
import {validStaffId} from "./clinic-identifiers";

// Never enable against the current open rules. P01 must protect principals,
// jobs, identities, ownership and all business writes before activation.
const enabled = defineBoolean("STAFF_DELETION_ENABLED", {default: false});

type LogoBucket = Pick<ReturnType<Storage["bucket"]>, "getFiles">;
interface ParentDeletion {userId: string; lease: string}
interface RelatedDeletion {target: DeletionTarget; ops: DeletionOperations}

/**
 * Removes query results in bounded batches; repeatable after a partial failure.
 * @param {Query} query Documents exclusively within the authorized scope.
 * @param {Firestore} db Admin Firestore instance.
 * @return {Promise<void>} Resolves after all matching documents are removed.
 */
async function deleteMatches(query: Query, db: Firestore): Promise<void> {
  for (;;) {
    const page = await query.limit(400).get();
    if (page.empty) return;
    const batch = db.batch();
    page.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
}

/**
 * Ignores only an already absent Auth account, for retry after partial deletion.
 * @param {Function} operation Admin Auth operation.
 * @return {Promise<void>} Resolves for success or auth/user-not-found only.
 */
async function allowAbsentAccount(operation: () => Promise<unknown>): Promise<void> {
  try {
    await operation();
  } catch (error) {
    if ((error as {code?: string}).code !== "auth/user-not-found") throw error;
  }
}

/**
 * Deletes only objects under the canonical staff logo prefix, never logoPath.
 * @param {LogoBucket} bucket Default app bucket, not a client-selected bucket.
 * @param {string} userId Verified business ID.
 * @return {Promise<void>} Resolves after all listed versions are removed.
 */
async function deleteOwnedLogos(bucket: LogoBucket, userId: string): Promise<void> {
  const prefix = `logos/${userId}/`;
  for (;;) {
    const [files] = await bucket.getFiles({prefix, versions: true, maxResults: 100, autoPaginate: false});
    if (!files.length) return;
    if (files.some((file) => !file.name.startsWith(prefix))) {
      throw new HttpsError("failed-precondition", "El archivo no pertenece a la cuenta eliminada.");
    }
    // Wait for every deletion even when one fails, before releasing a lease.
    const results = await Promise.allSettled(files.map((file) => file.delete({ignoreNotFound: true})));
    const failure = results.find((result) => result.status === "rejected");
    if (failure?.status === "rejected") throw failure.reason;
  }
}

/**
 * Deletes appointment notifications before their link is removed, supporting retries.
 * @param {Query} query Appointments within the authorized deletion scope.
 * @param {Firestore} db Admin Firestore instance.
 * @return {Promise<void>} Resolves after notifications and appointments are removed.
 */
async function deleteAppointmentsWithNotifications(query: Query, db: Firestore): Promise<void> {
  for (;;) {
    const page = await query.limit(100).get();
    if (page.empty) return;
    for (const appointment of page.docs) {
      await deleteMatches(db.collection("notifications").where("appointmentId", "==", appointment.id), db);
      await appointment.ref.delete();
    }
  }
}

/**
 * Builds trusted adapters without initializing services, enabling isolated tests.
 * @param {Firestore} db Admin Firestore instance with P01 protections deployed.
 * @param {Auth} auth Admin Auth instance.
 * @param {string} lease Unique invocation ID for transaction ownership.
 * @param {Function} logoBucket Lazy default bucket, injectable for isolated tests.
 * @param {ParentDeletion} parent Internal parent reservation for cascading assistants.
 * @param {StaffPrincipal} actor Verified caller, required for administrator deletion.
 * @return {DeletionOperations} Server-only adapters; never pass client identities.
 */
export function createDeletionOperations(
  db: Firestore, auth: Auth, lease = randomUUID(),
  logoBucket: () => LogoBucket = () => getStorage().bucket(), parent?: ParentDeletion, actor?: StaffPrincipal,
): DeletionOperations {
  const jobRef = (userId: string) => db.doc(`staffDeletionJobs/${userId}`);
  const related: RelatedDeletion[] = [];
  return {
    enabled: true,
    resolveTarget: async (userId) => {
      if (!validStaffId(userId)) {
        throw new HttpsError("failed-precondition", "La cuenta no tiene una identidad válida.");
      }
      const savedJob = (await jobRef(userId).get()).data();
      // Jobs are server-owned tombstones. Preserve the original Auth UID even
      // after Auth/profile deletion; never locate an account by email on retry.
      if (savedJob) return savedJob.target as DeletionTarget;
      const profile = (await db.doc(`users/${userId}`).get()).data();
      if (!profile || !["admin", "doctor", "assistant"].includes(profile.role)) {
        throw new HttpsError("not-found", "La cuenta no está disponible para eliminar.");
      }
      const doctorId = profile.role === "assistant" ? profile.createdBy : userId;
      if (!validStaffId(doctorId)) {
        throw new HttpsError("failed-precondition", "La cuenta no tiene un Doctor asociado válido.");
      }
      const target: DeletionTarget = {userId, role: profile.role, doctorId, authUid: null};
      if (profile.firebaseUid) {
        const principal = (await db.doc(`securityPrincipals/${profile.firebaseUid}`).get()).data();
        if (!principal || principal.authUid !== profile.firebaseUid || principal.userId !== userId ||
              principal.role !== target.role || principal.doctorId !== (target.role === "admin" ? undefined : doctorId) || principal.active !== true) {
          throw new HttpsError("failed-precondition", "No se pudo verificar la cuenta de acceso.");
        }
        target.authUid = principal.authUid;
        // Verify existence before creating the job; no silent email fallback.
        await auth.getUser(principal.authUid);
      } else {
        if (profile.pending !== true || profile.profileComplete === true || typeof profile.email !== "string") {
          throw new HttpsError("failed-precondition", "No se pudo verificar la cuenta de acceso.");
        }
        // Pending invitation: ensure there is no unbound account using its
        // email. Never delete an arbitrary account found by email.
        try {
          await auth.getUserByEmail(profile.email.trim().toLowerCase());
        } catch (error) {
          if ((error as {code?: string}).code !== "auth/user-not-found") throw error;
          return target;
        }
        throw new HttpsError("failed-precondition", "La invitación tiene un acceso sin vínculo verificado.");
      }
      return target;
    },
    acquire: async (target) => db.runTransaction(async (transaction) => {
      // Recheck the caller in the transaction that reserves deletion. A caller
      // whose own deletion has begun cannot remove the remaining administrator.
      if (actor) {
        await readStaffOperationLease(transaction, db, actor);
        const principal = (await transaction.get(db.doc(`securityPrincipals/${actor.authUid}`))).data();
        const profile = (await transaction.get(db.doc(`users/${actor.userId}`))).data();
        const actorJob = await transaction.get(jobRef(actor.userId));
        if (!actor.active || !principal || principal.active !== true || principal.authUid !== actor.authUid ||
            principal.userId !== actor.userId || principal.role !== actor.role || principal.doctorId !== actor.doctorId ||
            !profile || profile.firebaseUid !== actor.authUid || profile.role !== actor.role ||
            profile.pending !== false || profile.profileComplete !== true || actorJob.exists) {
          throw new HttpsError("permission-denied", "Tu cuenta ya no tiene autorización para eliminar usuarios.");
        }
      }
      const ref = jobRef(target.userId);
      const previous = (await transaction.get(ref)).data();
      if (previous && (["userId", "role", "doctorId", "authUid"] as const)
        .some((key) => previous.target?.[key] !== target[key])) {
        throw new HttpsError("failed-precondition", "La cuenta cambió durante la operación.");
      }
      if (previous?.completed) return "completed";
      const rosterRef = db.doc("staffAdminControl/roster");
      let rosterRevision: number | undefined;
      if (target.role === "admin") {
        if (!actor || actor.role !== "admin" || actor.userId === target.userId || actor.authUid === target.authUid) {
          throw new HttpsError("permission-denied", "No puedes eliminar tu propia cuenta de administrador.");
        }
        const roster = (await transaction.get(rosterRef)).data();
        if (roster && (!Number.isSafeInteger(roster.revision) || roster.revision < 0)) {
          throw new HttpsError("failed-precondition", "No se pudo verificar el directorio de administradores.");
        }
        rosterRevision = (roster?.revision ?? 0) + 1;
        const admins = await transaction.get(db.collection("users").where("role", "==", "admin"));
        let remaining = 0;
        for (const admin of admins.docs) {
          const user = admin.data();
          if (admin.id === target.userId || user.pending !== false || user.profileComplete !== true ||
              typeof user.firebaseUid !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(user.firebaseUid)) continue;
          const authority = (await transaction.get(db.doc(`securityPrincipals/${user.firebaseUid}`))).data();
          const deletion = await transaction.get(jobRef(admin.id));
          if (!deletion.exists && authority?.active === true && authority.role === "admin" &&
              authority.authUid === user.firebaseUid && authority.userId === admin.id && authority.doctorId === undefined) remaining++;
        }
        if (!remaining) throw new HttpsError("failed-precondition", "Debe permanecer al menos un administrador activo con acceso al sistema.");
      }
      const emailJob = (await transaction.get(db.doc(`staffEmailChangeJobs/${target.userId}`))).data();
      const invitation = (await transaction.get(db.doc(`staffInvitations/${target.userId}`))).data();
      if (invitation?.status === "redeeming") {
        throw new HttpsError("aborted", "Completa el registro en curso antes de eliminar la cuenta.");
      }
      if (emailJob && !emailJob.completed) {
        throw new HttpsError("aborted", "La cuenta tiene un cambio de correo pendiente. Completa ese cambio antes de eliminarla.");
      }
      if (previous?.leaseUntil > Date.now()) {
        throw new HttpsError("aborted", "Esta baja ya se está procesando. Intenta nuevamente en unos minutos.");
      }
      if (target.role === "assistant") {
        const ownerJob = (await transaction.get(jobRef(target.doctorId))).data();
        if (parent) {
          if (parent.userId !== target.doctorId || ownerJob?.lease !== parent.lease || ownerJob.completed ||
              ownerJob.target?.role !== "doctor" || ownerJob.target?.userId !== parent.userId ||
              ownerJob.leaseUntil <= Date.now()) {
            throw new HttpsError("aborted", "La baja del Doctor requiere un nuevo intento.");
          }
        } else if (ownerJob) {
          throw new HttpsError("aborted", "El Doctor asociado ya está en proceso de baja.");
        }
        if (previous?.parentUserId && previous.parentUserId !== target.doctorId) {
          throw new HttpsError("failed-precondition", "La asociación del Asistente cambió durante la baja.");
        }
      }
      if (!previous) {
        // Recheck the protected identity within the same transaction that
        // reserves deletion. P01 writers must reject this job/tombstone.
        const profile = (await transaction.get(db.doc(`users/${target.userId}`))).data();
        if (!profile || profile.role !== target.role ||
              (target.role === "assistant" && profile.createdBy !== target.doctorId) ||
              (target.authUid ? profile.firebaseUid !== target.authUid :
                !!profile.firebaseUid || profile.pending !== true || profile.profileComplete === true)) {
          throw new HttpsError("failed-precondition", "La cuenta cambió durante la operación.");
        }
        if (target.authUid) {
          const principal = (await transaction.get(db.doc(`securityPrincipals/${target.authUid}`))).data();
          if (principal?.active !== true || principal.userId !== target.userId || principal.authUid !== target.authUid ||
                principal.role !== target.role || principal.doctorId !== (target.role === "admin" ? undefined : target.doctorId)) {
            throw new HttpsError("failed-precondition", "La cuenta cambió durante la operación.");
          }
        }
      }
      if (rosterRevision !== undefined) transaction.set(rosterRef, {revision: rosterRevision});
      if (target.authUid) {
        transaction.update(db.doc("securityPrincipals/" + target.authUid),
          {active: false, revokedAt: FieldValue.serverTimestamp()});
      }
      transaction.set(ref, {
        target, lease, leaseUntil: Date.now() + 600_000, completed: false,
        ...(parent ? {parentUserId: parent.userId} : {}),
      }, {merge: true});
      return "acquired";
    }),
    prepareRelatedStaff: async (target) => {
      if (target.role !== "doctor") return;
      // Single-field queries: no global user scan or compound index required.
      const users = await db.collection("users").where("createdBy", "==", target.userId).get();
      const jobs = await db.collection("staffDeletionJobs").where("parentUserId", "==", target.userId).get();
      const ids = new Set([
        ...users.docs.filter((doc) => doc.data().role === "assistant").map((doc) => doc.id),
        ...jobs.docs.map((doc) => doc.id),
      ]);
      for (const id of ids) {
        const ops = createDeletionOperations(db, auth, randomUUID(), logoBucket, {userId: target.userId, lease}, actor);
        const child = await ops.resolveTarget(id);
        if (child.role !== "assistant" || child.doctorId !== target.userId ||
            child.userId !== id || child.authUid === target.authUid && child.authUid !== null) {
          throw new HttpsError("failed-precondition", "No se pudo verificar un Asistente asociado.");
        }
        if (await ops.acquire(child) === "acquired") related.push({target: child, ops});
      }
    },
    disableAccess: async (target) => {
      if (target.authUid) {
        await allowAbsentAccount(() => auth.updateUser(target.authUid as string, {disabled: true}));
        await allowAbsentAccount(() => auth.revokeRefreshTokens(target.authUid as string));
      }
      for (const child of related) await child.ops.disableAccess(child.target);
    },
    invalidatePrincipal: async (target) => {
      if (target.authUid) {
        await db.doc(`securityPrincipals/${target.authUid}`).update({active: false, revokedAt: FieldValue.serverTimestamp()});
      }
      for (const child of related) await child.ops.invalidatePrincipal(child.target);
    },
    deleteBusinessData: async (target) => {
      for (const child of related) {
        await child.ops.deleteBusinessData(child.target);
        await child.ops.deleteAuth(child.target);
        await child.ops.complete(child.target);
      }
      if (target.role === "doctor") {
        for (;;) {
          const patients = await db.collection("patients").where("doctorId", "==", target.userId).limit(100).get();
          if (patients.empty) break;
          for (const patient of patients.docs) {
            await deleteClinicPatientData(db, patient.id, target.userId);
          }
        }
      }
      if (target.role !== "admin") {
        await deleteAppointmentsWithNotifications(db.collection("appointments").where("doctorId", "==", target.userId), db);
        await deleteOwnedLogos(logoBucket(), target.userId);
      }
      await deleteMatches(db.collection("notifications").where("recipientId", "==", target.userId), db);
      // Capabilities and pending email claims must not survive deletion.
      await deleteMatches(db.collection("staffInvitationIssueJobs").where("userId", "==", target.userId), db);
      await db.runTransaction(async (tx) => {
        const ref = db.doc("staffInvitations/" + target.userId);
        const invitation = (await tx.get(ref)).data();
        const reservationRef = typeof invitation?.email === "string" ?
          db.doc("staffEmailReservations/" + createHash("sha256").update(invitation.email).digest("hex")) : null;
        const reservation = reservationRef ? (await tx.get(reservationRef)).data() : undefined;
        if (invitation?.userId === target.userId) {
          if (typeof invitation.tokenHash === "string" && /^[a-f0-9]{64}$/.test(invitation.tokenHash)) tx.delete(db.doc("staffInvitationTokens/" + invitation.tokenHash));
          if (reservationRef && reservation?.userId === target.userId && reservation.kind === "invitation") tx.delete(reservationRef);
          tx.delete(ref);
        }
      });
      // Schedule and print settings reside in users: removed on completion.
      // Preserve audit logs, global counters and server revocation tombstones.
    },
    deleteAuth: async (target) => {
      if (target.authUid) await allowAbsentAccount(() => auth.deleteUser(target.authUid as string));
    },
    complete: async (target) => db.runTransaction(async (transaction) => {
      const ref = jobRef(target.userId);
      const job = (await transaction.get(ref)).data();
      if (job?.lease !== lease) throw new HttpsError("aborted", "La baja requiere un nuevo intento.");
      transaction.delete(db.doc(`users/${target.userId}`));
      for (const collection of ["staffDirectory", "doctorProfiles", "schedules"]) transaction.delete(db.doc(collection + "/" + target.userId));
      transaction.update(ref, {completed: true, leaseUntil: 0, completedAt: FieldValue.serverTimestamp()});
    }),
    release: async (target) => {
      // Release every child reservation before the parent, even after a failure.
      await Promise.allSettled(related.map((child) => child.ops.release(child.target)));
      await db.runTransaction(async (transaction) => {
        const ref = jobRef(target.userId);
        const job = (await transaction.get(ref)).data();
        if (job?.lease === lease && !job.completed) transaction.update(ref, {leaseUntil: 0});
      });
    },
  };
}

export const deleteStaff = onCall({region: "us-central1", timeoutSeconds: 540}, async (request) => {
  if (!enabled.value()) {
    throw new HttpsError("failed-precondition", "La baja definitiva todavía no está habilitada.");
  }
  // onCall validates the signature; explicitly check revocation/disabled status.
  const header = request.rawRequest.headers.authorization;
  if (!request.auth || !header?.startsWith("Bearer ")) {
    throw new HttpsError("unauthenticated", "Inicia sesión para eliminar una cuenta.");
  }
  const auth = getAuth();
  let authUid: string;
  try {
    const verified = await auth.verifyIdToken(header.slice(7), true);
    if (verified.uid !== request.auth.uid) throw new Error("Identity mismatch");
    authUid = verified.uid;
  } catch {
    throw new HttpsError("unauthenticated", "Tu sesión ya no es válida. Inicia sesión nuevamente.");
  }
  const db = getFirestore();
  const currentToken = await verifyClinicToken(auth, header);
  const principal = await db.runTransaction((tx) => readClinicPrincipal(tx, db, currentToken));
  if (principal.role === "patient" || !principal.userId || principal.authUid !== authUid) {
    throw new HttpsError("permission-denied", "Tu cuenta no tiene autorización para esta operación.");
  }
  const actor: StaffPrincipal = {...principal, role: principal.role, userId: principal.userId, clinicSessionId: currentToken.clinicSessionId};
  const actorProfile = (await db.doc(`users/${actor.userId}`).get()).data();
  if (!actorProfile || actorProfile.firebaseUid !== authUid || actorProfile.role !== actor.role ||
      actorProfile.pending !== false || actorProfile.profileComplete !== true) {
    throw new HttpsError("permission-denied", "Completa un perfil autorizado antes de eliminar cuentas.");
  }
  try {
    return await deleteStaffAccount(request.data, actor, createDeletionOperations(db, auth, randomUUID(), undefined, undefined, actor));
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    // Log a code only; never email, token, patient data or raw Firebase errors.
    console.error("staff-deletion-failed", (error as {code?: string}).code ?? "unknown");
    throw new HttpsError("internal", "No se completó la baja. La cuenta puede estar bloqueada; vuelve a intentar.");
  }
});
