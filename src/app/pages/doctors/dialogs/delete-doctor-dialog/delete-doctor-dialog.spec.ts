import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef } from '@angular/material/dialog';
import { DeleteDoctorDialog } from './delete-doctor-dialog';
import { CascadeService } from '../../../../core/services/cascade.service';
import { AlertService } from '../../../../core/services/alert.service';
import { AppUser } from '../../../../core/models/user';

describe('DeleteDoctorDialog', () => {
  const doctor: AppUser = { uid: 'd1', name: 'Doctor de prueba', email: 'doctor@example.invalid', role: 'doctor' };

  function createFixture(user = doctor) {
    const cascade = { deleteDoctorCascade: vi.fn().mockResolvedValue(undefined) };
    const alerts = { success: vi.fn(), error: vi.fn() };
    const dialog = { close: vi.fn(), disableClose: false };
    TestBed.configureTestingModule({
      imports: [DeleteDoctorDialog, NoopAnimationsModule],
      providers: [
        { provide: CascadeService, useValue: cascade },
        { provide: AlertService, useValue: alerts },
        { provide: MatDialogRef, useValue: dialog },
      ],
    });
    const fixture = TestBed.createComponent(DeleteDoctorDialog);
    const component = fixture.componentInstance;
    component.setDoctor(user);
    fixture.detectChanges();
    return { fixture, component, cascade, alerts, dialog };
  }

  it('renders doctor confirmation', () => {
    const { fixture } = createFixture();
    expect(fixture.nativeElement.textContent).toContain('Eliminar doctor');
    expect(fixture.nativeElement.textContent).toContain('también se eliminarán sus asistentes');
    expect(fixture.nativeElement.textContent).toContain('Esta acción no es reversible.');
  });

  it('renders the Admin confirmation and preserves a server refusal to delete the last active Admin (P45)', async () => {
    const { fixture, component, cascade, alerts, dialog } = createFixture();
    component.setDoctor({...doctor,uid:'admin-b',role:'admin'});
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Eliminar administrador');
    const message='Debe permanecer al menos un administrador activo con acceso al sistema.';
    cascade.deleteDoctorCascade.mockRejectedValue({code:'functions/failed-precondition',message});
    await component.confirm();
    expect(alerts.error).toHaveBeenCalledWith({message});
    expect(dialog.close).not.toHaveBeenCalled();
  });

  it('updates assistant labels through signals', () => {
    const { fixture, component } = createFixture();
    component.setDoctor({ ...doctor, uid: 'a1', role: 'assistant' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Eliminar asistente');
    expect(fixture.nativeElement.textContent).toContain('Los pacientes, historiales y citas de la agenda del doctor se conservarán');
    expect(fixture.nativeElement.textContent).not.toContain('también se eliminarán sus asistentes');
  });

  it('closes successfully only after confirmed deletion', async () => {
    const { component, cascade, alerts, dialog } = createFixture();
    await component.confirm();
    expect(cascade.deleteDoctorCascade).toHaveBeenCalledWith('d1');
    expect(alerts.success).toHaveBeenCalledWith({ message: 'Doctor eliminado', duration: 3000 });
    expect(dialog.close).toHaveBeenCalledWith(true);
    expect(dialog.disableClose).toBe(false);
  });

  it('does not submit twice or allow dismissal while deleting', async () => {
    const { fixture, component, cascade, dialog } = createFixture();
    let finish!: () => void;
    cascade.deleteDoctorCascade.mockImplementation(() => new Promise<void>(resolve => finish = resolve));
    const pending = component.confirm();
    await component.confirm();
    component.close();
    component.setDoctor({ ...doctor, uid: 'other' });
    fixture.detectChanges();
    expect(cascade.deleteDoctorCascade).toHaveBeenCalledTimes(1);
    expect(dialog.disableClose).toBe(true);
    expect(dialog.close).not.toHaveBeenCalled();
    const buttons = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    expect(Array.from(buttons).every(button => button.disabled)).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Eliminando…');
    finish();
    await pending;
  });

  it.each([
    ['functions/failed-precondition', 'La baja no está habilitada'],
    ['functions/permission-denied', 'No tienes permiso'],
    ['functions/unauthenticated', 'Inicia sesión nuevamente'],
    ['functions/aborted', 'La baja ya se está procesando'],
    ['functions/internal', 'Su acceso puede estar bloqueado'],
  ])('keeps the dialog and offers the appropriate error for %s', async (code, text) => {
    const { fixture, component, cascade, alerts, dialog } = createFixture();
    cascade.deleteDoctorCascade.mockRejectedValue({ code });
    await component.confirm();
    fixture.detectChanges();
    expect(alerts.error.mock.calls[0][0].message).toContain(text);
    expect(alerts.success).not.toHaveBeenCalled();
    expect(dialog.close).not.toHaveBeenCalled();
    expect(dialog.disableClose).toBe(false);
    expect((fixture.nativeElement.querySelector('.btn-danger') as HTMLButtonElement).disabled).toBe(false);
  });

  it('cancels without deleting', () => {
    const { fixture, cascade, dialog } = createFixture();
    (fixture.nativeElement.querySelector('.btn-tertiary') as HTMLButtonElement).click();
    expect(cascade.deleteDoctorCascade).not.toHaveBeenCalled();
    expect(dialog.close).toHaveBeenCalledWith(false);
  });
});
