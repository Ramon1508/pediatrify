import { Injectable } from '@angular/core';
import { NativeDateAdapter } from '@angular/material/core';

@Injectable()
export class SpanishDateAdapter extends NativeDateAdapter {
  override getFirstDayOfWeek(): number {
    return 0;
  }

  /**
   * Corrige el parseo de fechas 'YYYY-MM-DD': `NativeDateAdapter.parse` usa
   * `new Date(Date.parse(value))`, que interpreta el string como medianoche UTC
   * y en zonas negativas (GMT-7) muestra el día ANTERIOR. Aquí se interpreta a
   * medianoche LOCAL. (La mayoría de prefills ya mandan un `Date` local vía
   * `dateStringToLocalDate`, pero esto asegura el caso de strings.)
   */
  override parse(value: any): Date | null {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    return super.parse(value);
  }
}

