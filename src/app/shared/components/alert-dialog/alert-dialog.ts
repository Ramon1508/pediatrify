import { Component, inject } from '@angular/core';
import { MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { ConfirmOptions } from '../../../core/models/alert';

@Component({
  selector: 'app-alert-dialog',
  templateUrl: './alert-dialog.html',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
})
export class AlertDialog {
  protected data: ConfirmOptions = inject(MAT_DIALOG_DATA);
}
