import { Component, ChangeDetectionStrategy } from '@angular/core';
import { NotificationsDialog } from '../../shared/components/notifications-dialog/notifications-dialog';

@Component({
  selector: 'app-notifications-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NotificationsDialog],
  template: `<app-notifications-dialog [asPage]="true" />`,
  styles: [
    `
      :host {
        display: block;
        min-height: 100%;
        background: #ffffff;
      }
    `,
  ],
})
export class NotificationsPage {}
