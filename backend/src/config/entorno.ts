import { randomBytes } from 'crypto';
import { logJson } from '../common/logging/log-json';

export const esProduccion = (): boolean =>
  process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production';

/**
 * Valida las variables críticas al arrancar.
 * En producción la app NO arranca sin JWT_SECRET fuerte ni CORS_ORIGINS.
 */
export function validarEntorno(env: Record<string, unknown>): Record<string, unknown> {
  const errores: string[] = [];
  if (!env.DATABASE_URL) errores.push('DATABASE_URL es obligatoria');

  const secreto = typeof env.JWT_SECRET === 'string' ? env.JWT_SECRET : '';
  const debil = secreto.length < 32 || /^(secret|changeme|cambiar)/i.test(secreto);
  const prod = env.APP_ENV === 'production' || env.NODE_ENV === 'production';
  if (debil) {
    if (prod) errores.push('JWT_SECRET debe tener al menos 32 caracteres aleatorios en producción');
    else {
      env.JWT_SECRET = randomBytes(48).toString('hex');
      logJson('warn', 'JWT_SECRET ausente o débil: se usa uno temporal (solo desarrollo)');
    }
  }
  if (prod && !env.CORS_ORIGINS) errores.push('CORS_ORIGINS es obligatoria en producción');
  if (errores.length) throw new Error(`Configuración inválida: ${errores.join('; ')}`);

  env.JWT_EXPIRES_IN = env.JWT_EXPIRES_IN || '30m';
  env.PUBLIC_WEB_URL = env.PUBLIC_WEB_URL || 'http://localhost:4200';
  env.API_PUBLIC_URL = env.API_PUBLIC_URL || `http://localhost:${env.PORT || 3000}`;
  env.API_DEPRECATION_DATE = env.API_DEPRECATION_DATE || '2027-12-31';
  return env;
}

/** Orígenes permitidos para CORS (lista explícita separada por comas, nunca '*'). */
export function origenesCors(): string[] {
  const lista = (process.env.CORS_ORIGINS || 'http://localhost:4200')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && s !== '*');
  return lista;
}
