import {createRequire} from 'node:module';
import {fingerprint} from './operator-policy.mjs';
const require=createRequire(new URL('../../functions/package.json',import.meta.url));
const {decryptPatientPassword,encryptPatientPassword,patientPasswordFingerprint}=require('./lib/patient-credentials.js');

export function credentialContextFingerprint(credential){
  const {encryptedPassword,passwordFingerprint,keyRotationId,...context}=credential;
  return fingerprint(context);
}
export function validateRotationKeys(keys){
  const names=['previousEncryption','nextEncryption','previousUniqueness','nextUniqueness'];
  if(!keys||Object.keys(keys).length!==4||names.some(name=>typeof keys[name]!=='string'||!/^[a-fA-F0-9]{64}$/.test(keys[name])))throw new Error('rotation-input-invalid');
}
export function rotateCredentialKeys(credential,keys,rotationId){
  validateRotationKeys(keys);
  if(!/^[a-f0-9]{32}$/.test(rotationId))throw new Error('rotation-input-invalid');
  let password;let alreadyRotated=false;
  if(credential.keyRotationId===rotationId){
    password=decryptPatientPassword(credential,keys.nextEncryption);
    if(patientPasswordFingerprint(password,keys.nextUniqueness)!==credential.passwordFingerprint)throw new Error('rotation-state-invalid');
    alreadyRotated=true;
  }else{
    password=decryptPatientPassword(credential,keys.previousEncryption);
    if(patientPasswordFingerprint(password,keys.previousUniqueness)!==credential.passwordFingerprint)throw new Error('rotation-state-invalid');
  }
  const nextFingerprint=patientPasswordFingerprint(password,keys.nextUniqueness);
  return {alreadyRotated,nextFingerprint,credential:alreadyRotated?credential:{...credential,
    passwordFingerprint:nextFingerprint,encryptedPassword:encryptPatientPassword(password,keys.nextEncryption,credential),keyRotationId:rotationId}};
}
export function reservationBelongsTo(reservation,credential){
  return !!reservation&&['patientId','doctorId','credentialEpoch','credentialVersion'].every(key=>reservation[key]===credential[key]);
}

export async function applyReviewedCredentialRotation(db,row,keys,rotationId){
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(row.patientId)||
    !/^[a-f0-9]{64}$/.test(row.previousFingerprint)||!/^[a-f0-9]{64}$/.test(row.nextFingerprint))throw new Error('credential-id-invalid');
  return db.runTransaction(async tx=>{
    const ref=db.doc('patientCredentials/'+row.patientId);const credential=(await tx.get(ref)).data();
    if(!credential||credential.patientId!==row.patientId||credentialContextFingerprint(credential)!==row.contextFingerprint)throw new Error('reviewed-credential-changed');
    const rotated=rotateCredentialKeys(credential,keys,rotationId);
    if(rotated.nextFingerprint!==row.nextFingerprint||!rotated.alreadyRotated&&
      (fingerprint(credential)!==row.sourceFingerprint||credential.passwordFingerprint!==row.previousFingerprint))throw new Error('reviewed-key-or-credential-changed');
    const oldRef=db.doc('patientPasswordReservations/'+row.previousFingerprint);
    const nextRef=db.doc('patientPasswordReservations/'+row.nextFingerprint);
    const [oldSnapshot,nextSnapshot]=await Promise.all([tx.get(oldRef),tx.get(nextRef)]);
    const old=oldSnapshot.data();const next=nextSnapshot.data();
    if(rotated.alreadyRotated){if(!reservationBelongsTo(next,credential))throw new Error('rotation-state-invalid');return;}
    if(!reservationBelongsTo(old,credential)||next&&!reservationBelongsTo(next,credential))throw new Error('reservation-conflict');
    tx.set(nextRef,Object.fromEntries(['patientId','doctorId','credentialEpoch','credentialVersion'].map(key=>[key,credential[key]])));
    if(oldRef.path!==nextRef.path)tx.delete(oldRef);
    tx.set(ref,rotated.credential);
  });
}
