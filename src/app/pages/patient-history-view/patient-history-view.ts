import { Component, inject, signal, computed, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { PatientRepository } from '../../core/repositories/patient.repository';
import { ClinicalRecordRepository } from '../../core/repositories/clinical-record.repository';
import { AuthService } from '../../core/services/auth.service';
import { Patient } from '../../core/models/user';
import { ClinicalRecord } from '../../core/models/clinical-record';
import { calcAge } from '../../core/utils/calc-age';

@Component({
  selector: 'app-patient-history-view',
  templateUrl: './patient-history-view.html',
  styleUrl: './patient-history-view.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, MatProgressBarModule],
})
export class PatientHistoryView implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private patientRepo = inject(PatientRepository);
  private clinicalRepo = inject(ClinicalRecordRepository);
  private auth = inject(AuthService);
  private sanitizer = inject(DomSanitizer);

  protected patient = signal<Patient | null>(null);
  protected loading = signal(true);
  protected record = signal<ClinicalRecord | null>(null);

  private today(): string {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }

  private isVisible(value?: string): boolean {
    if (!value) return true;
    return value >= this.today();
  }

  protected get hasConsultable(): boolean {
    const r = this.record();
    if (!r) return false;
    return (!!r.recommendations && this.isVisible(r.visibleUntil)) ||
      (!!r.prescription && this.isVisible(r.visibleUntilRx));
  }

  protected get hasRecommendations(): boolean {
    const r = this.record();
    return !!r?.recommendations && this.isVisible(r.visibleUntil);
  }

  protected get hasPrescription(): boolean {
    const r = this.record();
    return !!r?.prescription && this.isVisible(r.visibleUntilRx);
  }

  protected recommendationsHtml = computed<SafeHtml | ''>(() => {
    const r = this.record();
    return r?.recommendations ? this.sanitizer.bypassSecurityTrustHtml(r.recommendations) : '';
  });

  protected prescriptionHtml = computed<SafeHtml | ''>(() => {
    const r = this.record();
    return r?.prescription ? this.sanitizer.bypassSecurityTrustHtml(r.prescription) : '';
  });

  protected age(p: Patient | null): string {
    return calcAge(p?.birthDate);
  }

  protected parentsDisplay(p: Patient | null): string {
    const father = p?.fatherName || '';
    const mother = p?.motherName || '';
    return [father, mother].filter((n) => n.trim()).join(' · ');
  }

  async ngOnInit() {
    const patientId = this.route.snapshot.paramMap.get('patientId');
    if (!patientId) return;

    const me = this.auth.currentPatient;
    if (!me) {
      this.router.navigate(['/paciente/pacientes']);
      this.loading.set(false);
      return;
    }

    const loginEmail = this.auth.currentPatientLoginEmail ?? me.email;
    const children = await this.patientRepo.getChildrenGroup(loginEmail, me.doctorId ?? '');
    const belongs = children.some((c) => c.id === patientId);
    if (!belongs) {
      this.router.navigate(['/paciente/pacientes']);
      return;
    }

    const p = await this.patientRepo.getPatient(patientId);
    this.patient.set(p);

    const records = await this.clinicalRepo.getByPatient(patientId);
    const sorted = [...records].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const consultable = sorted.find(
      (r) =>
        (r.recommendations && this.isVisible(r.visibleUntil)) ||
        (r.prescription && this.isVisible(r.visibleUntilRx))
    );
    this.record.set(consultable ?? null);
    this.loading.set(false);
  }
}
