import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { API } from '../services/api-base';
import { ObservabilidadService } from '../services/observabilidad.service';

/**
 * Mide cada llamada al API (local, sin enviar nada): método, ruta con patrón (sin IDs), estado y duración en ms.
 * No lee cuerpos, cabeceras ni tokens. Va primero en la cadena para medir también a los demás interceptores.
 */
export const observabilidadInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(API)) return next(req);
  const obs = inject(ObservabilidadService);
  const inicio = performance.now();
  return next(req).pipe(
    tap({
      next: (ev) => {
        if (ev instanceof HttpResponse) obs.registrarApi(req.method, req.url, ev.status, performance.now() - inicio);
      },
      error: (err: unknown) => {
        obs.registrarApi(req.method, req.url, err instanceof HttpErrorResponse ? err.status : 0, performance.now() - inicio);
      },
    }),
  );
};
