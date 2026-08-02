/**
 * Calibración de las gráficas CDC / Head Circumference Birth-to-36-months.
 *
 * CDC — calibrado con el wizard (R² = 1):
 *   Niñas (612×792 viewBox) / Niños (720×960 viewBox)
 *
 * Head Circumference — constantes estimadas; calibrar con el wizard.
 *   Ambos sexos (720×960 viewBox, chart clip 630×904):
 *     cx ≈ chartStartX + month × 17.5
 *     cy ≈ 928 + cm × -40.818
 */

/* ═══════════════════════════════════════════
 *  CDC PESO Y TALLA
 * ═══════════════════════════════════════════ */

/* ── Girls ── */
const GIRLS_CX_A = 109.6514;
const GIRLS_CX_B = 10.6336;
const GIRLS_CY_LENGTH_A = 732.22;
const GIRLS_CY_LENGTH_B = -5.9885;
const GIRLS_CY_WEIGHT_A = 761.6834;
const GIRLS_CY_WEIGHT_B = -29.9159;

/* ── Boys ── */
const BOYS_CX_A = 123.7576;
const BOYS_CX_B = 13.0366;
const BOYS_CY_LENGTH_A = 875.8708;
const BOYS_CY_LENGTH_B = -7.348;
const BOYS_CY_WEIGHT_A = 912.4124;
const BOYS_CY_WEIGHT_B = -36.6981;

export function cx(month: number, sex: 'M' | 'F'): number {
  if (sex === 'F') return GIRLS_CX_A + month * GIRLS_CX_B;
  return BOYS_CX_A + month * BOYS_CX_B;
}

export function cyLength(cm: number, sex: 'M' | 'F'): number {
  if (sex === 'F') return GIRLS_CY_LENGTH_A + cm * GIRLS_CY_LENGTH_B;
  return BOYS_CY_LENGTH_A + cm * BOYS_CY_LENGTH_B;
}

export function cyWeight(kg: number, sex: 'M' | 'F'): number {
  if (sex === 'F') return GIRLS_CY_WEIGHT_A + kg * GIRLS_CY_WEIGHT_B;
  return BOYS_CY_WEIGHT_A + kg * BOYS_CY_WEIGHT_B;
}

export function getCdcImageSrc(sex: 'M' | 'F'): string {
  return sex === 'M' ? 'graphs/cdc-boys.svg' : 'graphs/cdc-girls.svg';
}

export function getCdcViewBox(sex: 'M' | 'F'): string {
  return sex === 'M' ? '0 0 720 960' : '0 0 612 792';
}

/* ═══════════════════════════════════════════
 *  HEAD CIRCUMFERENCE (Perímetro cefálico)
 *  — Sección superior: perímetro vs edad
 * ═══════════════════════════════════════════
 *  Ambos sexos: 720×960 viewBox, chart clip 630×904
 *
 *  Niñas — calibrado:
 *    cx  = 133.9165  + month × 12.8141    (R² = 1, n = 13)
 *    cy  = 1052.3578 + cm    × -17.5241   (R² = 0.9999, n = 12)
 *
 *  Niños — calibrado:
 *    cx  = 125.3052  + month × 12.8217    (R² = 0.9999, n = 13)
 *    cy  = 1052.1694 + cm    × -17.5206   (R² = 1, n = 12)
 */

/* ── Girls ── */
const HC_GIRLS_CX_A = 133.9165;
const HC_GIRLS_CX_B = 12.8141;
const HC_GIRLS_CY_A = 1052.3578;
const HC_GIRLS_CY_B = -17.5241;

/* ── Boys ── */
const HC_BOYS_CX_A = 125.3052;
const HC_BOYS_CX_B = 12.8217;
const HC_BOYS_CY_A = 1052.1694;
const HC_BOYS_CY_B = -17.5206;

/* ═══════════════════════════════════════════
 *  HEAD CIRCUMFERENCE — Sección inferior:
 *  Weight-for-Length (peso vs talla)
 * ═══════════════════════════════════════════
 *
 *  Niñas — calibrado:
 *    lx = -212.9843 + cm × 7.7023     (R² = 1, n = 12)
 *    ly = 826.8186  + kg × -21.0024   (R² = 1, n = 12)
 *
 *  Niños — calibrado:
 *    lx = -220.8371 + cm × 7.7001     (R² = 1, n = 12)
 *    ly = 826.5128  + kg × -20.9999   (R² = 1, n = 12)
 */

/* ── Girls ── */
const HC_GIRLS_LX_A = -212.9843;
const HC_GIRLS_LX_B = 7.7023;
const HC_GIRLS_LY_A = 826.8186;
const HC_GIRLS_LY_B = -21.0024;

/* ── Boys ── */
const HC_BOYS_LX_A = -220.8371;
const HC_BOYS_LX_B = 7.7001;
const HC_BOYS_LY_A = 826.5128;
const HC_BOYS_LY_B = -20.9999;

export function hcLx(cm: number, sex: 'M' | 'F'): number {
  if (sex === 'F') return HC_GIRLS_LX_A + cm * HC_GIRLS_LX_B;
  return HC_BOYS_LX_A + cm * HC_BOYS_LX_B;
}

export function hcLy(kg: number, sex: 'M' | 'F'): number {
  if (sex === 'F') return HC_GIRLS_LY_A + kg * HC_GIRLS_LY_B;
  return HC_BOYS_LY_A + kg * HC_BOYS_LY_B;
}

export function hcCx(month: number, sex: 'M' | 'F'): number {
  if (sex === 'F') return HC_GIRLS_CX_A + month * HC_GIRLS_CX_B;
  return HC_BOYS_CX_A + month * HC_BOYS_CX_B;
}

export function hcCy(cm: number, sex: 'M' | 'F'): number {
  if (sex === 'F') return HC_GIRLS_CY_A + cm * HC_GIRLS_CY_B;
  return HC_BOYS_CY_A + cm * HC_BOYS_CY_B;
}

export function getHcImageSrc(sex: 'M' | 'F'): string {
  return sex === 'M' ? 'graphs/hcirc-boys.svg' : 'graphs/hcirc-girls.svg';
}

export function getHcViewBox(): string {
  return '0 0 720 960';
}

/* ═══════════════════════════════════════════
 *  2–20 AÑOS — Estatura y peso por edad
 * ═══════════════════════════════════════════
 *  Ambos sexos: 816×1056 viewBox
 *  Eje Y: altura 195 cm máx, peso 110 kg máx
 *  Niñas y niños — calibrado completo (X, altura, peso)
 */

/* ── Girls (calibrado completo) ── */
const Y2_GIRLS_CX_A = 88.2822;
const Y2_GIRLS_CX_B = 28.5708;
const Y2_GIRLS_CY_HEIGHT_A = 1180.2508;
const Y2_GIRLS_CY_HEIGHT_B = -5.3718;
const Y2_GIRLS_CY_WEIGHT_A = 992.2598;
const Y2_GIRLS_CY_WEIGHT_B = -5.3756;

/* ── Boys (calibrado completo) ── */
const Y2_BOYS_CX_A = 88.1005;
const Y2_BOYS_CX_B = 28.5844;
const Y2_BOYS_CY_HEIGHT_A = 1180.0062;
const Y2_BOYS_CY_HEIGHT_B = -5.3711;
const Y2_BOYS_CY_WEIGHT_A = 992.6444;
const Y2_BOYS_CY_WEIGHT_B = -5.375;

export function y2Cx(years: number, sex: 'M' | 'F'): number {
  if (sex === 'F') return Y2_GIRLS_CX_A + years * Y2_GIRLS_CX_B;
  return Y2_BOYS_CX_A + years * Y2_BOYS_CX_B;
}

export function y2CyHeight(cm: number, sex: 'M' | 'F'): number {
  if (sex === 'F') return Y2_GIRLS_CY_HEIGHT_A + cm * Y2_GIRLS_CY_HEIGHT_B;
  return Y2_BOYS_CY_HEIGHT_A + cm * Y2_BOYS_CY_HEIGHT_B;
}

export function y2CyWeight(kg: number, sex: 'M' | 'F'): number {
  if (sex === 'F') return Y2_GIRLS_CY_WEIGHT_A + kg * Y2_GIRLS_CY_WEIGHT_B;
  return Y2_BOYS_CY_WEIGHT_A + kg * Y2_BOYS_CY_WEIGHT_B;
}

export function getY2ImageSrc(sex: 'M' | 'F'): string {
  return sex === 'M' ? 'graphs/2-20y-boys.svg' : 'graphs/2-20y-girls.svg';
}

export function getY2ViewBox(): string {
  return '0 0 816 1056';
}

/* ═══════════════════════════════════════════
 *  IMC (BMI) — Índice de Masa Corporal
 * ═══════════════════════════════════════════
 *  Ambos sexos: 816×1056 viewBox
 *  Eje X (años) no lineal — lookup table + interpolación.
 *  Niñas y niños — calibrado completo (X lookup, Y).
 */

/* ── Girls (completo) ── */
const BMI_GIRLS_X: [number, number][] = [
  [2, 108.66], [3, 120.76], [4, 133.47], [5, 143.76], [6, 154.65], [7, 167.36],
  [8, 305.95], [9, 315.64], [10, 369.50], [11, 388.86], [12, 408.23], [13, 428.81],
  [14, 447.57], [15, 467.54], [16, 620.66], [17, 640.63], [18, 659.39], [19, 678.75],
  [20, 696.91],
];

const BMI_GIRLS_CY_A = 1224.2085;
const BMI_GIRLS_CY_B = -30.254;

/* ── Boys (calibrado completo) ── */
const BMI_BOYS_X: [number, number][] = [
  [2, 108.66], [3, 120.76], [4, 132.26], [5, 144.36], [6, 156.47], [7, 167.36],
  [8, 305.35], [9, 316.24], [10, 370.71], [11, 388.86], [12, 408.84], [13, 428.81],
  [14, 446.96], [15, 466.94], [16, 619.45], [17, 640.63], [18, 657.57], [19, 677.54],
  [20, 696.91],
];

const BMI_BOYS_CY_A = 1223.8319;
const BMI_BOYS_CY_B = -30.2572;

function interpolate(x: number, table: [number, number][]): number {
  if (x <= table[0][0]) return table[0][1];
  if (x >= table[table.length - 1][0]) return table[table.length - 1][1];
  for (let i = 1; i < table.length; i++) {
    if (x <= table[i][0]) {
      const t = (x - table[i - 1][0]) / (table[i][0] - table[i - 1][0]);
      return table[i - 1][1] + t * (table[i][1] - table[i - 1][1]);
    }
  }
  return table[table.length - 1][1];
}

export function bmiCx(years: number, sex: 'M' | 'F'): number {
  if (sex === 'F') return interpolate(years, BMI_GIRLS_X);
  return interpolate(years, BMI_BOYS_X);
}

export function bmiCy(bmi: number, sex: 'M' | 'F'): number {
  if (sex === 'F') return BMI_GIRLS_CY_A + bmi * BMI_GIRLS_CY_B;
  return BMI_BOYS_CY_A + bmi * BMI_BOYS_CY_B;
}

export function getBmiImageSrc(sex: 'M' | 'F'): string {
  return sex === 'M' ? 'graphs/bmi-boys.svg' : 'graphs/bmi-girls.svg';
}

export function getBmiViewBox(): string {
  return '0 0 816 1056';
}
