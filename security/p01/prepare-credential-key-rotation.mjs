import {createRequire} from 'node:module';
import {randomBytes} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {fingerprint} from './operator-policy.mjs';
import {credentialContextFingerprint,rotateCredentialKeys,reservationBelongsTo,applyReviewedCredentialRotation,validateRotationKeys} from './credential-key-policy.mjs';

// Offline trusted maintenance only. This command never sets or reads Secret Manager values.
const require=createRequire(new URL('../../functions/package.json',import.meta.url));
const {initializeApp,applicationDefault,deleteApp}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const args=process.argv.slice(2);const option=key=>{const i=args.indexOf(key);return i<0?undefined:args[i+1];};
const project=option('--project');const database=option('--database');const applying=args.includes('--apply');
if(!project||database!=='(default)'||!args.includes('--writers-stopped'))throw new Error('Specify project, database (default), and confirm stopped writers.');
if(process.env.FIRESTORE_EMULATOR_HOST||process.env.FIREBASE_AUTH_EMULATOR_HOST)throw new Error('Use isolated policy tests instead of this reviewed operator command.');
const privateRoot=resolve(dirname(fileURLToPath(import.meta.url)),'review-plans');
const output=resolve(option('--plan')??resolve(privateRoot,'credential-key-rotation.json'));const local=relative(privateRoot,output);
if(local.startsWith('..')||isAbsolute(local))throw new Error('Plan must remain under security/p01/review-plans.');
const keys={previousEncryption:process.env.P01_PREVIOUS_ENCRYPTION_KEY,nextEncryption:process.env.P01_NEXT_ENCRYPTION_KEY,
  previousUniqueness:process.env.P01_PREVIOUS_UNIQUENESS_KEY,nextUniqueness:process.env.P01_NEXT_UNIQUENESS_KEY};
validateRotationKeys(keys);
const app=initializeApp({projectId:project,credential:applicationDefault()},'p01-trusted-key-rotation');
const db=getFirestore(app);
try{
  if(!applying){
    const rotationId=randomBytes(16).toString('hex');const rows=[];const seen=new Set();
    for await(const snapshot of db.collection('patientCredentials').stream()){
      const credential=snapshot.data();const rotated=rotateCredentialKeys(credential,keys,rotationId);
      if(snapshot.id!==credential.patientId||seen.has(rotated.nextFingerprint))throw new Error('credential-ownership-or-uniqueness-invalid');
      const old=(await db.doc('patientPasswordReservations/'+credential.passwordFingerprint).get()).data();
      const next=(await db.doc('patientPasswordReservations/'+rotated.nextFingerprint).get()).data();
      if(!reservationBelongsTo(old,credential)||next&&!reservationBelongsTo(next,credential))throw new Error('reservation-conflict');
      seen.add(rotated.nextFingerprint);
      rows.push({patientId:snapshot.id,sourceFingerprint:fingerprint(credential),contextFingerprint:credentialContextFingerprint(credential),
        previousFingerprint:credential.passwordFingerprint,nextFingerprint:rotated.nextFingerprint,approved:false});
    }
    await mkdir(privateRoot,{recursive:true});
    await writeFile(output,JSON.stringify({schema:1,kind:'credential-key-rotation',project,database,rotationId,
      createdAt:new Date().toISOString(),rows},null,2)+'\n',{encoding:'utf8',flag:'wx'});
    console.log(JSON.stringify({prepared:true,credentials:rows.length,applied:0}));
  }else{
    if(!args.includes('--reviewed'))throw new Error('Review every row before --apply --reviewed.');
    const plan=JSON.parse(await readFile(output,'utf8'));
    if(plan.schema!==1||plan.kind!=='credential-key-rotation'||plan.project!==project||plan.database!==database||
      !/^[a-f0-9]{32}$/.test(plan.rotationId)||!Array.isArray(plan.rows)||plan.rows.some(row=>row.approved!==true)||
      new Set(plan.rows.map(row=>row.patientId)).size!==plan.rows.length)throw new Error('reviewed-plan-invalid');
    const currentIds=(await db.collection('patientCredentials').select().get()).docs.map(doc=>doc.id).sort();
    if(fingerprint(currentIds)!==fingerprint(plan.rows.map(row=>row.patientId).sort()))throw new Error('credential-set-changed');
    let applied=0;
    for(const row of plan.rows){
      await applyReviewedCredentialRotation(db,row,keys,plan.rotationId);
      applied++;
    }
    // Verify the entire reviewed set before an operator deploys the new secret versions.
    for(const row of plan.rows){
      const credential=(await db.doc('patientCredentials/'+row.patientId).get()).data();
      if(!credential||!rotateCredentialKeys(credential,keys,plan.rotationId).alreadyRotated)throw new Error('rotation-incomplete');
    }
    console.log(JSON.stringify({completed:true,credentials:applied,secretsUpdated:false}));
  }
}catch(error){
  console.error(JSON.stringify({failed:true,code:typeof error.code==='string'?error.code:'operator-review-required'}));process.exitCode=1;
}finally{await db.terminate();await deleteApp(app);}
