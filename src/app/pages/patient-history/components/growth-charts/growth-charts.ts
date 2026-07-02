import {
  Component, input, effect, ChangeDetectionStrategy, ViewEncapsulation, inject,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { line, curveMonotoneX } from 'd3-shape';
import { ClinicalRecord } from '../../../../core/models/clinical-record';
import { Sexo } from '../../../../core/models/sexo';
import { generateCdcSvg, GRAPH, cx, cyLength, cyWeight } from './cdc-bg';

export type ChartTab = 'weightHeight' | 'headCircumference' | 'bmi';

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

  protected activeTab: ChartTab = 'weightHeight';
  protected hasData = false;
  protected cdcBgSvg: SafeHtml = '';
  protected lengthSvg: SafeHtml = '';
  protected weightSvg: SafeHtml = '';
  protected hcSvg: SafeHtml = '';
  protected bmiSvg: SafeHtml = '';

  private sanitizer = inject(DomSanitizer);

  constructor() {
    effect(() => {
      this.records(); this.selectedRecord(); this.patientSex();
      this.renderActiveChart();
    });
  }

  protected switchTab(tab: ChartTab) {
    this.activeTab = tab;
    this.renderActiveChart();
  }

  protected printChart() {
    const area = document.querySelector('.growth-charts') as HTMLElement;
    if (!area) return;
    const charts = area.querySelector('.chart-body');
    if (!charts) return;

    const w = window.open('', '_blank');
    if (!w) return;

    const svg = charts.querySelector('svg');
    w.document.write(`<html><head><title>Gráfica</title>
      <style>body{margin:0;display:flex;justify-content:center;padding:20px}
      svg{max-width:1000px;width:100%;height:auto}
      @media print{body{padding:0}}</style></head>
      <body>`);
    if (svg) {
      const cloned = svg.cloneNode(true) as SVGSVGElement;
      const serializer = new XMLSerializer();
      w.document.write(serializer.serializeToString(cloned));
    }
    w.document.write('</body></html>');
    w.document.close();
    setTimeout(() => w.print(), 300);
  }

  /* ── helpers ──────────────────────────────────── */

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

  private getAgeInMonths(recordDate: string): number {
    if (!this.birthDate()) return 0;
    const birth = new Date(this.birthDate());
    const visit = new Date(recordDate);
    return (visit.getFullYear() - birth.getFullYear()) * 12
      + (visit.getMonth() - birth.getMonth())
      + (visit.getDate() - birth.getDate()) / 30.44;
  }

  /* ── rendering ────────────────────────────────── */

  private renderActiveChart() {
    if (this.activeTab === 'weightHeight') this.renderCdc();
    else if (this.activeTab === 'headCircumference') this.renderHc();
    else this.renderBmi();
  }

  /* ==========================================================
   *  CDC PESO Y TALLA — SVG background + SVG overlay
   * ========================================================== */
  private renderCdc() {
    this.cdcBgSvg = this.sanitizer.bypassSecurityTrustHtml(
      generateCdcSvg(this.sexKey)
    );

    const filtered = this.getFilteredRecords();
    const lengthPts: { m: number; v: number }[] = [];
    const weightPts: { m: number; v: number }[] = [];

    for (const r of filtered) {
      const m = this.getAgeInMonths(r.date);
      const len = r.height ?? NaN;
      const wgt = r.weight ?? NaN;
      if (!isNaN(m) && !isNaN(len)) lengthPts.push({ m: Math.round(m * 10) / 10, v: len });
      if (!isNaN(m) && !isNaN(wgt)) weightPts.push({ m: Math.round(m * 10) / 10, v: wgt });
    }

    this.hasData = lengthPts.length > 0 || weightPts.length > 0;

    this.lengthSvg = this.buildPatientSvg(lengthPts, cyLength);
    this.weightSvg = this.buildPatientSvg(weightPts, cyWeight);
  }

  private buildPatientSvg(
    pts: { m: number; v: number }[],
    yFn: (v: number) => number,
  ): SafeHtml {
    if (pts.length === 0) return '';

    const lineGen = line<{ m: number; v: number }>()
      .x(d => cx(d.m))
      .y(d => yFn(d.v))
      .curve(curveMonotoneX);

    const d = lineGen(pts) ?? '';

    const circles = pts.map(p =>
      `<circle cx="${cx(p.m)}" cy="${yFn(p.v)}" r="3" fill="#0D6E8F" stroke="#fff" stroke-width="1"/>`
    ).join('');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 936 1100" width="100%" class="patient-overlay">
      <path d="${d}" fill="none" stroke="#0D6E8F" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
      ${circles}
    </svg>`;

    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  /* ==========================================================
   *  HEAD CIRCUMFERENCE — SVG chart
   * ========================================================== */
  private renderHc() {
    this.renderSimpleChart('headCircumference', 'Perímetro cefálico (cm)');
  }

  /* ==========================================================
   *  BMI — SVG chart
   * ========================================================== */
  private renderBmi() {
    this.renderSimpleChart('bmi', 'IMC (kg/m²)');
  }

  private renderSimpleChart(indicator: 'headCircumference' | 'bmi', labelY: string) {
    const filtered = this.getFilteredRecords();
    const pts: { m: number; v: number }[] = [];

    for (const r of filtered) {
      const m = this.getAgeInMonths(r.date);
      const value = indicator === 'headCircumference'
        ? (r.headCircumference ?? NaN) : (r.bmi ?? NaN);
      if (!isNaN(m) && !isNaN(value)) {
        pts.push({ m: Math.round(m * 10) / 10, v: value });
      }
    }

    this.hasData = pts.length > 0;

    if (pts.length === 0) {
      if (indicator === 'headCircumference') this.hcSvg = '';
      else this.bmiSvg = '';
      return;
    }

    const mMin = 0;
    const mMax = Math.max(36, ...pts.map(p => p.m)) + 3;
    const vMin = Math.min(...pts.map(p => p.v)) - 2;
    const vMax = Math.max(...pts.map(p => p.v)) + 2;

    const pad = 50;
    const sw = 700, sh = 350;

    function mx(m: number): number { return pad + (m - mMin) / (mMax - mMin) * (sw - pad * 2); }
    function vy(v: number): number { return (sh - pad) - (v - vMin) / (vMax - vMin) * (sh - pad * 2); }

    const lineGen = line<{ m: number; v: number }>()
      .x(d => mx(d.m)).y(d => vy(d.v)).curve(curveMonotoneX);

    const d = lineGen(pts) ?? '';

    const circles = pts.map(p =>
      `<circle cx="${mx(p.m)}" cy="${vy(p.v)}" r="3" fill="#0D6E8F" stroke="#fff" stroke-width="1"/>`
    ).join('');

    const yTicks: number[] = [];
    const step = Math.ceil((vMax - vMin) / 6);
    for (let v = Math.ceil(vMin / step) * step; v <= vMax; v += step) yTicks.push(v);

    const gridLines = yTicks.map(v =>
      `<line x1="${pad}" y1="${vy(v)}" x2="${sw - pad}" y2="${vy(v)}" stroke="#ddd" stroke-width="0.5"/>`
    ).join('');

    const yLabels = yTicks.map(v =>
      `<text x="${pad - 6}" y="${vy(v) + 3}" text-anchor="end" font-size="10" fill="#333">${v}</text>`
    ).join('');

    const xLabels = [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36]
      .filter(m => m <= mMax)
      .map(m =>
        `<text x="${mx(m)}" y="${sh - pad + 16}" text-anchor="middle" font-size="9" fill="#333">${m === 0 ? 'Birth' : m}</text>`
      ).join('');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sw} ${sh}" style="background:#fff;border-radius:4px">
      <rect x="${pad}" y="${pad}" width="${sw - pad * 2}" height="${sh - pad * 2}" fill="none" stroke="#ccc" stroke-width="1"/>
      ${gridLines}
      <line x1="${pad}" y1="${sh - pad}" x2="${sw - pad}" y2="${sh - pad}" stroke="#ccc" stroke-width="1"/>
      ${yLabels}
      ${xLabels}
      <text x="${sw / 2}" y="${sh - 6}" text-anchor="middle" font-size="10" fill="#666">Age (months)</text>
      <text x="8" y="${sh / 2}" text-anchor="middle" font-size="10" fill="#666" transform="rotate(-90, 8, ${sh / 2})">${labelY}</text>
      <path d="${d}" fill="none" stroke="#0D6E8F" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${circles}
    </svg>`;

    const safe = this.sanitizer.bypassSecurityTrustHtml(svg);
    if (indicator === 'headCircumference') this.hcSvg = safe;
    else this.bmiSvg = safe;
  }
}
