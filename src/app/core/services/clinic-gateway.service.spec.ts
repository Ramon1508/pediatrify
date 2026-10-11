import {TestBed} from '@angular/core/testing';
import {Timestamp} from 'firebase/firestore';
import {ClinicGatewayService, ClinicSessionResponse} from './clinic-gateway.service';
import {FirebaseService} from '../firebase/firebase.service';
const {transport}=vi.hoisted(()=>({transport:vi.fn()}));
vi.mock('firebase/functions',()=>({getFunctions:vi.fn(()=>({})),httpsCallable:vi.fn(()=>transport)}));
describe('Verified clinic gateway',()=>{
  let gateway:ClinicGatewayService;
  const session=():ClinicSessionResponse=>({principal:{authUid:'auth',userId:'doctor',doctorId:'doctor',role:'doctor',active:true},
    lease:{id:'first-device',expiresAt:Date.now()+3600000},
    session:{type:'doctor',user:{uid:'doctor',firebaseUid:'auth',role:'doctor',name:'Ficticio',email:'doctor@example.test',profileComplete:true}}});
  beforeEach(()=>{
    transport.mockReset();
    TestBed.configureTestingModule({providers:[{provide:FirebaseService,useValue:{auth:{app:{},currentUser:{uid:'auth'}}}}]});
    gateway=TestBed.inject(ClinicGatewayService);
  });
  afterEach(()=>TestBed.resetTestingModule());
  it('accepts a matching server session and rejects expired or mismatched identities',async()=>{
    transport.mockResolvedValue({data:session()});expect((await gateway.loadSession()).principal.userId).toBe('doctor');
    const changes:Array<(value:ClinicSessionResponse)=>void>=[value=>{value.lease.expiresAt=Date.now();},
      value=>{if(value.session.type==='doctor')value.session.user.uid='other';},
      value=>{if(value.session.type==='doctor')value.session.user.role='admin';},value=>{value.principal.authUid='other';}];
    for(const change of changes){
      const value=session();change(value);transport.mockResolvedValue({data:value});await expect(gateway.loadSession()).rejects.toThrow('verificarse');
    }
  });
  it('preserves the operation ID across uncertain transport and uses a new one after confirmed success',async()=>{
    gateway.publish(session());transport.mockRejectedValueOnce(new Error('network')).mockResolvedValue({data:{saved:true}});
    await expect(gateway.mutate('patient.update','child',{name:'Ficticio'})).rejects.toThrow('network');
    await gateway.mutate('patient.update','child',{name:'Ficticio'});
    const first=transport.mock.calls[0][0].operationId;expect(transport.mock.calls[1][0].operationId).toBe(first);
    await gateway.mutate('patient.update','child',{name:'Ficticio'});expect(transport.mock.calls[2][0].operationId).not.toBe(first);
  });
  it('a different device never inherits an uncertain operation from the prior session',async()=>{
    gateway.publish(session());transport.mockRejectedValueOnce(new Error('network')).mockResolvedValue({data:{saved:true}});
    await expect(gateway.mutate('patient.update','child',{name:'Ficticio'})).rejects.toThrow();
    const newer=session();newer.lease.id='new-device';gateway.publish(newer);
    await gateway.mutate('patient.update','child',{name:'Ficticio'});
    expect(transport.mock.calls[1][0].operationId).not.toBe(transport.mock.calls[0][0].operationId);
    gateway.clear();await expect(gateway.mutate('patient.update','child',{})).rejects.toThrow('Inicia sesión');
    expect(transport).toHaveBeenCalledTimes(2);
  });
  it('discards an older family response when the login lease changes',async()=>{
    const value=session();value.principal={authUid:'auth',role:'patient',patientId:'child',doctorId:'doctor',active:true};gateway.publish(value);
    let resolve!: (value:unknown)=>void;transport.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
    const pending=gateway.getFamily();const newer={...value,lease:{...value.lease,id:'new-device'}};gateway.publish(newer);
    resolve({data:{patients:[{id:'child',doctorId:'doctor',name:'Ficticio'}]}});
    expect(await pending).toEqual([]);expect(gateway.family()).toEqual([]);
  });
  it('restores callable timestamps without publishing an unverified identity',async()=>{
    transport.mockResolvedValue({data:{createdAt:{_seconds:100,_nanoseconds:12}}});
    const result=await gateway.call<{createdAt:Timestamp}>('synthetic',{});
    expect(result.createdAt).toBeInstanceOf(Timestamp);expect(result.createdAt.seconds).toBe(100);expect(gateway.principal()).toBeNull();
  });
  it('Patient calls use only an opaque in-memory bearer and cannot invoke staff endpoints',async()=>{
    const token='a'.repeat(48)+'.'+'b'.repeat(64);
    const store=vi.spyOn(Storage.prototype,'setItem');
    gateway.openPatient(token); transport.mockResolvedValue({data:{value:[]}});
    expect(await gateway.patientRead('appointments')).toEqual([]);
    expect(transport).toHaveBeenCalledWith({sessionToken:token,action:'appointments',data:{}});
    await expect(gateway.call('renewClinicPatientAccess',{patientId:'child'})).rejects.toThrow('no está disponible');
    expect(store).not.toHaveBeenCalled(); store.mockRestore();
    gateway.clear(); await expect(gateway.patientRead('appointments')).rejects.toThrow('Ingresa nuevamente');
  });
  it('a captured server logout still revokes after local state is cleared',async()=>{
    const token='a'.repeat(48)+'.'+'b'.repeat(64);
    gateway.openPatient(token); const close=gateway.capturePatientClose(); gateway.clear();
    transport.mockResolvedValue({data:{updated:true}}); await close?.();
    expect(transport).toHaveBeenCalledWith({sessionToken:token,action:'touch',data:{close:true}});
  });
  it('discards a late Patient read after logout instead of exposing it in another session',async()=>{
    gateway.openPatient('a'.repeat(48)+'.'+'b'.repeat(64));
    let resolve!:(data:unknown)=>void;
    transport.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
    const pending=gateway.patientRead('appointments'); gateway.clear();
    resolve({data:{value:[{id:'old-session-visit'}]}});
    await expect(pending).rejects.toThrow('La sesión cambió');
  });
});
