import {Auth, getAuth} from "firebase-admin/auth";
import {Firestore, getFirestore} from "firebase-admin/firestore";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {clinicSecurityEnabled, consumePatientLoginBudget} from "./clinic-auth";
import {defineSecret} from "firebase-functions/params";
import {clinicClock, clinicObject} from "./clinic-data";
import {sendClinicSmtp} from "./clinic-mail";

const limiterKey = defineSecret("PATIENT_LOGIN_LIMITER_KEY");

/** Anonymous recovery accepts only email; no account enumeration or caller-controlled message.
 * @param {Firestore} db Database.
 * @param {Auth} auth Admin Auth adapter.
 * @param {unknown} input Untrusted email request.
 * @param {object} security Server gate, limiter key, transport address and clock.
 * @param {Function} send Injected mail transport for local tests.
 * @return {Promise<object>} Generic acknowledgement, never an account or reset token.
 */
export async function requestClinicPasswordReset(db: Firestore, auth: Auth, input: unknown,
  security: {enabled: boolean; limiterSecret: string; transportAddress: string; now?: number}, send = sendClinicSmtp): Promise<{success: true}> {
  if (!security.enabled) throw new HttpsError("failed-precondition", "La recuperación segura aún no está habilitada.");
  const data = clinicObject(input, ["email"]);
  if (typeof data.email !== "string" || data.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) throw new HttpsError("invalid-argument", "Ingresa un correo electrónico válido.");
  const email = data.email.trim().toLowerCase();
  const now = security.now ?? Date.now();
  await consumePatientLoginBudget(db, security.limiterSecret, security.transportAddress, email, now);
  let account;
  try {
    account = await auth.getUserByEmail(email);
  } catch (failure) {
    if ((failure as {code?: string}).code === "auth/user-not-found") return {success: true};
    throw new HttpsError("unavailable", "No fue posible procesar la solicitud. Intenta nuevamente.");
  }
  const principal = (await db.doc("securityPrincipals/" + account.uid).get()).data();
  if (account.disabled || principal?.active !== true || principal.authUid !== account.uid ||
      !["admin", "doctor", "assistant"].includes(principal.role)) return {success: true};
  const profile = (await db.doc("users/" + principal.userId).get()).data();
  if (!profile || profile.firebaseUid !== account.uid || profile.role !== principal.role ||
      (await db.doc("staffDeletionJobs/" + principal.userId).get()).exists) return {success: true};
  await db.runTransaction(async (tx) => {
    const ref = db.doc("emailCounter/daily");
    const old = (await tx.get(ref)).data();
    const date = clinicClock(now).date;
    const count = old?.date === date ? old.count ?? 0 : 0;
    const monthCount = old?.month === date.slice(0, 7) ? old.monthCount ?? 0 : 0;
    if (count >= 200 || monthCount >= 6000) throw new HttpsError("resource-exhausted", "Se alcanzó el límite de correos. Intenta más tarde.");
    tx.set(ref, {date, month: date.slice(0, 7), count: count + 1, monthCount: monthCount + 1});
  });
  const original = new URL(await auth.generatePasswordResetLink(email));
  const code = original.searchParams.get("oobCode");
  if (!code) throw new HttpsError("unavailable", "No fue posible preparar la recuperación. Intenta nuevamente.");
  const link = "https://lilcare.com.mx/reset-password?oobCode=" + encodeURIComponent(code);
  try {
    await send({to: email, subject: "Recuperación de acceso a Lilcare",
      html: `<p>Recibimos una solicitud para cambiar tu contraseña.</p><p><a href="${link}">Cambiar contraseña</a></p><p>Si no solicitaste el cambio, ignora este correo.</p>`});
  } catch {
    throw new HttpsError("unavailable", "No fue posible confirmar el envío. Intenta nuevamente.");
  }
  return {success: true};
}

export const sendCustomPasswordResetEmail = onCall({secrets: [limiterKey], maxInstances: 2, concurrency: 8},
  (request) => requestClinicPasswordReset(getFirestore(), getAuth(), request.data,
    {enabled: clinicSecurityEnabled.value(), limiterSecret: limiterKey.value(), transportAddress: request.rawRequest.socket?.remoteAddress ?? ""}));
