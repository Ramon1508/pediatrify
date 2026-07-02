import { getWhoCurves, cmToInches, kgToLb } from './who-data';

const PINK = '#E91E63';
const W = 936, H = 1100;

/* Área útil de la gráfica — coordenadas exactas de la imagen CDC */
export const GRAPH = {
  left: 94,
  right: 842,
  length: { top: 82, bottom: 341, min: 40, max: 100 },
  weight: { top: 542, bottom: 1038, min: 2, max: 18 },
};

function cx(month: number): number {
  return GRAPH.left + (month / 36) * (GRAPH.right - GRAPH.left);
}
function cyLength(cm: number): number {
  return GRAPH.length.bottom - ((cm - GRAPH.length.min) / (GRAPH.length.max - GRAPH.length.min)) * (GRAPH.length.bottom - GRAPH.length.top);
}
function cyWeight(kg: number): number {
  return GRAPH.weight.bottom - ((kg - GRAPH.weight.min) / (GRAPH.weight.max - GRAPH.weight.min)) * (GRAPH.weight.bottom - GRAPH.weight.top);
}

function gridPath(vLines: number[], hLines: number[], yTop: number, yBot: number): string {
  const parts: string[] = [];
  for (const v of vLines) { const x = cx(v); parts.push(`M${x},${yTop}L${x},${yBot}`); }
  for (const h of hLines) {
    const y = yTop === GRAPH.length.top ? cyLength(h) : cyWeight(h);
    parts.push(`M${GRAPH.left},${y}L${GRAPH.right},${y}`);
  }
  return parts.join('');
}

function curvePath(data: any[], yFn: (v: number) => number): string[] {
  const keys = ['p5', 'p10', 'p25', 'p50', 'p75', 'p90', 'p95'];
  return keys.map(k => {
    const pts = data.map(d => `${cx(d.month)},${yFn((d as any)[k])}`);
    return `M${pts.join('L')}`;
  });
}

export function generateCdcSvg(sex: 'M' | 'F'): string {
  const lengthCurves = getWhoCurves('cdcLength', sex, 36);
  const weightCurves = getWhoCurves('cdcWeight', sex, 36);
  const sexLabel = sex === 'F' ? 'Girls' : 'Boys';

  const months = [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36];
  const cmVals: number[] = [];
  for (let v = 40; v <= 100; v += 5) cmVals.push(v);
  const inVals: number[] = [];
  for (let v = 16; v <= 41; v += 2) inVals.push(v);
  const kgVals: number[] = [];
  for (let v = 2; v <= 18; v += 1) kgVals.push(v);
  const lbVals: number[] = [];
  for (let v = 4; v <= 38; v += 2) lbVals.push(v);

  const lengthGrid = gridPath(months, cmVals, GRAPH.length.top, GRAPH.length.bottom);
  const weightGrid = gridPath(months, kgVals, GRAPH.weight.top, GRAPH.weight.bottom);
  const lengthC = curvePath(lengthCurves, cyLength);
  const weightC = curvePath(weightCurves, cyWeight);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" style="background:#fff">
<style>
  .p { fill:none; stroke:${PINK}; stroke-width:0.7; }
  .p-m { fill:none; stroke:${PINK}; stroke-width:1.1; stroke-dasharray:3,2; }
  .g { fill:none; stroke:${PINK}; stroke-width:0.25; opacity:0.45; }
  .g-m { fill:none; stroke:${PINK}; stroke-width:0.7; opacity:0.65; }
  .l { fill:${PINK}; font-family:Roboto,sans-serif; font-size:7.5px; }
  .l-title { fill:${PINK}; font-family:Roboto,sans-serif; font-size:10px; font-weight:700; }
  .l-sm { fill:${PINK}; font-family:Roboto,sans-serif; font-size:6.5px; }
  .l-big { fill:${PINK}; font-family:Roboto,sans-serif; font-size:9px; font-weight:700; }
  .t { fill:${PINK}; font-family:Roboto,sans-serif; font-size:10px; font-weight:700; text-anchor:middle; }
  .t-sm { fill:${PINK}; font-family:Roboto,sans-serif; font-size:6.5px; text-anchor:middle; }
</style>
<rect width="${W}" height="${H}" fill="none" stroke="${PINK}" stroke-width="1.2"/>
<text x="${W/2}" y="20" class="t" font-size="11">Birth to 36 months: ${sexLabel}</text>
<text x="${W/2}" y="33" class="t" font-size="9">Length-for-age and Weight-for-age percentiles</text>
<text x="20" y="48" class="l-sm">NAME _______________</text>
<text x="350" y="48" class="l-sm">RECORD # ________</text>
<text x="660" y="48" class="l-sm">AGE (MONTHS) ________</text>

<line x1="${GRAPH.left}" y1="${GRAPH.length.top - 18}" x2="${GRAPH.left}" y2="${GRAPH.length.bottom}" stroke="${PINK}" stroke-width="0.8"/>
<line x1="${GRAPH.right}" y1="${GRAPH.length.top - 18}" x2="${GRAPH.right}" y2="${GRAPH.length.bottom}" stroke="${PINK}" stroke-width="0.8"/>
<path d="${lengthGrid}" class="g"/>
${months.map((m, i) => `<path d="M${cx(m)},${GRAPH.length.top}L${cx(m)},${GRAPH.length.bottom}" class="${i % 2 === 0 ? 'g-m' : 'g'}"/>`).join('\n')}
${cmVals.map(v => `<path d="M${GRAPH.left},${cyLength(v)}L${GRAPH.right},${cyLength(v)}" class="g-m"/>`).join('\n')}
${lengthC.map((d, i) => i === 3 ? `<path d="${d}" class="p-m"/>` : `<path d="${d}" class="p"/>`).join('\n')}
${cmVals.map(v => {
  const y = cyLength(v);
  const show = v % 10 === 0;
  return `<text x="${GRAPH.left - 4}" y="${y + 2.5}" class="l" text-anchor="end">${v}</text>` +
    (show ? `<text x="${GRAPH.right + 4}" y="${y + 2.5}" class="l-sm" text-anchor="start">${Math.round(cmToInches(v))}</text>` : '');
}).join('\n')}
<text x="${GRAPH.left - 4}" y="${GRAPH.length.top - 14}" class="l-big" text-anchor="end">LENGTH</text>
<text x="${GRAPH.right + 4}" y="${GRAPH.length.top - 14}" class="l-sm" text-anchor="start">LENGTH</text>
<text x="${GRAPH.left - 4}" y="${GRAPH.length.bottom + 12}" class="l-sm" text-anchor="end">cm</text>
<text x="${GRAPH.right + 4}" y="${GRAPH.length.bottom + 12}" class="l-sm" text-anchor="start">in</text>

<line x1="${GRAPH.left}" y1="${GRAPH.weight.top - 18}" x2="${GRAPH.left}" y2="${GRAPH.weight.bottom}" stroke="${PINK}" stroke-width="0.8"/>
<line x1="${GRAPH.right}" y1="${GRAPH.weight.top - 18}" x2="${GRAPH.right}" y2="${GRAPH.weight.bottom}" stroke="${PINK}" stroke-width="0.8"/>
<path d="${weightGrid}" class="g"/>
${months.map((m, i) => `<path d="M${cx(m)},${GRAPH.weight.top}L${cx(m)},${GRAPH.weight.bottom}" class="${i % 2 === 0 ? 'g-m' : 'g'}"/>`).join('\n')}
${kgVals.map(v => `<path d="M${GRAPH.left},${cyWeight(v)}L${GRAPH.right},${cyWeight(v)}" class="g-m"/>`).join('\n')}
${weightC.map((d, i) => i === 3 ? `<path d="${d}" class="p-m"/>` : `<path d="${d}" class="p"/>`).join('\n')}
${kgVals.map(v => {
  const y = cyWeight(v);
  const show = v % 2 === 0;
  return `<text x="${GRAPH.left - 4}" y="${y + 2.5}" class="l" text-anchor="end">${v}</text>` +
    (show ? `<text x="${GRAPH.right + 4}" y="${y + 2.5}" class="l-sm" text-anchor="start">${Math.round(kgToLb(v))}</text>` : '');
}).join('\n')}
<text x="${GRAPH.left - 4}" y="${GRAPH.weight.top - 14}" class="l-big" text-anchor="end">WEIGHT</text>
<text x="${GRAPH.right + 4}" y="${GRAPH.weight.top - 14}" class="l-sm" text-anchor="start">WEIGHT</text>
<text x="${GRAPH.left - 4}" y="${GRAPH.weight.bottom + 12}" class="l-sm" text-anchor="end">kg</text>
<text x="${GRAPH.right + 4}" y="${GRAPH.weight.bottom + 12}" class="l-sm" text-anchor="start">lb</text>

${months.map((m, i) => {
  const x = cx(m);
  return `<text x="${x}" y="${GRAPH.weight.bottom + 22}" class="t-sm">${i === 0 ? 'Birth' : m}</text>`;
}).join('\n')}
<text x="${(GRAPH.left + GRAPH.right) / 2}" y="${GRAPH.weight.bottom + 34}" class="l-sm" text-anchor="middle">AGE (MONTHS)</text>

<line x1="${GRAPH.left}" y1="${GRAPH.weight.bottom}" x2="${GRAPH.right}" y2="${GRAPH.weight.bottom}" stroke="${PINK}" stroke-width="1.2"/>

<text x="20" y="${GRAPH.weight.bottom + 52}" class="l-sm" font-size="5.5">Mother's Stature _______</text>
<text x="180" y="${GRAPH.weight.bottom + 52}" class="l-sm" font-size="5.5">Father's Stature _______</text>
<text x="${GRAPH.left}" y="${GRAPH.weight.bottom + 68}" class="l-sm" font-size="5.5">Date _______ Age _______ Weight _______ Length _______ Head Circ. _______ Gestational Age _______ Weeks _______ Comment _______</text>
</svg>`;
}

export { cx, cyLength, cyWeight };
