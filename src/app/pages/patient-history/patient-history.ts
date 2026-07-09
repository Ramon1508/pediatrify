import { Component, inject, signal, computed, OnInit, OnDestroy, ChangeDetectionStrategy, afterNextRender, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
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
import { AppointmentRepository } from '../../core/repositories/appointment.repository';
import { AuditRepository } from '../../core/repositories/audit.repository';
import { Patient } from '../../core/models/user';
import { ClinicalRecord } from '../../core/models/clinical-record';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { AppointmentFormDialog } from '../appointments/dialogs/appointment-form-dialog/appointment-form-dialog';
import { EditPatientDialog } from '../patients/dialogs/edit-patient-dialog/edit-patient-dialog';
import { CompleteProfileDialog } from '../patients/dialogs/complete-profile-dialog/complete-profile-dialog';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog';
import { ClinicalEntryDialog } from './dialogs/clinical-entry-dialog/clinical-entry-dialog';
import { PatientHistoryCard } from './components/patient-history-card/patient-history-card';
import { GrowthCharts } from './components/growth-charts/growth-charts';

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
    DatePipe,
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
  private appointmentRepo = inject(AppointmentRepository);
  private clinicalRepo = inject(ClinicalRecordRepository);
  private auditRepo = inject(AuditRepository);
  private authService = inject(AuthService);
  private alert = inject(AlertService);
  private sanitizer = inject(DomSanitizer);

  protected patient = signal<(Patient & { ageDisplay: string }) | null>(null);
  protected records = signal<ClinicalRecord[]>([]);
  protected sortedRecords = computed(() =>
    [...this.records()].sort((a, b) => b.date.localeCompare(a.date))
  );
  protected selectedRecordId = signal<string>('');
  protected selectedRecord = computed(() =>
    this.records().find((r) => r.id === this.selectedRecordId()) ?? null
  );
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
    const patientId = this.route.snapshot.paramMap.get('patientId');
    if (!patientId) return;

    this.subs.push(
      this.clinicalRepo.watchByPatient(patientId).subscribe((items) => {
        const prevCount = this.records().length;
        const sorted = [...items].sort((a, b) => b.date.localeCompare(a.date));
        this.records.set(sorted);
        if (sorted.length > 0) {
          const current = this.selectedRecordId();
          if (items.length > prevCount && prevCount > 0) {
            this.selectedRecordId.set(sorted[0].id);
          } else if (!current || !sorted.find((r) => r.id === current)) {
            this.selectedRecordId.set(sorted[0].id);
          }
        }
      })
    );

    try {
      const p = await this.patientRepo.getPatient(patientId);
      if (p) {
        this.patient.set({ ...p, ageDisplay: calcAge(p.birthDate) });
      }
    } catch {
      this.alert.error({ message: 'Error al cargar datos del paciente', duration: 5000 });
    } finally {
      this.loading.set(false);
    }
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
  }

  protected getAgeAtRecord(record: ClinicalRecord): string {
    const p = this.patient();
    if (!p) return '';
    return calcAgeAtDate(p.birthDate, record.date);
  }

  protected sanitize(html: string | undefined): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html ?? '');
  }

  protected selectRecord(id: string) {
    this.selectedRecordId.set(id);
  }

  protected async openNewAppointment() {
    const allPatients = await this.patientRepo.getAllPatients();
    const patientId = this.route.snapshot.paramMap.get('patientId')!;
    const dialogRef = this.dialog.open(AppointmentFormDialog, {
      disableClose: true,
      panelClass: 'right-panel',
    });
    dialogRef.componentInstance.setPatients(allPatients);
    dialogRef.componentInstance.selectPatient(patientId);
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
      disableClose: true,
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

  protected openEditEntry(record: ClinicalRecord) {
    const p = this.patient();
    const age = p?.ageDisplay ?? '';

    const dialogRef = this.dialog.open(ClinicalEntryDialog, {
      width: '736px',
      disableClose: true,
      panelClass: 'right-panel',
    });
    dialogRef.componentInstance.setRecord(record);
    dialogRef.componentInstance.setAge(age);
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.alert.success({ message: 'Entrada actualizada', duration: 3000 });
      }
    });
  }

  protected viewProfile(patient: Patient) {
    const dialogRef = this.dialog.open(EditPatientDialog, {
      width: '736px',
      disableClose: true,
      panelClass: 'right-panel',
    });
    dialogRef.componentInstance.setPatient(patient);
    dialogRef.componentInstance.setMode('view');
  }

  protected editProfile(patient: Patient) {
    const dialogRef = this.dialog.open(EditPatientDialog, {
      width: '736px',
      disableClose: true,
      panelClass: 'right-panel',
    });
    dialogRef.componentInstance.setPatient(patient);
    dialogRef.componentInstance.setMode('edit');
  }

  protected async openCompleteProfile(patient: Patient) {
    const dialogRef = this.dialog.open(CompleteProfileDialog, {
      width: '736px',
      disableClose: true,
      panelClass: 'right-panel',
    });
    dialogRef.componentInstance.setPatient(patient);
    await firstValueFrom(dialogRef.afterClosed());
  }

  protected async deletePatient(patient: Patient) {
    const dialogRef = this.dialog.open(ConfirmDialog, {
      data: {
        title: 'Eliminar paciente',
        message: `¿Eliminar a ${patient.name} ${patient.lastName}?`,
        confirmLabel: 'Eliminar',
        cancelLabel: 'Cancelar',
        confirmButtonClass: 'btn-danger dialog-btn',
      } as ConfirmDialogData,
    });

    const confirmed = await firstValueFrom(dialogRef.afterClosed());
    if (!confirmed) return;

    try {
      await this.patientRepo.deletePatient(patient.id);
      this.alert.success({ message: 'Paciente eliminado', duration: 3000 });
    } catch {
      this.alert.error({ message: 'Error al eliminar paciente', duration: 5000 });
    }
  }
}
