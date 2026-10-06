import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsuarioToken } from '../../../common/auth/decorators';
import { hoyEcuador } from '../../../common/http/respuestas';
import { invalido, noEncontrado, ProblemException, prohibido } from '../../../common/problem/problem';
import { DbService } from '../../../database/db.service';
import { totalHuespedes } from '../dto/comunes.dto';
import { DatosClienteDto, OrderCreateRequestDto, OrderModifyRequestDto, OrderPreviewRequestDto, TipoDocumentoFactura } from '../dto/ordenes.dto';
import { CancelacionResultado, OrderDetail, OrderPreviewResponse } from '../dto/respuestas.dto';
import { CotizacionService } from './cotizacion.service';

const REFERENCIA_PAGO = /^PAY-[A-Z0-9]{6,}$/;

export interface FilaOrden {
  order_id: string;
  locator: string;
  status: 'CONFIRMED' | 'CANCELLED' | 'PENDING';
  estado_interno: string;
  accommodation_id: number;
  accommodation_name: string;
  checkin: string;
  checkout: string;
  guests: number;
  total_price: number;
  currency: string;
  creation_date: Date;
  units: { name: string; quantity: number }[] | null;
}

export const SQL_ORDEN = `
  SELECT o.order_id, o.locator, o.status, o.estado_interno::text AS estado_interno, o.accommodation_id,
         o.accommodation_name, o.checkin, o.checkout, o.guests, o.total_price, o.currency::text AS currency, o.creation_date,
         (SELECT json_agg(json_build_object('name', u.nombre, 'quantity', d.cantidad))
            FROM reserva_detalle d JOIN unidad_alojamiento u ON u.id = d.unidad_id WHERE d.reserva_id = o.order_id) AS units
    FROM v_orden o`;

@Injectable()
export class OrdenesService {
  constructor(
    private readonly db: DbService,
    private readonly cotizacion: CotizacionService,
    private readonly config: ConfigService,
  ) {}

  /** POST /orders/preview -> fn_crear_preview (precio congelado 15 min). */
  async previsualizar(dto: OrderPreviewRequestDto, user: UsuarioToken, requestId: string): Promise<OrderPreviewResponse> {
    if (user.rol === 'ADMIN') throw prohibido('Un ADMIN no puede reservar');
    const prod = this.cotizacion.decodificarProducto(dto.product_id);
    const aloj = await this.db.uno<{ anfitrion_id: string }>(
      `SELECT a.anfitrion_id FROM unidad_alojamiento u
         JOIN alojamiento a ON a.id = u.alojamiento_id
        WHERE u.id = $1 AND a.codigo = $2 AND a.estado = 'PUBLICADO'`,
      [prod.unidadId, dto.accommodation_id],
    );
    if (!aloj) throw invalido('El producto no pertenece a ese alojamiento', [{ name: 'product_id', reason: 'no corresponde a accommodation_id' }]);
    if (aloj.anfitrion_id === user.sub) throw prohibido('No puedes reservar tu propio alojamiento');
    this.cotizacion.validarFechas(prod.checkin, prod.checkout);

    const creado = await this.db.uno<{ id: string }>(
      `SELECT fn_crear_preview($1, $2, $3::date, $4::date, $5::smallint, $6::int) AS id`,
      [user.sub, prod.unidadId, prod.checkin, prod.checkout, totalHuespedes(dto.guests), dto.guests.number_of_rooms],
    );
    const fila = await this.db.uno<{ id: string; total: number; moneda: string }>(
      `SELECT id, total_cotizado AS total, moneda::text AS moneda FROM orden_preview WHERE id = $1`,
      [creado?.id],
    );
    if (!fila) throw new ProblemException(500, 'VALIDATION_FAILED', 'No se pudo crear la previsualización');
    return { request_id: requestId, data: { order_preview_id: fila.id, total_price: fila.total, currency: fila.moneda } };
  }

  /** POST /orders/create -> fn_crear_orden (pago simulado). */
  async crear(dto: OrderCreateRequestDto, user: UsuarioToken): Promise<OrderDetail> {
    if (!REFERENCIA_PAGO.test(dto.payment_reference)) {
      throw new ProblemException(400, 'PAYMENT_REFERENCE_INVALID', 'payment_reference debe cumplir ^PAY-[A-Z0-9]{6,}$', [
        { name: 'payment_reference', reason: 'formato inválido' },
      ]);
    }
    if (dto.payment_reference.startsWith('PAY-DECLINED')) {
      throw new ProblemException(402, 'PAYMENT_NOT_AUTHORIZED', 'El pago simulado fue rechazado');
    }
    // Datos de facturación ingresados en el pago (extensión opcional). Se validan ANTES de crear la orden.
    const comprador = dto.customer_details?.document_type ? this.comprador(dto.customer_details, user) : null;
    const id = await this.db.transaccion(async (q) => {
      const [fila] = await q<{ id: string }>(`SELECT fn_crear_orden($1, $2) AS id`, [dto.order_preview_id, user.sub]);
      if (comprador) {
        // La factura (simulada) se emitió dentro de fn_crear_orden con los datos del perfil: se reemplazan por los del pago.
        // En una reserva por solicitud aún no hay factura y esto no afecta filas (alcance acordado: opción B).
        await q(
          `UPDATE factura SET comprador_nombre = $2, comprador_tipo_documento = $3::tipo_documento,
                  comprador_identificacion = $4, comprador_email = $5
            WHERE reserva_id = $1 AND estado = 'EMITIDA'`,
          [fila.id, comprador.nombre, comprador.tipo, comprador.identificacion, comprador.email],
        );
      }
      return fila.id;
    });
    return this.obtener(id, user.sub);
  }

  /** Comprador de la factura según customer_details (la cédula/RUC no se guarda en el perfil). */
  private comprador(c: DatosClienteDto, user: UsuarioToken): { nombre: string; tipo: string | null; identificacion: string; email: string } {
    const email = (c.email ?? user.email).trim().toLowerCase();
    if (c.document_type === TipoDocumentoFactura.CONSUMIDOR_FINAL) {
      return { nombre: 'CONSUMIDOR FINAL', tipo: null, identificacion: '9999999999999', email };
    }
    const numero = (c.document_number ?? '').trim().toUpperCase();
    if (c.document_type === TipoDocumentoFactura.RUC) {
      return { nombre: (c.business_name ?? '').trim().slice(0, 160), tipo: 'RUC', identificacion: numero, email };
    }
    const faltan = [
      ...(c.first_name?.trim() ? [] : [{ name: 'customer_details.first_name', reason: 'ingresa los nombres' }]),
      ...(c.last_name?.trim() ? [] : [{ name: 'customer_details.last_name', reason: 'ingresa los apellidos' }]),
    ];
    if (faltan.length) throw invalido('Faltan datos para la factura', faltan);
    return { nombre: `${c.first_name!.trim()} ${c.last_name!.trim()}`.slice(0, 160), tipo: c.document_type as string, identificacion: numero, email };
  }

  /** GET /orders/{id}: solo el dueño (sub); ajena o inexistente -> 404. */
  async obtener(orderId: string, ownerId: string): Promise<OrderDetail> {
    const fila = await this.db.uno<FilaOrden>(`${SQL_ORDEN} WHERE o.order_id = $1 AND o.owner_id = $2`, [orderId, ownerId]);
    if (!fila) throw noEncontrado('La orden no existe');
    return this.aDetalle(fila);
  }

  /** POST /orders/{id}/modify -> fn_modificar_reserva. */
  async modificar(orderId: string, dto: OrderModifyRequestDto, user: UsuarioToken): Promise<OrderDetail> {
    if (!dto.checkin && !dto.checkout && !dto.guests) {
      throw invalido('Indica nuevas fechas o huéspedes', [{ name: 'checkin', reason: 'nada que modificar' }]);
    }
    await this.obtener(orderId, user.sub);
    await this.db.query(`SELECT * FROM fn_modificar_reserva($1, $2, $3::date, $4::date, $5::smallint)`, [
      orderId, user.sub, dto.checkin ?? null, dto.checkout ?? null, dto.guests ? totalHuespedes(dto.guests) : null,
    ]);
    return this.obtener(orderId, user.sub);
  }

  /** POST /orders/{id}/cancel -> fn_cancelar_reserva (penalidad y reembolso según la política). */
  async cancelar(orderId: string, user: UsuarioToken): Promise<CancelacionResultado> {
    await this.obtener(orderId, user.sub);
    const r = await this.db.uno<{ penalidad: number; reembolso: number }>(
      `SELECT penalidad, reembolso FROM fn_cancelar_reserva($1, $2, $3)`,
      [orderId, user.sub, 'Cancelada por el huésped'],
    );
    return { order_id: orderId, status: 'CANCELLED', penalty: r?.penalidad ?? 0, refund: r?.reembolso ?? 0, currency: 'USD' };
  }

  /** Mapea v_orden a OrderDetail con enlaces HATEOAS según el estado. */
  aDetalle(f: FilaOrden): OrderDetail {
    const base = `${this.config.get<string>('API_PUBLIC_URL')}/api/v1/orders/${f.order_id}`;
    const vivo = ['PENDIENTE', 'CONFIRMADA'].includes(f.estado_interno);
    const links: Record<string, string> = { self: base };
    if (vivo && f.checkin > hoyEcuador()) links.modify = `${base}/modify`;
    if (vivo) links.cancel = `${base}/cancel`;
    return {
      order_id: f.order_id,
      locator: f.locator,
      status: f.status,
      accommodation_details: {
        id: f.accommodation_id,
        name: f.accommodation_name,
        checkin: f.checkin,
        checkout: f.checkout,
        guests: f.guests,
        units: f.units ?? [],
        url: this.cotizacion.urlAlojamiento(f.accommodation_id),
      },
      total_price: f.total_price,
      currency: f.currency,
      creation_date: new Date(f.creation_date).toISOString(),
      _links: links,
    };
  }
}
