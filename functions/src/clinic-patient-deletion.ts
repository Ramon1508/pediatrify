import {DocumentData, Firestore, Timestamp} from "firebase-admin/firestore";
import {clinicDenied, validClinicId} from "./clinic-data";
import {validStaffId} from "./clinic-identifiers";

/** Delete bounded pages after a trusted writer has blocked every competing operation.
 * @param {object} query Validated query for this operation.
 * @param {Firestore} db Database adapter.
 * @return {object} Result of the validated clinic operation.
 */
async function removeQuery(query: FirebaseFirestore.Query, db: Firestore): Promise<void> {
  for (;;) {
    const page = await query.limit(200).get();
    if (page.empty) return;
    const batch = db.batch();
    for (const doc of page.docs) batch.delete(doc.ref);
    await batch.commit();
  }
}

/** Server-only resumable cascade; caller must validate authority before reserving the deletion.
 * @param {Firestore} db Database adapter.
 * @param {string} patientId Requested patient identifier.
 * @param {string} doctorId Verified owner Doctor identifier.
 * @return {object} Result of the validated clinic operation.
 */
export async function deleteClinicPatientData(db: Firestore, patientId: string, doctorId: string): Promise<void> {
  if (!validClinicId(patientId) || !validStaffId(doctorId)) throw clinicDenied();
  await db.runTransaction(async (tx) => {
    const source = (await tx.get(db.doc("patients/" + patientId))).data();
    const jobRef = db.doc("patientDeletionJobs/" + patientId);
    const job = (await tx.get(jobRef)).data();
    if ((source && source.doctorId !== doctorId) || (job && job.doctorId !== doctorId)) throw clinicDenied();
    tx.set(jobRef, {patientId, doctorId, blocked: true, completed: false, updatedAt: Timestamp.now()}, {merge: true});
    tx.set(db.doc("patientSessionStatus/" + patientId), {active: false});
  });
  const appointments = db.collection("appointments").where("patientId", "==", patientId);
  for (;;) {
    const page = await appointments.limit(100).get();
    if (page.empty) break;
    for (const appointment of page.docs) {
      if (appointment.data().doctorId !== doctorId) throw clinicDenied();
      await removeQuery(db.collection("notifications").where("appointmentId", "==", appointment.id), db);
      const batch = db.batch();
      batch.delete(db.doc("appointmentSlots/" + appointment.id));
      batch.delete(appointment.ref);
      await batch.commit();
    }
  }
  await removeQuery(db.collection("clinicalRecords").where("patientId", "==", patientId), db);
  await removeQuery(db.collection("patientDocuments").where("patientId", "==", patientId), db);
  await removeQuery(db.collection("notifications").where("recipientId", "==", patientId), db);
  await db.runTransaction(async (tx) => {
    const credentialRef = db.doc("patientCredentials/" + patientId);
    const credential = (await tx.get(credentialRef)).data();
    let reservation: DocumentData | undefined;
    let reservationRef: FirebaseFirestore.DocumentReference | undefined;
    if (credential) {
      if (credential.doctorId !== doctorId || !/^[a-f0-9]{64}$/.test(credential.passwordFingerprint)) throw clinicDenied();
      reservationRef = db.doc("patientPasswordReservations/" + credential.passwordFingerprint);
      reservation = (await tx.get(reservationRef)).data();
      if (reservation && (reservation.patientId !== patientId || reservation.credentialEpoch !== credential.credentialEpoch)) throw clinicDenied();
    }
    if (reservationRef && reservation) tx.delete(reservationRef);
    tx.delete(credentialRef);
    tx.delete(db.doc("patientSessionStatus/" + patientId));
    for (const collection of ["patients", "patientDirectory", "patientPortal"]) tx.delete(db.doc(collection + "/" + patientId));
    tx.set(db.doc("patientDeletionJobs/" + patientId), {completed: true, completedAt: Timestamp.now()}, {merge: true});
  });
}
