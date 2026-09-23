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
  serverTimestamp: vi.fn(() => new Date()),
}));

describe('SettingsDialog', () => {
  const mockDoctor = { uid: 'd1', name: 'Dr. Test', email: 'test@mail.com' };
  const defaultData: SettingsData = {
    consultationDuration: 30,
    allowPatientScheduling: false,
    timeSegmentsByDay: {
      Lun: [{ startTime: '08:00', endTime: '14:00' }],
      Mar: [{ startTime: '09:00', endTime: '13:00' }],
    },
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
    const authService = { currentDoctor: mockDoctor, updateCurrentDoctor: vi.fn() };
    const firebase = { firestore: {} };

    TestBed.configureTestingModule({
      imports: [SettingsDialog, NoopAnimationsModule],
      providers: [
        { provide: UserRepository, useValue: userRepo },
        { provide: AuditRepository, useValue: auditRepo },
        { provide: AuthService, useValue: authService },
        { provide: AlertService, useValue: alertService },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: FirebaseService, useValue: firebase },
      ],
    });

    const fixture = TestBed.createComponent(SettingsDialog);
    const component = fixture.componentInstance as any;
    component.setData(data);
    fixture.detectChanges();
    return { fixture, component, userRepo, auditRepo, alertService, dialogRef, authService };
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

  it('selects a day on chip click (single-select)', () => {
    const { component } = createFixture();
    expect(component.selectedDay).toBe('Lun');
    component.toggleDay('Mar');
    expect(component.selectedDay).toBe('Mar');
    component.toggleDay('Vie');
    expect(component.selectedDay).toBe('Vie');
  });

  it('loads each day schedule without changing the other days', () => {
    const { component } = createFixture({
      ...defaultData,
      timeSegmentsByDay: {
        Lun: [{ startTime: '08:00', endTime: '14:00' }],
        Vie: [{ startTime: '10:00', endTime: '16:00' }],
      },
      availableDays: ['Lun', 'Vie'],
    });

    component.toggleDay('Vie');
    component.timeSegments.at(0).patchValue({ startTime: '11:00', endTime: '17:00' });
    component.toggleDay('Lun');

    expect(component.timeSegments.at(0).value).toEqual({ startTime: '08:00', endTime: '14:00' });
    expect(component.timeSegmentsByDay.Lun).toEqual([{ startTime: '08:00', endTime: '14:00' }]);
    expect(component.timeSegmentsByDay.Vie).toEqual([{ startTime: '11:00', endTime: '17:00' }]);
  });

  it('owns a deep copy of every day schedule', () => {
    const input = structuredClone(defaultData);
    const { component } = createFixture(input);

    input.timeSegmentsByDay['Lun'][0].startTime = '22:00';
    component.toggleDay('Mar');
    component.toggleDay('Lun');

    expect(component.timeSegments.at(0).value.startTime).toBe('08:00');
  });

  it('shows configured styling and checks independently from the selected day', () => {
    const { fixture, component } = createFixture();
    let element = fixture.nativeElement as HTMLElement;

    expect(element.querySelectorAll('.day-check')).toHaveLength(2);
    expect(element.querySelector('.chip-day.active')?.textContent).toContain('Lun');
    expect(element.querySelector('.chip-day.configured')?.textContent).toContain('Mar');

    component.toggleDay('Dom');
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
    expect(component.timeSegments.length).toBe(0);
    expect(element.querySelector('.chip-day.active')?.textContent).toContain('Dom');
    expect(element.querySelector('.chip-day.active')?.querySelector('.day-check')).toBeNull();
  });

  it('adds a segment only to the selected day and marks it configured', () => {
    const { fixture, component } = createFixture();
    component.toggleDay('Vie');
    component.addSegment();

    fixture.detectChanges();
    expect(component.timeSegments.length).toBe(1);
    expect(component.timeSegmentsByDay.Vie).toEqual([{ startTime: '06:00', endTime: '00:00' }]);
    expect(component.timeSegmentsByDay.Lun).toEqual([{ startTime: '08:00', endTime: '14:00' }]);
    expect((fixture.nativeElement as HTMLElement).querySelector('.chip-day.active .day-check')).toBeTruthy();
  });

  it('removes the last segment only from the selected day and clears its configured state', () => {
    const { fixture, component } = createFixture();
    component.toggleDay('Mar');
    component.removeSegment(0);

    fixture.detectChanges();
    expect(component.timeSegmentsByDay.Mar).toEqual([]);
    expect(component.timeSegmentsByDay.Lun).toEqual([{ startTime: '08:00', endTime: '14:00' }]);
    expect((fixture.nativeElement as HTMLElement).querySelector('.chip-day.active .day-check')).toBeNull();
  });

  it('restores every persisted day when data is loaded again', () => {
    const savedData: SettingsData = {
      ...defaultData,
      timeSegmentsByDay: {
        Lun: [
          { startTime: '09:00', endTime: '12:00' },
          { startTime: '17:00', endTime: '20:00' },
        ],
        Vie: [
          { startTime: '09:00', endTime: '12:00' },
          { startTime: '16:00', endTime: '21:00' },
        ],
      },
      availableDays: ['Lun', 'Vie'],
    };
    const { component } = createFixture(savedData);

    component.toggleDay('Vie');
    expect(component.timeSegments.value).toEqual(savedData.timeSegmentsByDay['Vie']);
    component.toggleDay('Lun');
    expect(component.timeSegments.value).toEqual(savedData.timeSegmentsByDay['Lun']);
  });

  it('keeps Monday and Friday independent through editing, saving, and reloading', async () => {
    const { setDoc } = await import('firebase/firestore');
    const { component } = createFixture({
      ...defaultData,
      timeSegmentsByDay: {},
      availableDays: [],
    });

    component.addSegment();
    component.timeSegments.at(0).patchValue({ startTime: '09:00', endTime: '12:00' });
    component.addSegment();
    component.timeSegments.at(1).patchValue({ startTime: '17:00', endTime: '20:00' });

    component.toggleDay('Vie');
    component.addSegment();
    component.timeSegments.at(0).patchValue({ startTime: '10:00', endTime: '14:00' });

    component.toggleDay('Lun');
    expect(component.timeSegments.value).toEqual([
      { startTime: '09:00', endTime: '12:00' },
      { startTime: '17:00', endTime: '20:00' },
    ]);
    component.toggleDay('Vie');
    expect(component.timeSegments.value).toEqual([
      { startTime: '10:00', endTime: '14:00' },
    ]);

    await component.save();
    const persisted = (setDoc as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1];
    expect(persisted.timeSegmentsByDay).toEqual({
      Lun: [
        { startTime: '09:00', endTime: '12:00' },
        { startTime: '17:00', endTime: '20:00' },
      ],
      Vie: [{ startTime: '10:00', endTime: '14:00' }],
    });

    component.setData({
      ...defaultData,
      timeSegmentsByDay: persisted.timeSegmentsByDay,
      availableDays: persisted.availableDays,
    });
    expect(component.timeSegments.value).toEqual(persisted.timeSegmentsByDay.Lun);
    component.toggleDay('Vie');
    expect(component.timeSegments.value).toEqual(persisted.timeSegmentsByDay.Vie);
  });

  it('renders each selected day own values regardless of the last edited day', () => {
    const { fixture, component } = createFixture({
      ...defaultData,
      timeSegmentsByDay: {
        Lun: [{ startTime: '09:00', endTime: '12:00' }],
        Mar: [{ startTime: '10:00', endTime: '14:00' }],
        Vie: [{ startTime: '16:00', endTime: '20:00' }],
      },
      availableDays: ['Lun', 'Mar', 'Vie'],
    });

    const renderedValues = () => Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>('.segments-list input')
    ).map((input) => input.value);

    expect(renderedValues()).toEqual(['09:00', '12:00']);

    component.toggleDay('Mar');
    fixture.detectChanges();
    expect(renderedValues()).toEqual(['10:00', '14:00']);

    component.toggleDay('Vie');
    component.timeSegments.at(0).patchValue({ startTime: '16:30', endTime: '20:30' });
    fixture.detectChanges();
    expect(renderedValues()).toEqual(['16:30', '20:30']);

    component.toggleDay('Lun');
    fixture.detectChanges();
    expect(renderedValues()).toEqual(['09:00', '12:00']);

    component.toggleDay('Dom');
    fixture.detectChanges();
    expect(renderedValues()).toEqual([]);

    component.toggleDay('Vie');
    fixture.detectChanges();
    expect(renderedValues()).toEqual(['16:30', '20:30']);
  });

  it('persists independent schedules and publishes the saved state', async () => {
    const { setDoc } = await import('firebase/firestore');
    const { component, auditRepo, alertService, dialogRef, authService } = createFixture();
    component.toggleDay('Mar');
    component.timeSegments.at(0).patchValue({ startTime: '10:00', endTime: '15:00' });
    await component.save();
    const persisted = (setDoc as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1];
    expect(persisted.timeSegmentsByDay).toEqual({
      Lun: [{ startTime: '08:00', endTime: '14:00' }],
      Mar: [{ startTime: '10:00', endTime: '15:00' }],
    });
    expect(auditRepo.log).toHaveBeenCalled();
    expect(alertService.success).toHaveBeenCalledWith({ message: 'Configuración guardada', duration: 5000 });
    expect(authService.updateCurrentDoctor).toHaveBeenCalledWith(expect.objectContaining({
      timeSegmentsByDay: persisted.timeSegmentsByDay,
      availableDays: ['Lun', 'Mar'],
    }));
    expect(dialogRef.close).toHaveBeenCalledWith(expect.objectContaining({
      timeSegmentsByDay: persisted.timeSegmentsByDay,
      availableDays: ['Lun', 'Mar'],
    }));
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
