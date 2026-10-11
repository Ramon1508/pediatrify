import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { Doctors } from './doctors';
import { UserRepository } from '../../core/repositories/user.repository';
import { AlertService } from '../../core/services/alert.service';
import { AuthService } from '../../core/services/auth.service';

describe('Doctors', () => {
  let fixture: ComponentFixture<Doctors>;
  let component: Doctors;

  const mockUsers = [
    { uid: '1', name: 'Dr. A', email: 'a@test.com', role: 'doctor', profileComplete: true },
    { uid: '2', name: 'Dr. B', email: 'b@test.com', role: 'doctor', profileComplete: false },
  ] as any[];

  function makeAuth(role: string) {
    const auth = { currentDoctor: { uid: 'doc1', role }, session$: of(null) } as any;
    return auth;
  }

  beforeEach(async () => {
    const userRepoSpy = {
      watchAllUsers: vi.fn().mockReturnValue(of(mockUsers)),
      deleteUser: vi.fn(),
      updateUser: vi.fn(),
    } as any;
    const alertSpy = { success: vi.fn(), error: vi.fn() } as any;
    await TestBed.configureTestingModule({
      imports: [Doctors, NoopAnimationsModule],
      providers: [
        { provide: UserRepository, useValue: userRepoSpy },
        { provide: AlertService, useValue: alertSpy },
        { provide: AuthService, useValue: makeAuth('admin') },
        { provide: ActivatedRoute, useValue: { snapshot: { data: {} } } },
      ],
    }).overrideProvider(MatDialog, {
      useValue: {
        open: vi.fn().mockReturnValue({
          afterClosed: vi.fn().mockReturnValue(of(true)),
          componentInstance: { setDoctor: vi.fn(), setResendTarget: vi.fn(), setTargetRole: vi.fn() },
          _openDialogs: [],
          addPanelClass: vi.fn(),
          removePanelClass: vi.fn(),
          close: vi.fn(),
        }),
        _openDialogs: [],
        _afterAllClosed: { subscribe: vi.fn() },
        afterOpened: { subscribe: vi.fn(), pipe: vi.fn().mockReturnThis() },
      },
    }).compileComponents();

    fixture = TestBed.createComponent(Doctors);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('admin renders a list of doctors', () => {
    const el = fixture.nativeElement;
    expect(el.textContent).toContain('Doctores');
    expect(el.textContent).toContain('Agregar doctor');
    expect(el.textContent).toContain('Dr. A');
    expect(el.textContent).toContain('Dr. B');
  });

  it('shows doctor count', () => {
    expect((component as any).doctors().length).toBe(2);
  });

  it('opens invite dialog when adding a new doctor', () => {
    const dialog = TestBed.inject(MatDialog);
    (component as any).openNewDoctor();
    expect(dialog.open).toHaveBeenCalled();
  });

  it('opens the invitation panel to resend the same pending user', () => {
    const dialog = TestBed.inject(MatDialog);
    component.resendInvitation({ ...mockUsers[1], pending: true });
    expect(dialog.open).toHaveBeenCalledOnce();
    expect((dialog.open as any).mock.results[0].value.componentInstance.setResendTarget)
      .toHaveBeenCalledWith({ ...mockUsers[1], pending: true });
  });
  it('does not resend an active account', () => {
    const dialog = TestBed.inject(MatDialog);
    component.resendInvitation(mockUsers[0]); expect(dialog.open).not.toHaveBeenCalled();
  });

  it('opens edit dialog when editing a doctor', () => {
    const dialog = TestBed.inject(MatDialog);
    (component as any).openEditDoctor(mockUsers[0]);
    expect(dialog.open).toHaveBeenCalled();
  });

  it('opens delete dialog when deleting a doctor', () => {
    const dialog = TestBed.inject(MatDialog);
    (component as any).deleteDoctor(mockUsers[0]);
    expect(dialog.open).toHaveBeenCalled();
  });

  it('filters doctors by name via searchControl', () => {
    (component as any).searchControl.setValue('Dr. A');
    fixture.detectChanges();

    expect((component as any).filteredDoctors().length).toBe(1);
    expect((component as any).filteredDoctors()[0].name).toBe('Dr. A');
  });

  it('shows empty state when no doctors', async () => {
    const emptyComponent = TestBed.createComponent(Doctors);
    emptyComponent.detectChanges();
    (emptyComponent.componentInstance as any).users.set([]);
    (emptyComponent.componentInstance as any).loading.set(false);
    emptyComponent.detectChanges();

    const el = emptyComponent.nativeElement;
    expect(el.textContent).toContain('No has agregado ningún doctor');
  });

  it('doctor role manages only their own assistants with assistant labels', async () => {
    TestBed.resetTestingModule();
    const userRepoSpy = {
      watchAllUsers: vi.fn().mockReturnValue(of([
        { uid: '1', name: 'Asistente A', email: 'a@test.com', role: 'assistant', createdBy: 'doc1', profileComplete: true },
        { uid: '2', name: 'Asistente B', email: 'b@test.com', role: 'assistant', createdBy: 'other', profileComplete: true },
      ])),
      deleteUser: vi.fn(),
      updateUser: vi.fn(),
    } as any;
    const alertSpy = { success: vi.fn(), error: vi.fn() } as any;
    await TestBed.configureTestingModule({
      imports: [Doctors, NoopAnimationsModule],
      providers: [
        { provide: UserRepository, useValue: userRepoSpy },
        { provide: AlertService, useValue: alertSpy },
        { provide: AuthService, useValue: makeAuth('doctor') },
        { provide: ActivatedRoute, useValue: { snapshot: { data: {} } } },
      ],
    }).overrideProvider(MatDialog, {
      useValue: { open: vi.fn() },
    }).compileComponents();

    const f = TestBed.createComponent(Doctors);
    f.detectChanges();
    const c = f.componentInstance as any;
    expect((c as any).doctors().length).toBe(1);
    expect((c as any).doctors()[0].name).toBe('Asistente A');
    expect(f.nativeElement.textContent).toContain('Asistentes');
    expect(f.nativeElement.textContent).toContain('Agregar asistente');
  });

  it('administrators directory lists admins, labels accordingly and invites admins (P45)', async () => {
    TestBed.resetTestingModule();
    const admins = [
      { uid: 'admin1', name: 'Admin Uno', email: 'a1@test.com', role: 'admin', profileComplete: true },
      { uid: 'admin2', name: 'Admin Dos', email: 'a2@test.com', role: 'admin', profileComplete: true },
      { uid: 'doc1', name: 'Dr. Uno', email: 'd@test.com', role: 'doctor', profileComplete: true },
    ];
    const alertSpy = { success: vi.fn(), error: vi.fn() } as any;
    const dialogOpen = vi.fn().mockReturnValue({ afterClosed: vi.fn().mockReturnValue(of(true)),
      componentInstance: { setDoctor: vi.fn(), setResendTarget: vi.fn(), setTargetRole: vi.fn() } });
    await TestBed.configureTestingModule({
      imports: [Doctors, NoopAnimationsModule],
      providers: [
        { provide: UserRepository, useValue: { watchAllUsers: vi.fn().mockReturnValue(of(admins)) } },
        { provide: AlertService, useValue: alertSpy },
        { provide: AuthService, useValue: { currentDoctor: { uid: 'admin1', role: 'admin' }, session$: of(null) } },
        { provide: ActivatedRoute, useValue: { snapshot: { data: { directory: 'admin' } } } },
      ],
    }).overrideProvider(MatDialog, { useValue: { open: dialogOpen } }).compileComponents();

    const f = TestBed.createComponent(Doctors);
    f.detectChanges();
    const c = f.componentInstance as any;
    expect(c.doctors().map((u: any) => u.uid)).toEqual(['admin1', 'admin2']);
    expect(f.nativeElement.textContent).toContain('Administradores');
    expect(f.nativeElement.textContent).toContain('Agregar administrador');

    c.openNewDoctor();
    expect(dialogOpen.mock.results[0].value.componentInstance.setTargetRole).toHaveBeenCalledWith('admin');

    c.deleteDoctor(admins[0]);
    expect(dialogOpen).toHaveBeenCalledTimes(1);
    expect(alertSpy.error).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'No puedes eliminar tu propia cuenta de administrador.' }));
  });

  it('blocks deleting the last administrator (P45)', async () => {
    TestBed.resetTestingModule();
    const onlyAdmin = [{ uid: 'admin2', name: 'Admin Dos', email: 'a2@test.com', role: 'admin', profileComplete: true }];
    const dialogOpen = vi.fn();
    const alertSpy = { success: vi.fn(), error: vi.fn() } as any;
    await TestBed.configureTestingModule({
      imports: [Doctors, NoopAnimationsModule],
      providers: [
        { provide: UserRepository, useValue: { watchAllUsers: vi.fn().mockReturnValue(of(onlyAdmin)) } },
        { provide: AlertService, useValue: alertSpy },
        { provide: AuthService, useValue: { currentDoctor: { uid: 'admin1', role: 'admin' }, session$: of(null) } },
        { provide: ActivatedRoute, useValue: { snapshot: { data: { directory: 'admin' } } } },
      ],
    }).overrideProvider(MatDialog, { useValue: { open: dialogOpen } }).compileComponents();

    const f = TestBed.createComponent(Doctors);
    f.detectChanges();
    const c = f.componentInstance as any;
    c.deleteDoctor(onlyAdmin[0]);
    expect(dialogOpen).not.toHaveBeenCalled();
    expect(alertSpy.error).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Debe existir al menos un administrador.' }));
  });
});
