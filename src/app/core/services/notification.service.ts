import { Injectable, inject } from '@angular/core';
import { NotificationRepository } from '../repositories/notification.repository';
import { UserRepository } from '../repositories/user.repository';
import { PatientRepository } from '../repositories/patient.repository';
import { AuthService } from './auth.service';
import { Appointment, Patient } from '../models/user';
import {
  AppNotification,
  NotificationRecipientStatus,
  NotificationRecipientType,
  NotificationType,
} from '../models/notification';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private repo = inject(NotificationRepository);
  private userRepo = inject(UserRepository);
  private patientRepo = inject(PatientRepository);
  private auth = inject(AuthService);

  private currentActor(): { id: string; name: string } | null {
    const doctor = this.auth.currentDoctor;
    if (doctor) return { id: doctor.uid, name: doctor.name };
    const patient = this.auth.currentPatient;
    if (patient) return { id: patient.id, name: `${patient.name} ${patient.lastName}`.trim() };
    return null;
  }

  private formatDate(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  private patientName(appointment: Appointment): string {
    return `${appointment.patientName ?? ''} ${appointment.patientLastName ?? ''}`.trim();
  }

  private async buildRecipients(
    doctorId: string,
    patientId: string
  ): Promise<NotificationRecipientStatus[]> {
    const map = new Map<string, NotificationRecipientStatus>();
    const add = (id: string, type: NotificationRecipientType) => {
      if (!id || map.has(id)) return;
      map.set(id, { recipientId: id, recipientType: type, read: false });
    };

    const primary = await this.userRepo.getUser(doctorId);
    if (primary && primary.role !== 'admin') {
      if (primary.role === 'assistant') {
        add(primary.uid, 'assistant');
        const ownerDoctor = await this.userRepo.getUser(primary.createdBy ?? '');
        if (ownerDoctor && ownerDoctor.role === 'doctor') {
          add(ownerDoctor.uid, 'doctor');
          const ownerAssistants =
            await this.userRepo.getAssistantsByDoctor(ownerDoctor.uid);
          for (const assistant of ownerAssistants) {
            add(assistant.uid, 'assistant');
          }
        }
      } else {
        add(primary.uid, 'doctor');
        const assistants = await this.userRepo.getAssistantsByDoctor(doctorId);
        for (const assistant of assistants) {
          add(assistant.uid, 'assistant');
        }
      }
    }

    const patient = await this.patientRepo.getPatient(patientId);
    if (patient) {
      await this.addPatientFamily(patient, map, add);
    }

    return [...map.values()];
  }

  private async addPatientFamily(
    patient: Patient,
    map: Map<string, NotificationRecipientStatus>,
    add: (id: string, type: NotificationRecipientType) => void
  ): Promise<void> {
    const familyIds = new Set<string>();
    familyIds.add(patient.id);
    const emails = [patient.email, patient.secondaryEmail ?? ''];
    for (const email of emails) {
      if (!email) continue;
      const family = await this.patientRepo.findPatientsByLoginEmail(email);
      for (const member of family) {
        familyIds.add(member.id);
      }
    }
    for (const familyId of familyIds) {
      add(familyId, 'patient');
    }
  }

  private async persist(
    type: NotificationType,
    title: string,
    description: string,
    appointmentId: string,
    doctorId: string,
    patientId: string
  ): Promise<void> {
    try {
      const actor = this.currentActor();
      const recipients = await this.buildRecipients(doctorId, patientId);
      if (!recipients.length) return;

      const notification: AppNotification = {
        id: crypto.randomUUID(),
        type,
        title,
        description,
        appointmentId,
        createdAt: new Date(),
        originatorId: actor?.id ?? '',
        originatorName: actor?.name ?? '',
        recipientIds: recipients.map((r) => r.recipientId),
        recipients,
      };
      await this.repo.create(notification);
    } catch (error) {
      console.error('Error al generar notificación', error);
    }
  }

  async notifyAppointmentCreated(appointment: Appointment): Promise<void> {
    const description = `Nueva consulta agendada con ${this.patientName(appointment)} para el ${this.formatDate(appointment.date)} a las ${appointment.time}.`;
    await this.persist(
      'appointment-created',
      'Consulta agendada',
      description,
      appointment.id,
      appointment.doctorId,
      appointment.patientId
    );
  }

  async notifyAppointmentCancelled(appointment: Appointment): Promise<void> {
    const description = `${this.patientName(appointment)} canceló su consulta programada para el ${this.formatDate(appointment.date)} a las ${appointment.time}.`;
    await this.persist(
      'appointment-cancelled',
      'Consulta cancelada',
      description,
      appointment.id,
      appointment.doctorId,
      appointment.patientId
    );
  }

  async notifyAppointmentRescheduled(
    appointment: Appointment,
    previousDate: string,
    previousTime: string
  ): Promise<void> {
    const description = `${this.patientName(appointment)} reagendó su consulta del ${this.formatDate(previousDate)} a las ${previousTime} al ${this.formatDate(appointment.date)} a las ${appointment.time}.`;
    await this.persist(
      'appointment-rescheduled',
      'Consulta reagendada',
      description,
      appointment.id,
      appointment.doctorId,
      appointment.patientId
    );
  }
}