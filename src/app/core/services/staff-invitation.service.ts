import { Injectable, inject } from '@angular/core';
import { validStaffId } from '../utils/staff-id';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { FirebaseService } from '../firebase/firebase.service';
import { normalizeEmail } from '../utils/normalize-email';

export interface InvitationProfile {
  sexo: number; phone: string; especialidad: string; cedula: string;
  cedulaEspecialidad: string; consultorios: string;
}
export interface InvitationSummary {
  userId: string; name: string; email: string; role: 'admin' | 'doctor' | 'assistant'; expiresAt: number;
}
export interface IssuedInvitation extends InvitationSummary { token: string; doctorName: string; link: string }
export type InvitationIssueRequest = { action: 'create'; name: string; email: string; operationId: string; role?: 'admin' | 'doctor' | 'assistant' } |
  { action: 'resend'; userId: string; operationId: string };

/** Capabilities remain in memory and the URL fragment; never cache or log credentials. */
@Injectable({ providedIn: 'root' })
export class StaffInvitationService {
  private firebase = inject(FirebaseService);

  async issue(request: InvitationIssueRequest): Promise<IssuedInvitation> {
    const payload = request.action === 'create' ? { action: request.action, name: request.name.trim(),
      email: normalizeEmail(request.email), operationId: request.operationId,
      ...(request.role ? { role: request.role } : {}) } :
      { action: request.action, userId: request.userId, operationId: request.operationId };
    const result = await this.call<IssuedInvitation>('manageStaffInvitation', payload);
    this.validateSummary(result);
    this.validateToken(result.token);
    if (typeof result.doctorName !== 'string') throw new Error('Invitación no confirmada por el servidor.');
    return { ...result, link: window.location.origin + '/setup-profile#invitation=' + result.token };
  }

  async inspect(token: string): Promise<InvitationSummary> {
    this.validateToken(token);
    const result = await this.call<InvitationSummary>('inspectStaffInvitation', { token });
    this.validateSummary(result);
    return result;
  }

  async complete(token: string, password: string, profile: InvitationProfile, operationId: string): Promise<void> {
    this.validateToken(token);
    const result = await this.call<{ registered: boolean }>('redeemStaffInvitation', { token, password, operationId,
      profile: { sexo: profile.sexo, phone: profile.phone, especialidad: profile.especialidad, cedula: profile.cedula,
        cedulaEspecialidad: profile.cedulaEspecialidad, consultorios: profile.consultorios } });
    if (result?.registered !== true) throw new Error('Registro no confirmado por el servidor.');
  }

  private async call<T>(name: string, data: unknown): Promise<T> {
    const callable = httpsCallable<unknown, T>(getFunctions(this.firebase.auth.app, 'us-central1'), name, { timeout: 90_000 });
    return (await callable(data)).data;
  }
  private validateToken(token: unknown): asserts token is string {
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error('Solicita una nueva invitación.');
  }
  private validateSummary(result: InvitationSummary) {
    if (!result || !['admin', 'doctor', 'assistant'].includes(result.role) || typeof result.userId !== 'string' ||
      !validStaffId(result.userId) || typeof result.email !== 'string' ||
      typeof result.name !== 'string' || !Number.isFinite(result.expiresAt)) {
      throw new Error('Invitación no confirmada por el servidor.');
    }
  }
}
