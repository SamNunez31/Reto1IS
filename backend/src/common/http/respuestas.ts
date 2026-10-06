import { invalido } from '../problem/problem';

/** Formato de éxito de las rutas propias (visto en clase). */
export interface RespuestaApi<T> {
  status: 'success';
  message: string;
  data: T;
}

/** Formato de listados de las rutas propias. */
export interface Listado<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export function ok<T>(data: T, message = 'Operación exitosa'): RespuestaApi<T> {
  return { status: 'success', message, data };
}

export function listado<T>(items: T[], total: number, limit: number, offset: number): RespuestaApi<Listado<T>> {
  return ok({ items, total, limit, offset });
}

/** Cursor opaco de paginación del contrato: base64url del offset. */
export function codificarCursor(offset: number): string {
  return Buffer.from(`o:${offset}`).toString('base64url');
}

export function decodificarCursor(page: string | undefined, campo = 'page'): number {
  if (!page) return 0;
  const texto = Buffer.from(page, 'base64url').toString('utf8');
  const m = /^o:(\d{1,7})$/.exec(texto);
  if (!m) throw invalido('Cursor de página inválido', [{ name: campo, reason: 'cursor no reconocido' }]);
  return Number(m[1]);
}

/** Fecha de hoy en Ecuador (la BD también usa America/Guayaquil). */
export function hoyEcuador(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil' }).format(new Date());
}

export function noches(checkin: string, checkout: string): number {
  return Math.round((Date.parse(`${checkout}T00:00:00Z`) - Date.parse(`${checkin}T00:00:00Z`)) / 86_400_000);
}
