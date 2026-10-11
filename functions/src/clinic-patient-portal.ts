import {getAuth} from "firebase-admin/auth";
import {DocumentData, Firestore, Timestamp, getFirestore} from "firebase-admin/firestore";
import {CallableResponse, HttpsError, onCall} from "firebase-functions/v2/https";
import {clinicPatientSummary, clinicSecurityEnabled, readClinicFamilyPatient, readClinicPrincipal} from "./clinic-auth";
import {clinicDenied, clinicInvalid, clinicObject, validClinicId} from "./clinic-data";
import {CLINIC_IDLE_MS, readClinicLease} from "./clinic-leases";
import {readPatientBearer} from "./clinic-patient-token";
import {mutateClinicData, readClinicPublications} from "./clinic-operations";

/** Server-only portal contract. No Firebase Auth account/token is accepted or created.
 * @param {Firestore} db Database.
 * @param {unknown} input Opaque session plus allowlisted operation.
 * @param {number} now Server instant.
 * @return {Promise<DocumentData>} Minimal authorized result.
 */
export async function readPatientPortal(db: Firestore, input: unknown, now = Date.now()): Promise<DocumentData> {
  const request = clinicObject(input, ["sessionToken", "action", "data"]);
  const data = clinicObject(request.data ?? {}, ["patientId", "id", "doctorId", "recipientId", "filter", "pageSize", "cursor", "close"]);
  if (typeof request.action !== "string") throw clinicInvalid();
  return db.runTransaction(async (tx) => {
    const token = await readPatientBearer(tx, db, request.sessionToken, now);
    const principal = await readClinicPrincipal(tx, db, token, now);
    if (principal.role !== "patient" || !principal.patientId || !principal.doctorId) throw clinicDenied();
    const lease = await readClinicLease(tx, db, token, now);
    if (request.action === "session") {
      const child = await readClinicFamilyPatient(tx, db, principal, principal.patientId);
      return {principal, lease: {id: token.clinicSessionId, expiresAt: lease.expiresAt.toMillis()},
        session: {type: "patient", patient: clinicPatientSummary(child), loginEmail: principal.loginEmail}};
    }
    if (request.action === "touch") {
      if (data.close !== undefined && typeof data.close !== "boolean") throw clinicInvalid();
      const expiresAt = data.close === true ? lease.expiresAt : Timestamp.fromMillis(now + CLINIC_IDLE_MS);
      tx.update(db.doc("clinicSessions/" + token.clinicSessionId), {active: data.close !== true, expiresAt, updatedAt: Timestamp.fromMillis(now)});
      if (data.close === true) tx.update(db.doc("securityPrincipals/" + token.uid), {active: false, revokedAt: Timestamp.fromMillis(now)});
      return {updated: true, expiresAt: expiresAt.toMillis()};
    }
    if (data.doctorId !== undefined && data.doctorId !== principal.doctorId) throw clinicDenied();
    if (request.action === "doctor") {
      return {value: (await tx.get(db.doc("doctorProfiles/" + principal.doctorId))).data() ?? null};
    }
    if (request.action === "slots") {
      const slots = await tx.get(db.collection("appointmentSlots").where("doctorId", "==", principal.doctorId));
      return {value: slots.docs.map((item) => {
        const slot = item.data();
        return {id: item.id, doctorId: principal.doctorId, date: slot.date, time: slot.time};
      })};
    }
    if (request.action.startsWith("notification")) {
      if (data.recipientId !== undefined && data.recipientId !== principal.patientId) throw clinicDenied();
      let source = db.collection("notifications").where("doctorId", "==", principal.doctorId)
        .where("recipientId", "==", principal.patientId).where("recipientType", "==", "patient");
      const action = request.action;
      if (action === "notification.read") {
        if (!validClinicId(data.id)) throw clinicInvalid();
        const item = await tx.get(db.doc("notifications/" + data.id));
        const value = item.data();
        if (!value || value.doctorId !== principal.doctorId || value.recipientId !== principal.patientId || value.recipientType !== "patient") throw clinicDenied();
        tx.update(item.ref, {read: true});
        return {updated: true};
      }
      if (action === "notifications.count" || action === "notifications.read-all" || action === "notifications.read-cancelled" || data.filter === "unread") source = source.where("read", "==", false);
      if (action === "notifications.read-cancelled") source = source.where("type", "==", "appointment-cancelled");
      if (action.startsWith("notifications.read-")) source = source.limit(400);
      if (action === "notifications.page" || action === "notifications.latest") {
        if (data.filter !== undefined && !["all", "unread"].includes(data.filter)) throw clinicInvalid();
        const size = data.pageSize ?? 100;
        if (!Number.isInteger(size) || size < 1 || size > 100) throw clinicInvalid();
        source = source.orderBy("createdAt", "desc").limit(size);
        if (data.cursor !== undefined && data.cursor !== null) {
          if (!validClinicId(data.cursor)) throw clinicInvalid();
          const cursor = await tx.get(db.doc("notifications/" + data.cursor));
          const value = cursor.data();
          if (!value || value.doctorId !== principal.doctorId || value.recipientId !== principal.patientId || value.recipientType !== "patient") throw clinicDenied();
          source = source.startAfter(cursor);
        }
      } else if (!["notifications.count", "notifications.read-all", "notifications.read-cancelled"].includes(action)) throw clinicDenied();
      const items = await tx.get(source);
      if (action === "notifications.count") return {value: items.size};
      if (action.startsWith("notifications.read-")) {
        for (const item of items.docs) tx.update(item.ref, {read: true});
        return {value: items.docs.map((item) => item.id)};
      }
      return {value: items.docs.map((item) => ({...item.data(), id: item.id})), cursor: items.docs[items.docs.length - 1]?.id ?? null};
    }
    const family = new Map<string, DocumentData>();
    for (const field of ["email", "secondaryEmail"]) {
      const children = await tx.get(db.collection("patients").where("doctorId", "==", principal.doctorId).where(field, "==", principal.loginEmail).limit(101));
      if (children.size > 100) throw clinicDenied();
      for (const child of children.docs) family.set(child.id, child.data());
    }
    if (family.size > 100) throw clinicDenied();
    for (const child of [...family.keys()]) if ((await tx.get(db.doc("patientDeletionJobs/" + child))).exists) family.delete(child);
    if (request.action === "family") {
      for (const child of family.keys()) tx.set(db.doc("familyAccess/" + token.uid + "/patients/" + child), {patientId: child, doctorId: principal.doctorId});
      return {patients: [...family.values()].map(clinicPatientSummary)};
    }
    if (request.action === "patient") {
      if (!validClinicId(data.id) || !family.has(data.id)) throw clinicDenied();
      return {value: clinicPatientSummary(family.get(data.id) as DocumentData)};
    }
    if (request.action === "appointment") {
      if (!validClinicId(data.id)) throw clinicInvalid();
      const value = (await tx.get(db.doc("appointments/" + data.id))).data();
      if (!value) return {value: null};
      if (value.doctorId !== principal.doctorId || !family.has(value.patientId)) throw clinicDenied();
      return {value};
    }
    if (request.action === "appointments") {
      if (data.patientId !== undefined && !family.has(data.patientId)) throw clinicDenied();
      const appointments: DocumentData[] = [];
      for (const child of family.keys()) {
        if (data.patientId !== undefined && child !== data.patientId) continue;
        const items = await tx.get(db.collection("appointments").where("doctorId", "==", principal.doctorId).where("patientId", "==", child));
        appointments.push(...items.docs.map((item) => ({...item.data(), id: item.id})));
      }
      return {value: appointments};
    }
    throw clinicDenied();
  });
}

/** Dispatch only Patient operations; a bearer never authorizes a staff endpoint.
 * @param {Firestore} db Database.
 * @param {unknown} input Portal contract.
 * @return {Promise<DocumentData>} Authorized result.
 */
export async function operatePatientPortal(db: Firestore, input: unknown): Promise<DocumentData> {
  const request = clinicObject(input, ["sessionToken", "action", "data"]);
  if (!["save", "publications"].includes(request.action)) return readPatientPortal(db, input);
  const token = await db.runTransaction((tx) => readPatientBearer(tx, db, request.sessionToken));
  if (request.action === "publications") {
    return readClinicPublications(db, getAuth(), undefined, request.data,
      {enabled: true, patientToken: token});
  }
  const data = clinicObject(request.data, ["operation", "operationId", "entityId", "patientId", "data"]);
  if (!["appointment.create", "appointment.update", "appointment.delete"].includes(data.operation)) throw clinicDenied();
  return mutateClinicData(db, getAuth(), undefined, data, {enabled: true, encryptionSecret: "", patientToken: token});
}

export const patientPortal = onCall({timeoutSeconds: 180, maxInstances: 4}, async (request, response) => {
  if (!clinicSecurityEnabled.value()) throw new HttpsError("failed-precondition", "El acceso seguro aún no está habilitado.");
  if (!request.acceptsStreaming) return operatePatientPortal(getFirestore(), request.data);
  if (!response) throw clinicInvalid();
  const input = clinicObject(request.data, ["sessionToken", "action", "data"]);
  if (!["session", "family", "patient", "doctor", "slots", "appointment", "appointments", "notifications.count", "notifications.latest"].includes(input.action)) throw clinicDenied();
  return streamPatientPortal(getFirestore(), input, response);
});

/** Server Firestore listeners push scoped results; heartbeats validate, never extend inactivity.
 * @param {Firestore} db Database.
 * @param {DocumentData} input Validated stream operation.
 * @param {CallableResponse} response Streaming transport with disconnect signal.
 * @return {Promise<object>} Ends on disconnect/rotation/expiry; client may reconnect.
 */
export async function streamPatientPortal(db: Firestore, input: DocumentData, response: CallableResponse) {
  const session = await readPatientPortal(db, {...input, action: "session", data: {}});
  const principal = session.principal;
  let stopped = false;
  let running = false;
  let dirty = false;
  let last = "";
  const unsubscribe: (() => void)[] = [];
  let timer: ReturnType<typeof setInterval>;
  let deadline: ReturnType<typeof setTimeout>;
  return new Promise<{closed: boolean}>((resolve, reject) => {
    const finish = (error?: unknown) => {
      if (stopped) return;
      stopped = true;
      clearInterval(timer); clearTimeout(deadline);
      response.signal.removeEventListener("abort", abort);
      for (const stop of unsubscribe) stop();
      if (error) reject(error); else resolve({closed: true});
    };
    const abort = () => finish();
    const refresh = async () => {
      dirty = true;
      if (running || stopped) return;
      running = true;
      try {
        while (dirty && !stopped) {
          dirty = false;
          const value = await readPatientPortal(db, input);
          const serialized = JSON.stringify(value);
          if (!stopped && serialized !== last) {
            last = serialized;
            if (!await response.sendChunk(value)) finish();
          }
        }
      } catch (error) {
        finish(error);
      } finally {
        running = false;
      }
    };
    response.signal.addEventListener("abort", abort, {once: true});
    if (response.signal.aborted) {
      finish(); return;
    }
    const listen = (source: FirebaseFirestore.Query | FirebaseFirestore.DocumentReference) => {
      if (!stopped) {
        unsubscribe.push(source.onSnapshot(() => {
          void refresh();
        }, finish));
      }
    };
    try {
      listen(db.doc("securityPrincipals/" + principal.authUid));
      listen(db.doc("clinicSessions/" + session.lease.id));
      listen(db.doc("patientCredentials/" + principal.patientId));
      listen(db.doc("users/" + principal.doctorId));
      for (const field of ["email", "secondaryEmail"]) listen(db.collection("patients").where("doctorId", "==", principal.doctorId).where(field, "==", principal.loginEmail));
      if (["doctor"].includes(input.action)) listen(db.doc("doctorProfiles/" + principal.doctorId));
      if (input.action === "slots") listen(db.collection("appointmentSlots").where("doctorId", "==", principal.doctorId));
      if (["appointment", "appointments"].includes(input.action)) listen(db.collection("appointments").where("doctorId", "==", principal.doctorId));
      if (input.action.startsWith("notifications.")) listen(db.collection("notifications").where("doctorId", "==", principal.doctorId).where("recipientId", "==", principal.patientId).where("recipientType", "==", "patient"));
      timer = setInterval(() => {
        void refresh();
      }, 10000);
      deadline = setTimeout(() => finish(), 120000);
      void refresh();
    } catch (error) {
      finish(error);
    }
  });
}
