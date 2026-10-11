import {createHash} from "node:crypto";
import {DecodedIdToken} from "firebase-admin/auth";
import {Firestore, Transaction} from "firebase-admin/firestore";
import {HttpsError} from "firebase-functions/v2/https";
import {readClinicLease} from "./clinic-leases";

const validated = new WeakSet<object>();

/** Only an opaque server session can authorize a Patient; Firebase tokens cannot.
 * @param {object} token Internal identity.
 * @return {boolean} Validated by this process.
 */
export function isServerPatientToken(token: object): boolean {
  return validated.has(token);
}

/** Validate the in-memory browser bearer against its private digest and live lease.
 * @param {Transaction} tx Authorizing transaction.
 * @param {Firestore} db Database.
 * @param {unknown} value Opaque bearer, never a Firebase token.
 * @param {number} now Server instant.
 * @return {Promise<DecodedIdToken>} Internal identity; not issued by Firebase Auth.
 */
export async function readPatientBearer(tx: Transaction, db: Firestore, value: unknown, now = Date.now()): Promise<DecodedIdToken> {
  const denied = () => new HttpsError("unauthenticated", "Tu sesión terminó. Ingresa nuevamente.");
  if (typeof value !== "string" || !/^[a-f0-9]{48}\.[a-f0-9]{64}$/.test(value)) throw denied();
  const clinicSessionId = value.slice(0, 48);
  const lease = (await tx.get(db.doc("clinicSessions/" + clinicSessionId))).data();
  if (!lease || lease.role !== "patient" || lease.patientTokenHash !== createHash("sha256").update(value).digest("hex") ||
      typeof lease.authUid !== "string") throw denied();
  const token = {uid: lease.authUid, clinicSessionId, patientSessionVersion: 1} as unknown as DecodedIdToken;
  await readClinicLease(tx, db, token, now);
  validated.add(token);
  return token;
}
