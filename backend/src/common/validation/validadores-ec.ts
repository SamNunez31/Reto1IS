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

export const PASAPORTE = /^[A-Z0-9]{5,13}$/i;

/*
 * Motivo concreto de rechazo (null = válido). Mismos textos que frontend/src/app/shared/validadores.ts,
 * para que el 400 (ProblemDetails, invalidParams[].reason) diga lo mismo que el aviso en vivo bajo el campo.
 */
export function motivoCedula(v: string): string | null {
  if (/\D/.test(v)) return 'La cédula solo puede tener números';
  if (v.length !== 10) return `La cédula debe tener 10 dígitos (tiene ${v.length})`;
  const provincia = Number(v.slice(0, 2));
  if (!((provincia >= 1 && provincia <= 24) || provincia === 30)) return 'El código de provincia no es válido (los 2 primeros dígitos van de 01 a 24, o 30)';
  if (Number(v[2]) >= 6) return 'El tercer dígito de la cédula debe ser menor que 6';
  if (!cedulaValida(v)) return 'El dígito verificador no coincide, revisa la cédula';
  return null;
}

export function motivoRuc(v: string): string | null {
  if (/\D/.test(v)) return 'El RUC solo puede tener números';
  if (v.length !== 13) return `El RUC debe tener 13 dígitos (tiene ${v.length})`;
  if (v.endsWith('000')) return 'Los 3 últimos dígitos del RUC (establecimiento) no pueden ser 000';
  const tercero = Number(v[2]);
  if (tercero < 6) {
    const m = motivoCedula(v.slice(0, 10));
    if (m) return `Los 10 primeros dígitos del RUC deben ser una cédula válida: ${m.charAt(0).toLowerCase()}${m.slice(1)}`;
  } else if (tercero !== 6 && tercero !== 9) {
    return 'El tercer dígito del RUC no es válido (0-5 persona natural, 6 sector público, 9 sociedad)';
  }
  return rucValido(v) ? null : 'El RUC no es válido';
}

export function motivoPasaporte(v: string): string | null {
  if (/[^A-Za-z0-9]/.test(v)) return 'El pasaporte solo puede tener letras y números';
  return PASAPORTE.test(v) ? null : 'El pasaporte debe tener de 5 a 13 letras o números';
}

/** Motivo según el tipo (CEDULA | RUC | PASAPORTE). Cualquier otro tipo no admite número. */
export function motivoDocumento(tipo: string | undefined, valor: unknown): string | null {
  if (typeof valor !== 'string' || !valor.trim()) return 'Ingresa el número de documento';
  if (tipo === 'CEDULA') return motivoCedula(valor);
  if (tipo === 'RUC') return motivoRuc(valor);
  if (tipo === 'PASAPORTE') return motivoPasaporte(valor);
  return 'Tipo de documento no válido';
}

/**
 * Decorador de DTO: valida el número contra el tipo indicado en el campo hermano `campoTipo`
 * (`tipo_documento` en cuenta, `document_type` en la factura). El mensaje del 400 es el motivo concreto.
 */
export function NumeroDocumentoValido(campoTipo: string, opciones?: ValidationOptions & { obligatorioSinTipo?: boolean }) {
  const tipoDe = (o: object) => (o as Record<string, string | undefined>)[campoTipo];
  return function (objeto: object, propiedad: string) {
    registerDecorator({
      name: 'numeroDocumentoValido',
      target: objeto.constructor,
      propertyName: propiedad,
      options: opciones,
      validator: {
        validate(valor: unknown, args) {
          const tipo = tipoDe(args.object);
          // Sin número: válido solo si tampoco hay tipo (cuenta); la factura usa @ValidateIf para exigirlo
          if ((valor === undefined || valor === null) && !opciones?.obligatorioSinTipo) return !tipo;
          return motivoDocumento(tipo, valor) === null;
        },
        defaultMessage(args) {
          return motivoDocumento(tipoDe(args?.object ?? {}), args?.value) ?? 'número de documento inválido para el tipo indicado';
        },
      },
    });
  };
}

/** Valida numero_documento según tipo_documento del mismo objeto (registro y perfil). */
export const DocumentoEcuador = (opciones?: ValidationOptions) => NumeroDocumentoValido('tipo_documento', opciones);

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
