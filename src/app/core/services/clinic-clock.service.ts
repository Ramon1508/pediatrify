import { DOCUMENT } from '@angular/common';
import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { clinicTimeAt } from '../utils/clinic-time';

@Injectable({ providedIn: 'root' })
export class ClinicClockService {
  private readonly document = inject(DOCUMENT);
  private readonly instant = signal(Date.now());
  readonly now = computed(() => clinicTimeAt(new Date(this.instant())));
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    const resume = () => this.refresh();
    this.scheduleNextMinute();
    this.document.addEventListener('visibilitychange', resume);
    this.document.defaultView?.addEventListener('focus', resume);
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.timer);
      this.document.removeEventListener('visibilitychange', resume);
      this.document.defaultView?.removeEventListener('focus', resume);
    });
  }

  refresh(): void {
    this.instant.set(Date.now());
    this.scheduleNextMinute();
  }

  private scheduleNextMinute(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.refresh(), 60_000 - Date.now() % 60_000);
  }
}
