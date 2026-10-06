import { Injectable } from '@nestjs/common';
import { UsuarioToken } from '../../common/auth/decorators';
import { Listado } from '../../common/http/respuestas';
import { invalido, noEncontrado } from '../../common/problem/problem';
import { DbService } from '../../database/db.service';
import {
  AeropuertoDto, AmenidadDto, CiudadDto, FiltroAlojamientosDto, FiltroEventosDto, FiltroUsuariosDto,
  ImpuestoDto, TipoAlojamientoDto,
} from './dto/admin.dto';

type Fila = Record<string, unknown>;

/**
 * Panel del ADMIN (operador de Posada EC): indicadores (vistas v_*), catálogo de alojamientos, usuarios,
 * catálogos, impuestos y eventos. Crear/editar alojamientos usa las rutas /host/* (solo ADMIN).
 */
@Injectable()
export class AdminService {
  constructor(private readonly db: DbService) {}

  async indicadores(): Promise<Fila> {
    return (await this.db.uno<Fila>(`SELECT * FROM v_admin_indicadores`)) ?? {};
  }

  ventasPorCiudad(): Promise<Fila[]> {
    return this.db.query(`SELECT provincia::text AS provincia, ciudad, reservas::int AS reservas, noches::int AS noches, volumen FROM v_ventas_por_ciudad ORDER BY volumen DESC`);
  }

  topAlojamientos(): Promise<Fila[]> {
    return this.db.query(
      `SELECT a.codigo, t.nombre, t.reservas::int AS reservas, t.volumen
         FROM v_top_alojamientos t JOIN alojamiento a ON a.id = t.id LIMIT 10`,
    );
  }

  async alojamientos(f: FiltroAlojamientosDto): Promise<Listado<Fila>> {
    return this.paginar(
      `SELECT a.codigo, a.nombre, a.estado::text AS estado, c.nombre AS ciudad, t.nombre AS tipo, u.email AS anfitrion,
              (SELECT count(*)::int FROM unidad_alojamiento x WHERE x.alojamiento_id = a.id AND x.activa) AS unidades_activas,
              a.created_at, a.updated_at
         FROM alojamiento a
         JOIN ciudad c ON c.id = a.ciudad_id JOIN usuario u ON u.id = a.anfitrion_id
         JOIN tipo_alojamiento t ON t.id = a.tipo_id
        WHERE ($1::estado_alojamiento IS NULL OR a.estado = $1::estado_alojamiento)
          AND ($2::text IS NULL OR a.nombre ILIKE '%' || $2 || '%' OR c.nombre ILIKE '%' || $2 || '%' OR a.codigo::text = $2)
        ORDER BY a.updated_at DESC`,
      [f.estado ?? null, f.q || null],
      f.limit,
      f.offset,
    );
  }

  async estadoAlojamiento(codigo: number, estado: string): Promise<{ codigo: number; estado: string }> {
    const r = await this.db.query(
      `UPDATE alojamiento a SET estado = $2
        WHERE a.codigo = $1 AND a.estado <> 'BORRADOR' RETURNING a.id`,
      [codigo, estado],
    );
    if (!r.length) throw noEncontrado('El alojamiento no existe o está en borrador');
    return { codigo, estado };
  }

  async usuarios(f: FiltroUsuariosDto): Promise<Listado<Fila>> {
    return this.paginar(
      `SELECT u.id, u.email, u.nombres, u.apellidos, u.rol::text AS rol, u.activo, u.created_at,
              EXISTS (SELECT 1 FROM alojamiento a WHERE a.anfitrion_id = u.id) AS es_anfitrion
         FROM usuario u
        WHERE ($1::text IS NULL OR u.email ILIKE '%' || $1 || '%' OR u.nombres ILIKE '%' || $1 || '%' OR u.apellidos ILIKE '%' || $1 || '%')
        ORDER BY u.created_at`,
      [f.q || null],
      f.limit,
      f.offset,
    );
  }

  async estadoUsuario(id: string, activo: boolean, admin: UsuarioToken): Promise<{ id: string; activo: boolean }> {
    if (id === admin.sub) throw invalido('No puedes desactivar tu propia cuenta');
    const r = await this.db.query(`UPDATE usuario SET activo = $2 WHERE id = $1 RETURNING id`, [id, activo]);
    if (!r.length) throw noEncontrado('El usuario no existe');
    return { id, activo };
  }

  async catalogos(): Promise<Record<string, Fila[]>> {
    const [tipos, amenidades, politicas, ciudades, aeropuertos] = await Promise.all([
      this.db.query<Fila>(`SELECT id, nombre FROM tipo_alojamiento ORDER BY nombre`),
      this.db.query<Fila>(`SELECT id, nombre, categoria FROM amenidad ORDER BY categoria, nombre`),
      this.db.query<Fila>(`SELECT id, nombre, descripcion FROM politica_cancelacion ORDER BY id`),
      this.db.query<Fila>(`SELECT id, provincia::text AS provincia, nombre, latitud, longitud FROM ciudad ORDER BY provincia, nombre`),
      this.db.query<Fila>(`SELECT id, codigo_iata, nombre, ciudad_id FROM aeropuerto ORDER BY codigo_iata`),
    ]);
    return { tipos, amenidades, politicas, ciudades, aeropuertos };
  }

  crearAmenidad(d: AmenidadDto): Promise<Fila | null> {
    return this.db.uno(`INSERT INTO amenidad (nombre, categoria) VALUES ($1, $2) RETURNING id, nombre, categoria`, [d.nombre, d.categoria]);
  }

  crearTipo(d: TipoAlojamientoDto): Promise<Fila | null> {
    return this.db.uno(`INSERT INTO tipo_alojamiento (nombre) VALUES ($1) RETURNING id, nombre`, [d.nombre]);
  }

  crearCiudad(d: CiudadDto): Promise<Fila | null> {
    return this.db.uno(
      `INSERT INTO ciudad (provincia, nombre, latitud, longitud) VALUES ($1::provincia_ec, $2, $3, $4) RETURNING id, provincia::text AS provincia, nombre`,
      [d.provincia, d.nombre, d.latitud ?? null, d.longitud ?? null],
    );
  }

  crearAeropuerto(d: AeropuertoDto): Promise<Fila | null> {
    return this.db.uno(
      `INSERT INTO aeropuerto (codigo_iata, nombre, ciudad_id, latitud, longitud) VALUES ($1, $2, $3, $4, $5) RETURNING id, codigo_iata, nombre`,
      [d.codigo_iata, d.nombre, d.ciudad_id, d.latitud, d.longitud],
    );
  }

  impuestos(): Promise<Fila[]> {
    return this.db.query(
      `SELECT id, nombre, tipo::text AS tipo, porcentaje, vigente_desde, vigente_hasta, requiere_registro_turismo, estrellas_minimas
         FROM impuesto_tarifa ORDER BY tipo, vigente_desde DESC`,
    );
  }

  crearImpuesto(d: ImpuestoDto): Promise<Fila | null> {
    if (d.vigente_hasta && d.vigente_hasta < d.vigente_desde) {
      throw invalido('vigente_hasta debe ser >= vigente_desde', [{ name: 'vigente_hasta', reason: 'anterior a vigente_desde' }]);
    }
    return this.db.uno(
      `INSERT INTO impuesto_tarifa (nombre, tipo, porcentaje, vigente_desde, vigente_hasta, requiere_registro_turismo, estrellas_minimas)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, nombre`,
      [d.nombre, d.tipo, d.porcentaje, d.vigente_desde, d.vigente_hasta ?? null, d.requiere_registro_turismo ?? false, d.estrellas_minimas ?? null],
    );
  }

  /** Las tarifas no se editan ni borran: solo se cierra su vigencia (histórico intacto). */
  async cerrarImpuesto(id: number, hasta: string): Promise<{ id: number; vigente_hasta: string }> {
    const r = await this.db.query(`UPDATE impuesto_tarifa SET vigente_hasta = $2 WHERE id = $1 RETURNING id`, [id, hasta]);
    if (!r.length) throw noEncontrado('La tarifa no existe');
    return { id, vigente_hasta: hasta };
  }

  async eventos(f: FiltroEventosDto): Promise<Listado<Fila>> {
    return this.paginar(
      `SELECT id, tipo, agregado, agregado_id, correlacion_id, created_at, publicado_en, payload
         FROM evento_outbox WHERE ($1::text IS NULL OR tipo = $1) ORDER BY id DESC`,
      [f.tipo || null],
      f.limit,
      f.offset,
    );
  }

  /** Envuelve una consulta para devolver {items,total,limit,offset}. */
  private async paginar(sql: string, params: unknown[], limit: number, offset: number): Promise<Listado<Fila>> {
    const n = params.length;
    const filas = await this.db.query<Fila & { total_filas: number }>(
      `SELECT x.*, count(*) OVER()::int AS total_filas FROM (${sql}) x LIMIT $${n + 1} OFFSET $${n + 2}`,
      [...params, limit, offset],
    );
    return {
      items: filas.map(({ total_filas: _t, ...resto }) => resto),
      total: filas[0]?.total_filas ?? 0,
      limit,
      offset,
    };
  }
}
