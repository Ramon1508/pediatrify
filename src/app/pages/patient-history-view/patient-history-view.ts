import { Component, inject, signal, computed, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
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
  imports: [CommonModule, RouterLink, MatProgressBarModule, MatTabsModule, MatIconModule],
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

  /** Imprime Recomendaciones o Receta (si existen) en carta vertical, márgenes 2.5cm, sin logos. */
  protected print(type: 'recommendations' | 'prescription') {
    const r = this.record();
    if (!r) return;
    const content = type === 'recommendations' ? r.recommendations : r.prescription;
    if (!content) return;
    const title = type === 'recommendations' ? 'Recomendaciones' : 'Receta';

    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
@page {
  size: 21.59cm 27.94cm;
  margin: 0;
}
html, body { margin: 0; padding: 0; font-family: Roboto, Arial, sans-serif; color: #000; }
.page { padding: 2.5cm; }
.rich-content { color: #000; font-size: 11pt; font-weight: 400; line-height: 1.45; overflow-wrap: anywhere; }
.rich-content p, .rich-content ul, .rich-content ol, .rich-content blockquote, .rich-content pre, .rich-content h1, .rich-content h2, .rich-content h3 { margin-top: 0; margin-bottom: 0.18cm; }
.rich-content ul, .rich-content ol { padding-left: 1.2em; }
.rich-content ul { list-style: disc; }
.rich-content ol { list-style: decimal; }
.rich-content li { list-style: inherit; }
.rich-content li[data-list="bullet"] { list-style-type: disc; }
.rich-content li[data-list="ordered"] { list-style-type: decimal; }
.rich-content li::before { display: none !important; }
.rich-content .ql-ui { display: none; }
.rich-content img, .rich-content table { max-width: 100%; }
.rich-content img { display: block; height: auto; }
.rich-content table { border-collapse: collapse; }
.rich-content a { color: #000; text-decoration: underline; }
</style>
</head>
<body>
<div class="page">
<div class="rich-content">${content}</div>
</div>
</body>
</html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }
}
