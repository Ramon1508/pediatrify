import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface CalendarFocusTarget {
  date: string;
  time: string;
  appointmentId: string;
}

@Injectable({
  providedIn: 'root',
})
export class CalendarFocusService {
  private target = new BehaviorSubject<CalendarFocusTarget | null>(null);

  get target$(): Observable<CalendarFocusTarget | null> {
    return this.target.asObservable();
  }

  setFocus(target: CalendarFocusTarget): void {
    this.target.next(target);
  }

  peek(): CalendarFocusTarget | null {
    return this.target.getValue();
  }

  clear(): void {
    this.target.next(null);
  }
}