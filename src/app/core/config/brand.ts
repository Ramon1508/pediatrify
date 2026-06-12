import { InjectionToken } from '@angular/core';

export const BRAND_NAME = new InjectionToken<string>('brand_name', {
  providedIn: 'root',
  factory: () => 'Lilcare',
});

export const DEFAULT_LOGO_URL = new InjectionToken<string>('default_logo_url', {
  providedIn: 'root',
  factory: () => '/images/Logo.jpg',
});
