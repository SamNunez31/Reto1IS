import { traducirErrorPostgres } from './postgres-errors';

describe('traducirErrorPostgres: RESERVA_DUPLICADA', () => {
  const pgError = (message: string) => ({ driverError: { code: 'P0001', message } });

  it('traduce RESERVA_DUPLICADA a 409 con el mensaje de la BD (nunca 500)', () => {
    const r = traducirErrorPostgres(
      pgError('RESERVA_DUPLICADA: ya tienes una reserva activa de este alojamiento en esas fechas'),
    );
    expect(r).not.toBeNull();
    expect(r?.status).toBe(409);
    expect(r?.code).toBe('VALIDATION_FAILED');
    expect(r?.detail).toContain('ya tienes una reserva activa');
  });

  it('sigue traduciendo SIN_DISPONIBILIDAD a 409 ROOM_NO_LONGER_AVAILABLE (concurrencia entre usuarios)', () => {
    const r = traducirErrorPostgres(pgError('SIN_DISPONIBILIDAD: no hay cupo para esas fechas'));
    expect(r?.status).toBe(409);
    expect(r?.code).toBe('ROOM_NO_LONGER_AVAILABLE');
  });
});
