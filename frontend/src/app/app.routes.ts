import { Routes } from '@angular/router';
import { authGuard, perfilGuard, roleGuard } from './core/guards/guards';
import { BusquedaComponent } from './features/busqueda/busqueda.component';
import { AccesoDenegadoComponent, NoEncontradoComponent, SesionExpiradaComponent, SinPortalAnfitrionComponent } from './features/errores/errores.component';

export const routes: Routes = [
  { path: '', component: BusquedaComponent, title: 'Buscar alojamiento' },
  {
    path: 'alojamientos/:id',
    loadComponent: () => import('./features/detalle/detalle.component').then((m) => m.DetalleComponent),
    title: 'Alojamiento',
  },
  {
    path: 'reservar',
    canActivate: [roleGuard],
    data: { roles: ['USUARIO'] },
    loadComponent: () => import('./features/reserva/reserva.component').then((m) => m.ReservaComponent),
    title: 'Reservar',
  },
  {
    path: 'mis-reservas',
    canActivate: [roleGuard],
    data: { roles: ['USUARIO'] },
    loadComponent: () => import('./features/mis-reservas/mis-reservas.component').then((m) => m.MisReservasComponent),
    title: 'Mis reservas',
  },
  // El portal de anfitriones es evolución futura: cualquier ruta antigua /anfitrion/... muestra un aviso claro
  { path: 'anfitrion', children: [{ path: '**', component: SinPortalAnfitrionComponent, title: 'Sección no disponible' }] },
  {
    path: 'admin',
    canActivate: [roleGuard],
    data: { roles: ['ADMIN'] },
    children: [
      { path: '', loadComponent: () => import('./features/admin/admin.component').then((m) => m.AdminComponent), title: 'Administración' },
      // Catálogo de Posada EC: el admin crea y edita alojamientos con el editor existente
      { path: 'alojamientos', loadChildren: () => import('./features/anfitrion/anfitrion.routes').then((m) => m.CATALOGO_ROUTES) },
    ],
  },
  // /login (y el ?volver= de los guards) muestra la página de inicio con la ventana de inicio de sesión encima
  { path: 'login', component: BusquedaComponent, title: 'Iniciar sesión' },
  { path: 'registro', loadComponent: () => import('./features/auth/registro.component').then((m) => m.RegistroComponent), title: 'Crear cuenta' },
  // Recuperación de clave deshabilitada en la interfaz (el backend la conserva): las rutas antiguas llevan al login
  { path: 'recuperar-clave', redirectTo: 'login' },
  { path: 'restablecer-clave', redirectTo: 'login' },
  { path: 'perfil', canActivate: [authGuard, perfilGuard], loadComponent: () => import('./features/perfil/perfil.component').then((m) => m.PerfilComponent), title: 'Mi perfil' },
  // Pública: muestra solo datos locales de este navegador (la misma vista que la pestaña del admin)
  {
    path: 'observabilidad',
    loadComponent: () => import('./features/admin/observabilidad.component').then((m) => m.ObservabilidadComponent),
    title: 'Observabilidad',
  },
  { path: 'acceso-denegado', component: AccesoDenegadoComponent, title: 'Acceso denegado' },
  { path: 'sesion-expirada', component: SesionExpiradaComponent, title: 'Sesión expirada' },
  { path: 'no-encontrado', component: NoEncontradoComponent, title: 'No encontrado' },
  { path: '**', component: NoEncontradoComponent, title: 'No encontrado' },
];
