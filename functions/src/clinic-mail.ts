import {createHash, randomUUID} from "node:crypto";
import {Auth, getAuth} from "firebase-admin/auth";
import {DocumentData, Firestore, Timestamp, getFirestore} from "firebase-admin/firestore";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as nodemailer from "nodemailer";
import {environments} from "./environments/environment-functions";
import {clinicSecurityEnabled, readClinicPrincipal, trustedClinicDoctor, verifyClinicToken} from "./clinic-auth";
import {clinicClock, clinicDenied, clinicInvalid, clinicObject, validClinicId} from "./clinic-data";
import {validStaffId} from "./clinic-identifiers";
import {decryptPatientPassword, patientCredentialEncryptionKey} from "./patient-credentials";

type MailSender = (mail: {to: string; subject: string; html: string}) => Promise<unknown>;
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"}[char] as string));

/** Lazy transport: loading a module or running isolated tests sends no mail.
 * @param {object} mail Validated mail for this operation.
 * @return {object} Result of the validated clinic operation.
 */
export const sendClinicSmtp: MailSender = async (mail) => {
  const transport = nodemailer.createTransport(environments.smtp);
  const result = await transport.sendMail({from: environments.smtp.auth.user, ...mail});
  if (!result.accepted?.length || result.rejected?.length) throw new Error("delivery-not-confirmed");
};

/** Only current stored destinations/content and a validated operation are deliverable.
 * @param {Firestore} db Database adapter.
 * @param {Auth} auth Admin Auth adapter.
 * @param {unknown} authorization Platform authorization header.
 * @param {unknown} input Untrusted operation payload.
 * @param {object} security Validated security for this operation.
 * @param {object} send Validated send for this operation.
 * @return {object} Result of the validated clinic operation.
 */
export async function deliverClinicEmail(db: Firestore, auth: Auth, authorization: unknown, input: unknown,
  security: {enabled: boolean; encryptionSecret: string; now?: number}, send: MailSender = sendClinicSmtp): Promise<DocumentData> {
  if (!security.enabled) throw new HttpsError("failed-precondition", "El envío seguro aún no está habilitado.");
  const request = clinicObject(input, ["kind", "patientId", "userId", "operationId", "creationOperationId", "token"]);
  if (!validClinicId(request.operationId) || !["patient-access", "invitation"].includes(request.kind)) throw clinicInvalid();
  const token = await verifyClinicToken(auth, authorization);
  const now = security.now ?? Date.now();
  const context = () => db.runTransaction(async (tx) => {
    const actor = await readClinicPrincipal(tx, db, token, now);
    const caller = actor.userId ? (await tx.get(db.doc("users/" + actor.userId))).data() : undefined;
    if (request.kind === "patient-access") {
      if (!validClinicId(request.patientId) || request.userId !== undefined || request.token !== undefined || !["doctor", "assistant"].includes(actor.role)) throw clinicDenied();
      const patient = (await tx.get(db.doc("patients/" + request.patientId))).data();
      const credential = (await tx.get(db.doc("patientCredentials/" + request.patientId))).data();
      const doctor = await trustedClinicDoctor(tx, db, actor.doctorId);
      if (!patient || !credential || patient.doctorId !== actor.doctorId || credential.doctorId !== actor.doctorId ||
          (await tx.get(db.doc("patientDeletionJobs/" + request.patientId))).exists) throw clinicDenied();
      if (actor.role === "assistant") {
        if (!validClinicId(request.creationOperationId)) throw clinicDenied();
        const creation = (await tx.get(db.doc("patientCreationOperations/" + digest([token.uid, request.creationOperationId])))).data();
        if (!creation || creation.actorUid !== token.uid || creation.patientId !== patient.id || creation.doctorId !== actor.doctorId ||
            creation.credentialEpoch !== credential.credentialEpoch || credential.credentialVersion !== 1) throw clinicDenied();
      }
      const recipients = [...new Set([patient.email, patient.secondaryEmail].filter(Boolean))] as string[];
      if (!recipients.length || recipients.some((email) => !credential.loginEmails?.includes(email))) throw clinicDenied();
      const password = decryptPatientPassword(credential, security.encryptionSecret);
      return {recipients, subject: "Acceso a Lilcare", html: `<p>Acceso para ${escape(`${patient.name} ${patient.lastName}`.trim())}, consultorio de ${escape(doctor.name ?? "")}.</p><p>Contraseña: <strong>${escape(password)}</strong></p><p><a href="https://lilcare.com.mx/patient-login">Acceso paciente</a></p>`,
        revision: credential.credentialEpoch + ":" + credential.credentialVersion};
    }
    if (!validStaffId(request.userId) || request.patientId !== undefined || request.creationOperationId !== undefined ||
        typeof request.token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(request.token)) throw clinicDenied();
    const invitation = (await tx.get(db.doc("staffInvitations/" + request.userId))).data();
    const user = (await tx.get(db.doc("users/" + request.userId))).data();
    const tokenHash = createHash("sha256").update(request.token).digest("hex");
    const managed = actor.role === "admin" || (actor.role === "doctor" && user?.role === "assistant" && user.createdBy === actor.userId);
    if (!managed || !invitation || !user || user.pending !== true || user.profileComplete === true || invitation.status !== "pending" ||
        invitation.tokenHash !== tokenHash || invitation.expiresAt <= now || user.email !== invitation.email ||
        (await tx.get(db.doc("staffDeletionJobs/" + request.userId))).exists) throw clinicDenied();
    return {recipients: [invitation.email] as string[], subject: "Invitación a Lilcare",
      html: `<p>${escape(invitation.name)}, ${escape(caller?.name ?? "")} te invita a Lilcare.</p><p><a href="https://lilcare.com.mx/setup-profile#invitation=${encodeURIComponent(request.token)}">Completar registro</a></p>`, revision: tokenHash};
  });
  const initial = await context();
  const results: {destination: "primary" | "secondary"; sent: boolean}[] = [];
  for (let index = 0; index < initial.recipients.length; index++) {
    const destination = index === 0 ? "primary" : "secondary";
    const to = initial.recipients[index];
    const ref = db.doc("clinicEmailDeliveries/" + digest([token.uid, request.operationId, request.kind, request.patientId ?? request.userId, initial.revision, to]));
    const lease = randomUUID();
    const acquired = await db.runTransaction(async (tx) => {
      await readClinicPrincipal(tx, db, token, now);
      const previous = (await tx.get(ref)).data();
      if (previous?.sent === true) return false;
      if (previous?.leaseUntil > now) throw new HttpsError("aborted", "El envío sigue en curso. Espera antes de reintentar.");
      const counterRef = db.doc("emailCounter/daily");
      const old = (await tx.get(counterRef)).data();
      const date = clinicClock(now).date;
      const count = old?.date === date ? old.count ?? 0 : 0;
      const monthCount = old?.month === date.slice(0, 7) ? old.monthCount ?? 0 : 0;
      if (count >= 200 || monthCount >= 6000) throw new HttpsError("resource-exhausted", "Se alcanzó el límite de correos. Intenta nuevamente más tarde.");
      tx.set(counterRef, {date, month: date.slice(0, 7), count: count + 1, monthCount: monthCount + 1});
      tx.set(ref, {actorUid: token.uid, kind: request.kind, sent: false, lease, leaseUntil: now + 90000, updatedAt: Timestamp.fromMillis(now)});
      return true;
    });
    if (!acquired) {
      results.push({destination, sent: true}); continue;
    }
    let sent = false;
    try {
      const latest = await context();
      if (latest.revision !== initial.revision || !latest.recipients.includes(to)) throw clinicDenied();
      await send({to, subject: latest.subject, html: latest.html});
      sent = true;
    } catch {/* Only bounded statuses leave this endpoint, never SMTP responses or credentials. */}
    await db.runTransaction(async (tx) => {
      const job = (await tx.get(ref)).data();
      if (job?.lease === lease) tx.update(ref, {sent, leaseUntil: 0, updatedAt: Timestamp.fromMillis(now)});
    });
    results.push({destination, sent});
  }
  return {success: results.every((result) => result.sent), deliveries: results};
}

export const sendClinicEmail = onCall({secrets: [patientCredentialEncryptionKey], timeoutSeconds: 120, maxInstances: 4},
  (request) => deliverClinicEmail(getFirestore(), getAuth(), request.rawRequest.get("authorization"), request.data,
    {enabled: clinicSecurityEnabled.value(), encryptionSecret: patientCredentialEncryptionKey.value()}));
