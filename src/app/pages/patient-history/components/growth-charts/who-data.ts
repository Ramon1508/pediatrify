const Z_VALUES: Record<string, number> = {
  p5: -1.645, p10: -1.282, p25: -0.674, p50: 0, p75: 0.674, p90: 1.282, p95: 1.645,
};

interface LmsNode { month: number; L: number; M: number; S: number; }

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

function buildPercentileCurves(nodes: LmsNode[], maxMonths: number) {
  const keys = Object.keys(Z_VALUES);
  const result: any[] = [];
  for (let m = 0; m <= maxMonths; m++) {
    let i = 0;
    while (i < nodes.length - 2 && nodes[i + 1].month < m) i++;
    const a = nodes[i], b = nodes[i + 1];
    const t = a.month === b.month ? 0 : (m - a.month) / (b.month - a.month);
    const L = lerp(a.L, b.L, t), M = lerp(a.M, b.M, t), S = lerp(a.S, b.S, t);
    const point: any = { month: m };
    keys.forEach(k => { point[k] = M * Math.pow(1 + L * S * Z_VALUES[k], 1 / L); });
    result.push(point);
  }
  return result as { month: number; p5: number; p10: number; p25: number; p50: number; p75: number; p90: number; p95: number }[];
}

const CDC_LENGTH_BOY: LmsNode[] = [
  { month: 0,  L: 1, M: 50.1, S: 0.039 }, { month: 1,  L: 1, M: 54.3, S: 0.038 },
  { month: 2,  L: 1, M: 57.6, S: 0.037 }, { month: 3,  L: 1, M: 60.4, S: 0.036 },
  { month: 4,  L: 1, M: 62.9, S: 0.036 }, { month: 5,  L: 1, M: 65.1, S: 0.036 },
  { month: 6,  L: 1, M: 67.0, S: 0.035 }, { month: 9,  L: 1, M: 71.5, S: 0.035 },
  { month: 12, L: 1, M: 75.4, S: 0.034 }, { month: 15, L: 1, M: 78.7, S: 0.034 },
  { month: 18, L: 1, M: 81.6, S: 0.033 }, { month: 21, L: 1, M: 84.3, S: 0.033 },
  { month: 24, L: 1, M: 86.8, S: 0.032 }, { month: 27, L: 1, M: 89.0, S: 0.032 },
  { month: 30, L: 1, M: 91.1, S: 0.032 }, { month: 33, L: 1, M: 93.1, S: 0.032 },
  { month: 36, L: 1, M: 95.0, S: 0.031 },
];

const CDC_LENGTH_GIRL: LmsNode[] = [
  { month: 0,  L: 1, M: 49.3, S: 0.039 }, { month: 1,  L: 1, M: 53.3, S: 0.038 },
  { month: 2,  L: 1, M: 56.5, S: 0.037 }, { month: 3,  L: 1, M: 59.3, S: 0.037 },
  { month: 4,  L: 1, M: 61.8, S: 0.036 }, { month: 5,  L: 1, M: 64.0, S: 0.036 },
  { month: 6,  L: 1, M: 65.9, S: 0.035 }, { month: 9,  L: 1, M: 70.3, S: 0.035 },
  { month: 12, L: 1, M: 74.3, S: 0.034 }, { month: 15, L: 1, M: 77.6, S: 0.034 },
  { month: 18, L: 1, M: 80.6, S: 0.033 }, { month: 21, L: 1, M: 83.3, S: 0.033 },
  { month: 24, L: 1, M: 85.8, S: 0.032 }, { month: 27, L: 1, M: 88.0, S: 0.032 },
  { month: 30, L: 1, M: 90.1, S: 0.032 }, { month: 33, L: 1, M: 92.1, S: 0.032 },
  { month: 36, L: 1, M: 94.0, S: 0.031 },
];

const CDC_WEIGHT_BOY: LmsNode[] = [
  { month: 0,  L: 0.35, M: 3.48, S: 0.141 }, { month: 1,  L: 0.30, M: 4.50, S: 0.133 },
  { month: 2,  L: 0.24, M: 5.38, S: 0.125 }, { month: 3,  L: 0.16, M: 6.17, S: 0.118 },
  { month: 4,  L: 0.12, M: 6.86, S: 0.113 }, { month: 5,  L: 0.09, M: 7.45, S: 0.109 },
  { month: 6,  L: 0.07, M: 7.96, S: 0.106 }, { month: 9,  L: 0.04, M: 9.22, S: 0.102 },
  { month: 12, L: 0.02, M: 10.23, S: 0.100 }, { month: 15, L: 0.02, M: 11.10, S: 0.099 },
  { month: 18, L: 0.02, M: 11.87, S: 0.099 }, { month: 21, L: 0.03, M: 12.57, S: 0.099 },
  { month: 24, L: 0.03, M: 13.21, S: 0.099 }, { month: 27, L: 0.04, M: 13.81, S: 0.100 },
  { month: 30, L: 0.05, M: 14.38, S: 0.100 }, { month: 33, L: 0.07, M: 14.92, S: 0.101 },
  { month: 36, L: 0.09, M: 15.44, S: 0.102 },
];

const CDC_WEIGHT_GIRL: LmsNode[] = [
  { month: 0,  L: 0.38, M: 3.35, S: 0.142 }, { month: 1,  L: 0.30, M: 4.27, S: 0.134 },
  { month: 2,  L: 0.22, M: 5.03, S: 0.126 }, { month: 3,  L: 0.15, M: 5.73, S: 0.119 },
  { month: 4,  L: 0.11, M: 6.35, S: 0.113 }, { month: 5,  L: 0.08, M: 6.90, S: 0.109 },
  { month: 6,  L: 0.06, M: 7.39, S: 0.106 }, { month: 9,  L: 0.03, M: 8.76, S: 0.102 },
  { month: 12, L: 0.02, M: 9.69, S: 0.100 }, { month: 15, L: 0.02, M: 10.50, S: 0.099 },
  { month: 18, L: 0.02, M: 11.22, S: 0.099 }, { month: 21, L: 0.03, M: 11.87, S: 0.099 },
  { month: 24, L: 0.03, M: 12.46, S: 0.099 }, { month: 27, L: 0.04, M: 13.01, S: 0.100 },
  { month: 30, L: 0.05, M: 13.53, S: 0.100 }, { month: 33, L: 0.07, M: 14.02, S: 0.101 },
  { month: 36, L: 0.09, M: 14.50, S: 0.102 },
];

const WHO_HC_BOY: LmsNode[] = [
  { month: 0,  L: 1, M: 34.46, S: 0.0375 }, { month: 1,  L: 1, M: 37.27, S: 0.0347 },
  { month: 2,  L: 1, M: 39.26, S: 0.0336 }, { month: 3,  L: 1, M: 40.53, S: 0.0323 },
  { month: 4,  L: 1, M: 41.64, S: 0.0314 }, { month: 5,  L: 1, M: 42.47, S: 0.0307 },
  { month: 6,  L: 1, M: 43.26, S: 0.0300 }, { month: 9,  L: 1, M: 44.70, S: 0.0289 },
  { month: 12, L: 1, M: 45.77, S: 0.0283 }, { month: 15, L: 1, M: 46.50, S: 0.0277 },
  { month: 18, L: 1, M: 47.07, S: 0.0273 }, { month: 24, L: 1, M: 47.90, S: 0.0267 },
  { month: 30, L: 1, M: 48.47, S: 0.0263 }, { month: 36, L: 1, M: 48.86, S: 0.0260 },
];

const WHO_HC_GIRL: LmsNode[] = [
  { month: 0,  L: 1, M: 33.88, S: 0.0379 }, { month: 1,  L: 1, M: 36.55, S: 0.0352 },
  { month: 2,  L: 1, M: 38.25, S: 0.0341 }, { month: 3,  L: 1, M: 39.40, S: 0.0328 },
  { month: 4,  L: 1, M: 40.34, S: 0.0319 }, { month: 5,  L: 1, M: 41.09, S: 0.0312 },
  { month: 6,  L: 1, M: 41.67, S: 0.0305 }, { month: 9,  L: 1, M: 43.00, S: 0.0294 },
  { month: 12, L: 1, M: 44.07, S: 0.0289 }, { month: 15, L: 1, M: 44.83, S: 0.0284 },
  { month: 18, L: 1, M: 45.41, S: 0.0280 }, { month: 24, L: 1, M: 46.24, S: 0.0275 },
  { month: 30, L: 1, M: 46.79, S: 0.0271 }, { month: 36, L: 1, M: 47.19, S: 0.0268 },
];

const WHO_BMI_BOY: LmsNode[] = [
  { month: 0,  L: -0.20, M: 13.41, S: 0.091 }, { month: 3,  L: -0.28, M: 15.60, S: 0.087 },
  { month: 6,  L: -0.34, M: 16.30, S: 0.083 }, { month: 9,  L: -0.38, M: 16.34, S: 0.081 },
  { month: 12, L: -0.41, M: 16.15, S: 0.079 }, { month: 18, L: -0.43, M: 15.64, S: 0.077 },
  { month: 24, L: -0.44, M: 15.22, S: 0.075 }, { month: 30, L: -0.44, M: 14.91, S: 0.075 },
  { month: 36, L: -0.44, M: 14.71, S: 0.074 },
];

const WHO_BMI_GIRL: LmsNode[] = [
  { month: 0,  L: -0.18, M: 13.17, S: 0.092 }, { month: 3,  L: -0.26, M: 14.90, S: 0.087 },
  { month: 6,  L: -0.31, M: 15.54, S: 0.083 }, { month: 9,  L: -0.35, M: 15.75, S: 0.081 },
  { month: 12, L: -0.38, M: 15.61, S: 0.080 }, { month: 18, L: -0.40, M: 15.10, S: 0.078 },
  { month: 24, L: -0.41, M: 14.69, S: 0.077 }, { month: 30, L: -0.41, M: 14.42, S: 0.076 },
  { month: 36, L: -0.41, M: 14.23, S: 0.076 },
];

export type GrowthIndicator = 'cdcLength' | 'cdcWeight' | 'headCircumference' | 'bmi';
export type PatientSexKey = 'M' | 'F';

const DATA: Record<string, LmsNode[]> = {
  cdcLength_BOY: CDC_LENGTH_BOY, cdcLength_GIRL: CDC_LENGTH_GIRL,
  cdcWeight_BOY: CDC_WEIGHT_BOY, cdcWeight_GIRL: CDC_WEIGHT_GIRL,
  headCircumference_BOY: WHO_HC_BOY, headCircumference_GIRL: WHO_HC_GIRL,
  bmi_BOY: WHO_BMI_BOY, bmi_GIRL: WHO_BMI_GIRL,
};

const CACHE = new Map<string, ReturnType<typeof buildPercentileCurves>>();

export function getWhoCurves(indicator: GrowthIndicator, sex: PatientSexKey, maxMonths = 36) {
  const key = `${indicator}_${sex}_${maxMonths}`;
  if (CACHE.has(key)) return CACHE.get(key)!;
  const nodes = DATA[`${indicator}_${sex}`];
  if (!nodes) { const r: any[] = []; CACHE.set(key, r); return r; }
  const result = buildPercentileCurves(nodes, maxMonths);
  CACHE.set(key, result);
  return result;
}

export function cmToInches(cm: number): number { return cm / 2.54; }
export function kgToLb(kg: number): number { return kg * 2.20462; }
