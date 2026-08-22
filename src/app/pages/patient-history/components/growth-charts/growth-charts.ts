import {
  Component, input, signal, computed, effect, inject, ChangeDetectionStrategy, ViewEncapsulation,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { line, curveMonotoneX } from 'd3-shape';
import { environment } from '../../../../../environments/environment';
import { ClinicalRecord } from '../../../../core/models/clinical-record';
import { Sexo } from '../../../../core/models/sexo';
import { AuthService } from '../../../../core/services/auth.service';
import { PrintSettingsRepository } from '../../../../core/repositories/print-settings.repository';
import { getPaperDimensions, getDefaultSettings } from '../../../../core/models/print-settings';
import {
  cx, cyLength, cyWeight, getCdcImageSrc, getCdcViewBox,
  hcCx, hcCy, hcLx, hcLy, getHcImageSrc, getHcViewBox,
  y2Cx, y2CyHeight, y2CyWeight, getY2ImageSrc, getY2ViewBox,
  bmiCx, bmiCy, getBmiImageSrc, getBmiViewBox,
} from './cdc-bg';

export type ChartTab = 'weightHeight' | 'headCircumference' | 'bmi';
export type ChartSet = 'cdc' | 'y2';
export type CalMode = 'x' | 'length' | 'weight' | 'hcx' | 'hc' | 'hclx' | 'hclw'
  | 'y2x' | 'y2h' | 'y2w' | 'bmiX' | 'bmiY';
export interface CalResult { slope: number; intercept: number; r2: number; count: number; }

@Component({
  selector: 'app-growth-charts',
  templateUrl: './growth-charts.html',
  styleUrl: './growth-charts.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [MatIconModule],
})
export class GrowthCharts {
  readonly records = input<ClinicalRecord[]>([]);
  readonly selectedRecord = input<ClinicalRecord | null>(null);
  readonly patientSex = input<Sexo | undefined>(undefined);
  readonly birthDate = input<string>('');

  protected zoomedIn = signal(false);
  protected activeTab: ChartTab = 'weightHeight';
  protected hasData = false;
  protected calibrationEnabled = environment.calibration_enabled;
  protected imgSrc = '';
  protected overlaySvg: SafeHtml = '';
  protected bmiSvg: SafeHtml = '';

  protected calibrating = signal(false);
  protected calMode = signal<CalMode | null>(null);
  protected calStep = signal(-1);
  protected calRecorded = signal<{ ref: number; x: number; y: number }[]>([]);
  protected calResult = signal<CalResult | null>(null);
  protected calResultDisplay = computed(() => {
    const r = this.calResult();
    if (!r) return null;
    return {
      intercept: this.round4(r.intercept),
      slope: this.round4(r.slope),
      r2: this.round4(r.r2),
    };
  });

  protected readonly CAL_CONFIG: Record<CalMode, { refs: number[]; label: string; unit: string }> = {
    x: { refs: [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36], label: 'Edad', unit: 'meses' },
    length: { refs: [40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100], label: 'Talla', unit: 'cm' },
    weight: { refs: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18], label: 'Peso', unit: 'kg' },
    hcx: { refs: [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36], label: 'Edad (HC)', unit: 'meses' },
    hc: { refs: [30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52], label: 'PC', unit: 'cm' },
    hclx: { refs: [45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100], label: 'Talla (WFL)', unit: 'cm' },
    hclw: { refs: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22], label: 'Peso (WFL)', unit: 'kg' },
    y2x: { refs: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20], label: 'Edad', unit: 'años' },
    y2h: { refs: [80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 195], label: 'Estatura', unit: 'cm' },
    y2w: { refs: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110], label: 'Peso', unit: 'kg' },
    bmiX: { refs: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20], label: 'Edad (IMC)', unit: 'años' },
    bmiY: { refs: [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 37], label: 'IMC', unit: '' },
  };

  private sanitizer = inject(DomSanitizer);
  private auth = inject(AuthService);
  private printRepo = inject(PrintSettingsRepository);

  constructor() {
    effect(() => {
      this.records(); this.selectedRecord(); this.patientSex();
      const currentTabs = this.tabs;
      if (currentTabs.length && !currentTabs.some(t => t.id === this.activeTab)) {
        this.activeTab = currentTabs[0].id;
        this.cancelCalMode();
      }
      this.renderActiveChart();
    });
  }

  protected toggleZoom() {
    this.zoomedIn.update(v => !v);
  }

  /* ── Age logic ────────────────────────────────── */

  protected get chartSet(): ChartSet {
    return this.selectedAgeMonths > 36 ? 'y2' : 'cdc';
  }

  private get selectedAgeMonths(): number {
    const sel = this.selectedRecord();
    if (!sel) return 0;
    return this.getAgeInMonths(sel.date);
  }

  /* ── Tab logic ─────────────────────────────────── */

  protected get tabs(): { id: ChartTab; label: string }[] {
    const set = this.chartSet;
    const age = this.selectedAgeMonths;
    const result: { id: ChartTab; label: string }[] = [];

    if (set === 'cdc') {
      result.push({ id: 'weightHeight', label: 'Peso y talla' });
      result.push({ id: 'headCircumference', label: 'Circunferencia' });
      if (age >= 24) result.push({ id: 'bmi', label: 'IMC' });
    } else {
      result.push({ id: 'weightHeight', label: 'Estatura y peso' });
      result.push({ id: 'bmi', label: 'IMC' });
    }

    return result;
  }

  protected switchTab(tab: ChartTab) {
    this.activeTab = tab;
    this.cancelCalMode();
    this.renderActiveChart();
  }

  /* ── Print ──────────────────────────────────────── */

  protected async printChart() {
    const area = document.querySelector('.chart-body') as HTMLElement;
    if (!area) return;
    const container = area.querySelector('.cdc-container') as HTMLElement;
    if (!container) return;
    const chartImg = container.querySelector('img') as HTMLImageElement;
    if (!chartImg) return;
    const overlay = container.querySelector('.cdc-overlay') as HTMLElement;
    const viewBox = this.currentViewBox;

    const uid = this.auth.currentUserUid;
    let settings = getDefaultSettings();
    if (uid) {
      try {
        settings = await this.printRepo.getSettings(uid);
      } catch { /* use defaults */ }
    }

    const dim = getPaperDimensions(settings.paperSize, settings.customWidth, settings.customHeight);

    const w = window.open('', '_blank');
    if (!w) return;

    const mT = settings.marginTop, mR = settings.marginRight, mB = settings.marginBottom, mL = settings.marginLeft;

    w.document.write(`<html><head>
      <title>${this.sexLabel} ${this.tabs.find(t => t.id === this.activeTab)?.label ?? ''}</title>
      <style>
        @page{size:${dim.width}cm ${dim.height}cm;margin:0}
        body{margin:0;padding:0}
        .print-page{position:fixed;top:${mT}cm;right:${mR}cm;bottom:${mB}cm;left:${mL}cm}
        .print-page svg{display:block;width:100%;height:100%}
      </style></head>
      <body>
        <div class="print-page">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet">
            <image href="${new URL(chartImg.getAttribute('src') || '', window.location.origin).href}" x="0" y="0" width="${viewBox.split(' ')[2]}" height="${viewBox.split(' ')[3]}"/>
            ${overlay ? overlay.innerHTML : ''}
          </svg>
        </div>
      </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  }

  /* ── Calibration ────────────────────────────────── */

  protected toggleCalibrate() {
    this.calibrating.update(v => !v);
    if (!this.calibrating()) this.resetCalibration();
  }

  protected get calModes(): CalMode[] {
    const tab = this.activeTab;
    if (tab === 'headCircumference') return ['hcx', 'hc', 'hclx', 'hclw'];
    if (tab === 'bmi') return ['bmiX', 'bmiY'];
    if (this.chartSet === 'y2') return ['y2x', 'y2h', 'y2w'];
    return ['x', 'length', 'weight'];
  }

  protected startCalMode(mode: CalMode) {
    this.calMode.set(mode);
    this.calStep.set(0);
    this.calRecorded.set([]);
    this.calResult.set(null);
  }

  protected onChartClick(event: MouseEvent) {
    if (this.calMode() === null || this.calStep() < 0) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const sx = (event.clientX - rect.left) / rect.width;
    const sy = (event.clientY - rect.top) / rect.height;
    const vb = this.currentViewBox;
    const [vbW, vbH] = vb.split(' ').slice(2).map(Number);
    const svgX = sx * vbW;
    const svgY = sy * vbH;

    const mode = this.calMode()!;
    const refs = this.CAL_CONFIG[mode].refs;
    const ref = refs[this.calStep()];
    this.calRecorded.update(pts => [...pts, { ref, x: Math.round(svgX * 100) / 100, y: Math.round(svgY * 100) / 100 }]);

    const next = this.calStep() + 1;
    if (next >= refs.length) {
      this.finishCalibration();
    } else {
      this.calStep.set(next);
    }
  }

  private get currentViewBox(): string {
    const tab = this.activeTab;
    if (tab === 'headCircumference') return getHcViewBox();
    if (tab === 'bmi') return getBmiViewBox();
    if (this.chartSet === 'y2') return getY2ViewBox();
    return getCdcViewBox(this.sexKey);
  }

  private finishCalibration() {
    const mode = this.calMode()!;
    const pts = this.calRecorded();
    const isX = ['x', 'hcx', 'hclx', 'y2x', 'bmiX'].includes(mode);
    const coords = pts.map(p => ({ ref: p.ref, coord: isX ? p.x : p.y }));
    const result = this.linearRegression(coords);
    this.calResult.set(result);
    this.calStep.set(-1);
  }

  protected undoLastPoint() {
    const pts = this.calRecorded();
    if (pts.length === 0) return;
    this.calRecorded.set(pts.slice(0, -1));
    this.calStep.update(s => s - 1);
    this.calResult.set(null);
  }

  protected cancelCalMode() {
    this.calMode.set(null);
    this.calStep.set(-1);
    this.calRecorded.set([]);
    this.calResult.set(null);
  }

  private resetCalibration() {
    this.calMode.set(null);
    this.calStep.set(-1);
    this.calRecorded.set([]);
    this.calResult.set(null);
  }

  protected copyResult() {
    const r = this.calResult();
    if (!r) return;
    const sex = this.sexLabel;
    const date = new Date().toLocaleDateString();
    const chart = this.activeTab === 'headCircumference' ? 'HC'
      : this.activeTab === 'bmi' ? 'BMI'
      : this.chartSet === 'y2' ? '2-20y' : 'CDC';
    const lines = [
      `// ${sex} ${chart} calibration — generated ${date}`,
      `// y = ${this.round4(r.intercept)} + x × ${this.round4(r.slope)}  (R² = ${this.round4(r.r2)}, n = ${r.count})`,
      `const BASE = ${this.round4(r.intercept)};`,
      `const SCALE = ${this.round4(r.slope)};`,
    ];
    navigator.clipboard.writeText(lines.join('\n'));
  }

  protected copyRawPoints() {
    const pts = this.calRecorded();
    const mode = this.calMode();
    if (!pts.length || !mode) return;
    const cfg = this.CAL_CONFIG[mode];
    const sex = this.sexLabel;
    const isX = ['x', 'hcx', 'hclx', 'y2x', 'bmiX'].includes(mode);
    const lines = [
      `// ${sex} ${cfg.label} raw points — ${new Date().toLocaleDateString()}`,
      `// ref → ${isX ? 'svgX' : 'svgY'}`,
      ...pts.map(p => `${p.ref}\t${isX ? p.x : p.y}`),
    ];
    navigator.clipboard.writeText(lines.join('\n'));
  }

  protected get currentRefLabel(): string {
    const mode = this.calMode();
    const step = this.calStep();
    if (!mode || step < 0) return '';
    const cfg = this.CAL_CONFIG[mode];
    const ref = cfg.refs[step];
    return ref === 0 ? 'Birth' : `${ref} ${cfg.unit}`;
  }

  protected get calProgress(): string {
    const mode = this.calMode();
    if (!mode) return '';
    const total = this.CAL_CONFIG[mode].refs.length;
    const done = this.calRecorded().length;
    return `${done} / ${total}`;
  }

  protected get calPct(): number {
    const mode = this.calMode();
    if (!mode) return 0;
    const total = this.CAL_CONFIG[mode].refs.length;
    return (this.calRecorded().length / total) * 100;
  }

  private linearRegression(pts: { ref: number; coord: number }[]): CalResult {
    const n = pts.length;
    const sx = pts.reduce((s, p) => s + p.ref, 0);
    const sy = pts.reduce((s, p) => s + p.coord, 0);
    const sxy = pts.reduce((s, p) => s + p.ref * p.coord, 0);
    const sx2 = pts.reduce((s, p) => s + p.ref * p.ref, 0);
    const slope = (n * sxy - sx * sy) / (n * sx2 - sx * sx);
    const intercept = (sy - slope * sx) / n;
    const my = sy / n;
    const ssTot = pts.reduce((s, p) => s + (p.coord - my) ** 2, 0);
    const ssRes = pts.reduce((s, p) => s + (p.coord - (intercept + slope * p.ref)) ** 2, 0);
    const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
    return { slope, intercept, r2, count: n };
  }

  protected round4(v: number): number {
    return Math.round(v * 10000) / 10000;
  }

  /* ── helpers ────────────────────────────────── */

  private get sexKey(): 'M' | 'F' {
    return this.patientSex() === Sexo.Femenino ? 'F' : 'M';
  }

  protected get sexLabel(): string {
    return this.patientSex() === Sexo.Femenino ? 'Girls' : 'Boys';
  }

  private getFilteredRecords(): ClinicalRecord[] {
    const sel = this.selectedRecord();
    if (!sel) return [];
    const t = new Date(sel.date).getTime();
    return this.records().filter(r => new Date(r.date).getTime() <= t)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /** Anchors the closest record before `minYears` to `minYears`, so charts that start
   *  above 0 (e.g. 2–20y begins at age 2) show a meaningful starting point.
   *  Only anchors when there are no records in [minYears, minYears+1). */
  private anchorPreMin(records: ClinicalRecord[], minYears: number): ClinicalRecord[] {
    if (minYears <= 0 || !records.length) return records;
    const birth = this.birthDate();
    if (!birth) return records;
    const pre: ClinicalRecord[] = [];
    const post: ClinicalRecord[] = [];
    for (const r of records) {
      if (this.getAgeInYears(r.date) < minYears) pre.push(r);
      else post.push(r);
    }
    const hasInFirstInterval = post.some(r => this.getAgeInYears(r.date) < minYears + 1);
    if (hasInFirstInterval) return post;
    if (!pre.length) return records;
    const closest = pre.reduce((a, b) =>
      Math.abs(this.getAgeInYears(a.date) - minYears) < Math.abs(this.getAgeInYears(b.date) - minYears) ? a : b
    );
    const parts = birth.split('-');
    const bd = new Date(+parts[0], +parts[1] - 1, +parts[2]);
    const target = new Date(bd);
    target.setFullYear(bd.getFullYear() + Math.floor(minYears));
    target.setMonth(bd.getMonth() + Math.round((minYears % 1) * 12));
    return [{ ...closest, date: target.toISOString().split('T')[0] }, ...post];
  }

  private getAgeInMonths(recordDate: string): number {
    if (!this.birthDate()) return 0;
    const raw = this.birthDate();
    let birth: Date;
    if (typeof raw === 'string') {
      const parts = raw.split('-');
      if (parts.length !== 3) return NaN;
      birth = new Date(+parts[0], +parts[1] - 1, +parts[2]);
    } else if (raw && typeof (raw as any).toDate === 'function') {
      birth = (raw as any).toDate();
    } else {
      return NaN;
    }
    const visit = new Date(recordDate);
    const days = (visit.getTime() - birth.getTime()) / 86400000;
    return days / 30.4375;
  }

  private getAgeInYears(recordDate: string): number {
    return this.getAgeInMonths(recordDate) / 12;
  }

  /* ── rendering ────────────────────────────────── */

  private renderActiveChart() {
    if (this.activeTab === 'weightHeight') {
      if (this.chartSet === 'y2') this.renderY2();
      else this.renderCdc();
    } else if (this.activeTab === 'headCircumference') {
      this.renderHc();
    } else {
      this.renderBmi();
    }
  }

  /* ==========================================================
   *  CDC 0–36m — SVG background + single SVG overlay
   * ========================================================== */
  private renderCdc() {
    this.imgSrc = getCdcImageSrc(this.sexKey);

    const filtered = this.getFilteredRecords();
    const lengthPts: { m: number; v: number }[] = [];
    const weightPts: { m: number; v: number }[] = [];

    for (const r of filtered) {
      const m = this.getAgeInMonths(r.date);
      const len = r.height ?? NaN;
      const wgt = r.weight ?? NaN;
      if (!isNaN(m) && !isNaN(len)) lengthPts.push({ m, v: len });
      if (!isNaN(m) && !isNaN(wgt)) weightPts.push({ m, v: wgt });
    }

    this.hasData = lengthPts.length > 0 || weightPts.length > 0;
    this.overlaySvg = this.buildCdcSvg(lengthPts, weightPts);
  }

  private buildCdcSvg(
    lengthPts: { m: number; v: number }[],
    weightPts: { m: number; v: number }[],
  ): SafeHtml {
    const pointColor = this.sexKey === 'F' ? '#0D6E8F' : '#E91E63';
    let elements = '';

    for (const p of lengthPts) {
      const x = cx(p.m, this.sexKey), y = cyLength(p.v, this.sexKey);
      elements += `<circle cx="${x}" cy="${y}" r="3" fill="${pointColor}" stroke="#fff" stroke-width="1"/>`;
    }

    for (const p of weightPts) {
      const x = cx(p.m, this.sexKey), y = cyWeight(p.v, this.sexKey);
      elements += `<circle cx="${x}" cy="${y}" r="3" fill="${pointColor}" stroke="#fff" stroke-width="1"/>`;
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${getCdcViewBox(this.sexKey)}" preserveAspectRatio="none">
      ${elements}
    </svg>`;

    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  /* ==========================================================
   *  HEAD CIRCUMFERENCE — SVG background + overlay
   * ========================================================== */
  private renderHc() {
    this.imgSrc = getHcImageSrc(this.sexKey);

    const filtered = this.getFilteredRecords();
    const hcPts: { m: number; v: number }[] = [];
    const wflPts: { cm: number; kg: number }[] = [];

    for (const r of filtered) {
      const m = this.getAgeInMonths(r.date);
      const hc = r.headCircumference ?? NaN;
      if (!isNaN(m) && !isNaN(hc)) hcPts.push({ m, v: hc });

      const h = r.height ?? NaN;
      const w = r.weight ?? NaN;
      if (!isNaN(h) && !isNaN(w)) wflPts.push({ cm: h, kg: w });
    }

    this.hasData = hcPts.length > 0 || wflPts.length > 0;
    this.overlaySvg = this.buildHcSvg(hcPts, wflPts);
  }

  private buildHcSvg(
    hcPts: { m: number; v: number }[],
    wflPts: { cm: number; kg: number }[],
  ): SafeHtml {
    const pointColor = this.sexKey === 'F' ? '#0D6E8F' : '#E91E63';
    let elements = '';

    for (const p of hcPts) {
      const x = hcCx(p.m, this.sexKey), y = hcCy(p.v, this.sexKey);
      elements += `<circle cx="${x}" cy="${y}" r="3" fill="${pointColor}" stroke="#fff" stroke-width="1"/>`;
    }

    for (const p of wflPts) {
      const x = hcLx(p.cm, this.sexKey), y = hcLy(p.kg, this.sexKey);
      elements += `<circle cx="${x}" cy="${y}" r="3" fill="${pointColor}" stroke="#fff" stroke-width="1"/>`;
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${getHcViewBox()}" preserveAspectRatio="none">
      ${elements}
    </svg>`;

    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  /* ==========================================================
   *  2–20 AÑOS — Estatura y peso por edad
   * ========================================================== */
  private renderY2() {
    this.imgSrc = getY2ImageSrc(this.sexKey);

    const filtered = this.anchorPreMin(this.getFilteredRecords(), 2);
    const heightPts: { y: number; v: number }[] = [];
    const weightPts: { y: number; v: number }[] = [];

    for (const r of filtered) {
      const y = this.getAgeInYears(r.date);
      const h = r.height ?? NaN;
      const w = r.weight ?? NaN;
      if (!isNaN(y) && !isNaN(h)) heightPts.push({ y, v: h });
      if (!isNaN(y) && !isNaN(w)) weightPts.push({ y, v: w });
    }

    this.hasData = heightPts.length > 0 || weightPts.length > 0;
    this.overlaySvg = this.buildY2Svg(heightPts, weightPts);
  }

  private buildY2Svg(
    heightPts: { y: number; v: number }[],
    weightPts: { y: number; v: number }[],
  ): SafeHtml {
    const pointColor = this.sexKey === 'F' ? '#0D6E8F' : '#E91E63';
    let elements = '';

    for (const p of heightPts) {
      const x = y2Cx(p.y, this.sexKey), y = y2CyHeight(p.v, this.sexKey);
      elements += `<circle cx="${x}" cy="${y}" r="3" fill="${pointColor}" stroke="#fff" stroke-width="1"/>`;
    }

    for (const p of weightPts) {
      const x = y2Cx(p.y, this.sexKey), y = y2CyWeight(p.v, this.sexKey);
      elements += `<circle cx="${x}" cy="${y}" r="3" fill="${pointColor}" stroke="#fff" stroke-width="1"/>`;
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${getY2ViewBox()}" preserveAspectRatio="none">
      ${elements}
    </svg>`;

    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  /* ==========================================================
   *  BMI — SVG background + overlay
   * ========================================================== */
  private renderBmi() {
    this.imgSrc = getBmiImageSrc(this.sexKey);

    const filtered = this.anchorPreMin(this.getFilteredRecords(), 2);
    const pts: { y: number; v: number }[] = [];

    for (const r of filtered) {
      const years = this.getAgeInYears(r.date);
      const val = r.bmi ?? NaN;
      if (!isNaN(years) && !isNaN(val)) pts.push({ y: years, v: val });
    }

    this.hasData = pts.length > 0;
    this.overlaySvg = this.buildBmiSvg(pts);
  }

  private buildBmiSvg(pts: { y: number; v: number }[]): SafeHtml {
    const pointColor = this.sexKey === 'F' ? '#0D6E8F' : '#E91E63';
    let elements = '';

    for (const p of pts) {
      const x = bmiCx(p.y, this.sexKey), y = bmiCy(p.v, this.sexKey);
      elements += `<circle cx="${x}" cy="${y}" r="3" fill="${pointColor}" stroke="#fff" stroke-width="1"/>`;
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${getBmiViewBox()}" preserveAspectRatio="none">
      ${elements}
    </svg>`;

    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }
}
