import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { AlertDialog } from './alert-dialog';
import { ConfirmOptions } from '../../../core/models/alert';

describe('AlertDialog', () => {
  let fixture: ComponentFixture<AlertDialog>;
  let component: AlertDialog;

  const defaultData: ConfirmOptions = {
    title: 'Confirmar',
    message: '¿Estás seguro?',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AlertDialog, MatDialogModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: defaultData },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AlertDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders title and message', () => {
    const el = fixture.nativeElement;
    expect(el.textContent).toContain('Confirmar');
    expect(el.textContent).toContain('¿Estás seguro?');
  });

  it('shows default button labels', () => {
    const el = fixture.nativeElement;
    expect(el.textContent).toContain('Cerrar');
    expect(el.textContent).toContain('Aceptar');
  });

  it('uses custom button labels from data', async () => {
    const customData: ConfirmOptions = {
      title: 'Eliminar',
      message: '¿Eliminar?',
      confirmText: 'Sí, eliminar',
      cancelText: 'No',
    };

    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [AlertDialog, MatDialogModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: customData },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
      ],
    }).compileComponents();

    const customFixture = TestBed.createComponent(AlertDialog);
    customFixture.detectChanges();
    const el = customFixture.nativeElement;
    expect(el.textContent).toContain('Sí, eliminar');
    expect(el.textContent).toContain('No');
  });
});
