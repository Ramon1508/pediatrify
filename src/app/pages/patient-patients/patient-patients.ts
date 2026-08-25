import { Component, inject, signal, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonModule } from '@angular/material/button';
import { PatientRepository } from '../../core/repositories/patient.repository';
import { AuthService } from '../../core/services/auth.service';
import { Patient } from '../../core/models/user';
import { calcAge } from '../../core/utils/calc-age';

@Component({
  selector: 'app-patient-patients',
  templateUrl: './patient-patients.html',
  styleUrl: './patient-patients.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatProgressBarModule, MatButtonModule],
})
export class PatientPatients implements OnInit {
  private patientRepo = inject(PatientRepository);
  private auth = inject(AuthService);
  private router = inject(Router);

  protected children = signal<Patient[]>([]);
  protected loading = signal(true);

  async ngOnInit() {
    // eslint-disable-next-line no-console
    console.log('[patient-patients ngOnInit]', {
      sessionType: this.auth.isPatient ? 'patient' : 'doctor',
      hasPatient: !!this.auth.currentPatient,
      patientId: this.auth.currentPatient?.id,
      patientDoctorId: this.auth.currentPatient?.doctorId,
      loginEmail: this.auth.currentPatientLoginEmail,
    });
    try {
      const me = this.auth.currentPatient;
      if (!me) {
        this.children.set([]);
        return;
      }
      const loginEmail = this.auth.currentPatientLoginEmail ?? me.email;
      console.log('[patient-patients]', { loginEmail, patientId: me.id, doctorId: me.doctorId, otp: me.otpPassword });
      const group = await this.patientRepo.getChildrenGroup(loginEmail, me.doctorId ?? '');
      console.log('[patient-patients group]', group.map((g) => `${g.name} ${g.lastName} [${g.id}]`));
      this.children.set(group);
    } catch {
      this.children.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  openHistory(p: Patient) {
    this.router.navigate(['/paciente/pacientes/history', p.id]);
  }

  age(p: Patient): string {
    return calcAge(p.birthDate);
  }
}
