import { FormArray, FormBuilder, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { DatosAlojamiento } from '../../core/services/anfitrion.service';
import { vSinRepeticiones } from '../../shared/texto-libre';
import { normalizarTelefono, vElegir, vLongitud, vMaximo, vRango, vTelefono } from '../../shared/validadores';

// ---------- Límites: copiados de backend/src/modules/host/dto/host.dto.ts (CrearAlojamientoDto y UnidadDto) ----------
export const L = {
  nombre: { min: 3, max: 140 },
  descripcion: { min: 20, max: 5000 },
  direccion: { min: 5, max: 200 },
  noches: { min: 1, max: 365 },
  limpieza: { min: 0, max: 10000 },
  reglas: 3000,
  imagenes: 30,
  url: 500,
  unidad: { nombre: { min: 2, max: 100 }, capacidad: 30, habitaciones: 50, camas: 100, banos: 50, cantidad: 500, precio: { min: 1, max: 100000 } },
} as const;

export const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
export const vHora: ValidatorFn = (c) => (HORA.test(c.value ?? '') ? null : { mensaje: 'Indica la hora en formato HH:MM' });
const vNochesMax: ValidatorFn = (c) => {
  const min = Number(c.parent?.get('noches_min')?.value);
  return Number(c.value) < min ? { mensaje: 'Las noches máximas no pueden ser menos que las mínimas' } : null;
};

export const urlsDe = (texto: string): string[] => texto.split('\n').map((u) => u.trim()).filter(Boolean);
export function esUrlHttps(u: string): boolean {
  try {
    const url = new URL(u);
    return url.protocol === 'https:' && url.hostname.includes('.');
  } catch {
    return false;
  }
}
/** Una URL https por línea (máx. 30, 500 caracteres cada una), como valida el backend (IsUrl https). */
const vImagenes: ValidatorFn = (c) => {
  const urls = urlsDe(c.value ?? '');
  if (urls.length > L.imagenes) return { mensaje: `Puedes agregar hasta ${L.imagenes} fotos (tienes ${urls.length})` };
  for (const [i, u] of urls.entries()) {
    if (u.length > L.url) return { mensaje: `La foto ${i + 1} tiene una URL demasiado larga (máx. ${L.url} caracteres)` };
    if (!esUrlHttps(u)) return { mensaje: `La foto ${i + 1} no es una URL https válida (debe empezar con https://)` };
  }
  return null;
};

// ---------- Iconos y textos ----------
/** Los 5 tipos del catálogo (database/01_esquema.sql). */
export const ICONO_TIPO: Record<string, string> = {
  Hotel: '🏨', Hostal: '🛏️', 'Cabaña': '🛖', Casa: '🏠', Departamento: '🏢',
};
export const ICONO_AMENIDAD: Record<string, string> = {
  'Wi-Fi': '📶', 'Agua caliente': '🚿', 'Cocina equipada': '🍳', 'Aire acondicionado': '❄️', 'Calefacción': '🔥', TV: '📺',
  'Parqueadero gratuito': '🅿️', Gimnasio: '🏋️', Jacuzzi: '🛁', Piscina: '🏊', 'Desayuno incluido': '🥐', 'Lavandería': '🧺',
  'Recepción 24 horas': '🛎️', Restaurante: '🍽️', 'Transporte desde/hacia el aeropuerto': '🚐', 'Accesible para silla de ruedas': '♿',
};
export const NOMBRE_POLITICA: Record<string, { titulo: string; icono: string }> = {
  FLEXIBLE: { titulo: 'Flexible', icono: '🌤️' },
  MODERADA: { titulo: 'Moderada', icono: '⛅' },
  NO_REEMBOLSABLE: { titulo: 'No reembolsable', icono: '🔒' },
};
/** Tipos que normalmente se alquilan completos (para sugerir "Todo el alojamiento"). */
export const TIPOS_COMPLETOS = ['Casa', 'Departamento', 'Cabaña'];

/** Reglas de la casa con casilla; el texto final se arma para el campo existente `reglas_casa`. */
export const REGLAS = {
  no_fumar: 'No se permite fumar.',
  no_mascotas: 'No se admiten mascotas.',
  no_fiestas: 'No se permiten fiestas ni eventos.',
} as const;
export const fraseSilencio = (hora: string) => `Silencio desde las ${hora}.`;

// ---------- Formulario ----------
export type Modalidad = 'COMPLETO' | 'HABITACIONES';

export function grupoUnidad(fb: FormBuilder, v?: Partial<{ nombre: string; capacidad_huespedes: number; num_habitaciones: number; num_camas: number; num_banos: number; cantidad: number; precio_noche_base: number }>) {
  const U = L.unidad;
  return fb.group({
    nombre: [v?.nombre ?? '', vLongitud(U.nombre.min, U.nombre.max, 'un nombre (ej: Habitación doble)')],
    capacidad_huespedes: [v?.capacidad_huespedes ?? 2, vRango(1, U.capacidad, { entero: true, obligatorio: true, unidad: 'huéspedes' })],
    num_habitaciones: [v?.num_habitaciones ?? 1, vRango(0, U.habitaciones, { entero: true, obligatorio: true })],
    num_camas: [v?.num_camas ?? 1, vRango(1, U.camas, { entero: true, obligatorio: true })],
    num_banos: [v?.num_banos ?? 1, vRango(0, U.banos, { entero: true, obligatorio: true })],
    cantidad: [v?.cantidad ?? 1, vRango(1, U.cantidad, { entero: true, obligatorio: true })],
    precio_noche_base: [v?.precio_noche_base ?? null as number | null, vRango(U.precio.min, U.precio.max, { obligatorio: true, unidad: 'USD', decimales: 2 })],
  });
}
export type FormUnidad = ReturnType<typeof grupoUnidad>;

export function crearFormAlojamiento(fb: FormBuilder) {
  return fb.group({
    tipo_id: [null as number | null, vElegir('Elige el tipo de alojamiento')],
    ciudad_id: [null as number | null, vElegir('Elige la ciudad')],
    direccion: ['', vLongitud(L.direccion.min, L.direccion.max, 'la dirección')],
    latitud: [null as number | null, [vElegir('Ubica el alojamiento en el mapa'), vRango(-5, 2)]],
    longitud: [null as number | null, [vElegir('Ubica el alojamiento en el mapa'), vRango(-93, -75)]],
    hora_checkin: ['14:00', vHora],
    hora_checkout: ['12:00', vHora],
    noches_min: [1 as number | null, vRango(L.noches.min, L.noches.max, { entero: true, obligatorio: true, unidad: 'noches' })],
    noches_max: [30 as number | null, [vRango(L.noches.min, L.noches.max, { entero: true, obligatorio: true, unidad: 'noches' }), vNochesMax]],
    tarifa_limpieza: [0 as number | null, vRango(L.limpieza.min, L.limpieza.max, { unidad: 'USD', decimales: 2 })],
    telefono_contacto: ['', vTelefono],
    categoria_estrellas: [null as number | null],
    amenidades: [[] as number[]],
    imagenes: ['', vImagenes],
    nombre: ['', [vLongitud(L.nombre.min, L.nombre.max, 'un título'), vSinRepeticiones]],
    descripcion: ['', [vLongitud(L.descripcion.min, L.descripcion.max, 'una descripción'), vSinRepeticiones]],
    // Posada EC confirma toda reserva al aprobarse el pago: el modo es siempre inmediato
    modo_reserva: ['INSTANTANEA' as const],
    politica_id: [null as number | null, vElegir('Elige una política de cancelación')],
    no_fumar: [false],
    no_mascotas: [false],
    no_fiestas: [false],
    silencio: [false],
    hora_silencio: ['22:00', vHora],
    reglas_extra: ['', vMaximo(L.reglas - 200, `Máximo ${L.reglas - 200} caracteres`)],
  });
}
export type FormAlojamiento = ReturnType<typeof crearFormAlojamiento>;
export type CampoAlojamiento = keyof FormAlojamiento['controls'];

/** Engancha validaciones cruzadas (noches máx. depende de mín.). */
export function enlazarForm(form: FormAlojamiento): void {
  form.controls.noches_min.valueChanges.subscribe(() => form.controls.noches_max.updateValueAndValidity({ emitEvent: false }));
}

/** Texto final de reglas de la casa (casillas + texto libre). */
export function reglasTexto(v: FormAlojamiento['value']): string {
  const partes: string[] = [];
  if (v.no_fumar) partes.push(REGLAS.no_fumar);
  if (v.no_mascotas) partes.push(REGLAS.no_mascotas);
  if (v.no_fiestas) partes.push(REGLAS.no_fiestas);
  if (v.silencio && HORA.test(v.hora_silencio ?? '')) partes.push(fraseSilencio(v.hora_silencio as string));
  if ((v.reglas_extra ?? '').trim()) partes.push((v.reglas_extra as string).trim());
  return partes.join(' ');
}

/** Separa las frases conocidas (casillas) del resto del texto de reglas guardado. */
export function leerReglas(texto: string) {
  let resto = ` ${texto} `;
  const quitar = (frase: string) => {
    const esta = resto.includes(` ${frase} `);
    if (esta) resto = resto.replace(` ${frase} `, ' ');
    return esta;
  };
  const no_fumar = quitar(REGLAS.no_fumar);
  const no_mascotas = quitar(REGLAS.no_mascotas);
  const no_fiestas = quitar(REGLAS.no_fiestas);
  const m = resto.match(/ Silencio desde las (\d{2}:\d{2})\. /);
  if (m) resto = resto.replace(m[0], ' ');
  return { no_fumar, no_mascotas, no_fiestas, silencio: !!m, hora_silencio: m?.[1] ?? '22:00', reglas_extra: resto.trim() };
}

/**
 * Cuerpo para POST/PATCH con los campos pedidos. Las listas (amenidades, imágenes) reemplazan
 * la lista completa en el backend, por eso solo se envían si su sección se está guardando.
 */
export function datosDe(form: FormAlojamiento, campos?: readonly string[]): Partial<DatosAlojamiento> {
  const v = form.getRawValue();
  const quiere = (c: string) => !campos || campos.includes(c);
  const d: Partial<DatosAlojamiento> = {};
  if (quiere('tipo_id')) d.tipo_id = Number(v.tipo_id);
  if (quiere('ciudad_id')) d.ciudad_id = Number(v.ciudad_id);
  if (quiere('politica_id')) d.politica_id = Number(v.politica_id);
  if (quiere('nombre')) d.nombre = (v.nombre ?? '').trim();
  if (quiere('descripcion')) d.descripcion = (v.descripcion ?? '').trim();
  if (quiere('direccion')) d.direccion = (v.direccion ?? '').trim();
  if (quiere('latitud')) d.latitud = Number(v.latitud);
  if (quiere('longitud')) d.longitud = Number(v.longitud);
  if (quiere('hora_checkin')) d.hora_checkin = v.hora_checkin ?? '14:00';
  if (quiere('hora_checkout')) d.hora_checkout = v.hora_checkout ?? '12:00';
  if (quiere('noches_min')) d.noches_min = Number(v.noches_min);
  if (quiere('noches_max')) d.noches_max = Number(v.noches_max);
  if (quiere('tarifa_limpieza')) d.tarifa_limpieza = Number(v.tarifa_limpieza ?? 0);
  if (quiere('modo_reserva')) d.modo_reserva = 'INSTANTANEA';
  if (quiere('amenidades')) d.amenidades = [...(v.amenidades ?? [])];
  if (quiere('imagenes')) d.imagenes = urlsDe(v.imagenes ?? '').map((url, i) => ({ url, es_portada: i === 0 }));
  // Opcionales: al crear se omiten si están vacíos; al editar (campos dados) vacío = null para borrarlos
  // (el DTO usa @IsOptional, que acepta null; '' no pasaría sus validaciones)
  const libre = d as Record<string, unknown>;
  const opcional = (c: string, valor: unknown) => {
    if (!quiere(c)) return;
    if (valor !== '' && valor !== null && valor !== undefined) libre[c] = valor;
    else if (campos) libre[c] = null;
  };
  opcional('telefono_contacto', normalizarTelefono((v.telefono_contacto ?? '').trim()));
  opcional('categoria_estrellas', v.categoria_estrellas || null);
  opcional('reglas_casa', reglasTexto(form.value).slice(0, L.reglas));
  return d;
}

/** Errores 400 del API: se ubican en su control (devuelve los nombres que se pudieron ubicar). */
export function ubicarErroresApi(form: FormAlojamiento, campos: Record<string, string>, traducir: (m: string) => string): string[] {
  const ubicados: string[] = [];
  for (const [nombre, motivo] of Object.entries(campos)) {
    const raiz = nombre.split('.')[0] === 'reglas_casa' ? 'reglas_extra' : nombre.split('.')[0];
    const c = form.get(raiz);
    if (!c) continue;
    c.setErrors({ ...(c.errors ?? {}), api: traducir(motivo) });
    c.markAsTouched();
    ubicados.push(raiz);
  }
  return ubicados;
}
