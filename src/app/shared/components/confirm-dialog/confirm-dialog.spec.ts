import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ConfirmDialog, ConfirmDialogData } from './confirm-dialog';

describe('ConfirmDialog', () => {
  const baseData: ConfirmDialogData = {
    title: '¿Eliminar?',
    message: 'Esta acción no se puede deshacer',
  };

  function createFixture(data: ConfirmDialogData = baseData) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ConfirmDialog, NoopAnimationsModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(ConfirmDialog);
    fixture.detectChanges();
    return fixture;
  }

  it('renders title and message', () => {
    const el = createFixture().nativeElement as HTMLElement;
    expect(el.textContent).toContain('¿Eliminar?');
    expect(el.textContent).toContain('Esta acción no se puede deshacer');
  });

  it('shows default button labels', () => {
    const el = createFixture().nativeElement as HTMLElement;
    expect(el.textContent).toContain('Cerrar');
    expect(el.textContent).toContain('Confirmar');
  });

  it('uses custom button labels from data', () => {
    const data: ConfirmDialogData = {
      title: 'Test',
      message: 'Test msg',
      confirmLabel: 'Sí, borrar',
      cancelLabel: 'No, volver',
    };
    const el = createFixture(data).nativeElement as HTMLElement;
    expect(el.textContent).toContain('Sí, borrar');
    expect(el.textContent).toContain('No, volver');
  });

  it('closes with false on cancel', () => {
    const ref = { close: vi.fn() };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ConfirmDialog, NoopAnimationsModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: baseData },
        { provide: MatDialogRef, useValue: ref },
      ],
    });
    const fixture = TestBed.createComponent(ConfirmDialog);
    fixture.detectChanges();
    const btns = fixture.nativeElement.querySelectorAll('button');
    const cancelBtn = Array.from(btns).find((b: any) => b.textContent.includes('Cerrar')) as HTMLButtonElement;
    cancelBtn.click();
    expect(ref.close).toHaveBeenCalledWith(false);
  });

  it('closes with true on confirm', () => {
    const ref = { close: vi.fn() };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ConfirmDialog, NoopAnimationsModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: baseData },
        { provide: MatDialogRef, useValue: ref },
      ],
    });
    const fixture = TestBed.createComponent(ConfirmDialog);
    fixture.detectChanges();
    const btns = fixture.nativeElement.querySelectorAll('button');
    const confirmBtn = Array.from(btns).find((b: any) => b.textContent.includes('Confirmar')) as HTMLButtonElement;
    confirmBtn.click();
    expect(ref.close).toHaveBeenCalledWith(true);
  });
});
