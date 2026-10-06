import { Injectable } from '@nestjs/common';
import { codificarCursor, decodificarCursor } from '../../../common/http/respuestas';
import { DbService } from '../../../database/db.service';
import {
  AccommodationDetailsRequestDto, AvailabilityRequestDto, BulkAvailabilityRequestDto, ConstantsRequestDto,
  DetailsChangesRequestDto, OrdenBusqueda, ReviewsRequestDto, ReviewsScoresRequestDto, SearchAccommodationRequestDto,
} from '../dto/catalogo.dto';
import { totalHuespedes } from '../dto/comunes.dto';
import {
  AccommodationDetailsResponse, AvailabilityResponse, BulkAvailabilityResponse, ChainsResponse, ConstantsResponse,
  DetailsChangesResponse, DetalleAlojamiento, PoliticaCancelacion, ReviewsResponse, ReviewsScoresResponse,
  SearchAccommodationResponse,
} from '../dto/respuestas.dto';
import { noEncontrado } from '../../../common/problem/problem';
import { CotizacionService } from './cotizacion.service';

/** ORDER BY permitidos (lista blanca: nunca se concatena texto del cliente). */
const ORDEN_SQL: Record<OrdenBusqueda, string> = {
  relevancia: 'b.distancia_km NULLS LAST, b.precio_desde_noche, a.codigo',
  precio_asc: 'b.precio_desde_noche, a.codigo',
  precio_desc: 'b.precio_desde_noche DESC, a.codigo',
  calificacion: 'b.calificacion DESC NULLS LAST, b.num_resenas DESC, a.codigo',
  distancia: 'b.distancia_km NULLS LAST, a.codigo',
};

const iso = (d: Date | string): string => new Date(d).toISOString();

interface FilaDetalle {
  aloj_id: string;
  codigo: number;
  nombre: string;
  tipo: string;
  ciudad_id: number;
  ciudad: string;
  provincia: string;
  direccion: string;
  latitud: number;
  longitud: number;
  estrellas: number | null;
  calificacion: number | null;
  num_resenas: number;
  precio_desde: number | null;
  portada: string | null;
  descripcion: string;
  reglas_casa: string | null;
  hora_checkin: string;
  hora_checkout: string;
  noches_min: number;
  noches_max: number;
  modo_reserva: string;
  politica_id: number;
  total: number;
}

@Injectable()
export class CatalogoService {
  constructor(
    private readonly db: DbService,
    private readonly cotizacion: CotizacionService,
  ) {}

  /** POST /search -> fn_buscar_alojamientos; paginación con cursor opaco. */
  async buscar(dto: SearchAccommodationRequestDto, requestId: string): Promise<SearchAccommodationResponse> {
    this.cotizacion.validarFechas(dto.checkin, dto.checkout);
    const filas = dto.rows ?? 100;
    const offset = decodificarCursor(dto.page);
    const orden = ORDEN_SQL[dto.sort_by ?? OrdenBusqueda.relevancia];
    const res = await this.db.query<{ codigo: number; total: number }>(
      `SELECT a.codigo, count(*) OVER()::int AS total
         FROM fn_buscar_alojamientos($1::date, $2::date, $3::int, $4::provincia_ec, $5::smallint, $6::char(3),
                                     $7::numeric, $8::smallint, $9::numeric, $10::smallint, 100000, 0) b
         JOIN alojamiento a ON a.id = b.alojamiento_id
        ORDER BY ${orden}
        LIMIT $11 OFFSET $12`,
      [
        dto.checkin, dto.checkout, totalHuespedes(dto.guests), dto.province ?? null, dto.city ?? null,
        dto.airport ?? null, dto.max_airport_km ?? null, dto.accommodation_type ?? null, dto.max_price ?? null,
        dto.min_stars ?? null, filas, offset,
      ],
    );
    const total = res[0]?.total ?? 0;
    return {
      request_id: requestId,
      data: res.map((r) => ({ id: r.codigo, url: this.cotizacion.urlAlojamiento(r.codigo) })),
      next_page: offset + filas < total ? codificarCursor(offset + filas) : null,
    };
  }

  /** POST /availability: un producto por unidad con cupo y capacidad. */
  async disponibilidad(dto: AvailabilityRequestDto, requestId: string): Promise<AvailabilityResponse> {
    const existe = await this.db.uno(
      `SELECT 1 FROM alojamiento a WHERE a.codigo = $1 AND a.estado = 'PUBLICADO'`,
      [dto.accommodation],
    );
    if (!existe) throw noEncontrado('El alojamiento no existe o no está publicado');
    const mapa = await this.cotizacion.productosPorAlojamiento(
      [dto.accommodation], dto.checkin, dto.checkout, dto.guests.number_of_rooms, totalHuespedes(dto.guests),
    );
    return {
      request_id: requestId,
      data: {
        id: dto.accommodation,
        currency: 'USD',
        products: mapa.get(dto.accommodation) ?? [],
        url: this.cotizacion.urlAlojamiento(dto.accommodation),
      },
    };
  }

  /** POST /bulk-availability: producto más barato por alojamiento. meal_plan no soportado (se ignora). */
  async disponibilidadMultiple(dto: BulkAvailabilityRequestDto, requestId: string): Promise<BulkAvailabilityResponse> {
    const codigos = [...new Set(dto.accommodations)];
    const mapa = await this.cotizacion.productosPorAlojamiento(
      codigos, dto.checkin, dto.checkout, dto.guests.number_of_rooms, totalHuespedes(dto.guests),
    );
    const tipo = dto.filters?.cancellation_type?.toUpperCase();
    return {
      request_id: requestId,
      data: codigos.map((codigo) => {
        const productos = (mapa.get(codigo) ?? []).filter((p) => !tipo || p.cancellation_policy.name === tipo);
        const masBarato = productos.reduce<(typeof productos)[number] | null>(
          (min, p) => (!min || p.price.total < min.price.total ? p : min), null,
        );
        return { id: codigo, currency: 'USD', available: !!masBarato, cheapest_product: masBarato, url: this.cotizacion.urlAlojamiento(codigo) };
      }),
    };
  }

  /** POST /details: datos base + extras pedidos (description, bundles, facilities, payment, photos, policies, rooms). */
  async detalles(dto: AccommodationDetailsRequestDto, requestId: string): Promise<AccommodationDetailsResponse> {
    if (dto.country && dto.country !== 'ec') return { request_id: requestId, data: [], next_page: null };
    const filas = dto.rows ?? 20;
    const offset = decodificarCursor(dto.page);
    const base = await this.db.query<FilaDetalle>(
      `SELECT a.id AS aloj_id, a.codigo, a.nombre, ta.nombre AS tipo, c.id AS ciudad_id, c.nombre AS ciudad,
              c.provincia::text AS provincia, a.direccion, a.latitud, a.longitud, a.categoria_estrellas AS estrellas,
              r.calificacion, r.num_resenas::int AS num_resenas, r.precio_desde, r.portada, a.descripcion, a.reglas_casa,
              to_char(a.hora_checkin, 'HH24:MI') AS hora_checkin, to_char(a.hora_checkout, 'HH24:MI') AS hora_checkout,
              a.noches_min, a.noches_max, a.modo_reserva::text AS modo_reserva, a.politica_id, count(*) OVER()::int AS total
         FROM alojamiento a
         JOIN tipo_alojamiento ta ON ta.id = a.tipo_id
         JOIN ciudad c ON c.id = a.ciudad_id
         JOIN v_alojamiento_resumen r ON r.id = a.id
        WHERE a.estado = 'PUBLICADO'
          AND ($1::int[] IS NULL OR a.codigo = ANY($1::int[]))
          AND ($2::smallint IS NULL OR a.ciudad_id = $2::smallint)
        ORDER BY a.codigo LIMIT $3 OFFSET $4`,
      [dto.accommodations?.length ? dto.accommodations : null, dto.city ?? null, filas, offset],
    );
    const ids = base.map((b) => b.aloj_id);
    const extras = new Set<string>(dto.extras ?? []);
    const [aeropuertos, facilidades, fotos, habitaciones, politicas] = await Promise.all([
      this.agrupar<{ aloj_id: string; iata: string; name: string; distance_km: number; time_min: number; transfer: boolean }>(
        `SELECT aa.alojamiento_id AS aloj_id, ae.codigo_iata AS iata, ae.nombre AS name, aa.distancia_km AS distance_km,
                aa.tiempo_min AS time_min, aa.ofrece_transfer AS transfer
           FROM alojamiento_aeropuerto aa JOIN aeropuerto ae ON ae.id = aa.aeropuerto_id
          WHERE aa.alojamiento_id = ANY($1::uuid[]) ORDER BY aa.distancia_km`, ids),
      extras.has('facilities')
        ? this.agrupar<{ aloj_id: string; id: number; name: string; category: string }>(
            `SELECT x.alojamiento_id AS aloj_id, m.id, m.nombre AS name, m.categoria AS category
               FROM alojamiento_amenidad x JOIN amenidad m ON m.id = x.amenidad_id
              WHERE x.alojamiento_id = ANY($1::uuid[]) ORDER BY m.categoria, m.nombre`, ids)
        : null,
      extras.has('photos')
        ? this.agrupar<{ aloj_id: string; url: string; order: number; cover: boolean }>(
            `SELECT alojamiento_id AS aloj_id, url, orden AS "order", es_portada AS cover
               FROM imagen_alojamiento WHERE alojamiento_id = ANY($1::uuid[]) ORDER BY es_portada DESC, orden`, ids)
        : null,
      extras.has('rooms')
        ? this.agrupar<{ aloj_id: string; name: string; max_occupancy: number; bedrooms: number; beds: number; bathrooms: number; quantity: number; base_price_per_night: number }>(
            `SELECT alojamiento_id AS aloj_id, nombre AS name, capacidad_huespedes AS max_occupancy, num_habitaciones AS bedrooms,
                    num_camas AS beds, num_banos AS bathrooms, cantidad AS quantity, precio_noche_base AS base_price_per_night
               FROM unidad_alojamiento WHERE alojamiento_id = ANY($1::uuid[]) AND activa ORDER BY precio_noche_base`, ids)
        : null,
      extras.has('policies') ? this.cotizacion.politicas([...new Set(base.map((b) => b.politica_id))]) : null,
    ]);

    const data: DetalleAlojamiento[] = base.map((b) => {
      const d: DetalleAlojamiento = {
        id: b.codigo,
        name: b.nombre,
        type: b.tipo,
        url: this.cotizacion.urlAlojamiento(b.codigo),
        country: 'ec',
        city: { id: b.ciudad_id, name: b.ciudad, province: b.provincia },
        location: { address: b.direccion, latitude: b.latitud, longitude: b.longitud },
        stars: b.estrellas,
        rating: { score: b.calificacion, reviews: b.num_resenas },
        price_from: b.precio_desde,
        currency: 'USD',
        cover_photo: b.portada,
        airports: (aeropuertos.get(b.aloj_id) ?? []).map(({ aloj_id: _a, ...x }) => x),
      };
      if (extras.has('description')) d.description = b.descripcion;
      if (extras.has('bundles')) d.bundles = [];
      if (facilidades) d.facilities = (facilidades.get(b.aloj_id) ?? []).map(({ aloj_id: _a, ...x }) => x);
      if (extras.has('payment')) d.payment = { methods: ['simulado'] };
      if (fotos) d.photos = (fotos.get(b.aloj_id) ?? []).map(({ aloj_id: _a, ...x }) => x);
      if (habitaciones) d.rooms = (habitaciones.get(b.aloj_id) ?? []).map(({ aloj_id: _a, ...x }) => x);
      if (politicas) {
        d.policies = {
          cancellation: politicas.get(b.politica_id) as PoliticaCancelacion,
          checkin_from: b.hora_checkin,
          checkout_until: b.hora_checkout,
          min_nights: b.noches_min,
          max_nights: b.noches_max,
          booking_mode: b.modo_reserva,
          house_rules: b.reglas_casa,
        };
      }
      return d;
    });
    const total = base[0]?.total ?? 0;
    return { request_id: requestId, data, next_page: offset + filas < total ? codificarCursor(offset + filas) : null };
  }

  /** POST /details/changes: alojamientos con updated_at posterior a last_change. */
  async cambios(dto: DetailsChangesRequestDto, requestId: string): Promise<DetailsChangesResponse> {
    const ahora = new Date().toISOString();
    const paisOk = !dto.filters?.countries?.length || dto.filters.countries.includes('ec');
    const filas = paisOk
      ? await this.db.query<{ codigo: number; estado: string; updated_at: Date }>(
          `SELECT a.codigo, a.estado::text AS estado, a.updated_at
             FROM alojamiento a
            WHERE a.updated_at > $1::timestamptz AND ($2::smallint[] IS NULL OR a.ciudad_id = ANY($2::smallint[]))
            ORDER BY a.updated_at LIMIT 1000`,
          [dto.last_change, dto.filters?.cities?.length ? dto.filters.cities : null],
        )
      : [];
    return {
      request_id: requestId,
      data: {
        from: iso(dto.last_change),
        next: filas.length ? iso(filas[filas.length - 1].updated_at) : ahora,
        total_changes: filas.length,
        changes: { accommodations: filas.map((f) => ({ id: f.codigo, status: f.estado, updated_at: iso(f.updated_at) })) },
      },
    };
  }

  /** POST /chains: el prototipo no maneja cadenas hoteleras. */
  cadenas(requestId: string): ChainsResponse {
    return { request_id: requestId, data: [] };
  }

  /** POST /constants: catálogos del sistema. */
  async constantes(dto: ConstantsRequestDto, requestId: string): Promise<ConstantsResponse> {
    const consultas: Record<string, string> = {
      accommodation_types: `SELECT id, nombre AS name FROM tipo_alojamiento ORDER BY nombre`,
      facilities: `SELECT id, nombre AS name, categoria AS category FROM amenidad ORDER BY categoria, nombre`,
      cancellation_policies: `SELECT id, nombre AS name, descripcion AS description FROM politica_cancelacion ORDER BY id`,
      provinces: `SELECT p::text AS name FROM unnest(enum_range(NULL::provincia_ec)) p`,
      cities: `SELECT id, nombre AS name, provincia::text AS province FROM ciudad ORDER BY provincia, nombre`,
      airports: `SELECT ae.id, ae.codigo_iata AS iata, ae.nombre AS name, c.nombre AS city FROM aeropuerto ae JOIN ciudad c ON c.id = ae.ciudad_id ORDER BY ae.codigo_iata`,
      booking_statuses: `SELECT e::text AS name FROM unnest(enum_range(NULL::estado_reserva)) e`,
    };
    const pedidas = dto.constants?.length ? dto.constants.filter((c) => c in consultas) : Object.keys(consultas);
    const data: Record<string, object[]> = {};
    await Promise.all(pedidas.map(async (c) => (data[c] = await this.db.query<object>(consultas[c]))));
    return { request_id: requestId, data };
  }

  /** POST /reviews: reseñas publicadas, más recientes primero. */
  async resenas(dto: ReviewsRequestDto, requestId: string): Promise<ReviewsResponse> {
    const filas = dto.rows ?? 20;
    const offset = decodificarCursor(dto.page);
    const res = await this.db.query<{
      id: string; codigo: number; nota: number; comentario: string | null; autor: string; creada: Date; respuesta: string | null; total: number;
    }>(
      `SELECT rs.id, a.codigo, rs.nota_global AS nota, rs.comentario, u.nombres || ' ' || left(u.apellidos, 1) || '.' AS autor,
              rs.created_at AS creada, rs.respuesta_anfitrion AS respuesta, count(*) OVER()::int AS total
         FROM resena rs
         JOIN reserva rv ON rv.id = rs.reserva_id
         JOIN alojamiento a ON a.id = rv.alojamiento_id
         JOIN usuario u ON u.id = rv.huesped_id
        WHERE rs.estado = 'PUBLICADA' AND a.codigo = ANY($1::int[])
        ORDER BY rs.created_at DESC LIMIT $2 OFFSET $3`,
      [dto.accommodations, filas, offset],
    );
    const total = res[0]?.total ?? 0;
    return {
      request_id: requestId,
      data: res.map((r) => ({
        id: r.id, accommodation_id: r.codigo, score: r.nota, comment: r.comentario, author: r.autor,
        created_at: iso(r.creada), host_reply: r.respuesta,
      })),
      next_page: offset + filas < total ? codificarCursor(offset + filas) : null,
    };
  }

  /** POST /reviews/scores: promedio (v_alojamiento_resumen) y distribución por nota. */
  async puntajes(dto: ReviewsScoresRequestDto, requestId: string): Promise<ReviewsScoresResponse> {
    const res = await this.db.query<{ codigo: number; calificacion: number | null; num: number; distribucion: Record<string, number> }>(
      `SELECT a.codigo, r.calificacion, r.num_resenas::int AS num,
              COALESCE((SELECT json_object_agg(d.nota, d.n) FROM (
                 SELECT rs.nota_global AS nota, count(*)::int AS n FROM resena rs JOIN reserva rv ON rv.id = rs.reserva_id
                  WHERE rv.alojamiento_id = r.id AND rs.estado = 'PUBLICADA' GROUP BY rs.nota_global) d), '{}'::json) AS distribucion
         FROM v_alojamiento_resumen r JOIN alojamiento a ON a.id = r.id
        WHERE a.codigo = ANY($1::int[]) AND r.estado = 'PUBLICADO' ORDER BY a.codigo`,
      [dto.accommodations],
    );
    return {
      request_id: requestId,
      data: res.map((r) => ({ id: r.codigo, score: r.calificacion, number_of_reviews: r.num, distribution: r.distribucion })),
    };
  }

  private async agrupar<T extends { aloj_id: string }>(sql: string, ids: string[]): Promise<Map<string, T[]>> {
    const mapa = new Map<string, T[]>();
    if (!ids.length) return mapa;
    for (const fila of await this.db.query<T>(sql, [ids])) {
      const lista = mapa.get(fila.aloj_id) ?? [];
      lista.push(fila);
      mapa.set(fila.aloj_id, lista);
    }
    return mapa;
  }
}
