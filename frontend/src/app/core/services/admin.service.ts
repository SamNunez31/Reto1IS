import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { Listado, RespuestaApi } from '../models/api.models';
import { API } from './api-base';

export type Fila = Record<string, string | number | boolean | null | object>;

export interface Indicadores {
  usuarios_activos: number;
  alojamientos_publicados: number;
  alojamientos_suspendidos: number;
  reservas_confirmadas: number;
  solicitudes_pendientes: number;
  reservas_canceladas: number;
  volumen_reservado: number;
}

export interface Catalogos {
  tipos: { id: number; nombre: string }[];
  amenidades: { id: number; nombre: string; categoria: string }[];
  politicas: { id: number; nombre: string; descripcion: string }[];
  ciudades: { id: number; provincia: string; nombre: string }[];
}

const datos = <T>(o: Observable<RespuestaApi<T>>) => o.pipe(map((r) => r.data));
const paginacion = (limit: number, offset: number, extra: Record<string, string> = {}) => {
  let p = new HttpParams().set('limit', limit).set('offset', offset);
  for (const [k, v] of Object.entries(extra)) if (v) p = p.set(k, v);
  return p;
};

/** Rutas propias admin/* (solo ADMIN). */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API}/admin`;

  indicadores(): Observable<Indicadores> {
    return datos(this.http.get<RespuestaApi<Indicadores>>(`${this.base}/indicators`));
  }
  ventasPorCiudad(): Observable<{ provincia: string; ciudad: string; reservas: number; noches: number; volumen: number }[]> {
    return datos(this.http.get<RespuestaApi<{ provincia: string; ciudad: string; reservas: number; noches: number; volumen: number }[]>>(`${this.base}/sales-by-city`));
  }
  top(): Observable<{ codigo: number; nombre: string; reservas: number; volumen: number }[]> {
    return datos(this.http.get<RespuestaApi<{ codigo: number; nombre: string; reservas: number; volumen: number }[]>>(`${this.base}/top-accommodations`));
  }
  alojamientos(estado: string, q: string, limit: number, offset: number): Observable<Listado<Fila>> {
    return datos(this.http.get<RespuestaApi<Listado<Fila>>>(`${this.base}/accommodations`, { params: paginacion(limit, offset, { estado, q }) }));
  }
  estadoAlojamiento(codigo: number, estado: 'PUBLICADO' | 'SUSPENDIDO'): Observable<{ codigo: number; estado: string }> {
    return datos(this.http.patch<RespuestaApi<{ codigo: number; estado: string }>>(`${this.base}/accommodations/${codigo}/status`, { estado }));
  }
  usuarios(q: string, limit: number, offset: number): Observable<Listado<Fila>> {
    return datos(this.http.get<RespuestaApi<Listado<Fila>>>(`${this.base}/users`, { params: paginacion(limit, offset, { q }) }));
  }
  estadoUsuario(id: string, activo: boolean): Observable<{ id: string; activo: boolean }> {
    return datos(this.http.patch<RespuestaApi<{ id: string; activo: boolean }>>(`${this.base}/users/${id}/status`, { activo }));
  }
  catalogos(): Observable<Catalogos> {
    return datos(this.http.get<RespuestaApi<Catalogos>>(`${this.base}/catalogs`));
  }
  crearCatalogo(tipo: 'amenities' | 'cities', cuerpo: object): Observable<Fila> {
    return datos(this.http.post<RespuestaApi<Fila>>(`${this.base}/catalogs/${tipo}`, cuerpo));
  }
  impuestos(): Observable<Fila[]> {
    return datos(this.http.get<RespuestaApi<Fila[]>>(`${this.base}/taxes`));
  }
  crearImpuesto(cuerpo: object): Observable<Fila> {
    return datos(this.http.post<RespuestaApi<Fila>>(`${this.base}/taxes`, cuerpo));
  }
  cerrarImpuesto(id: number, hasta: string): Observable<Fila> {
    return datos(this.http.patch<RespuestaApi<Fila>>(`${this.base}/taxes/${id}`, { vigente_hasta: hasta }));
  }
  eventos(tipo: string, limit: number, offset: number): Observable<Listado<Fila>> {
    return datos(this.http.get<RespuestaApi<Listado<Fila>>>(`${this.base}/events`, { params: paginacion(limit, offset, { tipo }) }));
  }
  ejecutarJob(nombre: string): Observable<{ job: string; ejecutado: boolean; afectados: number }> {
    return datos(this.http.post<RespuestaApi<{ job: string; ejecutado: boolean; afectados: number }>>(`${this.base}/jobs/${nombre}/ejecutar`, null));
  }
}
