import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef } from '@angular/material/dialog';
import { ViewOtpDialog } from './view-otp-dialog';
import { PatientAccessService } from '../../../../core/services/patient-access.service';
import { AlertService } from '../../../../core/services/alert.service';
import { Patient } from '../../../../core/models/user';

describe('ViewOtpDialog', () => {
  const patient = { id: 'synthetic-child', name: 'Paciente', lastName: 'Ejemplo', otpPassword: 'DO_NOT_USE_CACHE' } as Patient;
  function setup() {
    const access = { read: vi.fn().mockResolvedValue({ password: 'SYN234', credentialVersion: 1, credentialEpoch: 'a'.repeat(32) }) };
    const alert = { success: vi.fn(), error: vi.fn() };
    const dialog = { close: vi.fn() };
    TestBed.configureTestingModule({ imports: [ViewOtpDialog, NoopAnimationsModule], providers: [
      { provide: PatientAccessService, useValue: access }, { provide: AlertService, useValue: alert },
      { provide: MatDialogRef, useValue: dialog },
    ] });
    const fixture=TestBed.createComponent(ViewOtpDialog);const component=fixture.componentInstance as any;
    return {fixture,component,access,alert,dialog};
  }
  it('loads the protected current password instead of a patient document or cache',async()=> {
    const {fixture,component,access}=setup();component.setPatient(patient);fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Consultando');
    expect(fixture.nativeElement.textContent).not.toContain(patient.otpPassword);
    await fixture.whenStable();fixture.detectChanges();
    expect(access.read).toHaveBeenCalledExactlyOnceWith(patient.id);
    expect(fixture.nativeElement.textContent).toContain('SYN234');
    expect(fixture.nativeElement.textContent).toContain('Paciente Ejemplo');
  });
  it('has no password input, manual edit or save action',async()=> {
    const {fixture,component}=setup();component.setPatient(patient);await fixture.whenStable();fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('input')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Editar');
    expect(fixture.nativeElement.textContent).not.toContain('Guardar');
  });
  it('distinguishes an access error and retries without displaying cached credentials',async()=> {
    const {fixture,component,access}=setup();access.read.mockRejectedValueOnce(new Error('denied'));
    component.setPatient(patient);await fixture.whenStable();fixture.detectChanges();
    expect(component.loadFailed()).toBe(true);expect(component.password()).toBe('');
    const retry=Array.from(fixture.nativeElement.querySelectorAll('button')).find((b:any)=>b.textContent.includes('Reintentar')) as HTMLButtonElement;
    retry.click();await fixture.whenStable();fixture.detectChanges();
    expect(component.password()).toBe('SYN234');expect(component.loadFailed()).toBe(false);
  });
  it('ignores a late response from a different patient',async()=> {
    const {component,access}=setup();let finish!:(value:any)=>void;
    access.read.mockReturnValueOnce(new Promise(resolve=>{finish=resolve;}));
    component.setPatient(patient);component.setPatient({...patient,id:'second-child'});
    await Promise.resolve();await Promise.resolve();finish({password:'OLD234'});await Promise.resolve();
    expect(component.password()).toBe('SYN234');
  });
  it('clears the password and ignores pending responses when closing or destroying',async()=> {
    const {fixture,component,access,dialog}=setup();let finish!:(value:any)=>void;
    access.read.mockReturnValueOnce(new Promise(resolve=>{finish=resolve;}));
    component.setPatient(patient);component.close();fixture.destroy();finish({password:'LATE234'});await Promise.resolve();
    expect(component.password()).toBe('');expect(dialog.close).toHaveBeenCalledWith(false);
  });
  it('copies only the confirmed value and reports success after clipboard resolution',async()=> {
    const {fixture,component,alert}=setup();component.setPatient(patient);await fixture.whenStable();
    const writeText=vi.fn().mockResolvedValue(undefined);Object.assign(navigator,{clipboard:{writeText}});
    await component.copyOtp();expect(writeText).toHaveBeenCalledExactlyOnceWith('SYN234');
    expect(alert.success).toHaveBeenCalledWith({message:'Copiado al portapapeles',duration:2000});
  });
  it('reports a clipboard failure without a false success',async()=> {
    const {fixture,component,alert}=setup();component.setPatient(patient);await fixture.whenStable();
    Object.assign(navigator,{clipboard:{writeText:vi.fn().mockRejectedValue(new Error('blocked'))}});
    await component.copyOtp();expect(alert.error).toHaveBeenCalled();expect(alert.success).not.toHaveBeenCalled();
    expect(component.copying()).toBe(false);
  });
});
