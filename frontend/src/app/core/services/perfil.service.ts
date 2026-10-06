import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { RespuestaApi } from '../models/api.models';
import { API } from './api-base';

export interface Perfil {
  id: string;
  email: string;
  nombres: string;
  apellidos: string;
  telefono: string | null;
  tipo_documento: 'CEDULA' | 'RUC' | 'PASAPORTE' | null;
  numero_documento: string | null;
  razon_social: string | null;
  rol: string;
  es_anfitrion: boolean;
  created_at: string;
}

export type CambiosPerfil = Partial<Pick<Perfil, 'nombres' | 'apellidos' | 'telefono' | 'razon_social'>> & {
  tipo_documento?: 'CEDULA' | 'RUC' | 'PASAPORTE';
  numero_documento?: string;
};

/** GET/PATCH /me */
@Injectable({ providedIn: 'root' })
export class PerfilService {
  private readonly http = inject(HttpClient);

  obtener(): Observable<Perfil> {
    return this.http.get<RespuestaApi<Perfil>>(`${API}/me`).pipe(map((r) => r.data));
  }

  actualizar(cambios: CambiosPerfil): Observable<Perfil> {
    return this.http.patch<RespuestaApi<Perfil>>(`${API}/me`, cambios).pipe(map((r) => r.data));
  }
}
