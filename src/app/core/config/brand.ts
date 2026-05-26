import { InjectionToken } from '@angular/core';

export const BRAND_NAME = new InjectionToken<string>('brand_name', {
  providedIn: 'root',
  factory: () => 'Lilcare',
});
