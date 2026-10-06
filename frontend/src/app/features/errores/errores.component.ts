import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-no-encontrado',
  imports: [RouterLink],
  template: `
    <section class="tarjeta error-pagina">
      <p class="codigo">404</p>
      <h1>Página no encontrada</h1>
      <p>Lo que buscas no existe o ya no está disponible.</p>
      <a class="btn btn-primario" routerLink="/">Ir al inicio</a>
    </section>
  `,
})
export class NoEncontradoComponent {}

@Component({
  selector: 'app-acceso-denegado',
  imports: [RouterLink],
  template: `
    <section class="tarjeta error-pagina">
      <p class="codigo">403</p>
      <h1>Acceso denegado</h1>
      <p>{{ detalle || 'No tienes permiso para ver esta sección.' }}</p>
      <a class="btn btn-primario" routerLink="/">Ir al inicio</a>
    </section>
  `,
})
export class AccesoDenegadoComponent {
  readonly detalle = (history.state as { detalle?: string } | null)?.detalle ?? '';
}

/** Rutas antiguas del panel de anfitrión (/anfitrion/...): el portal de anfitriones externos ya no existe. */
@Component({
  selector: 'app-sin-portal-anfitrion',
  imports: [RouterLink],
  template: `
    <section class="tarjeta error-pagina">
      <p class="codigo" aria-hidden="true">🏡</p>
      <h1>Esta sección ya no está disponible</h1>
      <p>En Posada EC, el equipo de la plataforma administra directamente todos los alojamientos. No es posible publicar alojamientos desde una cuenta de huésped.</p>
      @if (esAdmin) {
        <a class="btn btn-primario" routerLink="/admin" [queryParams]="{ tab: 'alojamientos' }">Ir a Administración → Alojamientos</a>
      } @else {
        <a class="btn btn-primario" routerLink="/">Buscar alojamientos</a>
      }
    </section>
  `,
})
export class SinPortalAnfitrionComponent {
  readonly esAdmin = inject(AuthService).usuario()?.rol === 'ADMIN';
}

@Component({
  selector: 'app-sesion-expirada',
  imports: [RouterLink],
  template: `
    <section class="tarjeta error-pagina">
      <p class="codigo">401</p>
      <h1>Tu sesión terminó</h1>
      <p>Vuelve a iniciar sesión para continuar.</p>
      <a class="btn btn-primario" routerLink="/login">Iniciar sesión</a>
    </section>
  `,
})
export class SesionExpiradaComponent {}
