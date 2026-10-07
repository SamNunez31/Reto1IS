/** Fecha local YYYY-MM-DD desplazada `dias` desde hoy. */
export function fechaMasDias(dias: number, base = new Date()): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Hoy en Ecuador continental (America/Guayaquil), YYYY-MM-DD: la misma referencia que el backend (hoyEcuador). */
export function hoyEcuador(ahora = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil' }).format(ahora);
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Problema de cada campo de fecha ('' si está bien). */
export interface ProblemaFechas {
  entrada: string;
  salida: string;
}

/**
 * Reglas de la estadía, iguales a las del backend: la entrada puede ser hoy o después (hora de Ecuador)
 * y la salida debe ser posterior a la entrada. Sirve también para fechas tecleadas a mano (el atributo min no las impide).
 */
export function motivoFechas(checkin: string | null | undefined, checkout: string | null | undefined, hoy = hoyEcuador()): ProblemaFechas {
  const entradaOk = !!checkin && FECHA.test(checkin);
  const salidaOk = !!checkout && FECHA.test(checkout);
  return {
    entrada: !entradaOk ? 'Elige la fecha de entrada.' : (checkin as string) < hoy ? 'La fecha de entrada no puede ser anterior a hoy.' : '',
    salida: !salidaOk ? 'Elige la fecha de salida.'
      : entradaOk && (checkout as string) <= (checkin as string) ? 'La fecha de salida debe ser posterior a la de entrada.' : '',
  };
}

export function nochesEntre(checkin: string, checkout: string): number {
  return Math.round((Date.parse(checkout) - Date.parse(checkin)) / 86_400_000);
}
