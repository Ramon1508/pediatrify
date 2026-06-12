import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef } from '@angular/material/dialog';
import { InviteDoctorDialog } from './invite-doctor-dialog';
import { FirebaseService } from '../../../../core/firebase/firebase.service';
import { AlertService } from '../../../../core/services/alert.service';
import { Clipboard } from '@angular/cdk/clipboard';

describe('InviteDoctorDialog', () => {
  function createFixture() {
    const firebaseService = { firestore: {} } as any;
    const alertService = { success: vi.fn(), error: vi.fn() };
    const clipboard = { copy: vi.fn() };
    const dialogRef = { close: vi.fn() };

    TestBed.configureTestingModule({
      imports: [InviteDoctorDialog, NoopAnimationsModule],
      providers: [
        { provide: FirebaseService, useValue: firebaseService },
        { provide: AlertService, useValue: alertService },
        { provide: Clipboard, useValue: clipboard },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    });

    const fixture = TestBed.createComponent(InviteDoctorDialog);
    const component = fixture.componentInstance as any;
    fixture.detectChanges();
    return { fixture, component, alertService, clipboard, dialogRef };
  }

  it('renders title', () => {
    const { fixture } = createFixture();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Invitar asistente');
  });

  it('renders form fields', () => {
    const { fixture } = createFixture();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Nombre completo');
    expect(el.textContent).toContain('Correo electrónico');
    expect(el.textContent).toContain('Rol del usuario');
  });

  it('defaults role to employee', () => {
    const { component } = createFixture();
    expect(component.form.value.role).toBe('employee');
  });

  it('shows admin/employee role options', () => {
    const { component } = createFixture();
    expect(component.roles).toEqual([
      { value: 'admin', label: 'Administrador' },
      { value: 'employee', label: 'Asistente' },
    ]);
  });

  it('validates empty form on submit', () => {
    const { component } = createFixture();
    component.submitted = true;
    expect(component.form.invalid).toBe(true);
  });

  it('shows create invitation button', () => {
    const { fixture } = createFixture();
    const btns = fixture.nativeElement.querySelectorAll('button');
    const texts = Array.from(btns).map((b: any) => b.textContent.trim());
    expect(texts.some((t) => t.includes('Crear invitación'))).toBe(true);
  });

  it('closes dialog on close()', () => {
    const { component, dialogRef } = createFixture();
    component.close();
    expect(dialogRef.close).toHaveBeenCalled();
  });
});
