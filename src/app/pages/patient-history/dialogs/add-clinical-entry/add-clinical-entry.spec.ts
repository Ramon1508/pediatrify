import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef } from '@angular/material/dialog';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MAT_DATE_LOCALE } from '@angular/material/core';
import { AddClinicalEntry } from './add-clinical-entry';
import { ClinicalRecordRepository } from '../../../../core/repositories/clinical-record.repository';
import { AuthService } from '../../../../core/services/auth.service';
import { AlertService } from '../../../../core/services/alert.service';

describe('AddClinicalEntry', () => {
  const mockDoctor = { uid: 'd1', name: 'Dr. Test', email: 'test@mail.com' };

  function createFixture() {
    const repo = { create: vi.fn().mockResolvedValue(undefined) };
    const alertService = { success: vi.fn(), error: vi.fn() };
    const dialogRef = { close: vi.fn() };

    TestBed.configureTestingModule({
      imports: [AddClinicalEntry, NoopAnimationsModule],
      providers: [
        provideNativeDateAdapter(),
        { provide: MAT_DATE_LOCALE, useValue: 'es-MX' },
        { provide: ClinicalRecordRepository, useValue: repo },
        { provide: AuthService, useValue: { currentDoctor: mockDoctor } },
        { provide: AlertService, useValue: alertService },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    });

    const fixture = TestBed.createComponent(AddClinicalEntry);
    const component = fixture.componentInstance as any;
    component.setPatientId('p1');
    fixture.detectChanges();
    return { fixture, component, repo, alertService, dialogRef };
  }

  it('renders title', () => {
    const { fixture } = createFixture();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Nueva entrada clínica');
  });

  it('renders form fields', () => {
    const { fixture } = createFixture();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Motivo de consulta');
    expect(el.textContent).toContain('Diagnóstico');
    expect(el.textContent).toContain('Notas generales');
  });

  it('calls create on save', async () => {
    const { component, repo, alertService, dialogRef } = createFixture();
    component.form.setValue({ date: '2026-06-15', motivoConsulta: 'Dolor de cabeza', diagnosis: '', notas: '' });
    await component.save();
    expect(repo.create).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      patientId: 'p1',
      motivoConsulta: 'Dolor de cabeza',
    }));
    expect(alertService.success).toHaveBeenCalledWith({ message: 'Entrada agregada', duration: 3000 });
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('shows error on save failure', async () => {
    const { component, repo, alertService } = createFixture();
    repo.create.mockRejectedValue(new Error('fail'));
    component.form.setValue({ date: '2026-06-15', motivoConsulta: 'Dolor', diagnosis: '', notas: '' });
    await component.save();
    expect(alertService.error).toHaveBeenCalledWith({ message: 'Error al guardar la entrada', duration: 5000 });
  });

  it('closes dialog on close()', () => {
    const { component, dialogRef } = createFixture();
    component.close();
    expect(dialogRef.close).toHaveBeenCalled();
  });
});
