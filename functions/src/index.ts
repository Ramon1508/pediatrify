import {onCall, HttpsError} from "firebase-functions/v2/https";
import {getApps, initializeApp} from "firebase-admin/app";

if (!getApps().length) initializeApp();

export {deleteStaff} from "./staff-deletion";
export {updateStaffEmail} from "./staff-email-change";
export {manageStaffInvitation, inspectStaffInvitation, redeemStaffInvitation} from "./staff-invitations";
export {loginClinicPatient, getClinicSession} from "./clinic-auth";
export {patientPortal} from "./clinic-patient-portal";
export {getClinicPatientAccess, renewClinicPatientAccess} from "./patient-credentials";
export {createClinicPatient} from "./clinic-patients";
export {saveClinicData, getClinicPublications} from "./clinic-operations";
export {startClinicStaffSession, touchClinicSession, getClinicFamily, completeClinicProfile} from "./clinic-sessions";
export {sendClinicEmail} from "./clinic-mail";
export {sendCustomPasswordResetEmail} from "./clinic-recovery";

// Keep explicit retired endpoints so an old frontend cannot send caller-controlled mail.
export const sendCustomVerificationEmail = onCall(() => {
  throw new HttpsError("failed-precondition", "Esta operación ya no está disponible.");
});
export const sendPatientAccessEmail = onCall(() => {
  throw new HttpsError("failed-precondition", "Actualiza la aplicación y usa el envío autorizado del paciente.");
});
export const sendInvitationEmail = onCall(() => {
  throw new HttpsError("failed-precondition", "Actualiza la aplicación y usa la invitación autorizada.");
});
