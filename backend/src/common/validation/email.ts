/** Correo canónico: sin espacios en los extremos y en minúsculas (la BD exige email = lower(email) y UNIQUE). */
export function normalizarEmail<T>(valor: T): T | string {
  return typeof valor === 'string' ? valor.trim().toLowerCase() : valor;
}

export const MENSAJE_EMAIL_DUPLICADO = 'Ya existe una cuenta con este correo';

/** true si el error de Postgres es la violación de unicidad del correo (uq_usuario_email). */
export function esEmailDuplicado(err: unknown): boolean {
  const pg = (err as { driverError?: { code?: string; constraint?: string } })?.driverError ?? (err as { code?: string; constraint?: string });
  return pg?.code === '23505' && pg?.constraint === 'uq_usuario_email';
}
