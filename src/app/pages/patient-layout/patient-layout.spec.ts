import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { BehaviorSubject } from 'rxjs';
import { PatientLayout } from './patient-layout';
import { AuthService } from '../../core/services/auth.service';
import { SessionUser } from '../../core/models/user';

describe('PatientLayout on session expiry (P17)', () => {
  function setup() {
    const sessions = new BehaviorSubject<SessionUser>({ type: 'patient', patient: {
      id: 'synthetic-child', doctorId: 'synthetic-doctor', name: 'Paciente', lastName: 'ficticio',
      email: 'family@example.test', otpPassword: 'synthetic-password', birthDate: '', fatherName: '', motherName: '', phone: '',
    } });
    const dialog = { closeAll: vi.fn() };
    TestBed.configureTestingModule({ imports: [PatientLayout], providers: [
      { provide: AuthService, useValue: { session$: sessions } },
      { provide: MatDialog, useValue: dialog },
    ] });
    TestBed.overrideComponent(PatientLayout, { set: { template: '', imports: [] } });
    const fixture = TestBed.createComponent(PatientLayout); fixture.detectChanges();
    return { fixture, sessions, dialog };
  }

  it('closes patient dialogs when its session ends so they do not cover the login', () => {
    const { sessions, dialog } = setup();
    expect(dialog.closeAll).not.toHaveBeenCalled();
    sessions.next(null);
    expect(dialog.closeAll).toHaveBeenCalledOnce();
  });

  it('does not close dialogs for another portal after the patient layout is destroyed', () => {
    const { fixture, sessions, dialog } = setup(); fixture.destroy();
    sessions.next(null);
    expect(dialog.closeAll).not.toHaveBeenCalled();
  });
});
