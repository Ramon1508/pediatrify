import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef } from '@angular/material/dialog';
import { DeleteDoctorDialog } from './delete-doctor-dialog';
import { UserRepository } from '../../../../core/repositories/user.repository';
import { AlertService } from '../../../../core/services/alert.service';
import { AppUser } from '../../../../core/models/user';

describe('DeleteDoctorDialog', () => {
  const mockDoctor: AppUser = { uid: 'd1', name: 'Dr. Test', email: 'test@mail.com', role: 'doctor', pending: false };

  function createFixture() {
    const userRepo = { deleteUser: vi.fn().mockResolvedValue(undefined) };
    const alertService = { success: vi.fn(), error: vi.fn() };
    const dialogRef = { close: vi.fn() };

    TestBed.configureTestingModule({
      imports: [DeleteDoctorDialog, NoopAnimationsModule],
      providers: [
        { provide: UserRepository, useValue: userRepo },
        { provide: AlertService, useValue: alertService },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    });

    const fixture = TestBed.createComponent(DeleteDoctorDialog);
    const component = fixture.componentInstance;
    component.setDoctor(mockDoctor);
    fixture.detectChanges();
    return { fixture, component, userRepo, alertService, dialogRef };
  }

  it('renders title and description', () => {
    const { fixture } = createFixture();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Eliminar asistente');
  });

  it('shows cancel and confirm buttons', () => {
    const { fixture } = createFixture();
    const btns = fixture.nativeElement.querySelectorAll('button');
    const texts = Array.from(btns).map((b: any) => b.textContent.trim());
    expect(texts).toContain('Cancelar');
    expect(texts).toContain('Eliminar asistente');
  });

  it('calls deleteUser and closes with true on confirm', async () => {
    const { component, userRepo, alertService, dialogRef } = createFixture();
    await component.confirm();
    expect(userRepo.deleteUser).toHaveBeenCalledWith('d1');
    expect(alertService.success).toHaveBeenCalledWith({ message: 'Asistente eliminado', duration: 3000 });
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('shows error on delete failure', async () => {
    const { component, userRepo, alertService } = createFixture();
    userRepo.deleteUser.mockRejectedValue(new Error('fail'));
    await component.confirm();
    expect(alertService.error).toHaveBeenCalledWith({ message: 'Error al eliminar asistente' });
  });

  it('closes with false on close()', () => {
    const { component, dialogRef } = createFixture();
    component.close();
    expect(dialogRef.close).toHaveBeenCalledWith(false);
  });
});
