import { InvalidParam, ProblemCode } from './problem';

interface Mapeo {
  status: number;
  code: ProblemCode;
  retryAfter?: number;
}

/**
 * Las funciones y triggers de la BD lanzan `RAISE EXCEPTION 'CODIGO: mensaje'`.
 * Aquí se traduce cada CODIGO al estado HTTP y al código del contrato.
 */
const MAPEO_NEGOCIO: Record<string, Mapeo> = {
  SIN_DISPONIBILIDAD: { status: 409, code: 'ROOM_NO_LONGER_AVAILABLE' },
  UNIDAD_INACTIVA: { status: 409, code: 'ROOM_NO_LONGER_AVAILABLE' },
  NO_RESERVABLE: { status: 409, code: 'ROOM_NO_LONGER_AVAILABLE' },
  PRECIO_CAMBIO: { status: 409, code: 'PRICE_CHANGED', retryAfter: 1 },
  PREVIEW_EXPIRADO: { status: 409, code: 'PRICE_CHANGED', retryAfter: 1 },
  CAPACIDAD_EXCEDIDA: { status: 400, code: 'VALIDATION_FAILED' },
  FECHAS_INVALIDAS: { status: 400, code: 'VALIDATION_FAILED' },
  ESTANCIA_INVALIDA: { status: 400, code: 'VALIDATION_FAILED' },
  FECHA_PASADA: { status: 400, code: 'VALIDATION_FAILED' },
  RESERVA_SIN_DETALLE: { status: 400, code: 'VALIDATION_FAILED' },
  UNIDAD_AJENA: { status: 400, code: 'VALIDATION_FAILED' },
  RESENA_INVALIDA: { status: 400, code: 'VALIDATION_FAILED' },
  AUTORESERVA: { status: 403, code: 'VALIDATION_FAILED' },
  HUESPED_INVALIDO: { status: 403, code: 'VALIDATION_FAILED' },
  ANFITRION_INVALIDO: { status: 403, code: 'VALIDATION_FAILED' },
  NO_AUTORIZADO: { status: 403, code: 'VALIDATION_FAILED' },
  TRANSICION_INVALIDA: { status: 409, code: 'CANCELLATION_NOT_ALLOWED' },
  ESTADO_INVALIDO: { status: 409, code: 'CANCELLATION_NOT_ALLOWED' },
  MODIFICACION_NO_PERMITIDA: { status: 409, code: 'BOOKING_NOT_CONFIRMED' },
  SOLICITUD_EXPIRADA: { status: 409, code: 'BOOKING_NOT_CONFIRMED' },
  PREVIEW_NO_EXISTE: { status: 404, code: 'VALIDATION_FAILED' },
  RESERVA_NO_EXISTE: { status: 404, code: 'VALIDATION_FAILED' },
  ALOJAMIENTO_NO_EXISTE: { status: 404, code: 'VALIDATION_FAILED' },
};

/** Campo del cuerpo al que se atribuye cada error de validación de la BD. */
const CAMPO_POR_CODIGO: Record<string, string> = {
  CAPACIDAD_EXCEDIDA: 'guests',
  FECHAS_INVALIDAS: 'checkout',
  ESTANCIA_INVALIDA: 'checkout',
  FECHA_PASADA: 'checkin',
};

export interface ErrorTraducido {
  status: number;
  code: ProblemCode;
  detail: string;
  retryAfter?: number;
  invalidParams?: InvalidParam[];
}

interface ErrorPg {
  code?: string;
  message?: string;
}

/** Devuelve el error traducido o null si no es un error de Postgres reconocible. */
export function traducirErrorPostgres(err: unknown): ErrorTraducido | null {
  const candidato = (err as { driverError?: ErrorPg })?.driverError ?? (err as ErrorPg);
  const sqlState = candidato?.code;
  const mensaje = candidato?.message ?? '';
  if (!sqlState || typeof sqlState !== 'string' || sqlState.length !== 5) return null;

  // P0001 = RAISE EXCEPTION de nuestras funciones/triggers
  if (sqlState === 'P0001') {
    const m = /^([A-Z_]+)(?::\s*(.*))?$/s.exec(mensaje);
    const clave = m?.[1] ?? '';
    const mapeo = MAPEO_NEGOCIO[clave];
    if (!mapeo) return null;
    const detail = (m?.[2] || clave.replace(/_/g, ' ').toLowerCase()).trim();
    const campo = CAMPO_POR_CODIGO[clave];
    return {
      ...mapeo,
      detail,
      invalidParams: campo && mapeo.status === 400 ? [{ name: campo, reason: detail }] : undefined,
    };
  }
  // Violaciones de integridad: mensajes genéricos (nunca se expone SQL)
  if (sqlState === '23505') return { status: 409, code: 'VALIDATION_FAILED', detail: 'Ya existe un registro con esos datos' };
  if (sqlState === '23503') return { status: 400, code: 'VALIDATION_FAILED', detail: 'Hace referencia a un registro que no existe o está en uso' };
  if (sqlState === '23514' || sqlState === '23502')
    return { status: 400, code: 'VALIDATION_FAILED', detail: 'Los datos no cumplen las reglas del sistema' };
  if (sqlState.startsWith('22')) return { status: 400, code: 'VALIDATION_FAILED', detail: 'Formato de dato inválido' };
  return null;
}
