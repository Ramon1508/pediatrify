import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GrowthCharts } from './growth-charts';
import { AuthService } from '../../../../core/services/auth.service';
import { PrintSettingsRepository } from '../../../../core/repositories/print-settings.repository';
import { ClinicalRecord } from '../../../../core/models/clinical-record';
import { Sexo } from '../../../../core/models/sexo';

describe('GrowthCharts reactive presentation', () => {
  let fixture: ComponentFixture<GrowthCharts>;
  const record = (date = '2021-01-01', weight = 6): ClinicalRecord => ({
    id: 'synthetic-record', patientId: 'synthetic-patient', date, weight, height: 60,
    headCircumference: 40, motivoConsulta: '', createdBy: 'synthetic-doctor',
  });
  const setRecord = (entry: ClinicalRecord) => {
    fixture.componentRef.setInput('records', [entry]);
    fixture.componentRef.setInput('selectedRecord', entry);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GrowthCharts],
      providers: [
        { provide: AuthService, useValue: { currentDoctor: null } },
        { provide: PrintSettingsRepository, useValue: { getSettings: vi.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(GrowthCharts);
    fixture.componentRef.setInput('birthDate', '2020-01-01');
    fixture.componentRef.setInput('patientSex', Sexo.Masculino);
    fixture.detectChanges();
  });

  it('hides measurement overlay and printing when no clinical measurements are loaded', () => {
    expect(fixture.nativeElement.querySelector('.cdc-img')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.cdc-overlay')).toBeNull();
    expect(fixture.nativeElement.querySelector('.print-btn')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.chart-chip')).toHaveLength(2);
  });

  it('updates the rendered measurement overlay when the selected record changes', () => {
    setRecord(record());
    const before = fixture.nativeElement.querySelector('.cdc-overlay').innerHTML;
    expect(fixture.nativeElement.querySelector('.print-btn')).not.toBeNull();
    setRecord(record('2021-01-01', 7));
    expect(fixture.nativeElement.querySelector('.cdc-overlay').innerHTML).not.toBe(before);
  });

  it('switches charts by the real button and returns to a valid tab when the age changes', () => {
    setRecord(record());
    const initialImage = fixture.nativeElement.querySelector('.cdc-img').getAttribute('src');
    const circumference = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.chart-chip'))
      .find(button => button.textContent?.includes('Circunferencia'));
    circumference!.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.cdc-img').getAttribute('src')).not.toBe(initialImage);
    expect(fixture.nativeElement.querySelector('.chart-chip.active').textContent).toContain('Circunferencia');
    setRecord(record('2024-01-01'));
    expect(fixture.nativeElement.querySelector('.charts-tabs').textContent).not.toContain('Circunferencia');
    expect(fixture.nativeElement.querySelector('.chart-chip.active').textContent).toContain('Estatura y peso');
    expect(fixture.nativeElement.querySelector('.charts-tabs').textContent).toContain('IMC');
  });
});
