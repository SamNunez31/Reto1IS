import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { map, Observable, tap } from 'rxjs';
import { RegistroDatos, RespuestaApi, Sesion, Usuario } from '../models/api.models';
import { API } from './api-base';

const CLAVE_SESION = 'sesion';

/** Sesión: JWT en memoria con respaldo en sessionStorage (se borra al cerrar la pestaña). */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly sesion = signal<Sesion | null>(this.leerRespaldo());

  readonly usuario = computed<Usuario | null>(() => this.sesion()?.user ?? null);
  readonly autenticado = computed(() => !!this.sesion());
  readonly esAdmin = computed(() => this.usuario()?.rol === 'ADMIN');

  token(): string | null {
    return this.sesion()?.access_token ?? null;
  }

  login(email: string, password: string): Observable<Usuario> {
    return this.http.post<RespuestaApi<Sesion>>(`${API}/auth/login`, { email, password }).pipe(
      tap((r) => this.guardar(r.data)),
      map((r) => r.data.user),
    );
  }

  registrar(datos: RegistroDatos): Observable<Usuario> {
    return this.http.post<RespuestaApi<Sesion>>(`${API}/auth/register`, datos).pipe(
      tap((r) => this.guardar(r.data)),
      map((r) => r.data.user),
    );
  }

  olvideClave(email: string): Observable<RespuestaApi<{ enlace_simulado?: string }>> {
    return this.http.post<RespuestaApi<{ enlace_simulado?: string }>>(`${API}/auth/forgot-password`, { email });
  }

  restablecer(token: string, password: string): Observable<RespuestaApi<null>> {
    return this.http.post<RespuestaApi<null>>(`${API}/auth/reset-password`, { token, password });
  }

  logout(volverA?: string): void {
    this.sesion.set(null);
    try {
      sessionStorage.removeItem(CLAVE_SESION);
    } catch {
      /* almacenamiento no disponible */
    }
    this.router.navigate(['/login'], { queryParams: volverA ? { volver: volverA } : {} });
  }

  private guardar(s: Sesion): void {
    this.sesion.set(s);
    try {
      sessionStorage.setItem(CLAVE_SESION, JSON.stringify(s));
    } catch {
      /* almacenamiento no disponible: queda solo en memoria */
    }
  }

  private leerRespaldo(): Sesion | null {
    try {
      const crudo = sessionStorage.getItem(CLAVE_SESION);
      if (!crudo) return null;
      const s = JSON.parse(crudo) as Sesion;
      const exp = JSON.parse(atob(s.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp as number;
      return exp * 1000 > Date.now() ? s : null;
    } catch {
      return null;
    }
  }
}
