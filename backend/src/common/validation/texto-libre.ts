import { registerDecorator, ValidationOptions } from 'class-validator';
import { GROSERIAS } from './groserias';

/**
 * Control automático del texto libre (reseñas y textos del alojamiento). Sin revisión humana.
 * El frontend replica estas mismas reglas en frontend/src/app/shared/texto-libre.ts para avisar en vivo;
 * la fuente de verdad es este archivo.
 */

/** Minúsculas y sin tildes/diéresis (la ñ se conserva). */
export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-̂̄-ͯ]/g, '') // quita acentos; deja U+0303 (la virgulilla de la ñ)
    .normalize('NFC');
}

/** Un mismo carácter (que no sea espacio) 4 o más veces seguidas: "aaaa", "!!!!". */
export const REPETICION = /(\S)\1{3,}/u;
const URL = /(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|ec|info|biz|io|co|me|app|xyz|online|site|store)\b/i;
const CORREO = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;
/** 7 o más dígitos seguidos, admitiendo +, espacios, guiones, puntos o paréntesis entre ellos. */
const TELEFONO = /(?:\+?\d[\s().-]*){7,}/;

const LISTA = new Set(GROSERIAS.map(normalizarTexto));

export function tieneRepeticion(texto: string): boolean {
  return REPETICION.test(normalizarTexto(texto));
}

export function tieneContacto(texto: string): boolean {
  return URL.test(texto) || CORREO.test(texto) || TELEFONO.test(texto);
}

export function tieneGroserias(texto: string): boolean {
  return normalizarTexto(texto)
    .split(/[^a-zñ0-9]+/)
    .some((p) => LISTA.has(p) || (p.endsWith('es') && LISTA.has(p.slice(0, -2))) || (p.endsWith('s') && LISTA.has(p.slice(0, -1))));
}

export const MENSAJES_RESENA = {
  largo: 'Tu reseña debe tener entre 10 y 1000 caracteres',
  repeticion: 'Tu reseña repite el mismo carácter 4 o más veces seguidas, edítala e inténtalo de nuevo',
  contacto: 'Tu reseña no puede incluir enlaces, correos ni teléfonos, edítala e inténtalo de nuevo',
  groserias: 'Tu reseña contiene lenguaje inapropiado, edítala e inténtalo de nuevo',
} as const;

/** Devuelve el motivo de rechazo de un comentario de reseña, o null si es aceptable. */
export function problemaResena(texto: string): string | null {
  if (texto.length < 10 || texto.length > 1000) return MENSAJES_RESENA.largo;
  if (tieneRepeticion(texto)) return MENSAJES_RESENA.repeticion;
  if (tieneContacto(texto)) return MENSAJES_RESENA.contacto;
  if (tieneGroserias(texto)) return MENSAJES_RESENA.groserias;
  return null;
}

/** Decorador de DTO: rechaza un mismo carácter 4+ veces seguidas (título y descripción del alojamiento). */
export function SinRepeticiones(opciones?: ValidationOptions) {
  return function (objeto: object, propiedad: string) {
    registerDecorator({
      name: 'sinRepeticiones',
      target: objeto.constructor,
      propertyName: propiedad,
      options: { message: `${propiedad} no puede repetir el mismo carácter 4 o más veces seguidas`, ...opciones },
      validator: {
        validate: (valor: unknown) => typeof valor !== 'string' || !tieneRepeticion(valor),
      },
    });
  };
}
