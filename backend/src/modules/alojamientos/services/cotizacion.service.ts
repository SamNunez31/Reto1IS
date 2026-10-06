import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hoyEcuador, noches } from '../../../common/http/respuestas';
import { invalido } from '../../../common/problem/problem';
import { DbService } from '../../../database/db.service';
import { PoliticaCancelacion, Producto } from '../dto/respuestas.dto';

interface FilaCotizacion {
  codigo: number;
  unidad_id: string;
  nombre: string;
  capacidad_huespedes: number;
  politica_id: number;
  subtotal: number;
  servicio: number;
  iva: number;
  limpieza: number;
  total: number;
  cupo: number;
}

interface FilaPolitica {
  id: number;
  nombre: string;
  descripcion: string;
  reglas: { hours_before: number; penalty_percent: number }[];
}

export interface ProductoDecodificado {
  unidadId: string;
  checkin: string;
  checkout: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Cotiza unidades con fn_cotizar (la BD calcula hospedaje, servicio, IVA y limpieza)
 * y arma los "products" del contrato.
 */
@Injectable()
export class CotizacionService {
  constructor(
    private readonly db: DbService,
    private readonly config: ConfigService,
  ) {}

  urlAlojamiento(codigo: number): string {
    return `${this.config.get<string>('PUBLIC_WEB_URL')}/alojamientos/${codigo}`;
  }

  /** product_id = base64url("unidad|checkin|checkout"): el preview del contrato no trae fechas. */
  codificarProducto(unidadId: string, checkin: string, checkout: string): string {
    return Buffer.from(`${unidadId}|${checkin}|${checkout}`).toString('base64url');
  }

  decodificarProducto(productId: string): ProductoDecodificado {
    const [unidadId, checkin, checkout] = Buffer.from(productId, 'base64url').toString('utf8').split('|');
    if (!UUID.test(unidadId ?? '') || !FECHA.test(checkin ?? '') || !FECHA.test(checkout ?? '')) {
      throw invalido('product_id inválido', [{ name: 'product_id', reason: 'no corresponde a un producto de /availability' }]);
    }
    return { unidadId, checkin, checkout };
  }

  /** Reglas comunes de fechas: entrada desde hoy (hora de Ecuador), salida posterior, máximo 90 noches. */
  validarFechas(checkin: string, checkout: string): number {
    if (checkin < hoyEcuador()) throw invalido('La entrada no puede estar en el pasado', [{ name: 'checkin', reason: 'fecha pasada' }]);
    const n = noches(checkin, checkout);
    if (!(n >= 1)) throw invalido('La salida debe ser posterior a la entrada', [{ name: 'checkout', reason: 'debe ser posterior a checkin' }]);
    if (n > 90) throw invalido('La estancia máxima consultable es de 90 noches', [{ name: 'checkout', reason: 'máximo 90 noches' }]);
    return n;
  }

  /** Políticas de cancelación con sus tramos (para mostrarlas claras al huésped). */
  async politicas(ids: number[]): Promise<Map<number, PoliticaCancelacion>> {
    const filas = await this.db.query<FilaPolitica>(
      `SELECT p.id, p.nombre, p.descripcion,
              COALESCE(json_agg(json_build_object('hours_before', r.horas_minimas, 'penalty_percent', r.porcentaje_penalidad)
                       ORDER BY r.horas_minimas DESC) FILTER (WHERE r.politica_id IS NOT NULL), '[]') AS reglas
         FROM politica_cancelacion p LEFT JOIN politica_cancelacion_regla r ON r.politica_id = p.id
        WHERE p.id = ANY($1::smallint[]) GROUP BY p.id`,
      [ids],
    );
    return new Map(
      filas.map((f) => [
        f.id,
        { name: f.nombre, description: f.descripcion, rules: f.reglas.map((r) => ({ hours_before: r.hours_before, penalty_percent: Number(r.penalty_percent) })) },
      ]),
    );
  }

  /**
   * Productos disponibles por alojamiento (código entero): unidades activas con cupo >= habitaciones
   * y capacidad suficiente. Solo alojamientos PUBLICADOS y con noches dentro de su mínimo/máximo.
   */
  async productosPorAlojamiento(
    codigos: number[],
    checkin: string,
    checkout: string,
    habitaciones: number,
    huespedes: number,
  ): Promise<Map<number, Producto[]>> {
    const n = this.validarFechas(checkin, checkout);
    const filas = await this.db.query<FilaCotizacion>(
      `SELECT a.codigo, u.id AS unidad_id, u.nombre, u.capacidad_huespedes, a.politica_id,
              c.subtotal, c.servicio, c.iva, c.limpieza, c.total, c.cupo
         FROM alojamiento a
         JOIN unidad_alojamiento u ON u.alojamiento_id = a.id AND u.activa
         CROSS JOIN LATERAL fn_cotizar(u.id, $2::date, $3::date, $4::int) c
        WHERE a.codigo = ANY($1::int[]) AND a.estado = 'PUBLICADO'
          AND $5::int BETWEEN a.noches_min AND a.noches_max
          AND c.cupo >= $4::int AND u.capacidad_huespedes * $4::int >= $6::int
        ORDER BY a.codigo, c.total`,
      [codigos, checkin, checkout, habitaciones, n, huespedes],
    );
    const politicas = await this.politicas([...new Set(filas.map((f) => f.politica_id))]);
    const resultado = new Map<number, Producto[]>();
    for (const f of filas) {
      const lista = resultado.get(f.codigo) ?? [];
      lista.push({
        id: this.codificarProducto(f.unidad_id, checkin, checkout),
        name: f.nombre,
        max_occupancy: f.capacidad_huespedes,
        available_rooms: f.cupo,
        nights: n,
        price: { base: f.subtotal, service_fee: f.servicio, taxes: f.iva, cleaning_fee: f.limpieza, total: f.total },
        cancellation_policy: politicas.get(f.politica_id) as PoliticaCancelacion,
      });
      resultado.set(f.codigo, lista);
    }
    return resultado;
  }
}
