import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
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
    const auth = { currentDoctor: { uid: 'doc1', role } } as any;
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
      ],
    }).overrideProvider(MatDialog, {
      useValue: {
        open: vi.fn().mockReturnValue({
          afterClosed: vi.fn().mockReturnValue(of(true)),
          componentInstance: { setDoctor: vi.fn() },
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
    (emptyComponent.componentInstance as any).doctors.set([]);
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
});
