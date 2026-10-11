import { Component, inject, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { ConfirmOptions } from '../../../core/models/alert';

@Component({
  selector: 'app-alert-dialog',
  templateUrl: './alert-dialog.html',
  styleUrl: './alert-dialog.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule],
})
export class AlertDialog {
  protected data = signal<ConfirmOptions>(inject(MAT_DIALOG_DATA));
}
