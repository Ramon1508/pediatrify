import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {fingerprint,referencedLogoPaths,retentionAction,RETENTION_MS,millis} from './operator-policy.mjs';

const require=createRequire(new URL('../../functions/package.json',import.meta.url));
const {initializeApp,applicationDefault,deleteApp}=require('firebase-admin/app');
const {getFirestore,Timestamp}=require('firebase-admin/firestore');
const {getStorage}=require('firebase-admin/storage');
const {getAuth}=require('firebase-admin/auth');
const args=process.argv.slice(2); const option=key=>{const i=args.indexOf(key);return i<0?undefined:args[i+1];};
const project=option('--project');const database=option('--database');const mode=option('--mode');
const applying=args.includes('--apply');const now=Date.now();
if(!project||database!=='(default)'||!['logos','retention'].includes(mode))throw new Error('Specify project, database (default) and mode logos or retention.');
if(process.env.FIRESTORE_EMULATOR_HOST||process.env.FIREBASE_AUTH_EMULATOR_HOST||process.env.FIREBASE_STORAGE_EMULATOR_HOST)throw new Error('Use isolated policy tests instead of this reviewed operator command.');
const privateRoot=resolve(dirname(fileURLToPath(import.meta.url)),'review-plans');
const output=resolve(option('--plan')??resolve(privateRoot,mode+'.json'));const local=relative(privateRoot,output);
if(local.startsWith('..')||isAbsolute(local))throw new Error('Plan must remain in security/p01/review-plans.');
const bucketName=option('--bucket');if(mode==='logos'&&!bucketName)throw new Error('Specify the reviewed --bucket explicitly.');
const app=initializeApp({projectId:project,credential:applicationDefault()},'p01-trusted-maintenance');
const db=getFirestore(app);const auth=getAuth(app);const bucket=mode==='logos'?getStorage(app).bucket(bucketName):null;
const technicalCollections=['clinicSessions','clinicEmailDeliveries','patientLoginBudgets','staffInvitationRateLimits','staffEmailChangeJobs',
  'staffInvitationIssueJobs','staffInvitations','staffDeletionJobs','patientDeletionJobs'];
async function logoReferences(){
  const users=(await db.collection('users').get()).docs.map(doc=>doc.data());
  // Include every known representation so stale professional projections are conservatively retained.
  const profiles=(await db.collection('doctorProfiles').get()).docs.map(doc=>doc.data());
  return referencedLogoPaths([...users,...profiles]);
}
async function patientSessionCandidate(uid,data){
  if(!/^patient-[a-f0-9]{48}$/.test(uid)||data.role!=='patient'||data.authUid!==uid||millis(data.createdAt)>=now-RETENTION_MS||!Number.isFinite(millis(data.createdAt)))return null;
  if(!(await db.collection('users').where('firebaseUid','==',uid).limit(1).get()).empty)return null;
  const leases=await db.collection('clinicSessions').where('authUid','==',uid).get();
  if(leases.docs.some(doc=>!Number.isFinite(millis(doc.data().expiresAt))||millis(doc.data().expiresAt)>=now-RETENTION_MS))return null;
  return {path:'securityPrincipals/'+uid,action:'patient-session-cleanup',sourceFingerprint:fingerprint(data),approved:false};
}
try{
  if(!applying){
    const rows=[];
    if(mode==='logos'){
      const references=await logoReferences();
      if(references.unresolved)throw new Error('Unresolved legacy logo references require review before any cleanup report.');
      // Explicitly enumerates logos only, never documents or private medical objects.
      for await(const file of bucket.getFilesStream({prefix:'logos/'})){
        const [metadata]=await file.getMetadata();
        if(!references.paths.has(file.name))rows.push({path:file.name,generation:String(metadata.generation),
          metadataFingerprint:fingerprint({generation:metadata.generation,metageneration:metadata.metageneration}),approved:false});
      }
    }else{
      for(const collection of technicalCollections){
        for await(const snapshot of db.collection(collection).stream()){
          const data=snapshot.data();const action=retentionAction(collection,data,now);
          if(action&&(action.action!=='compact'||Object.keys(data).some(key=>!action.fields.includes(key))))rows.push({path:snapshot.ref.path,...action,sourceFingerprint:fingerprint(data),approved:false});
        }
      }
      for await(const snapshot of db.collection('securityPrincipals').where('role','==','patient').stream()){
        const row=await patientSessionCandidate(snapshot.id,snapshot.data());if(row)rows.push(row);
      }
    }
    await mkdir(privateRoot,{recursive:true});
    await writeFile(output,JSON.stringify({schema:1,kind:mode,project,database,...(bucketName?{bucket:bucketName}:{}),createdAt:new Date(now).toISOString(),retentionDays:30,rows},null,2)+'\n',{encoding:'utf8',flag:'wx'});
    console.log(JSON.stringify({prepared:true,candidates:rows.length,applied:0}));
  }else{
    if(!args.includes('--reviewed'))throw new Error('Review the plan and mark approved rows before --apply --reviewed.');
    if(mode==='logos'&&!args.includes('--writers-stopped'))throw new Error('Stop competing profile/print writers before manually removing logos.');
    const plan=JSON.parse(await readFile(output,'utf8'));
    if(plan.schema!==1||plan.kind!==mode||plan.project!==project||plan.database!==database||plan.bucket!==bucketName||!Array.isArray(plan.rows))throw new Error('plan-environment-mismatch');
    let applied=0;
    for(const row of plan.rows.filter(row=>row.approved===true)){
      if(mode==='logos'){
        if(typeof row.path!=='string'||!row.path.startsWith('logos/'))throw new Error('unsupported-object-path');
        const references=await logoReferences();if(references.unresolved||references.paths.has(row.path))throw new Error('logo-now-referenced');
        const file=bucket.file(row.path);const [metadata]=await file.getMetadata();
        if(fingerprint({generation:metadata.generation,metageneration:metadata.metageneration})!==row.metadataFingerprint)throw new Error('reviewed-object-changed');
        await file.delete({ifGenerationMatch:row.generation});
      }else if(row.action==='patient-session-cleanup'){
        const uid=row.path?.split('/')[1];
        if(row.path!=='securityPrincipals/'+uid||!/^patient-[a-f0-9]{48}$/.test(uid??''))throw new Error('unsupported-session-path');
        const ref=db.doc(row.path);const current=(await ref.get()).data();
        if(!current||fingerprint(current)!==row.sourceFingerprint||!await patientSessionCandidate(uid,current))throw new Error('reviewed-session-changed');
        // Block first; a sleeping tab cannot refresh this identity during subsequent cleanup.
        await db.runTransaction(async tx=>{
          const source=(await tx.get(ref)).data();const leases=await tx.get(db.collection('clinicSessions').where('authUid','==',uid));
          const staff=await tx.get(db.collection('users').where('firebaseUid','==',uid).limit(1));
          if(!source||fingerprint(source)!==row.sourceFingerprint||!staff.empty||leases.docs.some(doc=>!Number.isFinite(millis(doc.data().expiresAt))||millis(doc.data().expiresAt)>=now-RETENTION_MS))throw new Error('reviewed-session-changed');
          tx.update(ref,{active:false,revokedAt:Timestamp.fromMillis(now)});
        });
        if(current.serverOnly!==true){try{await auth.deleteUser(uid);}catch(error){if(error.code!=='auth/user-not-found')throw error;}}
        await db.recursiveDelete(db.doc('familyAccess/'+uid));
        const leases=await db.collection('clinicSessions').where('authUid','==',uid).get();
        for(const lease of leases.docs)await lease.ref.delete();
        await ref.delete();
      }else{
        const collection=row.path?.split('/')[0];
        if(!technicalCollections.includes(collection)||row.path.split('/').length!==2)throw new Error('unsupported-technical-path');
        await db.runTransaction(async tx=>{
          const ref=db.doc(row.path);const data=(await tx.get(ref)).data();const action=data?retentionAction(collection,data,now):null;
          if(!data||fingerprint(data)!==row.sourceFingerprint||fingerprint(action)!==fingerprint({action:row.action,...(row.fields?{fields:row.fields}:{}),...(row.marker?{marker:row.marker}:{})}))throw new Error('reviewed-document-changed');
          if(action.action==='delete')tx.delete(ref);
          else tx.set(ref,{...Object.fromEntries(action.fields.filter(field=>data[field]!==undefined).map(field=>[field,data[field]])),...(action.marker??{})});
        });
      }
      applied++;
    }
    console.log(JSON.stringify({applied}));
  }
}catch(error){
  console.error(JSON.stringify({failed:true,code:typeof error.code==='string'?error.code:'operator-review-required'}));
  process.exitCode=1;
}finally{await db.terminate();await deleteApp(app);}
