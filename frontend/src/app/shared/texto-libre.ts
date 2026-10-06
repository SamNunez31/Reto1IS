import type { ValidatorFn } from '@angular/forms';
import { GROSERIAS } from './groserias';

/*
 * Control automático del texto libre: COPIA de backend/src/common/validation/texto-libre.ts para avisar en vivo.
 * El backend vuelve a validar y es la fuente de verdad. Si cambia allá, cambiarlo aquí.
 */

/** Minúsculas y sin tildes/diéresis (la ñ se conserva). */
export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-̂̄-ͯ]/g, '')
    .normalize('NFC');
}

const REPETICION = /(\S)\1{3,}/u;
const URL = /(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|ec|info|biz|io|co|me|app|xyz|online|site|store)\b/i;
const CORREO = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;
const TELEFONO = /(?:\+?\d[\s().-]*){7,}/;
const LISTA = new Set(GROSERIAS.map(normalizarTexto));

export const tieneRepeticion = (t: string): boolean => REPETICION.test(normalizarTexto(t));
export const tieneContacto = (t: string): boolean => URL.test(t) || CORREO.test(t) || TELEFONO.test(t);
export function tieneGroserias(t: string): boolean {
  return normalizarTexto(t)
    .split(/[^a-zñ0-9]+/)
    .some((p) => LISTA.has(p) || (p.endsWith('es') && LISTA.has(p.slice(0, -2))) || (p.endsWith('s') && LISTA.has(p.slice(0, -1))));
}

export const RESENA = { min: 10, max: 1000 } as const;

/** Mismos mensajes que el backend. Vacío = válido (el comentario es opcional). */
export function problemaResena(texto: string): string | null {
  const t = texto.trim();
  if (!t) return null;
  if (t.length < RESENA.min || t.length > RESENA.max) return `Tu reseña debe tener entre ${RESENA.min} y ${RESENA.max} caracteres (llevas ${t.length})`;
  if (tieneRepeticion(t)) return 'Tu reseña repite el mismo carácter 4 o más veces seguidas, edítala e inténtalo de nuevo';
  if (tieneContacto(t)) return 'Tu reseña no puede incluir enlaces, correos ni teléfonos, edítala e inténtalo de nuevo';
  if (tieneGroserias(t)) return 'Tu reseña contiene lenguaje inapropiado, edítala e inténtalo de nuevo';
  return null;
}

/** Título y descripción del alojamiento: sin un mismo carácter 4+ veces seguidas. */
export const vSinRepeticiones: ValidatorFn = (c) =>
  typeof c.value === 'string' && tieneRepeticion(c.value) ? { mensaje: 'No repitas el mismo carácter 4 o más veces seguidas' } : null;
