import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { invalido } from '../problem/problem';

/** X-Device-Fingerprint obligatorio (400 ProblemDetails si falta). */
export const HeaderFingerprint = createParamDecorator((_d: unknown, ctx: ExecutionContext): string => {
  const valor = ctx.switchToHttp().getRequest<Request>().header('x-device-fingerprint');
  if (!valor || valor.length > 200) {
    throw invalido('Falta la cabecera X-Device-Fingerprint', [{ name: 'X-Device-Fingerprint', reason: 'cabecera obligatoria' }]);
  }
  return valor;
});
