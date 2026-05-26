import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { AlertDialog } from '../../shared/components/alert-dialog/alert-dialog';
import { AlertConfig, AlertItem, AlertType, ConfirmOptions } from '../models/alert';

@Injectable({
  providedIn: 'root',
})
export class AlertService {
  private queue: AlertItem[] = [];
  private showing = false;

  private currentSubject = new BehaviorSubject<AlertItem | null>(null);
  current$ = this.currentSubject.asObservable();

  private show(config: AlertConfig, type: AlertType): void {
    const item: AlertItem = {
      id: crypto.randomUUID(),
      message: config.message,
      title: config.title,
      duration: config.duration ?? 1500,
      type,
    };
    this.queue.push(item);
    this.processQueue();
  }

  private processQueue(): void {
    if (this.showing || this.queue.length === 0) return;
    this.showing = true;
    const item = this.queue.shift()!;
    this.currentSubject.next(item);
  }

  next(): void {
    this.currentSubject.next(null);
    this.showing = false;
    this.processQueue();
  }

  clear(): void {
    this.queue = [];
    this.currentSubject.next(null);
    this.showing = false;
  }

  success(config: AlertConfig): void {
    this.show(config, 'success');
  }

  error(config: AlertConfig): void {
    this.show(config, 'error');
  }

  info(config: AlertConfig): void {
    this.show(config, 'info');
  }

  warning(config: AlertConfig): void {
    this.show(config, 'warning');
  }

  private dialog = inject(MatDialog);

  confirm(options: ConfirmOptions) {
    const config: MatDialogConfig = {
      width: '400px',
      disableClose: true,
      data: options,
    };
    return this.dialog.open(AlertDialog, config);
  }
}
