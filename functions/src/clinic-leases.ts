import {DecodedIdToken} from "firebase-admin/auth";
import {DocumentData, Firestore, Timestamp, Transaction} from "firebase-admin/firestore";
import {HttpsError} from "firebase-functions/v2/https";

export const CLINIC_IDLE_MS = 3600000;
const denied = () => new HttpsError("permission-denied", "Tu sesión terminó. Inicia sesión nuevamente.");

/** A verified Firebase token identifies the device lease; no caller-selected session ID.
 * @param {Transaction} tx Transaction containing the authority checks and writes.
 * @param {Firestore} db Database adapter.
 * @param {DecodedIdToken} token Verified Firebase token.
 * @param {number} now Trusted current instant in milliseconds.
 * @return {object} Result of the validated clinic operation.
 */
export async function readClinicLease(tx: Transaction, db: Firestore, token: Pick<DecodedIdToken, "uid"> & {clinicSessionId?: unknown}, now = Date.now()): Promise<DocumentData> {
  const id = token.clinicSessionId;
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw denied();
  const session = (await tx.get(db.doc("clinicSessions/" + id))).data();
  if (!session || session.authUid !== token.uid || session.active !== true || !(session.expiresAt instanceof Timestamp) ||
      session.expiresAt.toMillis() <= now) throw denied();
  return session;
}

/** Recheck the device lease of a staff callable inside its reserving transaction.
 * Internal invitation-owner checks have no device lease and validate protected authority instead.
 * @param {Transaction} tx Authorizing transaction.
 * @param {Firestore} db Database.
 * @param {object} actor Server-derived identity and signed lease identifier.
 * @return {Promise<void>} Resolves only while the provided device lease remains valid.
 */
export async function readStaffOperationLease(tx: Transaction, db: Firestore,
  actor: {authUid: string; role: string; clinicSessionId?: string}): Promise<void> {
  if (actor.clinicSessionId === undefined) return;
  const lease = await readClinicLease(tx, db, {uid: actor.authUid, clinicSessionId: actor.clinicSessionId});
  if (lease.role !== actor.role) throw denied();
}
