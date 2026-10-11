import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { PatientProfile } from './patient-profile';
import { Patient, SessionUser } from '../../../core/models/user';
import { AuthService } from '../../../core/services/auth.service';
import { AlertService } from '../../../core/services/alert.service';
import { PatientRepository } from '../../../core/repositories/patient.repository';

const child: Patient = {
  id: 'synthetic-child', doctorId: 'synthetic-doctor', name: 'Paciente', lastName: 'de prueba',
  birthDate: '2020-01-01', email: 'primary@example.test', secondaryEmail: 'family@example.test',
  fatherName: 'Tutor ficticio', motherName: 'Tutora ficticia', phone: '5550000000', otpPassword: 'synthetic-secret',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('PatientProfile (P15)', () => {
  let fixture: ComponentFixture<PatientProfile>;
  let sessions: BehaviorSubject<SessionUser>;
  let repository: { getChildrenGroup: ReturnType<typeof vi.fn> };
  let dialogRef: { close: ReturnType<typeof vi.fn>; disableClose: boolean };
  let router: { navigate: ReturnType<typeof vi.fn> };
  let alert: { error: ReturnType<typeof vi.fn> };
  let auth: { session$: BehaviorSubject<SessionUser>; readonly session: SessionUser; logout: ReturnType<typeof vi.fn> };

  function setup(options: { session?: SessionUser; page?: boolean; dialog?: boolean } = {}) {
    sessions = new BehaviorSubject<SessionUser>(options.session === undefined
      ? { type: 'patient', patient: child, loginEmail: ' Family@Example.Test ' } : options.session);
    repository = { getChildrenGroup: vi.fn().mockResolvedValue([child]) };
    dialogRef = { close: vi.fn(), disableClose: false };
    router = { navigate: vi.fn().mockResolvedValue(true) };
    alert = { error: vi.fn() };
    auth = { session$: sessions, get session() { return sessions.value; }, logout: vi.fn().mockImplementation(async () => sessions.next(null)) };
    TestBed.configureTestingModule({
      imports: [PatientProfile, NoopAnimationsModule],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: PatientRepository, useValue: repository },
        { provide: Router, useValue: router },
        { provide: AlertService, useValue: alert },
        ...(options.dialog === false ? [] : [{ provide: MatDialogRef, useValue: dialogRef }]),
      ],
    });
    fixture = TestBed.createComponent(PatientProfile);
    fixture.componentRef.setInput('asPage', options.page ?? false);
  }

  const content = () => fixture.nativeElement.textContent as string;
  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
  }
  function button(label: string): HTMLButtonElement {
    return [...fixture.nativeElement.querySelectorAll('button')].find((el: any) => el.textContent.includes(label)) as HTMLButtonElement;
  }

  it('shows the actual secondary login email and associated children in read-only mode', async () => {
    setup();
    const sibling = { ...child, id: 'synthetic-sibling', name: 'Segundo', lastName: 'paciente' };
    repository.getChildrenGroup.mockResolvedValue([child, sibling]);
    fixture.detectChanges();
    await settle();
    expect(repository.getChildrenGroup).toHaveBeenCalledWith('family@example.test', 'synthetic-doctor');
    expect(content()).toContain('family@example.test');
    expect(content()).toContain('Paciente de prueba');
    expect(content()).toContain('Segundo paciente');
    expect(content()).not.toContain('synthetic-secret');
    expect(content()).not.toContain('Tutor ficticio');
    expect(content()).not.toContain('Asistente');
    expect(content()).not.toContain('Editar');
    expect(fixture.nativeElement.querySelector('input, form, app-file-upload')).toBeNull();
  });

  it('falls back to the primary email when the cached patient session has no login email', async () => {
    setup({ session: { type: 'patient', patient: child } });
    fixture.detectChanges(); await settle();
    expect(repository.getChildrenGroup).toHaveBeenCalledWith(child.email, child.doctorId);
    expect(content()).toContain(child.email);
  });

  it('excludes another doctor, another family and duplicated patients from display', async () => {
    setup();
    repository.getChildrenGroup.mockResolvedValue([
      child, child, { ...child, id: 'foreign', name: 'Foreign', doctorId: 'other-doctor' },
      { ...child, id: 'other-family', name: 'OtherFamily', email: 'other@example.test', secondaryEmail: '' },
      { ...child, id: 'unassigned', name: 'Unassigned', doctorId: undefined },
    ]);
    fixture.detectChanges(); await settle();
    expect(fixture.nativeElement.querySelectorAll('.patient-list li').length).toBe(1);
    expect(content()).not.toContain('Foreign');
    expect(content()).not.toContain('OtherFamily');
    expect(content()).not.toContain('Unassigned');
  });

  it('shows a loading state until the group read completes', async () => {
    setup(); const read = deferred<Patient[]>();
    repository.getChildrenGroup.mockReturnValue(read.promise);
    fixture.detectChanges();
    expect(content()).toContain('Cargando pacientes asociados');
    expect(content()).not.toContain('No hay pacientes asociados');
    read.resolve([child]); await settle();
    expect(content()).toContain('Paciente de prueba');
    expect(content()).not.toContain('Cargando pacientes asociados');
  });

  it('distinguishes an empty family from a read error and permits retry after failure', async () => {
    setup(); repository.getChildrenGroup.mockRejectedValueOnce(new Error('permission-denied'));
    fixture.detectChanges(); await settle();
    expect(content()).toContain('No fue posible cargar');
    expect(content()).not.toContain('No hay pacientes asociados');
    repository.getChildrenGroup.mockResolvedValue([]);
    button('Reintentar').click(); await settle();
    expect(content()).toContain('No hay pacientes asociados a este acceso.');
    expect(content()).not.toContain('No fue posible cargar');
    expect(repository.getChildrenGroup).toHaveBeenCalledTimes(2);
  });

  it('does not query patients when the session has no doctor association', async () => {
    setup({ session: { type: 'patient', patient: { ...child, doctorId: undefined } } });
    fixture.detectChanges(); await settle();
    expect(repository.getChildrenGroup).not.toHaveBeenCalled();
    expect(content()).toContain('Consulta al consultorio');
    expect(content()).not.toContain('No hay pacientes asociados');
  });

  it('clears private data and discards a late result after logout', async () => {
    setup(); const read = deferred<Patient[]>();
    repository.getChildrenGroup.mockReturnValue(read.promise);
    fixture.detectChanges();
    sessions.next(null); fixture.detectChanges();
    read.resolve([child]); await settle();
    expect(content()).not.toContain('family@example.test');
    expect(content()).not.toContain('Paciente de prueba');
    expect(content()).toContain('No hay una sesión de Paciente activa');
    expect(button('Cerrar sesión')).toBeUndefined();
  });

  it('keeps only the new family when patient sessions change during a read', async () => {
    setup(); const oldRead = deferred<Patient[]>();
    const newChild = { ...child, id: 'new-child', doctorId: 'new-doctor', email: 'new@example.test', secondaryEmail: '', name: 'Nueva', lastName: 'familia' };
    repository.getChildrenGroup.mockReturnValueOnce(oldRead.promise).mockResolvedValueOnce([newChild]);
    fixture.detectChanges();
    sessions.next({ type: 'patient', patient: newChild, loginEmail: newChild.email });
    await settle();
    oldRead.resolve([child]); await settle();
    expect(content()).toContain('Nueva familia');
    expect(content()).toContain('new@example.test');
    expect(content()).not.toContain('Paciente de prueba');
    expect(content()).not.toContain('family@example.test');
  });

  it('does not restore patient data or query again after the view is destroyed', async () => {
    setup(); const read = deferred<Patient[]>();
    repository.getChildrenGroup.mockReturnValue(read.promise);
    fixture.detectChanges(); fixture.destroy();
    read.resolve([child]); await read.promise;
    sessions.next({ type: 'patient', patient: child });
    expect(repository.getChildrenGroup).toHaveBeenCalledTimes(1);
    expect((fixture.componentInstance as any).patients()).toEqual([]);
  });

  it('renders as a full page without requiring a dialog provider', async () => {
    setup({ page: true, dialog: false }); fixture.detectChanges(); await settle();
    expect(fixture.nativeElement.querySelector('.page-mode')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-label="Cerrar perfil"]')).toBeNull();
    expect(button('Cerrar sesión')).toBeDefined();
  });

  it('closing the desktop profile preserves the session', async () => {
    setup(); fixture.detectChanges(); await settle();
    fixture.nativeElement.querySelector('[aria-label="Cerrar perfil"]').click();
    expect(dialogRef.close).toHaveBeenCalledTimes(1);
    expect(auth.logout).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it.each([false, true])('ends the patient session and returns to patient login (page: %s)', async page => {
    setup({ page, dialog: !page }); fixture.detectChanges(); await settle();
    button('Cerrar sesión').click(); await settle();
    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(auth.session).toBeNull();
    expect(dialogRef.close).toHaveBeenCalledTimes(page ? 0 : 1);
    expect(router.navigate).toHaveBeenCalledWith(['/patient-login']);
    expect(content()).not.toContain('family@example.test');
  });

  it('blocks repeated logout and dialog closing during logout', async () => {
    setup(); const signOut = deferred<void>();
    auth.logout.mockReturnValue(signOut.promise);
    fixture.detectChanges(); await settle();
    button('Cerrar sesión').click(); fixture.detectChanges();
    expect(button('Cerrar sesión').disabled).toBe(true);
    expect(dialogRef.disableClose).toBe(true);
    fixture.nativeElement.querySelector('[aria-label="Cerrar perfil"]').click();
    void (fixture.componentInstance as any).logout();
    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(dialogRef.close).not.toHaveBeenCalled();
    sessions.next(null); signOut.resolve(); await settle();
    expect(dialogRef.disableClose).toBe(false);
  });

  it('still returns to patient login when the portal closes its dialogs on session removal', async () => {
    setup(); fixture.detectChanges(); await settle();
    const subscription = sessions.subscribe(session => {
      if (!session) fixture.destroy();
    });
    await (fixture.componentInstance as any).logout();
    expect(router.navigate).toHaveBeenCalledWith(['/patient-login']);
    subscription.unsubscribe();
  });

  it('keeps the profile open and permits retry if logout fails', async () => {
    setup(); auth.logout.mockRejectedValueOnce(new Error('synthetic failure'));
    fixture.detectChanges(); await settle();
    button('Cerrar sesión').click(); await settle();
    expect(alert.error).toHaveBeenCalledWith(expect.objectContaining({ message: 'No fue posible cerrar sesión. Intenta nuevamente.' }));
    expect(button('Cerrar sesión').disabled).toBe(false);
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('never logs out staff from a stale patient view or navigates away from a new staff session', async () => {
    setup(); const signOut = deferred<void>(); auth.logout.mockReturnValue(signOut.promise);
    fixture.detectChanges(); await settle();
    button('Cerrar sesión').click();
    sessions.next({ type: 'doctor', user: { uid: 'new-staff', role: 'doctor', name: 'Personal ficticio', email: 'staff@example.test' } });
    signOut.resolve(); await settle();
    expect(router.navigate).not.toHaveBeenCalled();
    await (fixture.componentInstance as any).logout();
    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(content()).not.toContain('family@example.test');
    expect(content()).not.toContain('Paciente de prueba');
  });
});
