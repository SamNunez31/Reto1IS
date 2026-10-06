/*
 * Política de cancelación con FECHAS CONCRETAS para una estancia.
 * Mismas reglas que la vista v_cancelacion_liquidacion (database/01_esquema.sql):
 *   - horas de anticipación = (fecha_entrada + alojamiento.hora_checkin) en America/Guayaquil − momento de cancelar
 *   - aplica el tramo con mayor horas_minimas que se cumpla (horas >= horas_minimas)
 *   - si ninguno se cumple (p. ej. después del check-in) se cobra el 100 %
 * El porcentaje es sobre el hospedaje (subtotal de alojamiento), no sobre limpieza ni impuestos.
 */

export interface ReglaCancelacion { hours_before: number; penalty_percent: number }

/** Hora de check-in por defecto de la BD (alojamiento.hora_checkin DEFAULT '14:00'), solo si el API no la trae. */
export const HORA_CHECKIN_DEFECTO = '14:00';

/**
 * Instante del check-in: fecha + hora en hora de Ecuador continental (America/Guayaquil = UTC−5 todo el año,
 * sin horario de verano), igual que `AT TIME ZONE 'America/Guayaquil'` en la vista.
 */
export function instanteCheckin(fecha: string, hora: string = HORA_CHECKIN_DEFECTO): Date {
  return new Date(`${fecha.slice(0, 10)}T${(hora || HORA_CHECKIN_DEFECTO).slice(0, 5)}:00-05:00`);
}

const FMT = new Intl.DateTimeFormat('es-EC', {
  timeZone: 'America/Guayaquil', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

/** "9 nov, 14:00" (hora de Ecuador). */
export function momentoCorto(d: Date): string {
  const p = Object.fromEntries(FMT.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p['day']} ${String(p['month']).replace('.', '')}, ${p['hour']}:${p['minute']}`;
}

export interface TramoFechado {
  /** null = desde ya (o desde que se reservó). */
  desde: Date | null;
  /** null = en adelante (incluye después del check-in). */
  hasta: Date | null;
  pct: number;
}

/** Tramos con fechas, de la más temprana a la más tardía, sin los que ya pasaron respecto de `ahora`. */
export function tramosConFechas(reglas: ReglaCancelacion[], checkin: Date, ahora = new Date()): TramoFechado[] {
  const orden = [...reglas].sort((a, b) => b.hours_before - a.hours_before);
  const limite = (h: number) => new Date(checkin.getTime() - h * 3_600_000);
  const tramos: TramoFechado[] = [];
  let desde: Date | null = null;
  for (const r of orden) {
    const hasta = limite(r.hours_before);
    if (desde === null) {
      // El tramo más anticipado rige hasta (checkin − sus horas); los siguientes, entre el límite anterior y el suyo
      tramos.push({ desde: null, hasta, pct: r.penalty_percent });
    } else {
      tramos.push({ desde, hasta: r.hours_before > 0 ? hasta : checkin, pct: r.penalty_percent });
    }
    desde = r.hours_before > 0 ? hasta : checkin;
  }
  // Sin tramo que se cumpla (después del último límite) la BD cobra el 100 %
  tramos.push({ desde, hasta: null, pct: 100 });

  // Junta tramos seguidos con el mismo porcentaje y quita los que ya terminaron
  const juntos: TramoFechado[] = [];
  for (const t of tramos) {
    const prev = juntos[juntos.length - 1];
    if (prev && prev.pct === t.pct) prev.hasta = t.hasta;
    else juntos.push({ ...t });
  }
  const vigentes = juntos.filter((t) => t.hasta === null || t.hasta.getTime() > ahora.getTime());
  if (vigentes.length) vigentes[0].desde = null;
  return vigentes;
}

/**
 * Una línea legible con fechas reales, p. ej.:
 * "Cancelación gratis hasta el 9 nov, 14:00 · del 9 nov, 14:00 al 10 nov, 14:00 se cobra el 50 % del hospedaje · después, el 100 %"
 */
export function lineaCancelacion(nombre: string, reglas: ReglaCancelacion[], checkin: Date, ahora = new Date()): string {
  if (nombre === 'NO_REEMBOLSABLE') return 'No reembolsable: se cobra el 100 % del hospedaje';
  if (!reglas.length) return '';
  const tramos = tramosConFechas(reglas, checkin, ahora);
  if (tramos.length === 1) {
    return tramos[0].pct === 0 ? 'Cancelación gratis' : `Si cancelas, se cobra el ${tramos[0].pct} % del hospedaje`;
  }
  return tramos
    .map((t, i) => {
      if (t.hasta === null) return `después, el ${t.pct} %`;
      const hasta = momentoCorto(t.hasta);
      if (i === 0) return t.pct === 0 ? `Cancelación gratis hasta el ${hasta}` : `Hasta el ${hasta} se cobra el ${t.pct} % del hospedaje`;
      const desde = momentoCorto(t.desde as Date);
      return t.pct === 0 ? `del ${desde} al ${hasta}, gratis` : `del ${desde} al ${hasta} se cobra el ${t.pct} % del hospedaje`;
    })
    .join(' · ');
}
