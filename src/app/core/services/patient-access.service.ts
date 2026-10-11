import { Injectable, inject } from '@angular/core';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { FirebaseService } from '../firebase/firebase.service';

export interface PatientAccess {
  password: string;
  credentialVersion: number;
  credentialEpoch: string;
}

export interface PatientAccessRenewal {
  patientId: string;
  operationId: string;
  expectedVersion: number;
  expectedEpoch: string;
}

/** Adapter prepared for the coordinated P01 rollout; no client authority or direct Firestore fallback. */
@Injectable({ providedIn: 'root' })
export class PatientAccessService {
  private readonly firebase = inject(FirebaseService);

  async read(patientId: string): Promise<PatientAccess> {
    const callable = httpsCallable<{ patientId: string }, PatientAccess>(
      getFunctions(this.firebase.auth.app, 'us-central1'), 'getClinicPatientAccess',
    );
    return this.validate((await callable({ patientId })).data);
  }

  async renew(request: PatientAccessRenewal): Promise<PatientAccess> {
    const callable = httpsCallable<PatientAccessRenewal, PatientAccess>(
      getFunctions(this.firebase.auth.app, 'us-central1'), 'renewClinicPatientAccess', { timeout: 90_000 },
    );
    return this.validate((await callable({
      patientId: request.patientId,
      operationId: request.operationId,
      expectedVersion: request.expectedVersion,
      expectedEpoch: request.expectedEpoch,
    })).data);
  }

  private validate(value: PatientAccess): PatientAccess {
    if (!value || typeof value.password !== 'string' || value.password.length < 4 || value.password.length > 256 ||
        !Number.isSafeInteger(value.credentialVersion) || value.credentialVersion < 1 ||
        typeof value.credentialEpoch !== 'string' || !/^[a-f0-9]{32}$/.test(value.credentialEpoch)) {
      throw new Error('No se pudo confirmar el acceso del paciente.');
    }
    return { password: value.password, credentialVersion: value.credentialVersion, credentialEpoch: value.credentialEpoch };
  }
}
