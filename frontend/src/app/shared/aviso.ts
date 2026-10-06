import { DestroyRef, inject, signal } from '@angular/core';

/**
 * Mensaje de éxito que se oculta solo tras unos segundos (los de error se quedan hasta la siguiente acción).
 * Uso en un componente: `readonly ok = avisoTemporal();` y en la plantilla `@if (ok.texto()) { ... }`.
 */
export function avisoTemporal(ms = 4500) {
  const texto = signal('');
  let t: ReturnType<typeof setTimeout> | undefined;
  inject(DestroyRef).onDestroy(() => clearTimeout(t));
  return {
    texto: texto.asReadonly(),
    mostrar(msg: string): void {
      clearTimeout(t);
      texto.set(msg);
      t = setTimeout(() => texto.set(''), ms);
    },
    limpiar(): void {
      clearTimeout(t);
      texto.set('');
    },
  };
}
