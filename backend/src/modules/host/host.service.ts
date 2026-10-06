import { Injectable } from '@nestjs/common';
import { UsuarioToken } from '../../common/auth/decorators';
import { Listado } from '../../common/http/respuestas';
import { conflicto, invalido, noEncontrado } from '../../common/problem/problem';
import { Consulta, DbService } from '../../database/db.service';
import {
  ActualizarAlojamientoDto, ActualizarUnidadDto, CalendarioDto, CrearAlojamientoDto, FiltroReservasHostDto, UnidadDto,
} from './dto/host.dto';

/** Columnas de alojamiento que el anfitrión puede escribir (lista blanca para el UPDATE dinámico). */
const COLUMNAS_ALOJ = [
  'tipo_id', 'ciudad_id', 'politica_id', 'nombre', 'descripcion', 'direccion', 'latitud', 'longitud', 'telefono_contacto',
  'hora_checkin', 'hora_checkout', 'noches_min', 'noches_max', 'tarifa_limpieza', 'modo_reserva', 'reglas_casa',
  'categoria_estrellas', 'registro_turismo', 'luaf',
] as const;
const COLUMNAS_UNIDAD = ['nombre', 'capacidad_huespedes', 'num_habitaciones', 'num_camas', 'num_banos', 'cantidad', 'precio_noche_base', 'activa'] as const;

export interface ResumenAlojamiento {
  codigo: number;
  nombre: string;
  tipo: string;
  ciudad: string;
  provincia: string;
  estado: string;
  modo_reserva: string;
  precio_desde: number | null;
  portada: string | null;
  calificacion: number | null;
  num_resenas: number;
  unidades_activas: number;
}

export interface UnidadHost {
  id: string;
  nombre: string;
  capacidad_huespedes: number;
  num_habitaciones: number;
  num_camas: number;
  num_banos: number;
  cantidad: number;
  precio_noche_base: number;
  activa: boolean;
}

export interface SolicitudHost {
  id: string;
  codigo: string;
  estado: string;
  alojamiento: string;
  alojamiento_codigo: number;
  huesped: string;
  fecha_entrada: string;
  fecha_salida: string;
  num_huespedes: number;
  total: number;
  expira_en: string | null;
  created_at: string;
}

/**
 * Posada EC administra su catálogo: el controlador solo admite ADMIN, que opera sobre cualquier alojamiento
 * (excepción de ADMIN en las comprobaciones de propiedad). Si en el futuro vuelve el portal de anfitriones,
 * un USUARIO solo vería lo suyo y lo ajeno respondería 404 (no se revela que existe).
 * Todo alojamiento nuevo queda a nombre de quien lo crea (el admin) y con reserva inmediata.
 */
@Injectable()
export class HostService {
  constructor(private readonly db: DbService) {}

  /** null = sin filtro de dueño (ADMIN); si no, el id del usuario. */
  private dueno(user: UsuarioToken): string | null {
    return user.rol === 'ADMIN' ? null : user.sub;
  }

  async misAlojamientos(user: UsuarioToken): Promise<ResumenAlojamiento[]> {
    return this.db.query<ResumenAlojamiento>(
      `SELECT a.codigo, r.nombre, r.tipo, r.ciudad, r.provincia::text AS provincia, r.estado::text AS estado,
              r.modo_reserva::text AS modo_reserva, r.precio_desde, r.portada, r.calificacion, r.num_resenas::int AS num_resenas,
              (SELECT count(*)::int FROM unidad_alojamiento u WHERE u.alojamiento_id = a.id AND u.activa) AS unidades_activas
         FROM alojamiento a
         JOIN v_alojamiento_resumen r ON r.id = a.id
        WHERE ($1::uuid IS NULL OR a.anfitrion_id = $1) ORDER BY a.created_at DESC`,
      [this.dueno(user)],
    );
  }

  /** Crea el alojamiento en BORRADOR (con amenidades, imágenes y aeropuertos) en una sola transacción. */
  async crear(dto: CrearAlojamientoDto, user: UsuarioToken): Promise<{ codigo: number }> {
    this.validarNoches(dto.noches_min, dto.noches_max);
    return this.db.transaccion(async (q) => {
      const cols = COLUMNAS_ALOJ.filter((c) => dto[c] !== undefined);
      const valores = cols.map((c) => dto[c]);
      const [{ id }] = await q<{ id: string }>(
        `INSERT INTO alojamiento (anfitrion_id, ${cols.join(', ')})
         VALUES ($1, ${cols.map((_, i) => `$${i + 2}`).join(', ')}) RETURNING id`,
        [user.sub, ...valores],
      );
      await this.reemplazarHijos(q, id, dto);
      const [{ codigo }] = await q<{ codigo: number }>(`SELECT codigo FROM alojamiento WHERE id = $1`, [id]);
      return { codigo };
    });
  }

  async obtener(codigo: number, user: UsuarioToken): Promise<Record<string, unknown>> {
    const id = await this.idPropio(codigo, user);
    const aloj = await this.db.uno<Record<string, unknown>>(
      `SELECT a.codigo, a.tipo_id, a.ciudad_id, a.politica_id, a.nombre, a.descripcion, a.direccion, a.latitud, a.longitud,
              a.telefono_contacto, to_char(a.hora_checkin, 'HH24:MI') AS hora_checkin, to_char(a.hora_checkout, 'HH24:MI') AS hora_checkout,
              a.noches_min, a.noches_max, a.tarifa_limpieza, a.modo_reserva::text AS modo_reserva, a.reglas_casa,
              a.categoria_estrellas, a.registro_turismo, a.luaf, a.estado::text AS estado,
              COALESCE((SELECT array_agg(amenidad_id ORDER BY amenidad_id) FROM alojamiento_amenidad WHERE alojamiento_id = a.id), '{}') AS amenidades,
              COALESCE((SELECT json_agg(json_build_object('url', url, 'es_portada', es_portada) ORDER BY orden)
                          FROM imagen_alojamiento WHERE alojamiento_id = a.id), '[]') AS imagenes,
              COALESCE((SELECT json_agg(json_build_object('aeropuerto_id', aeropuerto_id, 'distancia_km', distancia_km,
                                                          'tiempo_min', tiempo_min, 'ofrece_transfer', ofrece_transfer))
                          FROM alojamiento_aeropuerto WHERE alojamiento_id = a.id), '[]') AS aeropuertos
         FROM alojamiento a WHERE a.id = $1`,
      [id],
    );
    return { ...aloj, unidades: await this.unidades(codigo, user) };
  }

  async actualizar(codigo: number, dto: ActualizarAlojamientoDto, user: UsuarioToken): Promise<Record<string, unknown>> {
    const id = await this.idPropio(codigo, user);
    this.validarNoches(dto.noches_min, dto.noches_max);
    await this.db.transaccion(async (q) => {
      const cols = COLUMNAS_ALOJ.filter((c) => dto[c] !== undefined);
      if (cols.length) {
        await q(`UPDATE alojamiento SET ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')} WHERE id = $1`, [id, ...cols.map((c) => dto[c])]);
      }
      await this.reemplazarHijos(q, id, dto);
    });
    return this.obtener(codigo, user);
  }

  /** BORRADOR <-> PUBLICADO. Un SUSPENDIDO solo lo reactiva el ADMIN. Publicar exige unidad activa y foto. */
  async cambiarPublicacion(codigo: number, publicar: boolean, user: UsuarioToken): Promise<{ estado: string }> {
    const id = await this.idPropio(codigo, user);
    const a = await this.db.uno<{ estado: string; unidades: number; fotos: number }>(
      `SELECT a.estado::text AS estado,
              (SELECT count(*)::int FROM unidad_alojamiento WHERE alojamiento_id = a.id AND activa) AS unidades,
              (SELECT count(*)::int FROM imagen_alojamiento WHERE alojamiento_id = a.id) AS fotos
         FROM alojamiento a WHERE a.id = $1`,
      [id],
    );
    if (a?.estado === 'SUSPENDIDO') throw conflicto('El alojamiento está suspendido por la administración');
    if (publicar && (!a?.unidades || !a?.fotos)) {
      throw invalido('Para publicar necesitas al menos una unidad activa y una foto', [
        { name: 'unidades', reason: `${a?.unidades ?? 0} activas` },
        { name: 'imagenes', reason: `${a?.fotos ?? 0} fotos` },
      ]);
    }
    const estado = publicar ? 'PUBLICADO' : 'BORRADOR';
    await this.db.query(`UPDATE alojamiento SET estado = $2 WHERE id = $1`, [id, estado]);
    return { estado };
  }

  async unidades(codigo: number, user: UsuarioToken): Promise<UnidadHost[]> {
    const id = await this.idPropio(codigo, user);
    return this.db.query<UnidadHost>(
      `SELECT id, nombre, capacidad_huespedes, num_habitaciones, num_camas, num_banos, cantidad, precio_noche_base, activa
         FROM unidad_alojamiento WHERE alojamiento_id = $1 ORDER BY precio_noche_base`,
      [id],
    );
  }

  async crearUnidad(codigo: number, dto: UnidadDto, user: UsuarioToken): Promise<UnidadHost> {
    const id = await this.idPropio(codigo, user);
    const cols = COLUMNAS_UNIDAD.filter((c) => dto[c] !== undefined);
    const fila = await this.db.uno<UnidadHost>(
      `INSERT INTO unidad_alojamiento (alojamiento_id, ${cols.join(', ')})
       VALUES ($1, ${cols.map((_, i) => `$${i + 2}`).join(', ')})
       RETURNING id, nombre, capacidad_huespedes, num_habitaciones, num_camas, num_banos, cantidad, precio_noche_base, activa`,
      [id, ...cols.map((c) => dto[c])],
    );
    return fila as UnidadHost;
  }

  async actualizarUnidad(unidadId: string, dto: ActualizarUnidadDto, user: UsuarioToken): Promise<UnidadHost> {
    await this.unidadPropia(unidadId, user);
    const cols = COLUMNAS_UNIDAD.filter((c) => dto[c] !== undefined);
    if (!cols.length) throw invalido('Nada que actualizar');
    const fila = await this.db.uno<UnidadHost>(
      `UPDATE unidad_alojamiento SET ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')} WHERE id = $1
       RETURNING id, nombre, capacidad_huespedes, num_habitaciones, num_camas, num_banos, cantidad, precio_noche_base, activa`,
      [unidadId, ...cols.map((c) => dto[c])],
    );
    return fila as UnidadHost;
  }

  /** Calendario: excepciones de precio/cupo y cupo libre calculado por la BD (fn_cupo_unidad) día a día. */
  async calendario(unidadId: string, desde: string, hasta: string, user: UsuarioToken): Promise<Record<string, unknown>[]> {
    await this.unidadPropia(unidadId, user);
    if (hasta < desde) throw invalido('Rango inválido', [{ name: 'hasta', reason: 'debe ser >= desde' }]);
    return this.db.query<Record<string, unknown>>(
      `SELECT d::date::text AS fecha, c.precio_noche, c.cantidad_a_la_venta,
              COALESCE(c.precio_noche, u.precio_noche_base) AS precio_efectivo,
              fn_cupo_unidad(u.id, d::date, d::date + 1) AS cupo_libre
         FROM unidad_alojamiento u
         CROSS JOIN generate_series($2::date, LEAST($3::date, $2::date + 92), interval '1 day') d
         LEFT JOIN calendario_unidad c ON c.unidad_id = u.id AND c.fecha = d::date
        WHERE u.id = $1 ORDER BY d`,
      [unidadId, desde, hasta],
    );
  }

  /** Guarda excepciones del calendario; si un día queda sin precio ni cupo especial, se quita la excepción. */
  async guardarCalendario(unidadId: string, dto: CalendarioDto, user: UsuarioToken): Promise<{ dias: number }> {
    await this.unidadPropia(unidadId, user);
    await this.db.transaccion(async (q) => {
      for (const d of dto.dias) {
        const precio = d.precio_noche ?? null;
        const cupo = d.cantidad_a_la_venta ?? null;
        if (precio === null && cupo === null) {
          await q(`DELETE FROM calendario_unidad WHERE unidad_id = $1 AND fecha = $2`, [unidadId, d.fecha]);
        } else {
          await q(
            `INSERT INTO calendario_unidad (unidad_id, fecha, precio_noche, cantidad_a_la_venta) VALUES ($1, $2, $3, $4)
             ON CONFLICT (unidad_id, fecha) DO UPDATE SET precio_noche = EXCLUDED.precio_noche, cantidad_a_la_venta = EXCLUDED.cantidad_a_la_venta`,
            [unidadId, d.fecha, precio, cupo],
          );
        }
      }
    });
    return { dias: dto.dias.length };
  }

  /** Reservas sobre los alojamientos (todos, para el ADMIN). */
  async reservas(user: UsuarioToken, f: FiltroReservasHostDto): Promise<Listado<SolicitudHost>> {
    const filas = await this.db.query<SolicitudHost & { total_filas: number }>(
      `SELECT r.id, r.codigo, r.estado::text AS estado, a.nombre AS alojamiento, a.codigo AS alojamiento_codigo,
              u.nombres || ' ' || u.apellidos AS huesped, r.fecha_entrada, r.fecha_salida, r.num_huespedes,
              t.total, r.expira_en, r.created_at, count(*) OVER()::int AS total_filas
         FROM reserva r
         JOIN alojamiento a ON a.id = r.alojamiento_id
         JOIN usuario u ON u.id = r.huesped_id
         JOIN v_reserva_total t ON t.reserva_id = r.id
        WHERE ($1::uuid IS NULL OR a.anfitrion_id = $1) AND ($2::estado_reserva IS NULL OR r.estado = $2::estado_reserva)
        ORDER BY (r.estado = 'PENDIENTE') DESC, r.fecha_entrada DESC LIMIT $3 OFFSET $4`,
      [this.dueno(user), f.estado ?? null, f.limit, f.offset],
    );
    return { items: filas.map(({ total_filas: _t, ...x }) => x), total: filas[0]?.total_filas ?? 0, limit: f.limit, offset: f.offset };
  }

  /**
   * Aceptar o rechazar una solicitud antigua (modo SOLICITUD, ya sin uso) -> fn_responder_solicitud.
   * La función exige el dueño real del alojamiento: se le pasa ese id (el ADMIN actúa en su nombre).
   */
  async responder(reservaId: string, acepta: boolean, user: UsuarioToken): Promise<{ estado: string }> {
    const fila = await this.db.uno<{ anfitrion_id: string }>(
      `SELECT a.anfitrion_id FROM reserva r JOIN alojamiento a ON a.id = r.alojamiento_id
        WHERE r.id = $1 AND ($2::uuid IS NULL OR a.anfitrion_id = $2)`,
      [reservaId, this.dueno(user)],
    );
    if (!fila) throw noEncontrado('La reserva no existe');
    const r = await this.db.uno<{ estado: string }>(`SELECT fn_responder_solicitud($1, $2, $3)::text AS estado`, [reservaId, fila.anfitrion_id, acepta]);
    return { estado: r?.estado ?? '' };
  }

  /** Ingresos por mes (v_ingresos_anfitrion; para el ADMIN, suma de todo el catálogo). */
  ingresos(user: UsuarioToken): Promise<{ mes: string; estancias: number; ingreso_sin_iva: number }[]> {
    return this.db.query(
      `SELECT mes, sum(estancias)::int AS estancias, sum(ingreso_sin_iva) AS ingreso_sin_iva
         FROM v_ingresos_anfitrion WHERE ($1::uuid IS NULL OR anfitrion_id = $1) GROUP BY mes ORDER BY mes DESC`,
      [this.dueno(user)],
    );
  }

  resenas(user: UsuarioToken): Promise<Record<string, unknown>[]> {
    return this.db.query(
      `SELECT rs.id, a.codigo AS alojamiento_codigo, a.nombre AS alojamiento, rs.nota_global, rs.comentario,
              rs.respuesta_anfitrion, rs.respondida_en, rs.created_at, u.nombres || ' ' || left(u.apellidos, 1) || '.' AS autor
         FROM resena rs
         JOIN reserva r ON r.id = rs.reserva_id
         JOIN alojamiento a ON a.id = r.alojamiento_id
         JOIN usuario u ON u.id = r.huesped_id
        WHERE ($1::uuid IS NULL OR a.anfitrion_id = $1) ORDER BY rs.created_at DESC`,
      [this.dueno(user)],
    );
  }

  /** Responder una reseña (una sola vez). */
  async responderResena(resenaId: string, respuesta: string, user: UsuarioToken): Promise<{ id: string }> {
    const fila = await this.db.uno<{ id: string; respondida: boolean }>(
      `SELECT rs.id, rs.respuesta_anfitrion IS NOT NULL AS respondida
         FROM resena rs JOIN reserva r ON r.id = rs.reserva_id JOIN alojamiento a ON a.id = r.alojamiento_id
        WHERE rs.id = $1 AND ($2::uuid IS NULL OR a.anfitrion_id = $2)`,
      [resenaId, this.dueno(user)],
    );
    if (!fila) throw noEncontrado('La reseña no existe');
    if (fila.respondida) throw conflicto('La reseña ya tiene respuesta');
    await this.db.query(`UPDATE resena SET respuesta_anfitrion = $2, respondida_en = now() WHERE id = $1`, [resenaId, respuesta]);
    return { id: resenaId };
  }

  // ---------------------------------------------------------------- utilidades

  private async idPropio(codigo: number, user: UsuarioToken): Promise<string> {
    const f = await this.db.uno<{ id: string }>(
      `SELECT a.id FROM alojamiento a WHERE a.codigo = $1 AND ($2::uuid IS NULL OR a.anfitrion_id = $2)`,
      [codigo, this.dueno(user)],
    );
    if (!f) throw noEncontrado('El alojamiento no existe');
    return f.id;
  }

  private async unidadPropia(unidadId: string, user: UsuarioToken): Promise<void> {
    const f = await this.db.uno(
      `SELECT 1 FROM unidad_alojamiento u JOIN alojamiento a ON a.id = u.alojamiento_id WHERE u.id = $1 AND ($2::uuid IS NULL OR a.anfitrion_id = $2)`,
      [unidadId, this.dueno(user)],
    );
    if (!f) throw noEncontrado('La unidad no existe');
  }

  private validarNoches(min?: number, max?: number): void {
    if (min !== undefined && max !== undefined && max < min) {
      throw invalido('noches_max debe ser mayor o igual a noches_min', [{ name: 'noches_max', reason: 'menor que noches_min' }]);
    }
  }

  private async reemplazarHijos(q: Consulta, id: string, dto: ActualizarAlojamientoDto): Promise<void> {
    if (dto.amenidades) {
      await q(`DELETE FROM alojamiento_amenidad WHERE alojamiento_id = $1`, [id]);
      if (dto.amenidades.length) {
        await q(`INSERT INTO alojamiento_amenidad (alojamiento_id, amenidad_id) SELECT $1, unnest($2::smallint[]) ON CONFLICT DO NOTHING`, [id, dto.amenidades]);
      }
    }
    if (dto.imagenes) {
      await q(`DELETE FROM imagen_alojamiento WHERE alojamiento_id = $1`, [id]);
      const portada = Math.max(0, dto.imagenes.findIndex((i) => i.es_portada));
      for (const [orden, img] of dto.imagenes.entries()) {
        await q(`INSERT INTO imagen_alojamiento (alojamiento_id, url, orden, es_portada) VALUES ($1, $2, $3, $4)`, [id, img.url, orden, orden === portada]);
      }
    }
    if (dto.aeropuertos) {
      await q(`DELETE FROM alojamiento_aeropuerto WHERE alojamiento_id = $1`, [id]);
      for (const ae of dto.aeropuertos) {
        await q(
          `INSERT INTO alojamiento_aeropuerto (alojamiento_id, aeropuerto_id, distancia_km, tiempo_min, ofrece_transfer) VALUES ($1, $2, $3, $4, $5)`,
          [id, ae.aeropuerto_id, ae.distancia_km, ae.tiempo_min, ae.ofrece_transfer ?? false],
        );
      }
    }
  }
}
