import { motivoBusqueda } from './busqueda.component';

describe('Búsqueda: validación de criterios', () => {
  const hoy = '2026-10-06';
  const base = { checkin: '2026-10-20', checkout: '2026-10-22', adultos: 2, ninos: 0, habitaciones: 1 };

  it('acepta criterios válidos', () => {
    expect(motivoBusqueda(base, hoy)).toBe('');
  });

  it('rechaza fechas pasadas o salida no posterior a la entrada', () => {
    expect(motivoBusqueda({ ...base, checkin: '2026-10-01' }, hoy)).toBe('La fecha de entrada no puede ser anterior a hoy.');
    expect(motivoBusqueda({ ...base, checkin: '1998-11-12', checkout: '1998-11-13' }, hoy)).toContain('anterior a hoy');
    expect(motivoBusqueda({ ...base, checkin: hoy, checkout: '2026-10-07' }, hoy)).toBe('');
    expect(motivoBusqueda({ ...base, checkout: '2026-10-20' }, hoy)).toContain('salida');
    expect(motivoBusqueda({ ...base, checkout: '2026-10-19' }, hoy)).toContain('salida');
  });

  it('rechaza huéspedes y habitaciones fuera de rango o con decimales', () => {
    expect(motivoBusqueda({ ...base, adultos: 0 }, hoy)).toContain('adultos');
    expect(motivoBusqueda({ ...base, adultos: 31 }, hoy)).toContain('adultos');
    expect(motivoBusqueda({ ...base, adultos: 1.5 }, hoy)).toContain('adultos');
    expect(motivoBusqueda({ ...base, ninos: 11 }, hoy)).toContain('niños');
    expect(motivoBusqueda({ ...base, habitaciones: 21 }, hoy)).toContain('habitaciones');
  });
});
