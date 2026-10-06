import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { ConfirmarComponent } from './shared/confirmar';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ConfirmarComponent],
  template: `
    <a class="saltar" href="#contenido">Saltar al contenido</a>
    <header class="barra">
      <a routerLink="/" class="marca" aria-label="Posada EC, inicio">Posada<span>EC</span></a>
      <button class="menu-btn" type="button" (click)="menu.set(!menu())" [attr.aria-expanded]="menu()" aria-controls="nav">Menú</button>
      <nav id="nav" [class.abierto]="menu()" (click)="menu.set(false)" aria-label="Principal">
        <a routerLink="/" routerLinkActive="activo" [routerLinkActiveOptions]="{ exact: true }">Buscar</a>
        @if (auth.usuario(); as u) {
          @if (u.rol === 'ADMIN') {
            <a routerLink="/admin" routerLinkActive="activo">Administración</a>
          } @else {
            <a routerLink="/mis-reservas" routerLinkActive="activo">Mis reservas</a>
          }
          <a routerLink="/perfil" routerLinkActive="activo">{{ u.nombres }}</a>
          <button class="btn-enlace" type="button" (click)="auth.logout()">Salir</button>
        } @else {
          <a routerLink="/login" routerLinkActive="activo">Ingresar</a>
          <a routerLink="/registro" class="btn btn-primario">Crear cuenta</a>
        }
      </nav>
    </header>
    <main id="contenido" class="contenedor">
      <router-outlet />
    </main>
    <footer class="pie-pagina">
      <p class="pie-marca">© 2026 Posada EC · Proyecto académico PUCE</p>
      <p class="pie-aviso">Los pagos y facturas son simulados con fines académicos.</p>
    </footer>
    <app-confirmar />
  `,
})
export class AppComponent {
  readonly auth = inject(AuthService);
  readonly menu = signal(false);
}
