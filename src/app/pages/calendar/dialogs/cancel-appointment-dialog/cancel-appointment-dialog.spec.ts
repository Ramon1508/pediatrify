import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { CancelAppointmentDialog } from './cancel-appointment-dialog';

describe('CancelAppointmentDialog', () => {
  function createFixture() {
    const dialogRef = { close: vi.fn() };
    TestBed.configureTestingModule({
      imports: [CancelAppointmentDialog, NoopAnimationsModule],
      providers: [{ provide: MatDialogRef, useValue: dialogRef }],
    });
    const fixture = TestBed.createComponent(CancelAppointmentDialog);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, dialogRef };
  }

  it('renders title and description', () => {
    const { fixture } = createFixture();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Cancelar consulta');
  });

  it('shows close and confirm buttons', () => {
    const { fixture } = createFixture();
    const btns = fixture.nativeElement.querySelectorAll('button');
    const texts = Array.from(btns).map((b: any) => b.textContent.trim());
    expect(texts).toContain('Cerrar');
    expect(texts).toContain('Cancelar consulta');
  });

  it('focuses the dialog container instead of the first tertiary button on open', async () => {
    TestBed.configureTestingModule({
      imports: [CancelAppointmentDialog, NoopAnimationsModule],
    });
    const dialog = TestBed.inject(MatDialog);
    const ref = dialog.open(CancelAppointmentDialog);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const tertiary = document.querySelector('.cancel-actions .btn-tertiary');
    expect(document.activeElement).not.toBe(tertiary);
    expect(document.activeElement?.getAttribute('role')).toBe('dialog');

    ref.close();
  });

  it('closes with false on close()', () => {
    const { component, dialogRef } = createFixture();
    component.close();
    expect(dialogRef.close).toHaveBeenCalledWith(false);
  });

  it('closes with true on confirm()', () => {
    const { component, dialogRef } = createFixture();
    component.confirm();
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });
});
