import type { AbstractControl, FormGroup, ValidationErrors, ValidatorFn } from '@angular/forms';

/*
 * Reglas de validación de cuenta: COPIA de las del backend para que el usuario vea el error antes de enviar.
 *   backend/src/common/validation/validadores-ec.ts  -> cedulaValida, rucValido, pasaporte
 *   backend/src/modules/auth/dto/auth.dto.ts         -> POLITICA_CLAVE, NOMBRE_PERSONA, longitudes
 * Si cambian allá, cambiarlas aquí. Todos los validadores devuelven { mensaje: '...' } en español.
 */

// ---------- Reglas (idénticas al backend) ----------

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

/** Política de clave: 8 a 72 caracteres con mayúscula, minúscula y número. */
export const POLITICA_CLAVE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,72}$/;

/** Nombres y apellidos: letras (con tildes, ñ, ü), separadas por un espacio, guion o apóstrofe. Sin dígitos. */
export const NOMBRE_PERSONA = /^[A-Za-zÀ-ÖØ-öø-ÿ]+(?:[ '’-][A-Za-zÀ-ÖØ-öø-ÿ]+)*$/;

/**
 * Teléfono de Ecuador (igual que TELEFONO_EC del backend), después de quitar espacios y guiones:
 *   celular 09XXXXXXXX o +5939XXXXXXXX · fijo 0[2-7]XXXXXXX o +593[2-7]XXXXXXX
 */
export const TELEFONO = /^(09\d{8}|0[2-7]\d{7}|\+5939\d{8}|\+593[2-7]\d{7})$/;
export const MENSAJE_TELEFONO = 'Ingresa un teléfono de Ecuador: celular 09XXXXXXXX o fijo 02XXXXXXX (también con +593)';
export const PISTA_TELEFONO = 'Ej.: 0991234567 o 022345678';
export const normalizarTelefono = (v: string): string => v.replace(/[\s-]/g, '');
/** Largo máximo mientras se escribe: 13 con "+593…", 10 si empieza con 0 (celular 09XXXXXXXX). */
export const maxTelefono = (v: string): number => (v.startsWith('+') ? 13 : 10);
/** Filtro al escribir/pegar: solo dígitos y un "+" inicial, recortado al largo máximo del formato. */
export function filtrarTelefono(valor: string): string {
  const limpio = valor.trim();
  const mas = limpio.startsWith('+') ? '+' : '';
  return (mas + limpio.replace(/\D/g, '')).slice(0, maxTelefono(mas));
}

export const LIMITES = {
  nombre: { min: 2, max: 80 },
  email: 160,
  clave: { min: 8, max: 72 },
  cedula: 10,
  ruc: 13,
  pasaporte: { min: 5, max: 13 },
  razonSocial: 160,
  telefono: 13,
} as const;

export type TipoDocumento = 'CEDULA' | 'RUC' | 'PASAPORTE';

// ---------- Normalización (antes de enviar) ----------

/** Quita espacios al inicio/fin y deja un solo espacio entre palabras. */
export const normalizarNombre = (v: string): string => v.trim().replace(/\s+/g, ' ');
export const normalizarEmail = (v: string): string => v.trim().toLowerCase();

/** Deja solo los caracteres que admite cada tipo de documento (se usa al escribir/pegar). */
export function filtrarDocumento(tipo: string, valor: string): string {
  if (tipo === 'CEDULA') return valor.replace(/\D/g, '').slice(0, LIMITES.cedula);
  if (tipo === 'RUC') return valor.replace(/\D/g, '').slice(0, LIMITES.ruc);
  if (tipo === 'PASAPORTE') return valor.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, LIMITES.pasaporte.max);
  return valor;
}

export function maxDocumento(tipo: string): number {
  return tipo === 'CEDULA' ? LIMITES.cedula : tipo === 'RUC' ? LIMITES.ruc : LIMITES.pasaporte.max;
}

// ---------- Diagnóstico con mensaje concreto (null = válido) ----------

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
  if (v.length < LIMITES.pasaporte.min || v.length > LIMITES.pasaporte.max) return 'El pasaporte debe tener de 5 a 13 letras o números';
  return PASAPORTE.test(v) ? null : 'El pasaporte no es válido';
}

export function motivoNombre(v: string, campo: 'nombres' | 'apellidos'): string | null {
  const t = normalizarNombre(v);
  const Campo = campo === 'nombres' ? 'Los nombres' : 'Los apellidos';
  if (!t) return `Ingresa tus ${campo}`;
  if (/\d/.test(t)) return `${Campo} no pueden tener números`;
  if (!NOMBRE_PERSONA.test(t)) return `${Campo} solo pueden tener letras, espacios, guion (-) y apóstrofe (')`;
  if (t.length < LIMITES.nombre.min) return `${Campo} deben tener al menos 2 letras`;
  if (t.length > LIMITES.nombre.max) return `${Campo} pueden tener máximo 80 caracteres`;
  return null;
}

export function motivoEmail(v: string, max: number = LIMITES.email): string | null {
  const t = v.trim();
  if (!t) return 'Ingresa tu correo';
  if (/\s/.test(t)) return 'El correo no puede tener espacios';
  const arrobas = t.split('@').length - 1;
  if (arrobas === 0) return 'Falta la @ del correo (ej: nombre@correo.com)';
  if (arrobas > 1) return 'El correo solo puede tener una @';
  const [usuario, dominio] = t.split('@');
  if (!usuario) return 'Falta el nombre antes de la @ (ej: nombre@correo.com)';
  if (!dominio) return 'Falta el dominio del correo (ej: nombre@correo.com)';
  if (!dominio.includes('.')) return 'Falta la terminación del dominio (ej: .com o .ec)';
  if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(usuario) || usuario.startsWith('.') || usuario.endsWith('.') || usuario.includes('..'))
    return 'La parte antes de la @ tiene caracteres no válidos';
  // Límites de RFC 5321 que también aplica isEmail en el backend
  if (usuario.length > 64) return 'La parte antes de la @ puede tener máximo 64 caracteres';
  const etiquetas = dominio.split('.');
  if (etiquetas.some((e) => !/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(e) || e.length > 63)) return 'El dominio del correo no es válido (ej: correo.com)';
  if (!/^[A-Za-z]{2,}$/.test(etiquetas[etiquetas.length - 1])) return 'La terminación del dominio debe tener al menos 2 letras (ej: .com o .ec)';
  if (t.length > max) return `El correo puede tener máximo ${max} caracteres`;
  return null;
}

/** Requisitos de la clave para la lista en vivo (✓/✗). */
export const REQUISITOS_CLAVE: { texto: string; cumple: (v: string) => boolean }[] = [
  { texto: 'Entre 8 y 72 caracteres', cumple: (v) => v.length >= 8 && v.length <= 72 },
  { texto: 'Una letra mayúscula', cumple: (v) => /[A-Z]/.test(v) },
  { texto: 'Una letra minúscula', cumple: (v) => /[a-z]/.test(v) },
  { texto: 'Un número', cumple: (v) => /\d/.test(v) },
];

export function motivoClave(v: string): string | null {
  if (!v) return 'Ingresa una clave';
  const faltan = REQUISITOS_CLAVE.filter((r) => !r.cumple(v)).map((r) => r.texto.toLowerCase());
  if (faltan.length) return `A la clave le falta: ${faltan.join(', ')}`;
  return POLITICA_CLAVE.test(v) ? null : 'La clave no cumple la política';
}

export function motivoDocumento(tipo: string, numero: string): string | null {
  if (!numero) return tipo ? 'Ingresa el número de documento' : null;
  if (!tipo) return null; // el error "falta el tipo" se muestra en el campo Tipo
  if (tipo === 'CEDULA') return motivoCedula(numero);
  if (tipo === 'RUC') return motivoRuc(numero);
  if (tipo === 'PASAPORTE') return motivoPasaporte(numero);
  return 'Tipo de documento no válido';
}

// ---------- ValidatorFn para formularios reactivos ----------

const err = (m: string | null): ValidationErrors | null => (m ? { mensaje: m } : null);
const texto = (c: AbstractControl): string => (typeof c.value === 'string' ? c.value : c.value == null ? '' : String(c.value));

export const vNombre = (campo: 'nombres' | 'apellidos'): ValidatorFn => (c) => err(motivoNombre(texto(c), campo));
export const vEmail = (max: number = LIMITES.email): ValidatorFn => (c) => err(motivoEmail(texto(c), max));
export const vClave: ValidatorFn = (c) => err(motivoClave(texto(c)));
export const vRequerido = (mensaje: string): ValidatorFn => (c) => err(texto(c).trim() ? null : mensaje);
export const vMaximo = (max: number, mensaje: string): ValidatorFn => (c) => err(texto(c).length > max ? mensaje : null);

/** Texto obligatorio entre min y max caracteres (tras quitar espacios de los extremos). */
export const vLongitud = (min: number, max: number, campo: string): ValidatorFn => (c) => {
  const t = texto(c).trim();
  if (!t) return { mensaje: `Escribe ${campo}` };
  if (t.length < min) return { mensaje: `Escribe al menos ${min} caracteres (llevas ${t.length})` };
  if (t.length > max) return { mensaje: `Máximo ${max} caracteres (llevas ${t.length})` };
  return null;
};

/** Número entre min y max; `entero` exige número sin decimales. Vacío = error solo si `obligatorio`. */
export const vRango = (min: number, max: number, opciones: { entero?: boolean; obligatorio?: boolean; unidad?: string } = {}): ValidatorFn => (c) => {
  const crudo = c.value;
  if (crudo === null || crudo === undefined || `${crudo}`.trim() === '') return opciones.obligatorio ? { mensaje: 'Completa este campo' } : null;
  const n = Number(crudo);
  const u = opciones.unidad ? ` ${opciones.unidad}` : '';
  if (Number.isNaN(n)) return { mensaje: 'Escribe un número' };
  if (opciones.entero && !Number.isInteger(n)) return { mensaje: 'Escribe un número entero, sin decimales' };
  if (n < min || n > max) return { mensaje: `Debe estar entre ${min} y ${max}${u}` };
  return null;
};

/** Selección obligatoria (tarjetas, desplegables). */
export const vElegir = (mensaje: string): ValidatorFn => (c) => (c.value === null || c.value === undefined || c.value === '' ? { mensaje } : null);

/** "Repetir clave": debe coincidir con el control hermano `otro`. */
export const vIgualA = (otro: string): ValidatorFn => (c) => {
  const v = texto(c);
  if (!v) return { mensaje: 'Repite la clave' };
  return v === c.parent?.get(otro)?.value ? null : { mensaje: 'Las claves no coinciden' };
};

/** Teléfono opcional (mismo patrón que el backend). */
export const vTelefono: ValidatorFn = (c) => {
  const v = texto(c).trim();
  return !v || TELEFONO.test(normalizarTelefono(v)) ? null : { mensaje: MENSAJE_TELEFONO };
};

/** Tipo de documento: obligatorio solo si hay número. */
export const vTipoDocumento: ValidatorFn = (c) => {
  const numero = texto(c.parent?.get('numero_documento') ?? c).trim();
  return !texto(c) && c.parent && numero ? { mensaje: 'Selecciona el tipo de documento' } : null;
};

/** Número de documento según el tipo elegido (control hermano `tipo_documento`). */
export const vNumeroDocumento: ValidatorFn = (c) => {
  const tipo: string = c.parent?.get('tipo_documento')?.value ?? '';
  return err(motivoDocumento(tipo, texto(c).trim()));
};

/**
 * Enlaza tipo ↔ número: al cambiar uno se revalida el otro, y al cambiar el tipo se filtra el número
 * (por ejemplo, al pasar de Pasaporte a Cédula se quitan las letras).
 */
export function enlazarDocumento(form: FormGroup): void {
  const tipo = form.get('tipo_documento');
  const numero = form.get('numero_documento');
  if (!tipo || !numero) return;
  tipo.valueChanges.subscribe((t: string) => {
    const filtrado = filtrarDocumento(t, texto(numero));
    if (filtrado !== numero.value) numero.setValue(filtrado, { emitEvent: false });
    numero.updateValueAndValidity({ emitEvent: false });
  });
  numero.valueChanges.subscribe(() => tipo.updateValueAndValidity({ emitEvent: false }));
}

/** Mensaje del primer error de un control (validador local o error del API). */
export function mensajeDe(c: AbstractControl | null): string {
  const e = c?.errors;
  if (!e) return '';
  return (e['api'] as string) ?? (e['mensaje'] as string) ?? 'Valor no válido';
}

/** Mensajes del API en inglés (validadores por defecto de class-validator) se reemplazan por uno genérico en español. */
export function traducirMotivoApi(motivo: string): string {
  return /\b(must|should|longer|shorter|equal|not allowed|exist)\b/i.test(motivo) ? 'El servidor rechazó este valor; revísalo' : motivo.charAt(0).toUpperCase() + motivo.slice(1);
}

/**
 * Coloca en cada control los errores del API (400 invalidParams). Devuelve true si alguno se pudo ubicar en un campo.
 */
export function aplicarErroresApi(form: FormGroup, campos: Record<string, string>): boolean {
  let ubicado = false;
  for (const [nombre, motivo] of Object.entries(campos)) {
    const c = form.get(nombre);
    if (!c) continue;
    c.setErrors({ ...(c.errors ?? {}), api: traducirMotivoApi(motivo) });
    c.markAsTouched();
    ubicado = true;
  }
  return ubicado;
}

/** Marca todo como tocado y lleva el foco al primer campo con error. Devuelve true si el formulario es válido. */
export function revisarYEnfocar(form: FormGroup, raiz: HTMLElement): boolean {
  form.markAllAsTouched();
  if (form.valid) return true;
  setTimeout(() => raiz.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
  return false;
}
