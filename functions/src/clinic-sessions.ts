import {randomBytes} from "node:crypto";
import {Auth, getAuth} from "firebase-admin/auth";
import {DocumentData, Firestore, Timestamp, getFirestore} from "firebase-admin/firestore";
import {HttpsError, onCall} from "firebase-functions/v2/https";
import {clinicPatientSummary, clinicSecurityEnabled, readClinicPrincipal, trustedClinicDoctor, verifyClinicToken} from "./clinic-auth";
import {CLINIC_IDLE_MS, readClinicLease} from "./clinic-leases";
import {clinicDenied, clinicInvalid, clinicObject, writeClinicUserProjections} from "./clinic-data";

/** Existing staff keep their Auth UID/password; each device obtains its own bounded lease.
 * @param {Firestore} db Database adapter.
 * @param {Auth} auth Admin Auth adapter.
 * @param {unknown} authorization Platform authorization header.
 * @param {number} now Trusted current instant in milliseconds.
 * @return {object} Result of the validated clinic operation.
 */
export async function openClinicStaffSession(db: Firestore, auth: Auth, authorization: unknown, now = Date.now()) {
  const token = await verifyClinicToken(auth, authorization);
  const sessionId = randomBytes(24).toString("hex");
  await db.runTransaction(async (tx) => {
    const principal = await readClinicPrincipal(tx, db, token, now, true);
    tx.create(db.doc("clinicSessions/" + sessionId), {authUid: token.uid, role: principal.role, active: true,
      createdAt: Timestamp.fromMillis(now), expiresAt: Timestamp.fromMillis(now + CLINIC_IDLE_MS)});
  });
  try {
    return {token: await auth.createCustomToken(token.uid, {clinicSessionId: sessionId})};
  } catch {
    await db.doc("clinicSessions/" + sessionId).update({active: false}); throw new HttpsError("unavailable", "No fue posible abrir la sesión. Intenta nuevamente.");
  }
}

export const startClinicStaffSession = onCall(async (request) => {
  if (!clinicSecurityEnabled.value()) throw new HttpsError("failed-precondition", "El acceso seguro aún no está habilitado.");
  if (!request.data || typeof request.data !== "object" || Array.isArray(request.data) || Object.keys(request.data).length) throw new HttpsError("invalid-argument", "Solicitud inválida.");
  return openClinicStaffSession(getFirestore(), getAuth(), request.rawRequest.get("authorization"));
});

export const touchClinicSession = onCall(async (request) => {
  if (!clinicSecurityEnabled.value()) throw new HttpsError("failed-precondition", "El acceso seguro aún no está habilitado.");
  const data = request.data;
  if (!data || typeof data !== "object" || Array.isArray(data) || Object.keys(data).some((key) => key !== "close") ||
      (data.close !== undefined && typeof data.close !== "boolean")) throw new HttpsError("invalid-argument", "Solicitud inválida.");
  const auth = getAuth();
  const token = await verifyClinicToken(auth, request.rawRequest.get("authorization"));
  const db = getFirestore();
  const now = Date.now();
  return db.runTransaction(async (tx) => {
    const session = await readClinicLease(tx, db, token, now);
    if (data.close !== true) await readClinicPrincipal(tx, db, token, now, false, true);
    const expiresAt = data.close === true ? session.expiresAt : Timestamp.fromMillis(now + CLINIC_IDLE_MS);
    tx.update(db.doc("clinicSessions/" + token.clinicSessionId), {active: data.close !== true, expiresAt, updatedAt: Timestamp.fromMillis(now)});
    if (data.close === true && session.role === "patient") tx.update(db.doc("securityPrincipals/" + token.uid), {active: false, revokedAt: Timestamp.fromMillis(now)});
    return {updated: true, expiresAt: expiresAt.toMillis()};
  });
});

export const getClinicFamily = onCall(async (request) => {
  if (!clinicSecurityEnabled.value()) throw new HttpsError("failed-precondition", "El acceso seguro aún no está habilitado.");
  clinicObject(request.data, []);
  const token = await verifyClinicToken(getAuth(), request.rawRequest.get("authorization"));
  const db = getFirestore();
  return db.runTransaction(async (tx) => {
    const principal = await readClinicPrincipal(tx, db, token);
    if (principal.role !== "patient") throw clinicDenied();
    const children = new Map<string, DocumentData>();
    for (const field of ["email", "secondaryEmail"]) {
      const sources = await tx.get(db.collection("patients").where("doctorId", "==", principal.doctorId).where(field, "==", principal.loginEmail).limit(101));
      if (sources.size > 100) throw clinicDenied();
      for (const source of sources.docs) children.set(source.id, source.data());
    }
    if (children.size > 100) throw clinicDenied();
    for (const child of [...children.keys()]) if ((await tx.get(db.doc("patientDeletionJobs/" + child))).exists) children.delete(child);
    for (const child of children.keys()) tx.set(db.doc("familyAccess/" + token.uid + "/patients/" + child), {patientId: child, doctorId: principal.doctorId});
    return {patients: [...children.values()].map(clinicPatientSummary)};
  });
});

export const completeClinicProfile = onCall(async (request) => {
  if (!clinicSecurityEnabled.value()) throw new HttpsError("failed-precondition", "El acceso seguro aún no está habilitado.");
  const data = clinicObject(request.data, ["sexo", "phone", "especialidad", "cedula", "cedulaEspecialidad", "consultorios", "logoPath"]);
  const token = await verifyClinicToken(getAuth(), request.rawRequest.get("authorization"));
  const db = getFirestore();
  return db.runTransaction(async (tx) => {
    const principal = await readClinicPrincipal(tx, db, token, Date.now(), false, true);
    if (!principal.userId || principal.role === "patient") throw clinicDenied();
    const user = (await tx.get(db.doc("users/" + principal.userId))).data();
    if (!user || user.profileComplete === true) throw clinicDenied();
    if (principal.role === "assistant" && user.createdBy) {
      const owner = (await tx.get(db.doc("users/" + user.createdBy))).data();
      if (owner?.role === "doctor") await trustedClinicDoctor(tx, db, user.createdBy);
      else {
        if (owner?.role !== "admin" || owner.profileComplete !== true || owner.pending === true || !owner.firebaseUid) throw clinicDenied();
        const authority = (await tx.get(db.doc("securityPrincipals/" + owner.firebaseUid))).data();
        if (authority?.active !== true || authority.role !== "admin" || authority.userId !== owner.uid ||
            authority.authUid !== owner.firebaseUid || (await tx.get(db.doc("staffDeletionJobs/" + owner.uid))).exists) throw clinicDenied();
      }
    }
    let changes: DocumentData = {};
    if (principal.role === "doctor") {
      if (![1, 2, 3].includes(data.sexo) || typeof data.phone !== "string" || data.phone.length < 10 ||
          typeof data.cedula !== "string" || !data.cedula.trim() || typeof data.consultorios !== "string" || !data.consultorios.trim()) throw clinicInvalid();
      for (const field of ["phone", "especialidad", "cedula", "cedulaEspecialidad", "consultorios", "logoPath"]) if (field in data && typeof data[field] !== "string") throw clinicInvalid();
      if (data.logoPath && (!data.logoPath.startsWith("logos/" + user.uid + "/") || data.logoPath.includes(".."))) throw clinicDenied();
      changes = {...data, printSettings: {...user.printSettings, usePreloadedLogo: !data.logoPath}};
    }
    const next = {...user, ...changes, pending: false, profileComplete: true, updatedAt: Timestamp.now()};
    tx.update(db.doc("users/" + user.uid), {...changes, pending: false, profileComplete: true, updatedAt: next.updatedAt});
    writeClinicUserProjections(tx, db, next);
    return {completed: true};
  });
});
