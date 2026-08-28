import { Component, inject, signal, computed, OnInit, OnDestroy, ChangeDetectionStrategy, afterNextRender, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription, firstValueFrom } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatRadioModule } from '@angular/material/radio';
import { PatientRepository } from '../../core/repositories/patient.repository';
import { ClinicalRecordRepository } from '../../core/repositories/clinical-record.repository';
import { Patient } from '../../core/models/user';
import { ClinicalRecord } from '../../core/models/clinical-record';
import { Sexo } from '../../core/models/sexo';
import { getDefaultSettings, getPaperDimensions } from '../../core/models/print-settings';
import { PrintSettingsRepository } from '../../core/repositories/print-settings.repository';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { PatientStore } from '../../core/store/patient.store';
import { CascadeService } from '../../core/services/cascade.service';
import { UserRepository } from '../../core/repositories/user.repository';
import { AppointmentDialog } from '../calendar/dialogs/appointment-dialog/appointment-dialog';
import { EditPatientDialog } from '../patients/dialogs/edit-patient-dialog/edit-patient-dialog';
import { CompleteProfileDialog } from '../patients/dialogs/complete-profile-dialog/complete-profile-dialog';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog';
import { ClinicalEntryDialog } from './dialogs/clinical-entry-dialog/clinical-entry-dialog';
import { PatientHistoryCard } from './components/patient-history-card/patient-history-card';
import { GrowthCharts } from './components/growth-charts/growth-charts';
import { FirebaseService } from '../../core/firebase/firebase.service';
import { resolveLogoUrl } from '../../core/utils/logo-utils';
import { buildAvailabilityFromUser } from '../../core/utils/availability';
import { formatLocalDate } from '../../core/utils/date-utils';

function calcAge(birthDate: unknown): string {
  let d: Date | null = null;
  if (typeof birthDate === 'string') {
    const parts = birthDate.split('-');
    if (parts.length === 3) d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
  } else if (birthDate && typeof (birthDate as any).toDate === 'function') {
    d = (birthDate as any).toDate();
  }
  if (!d || isNaN(d.getTime())) return '';
  return formatAge(d, new Date());
}

function calcAgeAtDate(birthDate: unknown, targetDate: string): string {
  let d: Date | null = null;
  if (typeof birthDate === 'string') {
    const parts = birthDate.split('-');
    if (parts.length === 3) d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
  } else if (birthDate && typeof (birthDate as any).toDate === 'function') {
    d = (birthDate as any).toDate();
  }
  if (!d || isNaN(d.getTime())) return '';
  const parts = targetDate.split('-');
  if (parts.length !== 3) return '';
  const target = new Date(+parts[0], +parts[1] - 1, +parts[2]);
  if (isNaN(target.getTime())) return '';
  return formatAge(d, target);
}

function formatAge(birth: Date, target: Date): string {
  let months = (target.getFullYear() - birth.getFullYear()) * 12;
  months += target.getMonth() - birth.getMonth();
  if (target.getDate() < birth.getDate()) months--;
  if (months < 0) return '0 meses';
  if (months < 24) return `${months} meses`;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return remainingMonths > 0
    ? `${years} años ${remainingMonths} meses`
    : `${years} años`;
}

@Component({
  selector: 'app-patient-history',
  templateUrl: './patient-history.html',
  styleUrl: './patient-history.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTabsModule,
    MatRadioModule,
    PatientHistoryCard,
    GrowthCharts,
  ],
})
export class PatientHistory implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private dialog = inject(MatDialog);
  private patientRepo = inject(PatientRepository);
  private clinicalRepo = inject(ClinicalRecordRepository);
  private authService = inject(AuthService);
  private alert = inject(AlertService);
  private sanitizer = inject(DomSanitizer);
  private patientStore = inject(PatientStore);
  private printRepo = inject(PrintSettingsRepository);
  private cascade = inject(CascadeService);
  private userRepo = inject(UserRepository);
  private firebase = inject(FirebaseService);

  private patientId = '';
  protected patient = computed<(Patient & { ageDisplay: string }) | null>(() => {
    const p = this.patientStore.watchOne(this.patientId)();
    return p ? { ...p, ageDisplay: calcAge(p.birthDate) } : null;
  });
  protected records = signal<ClinicalRecord[]>([]);
  protected sortedRecords = computed(() =>
    [...this.records()].sort((a, b) => b.date.localeCompare(a.date))
  );
  protected selectedRecordId = signal<string>('');
  protected selectedRecord = computed(() =>
    this.records().find((r) => r.id === this.selectedRecordId()) ?? null
  );
  protected selectedRecordAge = computed(() => {
    const record = this.selectedRecord();
    const p = this.patient();
    if (!record || !p) return '';
    return calcAgeAtDate(p.birthDate, record.date);
  });
  protected loading = signal(true);
  protected isAdmin = signal(false);

  @ViewChild('quickValues', { read: ElementRef })
  private quickValuesRef?: ElementRef<HTMLElement>;

  @ViewChild('historyContainer', { read: ElementRef })
  private historyContainerRef?: ElementRef<HTMLElement>;

  protected rowEndIndices = signal<Set<number>>(new Set());

  private subs: Subscription[] = [];
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    afterNextRender(() => {
      this.resizeObserver = new ResizeObserver(() => this.computeRowEnds());
      if (this.historyContainerRef?.nativeElement) {
        this.resizeObserver.observe(this.historyContainerRef.nativeElement);
      }
    });
  }

  async ngOnInit() {
    this.isAdmin.set(this.authService.currentDoctor?.role === 'admin');
    this.patientId = this.route.snapshot.paramMap.get('patientId') ?? '';
    if (!this.patientId) return;

    this.subs.push(
      this.clinicalRepo.watchByPatient(this.patientId).subscribe({
        next: (items) => {
          const prevCount = this.records().length;
          const sorted = [...items].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
          this.records.set(sorted);
          if (sorted.length > 0) {
            const current = this.selectedRecordId();
            if (items.length > prevCount && prevCount > 0) {
              this.selectedRecordId.set(sorted[0].id);
            } else if (!current || !sorted.find((r) => r.id === current)) {
              this.selectedRecordId.set(sorted[0].id);
            }
          }
        },
        error: (e) => console.error('watchByPatient error:', e),
      })
    );

    this.loading.set(false);
  }

  private computeRowEnds() {
    const el = this.quickValuesRef?.nativeElement;
    if (!el) return;

    const items = el.querySelectorAll('.qv-item') as NodeListOf<HTMLElement>;
    if (items.length === 0) return;

    const indices = new Set<number>();

    for (let i = 0; i < items.length - 1; i++) {
      if (items[i].offsetTop !== items[i + 1].offsetTop) {
        indices.add(i);
      }
    }

    indices.add(items.length - 1);

    const current = this.rowEndIndices();
    if (indices.size === current.size && [...indices].every(i => current.has(i))) {
      return;
    }

    this.rowEndIndices.set(indices);
  }

  ngOnDestroy() {
    for (const s of this.subs) s.unsubscribe();
    this.resizeObserver?.disconnect();
    if (this.patientId) this.patientStore.unwatchOne(this.patientId);
  }

  protected async printSection(type: 'recommendations' | 'prescription') {
    const record = this.selectedRecord();
    const p = this.patient();
    if (!record || !p) return;

    const content = type === 'recommendations' ? record.recommendations : record.prescription;
    if (!content) return;

    const sectionLabel = type === 'recommendations' ? 'RECOMENDACIONES' : 'RECETA';
    const sectionTitle = type === 'recommendations' ? 'Recomendaciones' : 'Receta';

    const doctor = this.authService.currentDoctor;
    if (!doctor) return;

    const settings = await this.printRepo.getSettings(doctor.uid);
    const dim = getPaperDimensions(settings.paperSize, settings.customWidth, settings.customHeight, settings.orientation);
    const logoSource = settings.usePreloadedLogo
      ? '/images/Logo.jpg'
      : (doctor.logoPath || '/images/Logo.jpg');
    const logoUrl = await resolveLogoUrl(this.firebase.storage, logoSource);
    const prefix = doctor.sexo === Sexo.Femenino ? 'DRA.' : 'DR.';

    const patientAge = calcAge(p.birthDate);

    const dateStr = formatLocalDate(record.date);

    const marginTop = settings.marginTop;
    const marginRight = settings.marginRight;
    const marginBottom = settings.marginBottom;
    const marginLeft = settings.marginLeft;

    const w = window.open('', '_blank');
    if (!w) return;

    w.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${sectionTitle} — ${p.name} ${p.lastName}</title>
  <style>
    @page {
      size: ${dim.width}cm ${dim.height}cm;
      margin: 0;
    }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { margin: 0; padding: 0; font-family: Roboto, sans-serif; color: #000; }
    .page {
      position: relative;
      width: 100%;
      height: 100vh;
      padding: ${marginTop}cm ${marginRight}cm ${marginBottom}cm ${marginLeft}cm;
    }
    .top-section { position: relative; min-height: 1.1cm; }
    .logo {
      position: absolute; top: 0; left: ${settings.logoPosition === 'top-right' ? 'auto' : '0'};
      right: ${settings.logoPosition === 'top-right' ? '0' : 'auto'}; z-index: 1;
      width: ${settings.logoWidth}cm;
    }
    .logo img { display: block; width: 100%; max-width: 100%; max-height: 2.5cm; height: auto; object-fit: contain; }
    .doctor-info { color: #333; text-align: center; font-size: ${12}pt; line-height: 1.25; }
    .doctor-info .doctor-name { margin-bottom: 0.1cm; font-size: ${16}pt; font-weight: 500; letter-spacing: 0.15px; }
    .doctor-info .field { margin-bottom: 0.04cm; font-weight: 500; letter-spacing: 0.5px; }
    .doctor-info .field-row { display: flex; justify-content: center; gap: 0.5cm; flex-wrap: wrap; }
    .gap-large { height: 0.65cm; }
    .gap-medium { height: 0.28cm; }
    .body-text { clear: both; color: #444; font-size: ${12}pt; font-weight: 500; line-height: 1.3; letter-spacing: 0.15px; }
    .patient-row { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 0.16cm 0.45cm; text-align: left; }
    .patient-row span { min-width: 0; overflow-wrap: anywhere; }
    .divider { clear: both; margin: 0.24cm 0 0; border-top: 1px solid #000; }
    .body-content { padding-top: 0.28cm; }
    .section-label { margin: 0 0 0.16cm; color: #000; font-size: ${12}pt; font-weight: 700; line-height: 1.25; letter-spacing: 0; text-transform: uppercase; }
    .rich-content { margin: 0; padding: 0; color: #000; font-size: ${11}pt; font-weight: 400; line-height: 1.45; overflow-wrap: anywhere; }
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
    .rich-content img { display: block; height: auto; max-height: calc(100vh - ${marginTop + marginBottom + 4}cm); object-fit: contain; }
    .rich-content table { border-collapse: collapse; }
    .rich-content a { color: #000; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="page">
    <div class="top-section">
      <div class="logo">
        <img src="${logoUrl}" alt="Logo" />
      </div>
      <div class="doctor-info">
        ${settings.showDoctorName ? `<div class="doctor-name">${prefix} ${doctor.name?.toUpperCase() ?? ''}</div>` : ''}
        ${settings.showSpecialty ? `<div class="field">${doctor.especialidad || 'Pediatría'}</div>` : ''}
        ${(settings.showProfessionalId || settings.showSpecialtyId) ? `<div class="field-row">${settings.showProfessionalId ? `<div class="field">CED. PROF. ${doctor.cedula || ''}</div>` : ''}${settings.showSpecialtyId ? `<div class="field">CED. ESP. ${doctor.cedulaEspecialidad || ''}</div>` : ''}</div>` : ''}
        ${settings.showDoctorPhone ? `<div class="field">TEL. ${doctor.phone || ''}</div>` : ''}
        ${settings.showDoctorOffice ? `<div class="field">CONSULTORIO: ${doctor.consultorios || ''}</div>` : ''}
      </div>
    </div>
    <div class="gap-large"></div>
    <div class="body-text">
      <div class="patient-row">
        ${settings.showPatientName ? `<span>NOMBRE DEL PACIENTE: ${p.name} ${p.lastName}</span>` : ''}
        ${settings.showConsultDate ? `<span>FECHA: ${dateStr}</span>` : ''}
      </div>
      <div class="gap-medium"></div>
      <div class="patient-row">
        ${settings.showPatientAge ? `<span>EDAD: ${patientAge}</span>` : ''}
        ${settings.showPatientWeight && record.weight ? `<span>PESO: ${record.weight} kg.</span>` : ''}
        ${settings.showPatientHeight && record.height ? `<span>TALLA: ${record.height} cm.</span>` : ''}
        ${settings.showPatientHeadCircumference && record.headCircumference ? `<span>PC: ${record.headCircumference} cm.</span>` : ''}
        ${settings.showPatientTemperature && record.temperature ? `<span>TEMP: ${record.temperature} &deg;C</span>` : ''}
      </div>
    </div>
    <div class="divider"></div>
    <div class="body-content">
      <div class="section-label">${sectionLabel}</div>
      <div class="rich-content">${content}</div>
    </div>
  </div>
</body>
</html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }

  protected sanitize(html: string | undefined): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html ?? '');
  }

  protected formatCivilDate(value: unknown): string {
    return formatLocalDate(value);
  }

  protected selectRecord(id: string) {
    this.selectedRecordId.set(id);
  }

  protected async openNewAppointment() {
    const allPatients = await this.patientRepo.getAllPatients();
    const patientId = this.route.snapshot.paramMap.get('patientId')!;
    const doctor = this.authService.currentDoctor;
    if (!doctor) return;

    const doctorUser = (await this.userRepo.getUser(doctor.uid)) as any;
    const availability = buildAvailabilityFromUser(doctorUser);
    const consultationDuration = doctorUser?.consultationDuration ?? 30;

    const dialogRef = this.dialog.open(AppointmentDialog, {
      width: '400px',
      disableClose: false,
      panelClass: 'right-panel',
    });
    dialogRef.componentInstance.setData({
      allPatients,
      selectedDoctorId: doctor.uid,
      editingAppointment: null,
      timeSegmentsByDay: availability.timeSegmentsByDay,
      consultationDuration,
      existingAppointments: [],
      doctorName: doctor.name,
      doctorEmail: doctor.email,
    });
    dialogRef.componentInstance.lockPatient(patientId);
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.alert.success({ message: 'Cita agendada', duration: 3000 });
      }
    });
  }

  protected openAddEntry() {
    const patientId = this.route.snapshot.paramMap.get('patientId');
    if (!patientId) return;
    const p = this.patient();
    const age = p?.ageDisplay ?? '';

    const dialogRef = this.dialog.open(ClinicalEntryDialog, {
      width: '736px',
      disableClose: false,
      panelClass: 'right-panel',
    });
    dialogRef.componentInstance.setPatientId(patientId);
    dialogRef.componentInstance.setAge(age);
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.alert.success({ message: 'Entrada agregada', duration: 3000 });
      }
    });
  }

  protected openEditEntry(record: ClinicalRecord, context?: 'general' | 'recommendations' | 'prescription') {
    const p = this.patient();
    const age = p?.ageDisplay ?? '';

    const dialogRef = this.dialog.open(ClinicalEntryDialog, {
      width: context && context !== 'general' ? '600px' : '736px',
      disableClose: false,
      panelClass: 'right-panel',
    });
    dialogRef.componentInstance.setRecord(record);
    dialogRef.componentInstance.setAge(age);
    if (context) dialogRef.componentInstance.setEditContext(context);
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.alert.success({ message: 'Entrada actualizada', duration: 3000 });
      }
    });
  }

  protected viewProfile(patient: Patient) {
    const dialogRef = this.dialog.open(EditPatientDialog, {
      width: '736px',
      disableClose: false,
      panelClass: 'right-panel',
    });
    dialogRef.componentInstance.setPatient(patient);
    dialogRef.componentInstance.setMode('view');
  }

  protected editProfile(patient: Patient) {
    const dialogRef = this.dialog.open(EditPatientDialog, {
      width: '736px',
      disableClose: false,
      panelClass: 'right-panel',
    });
    dialogRef.componentInstance.setPatient(patient);
    dialogRef.componentInstance.setMode('edit');
  }

  protected async openCompleteProfile(patient: Patient) {
    const dialogRef = this.dialog.open(CompleteProfileDialog, {
      width: '736px',
      disableClose: false,
      panelClass: 'right-panel',
    });
    dialogRef.componentInstance.setPatient(patient);
    await firstValueFrom(dialogRef.afterClosed());
  }

  protected async deletePatient(patient: Patient) {
    const dialogRef = this.dialog.open(ConfirmDialog, {
      panelClass: 'context-card-panel',
      width: '552px',
      maxWidth: '552px',
      data: {
        title: 'Eliminar paciente',
        message: 'Al eliminar un paciente, su historial también será eliminado, además, los padres o tutores asociados a él, perderán acceso a la plataforma a menos que otro paciente esté asociado a ellos.',
        confirmLabel: 'Eliminar paciente',
        cancelLabel: 'Cerrar',
        confirmButtonClass: 'btn-danger dialog-btn',
      } as ConfirmDialogData,
    });

    const confirmed = await firstValueFrom(dialogRef.afterClosed());
    if (!confirmed) return;

    try {
      await this.cascade.deletePatientCascade(patient.id);
      this.alert.success({ message: 'Paciente eliminado', duration: 3000 });
    } catch {
      this.alert.error({ message: 'Error al eliminar paciente', duration: 5000 });
    }
  }
}
