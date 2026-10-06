import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { map, Observable, of, shareReplay } from 'rxjs';
import {
  AvailabilityResponse, Constantes, CriteriosBusqueda, DetailsResponse, DetalleAlojamiento, Huespedes, Producto,
  Puntaje, ReviewsResponse, SearchResponse,
} from '../models/api.models';
import { API, BOOKER } from './api-base';

export type ExtraDetalle = 'description' | 'bundles' | 'facilities' | 'payment' | 'photos' | 'policies' | 'rooms';

/** Consumo de las rutas del contrato de catálogo (búsqueda, detalle, disponibilidad, reseñas, constantes). */
@Injectable({ providedIn: 'root' })
export class CatalogoService {
  private readonly http = inject(HttpClient);
  private constantes$?: Observable<Constantes>;

  /** Últimos criterios usados (se reutilizan en el detalle y al volver a la búsqueda). */
  readonly criterios = signal<CriteriosBusqueda | null>(null);

  buscar(c: CriteriosBusqueda, page?: string, rows = 10): Observable<SearchResponse> {
    const cuerpo = { booker: BOOKER, currency: 'USD', ...c, rows, ...(page ? { page } : {}) };
    return this.http.post<SearchResponse>(`${API}/search`, cuerpo);
  }

  detalles(ids: number[], extras: ExtraDetalle[] = []): Observable<DetalleAlojamiento[]> {
    if (!ids.length) return of([]);
    return this.http
      .post<DetailsResponse>(`${API}/details`, { accommodations: ids, extras, rows: Math.min(ids.length, 100) })
      .pipe(map((r) => r.data));
  }

  disponibilidad(codigo: number, checkin: string, checkout: string, guests: Huespedes): Observable<Producto[]> {
    return this.http
      .post<AvailabilityResponse>(`${API}/availability`, { accommodation: codigo, booker: BOOKER, checkin, checkout, guests, currency: 'USD' })
      .pipe(map((r) => r.data.products));
  }

  resenas(codigo: number, page?: string): Observable<ReviewsResponse> {
    return this.http.post<ReviewsResponse>(`${API}/reviews`, { accommodations: [codigo], rows: 5, ...(page ? { page } : {}) });
  }

  puntajes(codigo: number): Observable<Puntaje | null> {
    return this.http
      .post<{ data: Puntaje[] }>(`${API}/reviews/scores`, { accommodations: [codigo] })
      .pipe(map((r) => r.data[0] ?? null));
  }

  /** Catálogos (cacheados durante la sesión). */
  constantes(): Observable<Constantes> {
    this.constantes$ ??= this.http.post<{ data: Constantes }>(`${API}/constants`, {}).pipe(
      map((r) => r.data),
      shareReplay(1),
    );
    return this.constantes$;
  }
}
