import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { animate, style, transition, trigger } from '@angular/animations';
import { MatIconModule } from '@angular/material/icon';
import { AlertService } from '../../../core/services/alert.service';
import { AlertItem } from '../../../core/models/alert';

@Component({
  selector: 'app-alert-overlay',
  templateUrl: './alert-overlay.html',
  styleUrl: './alert-overlay.scss',
  standalone: true,
  imports: [MatIconModule],
  animations: [
    trigger('fadeSlide', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(16px)' }),
        animate('250ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0, transform: 'translateY(16px)' })),
      ]),
    ]),
  ],
})
export class AlertOverlay implements OnInit, OnDestroy {
  private alertService = inject(AlertService);

  protected alert = signal<AlertItem | null>(null);

  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private subscription: any;

  ngOnInit(): void {
    this.subscription = this.alertService.current$.subscribe((item) => {
      this.alert.set(item);
      if (item) {
        this.startTimer(item.duration);
      }
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    if (this.timeoutId) clearTimeout(this.timeoutId);
  }

  private startTimer(duration: number): void {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    this.timeoutId = setTimeout(() => {
      this.alertService.next();
    }, duration);
  }

  close(): void {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    this.alertService.next();
  }

  onDone(): void {
    // animation complete
  }
}
