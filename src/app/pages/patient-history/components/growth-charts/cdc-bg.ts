/**
 * Calibración de la gráfica CDC Birth-to-36-months (612×792px).
 *
 * Cada tabla mapea valores clínicos → coordenada Y (SVG, 0=arriba, +↓).
 * Los valores intermedios se obtienen por interpolación lineal entre marcas.
 *
 * Medido directamente sobre la imagen oficial CDC por ChatGPT.
 */

const MONTH_X: Record<number, number> = {
  0: 93, 3: 126, 6: 160, 9: 193, 12: 227,
  15: 260, 18: 294, 21: 327, 24: 361,
  27: 394, 30: 428, 33: 461, 36: 495,
};

const LENGTH_Y: Record<number, number> = {
  40: 465, 45: 429, 50: 394, 55: 358, 60: 322, 65: 287,
  70: 252, 75: 217, 80: 182, 85: 147, 90: 112, 95: 77, 100: 42,
};

const WEIGHT_Y: Record<number, number> = {
  2: 704, 3: 664, 4: 624, 5: 584, 6: 544, 7: 504, 8: 464,
  9: 424, 10: 384, 11: 344, 12: 304, 13: 264, 14: 224,
  15: 184, 16: 144, 17: 104, 18: 64,
};

function interpolate(value: number, table: Record<number, number>): number {
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
  if (value <= keys[0]) return table[keys[0]];
  if (value >= keys[keys.length - 1]) return table[keys[keys.length - 1]];

  for (let i = 0; i < keys.length - 1; i++) {
    if (value >= keys[i] && value <= keys[i + 1]) {
      const t = (value - keys[i]) / (keys[i + 1] - keys[i]);
      return table[keys[i]] + t * (table[keys[i + 1]] - table[keys[i]]);
    }
  }

  return table[keys[keys.length - 1]];
}

export function cx(month: number): number {
  return interpolate(month, MONTH_X);
}

export function cyLength(cm: number): number {
  return interpolate(cm, LENGTH_Y);
}

export function cyWeight(kg: number): number {
  return interpolate(kg, WEIGHT_Y);
}

export function getImageSrc(sex: 'M' | 'F'): string {
  return sex === 'M' ? 'cdc-boys.png' : 'cdc-girls.png';
}

export const CDC_VIEWBOX = '0 0 612 792';
