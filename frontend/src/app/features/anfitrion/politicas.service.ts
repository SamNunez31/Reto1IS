import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of, shareReplay } from 'rxjs';
import { DetalleAlojamiento, PoliticaCancelacion } from '../../core/models/api.models';
import { API } from '../../core/services/api-base';

export interface Tramo { hours_before: number; penalty_percent: number }

/**
 * Tramos REALES de cada política (horas de anticipación → % de penalidad), tal como los aplica la BD
 * (tabla politica_cancelacion_regla). /constants solo trae nombre y descripción; los tramos los expone
 * /details con extras=['policies'] para las políticas que usa algún alojamiento publicado.
 * Si una política no aparece ahí, la pantalla muestra solo su descripción (no se inventan cifras).
 */
@Injectable({ providedIn: 'root' })
export class PoliticasService {
  private readonly http = inject(HttpClient);
  private cache$?: Observable<Record<string, Tramo[]>>;

  tramos(): Observable<Record<string, Tramo[]>> {
    this.cache$ ??= this.http
      .post<{ data: DetalleAlojamiento[] }>(`${API}/details`, { extras: ['policies'], rows: 100 })
      .pipe(
        map((r) => {
          const porNombre: Record<string, Tramo[]> = {};
          for (const a of r.data) {
            const p = a.policies?.cancellation as PoliticaCancelacion | undefined;
            if (p?.name && p.rules?.length && !porNombre[p.name]) {
              porNombre[p.name] = [...p.rules].sort((x, y) => y.hours_before - x.hours_before);
            }
          }
          return porNombre;
        }),
        catchError(() => of({})),
        shareReplay(1),
      );
    return this.cache$;
  }
}

/** "48 h" o "5 días (120 h)" */
export function horasHumanas(h: number): string {
  if (h >= 72 && h % 24 === 0) return `${h / 24} días (${h} h)`;
  return `${h} h`;
}

/** Convierte los tramos en líneas legibles, de la más anticipada a la más tardía. */
export function lineasTramos(tramos: Tramo[]): { cuando: string; efecto: string; pct: number }[] {
  const efecto = (pct: number) => (pct === 0 ? 'Sin penalidad: se devuelve todo el hospedaje' : pct === 100 ? 'Se cobra el 100 % del hospedaje (no hay reembolso del hospedaje)' : `Se cobra el ${pct} % del hospedaje`);
  if (tramos.length === 1 && tramos[0].hours_before === 0) {
    return [{ cuando: 'En cualquier momento', efecto: efecto(tramos[0].penalty_percent), pct: tramos[0].penalty_percent }];
  }
  return tramos.map((t, i) => {
    const anterior = tramos[i - 1];
    let cuando: string;
    // La BD aplica el tramo con mayor "horas mínimas" que se cumpla (v_cancelacion_liquidacion)
    if (i === 0) cuando = `Con ${horasHumanas(t.hours_before)} o más de anticipación`;
    else if (t.hours_before === 0) cuando = `Con menos de ${horasHumanas(anterior.hours_before)}`;
    else cuando = `Entre ${horasHumanas(anterior.hours_before)} y ${horasHumanas(t.hours_before)} antes`;
    return { cuando, efecto: efecto(t.penalty_percent), pct: t.penalty_percent };
  });
}
