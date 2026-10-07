import { ConfigService } from '@nestjs/config';
import { HttpException } from '@nestjs/common';
import { hoyEcuador } from '../../common/http/respuestas';
import { traducirErrorPostgres } from '../../common/problem/postgres-errors';
import { DbService } from '../../database/db.service';
import { CotizacionService } from './services/cotizacion.service';

/** Fecha YYYY-MM-DD desplazada `dias` desde hoy en Ecuador. */
const desdeHoy = (dias: number): string => {
  const d = new Date(`${hoyEcuador()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

function rechazo(fn: () => unknown): { status: number; cuerpo: string } | null {
  try {
    fn();
    return null;
  } catch (e) {
    const h = e as HttpException;
    return { status: h.getStatus(), cuerpo: JSON.stringify(h.getResponse()) };
  }
}

describe('Entrada en el pasado', () => {
  // validarFechas es la regla común de /availability, /search y /orders/preview (no usa la BD)
  const cotizacion = new CotizacionService({} as DbService, {} as ConfigService);

  it('preview/búsqueda: 1998-11-12 y ayer -> 400 con mensaje claro en checkin', () => {
    for (const entrada of ['1998-11-12', desdeHoy(-1)]) {
      const r = rechazo(() => cotizacion.validarFechas(entrada, desdeHoy(2)));
      expect(r?.status).toBe(400);
      expect(r?.cuerpo).toContain('La entrada no puede estar en el pasado');
      expect(r?.cuerpo).toContain('checkin');
    }
  });

  it('hoy y mañana se permiten', () => {
    expect(cotizacion.validarFechas(desdeHoy(0), desdeHoy(1))).toBe(1);
    expect(cotizacion.validarFechas(desdeHoy(1), desdeHoy(3))).toBe(2);
  });

  it('create y modify: el FECHA_PASADA de la BD (trigger de reserva y fn_modificar_reserva) se responde como 400 en checkin', () => {
    const t = traducirErrorPostgres({ code: 'P0001', message: 'FECHA_PASADA: la entrada no puede estar en el pasado' });
    expect(t?.status).toBe(400);
    expect(t?.detail).toBe('la entrada no puede estar en el pasado');
    expect(t?.invalidParams).toEqual([{ name: 'checkin', reason: 'la entrada no puede estar en el pasado' }]);
  });
});
