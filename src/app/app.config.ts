import { ApplicationConfig, provideBrowserGlobalErrorListeners, APP_INITIALIZER } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter } from '@angular/router';
import { provideNativeDateAdapter, MAT_DATE_LOCALE, DateAdapter } from '@angular/material/core';
import { MatIconRegistry } from '@angular/material/icon';

import { routes } from './app.routes';
import { SpanishDateAdapter } from './core/adapters/spanish-date-adapter';

function configureIconFont(iconRegistry: MatIconRegistry): () => void {
  iconRegistry.setDefaultFontSetClass('material-icons-outlined');
  return () => undefined;
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideNativeDateAdapter(),
    { provide: MAT_DATE_LOCALE, useValue: 'es-MX' },
    { provide: DateAdapter, useClass: SpanishDateAdapter },
    {
      provide: APP_INITIALIZER,
      useFactory: configureIconFont,
      deps: [MatIconRegistry],
      multi: true,
    },
    provideRouter(routes),
    provideAnimationsAsync(),
  ],
};
