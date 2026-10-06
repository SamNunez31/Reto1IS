import { Routes } from '@angular/router';
import { cambiosSinGuardarGuard } from './cambios.guard';

/**
 * Catálogo de Posada EC: crear y editar alojamientos (solo ADMIN, bajo /admin/alojamientos).
 * Reutiliza el editor que antes usaba el panel del anfitrión; el portal de anfitriones externos es evolución futura.
 */
export const CATALOGO_ROUTES: Routes = [
  {
    path: 'nuevo',
    loadComponent: () => import('./editor-alojamiento.component').then((m) => m.EditorAlojamientoComponent),
    canDeactivate: [cambiosSinGuardarGuard],
    title: 'Nuevo alojamiento',
  },
  {
    path: ':codigo',
    loadComponent: () => import('./edicion-alojamiento.component').then((m) => m.EdicionAlojamientoComponent),
    canDeactivate: [cambiosSinGuardarGuard],
    title: 'Editar alojamiento',
  },
];
