import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { ConfirmarService } from '../../shared/confirmar';

/** Pantallas con formularios que pueden quedar a medias. */
export interface ConCambiosSinGuardar {
  hayCambiosSinGuardar(): boolean;
}

/**
 * Antes de salir de la pantalla (navegación dentro de la app), pregunta si hay cambios sin guardar.
 * Al cerrar o recargar la pestaña, el componente usa el aviso nativo del navegador (beforeunload).
 */
export const cambiosSinGuardarGuard: CanDeactivateFn<ConCambiosSinGuardar> = (componente) => {
  if (!componente?.hayCambiosSinGuardar()) return true;
  return inject(ConfirmarService).pedir({
    titulo: '¿Salir sin guardar?',
    mensaje: 'Tienes cambios que todavía no has guardado. Si sales ahora, se perderán.',
    confirmar: 'Salir sin guardar',
    cancelar: 'Seguir editando',
    tono: 'peligro',
  });
};
