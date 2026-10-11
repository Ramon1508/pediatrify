import { TestBed } from '@angular/core/testing';
import { Observable, Subscriber } from 'rxjs';
import { AuditLog } from './audit-log';
import { AuditRepository } from '../../core/repositories/audit.repository';
import { AuditEntry } from '../../core/models/user';

describe('AuditLog lifecycle and recovery (P51)', () => {
  let listeners: Subscriber<AuditEntry[]>[];
  const stopped = vi.fn(() => undefined);

  beforeEach(async () => {
    listeners = [];
    stopped.mockClear();
    await TestBed.configureTestingModule({imports: [AuditLog], providers: [{provide: AuditRepository, useValue: {
      watchAll: vi.fn(() => new Observable<AuditEntry[]>((subscriber) => {
        listeners.push(subscriber);
        return stopped;
      })),
    }}]}).compileComponents();
  });

  it('shows loading, then the empty state after the first successful snapshot', () => {
    const fixture = TestBed.createComponent(AuditLog);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('mat-progress-bar')).toBeTruthy();
    expect(fixture.nativeElement.textContent).not.toContain('No hay cambios registrados');
    listeners[0].next([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('mat-progress-bar')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('No hay cambios registrados');
  });

  it('displays an error with a working retry and releases the failed listener', () => {
    const fixture = TestBed.createComponent(AuditLog);
    fixture.detectChanges();
    listeners[0].error(new Error('synthetic denied'));
    fixture.detectChanges();
    expect(stopped).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('No fue posible cargar la bitácora');
    expect(fixture.nativeElement.textContent).not.toContain('No hay cambios registrados');
    fixture.nativeElement.querySelector('button').click();
    listeners[1].next([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('No fue posible cargar');
    expect(fixture.nativeElement.textContent).toContain('No hay cambios registrados');
  });

  it('releases the listener when leaving, including repeated entries', () => {
    for (let i = 0; i < 3; i++) {
      const fixture = TestBed.createComponent(AuditLog);
      fixture.detectChanges();
      fixture.destroy();
      expect(stopped).toHaveBeenCalledTimes(i + 1);
      expect(listeners[i].closed).toBe(true);
    }
  });

  it('replaces a live listener on retry and displays computed row values', () => {
    const fixture = TestBed.createComponent(AuditLog);
    fixture.detectChanges();
    fixture.componentInstance.load();
    expect(stopped).toHaveBeenCalledTimes(1);
    listeners[1].next([{id: 'synthetic', entityId: 'synthetic-entity', action: 'create', entityType: 'patient',
      performedBy: 'Operador sintético', performedByUid: 'synthetic-actor', timestamp: null as any}]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('syntheti…');
    expect(fixture.nativeElement.textContent).toContain('Operador sintético');
  });
});
