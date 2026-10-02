import { Component, ChangeDetectionStrategy } from '@angular/core';
import { ProfileDialog } from '../../shared/components/profile-dialog/profile-dialog';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProfileDialog],
  template: `<app-profile-dialog [asPage]="true" />`,
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
export class ProfilePage {}
