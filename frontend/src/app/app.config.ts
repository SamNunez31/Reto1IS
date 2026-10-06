import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import localeEs from '@angular/common/locales/es-EC';
import { ApplicationConfig, ErrorHandler, inject, LOCALE_ID, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { apiInterceptor } from './core/interceptors/api.interceptor';
import { observabilidadInterceptor } from './core/interceptors/observabilidad.interceptor';
import { ObservabilidadErrorHandler, ObservabilidadService } from './core/services/observabilidad.service';

registerLocaleData(localeEs);

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    // La observabilidad va primero para medir la llamada completa (incluidos los demás interceptores)
    provideHttpClient(withInterceptors([observabilidadInterceptor, apiInterceptor])),
    { provide: LOCALE_ID, useValue: 'es-EC' },
    // Observabilidad local del navegador (sin backend ni envío de datos)
    { provide: ErrorHandler, useClass: ObservabilidadErrorHandler },
    provideAppInitializer(() => inject(ObservabilidadService).iniciar()),
  ],
};
