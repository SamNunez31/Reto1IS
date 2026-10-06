import { Injectable } from '@angular/core';

/** Límites de Ecuador (incluye Galápagos): los mismos que valida el backend (LATITUD_EC / LONGITUD_EC). */
export const LIMITES_EC = { latMin: -5, latMax: 2, lonMin: -93, lonMax: -75 } as const;

export const dentroDeEcuador = (lat: number, lon: number): boolean =>
  lat >= LIMITES_EC.latMin && lat <= LIMITES_EC.latMax && lon >= LIMITES_EC.lonMin && lon <= LIMITES_EC.lonMax;

export interface Sugerencia {
  etiqueta: string;
  lat: number;
  lon: number;
}

/**
 * Búsqueda de direcciones con OpenStreetMap Nominatim (https://nominatim.org).
 * Política de uso: máximo 1 petición por segundo, sin autocompletado agresivo (el componente espera 800 ms
 * entre pulsaciones) y con atribución "© OpenStreetMap contributors" visible en el mapa.
 */
@Injectable({ providedIn: 'root' })
export class GeocodificacionService {
  private static readonly URL = 'https://nominatim.openstreetmap.org/search';
  private static readonly INTERVALO_MS = 1000;
  private ultima = 0;
  private cola: Promise<unknown> = Promise.resolve();

  /** Busca direcciones en Ecuador. Las peticiones se encolan para no superar 1 por segundo. */
  buscar(texto: string, aborto?: AbortSignal): Promise<Sugerencia[]> {
    const tarea = this.cola.then(async () => {
      const espera = this.ultima + GeocodificacionService.INTERVALO_MS - Date.now();
      if (espera > 0) await new Promise((r) => setTimeout(r, espera));
      if (aborto?.aborted) return [];
      this.ultima = Date.now();
      const params = new URLSearchParams({
        q: texto, format: 'jsonv2', countrycodes: 'ec', 'accept-language': 'es', limit: '5',
        viewbox: `${LIMITES_EC.lonMin},${LIMITES_EC.latMax},${LIMITES_EC.lonMax},${LIMITES_EC.latMin}`, bounded: '1',
      });
      const r = await fetch(`${GeocodificacionService.URL}?${params}`, { signal: aborto, headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error(`Nominatim respondió ${r.status}`);
      const filas = (await r.json()) as { display_name: string; lat: string; lon: string }[];
      return filas
        .map((f) => ({ etiqueta: f.display_name, lat: Number(f.lat), lon: Number(f.lon) }))
        .filter((s) => dentroDeEcuador(s.lat, s.lon));
    });
    this.cola = tarea.catch(() => undefined);
    return tarea;
  }
}
