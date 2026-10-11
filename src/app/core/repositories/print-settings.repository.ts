import { Injectable, inject } from '@angular/core';
import { UserRepository } from './user.repository';
import { PrintSettings, getDefaultSettings } from '../models/print-settings';

@Injectable({
  providedIn: 'root',
})
export class PrintSettingsRepository {
  private users = inject(UserRepository);

  async getSettings(doctorUid: string): Promise<PrintSettings> {
    const profile = await this.users.getUser(doctorUid);
    return { ...getDefaultSettings(), ...profile?.printSettings };
  }

  async updateSettings(doctorUid: string, settings: PrintSettings): Promise<void> {
    const { logoUrl: _legacyLogoUrl, ...cleanSettings } = settings as PrintSettings & {
      logoUrl?: string;
    };
    await this.users.updateUser(doctorUid, { printSettings: cleanSettings });
  }
}
