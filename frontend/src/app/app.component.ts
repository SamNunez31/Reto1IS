import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { ConfirmarComponent, ConfirmarService } from './shared/confirmar';
import { LoginModalComponent } from './features/auth/login-modal.component';
import { LoginModalService } from './core/services/login-modal.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ConfirmarComponent, LoginModalComponent],
  template: `
    <a class="saltar" href="#contenido">Saltar al contenido</a>
    <header class="barra">
      <a routerLink="/" class="marca" aria-label="Posada EC, inicio">Posada<span>EC</span></a>
      <button class="menu-btn" type="button" (click)="menu.set(!menu())" [attr.aria-expanded]="menu()" aria-controls="nav">Menú</button>
      <!-- Clic en un enlace del menú móvil lo cierra; los enlaces ya son accesibles con teclado -->
      <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
      <nav id="nav" [class.abierto]="menu()" (click)="menu.set(false)" aria-label="Principal">
        <a routerLink="/" routerLinkActive="activo" [routerLinkActiveOptions]="{ exact: true }">Buscar</a>
        @if (auth.usuario(); as u) {
          @if (u.rol === 'ADMIN') {
            <a routerLink="/admin" routerLinkActive="activo">Administración</a>
          } @else {
            <a routerLink="/mis-reservas" routerLinkActive="activo">Mis reservas</a>
          }
          @if (u.rol === 'ADMIN') {
            <!-- El ADMIN no tiene "Mi perfil": su nombre es solo informativo -->
            <span class="nav-usuario d-inline-flex align-items-center">
              <svg class="icono-usuario" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5Z"/></svg>
              {{ u.nombres }}
            </span>
          } @else {
            <a class="nav-usuario d-inline-flex align-items-center" routerLink="/perfil" routerLinkActive="activo" title="Mi perfil" [attr.aria-label]="'Mi perfil: ' + u.nombres">
              <svg class="icono-usuario" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5Z"/></svg>
              {{ u.nombres }}
            </a>
          }
          <button class="btn-salir" type="button" (click)="salir()">Salir</button>
        } @else {
          <button class="nav-boton" type="button" (click)="abrirLogin()" aria-haspopup="dialog">Iniciar sesión</button>
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
      <p class="pie-aviso"><a class="pie-enlace" routerLink="/observabilidad">Observabilidad</a></p>
    </footer>
    <app-confirmar />
    <app-login-modal />
  `,
})
export class AppComponent {
  readonly auth = inject(AuthService);
  readonly menu = signal(false);
  private readonly confirmar = inject(ConfirmarService);
  private readonly loginModal = inject(LoginModalService);
  private readonly router = inject(Router);

  /** Abre la ventana de inicio de sesión; al entrar, vuelve a la página actual (desde el inicio, a la de siempre según el rol). */
  abrirLogin(): void {
    this.loginModal.abrir(this.router.url === '/' ? null : this.router.url);
  }

  /** Cierra la sesión solo si el usuario lo confirma en el diálogo común. */
  async salir(): Promise<void> {
    const si = await this.confirmar.pedir({
      titulo: '¿Cerrar sesión?',
      mensaje: '¿Seguro que quieres cerrar sesión?',
      confirmar: 'Cerrar sesión',
      cancelar: 'Cancelar',
      tono: 'peligro',
    });
    if (si) this.auth.logout();
  }
}
