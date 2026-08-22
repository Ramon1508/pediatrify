import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef } from '@angular/material/dialog';
import { SettingsDialog, SettingsData } from './settings-dialog';
import { UserRepository } from '../../../../core/repositories/user.repository';
import { AuditRepository } from '../../../../core/repositories/audit.repository';
import { AuthService } from '../../../../core/services/auth.service';
import { AlertService } from '../../../../core/services/alert.service';
import { FirebaseService } from '../../../../core/firebase/firebase.service';

vi.mock('firebase/firestore', () => ({
  setDoc: vi.fn().mockResolvedValue(undefined),
  doc: vi.fn().mockReturnValue({ id: 'd1', path: 'users/d1' }),
}));

describe('SettingsDialog', () => {
  const mockDoctor = { uid: 'd1', name: 'Dr. Test', email: 'test@mail.com' };
  const defaultData: SettingsData = {
    consultationDuration: 30,
    allowPatientScheduling: false,
    timeSegments: [{ startTime: '08:00', endTime: '14:00' }],
    availableDays: ['Lun', 'Mar'],
    doctorId: 'd1',
    doctorEmail: 'test@mail.com',
  };

  function createFixture(data: SettingsData = defaultData) {
    const userRepo = {
      getUser: vi.fn().mockResolvedValue({ uid: 'd1', consultationDuration: 20, allowPatientScheduling: false, availableDays: [], timeSegments: [] }),
      getUserByEmail: vi.fn().mockResolvedValue({ uid: 'd1', email: 'test@mail.com' }),
    };
    const auditRepo = { log: vi.fn().mockResolvedValue(undefined) };
    const alertService = { success: vi.fn(), error: vi.fn() };
    const dialogRef = { close: vi.fn() };
    const firebase = { firestore: {} };

    TestBed.configureTestingModule({
      imports: [SettingsDialog, NoopAnimationsModule],
      providers: [
        { provide: UserRepository, useValue: userRepo },
        { provide: AuditRepository, useValue: auditRepo },
        { provide: AuthService, useValue: { currentDoctor: mockDoctor } },
        { provide: AlertService, useValue: alertService },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: FirebaseService, useValue: firebase },
      ],
    });

    const fixture = TestBed.createComponent(SettingsDialog);
    const component = fixture.componentInstance as any;
    component.setData(data);
    fixture.detectChanges();
    return { fixture, component, userRepo, auditRepo, alertService, dialogRef };
  }

  it('renders title', () => {
    const { fixture } = createFixture();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Configuración');
  }, 10000);

  it('pre-fills form with provided data', () => {
    const { component } = createFixture();
    expect(component.form.value.consultationDuration).toBe(30);
    expect(component.form.value.allowPatientScheduling).toBe(false);
  });

  it('renders available day chips', () => {
    const { fixture } = createFixture();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Lun');
    expect(el.textContent).toContain('Mar');
  });

  it('toggles day on chip click', () => {
    const { component } = createFixture();
    component.toggleDay('Lun');
    expect(component.availableDays).not.toContain('Lun');
    component.toggleDay('Lun');
    expect(component.availableDays).toContain('Lun');
  });

  it('adds a time segment', () => {
    const { component } = createFixture();
    const len = component.timeSegments.length;
    component.addSegment();
    expect(component.timeSegments.length).toBe(len + 1);
  });

  it('removes a time segment', () => {
    const { component } = createFixture();
    const len = component.timeSegments.length;
    component.removeSegment(0);
    expect(component.timeSegments.length).toBe(len - 1);
  });

  it('calls setDoc and audit on save', async () => {
    const { setDoc } = await import('firebase/firestore');
    const { component, auditRepo, alertService, dialogRef } = createFixture();
    await component.save();
    expect(setDoc).toHaveBeenCalled();
    expect(auditRepo.log).toHaveBeenCalled();
    expect(alertService.success).toHaveBeenCalledWith({ message: 'Configuración guardada', duration: 5000 });
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('shows error on save failure', async () => {
    const { setDoc } = await import('firebase/firestore');
    (setDoc as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
    const { component, alertService } = createFixture();
    await component.save();
    expect(alertService.error).toHaveBeenCalled();
    (setDoc as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  it('closes dialog on close()', () => {
    const { component, dialogRef } = createFixture();
    component.close();
    expect(dialogRef.close).toHaveBeenCalled();
  });
});
