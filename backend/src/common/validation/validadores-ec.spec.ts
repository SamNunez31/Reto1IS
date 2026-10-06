import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DatosClienteDto } from '../../modules/alojamientos/dto/ordenes.dto';
import { cedulaValida, motivoDocumento, rucValido, sanitizarTexto } from './validadores-ec';

describe('Motivo del rechazo de un documento (mismo texto que el frontend)', () => {
  it('cédula: cada regla tiene su mensaje', () => {
    expect(motivoDocumento('CEDULA', '1710034065')).toBeNull();
    expect(motivoDocumento('CEDULA', '17100340')).toBe('La cédula debe tener 10 dígitos (tiene 8)');
    expect(motivoDocumento('CEDULA', '9910034065')).toContain('código de provincia');
    expect(motivoDocumento('CEDULA', '1770034065')).toBe('El tercer dígito de la cédula debe ser menor que 6');
    expect(motivoDocumento('CEDULA', '1710034064')).toBe('El dígito verificador no coincide, revisa la cédula');
    expect(motivoDocumento('CEDULA', '17100340a5')).toBe('La cédula solo puede tener números');
  });

  it('RUC: establecimiento distinto de 000 y cédula base válida', () => {
    expect(motivoDocumento('RUC', '1710034065001')).toBeNull();
    expect(motivoDocumento('RUC', '1710034065000')).toContain('no pueden ser 000');
    expect(motivoDocumento('RUC', '1710034064001')).toContain('cédula válida');
  });

  it('factura (DatosClienteDto): el 400 trae el motivo concreto en invalidParams', async () => {
    const dto = plainToInstance(DatosClienteDto, { document_type: 'CEDULA', document_number: '1710034064', first_name: 'Ana', last_name: 'Paz' });
    const errores = await validate(dto);
    const doc = errores.find((e) => e.property === 'document_number');
    expect(Object.values(doc?.constraints ?? {})).toEqual(['El dígito verificador no coincide, revisa la cédula']);
    const ok = plainToInstance(DatosClienteDto, { document_type: 'RUC', document_number: '1710034065001', business_name: 'Ana Paz' });
    expect((await validate(ok)).find((e) => e.property === 'document_number')).toBeUndefined();
  });
});

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
