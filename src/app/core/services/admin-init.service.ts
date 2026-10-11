import { Injectable } from '@angular/core';

// Retained only for the retired housekeeping component. Bootstrapping uses an operator tool.
export type AdminInitResult = 'seed-exists' | 'email-exists' | 'email-normalized' | 'admin-exists' | 'created' | 'error';

@Injectable({ providedIn: 'root' })
export class AdminInitService {
  async ensureAdminExists(): Promise<AdminInitResult> {
    return 'error';
  }
}
