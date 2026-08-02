import { Injectable } from '@angular/core';

const FUNCTIONS_BASE = 'https://us-central1-lilcare-afdf5.cloudfunctions.net';

export interface PatientAccessEmailData {
  email: string;
  otpPassword: string;
  patientName: string;
  doctorName: string;
}

@Injectable({
  providedIn: 'root',
})
export class EmailService {
  async sendPatientAccessEmail(data: PatientAccessEmailData): Promise<void> {
    const response = await fetch(`${FUNCTIONS_BASE}/sendPatientAccessEmail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    });
    const result = await response.json();
    if (result.error) throw new Error(result.error.message);
  }
}
