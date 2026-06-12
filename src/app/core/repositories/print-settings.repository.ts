import { Injectable, inject } from '@angular/core';
import { Firestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import { FirebaseService } from '../firebase/firebase.service';
import { PrintSettings, getDefaultSettings } from '../models/print-settings';

@Injectable({
  providedIn: 'root',
})
export class PrintSettingsRepository {
  private firebase = inject(FirebaseService);

  private get db(): Firestore {
    return this.firebase.firestore;
  }

  private docRef(doctorUid: string) {
    return doc(this.db, 'users', doctorUid);
  }

  async getSettings(doctorUid: string): Promise<PrintSettings> {
    const snap = await getDoc(this.docRef(doctorUid));
    if (!snap.exists()) return getDefaultSettings();
    const data = snap.data();
    return (data['printSettings'] as PrintSettings) ?? getDefaultSettings();
  }

  async updateSettings(doctorUid: string, settings: PrintSettings): Promise<void> {
    await updateDoc(this.docRef(doctorUid), { printSettings: settings });
  }
}
