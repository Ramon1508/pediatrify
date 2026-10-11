import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RETENTION_MS,retentionAction,expectedStaffAuthority,compatibleAuthority,referencedLogoPaths,fingerprint,staffReviewReason,reviewedStaffSource} from './operator-policy.mjs';
const now=2000000000000;const old=now-RETENTION_MS-1;const timestamp=value=>({toMillis:()=>value});

test('staff review reports known reasons and excludes arbitrary messages and identifiers',()=>{
  assert.equal(staffReviewReason(new Error('source-id-mismatch')), 'source-id-mismatch');
  assert.equal(staffReviewReason(new Error('auth-account-mismatch')), 'auth-account-mismatch');
  assert.equal(staffReviewReason({code:'auth/user-not-found',message:'private identity'}), 'auth/user-not-found');
  assert.equal(staffReviewReason(new Error('private identity')), 'binding-requires-review');
  assert.equal(staffReviewReason({code:'private@example.invalid'}), 'binding-requires-review');
  assert.equal(staffReviewReason(null), 'binding-requires-review');
});

test('source normalization requires an explicit bound Doctor and preserves account and relationships',()=>{
  const user={uid:'old-source',role:'doctor',firebaseUid:'preserved-auth',email:'synthetic@example.invalid',createdBy:'parent'};
  assert.throws(()=>reviewedStaffSource(user,'profile-doc'),/source-id-mismatch/);
  assert.deepEqual(reviewedStaffSource(user,'profile-doc',true),{...user,uid:'profile-doc'});
  assert.equal(user.uid,'old-source');
  for(const role of ['admin','assistant','patient'])assert.throws(()=>reviewedStaffSource({...user,role},'profile-doc',true),/staff-binding-invalid/);
  assert.throws(()=>reviewedStaffSource({...user,firebaseUid:''},'profile-doc',true));
  assert.throws(()=>reviewedStaffSource(user,'invalid/path',true));
  const legacy={...user,uid:'legacy@example.invalid'};
  assert.equal(reviewedStaffSource(legacy,legacy.uid),legacy);
  assert.deepEqual(reviewedStaffSource(user,legacy.uid,true),{...user,uid:legacy.uid});
  assert.throws(()=>reviewedStaffSource(user,'../legacy',true),/source-document-id-invalid/);
  assert.equal(reviewedStaffSource(user,'old-source'),user);
});
test('operator authority preserves Auth UID, rejects unknown role and never reactivates conflicting authority',()=>{
  const expected=expectedStaffAuthority({uid:'d1',role:'doctor'},'existing-auth-uid');
  assert.equal(expected.authUid,'existing-auth-uid');assert.equal(expected.doctorId,'d1');
  assert.equal(compatibleAuthority({...expected,active:false},expected),false);
  assert.equal(compatibleAuthority({...expected,role:'admin'},expected),false);
  assert.equal(compatibleAuthority(undefined,expected),true);
  assert.throws(()=>expectedStaffAuthority({uid:'p1',role:'patient'},'existing'));
  assert.throws(()=>expectedStaffAuthority({uid:'s1',role:'assistant'},'existing'));
  assert.throws(()=>expectedStaffAuthority({uid:'s1',role:'assistant',createdBy:'d1',pending:true},'existing'));
  assert.throws(()=>expectedStaffAuthority({uid:'d1',role:'doctor'},'invalid/auth'));
  assert.equal(expectedStaffAuthority({uid:'legacy@example.invalid',role:'doctor'},'existing').doctorId,'legacy@example.invalid');
  assert.equal(expectedStaffAuthority({uid:'s1',role:'assistant',createdBy:'legacy@example.invalid'},'existing').doctorId,'legacy@example.invalid');
  assert.throws(()=>expectedStaffAuthority({uid:'s1',role:'assistant',createdBy:'../legacy'},'existing'),/assistant-owner-invalid/);
});
test('retention excludes clinical data, audit, active credentials, reservations and replay markers',()=>{
  for(const name of ['patients','clinicalRecords','patientCredentials','patientPasswordReservations','auditLog','clinicOperations','patientCreationOperations','patientCredentialOperations']){
    assert.equal(retentionAction(name,{createdAt:timestamp(old),updatedAt:timestamp(old),completedAt:timestamp(old),completed:true},now),null);
  }
});
test('finished invitation and deletion details compact to barriers, never remove the tombstone',()=>{
  assert.deepEqual(retentionAction('staffInvitationIssueJobs',{completed:true,updatedAt:timestamp(old)},now).marker,{retired:true});
  for(const collection of ['staffDeletionJobs','patientDeletionJobs']){
    const action=retentionAction(collection,{completed:true,completedAt:timestamp(old)},now);
    assert.equal(action.action,'compact');assert.ok(action.fields.includes('completed'));
    assert.equal(retentionAction(collection,{completed:false,updatedAt:timestamp(old)},now),null);
  }
  assert.equal(retentionAction('staffInvitations',{status:'redeeming',expiresAt:old},now),null);
  assert.equal(retentionAction('staffInvitations',{status:'consumed',expiresAt:old,consumedAt:timestamp(old)},now).action,'compact');
});
test('only sessions expired for thirty days are eligible, independent of active flag',()=>{
  assert.deepEqual(retentionAction('clinicSessions',{active:true,expiresAt:timestamp(old)},now),{action:'delete'});
  assert.equal(retentionAction('clinicSessions',{active:false,expiresAt:timestamp(now-1)},now),null);
  assert.equal(retentionAction('clinicSessions',{active:false,expiresAt:'bad'},now),null);
});
test('sent delivery is compacted to anti-replay receipt; recent or in-flight delivery is retained',()=>{
  const data={sent:true,updatedAt:timestamp(old),leaseUntil:0};
  assert.equal(retentionAction('clinicEmailDeliveries',data,now).action,'compact');
  assert.equal(retentionAction('clinicEmailDeliveries',{...data,leaseUntil:now+1},now),null);
  assert.equal(retentionAction('clinicEmailDeliveries',{...data,updatedAt:timestamp(now-1)},now),null);
  assert.deepEqual(retentionAction('clinicEmailDeliveries',{...data,sent:false},now),{action:'delete'});
  assert.deepEqual(retentionAction('clinicEmailDeliveries',{...data,sent:false,leaseUntil:old},now),{action:'delete'});
  assert.equal(retentionAction('clinicEmailDeliveries',{...data,sent:false,leaseUntil:now-1},now),null);
  assert.equal(retentionAction('clinicEmailDeliveries',{...data,sent:false,leaseUntil:'unknown'},now),null);
});
test('logo inventory recognizes canonical path and legacy download URL, unresolved reference prevents cleanup',()=>{
  const references=referencedLogoPaths([{logoPath:'logos/d1/a.png'}, {logoUrl:'https://firebasestorage.googleapis.com/v0/b/example/o/logos%2Fd1%2Fb.png?alt=media'},
    {printSettings:{logoUrl:'gs://example/logos/d1/c.png'}}]);
  assert.deepEqual([...references.paths].sort(),['logos/d1/a.png','logos/d1/b.png','logos/d1/c.png']);
  assert.equal(references.unresolved,false);
  assert.equal(referencedLogoPaths([{logoPath:'https://unknown.example/image.png'}]).unresolved,true);
});
test('snapshot fingerprints are stable but change when reviewed data changes',()=>{
  assert.equal(fingerprint({a:1,b:timestamp(now)}),fingerprint({b:timestamp(now),a:1}));
  assert.notEqual(fingerprint({a:1}),fingerprint({a:2}));
});
