/** Fecha local YYYY-MM-DD desplazada `dias` desde hoy. */
export function fechaMasDias(dias: number, base = new Date()): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function nochesEntre(checkin: string, checkout: string): number {
  return Math.round((Date.parse(checkout) - Date.parse(checkin)) / 86_400_000);
}
