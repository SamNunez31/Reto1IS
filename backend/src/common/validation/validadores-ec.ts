import { Transform } from 'class-transformer';
import { registerDecorator, ValidationOptions } from 'class-validator';

/** Cédula ecuatoriana: 10 dígitos, provincia 01-24 (o 30), tercer dígito < 6 y dígito verificador módulo 10. */
export function cedulaValida(valor: string): boolean {
  if (!/^\d{10}$/.test(valor)) return false;
  const provincia = Number(valor.slice(0, 2));
  if (!((provincia >= 1 && provincia <= 24) || provincia === 30)) return false;
  if (Number(valor[2]) >= 6) return false;
  let suma = 0;
  for (let i = 0; i < 9; i++) {
    let p = Number(valor[i]) * (i % 2 === 0 ? 2 : 1);
    if (p > 9) p -= 9;
    suma += p;
  }
  return (10 - (suma % 10)) % 10 === Number(valor[9]);
}

/**
 * RUC (versión simplificada): 13 dígitos y establecimiento distinto de 000.
 * Persona natural (tercer dígito < 6): los 10 primeros deben ser una cédula válida.
 * Sociedades (9) y sector público (6): solo se valida la forma.
 */
export function rucValido(valor: string): boolean {
  if (!/^\d{13}$/.test(valor) || valor.endsWith('000')) return false;
  const tercero = Number(valor[2]);
  if (tercero < 6) return cedulaValida(valor.slice(0, 10));
  return tercero === 6 || tercero === 9;
}

/** Valida numero_documento según tipo_documento del mismo objeto. */
export function DocumentoEcuador(opciones?: ValidationOptions) {
  return function (objeto: object, propiedad: string) {
    registerDecorator({
      name: 'documentoEcuador',
      target: objeto.constructor,
      propertyName: propiedad,
      options: { message: 'número de documento inválido para el tipo indicado', ...opciones },
      validator: {
        validate(valor: unknown, args) {
          const tipo = (args.object as { tipo_documento?: string }).tipo_documento;
          if (valor === undefined || valor === null) return !tipo;
          if (typeof valor !== 'string') return false;
          if (tipo === 'CEDULA') return cedulaValida(valor);
          if (tipo === 'RUC') return rucValido(valor);
          if (tipo === 'PASAPORTE') return /^[A-Z0-9]{5,13}$/i.test(valor);
          return false;
        },
      },
    });
  };
}

/**
 * Teléfono de Ecuador (después de quitar espacios y guiones):
 *   celular 09XXXXXXXX o +5939XXXXXXXX · fijo 0[2-7]XXXXXXX o +593[2-7]XXXXXXX
 */
export const TELEFONO_EC = /^(09\d{8}|0[2-7]\d{7}|\+5939\d{8}|\+593[2-7]\d{7})$/;
export const MENSAJE_TELEFONO_EC = 'Ingresa un teléfono de Ecuador: celular 09XXXXXXXX o fijo 02XXXXXXX (también con +593)';

/** Quita espacios y guiones del teléfono antes de validarlo (no toca otros tipos). */
export const NormalizarTelefono = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.replace(/[\s-]/g, '') : value));

/** Límites geográficos de Ecuador (incluye Galápagos), iguales a los CHECK de la BD. */
export const LATITUD_EC = { min: -5, max: 2 };
export const LONGITUD_EC = { min: -93, max: -75 };

/** Quita etiquetas HTML y caracteres de control del texto libre. */
export function sanitizarTexto(valor: unknown): unknown {
  if (typeof valor !== 'string') return valor;
  return valor
    .replace(/<[^>]*>/g, '')
    // Quita caracteres de control a propósito (no-control-regex lo marca justamente por eso)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}

/** Decorador de DTO: sanitiza el texto libre antes de validar. */
export const Sanitizar = () => Transform(({ value }) => sanitizarTexto(value));
