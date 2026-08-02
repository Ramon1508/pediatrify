import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef } from '@angular/material/dialog';
import { InviteDoctorDialog } from './invite-doctor-dialog';
import { FirebaseService } from '../../../../core/firebase/firebase.service';
import { AuthService } from '../../../../core/services/auth.service';
import { AlertService } from '../../../../core/services/alert.service';
import { Clipboard } from '@angular/cdk/clipboard';

vi.mock('firebase/firestore', () => ({
  setDoc: vi.fn().mockResolvedValue(undefined),
  doc: vi.fn().mockReturnValue({}),
  Timestamp: { now: vi.fn().mockReturnValue({}) },
}));

describe('InviteDoctorDialog', () => {
  function createFixture(inviterRole = 'doctor') {
    const firebaseService = { firestore: {} } as any;
    const authService = { currentDoctor: { uid: 'admin1', role: inviterRole } } as any;
    const alertService = { success: vi.fn(), error: vi.fn() };
    const clipboard = { copy: vi.fn() };
    const dialogRef = { close: vi.fn() };

    TestBed.configureTestingModule({
      imports: [InviteDoctorDialog, NoopAnimationsModule],
      providers: [
        { provide: FirebaseService, useValue: firebaseService },
        { provide: AuthService, useValue: authService },
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

  it('admin invites a doctor (title + role)', () => {
    const { fixture, component } = createFixture('admin');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Invitar doctor');
    expect(component.targetRole).toBe('doctor');
  });

  it('doctor invites an assistant (title + role)', () => {
    const { fixture, component } = createFixture('doctor');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Invitar asistente');
    expect(component.targetRole).toBe('assistant');
  });

  it('renders form fields without role selector', () => {
    const { fixture } = createFixture('doctor');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Nombre completo');
    expect(el.textContent).toContain('Correo electrónico');
    expect(el.textContent).not.toContain('Rol del usuario');
  });

  it('validates empty form on submit', () => {
    const { component } = createFixture('doctor');
    component.submitted = true;
    expect(component.form.invalid).toBe(true);
  });

  it('shows create invitation button', () => {
    const { fixture } = createFixture('doctor');
    const btns = fixture.nativeElement.querySelectorAll('button');
    const texts = Array.from(btns).map((b: any) => b.textContent.trim());
    expect(texts.some((t) => t.includes('Crear invitación'))).toBe(true);
  });

  it('creates invitation with the fixed role for the inviter', async () => {
    const { component } = createFixture('admin');
    const { setDoc } = await import('firebase/firestore');
    component.form.setValue({ name: 'Nuevo Doctor', email: 'nuevo@test.com' });
    await component.save();
    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ role: 'doctor', createdBy: 'admin1' })
    );
  });

  it('closes dialog on close()', () => {
    const { component, dialogRef } = createFixture('doctor');
    component.close();
    expect(dialogRef.close).toHaveBeenCalled();
  });
});
