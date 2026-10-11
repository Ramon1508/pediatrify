import { Injectable, inject } from '@angular/core';
import { ClinicGatewayService } from './clinic-gateway.service';

export interface PatientAccessEmailData { patientId: string; operationId: string; creationOperationId?: string; }
export interface InvitationEmailData { userId: string; token: string; operationId: string; }
export interface EmailDelivery { destination: 'primary' | 'secondary'; sent: boolean; }
export class ClinicEmailDeliveryError extends Error {
  constructor(readonly deliveries: EmailDelivery[]) { super('No se pudo confirmar el envío a todos los destinatarios.'); }
}

@Injectable({ providedIn: 'root' })
export class EmailService {
  private gateway = inject(ClinicGatewayService);
  async sendPatientAccessEmail(data: PatientAccessEmailData): Promise<void> {
    await this.send({ kind: 'patient-access', patientId: data.patientId, operationId: data.operationId,
      ...(data.creationOperationId ? { creationOperationId: data.creationOperationId } : {}) });
  }
  async sendInvitationEmail(data: InvitationEmailData): Promise<void> {
    await this.send({ kind: 'invitation', userId: data.userId, token: data.token, operationId: data.operationId });
  }
  private async send(data: unknown): Promise<void> {
    const result = await this.gateway.call<{success: boolean; deliveries: EmailDelivery[]}>('sendClinicEmail', data);
    if (!result || !Array.isArray(result.deliveries) || !result.deliveries.length ||
        result.success !== true || result.deliveries.some(item => item.sent !== true)) {
      throw new ClinicEmailDeliveryError(result?.deliveries ?? []);
    }
  }
}
