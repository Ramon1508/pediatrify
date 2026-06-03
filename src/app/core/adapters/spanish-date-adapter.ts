import { Injectable } from '@angular/core';
import { NativeDateAdapter } from '@angular/material/core';

@Injectable()
export class SpanishDateAdapter extends NativeDateAdapter {
  override getFirstDayOfWeek(): number {
    return 0;
  }
}
