/*
 * Validación de tarjeta (pago SIMULADO). Funciones puras: los datos de la tarjeta solo se usan en el componente
 * para validar; nunca se envían al backend, ni se guardan, ni se escriben en logs o almacenamiento.
 */

export type Marca = 'visa' | 'mastercard' | 'amex' | 'otra';

export const NOMBRE_MARCA: Record<Marca, string> = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', otra: 'Tarjeta' };

export const soloDigitos = (v: string): string => v.replace(/\D/g, '');

export function marcaDe(numero: string): Marca {
  const n = soloDigitos(numero);
  if (/^4/.test(n)) return 'visa';
  if (/^3[47]/.test(n)) return 'amex';
  if (/^5[1-5]/.test(n)) return 'mastercard';
  const seis = Number(n.slice(0, 6));
  if (n.length >= 6 && seis >= 222100 && seis <= 272099) return 'mastercard';
  return 'otra';
}

/** Longitudes válidas por marca. */
export const LONGITUDES: Record<Marca, number[]> = { visa: [13, 16, 19], mastercard: [16], amex: [15], otra: [12, 13, 14, 15, 16, 17, 18, 19] };
export const maxDigitos = (m: Marca): number => Math.max(...LONGITUDES[m]);

/** Algoritmo de Luhn (dígito verificador de la tarjeta). */
export function luhn(numero: string): boolean {
  const n = soloDigitos(numero);
  if (!n) return false;
  let suma = 0;
  for (let i = 0; i < n.length; i++) {
    let d = Number(n[n.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    suma += d;
  }
  return suma % 10 === 0;
}

/** "4242424242424242" -> "4242 4242 4242 4242"; Amex 4-6-5. */
export function formatearNumero(numero: string): string {
  const m = marcaDe(numero);
  const n = soloDigitos(numero).slice(0, maxDigitos(m));
  if (m === 'amex') return [n.slice(0, 4), n.slice(4, 10), n.slice(10, 15)].filter(Boolean).join(' ');
  return n.replace(/(\d{4})(?=\d)/g, '$1 ');
}

export function motivoNumero(numero: string): string | null {
  const n = soloDigitos(numero);
  if (!n) return 'Ingresa el número de la tarjeta';
  const m = marcaDe(n);
  if (!LONGITUDES[m].includes(n.length)) {
    return m === 'amex' ? 'Una tarjeta American Express tiene 15 dígitos' : `El número está incompleto (${n.length} dígitos)`;
  }
  if (!luhn(n)) return 'El número de tarjeta no es válido; revísalo';
  return null;
}

/** "0427" o "04/27" -> "04/27" mientras se escribe. */
export function formatearCaducidad(v: string): string {
  const d = soloDigitos(v).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

/** La tarjeta vale hasta el último día del mes indicado. */
export function motivoCaducidad(v: string, hoy = new Date()): string | null {
  const m = /^(\d{2})\/(\d{2})$/.exec(v.trim());
  if (!v.trim()) return 'Ingresa la fecha de caducidad';
  if (!m) return 'Usa el formato MM/AA (ej.: 08/28)';
  const mes = Number(m[1]);
  const anio = 2000 + Number(m[2]);
  if (mes < 1 || mes > 12) return 'El mes debe estar entre 01 y 12';
  const finDeMes = new Date(anio, mes, 0, 23, 59, 59);
  if (finDeMes < hoy) return 'La tarjeta está vencida';
  if (anio > hoy.getFullYear() + 20) return 'Revisa el año de caducidad';
  return null;
}

export const largoCvv = (m: Marca): number => (m === 'amex' ? 4 : 3);

export function motivoCvv(cvv: string, marca: Marca): string | null {
  const d = soloDigitos(cvv);
  if (!d) return 'Ingresa el código de seguridad';
  if (d.length !== largoCvv(marca)) return marca === 'amex' ? 'El código tiene 4 dígitos (al frente de la tarjeta)' : 'El código tiene 3 dígitos (al reverso de la tarjeta)';
  return null;
}

export function motivoTitular(v: string): string | null {
  const t = v.trim().replace(/\s+/g, ' ');
  if (!t) return 'Ingresa el nombre como aparece en la tarjeta';
  if (/\d/.test(t)) return 'El nombre no puede tener números';
  if (t.length < 3) return 'Escribe el nombre completo';
  return null;
}

/** Tarjetas de prueba (modo demo). Cualquier otra con Luhn válido se aprueba. */
export type ResultadoPrueba = 'aprobada' | 'rechazada' | 'fondos';
export const TARJETAS_PRUEBA: { numero: string; resultado: ResultadoPrueba; texto: string }[] = [
  { numero: '4242 4242 4242 4242', resultado: 'aprobada', texto: 'Pago aprobado' },
  { numero: '4000 0000 0000 0002', resultado: 'rechazada', texto: 'Pago rechazado por el banco' },
  { numero: '4000 0000 0000 9995', resultado: 'fondos', texto: 'Fondos insuficientes' },
];
export function resultadoSimulado(numero: string): ResultadoPrueba {
  const n = soloDigitos(numero);
  return TARJETAS_PRUEBA.find((t) => soloDigitos(t.numero) === n)?.resultado ?? 'aprobada';
}

export const MENSAJE_RECHAZO: Record<Exclude<ResultadoPrueba, 'aprobada'>, string> = {
  rechazada: 'Tu banco rechazó el pago. Prueba con otra tarjeta.',
  fondos: 'La tarjeta no tiene fondos suficientes. Prueba con otra tarjeta.',
};

/**
 * Referencia de pago simulada con el formato que ya valida el backend (^PAY-[A-Z0-9]{6,}$).
 * Un rechazo usa el prefijo PAY-DECLINED, que el backend responde con 402 PAYMENT_NOT_AUTHORIZED.
 */
export function referenciaPago(resultado: ResultadoPrueba): string {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const azar = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => letras[b % letras.length]).join('');
  return resultado === 'aprobada' ? `PAY-${azar}` : `PAY-DECLINED${resultado === 'fondos' ? 'NSF' : ''}${azar}`;
}
