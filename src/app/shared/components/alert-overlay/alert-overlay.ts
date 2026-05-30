import { Component, inject } from '@angular/core';
import { animate, style, transition, trigger } from '@angular/animations';
import { MatIconModule } from '@angular/material/icon';
import { AlertService } from '../../../core/services/alert.service';

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
export class AlertOverlay {
  protected alertService = inject(AlertService);
}
