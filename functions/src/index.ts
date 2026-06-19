import { onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as nodemailer from "nodemailer";
import { environments } from "./environments/environment-functions";

admin.initializeApp();

// Transportador oficial usando serversmtp.com
const transporter = nodemailer.createTransport(environments.smtp);

// -------------------------------------------------------------
// 1. FUNCIÓN: Enviar correo de verificación de cuenta
// -------------------------------------------------------------
export const sendCustomVerificationEmail = onCall(async (request) => {
  const email = request.data.email;

  if (!email) {
    throw new Error("El correo electrónico es requerido.");
  }

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
      from: "\"Lilcare\" <noreply@lilcare.com>",
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
      from: "\"Lilcare\" <noreply@lilcare.com>",
      to: email,
      subject: "Restablece tu contraseña de Lilcare",
      html: htmlTemplate,
    });

    return { success: true };
  } catch (error) {
    console.error("Error al procesar el correo de recuperación:", error);
    throw new Error("Error al enviar el correo de recuperación." + ((error as any)["message"] ?? ""));
  }
});
