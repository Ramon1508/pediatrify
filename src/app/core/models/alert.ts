export type AlertType = 'success' | 'error' | 'info' | 'warning';

export interface AlertConfig {
  message: string;
  title?: string;
  duration?: number;
  type?: AlertType;
}

export interface AlertItem {
  id: string;
  message: string;
  title?: string;
  duration: number;
  type: AlertType;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: AlertType;
}
