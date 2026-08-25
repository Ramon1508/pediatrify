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
    try {
      const me = this.auth.currentPatient;
      if (!me) {
        this.children.set([]);
        return;
      }
      const loginEmail = this.auth.currentPatientLoginEmail ?? me.email;
      const group = await this.patientRepo.getChildrenGroup(loginEmail, me.doctorId ?? '');
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
