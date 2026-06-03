import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { AlertOverlay } from './alert-overlay';
import { AlertService } from '../../../core/services/alert.service';

describe('AlertOverlay', () => {
  let fixture: ComponentFixture<AlertOverlay>;
  let component: AlertOverlay;
  let alertService: AlertService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AlertOverlay, NoopAnimationsModule],
      providers: [
        AlertService,
        { provide: MatDialog, useValue: { open: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AlertOverlay);
    component = fixture.componentInstance;
    alertService = TestBed.inject(AlertService);
    fixture.detectChanges();
  });

  it('renders no alerts initially', () => {
    const wrapper = fixture.nativeElement.querySelector('.alerts-wrapper');
    expect(wrapper.children.length).toBe(0);
  });

  it('renders alerts from the service', () => {
    alertService.success({ message: 'Hello' });
    fixture.detectChanges();

    const boxes = fixture.nativeElement.querySelectorAll('.alert-box');
    expect(boxes.length).toBe(1);
    expect(boxes[0].textContent).toContain('Hello');
  });

  it('applies success class for success alerts', () => {
    alertService.success({ message: 'OK' });
    fixture.detectChanges();

    const box = fixture.nativeElement.querySelector('.alert-box');
    expect(box.classList.contains('alert-success')).toBe(true);
    expect(box.classList.contains('alert-error')).toBe(false);
  });

  it('applies error class for error alerts', () => {
    alertService.error({ message: 'Fail' });
    fixture.detectChanges();

    const box = fixture.nativeElement.querySelector('.alert-box');
    expect(box.classList.contains('alert-error')).toBe(true);
  });

  it('dismisses alert on close button click', () => {
    alertService.success({ message: 'Dismiss me' });
    fixture.detectChanges();

    expect(alertService.alerts().length).toBe(1);

    const closeBtn = fixture.nativeElement.querySelector('.alert-close');
    closeBtn.click();
    fixture.detectChanges();

    expect(alertService.alerts().length).toBe(0);
  });

  it('shows title when provided', () => {
    alertService.success({ message: 'Msg', title: 'Title' });
    fixture.detectChanges();

    const titleEl = fixture.nativeElement.querySelector('.alert-title');
    expect(titleEl).toBeTruthy();
    expect(titleEl.textContent).toContain('Title');
  });

  it('renders multiple alerts', () => {
    alertService.error({ message: 'E1' });
    alertService.success({ message: 'S1' });
    fixture.detectChanges();

    const boxes = fixture.nativeElement.querySelectorAll('.alert-box');
    expect(boxes.length).toBe(2);
  });
});
