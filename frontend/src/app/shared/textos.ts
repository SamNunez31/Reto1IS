/** Textos legibles para la interfaz: plurales, fechas y resúmenes (sin fechas ISO ni "unidad(es)"). */

export const plural = (n: number, singular: string, pluralTxt = `${singular}s`): string => `${n} ${n === 1 ? singular : pluralTxt}`;

/** "2026-10-19" o un ISO completo -> Date local (sin desfase por zona horaria en fechas puras). */
export function aFecha(valor: string | Date): Date {
  if (valor instanceof Date) return valor;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(valor);
}

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('es-EC', opts);
const DIA_MES = fmt({ day: 'numeric', month: 'short' });
const DIA_MES_ANIO = fmt({ day: 'numeric', month: 'short', year: 'numeric' });
const SEMANA_DIA_MES = fmt({ weekday: 'short', day: 'numeric', month: 'short' });
const limpiar = (s: string) => s.replace(/\./g, '').replace(/\s+de\s+/g, ' ');

/** "19 oct 2026" */
export const fechaLarga = (v: string | Date): string => limpiar(DIA_MES_ANIO.format(aFecha(v)));
/** "19 oct" */
export const fechaCorta = (v: string | Date): string => limpiar(DIA_MES.format(aFecha(v)));
/** "lun 19 oct" (para calendarios) */
export const fechaConDia = (v: string | Date): string => limpiar(SEMANA_DIA_MES.format(aFecha(v)));

export function noches(checkin: string, checkout: string): number {
  return Math.max(0, Math.round((aFecha(checkout).getTime() - aFecha(checkin).getTime()) / 86_400_000));
}

/** "19 oct 2026 → 21 oct 2026 · 2 noches" */
export function rangoLargo(checkin: string, checkout: string): string {
  return `${fechaLarga(checkin)} → ${fechaLarga(checkout)} · ${plural(noches(checkin, checkout), 'noche')}`;
}

/** "19–21 oct", "30 oct – 2 nov" o "28 dic 2026 – 2 ene 2027" */
export function rangoCorto(checkin: string, checkout: string): string {
  const a = aFecha(checkin);
  const b = aFecha(checkout);
  if (a.getFullYear() !== b.getFullYear()) return `${fechaLarga(a)} – ${fechaLarga(b)}`;
  if (a.getMonth() === b.getMonth()) return `${a.getDate()}–${fechaCorta(b)}`;
  return `${fechaCorta(a)} – ${fechaCorta(b)}`;
}

/** "2 adultos, 1 niño" */
export function textoPersonas(adultos: number, ninos = 0): string {
  return plural(adultos, 'adulto') + (ninos ? `, ${plural(ninos, 'niño')}` : '');
}

/** "5 huéspedes · 3 habitaciones" */
export function textoHuespedes(huespedes: number, habitaciones: number, separador = ' · '): string {
  return `${plural(huespedes, 'huésped', 'huéspedes')}${separador}${plural(habitaciones, 'habitación', 'habitaciones')}`;
}

/** Nombre legible de la política de cancelación. */
export const TITULO_POLITICA: Record<string, string> = { FLEXIBLE: 'Flexible', MODERADA: 'Moderada', NO_REEMBOLSABLE: 'No reembolsable' };
export const tituloPolitica = (n: string): string => TITULO_POLITICA[n] ?? n;

/** Nota del backend (1–10) -> estrellas (0–5) redondeadas a 0,5. */
export const aEstrellas = (nota: number): number => Math.round(nota) / 2;
