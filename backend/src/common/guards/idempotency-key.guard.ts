import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { invalido } from '../problem/problem';

/**
 * Guard que exige la cabecera `Idempotency-Key` en formato UUID.
 *
 * Uso:
 *   @UseGuards(IdempotencyKeyGuard)
 *   @Post('orders/create')
 *   createOrder(...) { ... }
 *
 * Si el cliente no envía la cabecera o el valor no es un UUID válido,
 * el guard rechaza la petición con 400 (ProblemDetails) antes de que el
 * controlador se ejecute, evitando cobros duplicados por doble-click.
 * El IdempotenciaInterceptor se encarga luego de reproducir respuestas repetidas.
 */
@Injectable()
export class IdempotencyKeyGuard implements CanActivate {
  private static readonly UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const idempotencyKey = request.header('idempotency-key');

    if (!idempotencyKey || idempotencyKey.trim() === '') {
      throw invalido('Las operaciones transaccionales exigen la cabecera Idempotency-Key (UUID)', [
        { name: 'Idempotency-Key', reason: 'cabecera obligatoria' },
      ]);
    }
    if (!IdempotencyKeyGuard.UUID_REGEX.test(idempotencyKey)) {
      throw invalido('Idempotency-Key debe ser un UUID', [{ name: 'Idempotency-Key', reason: 'formato UUID requerido' }]);
    }
    return true;
  }
}
