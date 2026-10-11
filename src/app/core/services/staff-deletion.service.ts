import { Injectable, inject } from '@angular/core';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { FirebaseService } from '../firebase/firebase.service';

@Injectable({ providedIn: 'root' })
export class StaffDeletionService {
  private firebase = inject(FirebaseService);

  async deleteStaff(userId: string): Promise<void> {
    const functions = getFunctions(this.firebase.auth.app, 'us-central1');
    const remove = httpsCallable<{ userId: string }, { deleted: true }>(
      functions, 'deleteStaff', { timeout: 540_000 },
    );
    const result = await remove({ userId });
    if (result.data?.deleted !== true) throw new Error('Baja no confirmada por el servidor.');
  }
}
