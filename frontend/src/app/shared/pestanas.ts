/**
 * Patrón de pestañas WAI-ARIA (activación automática): Flecha derecha/izquierda pasan a la siguiente/anterior
 * (circular), Inicio y Fin a la primera/última. Devuelve el índice nuevo o null si la tecla no aplica.
 */
export function indicePestana(tecla: string, actual: number, total: number): number | null {
  if (total <= 0) return null;
  switch (tecla) {
    case 'ArrowRight': return (actual + 1) % total;
    case 'ArrowLeft': return (actual - 1 + total) % total;
    case 'Home': return 0;
    case 'End': return total - 1;
    default: return null;
  }
}
