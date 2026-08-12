import { Timestamp } from 'firebase/firestore';

export type NotificationType =
  | 'appointment-created'
  | 'appointment-cancelled'
  | 'appointment-rescheduled';

export type NotificationRecipientType = 'doctor' | 'assistant' | 'patient';

export interface NotificationRecipientStatus {
  recipientId: string;
  recipientType: NotificationRecipientType;
  read: boolean;
}

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  appointmentId?: string;
  createdAt: Timestamp | Date;
  originatorId: string;
  originatorName: string;
  recipientIds: string[];
  recipients: NotificationRecipientStatus[];
}
