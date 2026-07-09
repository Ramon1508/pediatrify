import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  ApplicationRef,
  ViewChild,
  ElementRef,
  ViewEncapsulation,
} from '@angular/core';
import { DatePipe, NgTemplateOutlet, UpperCasePipe } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { ClinicalRecordRepository } from '../../core/repositories/clinical-record.repository';
import { PatientRepository } from '../../core/repositories/patient.repository';
import { PrintSettingsRepository } from '../../core/repositories/print-settings.repository';
import { UserRepository } from '../../core/repositories/user.repository';
import { AuthService } from '../../core/services/auth.service';
import { ClinicalRecord } from '../../core/models/clinical-record';
import { Patient, AppUser } from '../../core/models/user';
import { PrintSettings, getDefaultSettings, PAPER_SIZES, getPaperDimensions } from '../../core/models/print-settings';
import { Sexo } from '../../core/models/sexo';
import { DEFAULT_LOGO_URL } from '../../core/config/brand';
import { normalizeEmail } from '../../core/utils/normalize-email';

const PX_PER_CM = 96 / 2.54;

interface PrintPage {
  html: SafeHtml;
}

function calcAge(birthDate: unknown): string {
  let d: Date | null = null;
  if (typeof birthDate === 'string') {
    const parts = birthDate.split('-');
    if (parts.length === 3) d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
  } else if (birthDate && typeof (birthDate as any).toDate === 'function') {
    d = (birthDate as any).toDate();
  }
  if (!d || isNaN(d.getTime())) return '';
  const now = new Date();
  let months = (now.getFullYear() - d.getFullYear()) * 12;
  months += now.getMonth() - d.getMonth();
  if (now.getDate() < d.getDate()) months--;
  if (months < 0) return '0 meses';
  if (months < 24) return `${months} meses`;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return remainingMonths > 0
    ? `${years} años ${remainingMonths} meses`
    : `${years} años`;
}

@Component({
  selector: 'app-print-preview',
  templateUrl: './print-preview.html',
  styleUrl: './print-preview.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [DatePipe, NgTemplateOutlet, UpperCasePipe],
})
export class PrintPreview implements OnInit {
  @ViewChild('measurePage') private measurePage?: ElementRef<HTMLElement>;
  @ViewChild('measureScratch') private measureScratch?: ElementRef<HTMLElement>;

  private route = inject(ActivatedRoute);
  private clinicalRepo = inject(ClinicalRecordRepository);
  private patientRepo = inject(PatientRepository);
  private printRepo = inject(PrintSettingsRepository);
  private userRepo = inject(UserRepository);
  private auth = inject(AuthService);
  private sanitizer = inject(DomSanitizer);
  private defaultLogo = inject(DEFAULT_LOGO_URL);
  private cdr = inject(ChangeDetectorRef);
  private appRef = inject(ApplicationRef);

  protected readonly Sexo = Sexo;
  protected readonly paperSizes = PAPER_SIZES;
  protected loading = signal(true);
  protected debugInfo = signal('');

  protected record: ClinicalRecord | null = null;
  protected patient: Patient | null = null;
  protected doctor: AppUser | null = null;
  protected settings = signal<PrintSettings>(getDefaultSettings());
  protected patientAge = '';

  protected sanitizedRecommendations: SafeHtml = '';
  protected sanitizedPrescription: SafeHtml = '';
  protected pages = signal<PrintPage[]>([]);

  protected paperSizeLabel(value: string): string {
    const found = PAPER_SIZES.find((s) => s.value === value);
    return found ? found.label : value === 'custom' ? 'Personalizado' : value;
  }

  protected logoUrl = computed(() => {
    const s = this.settings();
    if (s.usePreloadedLogo) {
      return this.doctor?.logoPath || this.defaultLogo;
    }
    return s.logoUrl || this.doctor?.logoPath || this.defaultLogo;
  });

  protected paperSizeCss = computed(() => {
    const s = this.settings();
    const size = getPaperDimensions(s.paperSize, s.customWidth, s.customHeight);
    return `${size.width}cm ${size.height}cm`;
  });

  protected marginCss = computed(() => {
    const s = this.settings();
    return `${s.marginTop}cm ${s.marginRight}cm ${s.marginBottom}cm ${s.marginLeft}cm`;
  });

  protected pageStyle = computed(() => {
    const s = this.settings();
    const dim = getPaperDimensions(s.paperSize, s.customWidth, s.customHeight);
    const scale = this.printScale();
    return {
      '--paper-width': `${dim.width}cm`,
      '--paper-height': `${dim.height}cm`,
      '--margin-top': `${s.marginTop}cm`,
      '--margin-right': `${s.marginRight}cm`,
      '--margin-bottom': `${s.marginBottom}cm`,
      '--margin-left': `${s.marginLeft}cm`,
      '--logo-width': `${s.logoWidth}cm`,
      '--content-height': `${dim.height - s.marginTop - s.marginBottom}cm`,
      '--font-doctor': `${12 * scale}pt`,
      '--font-doctor-name': `${16 * scale}pt`,
      '--font-body': `${12 * scale}pt`,
      '--font-rich': `${11 * scale}pt`,
      '--font-section-label': `${12 * scale}pt`,
      '--screen-scale': String(this.screenScale()),
    };
  });

  protected showLogo = computed(() => true);

  protected screenPageWrapperStyle = computed(() => {
    const s = this.settings();
    const dim = getPaperDimensions(s.paperSize, s.customWidth, s.customHeight);
    const scale = this.screenScale();
    return {
      width: `${Math.round(dim.width * PX_PER_CM * scale)}px`,
      height: `${Math.round(dim.height * PX_PER_CM * scale)}px`,
    };
  });

  private printScale(): number {
    const s = this.settings();
    const dim = getPaperDimensions(s.paperSize, s.customWidth, s.customHeight);
    const contentWidth = dim.width - s.marginLeft - s.marginRight;
    const baseContentWidth = 19.5;
    const scale = Math.max(0.72, Math.min(1, contentWidth / baseContentWidth));
    return Math.round(scale * 1000) / 1000;
  }

  private screenScale(): number {
    const s = this.settings();
    const dim = getPaperDimensions(s.paperSize, s.customWidth, s.customHeight);
    const availableWidth = Math.max(window.innerWidth - 32, 280);
    const scale = Math.min(1, availableWidth / (dim.width * PX_PER_CM));
    return Math.round(scale * 1000) / 1000;
  }

  async ngOnInit() {
    const recordId = this.route.snapshot.paramMap.get('recordId');
    if (!recordId) return;

    this.record = await this.clinicalRepo.get(recordId);
    if (!this.record) return;

    if (this.record.patientId) {
      this.patient = await this.patientRepo.getPatient(this.record.patientId);
      if (this.patient) {
        this.patientAge = calcAge(this.patient.birthDate);
      }
    }

    this.doctor = await this.resolveDoctorForRecord(this.record);
    if (this.doctor) {
      const s = await this.printRepo.getSettings(this.doctor.uid);
      this.settings.set(s);
    }

    if (this.record.recommendations) {
      this.sanitizedRecommendations = this.sanitizer.bypassSecurityTrustHtml(this.record.recommendations);
    }
    if (this.record.prescription) {
      this.sanitizedPrescription = this.sanitizer.bypassSecurityTrustHtml(this.record.prescription);
    }

    this.loading.set(false);
    this.appRef.tick();
    await this.waitForPrintableLayout();
    this.paginateContent();
    console.log('paginateContent result', {
      pages: this.pages().length,
      hasMeasurePage: !!this.measurePage?.nativeElement,
      hasScratch: !!this.measureScratch?.nativeElement,
      debug: this.debugInfo(),
    });
    this.cdr.markForCheck();

    setTimeout(() => {
      this.printViaNewWindow();
    }, 500);
  }

  private async resolveDoctorForRecord(record: ClinicalRecord): Promise<AppUser | null> {
    const currentDoctor = this.auth.currentDoctor;
    const createdBy = record.createdBy?.trim();

    if (!createdBy) return currentDoctor;

    if (createdBy.includes('@')) {
      const email = normalizeEmail(createdBy);
      if (currentDoctor && normalizeEmail(currentDoctor.email) === email) return currentDoctor;
      return (await this.userRepo.getUserByEmail(email)) ?? currentDoctor;
    }

    return (await this.userRepo.getUser(createdBy)) ?? currentDoctor;
  }

  private async waitForPrintableLayout(): Promise<void> {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await document.fonts?.ready;

    const images = Array.from(document.querySelectorAll<HTMLImageElement>('.print-page img'));
    await Promise.all(
      images.map(
        (img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.addEventListener('load', () => resolve(), { once: true });
                img.addEventListener('error', () => resolve(), { once: true });
              }),
      ),
    );
  }

  private contentToUnits(html: string): string[] {
    const units: string[] = [];
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const nodes = Array.from(doc.body.childNodes);
    for (const node of nodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim();
        if (text) units.push(`<div class="print-rich-content ql-editor"><p>${this.escapeHtml(text)}</p></div>`);
        continue;
      }

      if (!(node instanceof HTMLElement)) continue;
      if (node.tagName === 'UL' || node.tagName === 'OL') {
        const items = Array.from(node.children).filter((child) => child.tagName === 'LI');
        if (!items.length) {
          const clean = node.cloneNode(true) as HTMLElement;
          clean.querySelectorAll('.ql-ui').forEach((el) => el.remove());
          Array.from(clean.querySelectorAll('[data-list]')).forEach((el) => el.removeAttribute('data-list'));
          units.push(`<div class="print-rich-content ql-editor">${clean.outerHTML}</div>`);
          continue;
        }
        let orderedIndex = 0;
        for (const item of items) {
          const isOrdered = item.getAttribute('data-list') === 'ordered';
          const cleanLi = item.cloneNode(true) as HTMLElement;
          cleanLi.querySelectorAll('.ql-ui').forEach((el) => el.remove());
          cleanLi.removeAttribute('data-list');
          if (isOrdered) {
            orderedIndex++;
            const start = orderedIndex > 1 ? ` start="${orderedIndex}"` : '';
            units.push(`<div class="print-rich-content ql-editor"><ol${start}>${cleanLi.outerHTML}</ol></div>`);
          } else {
            units.push(`<div class="print-rich-content ql-editor"><ul>${cleanLi.outerHTML}</ul></div>`);
          }
        }
        continue;
      }

      units.push(`<div class="print-rich-content ql-editor">${node.outerHTML}</div>`);
    }
    return units;
  }

  private paginateSection(
    units: string[],
    availableHeight: number,
    scratch: HTMLElement,
  ): string[] {
    const pageHtml: string[] = [];
    let currentUnits: string[] = [];

    for (const unit of units) {
      scratch.innerHTML = [...currentUnits, unit].join('');
      void scratch.offsetHeight;
      const contentHeight = scratch.getBoundingClientRect().height;
      const fits = contentHeight <= availableHeight;

      if (fits || currentUnits.length === 0) {
        currentUnits.push(unit);
        continue;
      }

      pageHtml.push(currentUnits.join(''));
      currentUnits = [unit];
      scratch.innerHTML = unit;
    }

    if (currentUnits.length) {
      pageHtml.push(currentUnits.join(''));
    }

    // merge trailing pages within this section
    while (pageHtml.length > 1) {
      const last = pageHtml[pageHtml.length - 1];
      const prev = pageHtml[pageHtml.length - 2];
      scratch.innerHTML = prev + last;
      void scratch.offsetHeight;
      const mergedH = scratch.getBoundingClientRect().height;
      if (mergedH <= availableHeight) {
        pageHtml.pop();
        pageHtml[pageHtml.length - 1] = prev + last;
      } else {
        break;
      }
    }

    return pageHtml;
  }

  private buildSectionHtml(html: string | undefined, sectionLabel: string, scratch: HTMLElement, availableHeight: number): string[] {
    if (!html) return [];
    const units: string[] = [];
    units.push(`<h2 class="print-section-label">${sectionLabel}</h2>`);
    units.push(...this.contentToUnits(html));
    return this.paginateSection(units, availableHeight, scratch);
  }

  private paginateContent(): void {
    const measurePage = this.measurePage?.nativeElement;
    const scratch = this.measureScratch?.nativeElement;
    if (!measurePage || !scratch) {
      this.pages.set([]);
      return;
    }

    const pageStyles = getComputedStyle(measurePage);
    const verticalPadding =
      parseFloat(pageStyles.paddingTop || '0') + parseFloat(pageStyles.paddingBottom || '0');
    const shell = measurePage.querySelector<HTMLElement>('.print-shell');
    const shellHeight = shell?.getBoundingClientRect().height ?? 0;
    const availableHeight = measurePage.getBoundingClientRect().height - verticalPadding - shellHeight;

    scratch.innerHTML = '';
    const recPages = this.buildSectionHtml(this.record?.recommendations, 'RECOMENDACIONES', scratch, availableHeight);
    const rxPages = this.buildSectionHtml(this.record?.prescription, 'RECETA', scratch, availableHeight);

    const allPageHtml = [...recPages, ...rxPages];

    let debugLines = [
      `paperH=${measurePage.getBoundingClientRect().height.toFixed(1)} pad=${verticalPadding.toFixed(1)} shell=${shellHeight.toFixed(1)} avail=${availableHeight.toFixed(1)}`,
      `recPages=${recPages.length} rxPages=${rxPages.length}`,
    ];

    scratch.innerHTML = '';
    debugLines.push(`final pages=${allPageHtml.length}`);
    this.debugInfo.set(debugLines.join(' | '));
    this.cdr.markForCheck();

    if (allPageHtml.length === 0) {
      this.pages.set([{
        html: this.sanitizer.bypassSecurityTrustHtml(
          '<div class="print-empty-msg" style="display:flex;align-items:center;justify-content:center;height:100%;font-family:Roboto,sans-serif;font-size:16px;color:#666;">No hay recomendaciones ni prescripciones para este registro.</div>'
        ),
      }]);
      return;
    }

    this.pages.set(
      allPageHtml.map((html) => ({
        html: this.sanitizer.bypassSecurityTrustHtml(html || '&nbsp;'),
      })),
    );
  }

  private escapeHtml(value: string): string {
    const div = document.createElement('div');
    div.textContent = value;
    return div.innerHTML;
  }

  private printViaNewWindow() {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const previewEl = document.querySelector('app-print-preview');
    if (!previewEl) return;

    const allStyles = Array.from(document.head.querySelectorAll('style'))
      .map((el) => el.innerHTML)
      .join('\n');

    const styleLinks = Array.from(document.head.querySelectorAll('link[rel="stylesheet"]'))
      .map((link) => `<link rel="stylesheet" href="${(link as HTMLLinkElement).href}">`)
      .join('\n');

    const clone = previewEl.cloneNode(true) as HTMLElement;
    const html = clone.outerHTML;

    const s = this.settings();
    const dim = getPaperDimensions(s.paperSize, s.customWidth, s.customHeight);

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
${styleLinks}
<style>
${allStyles}
</style>
<style>
@page {
  size: ${dim.width}cm ${dim.height}cm;
  margin: 0;
  @top-left { content: none; }
  @top-center { content: none; }
  @top-right { content: none; }
  @bottom-left { content: none; }
  @bottom-center { content: none; }
  @bottom-right { content: none; }
}
* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
@media print {
  app-print-preview { padding: 0; background: #fff; min-height: auto; }
  .print-preview-pages { display: block; }
   .screen-page-wrapper {
     display: block !important;
     width: 100% !important;
     height: auto !important;
     margin: 0 !important;
     padding: 0 !important;
     position: relative !important;
     page-break-after: always;
   }
   .screen-page-wrapper:last-of-type {
     page-break-after: auto;
   }
   .screen-page-wrapper .print-page-num {
     position: absolute;
     top: 10px;
     right: 10px;
     font-family: 'Roboto', sans-serif;
     font-size: 10px;
     color: #999;
   }
   .screen-page-wrapper .print-page {
     position: static !important;
    transform: none !important;
    display: block !important;
    width: 100% !important;
    height: auto !important;
    margin: 0;
    padding: var(--margin-top) var(--margin-right) var(--margin-bottom) var(--margin-left);
    box-shadow: none;
    overflow: visible;
  }
  .pagination-measure, .print-debug { display: none; }
}
</style>
</head>
<body>
${html}
</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 800);
  }
}
