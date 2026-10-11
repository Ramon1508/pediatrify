import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef } from '@angular/material/dialog';
import { SettingsDialog, SettingsData } from './settings-dialog';
import { UserRepository } from '../../../../core/repositories/user.repository';
import { AuditRepository } from '../../../../core/repositories/audit.repository';
import { AuthService } from '../../../../core/services/auth.service';
import { AlertService } from '../../../../core/services/alert.service';
import { FirebaseService } from '../../../../core/firebase/firebase.service';
import { UserRole } from '../../../../core/models/user';
import { of } from 'rxjs';

const saveSchedule = vi.fn();

describe('SettingsDialog', () => {
  const mockDoctor = { uid: 'd1', name: 'Dr. Test', email: 'test@mail.com', role: 'doctor' as const };
  const mockAssistant = { uid: 'a1', name: 'Assistant Test', email: 'assistant@example.test', role: 'assistant' as const };
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

  function createFixture(
    data: SettingsData = defaultData,
    currentUser: { uid: string; name: string; email: string; role: UserRole } = mockDoctor,
  ) {
    saveSchedule.mockReset().mockResolvedValue(undefined);
    const userRepo = {
      updateSchedule: saveSchedule,
      getUser: vi.fn().mockResolvedValue({ uid: 'd1', consultationDuration: 20, allowPatientScheduling: false, availableDays: [], timeSegments: [] }),
      getUserByEmail: vi.fn().mockResolvedValue({ uid: 'd1', email: 'test@mail.com' }),
    };
    const auditRepo = { log: vi.fn().mockResolvedValue(undefined) };
    const alertService = { success: vi.fn(), error: vi.fn() };
    const dialogRef = { close: vi.fn() };
    const authService = {
      currentDoctor: currentUser,
      session$: of({ type: 'doctor' as const, user: currentUser }),
      updateCurrentDoctor: vi.fn(),
    };
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

  describe('P26: validación de toda la semana', () => {
    beforeEach(async () => {

      vi.mocked(saveSchedule).mockClear();
    });

    const segment = (startTime: string, endTime: string) => ({ startTime, endTime });
    const invalidCases = [
      { label: 'inicio vacío', segments: [segment('', '12:00')], message: 'Ingresa una hora de inicio válida' },
      { label: 'fin vacío', segments: [segment('09:00', '')], message: 'Ingresa una hora de fin válida' },
      { label: 'orden invertido', segments: [segment('14:00', '09:00')], message: 'Elige una hora de fin posterior' },
      { label: 'horas iguales', segments: [segment('09:00', '09:00')], message: 'Elige una hora de fin posterior' },
      { label: 'solapamiento', segments: [segment('09:00', '12:00'), segment('11:00', '13:00')], message: 'no se superponga' },
    ];

    it.each([mockDoctor, mockAssistant].flatMap(user => invalidCases.map(scenario => ({ user, ...scenario }))))(
      'blocks the button and direct saving for $label as $user.role', async ({ user, segments, message }) => {

        const { fixture, component, userRepo, auditRepo, dialogRef, authService } = createFixture({
          ...defaultData, timeSegmentsByDay: { Lun: segments }, availableDays: ['Lun'],
        }, user);
        component.form.markAsDirty();
        fixture.detectChanges();
        expect(component.form.invalid).toBe(true);
        expect(fixture.nativeElement.querySelector('mat-dialog-actions .btn-primary').disabled).toBe(true);
        expect(fixture.nativeElement.querySelector('.schedule-validation').textContent).toContain('Lun, segmento');
        expect(fixture.nativeElement.querySelector('.schedule-validation').textContent).toContain(message);
        await component.save();
        expect(saveSchedule).not.toHaveBeenCalled();
        expect(userRepo.getUser).not.toHaveBeenCalled();
        expect(auditRepo.log).not.toHaveBeenCalled();
        expect(authService.updateCurrentDoctor).not.toHaveBeenCalled();
        expect(dialogRef.close).not.toHaveBeenCalled();
      }
    );

    it.each(['9:00', '24:00', '12:99', '09:00:00'])('rejects an invalid time representation: %s', async startTime => {

      const { fixture, component } = createFixture();
      component.timeSegments.at(0).patchValue({ startTime });
      component.form.markAsDirty();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.schedule-validation').textContent).toContain('Ingresa una hora de inicio válida');
      await component.save();
      expect(saveSchedule).not.toHaveBeenCalled();
    });

    it.each([
      [segment('09:00', '12:00'), segment('09:00', '12:00')],
      [segment('09:00', '14:00'), segment('10:00', '11:00')],
      [segment('22:00', '00:00'), segment('23:00', '23:30')],
    ])('rejects identical, contained or midnight overlaps: %j', async (...segments) => {

      const { component } = createFixture({ ...defaultData,
        timeSegmentsByDay: { Lun: segments }, availableDays: ['Lun'] });
      component.form.markAsDirty();
      await component.save();
      expect(saveSchedule).not.toHaveBeenCalled();
      expect(component.weekErrors()).toHaveLength(2);
    });

    it.each([mockDoctor, mockAssistant])('allows adjacent unsorted segments as $role without rearranging them', async user => {

      const segments = [segment('12:00', '14:00'), segment('09:00', '12:00')];
      const { component } = createFixture({ ...defaultData,
        timeSegmentsByDay: { Lun: segments, Mar: [segment('09:00', '12:00')] }, availableDays: ['Lun', 'Mar'] }, user);
      component.form.markAsDirty();
      await component.save();
      expect(vi.mocked(saveSchedule).mock.calls.at(-1)?.[1]).toMatchObject({
        timeSegmentsByDay: { Lun: segments, Mar: [segment('09:00', '12:00')] },
      });
    });

    it.each([
      [segment('22:00', '00:00')],
      [segment('00:00', '00:00')],
      [segment('09:00', '12:00'), segment('15:00', '17:00')],
    ])('allows midnight, a full day or gaps: %j', async (...segments) => {

      const { component } = createFixture({ ...defaultData,
        timeSegmentsByDay: { Lun: segments }, availableDays: ['Lun'] });
      component.form.markAsDirty();
      await component.save();
      expect(saveSchedule).toHaveBeenCalledTimes(1);
      expect(component.weekErrors()).toEqual([]);
    });

    it('keeps an invalid hidden day blocked, preserves its values and allows saving after correcting it', async () => {

      const { fixture, component } = createFixture();
      component.toggleDay('Mar');
      component.timeSegments.at(0).patchValue({ endTime: '08:00' });
      component.form.markAsDirty();
      component.toggleDay('Lun');
      fixture.detectChanges();
      expect(component.timeSegments.at(0).value).toEqual(segment('08:00', '14:00'));
      expect(fixture.nativeElement.querySelector('.schedule-validation').textContent).toContain('Mar, segmento 1');
      await component.save();
      expect(saveSchedule).not.toHaveBeenCalled();
      component.toggleDay('Mar');
      expect(component.timeSegments.at(0).value.endTime).toBe('08:00');
      fixture.detectChanges();
      const endInput = fixture.nativeElement.querySelectorAll('.segments-list input')[1] as HTMLInputElement;
      endInput.value = '13:00';
      endInput.dispatchEvent(new Event('input', { bubbles: true }));
      endInput.dispatchEvent(new Event('blur'));
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.schedule-validation')).toBeNull();
      const button = fixture.nativeElement.querySelector('mat-dialog-actions .btn-primary') as HTMLButtonElement;
      expect(button.disabled).toBe(false);
      const save = vi.spyOn(component, 'save');
      button.click();
      await save.mock.results.at(-1)!.value;
      expect(vi.mocked(saveSchedule).mock.calls.at(-1)?.[1]).toMatchObject({ timeSegmentsByDay: {
        Lun: [segment('08:00', '14:00')], Mar: [segment('09:00', '13:00')],
      } });
    });

    it('validates a loaded error in a day that has never been selected', async () => {

      const { fixture, component } = createFixture({ ...defaultData,
        timeSegmentsByDay: { ...defaultData.timeSegmentsByDay, Vie: [segment('17:00', '10:00')] } });
      component.form.markAsDirty();
      fixture.detectChanges();
      expect(component.selectedDay()).toBe('Lun');
      expect(fixture.nativeElement.querySelector('.schedule-validation').textContent).toContain('Vie, segmento 1');
      await component.save();
      expect(saveSchedule).not.toHaveBeenCalled();
    });

    it('does not save a pristine form and browsing days does not dirty it', async () => {

      const { fixture, component } = createFixture();
      component.toggleDay('Mar');
      fixture.detectChanges();
      expect(component.form.pristine).toBe(true);
      expect(fixture.nativeElement.querySelector('mat-dialog-actions .btn-primary').disabled).toBe(true);
      await component.save();
      expect(saveSchedule).not.toHaveBeenCalled();
    });

    it('rejects an empty duration and silent invalid changes at save', async () => {

      const { fixture, component } = createFixture();
      component.form.controls.consultationDuration.setValue(null);
      component.form.markAsDirty();
      await component.save();
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Selecciona una duración de consulta válida.');
      expect(saveSchedule).not.toHaveBeenCalled();
      component.form.controls.consultationDuration.setValue(30);
      component.timeSegments.at(0).patchValue({ startTime: '' }, { emitEvent: false });
      await component.save();
      expect(saveSchedule).not.toHaveBeenCalled();
      expect(component.weekErrors()[0].message).toContain('Ingresa una hora de inicio válida');
    });

    it('blocks duplicate save calls and the button while the request is pending', async () => {

      const { fixture, component, userRepo } = createFixture();
      let release!: (value: any) => void;
      userRepo.getUser.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
      component.form.markAsDirty();
      const pending = component.save();
      fixture.detectChanges();
      expect(component.saving()).toBe(true);
      expect(fixture.nativeElement.querySelector('mat-dialog-actions .btn-primary').disabled).toBe(true);
      await component.save();
      expect(userRepo.getUser).toHaveBeenCalledTimes(1);
      release(mockDoctor);
      await pending;
      expect(saveSchedule).toHaveBeenCalledTimes(1);
      expect(component.saving()).toBe(false);
    });
  });

  it('pre-fills form with provided data', () => {
    const { component } = createFixture();
    expect(component.form.value.consultationDuration).toBe(30);
    expect(component.form.value.allowPatientScheduling).toBe(false);
  });

  it('shows the patient scheduling option only to the doctor', () => {
    const { fixture, component } = createFixture();
    expect(fixture.nativeElement.querySelector('.scheduling-row')).not.toBeNull();
    expect(component.form.controls.allowPatientScheduling.enabled).toBe(true);
  });

  it('hides and disables patient scheduling for the assistant while keeping availability editable', () => {
    const { fixture, component } = createFixture(defaultData, mockAssistant);
    expect(fixture.nativeElement.textContent).not.toContain('Permitir que los pacientes agenden citas');
    expect(fixture.nativeElement.querySelector('mat-slide-toggle')).toBeNull();
    expect(component.form.controls.allowPatientScheduling.disabled).toBe(true);
    expect(component.form.controls.consultationDuration.enabled).toBe(true);
    expect(component.timeSegments.enabled).toBe(true);
  });

  it.each([false, true])(
    'preserves the persisted patient scheduling permission (%s) when an assistant saves availability',
    async (allowPatientScheduling) => {

      const { component, userRepo, auditRepo, dialogRef, authService } = createFixture(
        { ...defaultData, allowPatientScheduling: !allowPatientScheduling },
        mockAssistant,
      );
      userRepo.getUser.mockResolvedValue({
        ...mockDoctor,
        consultationDuration: 30,
        allowPatientScheduling,
        availableDays: ['Lun', 'Mar'],
        timeSegments: [],
      });
      component.form.controls.allowPatientScheduling.enable();
      component.form.controls.allowPatientScheduling.setValue(!allowPatientScheduling);
      component.form.controls.consultationDuration.setValue(45);
      component.timeSegments.at(0).patchValue({ startTime: '10:00', endTime: '16:00' });

      component.form.markAsDirty();
      await component.save();

      const persisted = vi.mocked(saveSchedule).mock.calls.at(-1)?.[1];
      expect(persisted).not.toHaveProperty('allowPatientScheduling');
      expect(persisted).toMatchObject({
        consultationDuration: 45,
        availableDays: ['Lun', 'Mar'],
        timeSegmentsByDay: {
          Lun: [{ startTime: '10:00', endTime: '16:00' }],
          Mar: [{ startTime: '09:00', endTime: '13:00' }],
        },
      });
      expect(dialogRef.close).toHaveBeenCalledWith(expect.objectContaining({ allowPatientScheduling }));
      expect(auditRepo.log).not.toHaveBeenCalled();
      expect(authService.updateCurrentDoctor).not.toHaveBeenCalled();
    },
  );

  it('allows the doctor to change the patient scheduling permission', async () => {

    const { component, dialogRef } = createFixture();
    component.form.controls.allowPatientScheduling.setValue(true);

    component.form.markAsDirty();
    await component.save();

    expect(vi.mocked(saveSchedule).mock.calls.at(-1)?.[1]).toHaveProperty('allowPatientScheduling', true);
    expect(dialogRef.close).toHaveBeenCalledWith(expect.objectContaining({ allowPatientScheduling: true }));
  });

  it('renders available day chips', () => {
    const { fixture } = createFixture();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Lun');
    expect(el.textContent).toContain('Mar');
  });

  it('selects a day on chip click (single-select)', () => {
    const { component } = createFixture();
    expect(component.selectedDay()).toBe('Lun');
    component.toggleDay('Mar');
    expect(component.selectedDay()).toBe('Mar');
    component.toggleDay('Vie');
    expect(component.selectedDay()).toBe('Vie');
  });

  it('renders no segment fields when opened without configured days', () => {
    const { fixture } = createFixture({
      ...defaultData,
      timeSegmentsByDay: {},
      availableDays: [],
    });
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('.segments-list mat-form-field')).toHaveLength(0);
    expect(element.querySelectorAll('.segments-list mat-label')).toHaveLength(0);
    expect(element.querySelector('.segments-list')).toBeNull();
    expect(element.querySelector('.btn-add-segment')).not.toBeNull();
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
    expect(component.timeSegmentsByDay().Lun).toEqual([{ startTime: '08:00', endTime: '14:00' }]);
    expect(component.timeSegmentsByDay().Vie).toEqual([{ startTime: '11:00', endTime: '17:00' }]);
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
    expect(element.querySelectorAll('.segments-list mat-form-field')).toHaveLength(0);
    expect(element.querySelectorAll('.segments-list mat-label')).toHaveLength(0);
    expect(element.querySelector('.chip-day.active')?.textContent).toContain('Dom');
    expect(element.querySelector('.chip-day.active')?.querySelector('.day-check')).toBeNull();
  });

  it('removes the whole segment container on empty days and recreates it when adding', () => {
    const { fixture, component } = createFixture();
    const element = fixture.nativeElement as HTMLElement;
    const clickDay = (day: string) => {
      const chip = Array.from(element.querySelectorAll<HTMLButtonElement>('.chip-day'))
        .find((button) => button.textContent?.includes(day));
      chip!.click();
      fixture.detectChanges();
    };

    for (let i = 0; i < 3; i++) {
      clickDay('Dom');
      expect(element.querySelector('.segments-list')).toBeNull();
      expect(element.querySelectorAll('.availability-section mat-label')).toHaveLength(0);

      element.querySelector<HTMLButtonElement>('.btn-add-segment')!.click();
      fixture.detectChanges();
      expect(element.querySelectorAll('.segments-list input')).toHaveLength(2);

      element.querySelector<HTMLButtonElement>('.segment-remove')!.click();
      fixture.detectChanges();
      expect(element.querySelector('.segments-list')).toBeNull();
      expect(component.timeSegmentsByDay().Dom).toEqual([]);

      clickDay('Lun');
      expect(Array.from(element.querySelectorAll<HTMLInputElement>('.segments-list input'))
        .map((input) => input.value)).toEqual(['08:00', '14:00']);
    }
  });

  it('adds a segment only to the selected day and marks it configured', () => {
    const { fixture, component } = createFixture();
    component.toggleDay('Vie');
    component.addSegment();

    fixture.detectChanges();
    expect(component.timeSegments.length).toBe(1);
    expect(component.timeSegmentsByDay().Vie).toEqual([{ startTime: '06:00', endTime: '00:00' }]);
    expect(component.timeSegmentsByDay().Lun).toEqual([{ startTime: '08:00', endTime: '14:00' }]);
    expect((fixture.nativeElement as HTMLElement).querySelector('.chip-day.active .day-check')).toBeTruthy();
  });

  it('removes the last segment only from the selected day and clears its configured state', () => {
    const { fixture, component } = createFixture();
    component.toggleDay('Mar');
    component.removeSegment(0);

    fixture.detectChanges();
    expect(component.timeSegmentsByDay().Mar).toEqual([]);
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('.segments-list mat-form-field')).toHaveLength(0);
    expect(element.querySelectorAll('.segments-list mat-label')).toHaveLength(0);
    expect(element.querySelector('.btn-add-segment')).not.toBeNull();
    expect(component.timeSegmentsByDay().Lun).toEqual([{ startTime: '08:00', endTime: '14:00' }]);
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

    component.form.markAsDirty();
    await component.save();
    const persisted = (saveSchedule as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1];
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

    const { component, auditRepo, alertService, dialogRef, authService } = createFixture();
    component.toggleDay('Mar');
    component.timeSegments.at(0).patchValue({ startTime: '10:00', endTime: '15:00' });
    component.form.markAsDirty();
    await component.save();
    const persisted = (saveSchedule as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1];
    expect(persisted.timeSegmentsByDay).toEqual({
      Lun: [{ startTime: '08:00', endTime: '14:00' }],
      Mar: [{ startTime: '10:00', endTime: '15:00' }],
    });
    expect(auditRepo.log).not.toHaveBeenCalled();
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

    const { component, alertService } = createFixture();
    (saveSchedule as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
    component.form.markAsDirty();
    await component.save();
    expect(alertService.error).toHaveBeenCalled();
    (saveSchedule as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  it('closes dialog on close()', () => {
    const { component, dialogRef } = createFixture();
    component.close();
    expect(dialogRef.close).toHaveBeenCalled();
  });
});
