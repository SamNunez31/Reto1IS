import { cedulaValida, rucValido, sanitizarTexto } from './validadores-ec';

describe('Validadores de Ecuador', () => {
  it('cédula: 10 dígitos, provincia válida, tercer dígito < 6 y dígito verificador', () => {
    expect(cedulaValida('1710034065')).toBe(true);
    expect(cedulaValida('1710034064')).toBe(false); // verificador incorrecto
    expect(cedulaValida('9910034065')).toBe(false); // provincia 99
    expect(cedulaValida('1770034065')).toBe(false); // tercer dígito 7
    expect(cedulaValida('171003406')).toBe(false); // 9 dígitos
    expect(cedulaValida('17100340a5')).toBe(false);
  });

  it('RUC: persona natural (cédula + establecimiento) y sociedad', () => {
    expect(rucValido('1710034065001')).toBe(true);
    expect(rucValido('1710034064001')).toBe(false); // la cédula base no es válida
    expect(rucValido('1710034065000')).toBe(false); // establecimiento 000
    expect(rucValido('1790012345001')).toBe(true); // sociedad (tercer dígito 9)
    expect(rucValido('1780012345001')).toBe(false); // tercer dígito 8 no existe
  });

  it('sanitizarTexto quita HTML y caracteres de control, y deja lo demás', () => {
    expect(sanitizarTexto('  <b>Hola</b> mundo\u0007 ')).toBe('Hola mundo');
    expect(sanitizarTexto('Línea 1\nLínea 2')).toBe('Línea 1\nLínea 2');
    expect(sanitizarTexto(42)).toBe(42);
  });
});
