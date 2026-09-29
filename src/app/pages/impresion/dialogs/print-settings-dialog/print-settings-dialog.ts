import { ChangeDetectionStrategy, Component, inject, Signal, TemplateRef } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface PrintSettingsDialogData {
  tabs: TemplateRef<{ editing: boolean; mobilePreview: boolean }>;
  saving: Signal<boolean>;
  save: () => void;
}

@Component({
  selector: 'app-print-settings-dialog',
  imports: [NgTemplateOutlet, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './print-settings-dialog.html',
  styleUrl: './print-settings-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrintSettingsDialog {
  protected readonly data = inject<PrintSettingsDialogData>(MAT_DIALOG_DATA);
}
