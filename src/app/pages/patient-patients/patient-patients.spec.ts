import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { PatientPatients } from './patient-patients';
import { AuthService } from '../../core/services/auth.service';
import { PatientRepository } from '../../core/repositories/patient.repository';
import { ClinicClockService } from '../../core/services/clinic-clock.service';

describe('PatientPatients (P42)', () => {
  let fixture: ComponentFixture<PatientPatients>;
  const child = { id: 'c1', doctorId: 'd1', name: 'Ana', lastName: 'R', email: 'f@test.com', birthDate: '2020-01-15' };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PatientPatients, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { currentPatient: child, currentPatientLoginEmail: 'f@test.com' } },
        { provide: PatientRepository, useValue: { getChildrenGroup: vi.fn().mockResolvedValue([child]) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PatientPatients);
  });

  it('shows an error state with retry and retries the load (P42)', async () => {
    const repo = TestBed.inject(PatientRepository) as any;
    repo.getChildrenGroup.mockRejectedValue(new Error('fail'));
    const component = fixture.componentInstance as any;

    await component.ngOnInit();
    fixture.detectChanges();
    expect(component.error()).toBe(true);
    expect(component.loading()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('No fue posible cargar tus pacientes.');

    repo.getChildrenGroup.mockResolvedValue([child]);
    await component.load();
    fixture.detectChanges();
    expect(component.error()).toBe(false);
    expect(component.children()).toEqual([child]);
  });

  it('refreshes the visible age after a date change without reloading the family', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 0, 14, 12));
      const clock = TestBed.inject(ClinicClockService);
      clock.refresh();
      await fixture.componentInstance.ngOnInit();
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('5 años 11 meses');
      vi.setSystemTime(new Date(2026, 0, 15, 12));
      clock.refresh();
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('6 años');
      expect(fixture.nativeElement.textContent).not.toContain('5 años 11 meses');
      expect(TestBed.inject(PatientRepository).getChildrenGroup).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
