import { Request } from 'express';
import { logJson } from './log-json';

export type EventoSeguridad = 'login_ok' | 'login_fallido' | 'acceso_401' | 'acceso_403';

/** Oculta la parte local del correo: "ana.perez@x.com" -> "a***@x.com". */
export function enmascararEmail(email: unknown): string | undefined {
  if (typeof email !== 'string' || !email.includes('@')) return undefined;
  const [local, dominio] = email.split('@');
  return `${local.slice(0, 1)}***@${dominio}`;
}

/**
 * Evento de auditoría de accesos (una línea JSON con tipo "auditoria").
 * Nunca recibe contraseñas, tokens ni cabeceras Authorization.
 */
export function auditar(evento: EventoSeguridad, req: Request, campos: Record<string, unknown> = {}): void {
  logJson(evento === 'login_ok' ? 'info' : 'warn', 'auditoria', {
    evento,
    correlation_id: req.correlationId,
    ip: req.ip,
    method: req.method,
    path: req.path,
    usuario_id: req.user?.sub,
    ...campos,
  });
}
