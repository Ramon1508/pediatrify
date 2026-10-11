import {createRequire} from 'node:module';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve, dirname, relative, isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {expectedStaffAuthority, compatibleAuthority, fingerprint, ROLES, staffReviewReason, reviewedStaffSource} from './operator-policy.mjs';

// Trusted operator only: ADC, explicit project/database and a private reviewed plan; no callable or browser bootstrap.
const require=createRequire(new URL('../../functions/package.json',import.meta.url));
const {initializeApp,applicationDefault,deleteApp}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const {getFirestore,Timestamp}=require('firebase-admin/firestore');
const {writeClinicUserProjections}=require('./lib/clinic-data.js');
const args=process.argv.slice(2);
const option=key=>{const index=args.indexOf(key);return index<0?undefined:args[index+1];};
const project=option('--project'); const database=option('--database');
const applying=args.includes('--apply');
const normalizationTarget=option('--normalize-source-id');
if(!project||database!=='(default)')throw new Error('Specify --project and --database (default).');
if(process.env.FIRESTORE_EMULATOR_HOST||process.env.FIREBASE_AUTH_EMULATOR_HOST)throw new Error('Use synthetic unit tests; this operator command requires an explicitly reviewed environment.');
const privateRoot=resolve(dirname(fileURLToPath(import.meta.url)),'review-plans');
const output=resolve(option('--plan')??resolve(privateRoot,'staff-authority.json'));
const outputRelative=relative(privateRoot,output);
if(outputRelative.startsWith('..')||isAbsolute(outputRelative))throw new Error('Plan must remain under security/p01/review-plans.');
const app=initializeApp({projectId:project,credential:applicationDefault()},'p01-trusted-staff-operator');
const db=getFirestore(app); const auth=getAuth(app);
const accountFingerprint=account=>fingerprint({uid:account.uid,email:account.email?.trim().toLowerCase(),disabled:account.disabled});
async function accountFor(user) {
  let account;
  if(user.firebaseUid) account=await auth.getUser(user.firebaseUid);
  else {
    try {account=await auth.getUser(user.uid);}catch(error){if(error.code!=='auth/user-not-found')throw error;}
    if(!account) account=await auth.getUserByEmail(user.email.trim().toLowerCase());
  }
  if(account.disabled||account.email?.trim().toLowerCase()!==user.email?.trim().toLowerCase())throw new Error('auth-account-mismatch');
  return account;
}
try {
  if(!applying) {
    const snapshot=await db.collection('users').get(); const rows=[];
    const users=new Map(snapshot.docs.map(doc=>[doc.id,doc.data()])); const seen=new Set();
    if(normalizationTarget && users.get(normalizationTarget)?.role!=='doctor')throw new Error('normalization-target-invalid');
    for(const [userId,user]of users) {
      if(!ROLES.includes(user.role))continue;
      if(user.pending===true){rows.push({userId,role:user.role,status:'pending-invitation-excluded',approved:false});continue;}
      let resolvedUid;
      try {
        const normalized=normalizationTarget===userId&&user.uid!==userId;
        const source=reviewedStaffSource(user,userId,normalized);
        const account=await accountFor(user); resolvedUid=account.uid;
        const expected=expectedStaffAuthority(source,account.uid);
        const current=(await db.doc('securityPrincipals/'+account.uid).get()).data();
        if(!compatibleAuthority(current,expected))throw new Error('protected-authority-conflict');
        if((await db.doc('staffDeletionJobs/'+userId).get()).exists)throw new Error('deletion-marker-present');
        if(seen.has(account.uid))throw new Error('duplicate-auth-binding');
        if(user.role==='assistant') {
          const owner=users.get(user.createdBy);
          if(!owner||!['admin','doctor'].includes(owner.role)||owner.pending===true||owner.profileComplete!==true)throw new Error('assistant-owner-unavailable');
        }
        seen.add(account.uid);
        rows.push({userId,authUid:account.uid,role:user.role,sourceFingerprint:fingerprint(user),accountFingerprint:accountFingerprint(account),
          authorityFingerprint:current?fingerprint(current):null,...(normalized?{normalizeSourceUid:true}:{}),status:'ready-for-review',approved:false});
      }catch(error){rows.push({userId,...(resolvedUid?{authUid:resolvedUid}:{}),role:user.role,status:'blocked',reason:staffReviewReason(error),approved:false});}
    }
    // A conflicting duplicate invalidates every matching row, never silently chooses the first one.
    for(const row of rows)if(row.authUid&&rows.some(other=>other!==row&&other.authUid===row.authUid))row.status='blocked';
    await mkdir(privateRoot,{recursive:true});
    await writeFile(output,JSON.stringify({schema:1,kind:'staff-authority',project,database,createdAt:new Date().toISOString(),rows},null,2)+'\n',{encoding:'utf8',flag:'wx'});
    console.log(JSON.stringify({prepared:true,ready:rows.filter(row=>row.status==='ready-for-review').length,blocked:rows.filter(row=>row.status==='blocked').length,pending:rows.filter(row=>row.status==='pending-invitation-excluded').length}));
  }else {
    if(!args.includes('--reviewed'))throw new Error('Review the private plan and mark approved rows before --apply --reviewed.');
    const plan=JSON.parse(await readFile(output,'utf8'));
    if(plan.schema!==1||plan.kind!=='staff-authority'||plan.project!==project||plan.database!==database||!Array.isArray(plan.rows))throw new Error('plan-environment-mismatch');
    const selected=plan.rows.filter(row=>row.approved===true);
    if(!selected.length||selected.some(row=>row.status!=='ready-for-review'))throw new Error('no-valid-approved-rows');
    if(selected.some(row=>row.normalizeSourceUid===true&&row.userId!==normalizationTarget))throw new Error('normalization-review-required');
    if(new Set(selected.map(row=>row.authUid)).size!==selected.length)throw new Error('duplicate-auth-binding');
    // Activation must retain an operational Admin, including a reviewed existing account.
    const admins=await db.collection('users').where('role','==','admin').get();
    let operationalAdmin=false;
    for(const snapshot of admins.docs){
      const user=snapshot.data();
      if(user.uid!==snapshot.id||user.pending===true||user.profileComplete!==true||
        (await db.doc('staffDeletionJobs/'+snapshot.id).get()).exists)continue;
      const selectedRow=selected.find(row=>row.userId===snapshot.id&&row.role==='admin');
      let account;
      try{account=await accountFor(user);}catch{continue;}
      const expected=expectedStaffAuthority(user,account.uid);
      const current=(await db.doc('securityPrincipals/'+account.uid).get()).data();
      const reviewed=selectedRow&&fingerprint(user)===selectedRow.sourceFingerprint&&
        accountFingerprint(account)===selectedRow.accountFingerprint&&
        (current?fingerprint(current):null)===selectedRow.authorityFingerprint;
      if(compatibleAuthority(current,expected)&&(reviewed||current&&user.firebaseUid===account.uid))operationalAdmin=true;
    }
    if(!operationalAdmin)throw new Error('operational-admin-required');
    let applied=0;
    for(const row of selected.sort((a,b)=>ROLES.indexOf(a.role)-ROLES.indexOf(b.role))) {
      const account=await auth.getUser(row.authUid);
      if(accountFingerprint(account)!==row.accountFingerprint)throw new Error('reviewed-account-changed');
      await db.runTransaction(async tx=>{
        const sourceRef=db.doc('users/'+row.userId); const user=(await tx.get(sourceRef)).data();
        const principalRef=db.doc('securityPrincipals/'+row.authUid); const current=(await tx.get(principalRef)).data();
        const deletion=await tx.get(db.doc('staffDeletionJobs/'+row.userId));
        if(!user||fingerprint(user)!==row.sourceFingerprint||user.role!==row.role||deletion.exists||
          (current?fingerprint(current):null)!==row.authorityFingerprint)throw new Error('reviewed-source-changed');
        const source=reviewedStaffSource(user,row.userId,row.normalizeSourceUid===true&&normalizationTarget===row.userId);
        const expected=expectedStaffAuthority(source,row.authUid);
        if(!compatibleAuthority(current,expected))throw new Error('protected-authority-conflict');
        if(user.role==='assistant') {
          const owner=(await tx.get(db.doc('users/'+user.createdBy))).data();
          const ownerDeleted=await tx.get(db.doc('staffDeletionJobs/'+user.createdBy));
          const ownerAuthority=owner?.firebaseUid?(await tx.get(db.doc('securityPrincipals/'+owner.firebaseUid))).data():null;
          if(!owner||ownerDeleted.exists||!['admin','doctor'].includes(owner.role)||owner.profileComplete!==true||owner.pending===true||
            !compatibleAuthority(ownerAuthority,expectedStaffAuthority(owner,owner.firebaseUid))||!ownerAuthority)throw new Error('assistant-owner-unavailable');
        }
        tx.update(sourceRef,{...(row.normalizeSourceUid===true?{uid:row.userId}:{}),firebaseUid:row.authUid,pending:false});
        tx.set(principalRef,{...current,...expected,updatedAt:Timestamp.now()});
        writeClinicUserProjections(tx,db,{...source,firebaseUid:row.authUid,pending:false});
      });
      applied++;
    }
    console.log(JSON.stringify({applied}));
  }
}catch(error){
  console.error(JSON.stringify({failed:true,code:typeof error.code==='string'?error.code:'operator-review-required'}));
  process.exitCode=1;
}finally{await db.terminate();await deleteApp(app);}
