import { ExecutionContext, HttpException } from '@nestjs/common';
import { IdempotencyKeyGuard } from './idempotency-key.guard';

/** Contexto HTTP mínimo: solo la cabecera que lee el guard. */
function contexto(idempotencyKey?: string): ExecutionContext {
  const req = { header: (nombre: string) => (nombre.toLowerCase() === 'idempotency-key' ? idempotencyKey : undefined) };
  return { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
}

function estadoDe(fn: () => unknown): number | null {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof HttpException ? e.getStatus() : -1;
  }
}

describe('IdempotencyKeyGuard', () => {
  const guard = new IdempotencyKeyGuard();

  it('deja pasar una Idempotency-Key con formato UUID', () => {
    expect(guard.canActivate(contexto('3f2b8c1e-9a4d-4e7b-8c2f-1a2b3c4d5e6f'))).toBe(true);
    expect(guard.canActivate(contexto('3F2B8C1E-9A4D-4E7B-8C2F-1A2B3C4D5E6F'))).toBe(true);
  });

  it('rechaza con 400 si falta la cabecera o viene vacía', () => {
    expect(estadoDe(() => guard.canActivate(contexto(undefined)))).toBe(400);
    expect(estadoDe(() => guard.canActivate(contexto('   ')))).toBe(400);
  });

  it('rechaza con 400 si no es un UUID', () => {
    expect(estadoDe(() => guard.canActivate(contexto('pedido-123')))).toBe(400);
    expect(estadoDe(() => guard.canActivate(contexto('3f2b8c1e9a4d4e7b8c2f1a2b3c4d5e6f')))).toBe(400);
  });
});
