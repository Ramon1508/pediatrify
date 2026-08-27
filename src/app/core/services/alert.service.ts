import { Injectable, inject, signal } from '@angular/core';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { AlertDialog } from '../../shared/components/alert-dialog/alert-dialog';
import { AlertConfig, AlertItem, AlertType, ConfirmOptions, MAX_ALERTS } from '../models/alert';

@Injectable({
  providedIn: 'root',
})
export class AlertService {
  readonly alerts = signal<AlertItem[]>([]);

  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  private show(config: AlertConfig, type: AlertType): void {
    const item: AlertItem = {
      id: crypto.randomUUID(),
      message: config.message,
      title: config.title,
      duration: config.duration ?? 5000,
      type,
    };

    this.alerts.update((list) => {
      const next = [...list, item];
      return next.length > MAX_ALERTS ? next.slice(next.length - MAX_ALERTS) : next;
    });

    if (item.duration > 0) {
      this.timers.set(
        item.id,
        setTimeout(() => this.dismiss(item.id), item.duration)
      );
    }
  }

  dismiss(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this.alerts.update((list) => list.filter((a) => a.id !== id));
  }

  clear(): void {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers.clear();
    this.alerts.set([]);
  }

  success(config: AlertConfig): void {
    this.show(config, 'success');
  }

  error(config: AlertConfig): void {
    this.show(config, 'error');
  }

  warning(config: AlertConfig): void {
    this.show(config, 'warning');
  }

  private dialog = inject(MatDialog);

  confirm(options: ConfirmOptions) {
    const config: MatDialogConfig = {
      width: '552px',
      maxWidth: '552px',
      disableClose: false,
      panelClass: 'context-card-panel',
      data: options,
    };
    return this.dialog.open(AlertDialog, config);
  }
}
