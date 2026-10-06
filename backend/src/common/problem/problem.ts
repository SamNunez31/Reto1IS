import { HttpException } from '@nestjs/common';

/** Códigos permitidos por el contrato (enum de ProblemDetails.code en el YAML). */
export type ProblemCode =
  | 'VALIDATION_FAILED'
  | 'ROOM_NO_LONGER_AVAILABLE'
  | 'PRICE_CHANGED'
  | 'BOOKING_NOT_CONFIRMED'
  | 'CANCELLATION_NOT_ALLOWED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'PAYMENT_REFERENCE_INVALID'
  | 'PAYMENT_NOT_AUTHORIZED';

export interface InvalidParam {
  name: string;
  reason: string;
}

/** Cuerpo de error RFC 7807 con la forma exacta del esquema ProblemDetails del contrato. */
export interface ProblemBody {
  type: string;
  title: string;
  status: number;
  detail?: string;
  code: ProblemCode;
  invalidParams?: InvalidParam[];
}

const TITULOS: Record<number, string> = {
  400: 'Petición inválida',
  401: 'No autenticado',
  402: 'Pago no autorizado',
  403: 'Acceso denegado',
  404: 'Recurso no encontrado',
  409: 'Conflicto',
  413: 'Cuerpo demasiado grande',
  429: 'Demasiadas peticiones',
  500: 'Error interno',
  503: 'Servicio no disponible',
};

export function tituloPorEstado(status: number): string {
  return TITULOS[status] ?? 'Error';
}

export function construirProblema(
  status: number,
  code: ProblemCode,
  detail?: string,
  invalidParams?: InvalidParam[],
): ProblemBody {
  const body: ProblemBody = {
    type: `https://booking-prototipo.ec/problemas/${code.toLowerCase().replace(/_/g, '-')}`,
    title: tituloPorEstado(status),
    status,
    code,
  };
  if (detail) body.detail = detail;
  if (invalidParams && invalidParams.length) body.invalidParams = invalidParams;
  return body;
}

/**
 * Excepción de negocio que el filtro global convierte en application/problem+json.
 * `retryAfter` (segundos) se envía como cabecera Retry-After.
 */
export class ProblemException extends HttpException {
  constructor(
    status: number,
    code: ProblemCode,
    detail?: string,
    invalidParams?: InvalidParam[],
    public readonly retryAfter?: number,
  ) {
    super(construirProblema(status, code, detail, invalidParams), status);
  }
}

// Atajos para los casos más comunes
export const noEncontrado = (detail = 'El recurso no existe') =>
  new ProblemException(404, 'VALIDATION_FAILED', detail);
export const prohibido = (detail = 'No tienes permiso para esta operación') =>
  new ProblemException(403, 'VALIDATION_FAILED', detail);
export const invalido = (detail: string, invalidParams?: InvalidParam[]) =>
  new ProblemException(400, 'VALIDATION_FAILED', detail, invalidParams);
export const conflicto = (detail: string, code: ProblemCode = 'VALIDATION_FAILED') =>
  new ProblemException(409, code, detail);
