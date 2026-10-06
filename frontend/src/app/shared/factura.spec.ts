import { EventoTraza, Factura } from '../core/models/api.models';
import { armarFactura, DatosParaFactura, documentoComprador } from './factura';
import { textoEvento, usd } from './historial';

const FACTURA: Factura = {
  id: 'f1', numero: '001-001-000000016', estado: 'EMITIDA', emitida_en: '2026-10-06T18:07:10.596Z', anulada_en: null,
  reserva_codigo: 'BK-58E161CD', emisor_nombre: 'Carla Mendoza', emisor_identificacion: '0900000004',
  comprador_nombre: 'Sofía Ruiz', comprador_tipo_documento: 'CEDULA', comprador_identificacion: '1755915319', comprador_email: 'sofia.ruiz@gmail.com',
  subtotal_sin_impuestos: 140, servicio: 14, iva: 23.1, total: 177.1,
};
const evento = (tipo: string, payload: Record<string, unknown>, created_at = '2026-10-06T18:09:42.012Z'): EventoTraza =>
  ({ evento_id: 1, tipo, agregado: 'Reserva', created_at, publicado_en: null, payload });

const datos = (cambios: Partial<DatosParaFactura> = {}): DatosParaFactura => ({
  factura: FACTURA,
  orden: {
    locator: 'BK-58E161CD', alojamiento: 'Hotel Malecón Guayaquil', checkin: '2026-10-20', checkout: '2026-10-22', huespedes: 1,
    unidades: [{ name: 'Habitación Estándar', quantity: 1 }], metodoPago: 'TARJETA', estadoPago: 'APROBADO',
  },
  horaCheckin: '14:00', horaCheckout: '12:00', politica: 'Flexible', eventos: [],
  ...cambios,
});

describe('Factura: armado de los datos', () => {
  it('líneas: noches × tarifa por noche y cargo por servicio; los importes suman el subtotal', () => {
    const m = armarFactura(datos());
    expect(m.lineas.length).toBe(2);
    expect(m.lineas[0]).toEqual(jasmine.objectContaining({ cantidad: 2, precioUnitario: 70, importe: 140 }));
    expect(m.lineas[0].descripcion).toContain('1 × Habitación Estándar');
    expect(m.lineas[1]).toEqual(jasmine.objectContaining({ cantidad: 1, descripcion: 'Cargo por servicio', importe: 14 }));
    expect(m.subtotal).toBe(154);
    expect(m.ivaPct).toBe(15);
    expect(m.subtotal + m.iva).toBeCloseTo(m.total, 2);
  });

  it('sin servicio solo hay la línea de hospedaje', () => {
    const m = armarFactura(datos({ factura: { ...FACTURA, subtotal_sin_impuestos: 480, servicio: 0, iva: 72, total: 552 } }));
    expect(m.lineas.length).toBe(1);
    expect(m.subtotal).toBe(480);
    expect(m.ivaPct).toBe(15);
  });

  it('comprador, emisor y observaciones con código, fechas, horas, huéspedes y forma de pago', () => {
    const m = armarFactura(datos());
    expect(m.comprador).toEqual({ nombre: 'Sofía Ruiz', documento: 'Cédula 1755915319', email: 'sofia.ruiz@gmail.com' });
    expect(m.emisor.nombre).toBe('Carla Mendoza');
    const obs = m.observaciones.join(' | ');
    expect(obs).toContain('Código de reserva: BK-58E161CD');
    expect(obs).toContain('desde las 14:00');
    expect(obs).toContain('hasta las 12:00');
    expect(obs).toContain('2 noches');
    expect(obs).toContain('Tarjeta de crédito · pagado');
    expect(m.anulada).toBeFalse();
    expect(m.reembolso).toBeNull();
  });

  it('factura anulada: fecha de anulación y reembolso del historial según la política', () => {
    const m = armarFactura(datos({
      factura: { ...FACTURA, estado: 'ANULADA', anulada_en: '2026-10-06T18:09:42.012Z' },
      eventos: [evento('PagoRegistrado', { tipo: 'COBRO', monto: 177.1 }), evento('ReembolsoRegistrado', { tipo: 'REEMBOLSO', monto: 177.1 })],
    }));
    expect(m.anulada).toBeTrue();
    expect(m.anuladaEl).toBe('6 oct 2026, 13:09'); // hora de Ecuador
    expect(m.reembolso?.monto).toBe(177.1);
    expect(m.reembolso?.texto).toBe('Reembolso registrado: $177,10 (según política Flexible)');
  });

  it('anulada con efectivo no pagado: reembolso 0 y motivo claro', () => {
    const m = armarFactura(datos({
      factura: { ...FACTURA, estado: 'ANULADA', anulada_en: '2026-10-06T18:09:42.012Z' },
      orden: { ...datos().orden, metodoPago: 'EFECTIVO', estadoPago: 'PENDIENTE' },
    }));
    expect(m.reembolso?.texto).toBe('Reembolso registrado: $0,00 (el pago en efectivo no se había realizado)');
  });

  it('documento del comprador', () => {
    expect(documentoComprador('RUC', '1790012345001')).toBe('RUC 1790012345001');
    expect(documentoComprador('CONSUMIDOR_FINAL', '9999999999999')).toBe('Consumidor final');
    expect(documentoComprador(null, null)).toBe('Consumidor final');
  });
});

describe('Historial con textos humanos', () => {
  it('traduce los eventos y agrega el monto', () => {
    expect(textoEvento(evento('ReservaCreada', {}))).toBe('Reserva confirmada');
    expect(textoEvento(evento('PagoRegistrado', { monto: 177.1 }))).toBe('Pago recibido · $177,10');
    expect(textoEvento(evento('PagoRegistrado', { monto: 50 }), 'EFECTIVO', 'PENDIENTE')).toContain('Pago en efectivo pendiente');
    expect(textoEvento(evento('FacturaEmitida', {}))).toBe('Factura emitida');
    expect(textoEvento(evento('ReservaCancelada', {}))).toBe('Reserva cancelada');
    expect(textoEvento(evento('ReembolsoRegistrado', { monto: 1234.5 }))).toBe('Reembolso registrado · $1.234,50');
    expect(textoEvento(evento('FacturaAnulada', {}))).toBe('Factura anulada');
    expect(usd(-3)).toBe('-$3,00');
  });
});
