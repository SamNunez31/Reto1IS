import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { API } from '../services/api-base';
import { AuthService } from '../services/auth.service';
import { DispositivoService } from '../services/dispositivo.service';

/**
 * - Agrega Authorization (Bearer) y X-Device-Fingerprint a las llamadas al API.
 * - 401 -> cierra sesión y lleva al login (salvo en el propio login).
 * - 403 -> pantalla de acceso denegado.
 */
export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(API)) return next(req);
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token();
  const headers: Record<string, string> = { 'X-Device-Fingerprint': inject(DispositivoService).huella() };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  return next(req.clone({ setHeaders: headers })).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        if (err.status === 401 && !req.url.includes('/auth/')) auth.logout(router.url);
        if (err.status === 403) {
          router.navigate(['/acceso-denegado'], { state: { detalle: (err.error as { detail?: string } | null)?.detail } });
        }
      }
      return throwError(() => err);
    }),
  );
};
