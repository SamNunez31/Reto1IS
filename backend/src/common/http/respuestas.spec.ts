import { HttpException } from '@nestjs/common';
import { codificarCursor, decodificarCursor, noches } from './respuestas';

describe('Paginación y fechas', () => {
  it('el cursor de página es opaco y reversible', () => {
    const cursor = codificarCursor(40);
    expect(cursor).not.toContain('40');
    expect(decodificarCursor(cursor)).toBe(40);
    expect(decodificarCursor(undefined)).toBe(0);
  });

  it('un cursor manipulado responde 400', () => {
    expect(() => decodificarCursor('no-es-un-cursor')).toThrow(HttpException);
    const manipulado = Buffer.from('o:-5').toString('base64url');
    expect.assertions(2);
    try {
      decodificarCursor(manipulado);
    } catch (e) {
      expect((e as HttpException).getStatus()).toBe(400);
    }
  });

  it('cuenta noches por fecha de calendario (sin desfase horario)', () => {
    expect(noches('2026-11-11', '2026-11-13')).toBe(2);
    expect(noches('2026-12-31', '2027-01-01')).toBe(1);
    expect(noches('2026-11-11', '2026-11-11')).toBe(0);
  });
});
