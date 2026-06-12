import { Component, input, computed, signal, ContentChild, TemplateRef, ViewChild, ElementRef, ChangeDetectionStrategy, AfterViewInit, OnDestroy } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-carousel',
  templateUrl: './carousel.html',
  styleUrl: './carousel.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, MatIconModule],
})
export class Carousel<T> implements AfterViewInit, OnDestroy {
  readonly items = input.required<T[]>();
  readonly slotWidth = input(376);

  @ContentChild(TemplateRef) itemTemplate?: TemplateRef<{ $implicit: T }>;
  @ViewChild('trackWrapper', { static: false }) trackWrapper?: ElementRef<HTMLElement>;

  protected page = signal(0);
  protected containerWidth = signal(0);
  protected pageSize = computed(() => Math.max(1, Math.floor((this.containerWidth() + 16) / this.slotWidth())));
  protected totalPages = computed(() => Math.max(1, Math.ceil(this.items().length / this.pageSize())));
  protected paginatedItems = computed(() => {
    const all = this.items();
    const size = this.pageSize();
    const total = Math.max(1, Math.ceil(all.length / size));
    const p = Math.min(this.page(), total - 1);
    return all.slice(p * size, p * size + size);
  });

  private ro: ResizeObserver | null = null;

  ngAfterViewInit() {
    const el = this.trackWrapper?.nativeElement;
    if (!el) return;
    this.ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width ?? 0;
      if (w !== this.containerWidth()) {
        this.containerWidth.set(w);
      }
    });
    this.ro.observe(el);
  }

  ngOnDestroy() {
    this.ro?.disconnect();
  }

  prev() {
    this.page.update((p) => Math.max(0, p - 1));
  }

  next() {
    this.page.update((p) => Math.min(this.totalPages() - 1, p + 1));
  }

  goTo(page: number) {
    this.page.set(Math.min(page, this.totalPages() - 1));
  }
}
