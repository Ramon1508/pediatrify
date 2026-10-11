import { Component, inject, signal, computed, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';
import { SecurityContext } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { PatientRepository } from '../../core/repositories/patient.repository';
import { ClinicalRecordRepository } from '../../core/repositories/clinical-record.repository';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { Patient } from '../../core/models/user';
import { ClinicalRecord } from '../../core/models/clinical-record';
import { calcAge } from '../../core/utils/calc-age';
import { formatLocalDate } from '../../core/utils/date-utils';
import { ClinicClockService } from '../../core/services/clinic-clock.service';
import { compareClinicalRecordsNewestFirst } from '../../core/utils/clinical-record-order';

@Component({
  selector: 'app-patient-history-view',
  templateUrl: './patient-history-view.html',
  styleUrl: './patient-history-view.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, MatProgressBarModule, MatButtonModule, MatTabsModule, MatIconModule],
})
export class PatientHistoryView implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private patientRepo = inject(PatientRepository);
  private clinicalRepo = inject(ClinicalRecordRepository);
  private auth = inject(AuthService);
  private alert = inject(AlertService);
  private sanitizer = inject(DomSanitizer);
  private readonly clock = inject(ClinicClockService);

  protected patient = signal<Patient | null>(null);
  protected loading = signal(true);
  protected error = signal(false);
  private readonly sortedRecords = signal<ClinicalRecord[]>([]);

  private isVisible(value?: string): boolean {
    if (!value) return true;
    return value >= this.clock.now().date;
  }

  /** P48: todos los documentos vigentes; editar no altera el orden de creación. */
  protected readonly recommendationRecords = computed(() =>
    this.sortedRecords().filter((r) => !!r.recommendations && this.isVisible(r.visibleUntil))
  );
  protected readonly prescriptionRecords = computed(() =>
    this.sortedRecords().filter((r) => !!r.prescription && this.isVisible(r.visibleUntilRx))
  );
  protected readonly recommendationRecord = computed<ClinicalRecord | null>(() =>
    this.recommendationRecords()[0] ?? null
  );

  protected readonly prescriptionRecord = computed<ClinicalRecord | null>(() =>
    this.prescriptionRecords()[0] ?? null
  );

  protected readonly hasRecommendations = computed(() => this.recommendationRecord() !== null);
  protected readonly hasPrescription = computed(() => this.prescriptionRecord() !== null);
  protected readonly hasConsultable = computed(() => this.hasRecommendations() || this.hasPrescription());

  protected readonly recommendationEntries = computed(() => this.recommendationRecords().map((record) => ({
    id: record.id, dateLabel: formatLocalDate(record.date),
    expiryLabel: record.visibleUntil ? formatLocalDate(record.visibleUntil) : '',
    content: record.recommendations ?? '',
  })));
  protected readonly prescriptionEntries = computed(() => this.prescriptionRecords().map((record) => ({
    id: record.id, dateLabel: formatLocalDate(record.date),
    expiryLabel: record.visibleUntilRx ? formatLocalDate(record.visibleUntilRx) : '',
    content: record.prescription ?? '',
  })));
  protected readonly patientAge = computed(() => calcAge(this.patient()?.birthDate));
  protected readonly patientParents = computed(() =>
    [this.patient()?.fatherName ?? '', this.patient()?.motherName ?? '']
      .filter((name) => name.trim()).join(' · ')
  );

  private initialized = false;

  async ngOnInit() {
    if (this.initialized) return;
    this.initialized = true;
    await this.load();
  }

  async load() {
    const patientId = this.route.snapshot.paramMap.get('patientId');
    this.loading.set(true);
    this.error.set(false);
    try {
      if (!patientId) {
        this.error.set(true);
        return;
      }

      const me = this.auth.currentPatient;
      if (!me) {
        this.router.navigate(['/paciente/pacientes']);
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
      this.sortedRecords.set([...records].sort(compareClinicalRecordsNewestFirst));
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  /** Imprime Recomendaciones o Receta (si existen) en carta vertical, márgenes 2.5cm, sin logos. */
  protected print(type: 'recommendations' | 'prescription', recordId?: string) {
    const records = type === 'recommendations' ? this.recommendationRecords() : this.prescriptionRecords();
    const r = recordId ? records.find((record) => record.id === recordId) : records[0];
    if (!r) return;
    const content = this.sanitizer.sanitize(SecurityContext.HTML,
      (type === 'recommendations' ? r.recommendations : r.prescription) ?? '');
    if (!content) return;
    const title = type === 'recommendations' ? 'Recomendaciones' : 'Receta';

    const w = window.open('', '_blank');
    if (!w) {
      this.alert.error({ message: 'Permite ventanas emergentes para imprimir', duration: 5000 });
      return;
    }
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
