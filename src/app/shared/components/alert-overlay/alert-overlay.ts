import { Component, inject, signal, ChangeDetectionStrategy, OnDestroy } from '@angular/core';
import { animate, style, transition, trigger } from '@angular/animations';
import { MatIconModule } from '@angular/material/icon';
import { AlertService } from '../../../core/services/alert.service';

@Component({
  selector: 'app-alert-overlay',
  templateUrl: './alert-overlay.html',
  styleUrl: './alert-overlay.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
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
export class AlertOverlay implements OnDestroy {
  protected alertService = inject(AlertService);
  protected inRightPanel = signal(false);

  private observer: MutationObserver | null = null;

  constructor() {
    this.observer = new MutationObserver(() => this.refreshPanelState());
    this.observer.observe(document.body, { childList: true, subtree: true });
    this.refreshPanelState();
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }

  private refreshPanelState(): void {
    this.inRightPanel.set(!!document.querySelector('.cdk-overlay-pane.right-panel'));
  }
}
