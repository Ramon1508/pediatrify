import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MAT_DATE_LOCALE } from '@angular/material/core';
import { MatDialogRef } from '@angular/material/dialog';
import { AppointmentDialog } from './appointment-dialog';
import { AppointmentRepository } from '../../../../core/repositories/appointment.repository';
import { PatientRepository } from '../../../../core/repositories/patient.repository';
import { AuthService } from '../../../../core/services/auth.service';
import { AlertService } from '../../../../core/services/alert.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { AuditRepository } from '../../../../core/repositories/audit.repository';
import { EmailService } from '../../../../core/services/email.service';
import { weekdayShortOf } from '../../../../core/utils/availability';
import { clinicTodayDate } from '../../../../core/utils/clinic-time';
import { ClinicClockService } from '../../../../core/services/clinic-clock.service';

describe('AppointmentDialog', () => {
  let fixture: ComponentFixture<AppointmentDialog>;
  let component: AppointmentDialog;
  let dialogRef: MatDialogRef<AppointmentDialog>;
  let alertService: AlertService;

  const mockPatients = [
    { id: 'p1', doctorId: 'd1', name: 'Juan', lastName: 'Pérez', email: 'juan@test.com', phone: '5512345678', otpPassword: 'ABC123', fatherName: 'Carlos', motherName: 'María', birthDate: '2020-01-15' },
  ] as any[];

  beforeEach(async () => {
    dialogRef = { close: vi.fn() } as any;

    await TestBed.configureTestingModule({
      imports: [AppointmentDialog, NoopAnimationsModule],
      providers: [
        provideNativeDateAdapter(),
        { provide: MAT_DATE_LOCALE, useValue: 'es-MX' },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: AppointmentRepository, useValue: { createAppointment: vi.fn(), updateAppointment: vi.fn() } },
        { provide: PatientRepository, useValue: { getAllPatients: vi.fn(), getPatientsByDoctor: vi.fn().mockResolvedValue(mockPatients) } },
        { provide: AuthService, useValue: { currentDoctor: { uid: 'd1', firebaseUid: 'd1', name: 'Dr. Test', email: 'dr@test.com', role: 'doctor' } } },
        { provide: AlertService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: AuditRepository, useValue: { log: vi.fn() } },
        { provide: NotificationService, useValue: { notifyAppointmentCreated: vi.fn(), notifyAppointmentCancelled: vi.fn(), notifyAppointmentRescheduled: vi.fn() } },
        { provide: EmailService, useValue: { sendPatientAccessEmail: vi.fn().mockResolvedValue(undefined) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppointmentDialog);
    component = fixture.componentInstance;
    alertService = TestBed.inject(AlertService);
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('keeps only scoped patients in the search and embedded patient form', () => {
    component.setData({ selectedDoctorId: 'd1', allPatients: [
      ...mockPatients,
      { ...mockPatients[0], id: 'foreign', doctorId: 'd2' },
      { ...mockPatients[0], id: 'legacy', doctorId: undefined },
    ] });
    expect((component as any).allPatients()).toEqual(mockPatients);
    expect((component as any).filteredPatients()).toEqual(mockPatients);
    component.filterPatients('Juan');
    expect((component as any).filteredPatients()).toEqual(mockPatients);
    component.filterPatients('unmatched');
    expect((component as any).filteredPatients()).toEqual([]);
    component.filterPatients('');
    expect((component as any).filteredPatients()).toEqual(mockPatients);
  });

  it('scopes an assistant to the assigned doctor and rejects another agenda', () => {
    (TestBed.inject(AuthService) as any).currentDoctor = { uid: 'assistant-test', role: 'assistant', createdBy: 'd1' };
    component.setData({ selectedDoctorId: 'd1', allPatients: mockPatients });
    expect((component as any).allPatients()).toEqual(mockPatients);
    component.setData({ selectedDoctorId: 'd2', allPatients: [{ ...mockPatients[0], doctorId: 'd2' }] });
    expect((component as any).allPatients()).toEqual([]);
    component.openNewPatient();
    expect((component as any).showNewPatient()).toBe(false);
  });

  it('preserves the family selection supplied by the patient portal', () => {
    const auth = TestBed.inject(AuthService) as any;
    auth.currentDoctor = null;
    auth.currentPatient = mockPatients[0];
    component.setData({ selectedDoctorId: 'd1', allPatients: mockPatients, patientScheduling: true });
    expect((component as any).allPatients()).toEqual(mockPatients);
  });

  it.each(['foreign-patient', 'foreign-agenda', 'foreign-appointment'])('refuses appointment saving for %s', async (scenario) => {
    const segment = [{ startTime: '09:00', endTime: '17:00' }];
    component.setData({ selectedDoctorId: 'd1', allPatients: mockPatients,
      timeSegmentsByDay: { Lun: segment, Mar: segment, Mié: segment, Jue: segment, Vie: segment, Sáb: segment, Dom: segment } });
    (component as any).form.patchValue({ patientId: 'p1', date: '2099-01-05', time: '10:00' });
    if (scenario === 'foreign-patient') (component as any).form.patchValue({ patientId: 'foreign' });
    if (scenario === 'foreign-agenda') (component as any).selectedDoctorId = 'd2';
    if (scenario === 'foreign-appointment') (component as any).editingAppointment.set({ patientId: 'p1', doctorId: 'd2' });
    await component.save();
    const repo = TestBed.inject(AppointmentRepository);
    expect(repo.createAppointment).not.toHaveBeenCalled();
    expect(repo.updateAppointment).not.toHaveBeenCalled();
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(alertService.error).toHaveBeenCalled();
  });

  it('does not reload or select an out-of-scope newly created patient', async () => {
    component.setData({ selectedDoctorId: 'd1', allPatients: mockPatients });
    await component.onPatientCreated({ ...mockPatients[0], id: 'foreign', doctorId: 'd2' });
    const repo = TestBed.inject(PatientRepository);
    expect(repo.getPatientsByDoctor).not.toHaveBeenCalled();
    expect(repo.getAllPatients).not.toHaveBeenCalled();
    expect((component as any).form.value.patientId).toBe('');
  });

  it('renders title when creating', () => {
    component.setData({ allPatients: mockPatients, selectedDoctorId: 'd1', timeSegmentsByDay: { Lun: [{ startTime: '09:00', endTime: '17:00' }] }, consultationDuration: 30 });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Agendar una consulta');
    expect(el.querySelector('.patient-search input')).not.toBeNull();
    expect(el.querySelector('.patient-readonly')).toBeNull();
  });

  it('shows the patient as read-only text when rescheduling while keeping the other fields editable', () => {
    component.setData({
      allPatients: mockPatients,
      selectedDoctorId: 'd1',
      editingAppointment: { id: 'a1', patientId: 'p1', patientName: 'Juan Pérez', date: '2026-07-01', time: '10:00', doctorId: 'd1', notes: 'Test' } as any,
      timeSegmentsByDay: { Lun: [{ startTime: '09:00', endTime: '17:00' }] },
      consultationDuration: 30,
    });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Reagendar consulta');
    const readOnlyPatient = el.querySelector('.patient-readonly') as HTMLElement;
    expect(readOnlyPatient.querySelector('.readonly-label')?.textContent).toContain('Paciente');
    expect(readOnlyPatient.querySelector('.readonly-value')?.textContent).toContain('Juan Pérez');
    expect(readOnlyPatient.querySelector('input')).toBeNull();
    expect(el.querySelector('.patient-search')).toBeNull();
    expect(el.textContent).not.toContain('Añadir nuevo paciente');
    expect((component as any).form.get('patientId')?.value).toBe('p1');
    expect((component as any).form.get('date')?.enabled).toBe(true);
    expect((component as any).form.get('time')?.enabled).toBe(true);
    expect((component as any).form.get('notes')?.enabled).toBe(true);
  });

  it('uses the appointment patient name when the patient is not in the loaded list', () => {
    component.setData({
      allPatients: [],
      selectedDoctorId: 'd1',
      editingAppointment: { id: 'a1', patientId: 'p1', patientName: 'Juan Pérez', date: '2026-07-01', time: '10:00', doctorId: 'd1' } as any,
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.readonly-value')?.textContent).toContain('Juan Pérez');
    expect(fixture.nativeElement.querySelector('.patient-search')).toBeNull();
  });

  it('preserves the original patient when saving a rescheduled appointment', async () => {
    const aptRepo = TestBed.inject(AppointmentRepository);
    const notifications = TestBed.inject(NotificationService);
    const segs = { startTime: '09:00', endTime: '17:00' };
    const allDays = { Lun: [segs], Mar: [segs], Mié: [segs], Jue: [segs], Vie: [segs], Sáb: [segs], Dom: [segs] };
    component.setData({
      allPatients: [...mockPatients, { ...mockPatients[0], id: 'p2', name: 'Ana' }],
      selectedDoctorId: 'd1',
      editingAppointment: { id: 'a1', patientId: 'p1', patientName: 'Juan Pérez', date: '2026-07-01', time: '10:00', doctorId: 'd1' } as any,
      timeSegmentsByDay: allDays,
      consultationDuration: 30,
    });
    (component as any).form.patchValue({ patientId: 'p2', date: new Date(2099, 0, 5), time: '11:00', notes: 'Nuevo horario' });

    await component.save();

    const rescheduledAppointment = expect.objectContaining({
      patientId: 'p1',
      patientName: 'Juan Pérez',
      date: '2099-01-05',
      time: '11:00',
      notes: 'Nuevo horario',
    });
    expect(aptRepo.updateAppointment).toHaveBeenCalledWith('a1', rescheduledAppointment);
    expect(aptRepo.createAppointment).not.toHaveBeenCalled();

    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('locks the preselected patient when scheduling from the patient profile', () => {
    component.setData({ allPatients: mockPatients, selectedDoctorId: 'd1' });
    component.lockPatient('p1');
    fixture.detectChanges();

    const readOnlyPatient = fixture.nativeElement.querySelector('.patient-readonly') as HTMLElement;
    expect((component as any).form.get('patientId')?.value).toBe('p1');
    expect(readOnlyPatient.querySelector('.readonly-label')?.textContent).toContain('Paciente');
    expect(readOnlyPatient.querySelector('.readonly-value')?.textContent).toContain('Juan');
    expect(readOnlyPatient.querySelector('input')).toBeNull();
    expect(fixture.nativeElement.querySelector('.patient-search')).toBeNull();
  });

  it('saves a locked appointment with the preselected patient id', async () => {
    const aptRepo = TestBed.inject(AppointmentRepository);
    (aptRepo.createAppointment as any).mockResolvedValue(undefined);
    component.setData({
      allPatients: mockPatients,
      selectedDoctorId: 'd1',
      timeSegmentsByDay: { Lun: [{ startTime: '09:00', endTime: '17:00' }] },
      consultationDuration: 30,
    });
    component.lockPatient('p1');
    (component as any).form.patchValue({ date: '2099-01-05', time: '10:00', notes: '' });
    (component as any).form.markAsDirty();

    await component.save();

    expect(aptRepo.createAppointment).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ patientId: 'p1' })
    );
  });

  it('keeps the rest of the appointment form enabled when the patient is locked', () => {
    component.setData({ allPatients: mockPatients, selectedDoctorId: 'd1' });
    component.lockPatient('p1');
    fixture.detectChanges();

    expect((component as any).form.get('date')?.enabled).toBe(true);
    expect((component as any).form.get('time')?.enabled).toBe(true);
    expect((component as any).form.get('notes')?.enabled).toBe(true);
    expect(fixture.nativeElement.textContent).not.toContain('Añadir nuevo paciente');
  });

  it('shows error on save when form is invalid', async () => {
    component.setData({ allPatients: mockPatients, selectedDoctorId: 'd1' });
    fixture.detectChanges();
    await component.save();
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('closes dialog on save when form is valid', async () => {
    const aptRepo = TestBed.inject(AppointmentRepository);
    (aptRepo.createAppointment as any).mockResolvedValue(undefined);

    const segs = { startTime: '09:00', endTime: '17:00' };
    const allDays = { Lun: [segs], Mar: [segs], Mié: [segs], Jue: [segs], Vie: [segs], Sáb: [segs], Dom: [segs] };
    component.setData({ allPatients: mockPatients, selectedDoctorId: 'd1', timeSegmentsByDay: allDays, consultationDuration: 30 });
    (component as any).form.patchValue({ patientId: 'p1', date: new Date(2099, 0, 5), time: '10:00', notes: '' });
    (component as any).form.markAsDirty();
    fixture.detectChanges();

    await component.save();

    expect(aptRepo.createAppointment).toHaveBeenCalled();
    expect(alertService.success).toHaveBeenCalled();
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('shows the embedded new patient form instead of a stacked dialog', () => {
    component.setData({ allPatients: mockPatients, selectedDoctorId: 'd1', timeSegmentsByDay: { Lun: [{ startTime: '09:00', endTime: '17:00' }] }, consultationDuration: 30 });
    fixture.detectChanges();

    const addBtn = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
      (b: any) => (b.textContent || '').includes('Añadir nuevo paciente')
    );
    expect(addBtn).toBeTruthy();

    (addBtn as HTMLButtonElement).click();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect((component as any).showNewPatient()).toBe(true);
    expect(el.textContent).toContain('Nombre completo');
    expect(el.querySelector('.btn-back-dialog')).toBeTruthy();
    expect(el.querySelector('app-new-patient-dialog')).toBeTruthy();
  });

  it('returns to the appointment form from the embedded new patient view', async () => {
    component.setData({ allPatients: mockPatients, selectedDoctorId: 'd1', timeSegmentsByDay: { Lun: [{ startTime: '09:00', endTime: '17:00' }] }, consultationDuration: 30 });
    fixture.detectChanges();

    (component as any).showNewPatient.set(true);
    fixture.detectChanges();

    const backBtn = fixture.nativeElement.querySelector('.btn-back-dialog') as HTMLButtonElement;
    backBtn.click();
    fixture.detectChanges();

    expect((component as any).showNewPatient()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Agendar una consulta');
  });

  it('selects the newly created patient after saving from the embedded form', async () => {
    const patientRepo = TestBed.inject(PatientRepository);
    (patientRepo.getPatientsByDoctor as any).mockResolvedValue([...mockPatients, { id: 'p2', doctorId: 'd1', name: 'Ana', lastName: 'López', email: 'ana@test.com', phone: '5599999999', fatherName: 'Luis', motherName: 'Lucía', birthDate: '2021-05-10', otpPassword: 'XYZ789' }]);

    component.setData({ allPatients: mockPatients, selectedDoctorId: 'd1', timeSegmentsByDay: { Lun: [{ startTime: '09:00', endTime: '17:00' }] }, consultationDuration: 30 });
    fixture.detectChanges();

    const newPatient = { id: 'p2', doctorId: 'd1', name: 'Ana', lastName: 'López' };
    await component.onPatientCreated(newPatient as any);

    expect((component as any).showNewPatient()).toBe(false);
    expect((component as any).form.get('patientId')?.value).toBe('p2');
    expect((component as any).patientSearchControl.value).toEqual(expect.objectContaining({ id: 'p2' }));
    expect((component as any).form.get('patientId')?.valid).toBe(true);
    expect(patientRepo.getPatientsByDoctor).toHaveBeenCalledWith('d1');
    expect(patientRepo.getAllPatients).not.toHaveBeenCalled();
  });

  describe('selección después de editar la búsqueda (P24)', () => {
    const secondPatient = { ...mockPatients[0], id: 'synthetic-second', name: 'Paciente', lastName: 'Alternativo' };
    const future = new Date(2099, 0, 5);

    function prepare(role = 'doctor', editing = false) {
      const auth = TestBed.inject(AuthService) as any;
      auth.currentDoctor = role === 'patient' ? null : role === 'assistant'
        ? { uid: 'synthetic-assistant', role, createdBy: 'd1' } : { uid: 'd1', role };
      auth.currentPatient = role === 'patient' ? mockPatients[0] : null;
      component.setData({ selectedDoctorId: 'd1', allPatients: [...mockPatients, secondPatient],
        patientScheduling: role === 'patient',
        timeSegmentsByDay: { [weekdayShortOf(future)]: [{ startTime: '09:00', endTime: '17:00' }] },
        editingAppointment: editing ? { id: 'synthetic-appointment', doctorId: 'd1', patientId: 'p1',
          patientName: 'Paciente original', date: '2099-01-05', time: '10:00' } as any : null });
      (component as any).form.patchValue({ date: future, time: '10:00', notes: 'Motivo sintético' });
    }

    it.each(['doctor', 'assistant', 'patient'])('requires a fresh result after typing and saves the new selection as %s', async role => {
      prepare(role);
      component.onPatientSelected(mockPatients[0]);
      fixture.detectChanges();
      const button = fixture.nativeElement.querySelector('.dialog-btn') as HTMLButtonElement;
      expect(button.disabled).toBe(false);
      const input = fixture.nativeElement.querySelector('.patient-search input') as HTMLInputElement;
      input.value = 'Alternativo';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      fixture.detectChanges();
      expect((component as any).form.controls.patientId.value).toBe('');
      expect(button.disabled).toBe(true);
      expect(fixture.nativeElement.textContent).toContain('Selecciona un paciente de los resultados de búsqueda.');
      expect((component as any).filteredPatients()).toEqual([secondPatient]);
      await component.save();
      const repo = TestBed.inject(AppointmentRepository);
      expect(repo.createAppointment).not.toHaveBeenCalled();

      expect(dialogRef.close).not.toHaveBeenCalled();
      component.onPatientSelected(secondPatient);
      fixture.detectChanges();
      expect(button.disabled).toBe(false);
      expect(fixture.nativeElement.textContent).not.toContain('Selecciona un paciente de los resultados de búsqueda.');
      await component.save();
      expect(repo.createAppointment).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
        patientId: secondPatient.id, patientName: 'Paciente Alternativo', date: '2099-01-05', time: '10:00',
        notes: 'Motivo sintético' }));
    });

    it.each(['', 'Juan Pérez'])('does not infer selection from free text, including the former name: %j', text => {
      prepare();
      component.onPatientSelected(mockPatients[0]);
      (component as any).patientSearchControl.setValue(text);
      expect((component as any).form.controls.patientId.hasError('required')).toBe(true);
      expect((component as any).saveDisabled()).toBe(true);
    });

    it('keeps the selection when focusing the search or filtering the dropdown', async () => {
      prepare();
      component.onPatientSelected(mockPatients[0]);
      fixture.detectChanges();
      fixture.nativeElement.querySelector('.patient-search input').dispatchEvent(new Event('focus'));
      component.filterPatients('');
      expect((component as any).form.controls.patientId.value).toBe('p1');
      expect((component as any).patientSearchControl.value).toEqual(mockPatients[0]);
      await component.save();
      expect(TestBed.inject(AppointmentRepository).createAppointment).toHaveBeenCalledWith(expect.any(String),
        expect.objectContaining({ patientId: 'p1' }));
    });

    it.each(['history', 'reschedule'])('keeps the fixed patient in %s despite search or selection events', async origin => {
      prepare('doctor', origin === 'reschedule');
      if (origin === 'history') component.lockPatient('p1');
      (component as any).patientSearchControl.setValue('Otro texto');
      component.onPatientSelected(secondPatient);
      fixture.detectChanges();
      expect((component as any).form.controls.patientId.value).toBe('p1');
      expect(fixture.nativeElement.querySelector('.patient-search')).toBeNull();
      expect(fixture.nativeElement.querySelector('.patient-readonly')).not.toBeNull();
      (component as any).form.markAsDirty();
      await component.save();
      const repo = TestBed.inject(AppointmentRepository);
      if (origin === 'history') expect(repo.createAppointment).toHaveBeenCalledWith(expect.any(String),
        expect.objectContaining({ patientId: 'p1' }));
      else expect(repo.updateAppointment).toHaveBeenCalledWith('synthetic-appointment',
        expect.objectContaining({ patientId: 'p1' }));
    });

    it('retains the fixed ID with a fallback name when no patient object is loaded', () => {
      component.setData({ selectedDoctorId: 'd1', allPatients: [], editingAppointment: {
        id: 'synthetic-appointment', doctorId: 'd1', patientId: 'p1', patientName: 'Paciente sintético',
        date: '2099-01-05', time: '10:00' } as any });
      expect((component as any).form.controls.patientId.value).toBe('p1');
      expect((component as any).lockedPatientName()).toBe('Paciente sintético');
    });

    it('stops reacting to search changes after the dialog is destroyed', () => {
      prepare();
      component.onPatientSelected(mockPatients[0]);
      fixture.destroy();
      (component as any).patientSearchControl.setValue('Texto posterior');
      expect((component as any).form.controls.patientId.value).toBe('p1');
    });
  });

  describe('fecha y horas disponibles', () => {
    const seg = (startTime: string, endTime: string) => ({ startTime, endTime });
    const allDays = () => {
      const s = [seg('09:00', '17:00')];
      return { Lun: s, Mar: s, Mié: s, Jue: s, Vie: s, Sáb: s, Dom: s };
    };

    function useRole(role: string) {
      const auth = TestBed.inject(AuthService) as any;
      auth.currentDoctor = role === 'patient' ? null : role === 'assistant'
        ? { uid: 'synthetic-assistant', role, createdBy: 'd1' } : { uid: 'd1', role };
      auth.currentPatient = role === 'patient' ? mockPatients[0] : null;
    }

    it.each(['doctor', 'assistant', 'patient'])('saves the chosen clinic day/hour across device day boundaries as %s (P28)', async role => {
      vi.useFakeTimers({ toFake: ['Date'] });
      const clock = TestBed.inject(ClinicClockService);
      try {
        vi.setSystemTime(new Date('2026-10-10T05:15:00Z'));
        clock.refresh();
        useRole(role);
        const selected = new Date(2026, 9, 9);
        component.setData({ allPatients: mockPatients, selectedDoctorId: 'd1', consultationDuration: 15,
          patientScheduling: role === 'patient', timeSegmentsByDay: {
            [weekdayShortOf(selected)]: [seg('23:00', '00:00')],
            [weekdayShortOf(new Date(2026, 9, 10))]: [seg('00:00', '02:00')],
          } });
        const form = (component as any).form;
        form.patchValue({ patientId: 'p1', date: selected, time: '23:30' });
        fixture.detectChanges();
        expect((component as any).availableTimes()).toEqual(['23:30', '23:45']);
        expect((component as any).dateFilter()(selected)).toBe(true);
        expect((component as any).dateFilter()(new Date(2026, 9, 8))).toBe(false);
        await component.save();
        expect(TestBed.inject(AppointmentRepository).createAppointment).toHaveBeenCalledWith(expect.any(String),
          expect.objectContaining({ date: '2026-10-09', time: '23:30', doctorId: 'd1' }));
      } finally {
        vi.useRealTimers();
        clock.refresh();
      }
    });

    it.each(['doctor', 'assistant', 'patient'])('refreshes an open form and refuses a previous clinic day at save as %s (P28)', async role => {
      vi.useFakeTimers({ toFake: ['Date'] });
      const clock = TestBed.inject(ClinicClockService);
      try {
        vi.setSystemTime(new Date('2026-10-10T05:15:00Z'));
        clock.refresh();
        useRole(role);
        const selected = new Date(2026, 9, 9);
        component.setData({ allPatients: mockPatients, selectedDoctorId: 'd1', consultationDuration: 15,
          patientScheduling: role === 'patient', timeSegmentsByDay: { [weekdayShortOf(selected)]: [seg('23:00', '00:00')] } });
        const form = (component as any).form;
        form.patchValue({ patientId: 'p1', date: selected, time: '23:30' });
        fixture.detectChanges();
        vi.setSystemTime(new Date('2026-10-10T05:30:00Z'));
        clock.refresh();
        fixture.detectChanges();
        expect((component as any).availableTimes()).toEqual(['23:45']);
        vi.setSystemTime(new Date('2026-10-10T06:00:00Z'));
        await component.save();
        expect(TestBed.inject(AppointmentRepository).createAppointment).not.toHaveBeenCalled();
        expect(TestBed.inject(AppointmentRepository).updateAppointment).not.toHaveBeenCalled();
        expect((component as any).availableTimes()).toEqual([]);
        expect(form.controls.date.value).toEqual(selected);
        expect((component as any).error()).toContain('El día seleccionado no está disponible');
      } finally {
        vi.useRealTimers();
        clock.refresh();
      }
    });

    it('revalidates the date input and shows an instruction after the last clinic hour passes (P28)', () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      const clock = TestBed.inject(ClinicClockService);
      try {
        vi.setSystemTime(new Date('2026-10-10T05:30:00Z'));
        clock.refresh();
        const selected = new Date(2026, 9, 9);
        component.setData({ allPatients: mockPatients, selectedDoctorId: 'd1', consultationDuration: 15,
          timeSegmentsByDay: { [weekdayShortOf(selected)]: [seg('23:00', '00:00')] } });
        const form = (component as any).form;
        form.patchValue({ patientId: 'p1', date: selected, time: '23:45' });
        form.markAsDirty();
        fixture.detectChanges();
        expect(form.controls.date.valid).toBe(true);
        expect((component as any).saveDisabled()).toBe(false);
        vi.setSystemTime(new Date('2026-10-10T05:45:00Z'));
        clock.refresh();
        fixture.detectChanges();
        expect(form.controls.date.hasError('matDatepickerFilter')).toBe(true);
        expect((component as any).saveDisabled()).toBe(true);
        expect(fixture.nativeElement.textContent).toContain('Selecciona un día con horarios disponibles del consultorio.');
      } finally {
        vi.useRealTimers();
        clock.refresh();
      }
    });

    it.each(['doctor', 'assistant', 'patient'])('clears an invalid hour after changing the day and requires another one as %s (P21)', async role => {
      useRole(role);
      const firstDay = new Date(2099, 0, 5);
      const secondDay = new Date(2099, 0, 6);
      component.setData({ allPatients: mockPatients, selectedDoctorId: 'd1', patientScheduling: role === 'patient',
        timeSegmentsByDay: {
          [weekdayShortOf(firstDay)]: [seg('09:00', '12:00')],
          [weekdayShortOf(secondDay)]: [seg('15:00', '17:00')],
        } });
      const form = (component as any).form;
      form.patchValue({ patientId: 'p1', date: firstDay, time: '10:00', notes: 'Motivo ficticio' });
      form.patchValue({ date: secondDay });
      expect(form.get('time').value).toBe('');
      expect(form.get('time').hasError('required')).toBe(true);
      expect(form.get('patientId').value).toBe('p1');
      expect(form.get('notes').value).toBe('Motivo ficticio');
      expect((component as any).availableTimes()).toEqual(['15:00', '15:30', '16:00', '16:30']);
      await component.save();
      expect(TestBed.inject(AppointmentRepository).createAppointment).not.toHaveBeenCalled();
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Selecciona una hora');
      form.patchValue({ time: '15:00' });
      await component.save();
      expect(TestBed.inject(AppointmentRepository).createAppointment).toHaveBeenCalledWith(expect.any(String),
        expect.objectContaining({ date: '2099-01-06', time: '15:00' }));
    });

    it.each(['doctor', 'assistant', 'patient'])('keeps the hour when it remains valid for the new day as %s (P21)', async role => {
      useRole(role);
      component.setData({ allPatients: mockPatients, selectedDoctorId: 'd1', timeSegmentsByDay: allDays(), patientScheduling: role === 'patient' });
      const form = (component as any).form;
      form.patchValue({ patientId: 'p1', date: new Date(2099, 0, 5), time: '10:00' });
      form.patchValue({ date: new Date(2099, 0, 6) });
      expect(form.get('time').value).toBe('10:00');
      await component.save();
      expect(TestBed.inject(AppointmentRepository).createAppointment).toHaveBeenCalledWith(expect.any(String),
        expect.objectContaining({ date: '2099-01-06', time: '10:00' }));
    });

    it.each(['doctor', 'assistant', 'patient'].flatMap(role => ['create', 'edit'].map(mode => ({ role, mode }))))(
      'rejects a time outside the date slots even if patched directly: %j (P21)', async ({ role, mode }) => {
        useRole(role);
        component.setData({ allPatients: mockPatients, selectedDoctorId: 'd1', timeSegmentsByDay: allDays(), patientScheduling: role === 'patient',
          editingAppointment: mode === 'edit' ? { id: 'synthetic-appointment', doctorId: 'd1', patientId: 'p1', patientName: 'Paciente ficticio',
            date: '2099-01-05', time: '10:00' } as any : null });
        (component as any).form.patchValue({ patientId: 'p1', date: new Date(2099, 0, 5), time: '18:00' });
        await component.save();
        expect(TestBed.inject(AppointmentRepository).createAppointment).not.toHaveBeenCalled();
        expect(TestBed.inject(AppointmentRepository).updateAppointment).not.toHaveBeenCalled();
        expect(dialogRef.close).not.toHaveBeenCalled();
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('.dialog-error')?.textContent).toContain(
          'Selecciona una hora disponible dentro del horario del doctor para el día elegido.');
      }
    );

    it.each(['13:00', '09:15', '10:00'])('rejects a gap, an unaligned hour or a consultation that does not fit the segment: %s (P21)', async time => {
      const date = new Date(2099, 0, 5);
      component.setData({ allPatients: mockPatients, selectedDoctorId: 'd1', consultationDuration: 30,
        timeSegmentsByDay: { [weekdayShortOf(date)]: [seg('09:00', '10:15'), seg('16:00', '17:00')] } });
      (component as any).form.patchValue({ patientId: 'p1', date, time });
      await component.save();
      expect(TestBed.inject(AppointmentRepository).createAppointment).not.toHaveBeenCalled();
      expect((component as any).error()).toContain('Selecciona una hora disponible');
    });

    it('clears the hour on a closed day and rejects a past date supplied as a string (P21)', async () => {
      const date = new Date(2099, 0, 5);
      component.setData({ allPatients: mockPatients, selectedDoctorId: 'd1',
        timeSegmentsByDay: { [weekdayShortOf(date)]: [seg('09:00', '17:00')] } });
      const form = (component as any).form;
      form.patchValue({ patientId: 'p1', date, time: '10:00' });
      form.patchValue({ date: new Date(2099, 0, 6) });
      expect(form.get('time').value).toBe('');
      expect((component as any).availableTimes()).toEqual([]);
      form.patchValue({ date: '2000-01-01', time: '10:00' });
      await component.save();
      expect(TestBed.inject(AppointmentRepository).createAppointment).not.toHaveBeenCalled();
      expect((component as any).error()).toContain('El día seleccionado no está disponible');
    });

    it('recalculates today hours at save after the selected hour has passed (P21)', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      try {
        vi.setSystemTime(new Date('2099-01-05T15:45:00Z'));
        component.setData({ allPatients: mockPatients, selectedDoctorId: 'd1', timeSegmentsByDay: allDays() });
        (component as any).form.patchValue({ patientId: 'p1', date: new Date(2099, 0, 5), time: '10:00' });
        expect((component as any).availableTimes()).toContain('10:00');
        vi.setSystemTime(new Date('2099-01-05T16:00:00Z'));
        await component.save();
        expect(TestBed.inject(AppointmentRepository).createAppointment).not.toHaveBeenCalled();
        expect((component as any).availableTimes()).not.toContain('10:00');
        expect((component as any).error()).toContain('Selecciona una hora disponible');
        (component as any).form.patchValue({ time: '10:30' });
        await component.save();
        expect(TestBed.inject(AppointmentRepository).createAppointment).toHaveBeenCalled();
        expect((component as any).error()).toBe('');
      } finally {
        vi.useRealTimers();
      }
    });

    it('still allows staff overlap at a valid hour with its warning (P21)', async () => {
      component.setData({ allPatients: mockPatients, selectedDoctorId: 'd1', timeSegmentsByDay: allDays(),
        existingAppointments: [{ id: 'other', date: '2099-01-05', time: '10:00', status: 'scheduled' } as any] });
      (component as any).form.patchValue({ patientId: 'p1', date: new Date(2099, 0, 5), time: '10:00' });
      expect((component as any).overlapWarning()).toContain('Ya existe una cita');
      await component.save();
      expect(TestBed.inject(AppointmentRepository).createAppointment).toHaveBeenCalled();
    });

    it('offers a freed hour and can book it without closing the patient form (P19)', async () => {
      const auth = TestBed.inject(AuthService) as any;
      auth.currentDoctor = null; auth.currentPatient = mockPatients[0];
      component.setData({ allPatients: mockPatients, selectedDoctorId: 'd1', timeSegmentsByDay: allDays(),
        patientScheduling: true, occupiedSlots: ['2099-01-05|10:00'], consultationDuration: 30 });
      (component as any).form.patchValue({ patientId: 'p1', date: new Date(2099, 0, 5), time: '10:00' });
      expect((component as any).availableTimes()).not.toContain('10:00');
      await component.save();
      expect(TestBed.inject(AppointmentRepository).createAppointment).not.toHaveBeenCalled();
      component.setOccupiedSlots([]);
      fixture.detectChanges();
      expect((component as any).availableTimes()).toContain('10:00');
      await component.save();
      expect(TestBed.inject(AppointmentRepository).createAppointment).toHaveBeenCalledWith(expect.any(String),
        expect.objectContaining({ date: '2099-01-05', time: '10:00', status: 'scheduled' }));
      expect(dialogRef.close).toHaveBeenCalledWith(true);
    });

    it('continues blocking an hour if a new active booking occupies it while the form is open (P19)', async () => {
      const auth = TestBed.inject(AuthService) as any;
      auth.currentDoctor = null; auth.currentPatient = mockPatients[0];
      component.setData({ allPatients: mockPatients, selectedDoctorId: 'd1', timeSegmentsByDay: allDays(), patientScheduling: true });
      (component as any).form.patchValue({ patientId: 'p1', date: new Date(2099, 0, 5), time: '10:00' });
      component.setOccupiedSlots(['2099-01-05|10:00']);
      expect((component as any).availableTimes()).not.toContain('10:00');
      await component.save();
      expect(TestBed.inject(AppointmentRepository).createAppointment).not.toHaveBeenCalled();
      expect((component as any).error()).toBe('Esa hora ya está ocupada. Elige otra hora disponible.');
    });

    it('does not warn about cancelled or disabled appointments but does warn about active ones (P19)', () => {
      const existing = { id: 'cancelled', date: '2099-01-05', time: '10:00', status: 'cancelled' } as any;
      component.setData({ allPatients: mockPatients, selectedDoctorId: 'd1', timeSegmentsByDay: allDays(),
        existingAppointments: [existing, { ...existing, id: 'disabled', status: 'scheduled', disabled: true }] });
      (component as any).form.patchValue({ date: new Date(2099, 0, 5), time: '10:00' });
      expect((component as any).overlapWarning()).toBe('');
      component.setData({ allPatients: mockPatients, selectedDoctorId: 'd1', timeSegmentsByDay: allDays(),
        existingAppointments: [{ ...existing, id: 'active', status: 'scheduled' }] });
      (component as any).form.patchValue({ time: '10:00' });
      expect((component as any).overlapWarning()).toContain('Ya existe una cita agendada');
      component.setOccupiedSlots([], []);
      expect((component as any).overlapWarning()).toBe('');
    });

    it('dateFilter: past date → disabled; future configured day → enabled', () => {
      component.setData({ allPatients: mockPatients, selectedDoctorId: 'd1', timeSegmentsByDay: allDays(), consultationDuration: 30 });
      const filter = (component as any).dateFilter();
      expect(filter(new Date(2000, 0, 1))).toBe(false);
      expect(filter(new Date(2099, 0, 5))).toBe(true);
    });

    it('dateFilter: day without segments → disabled', () => {
      component.setData({ allPatients: mockPatients, selectedDoctorId: 'd1', timeSegmentsByDay: {}, consultationDuration: 30 });
      expect((component as any).dateFilter()(new Date(2099, 0, 5))).toBe(false);
    });

    it('dateFilter: today without future hours → disabled', () => {
      const today = clinicTodayDate();
      const key = weekdayShortOf(today);
      const pastSeg = [seg('00:00', '00:01')];
      component.setData({ allPatients: mockPatients, selectedDoctorId: 'd1', timeSegmentsByDay: { [key]: pastSeg }, consultationDuration: 60 });
      expect((component as any).dateFilter()(today)).toBe(false);
    });

    it('selecting a valid future date loads only its valid hours', () => {
      const future = new Date(2099, 0, 5);
      const key = weekdayShortOf(future);
      component.setData({
        allPatients: mockPatients,
        selectedDoctorId: 'd1',
        timeSegmentsByDay: { [key]: [seg('09:00', '10:00'), seg('16:00', '17:00')] },
        consultationDuration: 30,
      });
      (component as any).form.patchValue({ date: future });
      expect((component as any).availableTimes()).toEqual(['09:00', '09:30', '16:00', '16:30']);
    });
  });
});
