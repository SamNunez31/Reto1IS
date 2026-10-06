import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Rol } from '../models/api.models';
import { AuthService } from '../services/auth.service';

/** Exige sesión; si no hay, lleva al login recordando la ruta. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  if (auth.autenticado()) return true;
  return inject(Router).createUrlTree(['/login'], { queryParams: { volver: state.url } });
};

/** Exige uno de los roles indicados en data.roles. */
export const roleGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.autenticado()) return router.createUrlTree(['/login'], { queryParams: { volver: state.url } });
  const roles = (route.data['roles'] as Rol[] | undefined) ?? [];
  const rol = auth.usuario()?.rol;
  return !roles.length || (rol && roles.includes(rol)) ? true : router.createUrlTree(['/acceso-denegado']);
};
