import { fechaMasDias, hoyEcuador, motivoFechas } from './fechas';

describe('Fechas de la estadía (zona America/Guayaquil)', () => {
  const hoy = '2026-10-06';
  const ayer = '2026-10-05';
  const manana = '2026-10-07';

  it('entrada: rechaza el pasado (1998-11-12 y ayer); acepta hoy y mañana', () => {
    expect(motivoFechas('1998-11-12', '1998-11-14', hoy).entrada).toBe('La fecha de entrada no puede ser anterior a hoy.');
    expect(motivoFechas(ayer, manana, hoy).entrada).toBe('La fecha de entrada no puede ser anterior a hoy.');
    expect(motivoFechas(hoy, manana, hoy)).toEqual({ entrada: '', salida: '' });
    expect(motivoFechas(manana, '2026-10-09', hoy)).toEqual({ entrada: '', salida: '' });
  });

  it('salida: debe ser posterior a la entrada (no igual ni anterior)', () => {
    expect(motivoFechas(manana, manana, hoy).salida).toBe('La fecha de salida debe ser posterior a la de entrada.');
    expect(motivoFechas(manana, hoy, hoy).salida).toBe('La fecha de salida debe ser posterior a la de entrada.');
  });

  it('fechas vacías o tecleadas a medias piden elegir la fecha', () => {
    expect(motivoFechas('', '', hoy)).toEqual({ entrada: 'Elige la fecha de entrada.', salida: 'Elige la fecha de salida.' });
    expect(motivoFechas('20-10-2026', null, hoy).entrada).toBe('Elige la fecha de entrada.');
  });

  it('"hoy" se calcula en hora de Ecuador, no en la del navegador', () => {
    // 2026-10-07 03:00 UTC = 6 oct, 22:00 en Ecuador
    expect(hoyEcuador(new Date('2026-10-07T03:00:00Z'))).toBe('2026-10-06');
    expect(hoyEcuador(new Date('2026-10-07T05:00:00Z'))).toBe('2026-10-07');
    expect(fechaMasDias(1, new Date(2026, 9, 6))).toBe('2026-10-07');
  });
});
