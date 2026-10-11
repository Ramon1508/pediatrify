import { Injectable, inject } from '@angular/core';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { FirebaseService } from '../firebase/firebase.service';
import { normalizeEmail } from '../utils/normalize-email';

export interface StaffEmailChangeRequest {
  userId: string;
  email: string;
  expectedEmail: string;
  operationId: string;
  name?: string;
}
export interface StaffEmailChangeResult { updated: true; pendingInvitation: boolean }

@Injectable({ providedIn: 'root' })
export class StaffEmailChangeService {
  private firebase = inject(FirebaseService);

  async changeEmail(request: StaffEmailChangeRequest): Promise<StaffEmailChangeResult> {
    const change = httpsCallable<StaffEmailChangeRequest, StaffEmailChangeResult>(
      getFunctions(this.firebase.auth.app, 'us-central1'), 'updateStaffEmail', { timeout: 90_000 },
    );
    const result = await change({ userId: request.userId, email: normalizeEmail(request.email),
      expectedEmail: normalizeEmail(request.expectedEmail), operationId: request.operationId,
      ...(request.name === undefined ? {} : { name: request.name.trim() }) });
    if (result.data?.updated !== true || typeof result.data.pendingInvitation !== 'boolean') {
      throw new Error('Cambio de correo no confirmado por el servidor.');
    }
    return result.data;
  }
}
