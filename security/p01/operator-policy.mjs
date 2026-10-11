import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../functions/package.json',import.meta.url));
const {validStaffId}=require('./lib/clinic-identifiers.js');

export const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const ROLES = ['admin', 'doctor', 'assistant'];
const STAFF_REVIEW_REASONS = new Set([
  'source-id-mismatch', 'source-document-id-invalid', 'auth-account-mismatch', 'protected-authority-conflict',
  'deletion-marker-present', 'duplicate-auth-binding', 'assistant-owner-unavailable',
  'staff-binding-invalid', 'assistant-owner-invalid',
]);
/** Preserve known review reasons without leaking arbitrary transport messages or personal data. */
export function staffReviewReason(error) {
  if (STAFF_REVIEW_REASONS.has(error?.message)) return error.message;
  if (typeof error?.code === 'string' && /^auth\/[a-z-]+$/.test(error.code)) return error.code;
  return 'binding-requires-review';
}
/** Explicit operator-only normalization of a reviewed Doctor profile; never moves a document. */
export function reviewedStaffSource(user, documentId, normalizeSourceUid = false) {
  if (!validStaffId(documentId)) throw new Error('source-document-id-invalid');
  if (user.uid === documentId) return user;
  if (!normalizeSourceUid) throw new Error('source-id-mismatch');
  if (user.role !== 'doctor' || typeof user.firebaseUid !== 'string' || !user.firebaseUid ||
      !validStaffId(documentId)) throw new Error('staff-binding-invalid');
  return {...user, uid: documentId};
}
export const fingerprint = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    if (typeof value.toMillis === 'function') return {$timestamp: value.toMillis()};
    return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
  }
  return value;
}
export function expectedStaffAuthority(user, authUid) {
  const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
  if (!ROLES.includes(user.role) || !validStaffId(user.uid) || !validId(authUid) || user.pending === true) throw new Error('staff-binding-invalid');
  if (user.role === 'assistant' && !validStaffId(user.createdBy)) throw new Error('assistant-owner-invalid');
  return {authUid,userId:user.uid,role:user.role,active:true,
    ...(user.role==='doctor'?{doctorId:user.uid}:user.role==='assistant'?{doctorId:user.createdBy}:{})};
}
export function compatibleAuthority(current, expected) {
  return !current || Object.keys(expected).every(key=>current[key]===expected[key]) &&
    (expected.role !== 'admin' || current.doctorId === undefined);
}
export function referencedLogoPaths(users) {
  const paths=new Set(); let unresolved=false;
  const inspect=value=>{
    if (typeof value!=='string'||!value) return;
    if (value.startsWith('logos/')) {paths.add(value); return;}
    try {
      const url=new URL(value);
      const marker='/o/'; const index=url.pathname.indexOf(marker);
      if(index>=0) paths.add(decodeURIComponent(url.pathname.slice(index+marker.length)));
      else if(url.protocol==='gs:') paths.add(decodeURIComponent(url.pathname.slice(1)));
      else unresolved=true;
    } catch {unresolved=true;}
  };
  for(const user of users){inspect(user.logoPath);inspect(user.logoUrl);inspect(user.printSettings?.logoUrl);}
  return {paths,unresolved};
}
export function millis(value) {return typeof value?.toMillis==='function'?value.toMillis():typeof value==='number'?value:NaN;}

/** Only known technical documents; replay-sensitive business receipts are never candidates. */
export function retentionAction(collection, data, now) {
  const cutoff=now-RETENTION_MS;
  if(collection==='clinicSessions') {
    const end=millis(data.expiresAt);
    return Number.isFinite(end)&&end<cutoff?{action:'delete'}:null;
  }
  if(collection==='clinicEmailDeliveries') {
    if(millis(data.updatedAt)>=cutoff||!Number.isFinite(millis(data.updatedAt))||data.leaseUntil>now)return null;
    return data.sent===true?{action:'compact',fields:['actorUid','kind','sent','updatedAt']}:
      data.sent===false&&Number.isFinite(data.leaseUntil)&&(data.leaseUntil===0||data.leaseUntil<cutoff)?{action:'delete'}:null;
  }
  if(collection==='patientLoginBudgets'||collection==='staffInvitationRateLimits') {
    const start=millis(data.windowStart??data.startedAt??data.window);
    return Number.isFinite(start)&&start<cutoff?{action:'delete'}:null;
  }
  // Completed email jobs remain replay barriers, but names and transport leases are unnecessary after recovery closes.
  if(collection==='staffEmailChangeJobs'&&data.completed===true&&millis(data.completedAt)<cutoff) {
    return {action:'compact',fields:['completed','completedAt','operationId','userId','authUid','role','doctorId','email','expectedEmail']};
  }
  if(collection==='staffInvitationIssueJobs'&&data.completed===true&&millis(data.updatedAt)<cutoff) {
    return {action:'compact',fields:['userId','action','role','createdBy','completed','updatedAt'],marker:{retired:true}};
  }
  if(collection==='staffInvitations'&&['consumed','revoked'].includes(data.status)&&Number.isFinite(data.expiresAt)&&data.expiresAt<cutoff&&
    (data.status!=='consumed'||millis(data.consumedAt)<cutoff)) {
    return {action:'compact',fields:['userId','authUid','tokenHash','status','expiresAt','consumedAt']};
  }
  if(['staffDeletionJobs','patientDeletionJobs'].includes(collection)&&data.completed===true&&millis(data.completedAt)<cutoff) {
    return {action:'compact',fields:['target','patientId','doctorId','blocked','completed','completedAt','parentUserId']};
  }
  return null;
}
