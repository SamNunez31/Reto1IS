import { EventoTraza } from '../core/models/api.models';

/** Textos para el huésped (los nombres técnicos de eventos quedan solo en el panel admin y en /observabilidad). */

const FECHA_HORA = new Intl.DateTimeFormat('es-EC', {
  timeZone: 'America/Guayaquil', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
const FECHA = new Intl.DateTimeFormat('es-EC', { timeZone: 'America/Guayaquil', day: 'numeric', month: 'short', year: 'numeric' });
const limpiar = (s: string) => s.replace(/\./g, '').replace(/\s+de\s+/g, ' ').replace(/\u00a0/g, ' ');

/** "6 oct 2026, 13:07" (hora de Ecuador). */
export const fechaHora = (iso: string): string => limpiar(FECHA_HORA.format(new Date(iso)));
/** "6 oct 2026" (hora de Ecuador). */
export const fechaDia = (iso: string): string => limpiar(FECHA.format(new Date(iso)));

/** "$1.234,50" */
export function usd(n: number): string {
  const [ent, dec] = Math.abs(Number(n) || 0).toFixed(2).split('.');
  return `${n < 0 ? '-' : ''}$${ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`;
}

/** "Tarjeta de crédito · pagado", "Efectivo al llegar · pendiente"… */
export function textoPago(metodo: string | null, estado: string | null): string {
  if (metodo === 'EFECTIVO') return estado === 'PENDIENTE' ? 'Efectivo al llegar · pendiente' : 'Efectivo · recibido';
  if (metodo === 'TARJETA') return estado === 'PENDIENTE' ? 'Tarjeta de crédito · pendiente' : 'Tarjeta de crédito · pagado';
  return 'Sin pago registrado';
}

const TEXTO: Record<string, string> = {
  ReservaCreada: 'Reserva confirmada',
  ReservaConfirmada: 'Reserva confirmada',
  ReservaModificada: 'Fechas de la reserva cambiadas',
  ReservaCancelada: 'Reserva cancelada',
  ReservaRechazada: 'Reserva rechazada',
  ReservaExpirada: 'Reserva expirada',
  FacturaEmitida: 'Factura emitida',
  FacturaAnulada: 'Factura anulada',
  EstanciaCompletada: 'Estancia completada',
  ResenaPublicada: 'Reseña publicada',
};

const monto = (e: EventoTraza): number | null => {
  const m = Number((e.payload as { monto?: unknown })?.monto);
  return Number.isFinite(m) ? m : null;
};

/** Texto humano de un evento del historial, con el monto cuando aplica. `metodoPago` distingue el efectivo aún no recibido. */
export function textoEvento(e: EventoTraza, metodoPago: string | null = null, estadoPago: string | null = null): string {
  const m = monto(e);
  const conMonto = (t: string) => (m !== null ? `${t} · ${usd(m)}` : t);
  if (e.tipo === 'PagoRegistrado') {
    return conMonto(metodoPago === 'EFECTIVO' && estadoPago === 'PENDIENTE' ? 'Pago en efectivo pendiente (se paga al llegar)' : 'Pago recibido');
  }
  if (e.tipo === 'ReembolsoRegistrado') return conMonto('Reembolso registrado');
  return TEXTO[e.tipo] ?? e.tipo.replace(/([a-z])([A-Z])/g, '$1 $2');
}

/** Suma de reembolsos registrados en el historial. */
export const totalReembolsado = (eventos: EventoTraza[]): number =>
  eventos.filter((e) => e.tipo === 'ReembolsoRegistrado').reduce((s, e) => s + (monto(e) ?? 0), 0);
