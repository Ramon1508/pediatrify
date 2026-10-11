import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../functions/package.json',import.meta.url));
const {validateNewClinicPatient,clinicServerDate,createClinicPatientRecord}=require('./lib/clinic-patients.js');
const now=Date.parse('2026-10-10T04:30:00Z');
const base={name:'Paciente',lastName:'Ejemplo',birthDate:'2020-01-01',email:' FAMILY@example.test ',secondaryEmail:' SECOND@example.test ',
  fatherName:'Tutor',motherName:'Tutora',phone:'5555555555'};
test('new basic registration normalizes contacts and respects Mexico City civil day',()=> {
  const result=validateNewClinicPatient(base,now);
  assert.equal(result.email,'family@example.test');assert.equal(result.secondaryEmail,'second@example.test');
  assert.equal(clinicServerDate(now),'2026-10-09');
  assert.doesNotThrow(()=>validateNewClinicPatient({...base,lastName:'',birthDate:'2026-10-09'},now));
  assert.throws(()=>validateNewClinicPatient({...base,birthDate:'2026-10-10'},now),{code:'invalid-argument'});
});
test('registration rejects forged authority, clinical data and caller passwords',()=> {
  for(const field of ['doctorId','id','otpPassword','password','role','diagnosis','vaccinationRecord','createdAt','updatedBy']) {
    assert.throws(()=>validateNewClinicPatient({...base,[field]:'forged'},now),{code:'invalid-argument'});
  }
});
test('registration enforces both tutors, valid dates/emails and the ten-digit phone used by the form',()=> {
  for(const patch of [{fatherName:''},{motherName:' '},{name:''},{phone:'short'},{phone:'abcde fghi'},
    {phone:'55555555555'},{phone:'555555555'},{email:'invalid'},
    {secondaryEmail:'invalid'},{birthDate:'2026-02-30'},{birthDate:'bad'},{phone:1234}]) {
    assert.throws(()=>validateNewClinicPatient({...base,...patch},now),{code:'invalid-argument'});
  }
  assert.doesNotThrow(()=>validateNewClinicPatient({...base,phone:'5555555555'},now));
});
test('gate and request schema reject before accessing identities or a database',async()=> {
  const untouched=new Proxy({}, {get:()=>{throw new Error('No SDK access expected');}});
  await assert.rejects(createClinicPatientRecord(untouched,untouched,'Bearer synthetic',{},
    {enabled:false,encryptionSecret:'',uniquenessSecret:''}),{code:'failed-precondition'});
  for(const input of [{operationId:'../escape',patient:base},{operationId:'op',patient:base,doctorId:'forged'},
    {operationId:'op',patient:base,confirmedDuplicates:['forged']}]) {
    await assert.rejects(createClinicPatientRecord(untouched,untouched,'Bearer synthetic',input,
      {enabled:true,encryptionSecret:'',uniquenessSecret:'',now}),{code:'invalid-argument'});
  }
});
