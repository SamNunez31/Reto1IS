import { ConfigService } from '@nestjs/config';
import { DbService } from '../../database/db.service';
import { OrderCreateRequestDto } from './dto/ordenes.dto';
import { CotizacionService } from './services/cotizacion.service';
import { OrdenesService } from './services/ordenes.service';

/**
 * Reenviar un preview ya usado (otra Idempotency-Key) devuelve la orden existente: no debe tocar
 * el pago ni reescribir el comprador de la factura ya emitida. Solo se actualizan filas de ESTA transacción.
 */
describe('Crear orden: reintento con un preview ya usado', () => {
  const sql: string[] = [];
  const db = {
    transaccion: async (fn: (q: (s: string, p?: unknown[]) => Promise<unknown[]>) => Promise<unknown>) =>
      fn(async (s: string) => {
        sql.push(s.replace(/\s+/g, ' '));
        return s.includes('fn_crear_orden') ? [{ id: 'reserva-existente' }] : [];
      }),
  } as unknown as DbService;
  const servicio = new OrdenesService(db, {} as CotizacionService, { get: () => 'http://local' } as unknown as ConfigService);
  // obtener() consulta la orden: aquí no interesa
  (servicio as unknown as { obtener: () => Promise<unknown> }).obtener = async () => ({ order_id: 'reserva-existente' });

  beforeEach(() => (sql.length = 0));

  it('el comprador solo se escribe en la factura emitida en esta transacción', async () => {
    const dto = {
      order_preview_id: '3f2b8c1e-9a4d-4e7b-8c2f-1a2b3c4d5e6f', payment_reference: 'PAY-REINTENTO1',
      customer_details: { document_type: 'CEDULA', document_number: '1710034065', first_name: 'Otra', last_name: 'Persona', email: 'otra@correo.com' },
    } as unknown as OrderCreateRequestDto;
    await servicio.crear(dto, { sub: 'u1', email: 'ana@correo.com', rol: 'USUARIO', scope: '' } as never);
    const factura = sql.find((s) => s.startsWith(' UPDATE factura') || s.startsWith('UPDATE factura'));
    expect(factura).toBeDefined();
    expect(factura).toContain('emitida_en = now()');
  });

  it('el pago en efectivo también solo toca los cobros de esta transacción', async () => {
    const dto = { order_preview_id: '3f2b8c1e-9a4d-4e7b-8c2f-1a2b3c4d5e6f', payment_method: 'CASH' } as unknown as OrderCreateRequestDto;
    await servicio.crear(dto, { sub: 'u1', email: 'ana@correo.com', rol: 'USUARIO', scope: '' } as never);
    expect(sql.find((s) => s.includes('UPDATE pago'))).toContain('fecha = now()');
  });
});
