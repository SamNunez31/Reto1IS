import { instanteCheckin, lineaCancelacion, tramosConFechas } from './cancelacion';

// Mismos tramos que database/01_esquema.sql
const FLEXIBLE = [{ hours_before: 48, penalty_percent: 0 }, { hours_before: 24, penalty_percent: 50 }, { hours_before: 0, penalty_percent: 100 }];
const MODERADA = [{ hours_before: 120, penalty_percent: 0 }, { hours_before: 48, penalty_percent: 50 }, { hours_before: 0, penalty_percent: 100 }];

describe('Política de cancelación con fechas', () => {
  const checkin = instanteCheckin('2026-11-11', '14:00');
  const hoy = new Date('2026-10-06T12:00:00-05:00');

  it('el check-in se toma en hora de Ecuador (UTC−5), como la vista de la BD', () => {
    expect(checkin.toISOString()).toBe('2026-11-11T19:00:00.000Z');
  });

  it('FLEXIBLE: fechas concretas de cada tramo', () => {
    expect(lineaCancelacion('FLEXIBLE', FLEXIBLE, checkin, hoy)).toBe(
      'Cancelación gratis hasta el 9 nov, 14:00 · del 9 nov, 14:00 al 10 nov, 14:00 se cobra el 50 % del hospedaje · después, el 100 %',
    );
  });

  it('MODERADA: 5 días y 48 h antes', () => {
    expect(lineaCancelacion('MODERADA', MODERADA, checkin, hoy)).toBe(
      'Cancelación gratis hasta el 6 nov, 14:00 · del 6 nov, 14:00 al 9 nov, 14:00 se cobra el 50 % del hospedaje · después, el 100 %',
    );
  });

  it('omite los tramos que ya pasaron', () => {
    const faltan30h = new Date(checkin.getTime() - 30 * 3_600_000);
    expect(lineaCancelacion('FLEXIBLE', FLEXIBLE, checkin, faltan30h)).toBe('Hasta el 10 nov, 14:00 se cobra el 50 % del hospedaje · después, el 100 %');
    const faltan2h = new Date(checkin.getTime() - 2 * 3_600_000);
    expect(lineaCancelacion('FLEXIBLE', FLEXIBLE, checkin, faltan2h)).toBe('Si cancelas, se cobra el 100 % del hospedaje');
  });

  it('el límite es inclusivo: con 48 h exactas todavía es gratis (horas >= horas_minimas)', () => {
    const t = tramosConFechas(FLEXIBLE, checkin, hoy);
    expect(t[0]).toEqual({ desde: null, hasta: new Date(checkin.getTime() - 48 * 3_600_000), pct: 0 });
  });

  it('NO_REEMBOLSABLE', () => {
    expect(lineaCancelacion('NO_REEMBOLSABLE', [{ hours_before: 0, penalty_percent: 100 }], checkin, hoy)).toBe('No reembolsable: se cobra el 100 % del hospedaje');
  });
});
