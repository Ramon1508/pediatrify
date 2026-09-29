import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Carousel } from './carousel';

@Component({
  imports: [Carousel],
  template: `<app-carousel [items]="items()" [slotWidth]="376">
    <ng-template let-item><article>{{ item }}</article></ng-template>
  </app-carousel>`,
})
class CarouselHost {
  items = signal(['Consulta 1', 'Consulta 2', 'Consulta 3']);
}

describe('Carousel', () => {
  let fixture: ComponentFixture<CarouselHost>;
  let resize: ResizeObserverCallback;
  let disconnect: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    disconnect = vi.fn();
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) { resize = callback; }
      observe() {}
      disconnect = disconnect;
    });
    await TestBed.configureTestingModule({ imports: [CarouselHost] }).compileComponents();
    fixture = TestBed.createComponent(CarouselHost);
    fixture.detectChanges();
  });

  afterEach(() => vi.unstubAllGlobals());

  function setWidth(width: number) {
    resize([{ contentRect: { width } } as ResizeObserverEntry], {} as ResizeObserver);
    fixture.detectChanges();
  }

  function visibleItems(): string[] {
    return Array.from(fixture.nativeElement.querySelectorAll('article'), (item: any) => item.textContent.trim());
  }

  function click(selector: string) {
    (fixture.nativeElement.querySelector(selector) as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  it('navigates through appointments one at a time when only one card fits', () => {
    setWidth(358);
    expect(visibleItems()).toEqual(['Consulta 1']);
    expect(fixture.nativeElement.querySelectorAll('.carousel-dot')).toHaveLength(3);
    expect(fixture.nativeElement.querySelector('.carousel-arrow-prev').disabled).toBe(true);
    click('.carousel-arrow-next');
    expect(visibleItems()).toEqual(['Consulta 2']);
    click('.carousel-arrow-next');
    expect(visibleItems()).toEqual(['Consulta 3']);
    expect(fixture.nativeElement.querySelector('.carousel-arrow-next').disabled).toBe(true);
    click('.carousel-arrow-prev');
    expect(visibleItems()).toEqual(['Consulta 2']);
    click('.carousel-dot');
    expect(visibleItems()).toEqual(['Consulta 1']);
  });

  it('keeps multiple cards per page when enough width is available', () => {
    setWidth(800);
    expect(visibleItems()).toEqual(['Consulta 1', 'Consulta 2']);
    click('.carousel-arrow-next');
    expect(visibleItems()).toEqual(['Consulta 3']);
  });

  it('does not offer additional pages for a single appointment', () => {
    fixture.componentInstance.items.set(['Consulta 1']);
    setWidth(358);
    expect(visibleItems()).toEqual(['Consulta 1']);
    expect(fixture.nativeElement.querySelector('.carousel-dots')).toBeNull();
    expect(fixture.nativeElement.querySelector('.carousel-arrow-next').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('.carousel-arrow-prev').disabled).toBe(true);
  });

  it('keeps navigation in range after an appointment is removed on the last page', () => {
    setWidth(358);
    click('.carousel-arrow-next');
    click('.carousel-arrow-next');
    fixture.componentInstance.items.set(['Consulta 1', 'Consulta 2']);
    fixture.detectChanges();
    expect(visibleItems()).toEqual(['Consulta 2']);
    expect(fixture.nativeElement.querySelector('[aria-current="page"]').getAttribute('aria-label')).toBe('Ir a la página 2');
    click('.carousel-arrow-prev');
    expect(visibleItems()).toEqual(['Consulta 1']);
  });

  it('keeps the active page and navigation valid after resizing', () => {
    setWidth(358);
    click('.carousel-arrow-next');
    click('.carousel-arrow-next');
    setWidth(800);
    expect(visibleItems()).toEqual(['Consulta 3']);
    click('.carousel-arrow-prev');
    expect(visibleItems()).toEqual(['Consulta 1', 'Consulta 2']);
    setWidth(358);
    expect(visibleItems()).toEqual(['Consulta 1']);
  });

  it('disconnects the resize observer on destroy', () => {
    fixture.destroy();
    expect(disconnect).toHaveBeenCalled();
  });
});
