import { Timestamp } from 'firebase/firestore';

export type NotificationType =
  | 'appointment-created'
  | 'appointment-cancelled'
  | 'appointment-rescheduled';

export type NotificationRecipientType = 'doctor' | 'assistant' | 'patient';

export type NotificationFilter = 'all' | 'unread';

/** Destinatario de una notificación (fan-out: un doc por destinatario). */
export interface NotificationRecipient {
  recipientId: string;
  recipientType: NotificationRecipientType;
}

/**
 * Notificación ENVIADA a un destinatario individual (modelo fan-out).
 * `read` es el estado de lectura de ESTE destinatario (única fuente de verdad).
 */
export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  appointmentId?: string;
  createdAt: Timestamp | Date;
  originatorId: string;
  originatorName: string;
  recipientId: string;
  recipientType: NotificationRecipientType;
  read: boolean;
}
