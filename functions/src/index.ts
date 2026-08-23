import { onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as nodemailer from "nodemailer";
import { environments } from "./environments/environment-functions";

admin.initializeApp();

const MAX_DAILY_EMAILS = 200;
const MAX_MONTHLY_EMAILS = 6000;
const SUPPORT_EMAIL = "karlibegu@gmail.com";

// Transportador oficial usando serversmtp.com
const transporter = nodemailer.createTransport(environments.smtp);

// Verificar conexión SMTP al iniciar
transporter.verify((err, success) => {
  if (err) {
    console.error("SMTP verification FAILED:", err);
  } else {
    console.log("SMTP server is ready to accept messages:", success);
  }
});

/**
 * Revisa el contador diario y mensual de correos.
 * Si algún límite se ha alcanzado, lanza un error indicándolo.
 * Si no, incrementa ambos contadores de forma atómica.
 */
async function checkAndIncrementCounter(): Promise<void> {
  const counterRef = admin.firestore().doc("emailCounter/daily");
  const today = new Date().toISOString().split("T")[0];
  const thisMonth = today.substring(0, 7);

  await admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const data = snap.data();

    const dailyCount = data?.date === today ? (data.count ?? 0) : 0;
    const monthlyCount = data?.month === thisMonth ? (data.monthCount ?? 0) : 0;

    if (dailyCount >= MAX_DAILY_EMAILS) {
      throw new Error(
        "Ya se rebasó el límite de correos enviados diarios, por favor intente de nuevo mañana. " +
        `En caso de seguir experimentando este problema, favor de contactar a ${SUPPORT_EMAIL}`
      );
    }
    if (monthlyCount >= MAX_MONTHLY_EMAILS) {
      throw new Error(
        "Ya se rebasó el límite mensual de correos enviados. " +
        `En caso de seguir experimentando este problema, favor de contactar a ${SUPPORT_EMAIL}`
      );
    }

    tx.set(counterRef, {
      date: today,
      count: dailyCount + 1,
      month: thisMonth,
      monthCount: monthlyCount + 1,
    });
  });
}

// -------------------------------------------------------------
// 1. FUNCIÓN: Enviar correo de verificación de cuenta
// -------------------------------------------------------------
export const sendCustomVerificationEmail = onCall(async (request) => {
  const email = request.data.email;

  if (!email) {
    throw new Error("El correo electrónico es requerido.");
  }

  await checkAndIncrementCounter();

  try {
    const defaultLink = await admin.auth().generateEmailVerificationLink(email);
    const urlParams = new URL(defaultLink).searchParams;
    const oobCode = urlParams.get("oobCode");

    const customLink = `https://lilcare-afdf5.web.app/auth-handler?mode=verifyEmail&oobCode=${oobCode}`;

    const htmlTemplate = `
        <div style="font-family: Arial, sans-serif; background-color: #ffffff">
        <div style="background: #0000000d; padding: 16px 122px">
            <div style="background: white; padding: 8px 40px; border-bottom: 2px solid #0d6e8f">
            <img
                src="https://lilcare-afdf5.web.app/images/Logo.jpg"
                alt="Lilcare"
                style="width: 40px; height: 40px; vertical-align: middle; margin-right: 8px"
            />
            <span
                style="
                color: #0d6e8f;
                font-weight: 500;
                font-size: 22px;
                line-height: 20px;
                vertical-align: middle;
                "
            >
                Lilcare
            </span>
            </div>

            <div
            style="
                background-image: url('https://lilcare-afdf5.web.app/images/Fondo.svg');
                background-repeat: repeat;
                background-position: center;
                padding: 40px;
            "
            >
            <div style="color: #49454f; font-size: 16px; line-height: 24px">
                Has sido invitado a crear tu cuenta para comenzar a utilizar Lilcare.
                <br /><br />
                Con Lilcare podrás gestionar sencillamente la atención de tus pacientes, incluyendo:
                <br /><br />
                <ul style="margin-top: 0">
                <li><b>Agendar y administrar</b> consultas con tus pacientes.</li>
                <li><b>Dar seguimiento</b> a sus citas y evolución.</li>
                <li>
                    <b>Agregar asistentes o personal de apoyo</b>
                    para que puedan ayudarte a gestionar y agendar las consultas.
                </li>
                </ul>
                <br />
                Además, tus pacientes podrán agendar sus consultas, así como revisar las recetas y
                recomendaciones correspondientes a su última consulta.
            </div>

            <div style="width: 100%; text-align: center; padding-top: 24px; padding-bottom: 24px">
                <a
                href="${customLink}"
                style="
                    display: inline-block;
                    padding: 10px 16px;
                    background: #01687d;
                    border-radius: 12px;
                    color: white;
                    font-size: 14px;
                    font-weight: 500;
                    line-height: 20px;
                    text-decoration: none;
                "
                >
                Crear mi cuenta
                </a>
            </div>

            <div style="color: #49454f; font-size: 16px; line-height: 24px">
                Una vez que completes el registro, podrás acceder a las herramientas disponibles para
                organizar tu práctica y mejorar la experiencia de atención para tus pacientes.
                <br /><br />
                Si tienes alguna pregunta durante el proceso, no dudes en contactarnos.
                <br /><br />
                Saludos,
                <br />
                <b>Equipo Lilcare</b>
            </div>
            </div>
        </div>
        </div>
    `;

    await transporter.sendMail({
      from: "\"Lilcare\" <noreply@lilcare.com.mx>",
      to: email,
      subject: "Verifica tu cuenta de Lilcare",
      html: htmlTemplate,
    });

    return { success: true };
  } catch (error) {
    console.error("Error al procesar el correo:", error);
    throw new Error("Error al enviar el correo de verificación.");
  }
});

// -------------------------------------------------------------
// 2. FUNCIÓN: Enviar correo de restablecimiento de contraseña
// -------------------------------------------------------------
export const sendCustomPasswordResetEmail = onCall(async (request) => {
  const email = request.data.email;

  if (!email) {
    throw new Error("El correo electrónico es requerido.");
  }

  await checkAndIncrementCounter();

  try {
    // 1. Generamos el link de recuperación técnico de Firebase
    const defaultLink = await admin.auth().generatePasswordResetLink(email);

    // 2. Extraemos los parámetros de consulta (oobCode, apiKey, lang)
    const urlParams = new URL(defaultLink).searchParams;
    const oobCode = urlParams.get("oobCode");
    const apiKey = urlParams.get("apiKey");
    const lang = urlParams.get("lang") || "es";

    // 3. Construimos tu enlace personalizado para /reset-password
    const customLink = `https://lilcare-afdf5.web.app/reset-password?oobCode=${oobCode}&mode=resetPassword&apiKey=${apiKey}&lang=${lang}`;

    // 4. Tu plantilla HTML adaptada para restablecer contraseña
    const htmlTemplate = `
        <div style="font-family: Arial, sans-serif; background-color: #ffffff">
        <div style="background: #0000000d; padding: 16px 122px">
            <div style="background: white; padding: 8px 40px; border-bottom: 2px solid #0d6e8f">
            <img
                src="https://lilcare-afdf5.web.app/images/Logo.jpg"
                alt="Lilcare"
                style="width: 40px; height: 40px; vertical-align: middle; margin-right: 8px"
            />
            <span
                style="
                color: #0d6e8f;
                font-weight: 500;
                font-size: 22px;
                line-height: 20px;
                vertical-align: middle;
                "
            >
                Lilcare
            </span>
            </div>

            <div
            style="
                background-image: url('https://lilcare-afdf5.web.app/images/Fondo.svg');
                background-repeat: repeat;
                background-position: center;
                padding: 40px;
            "
            >
            <div style="color: #49454f; font-size: 16px; line-height: 24px">
                Hola,
                <br /><br />
                Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en Lilcare. 
                Si fuiste tú, puedes hacerlo haciendo clic en el siguiente botón:
                <br /><br />
            </div>

            <div style="width: 100%; text-align: center; padding-top: 24px; padding-bottom: 24px">
                <a
                href="${customLink}"
                style="
                    display: inline-block;
                    padding: 10px 16px;
                    background: #01687d;
                    border-radius: 12px;
                    color: white;
                    font-size: 14px;
                    font-weight: 500;
                    line-height: 20px;
                    text-decoration: none;
                "
                >
                Restablecer mi contraseña
                </a>
            </div>

            <div style="color: #49454f; font-size: 16px; line-height: 24px">
                Si tú no realizaste esta solicitud, puedes ignorar este correo de forma segura. Tu contraseña seguirá siendo la misma.
                <br /><br />
                Si tienes alguna pregunta, no dudes en contactarnos.
                <br /><br />
                Saludos,
                <br />
                <b>Equipo Lilcare</b>
            </div>
            </div>
        </div>
        </div>
    `;

    // 5. Enviar el correo de recuperación
    await transporter.sendMail({
      from: "\"Lilcare\" <noreply@lilcare.com.mx>",
      to: email,
      subject: "Restablece tu contraseña de Lilcare",
      html: htmlTemplate,
    });

    console.log(`Password reset email sent successfully to ${email} via SMTP`);
    return { success: true };
  } catch (error) {
    console.error("Error al procesar el correo de recuperación:", error);
    throw new Error("Error al enviar el correo de recuperación." + ((error as any)["message"] ?? ""));
  }
});

// -------------------------------------------------------------
// 3. FUNCIÓN: Enviar correo de acceso de paciente (correo + OTP)
// -------------------------------------------------------------
export const sendPatientAccessEmail = onCall(async (request) => {
  const { email, otpPassword, patientName, doctorName } = request.data || {};

  if (!email || !otpPassword) {
    throw new Error("El correo y la contraseña OTP son requeridos.");
  }

  await checkAndIncrementCounter();

  try {
    const htmlTemplate = `
        <div style="font-family: Arial, sans-serif; background-color: #ffffff">
        <div style="background: #0000000d; padding: 16px 122px">
            <div style="background: white; padding: 8px 40px; border-bottom: 2px solid #0d6e8f">
            <img
                src="https://lilcare-afdf5.web.app/images/Logo.jpg"
                alt="Lilcare"
                style="width: 40px; height: 40px; vertical-align: middle; margin-right: 8px"
            />
            <span
                style="
                color: #0d6e8f;
                font-weight: 500;
                font-size: 22px;
                line-height: 20px;
                vertical-align: middle;
                "
            >
                Lilcare
            </span>
            </div>

            <div
            style="
                background-image: url('https://lilcare-afdf5.web.app/images/Fondo.svg');
                background-repeat: repeat;
                background-position: center;
                padding: 40px;
            "
            >
            <div style="color: #49454f; font-size: 16px; line-height: 24px">
                Hola${patientName ? ` ${patientName}` : ""},
                <br /><br />
                Te compartimos tus datos de acceso a Lilcare para consultar las citas, recetas y
                recomendaciones que${doctorName ? ` ${doctorName}` : " tu médico"} ha registrado para ti.
                <br /><br />
                <ul style="margin-top: 0">
                <li><b>Correo:</b> ${email}</li>
                <li><b>Contraseña (OTP):</b> ${otpPassword}</li>
                </ul>
                <br />
                Con estos datos podrás iniciar sesión desde la opción de acceso para pacientes en
                <a href="https://lilcare-afdf5.web.app/otp-login" style="color: #0d6e8f">lilcare-afdf5.web.app</a>.
                <br /><br />
                Si tienes alguna duda, no dudes en contactar a tu médico o al equipo de Lilcare.
                <br /><br />
                Saludos,
                <br />
                <b>Equipo Lilcare</b>
            </div>
            </div>
        </div>
        </div>
    `;

    await transporter.sendMail({
      from: "\"Lilcare\" <noreply@lilcare.com.mx>",
      to: email,
      subject: "Acceso a tu cuenta de Lilcare",
      html: htmlTemplate,
    });

    console.log(`Patient access email sent successfully to ${email} via SMTP`);
    return { success: true };
  } catch (error) {
    console.error("Error al procesar el correo de acceso:", error);
    throw new Error("Error al enviar el correo de acceso." + ((error as any)["message"] ?? ""));
  }
});

// -------------------------------------------------------------
// 4. FUNCIÓN: Enviar invitación (doctor/asistente) por correo
// -------------------------------------------------------------
export const sendInvitationEmail = onCall(async (request) => {
  const { email, inviteeName, doctorName, link } = request.data || {};

  if (!email || !link) {
    throw new Error("El correo y el enlace de invitación son requeridos.");
  }

  await checkAndIncrementCounter();

  try {
    const htmlTemplate = `
        <div style="font-family: Arial, sans-serif; background-color: #ffffff">
        <div style="background: #0000000d; padding: 16px 122px">
            <div style="background: white; padding: 8px 40px; border-bottom: 2px solid #0d6e8f">
            <img
                src="https://lilcare-afdf5.web.app/images/Logo.jpg"
                alt="Lilcare"
                style="width: 40px; height: 40px; vertical-align: middle; margin-right: 8px"
            />
            <span
                style="color: #0d6e8f; font-weight: 500; font-size: 22px; line-height: 20px; vertical-align: middle"
            >
                Lilcare
            </span>
            </div>

            <div
            style="background-image: url('https://lilcare-afdf5.web.app/images/Fondo.svg'); background-repeat: repeat; background-position: center; padding: 40px"
            >
            <div style="color: #49454f; font-size: 16px; line-height: 24px">
                Hola${inviteeName ? ` ${inviteeName}` : ""},
                <br /><br />
                Has sido invitado${doctorName ? ` por ${doctorName}` : ""} a formar parte de
                <b>Lilcare</b>.
                <br /><br />
                Para crear tu cuenta y empezar a usar el sistema, haz clic en el siguiente enlace:
                <br /><br />
                <a href="${link}" style="color: #0d6e8f; font-weight: 600">Crear mi cuenta</a>
                <br /><br />
                Si el enlace no funciona, cópialo en tu navegador:
                <br />
                <span style="word-break: break-all; color: #49454f">${link}</span>
                <br /><br />
                Si tienes alguna duda, no dudes en contactar al equipo de Lilcare.
                <br /><br />
                Saludos,
                <br />
                <b>Equipo Lilcare</b>
            </div>
            </div>
        </div>
        </div>
    `;

    await transporter.sendMail({
      from: "\"Lilcare\" <noreply@lilcare.com.mx>",
      to: email,
      subject: "Invitación a Lilcare",
      html: htmlTemplate,
    });

    console.log(`Invitation email sent successfully to ${email} via SMTP`);
    return { success: true };
  } catch (error) {
    console.error("Error al procesar el correo de invitación:", error);
    throw new Error("Error al enviar el correo de invitación." + ((error as any)["message"] ?? ""));
  }
});
