import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/guards/guards';
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
  { path: 'login', loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent), title: 'Iniciar sesión' },
  { path: 'registro', loadComponent: () => import('./features/auth/registro.component').then((m) => m.RegistroComponent), title: 'Crear cuenta' },
  {
    path: 'recuperar-clave',
    loadComponent: () => import('./features/auth/recuperar.component').then((m) => m.RecuperarComponent),
    title: 'Recuperar clave',
  },
  {
    path: 'restablecer-clave',
    loadComponent: () => import('./features/auth/recuperar.component').then((m) => m.RestablecerComponent),
    title: 'Nueva clave',
  },
  { path: 'perfil', canActivate: [authGuard], loadComponent: () => import('./features/perfil/perfil.component').then((m) => m.PerfilComponent), title: 'Mi perfil' },
  { path: 'acceso-denegado', component: AccesoDenegadoComponent, title: 'Acceso denegado' },
  { path: 'sesion-expirada', component: SesionExpiradaComponent, title: 'Sesión expirada' },
  { path: 'no-encontrado', component: NoEncontradoComponent, title: 'No encontrado' },
  { path: '**', component: NoEncontradoComponent, title: 'No encontrado' },
];
