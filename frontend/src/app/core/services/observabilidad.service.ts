import { ErrorHandler, Injectable, NgZone, inject, signal } from '@angular/core';

/*
 * Observabilidad LOCAL del navegador: todo se guarda en localStorage (prefijo posada-observability) y
 * NUNCA se envía a un servidor. Qué se registra y qué no: docs/DOCUMENTO_TECNICO.md → "Observabilidad".
 * Regla de privacidad: no se guardan valores de campos, contraseñas, datos de tarjeta, tokens, cabeceras
 * ni cuerpos de peticiones; las etiquetas pasan por `limpiarTexto` (enmascara números largos y correos).
 * Si localStorage o alguna API no existe, el sitio sigue funcionando (todo va en try/catch).
 */

export const PREFIJO_OBS = 'posada-observability';
export const CLAVE_OBS = `${PREFIJO_OBS}:v1`;
export const MAX_EVENTOS = 300;
const MAX_ETIQUETA = 40;
const MAX_DETALLE = 160;

export type TipoEvento = 'inicio' | 'carga' | 'error-js' | 'error-angular' | 'promesa' | 'recurso' | 'clic' | 'visibilidad' | 'api' | 'demo';

export interface EventoObs {
  /** ISO 8601 */
  t: string;
  tipo: TipoEvento;
  detalle: string;
  datos?: Record<string, string | number | boolean | null>;
}

export interface MetricasCarga {
  ttfb_ms: number | null;
  dom_listo_ms: number | null;
  carga_ms: number | null;
  fcp_ms: number | null;
  lcp_ms: number | null;
}

export interface EntornoObs {
  viewport: { ancho: number; alto: number; dpr: number } | null;
  conexion: { tipo: string | null; downlink_mbps: number | null; rtt_ms: number | null; ahorro_datos: boolean | null } | null;
  idioma: string | null;
  soporte: Record<string, boolean>;
}

export interface ResumenObs {
  eventos: number;
  errores: number;
  clics: number;
  llamadas_api: number;
  errores_api: number;
  p95_api_ms: number | null;
  carga_ms: number | null;
  lcp_ms: number | null;
}

export interface SnapshotObs {
  version: 1;
  generado: string;
  aviso: string;
  limite_eventos: number;
  entorno: EntornoObs;
  metricas: MetricasCarga;
  resumen: ResumenObs;
  eventos: EventoObs[];
}

interface Guardado {
  eventos: EventoObs[];
  metricas: MetricasCarga;
}

declare global {
  interface Window {
    PosadaObservability?: { getSnapshot: () => SnapshotObs };
  }
}

const METRICAS_VACIAS: MetricasCarga = { ttfb_ms: null, dom_listo_ms: null, carga_ms: null, fcp_ms: null, lcp_ms: null };

// ---------- Utilidades puras (exportadas para las pruebas) ----------

/** Recorta y enmascara: secuencias de 4+ dígitos (tarjetas, cédulas, teléfonos), correos y cadenas tipo token. */
export function limpiarTexto(texto: string, max = MAX_ETIQUETA): string {
  const t = (texto ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[correo]')
    .replace(/\b[A-Za-z0-9_-]{24,}\b/g, '[token]')
    .replace(/\d(?:[\s.-]?\d){3,}/g, '••••');
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** Ruta con patrón: sin origen ni query; UUID → :id, números → :n, segmentos largos → :token. */
export function rutaPatron(url: string): string {
  let ruta = url;
  try {
    ruta = new URL(url, 'http://local').pathname;
  } catch {
    ruta = url.split(/[?#]/)[0];
  }
  return ruta
    .split('/')
    .map((s) => {
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return ':id';
      if (/^\d+$/.test(s)) return ':n';
      if (s.length >= 24) return ':token';
      return s;
    })
    .join('/');
}

/** Percentil (método del rango más cercano). */
export function percentil(valores: number[], p: number): number | null {
  if (!valores.length) return null;
  const orden = [...valores].sort((a, b) => a - b);
  return orden[Math.min(orden.length - 1, Math.max(0, Math.ceil((p / 100) * orden.length) - 1))];
}

const CONTROLES = 'a,button,summary,select,textarea,input,label,[role=button],[role=tab],[role=link],[role=menuitem],[role=radio],[role=checkbox]';

/**
 * Tipo y etiqueta corta del elemento clicado. De los campos NUNCA se lee `value`:
 * solo su etiqueta visible/aria-label, su `name` o su tipo.
 */
export function describirElemento(objetivo: EventTarget | null): { tipo: string; etiqueta: string } | null {
  const base = objetivo instanceof Element ? objetivo : null;
  const el = base?.closest(CONTROLES) as HTMLElement | null;
  if (!el) return null;
  const tag = el.tagName.toLowerCase();
  const aria = el.getAttribute('aria-label') ?? '';
  if (tag === 'input' || tag === 'select' || tag === 'textarea') {
    const campo = el as HTMLInputElement;
    const tipoCampo = tag === 'input' ? (campo.type || 'text') : tag;
    const etiquetaVisible = campo.labels?.[0]?.textContent ?? '';
    // Contraseñas y tarjetas: solo el tipo, ni siquiera la etiqueta
    if (tipoCampo === 'password' || /tarjeta|cvv|card|cc-/i.test(`${campo.name} ${campo.id} ${campo.autocomplete}`)) {
      return { tipo: `campo:${tipoCampo === 'password' ? 'password' : 'tarjeta'}`, etiqueta: '(oculto)' };
    }
    return { tipo: `campo:${tipoCampo}`, etiqueta: limpiarTexto(aria || etiquetaVisible || campo.name || tipoCampo) };
  }
  const rol = el.getAttribute('role');
  const tipo = rol ?? (tag === 'a' ? 'enlace' : tag === 'button' ? 'boton' : tag);
  return { tipo, etiqueta: limpiarTexto(aria || el.textContent || el.getAttribute('title') || tag) || tag };
}

/** Acceso seguro a localStorage (puede no existir o lanzar en modo privado). */
function almacen(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class ObservabilidadService {
  private readonly zona = inject(NgZone);
  private eventos: EventoObs[] = [];
  private metricas: MetricasCarga = { ...METRICAS_VACIAS };
  private iniciado = false;
  /** Cambia con cada evento (el panel puede reaccionar). */
  readonly cambios = signal(0);

  constructor() {
    this.cargar();
  }

  /** Se llama al arrancar la app (provideAppInitializer). Idempotente. */
  iniciar(): void {
    if (this.iniciado) return;
    this.iniciado = true;
    try {
      window.PosadaObservability = { getSnapshot: () => this.getSnapshot() };
    } catch { /* sin window */ }
    this.zona.runOutsideAngular(() => {
      this.escucharErrores();
      this.escucharClics();
      this.escucharVisibilidad();
      this.medirCarga();
    });
    this.registrar('inicio', 'Aplicación iniciada', { ruta: rutaPatron(location?.pathname ?? '/') });
  }

  // ---------- Registro ----------

  registrar(tipo: TipoEvento, detalle: string, datos?: EventoObs['datos']): void {
    try {
      const ev: EventoObs = { t: new Date().toISOString(), tipo, detalle: limpiarTexto(detalle, MAX_DETALLE) };
      if (datos) ev.datos = datos;
      this.eventos.push(ev);
      if (this.eventos.length > MAX_EVENTOS) this.eventos.splice(0, this.eventos.length - MAX_EVENTOS);
      this.guardar();
      this.cambios.update((n) => n + 1);
    } catch { /* la observabilidad nunca rompe la app */ }
  }

  registrarError(origen: 'error-js' | 'error-angular' | 'promesa', error: unknown): void {
    const e = error as { name?: string; message?: string; rejection?: unknown } | null;
    const nombre = e?.name ?? (typeof error === 'string' ? 'Error' : typeof error);
    const mensaje = e?.message ?? (typeof error === 'string' ? error : '');
    this.registrar(origen, `${nombre}: ${mensaje || 'sin mensaje'}`);
  }

  registrarApi(metodo: string, url: string, estado: number, duracionMs: number): void {
    this.registrar('api', `${metodo} ${rutaPatron(url)}`, {
      metodo, ruta: rutaPatron(url), estado, ms: Math.round(duracionMs),
    });
  }

  demo(): void {
    this.registrar('demo', 'Evento de demostración generado desde el panel', { aleatorio: Math.round(Math.random() * 1000) });
  }

  limpiar(): void {
    this.eventos = [];
    this.metricas = { ...METRICAS_VACIAS };
    try {
      const s = almacen();
      if (s) {
        for (let i = s.length - 1; i >= 0; i--) {
          const k = s.key(i);
          if (k?.startsWith(PREFIJO_OBS)) s.removeItem(k);
        }
      }
    } catch { /* sin almacenamiento */ }
    this.cambios.update((n) => n + 1);
  }

  // ---------- Lectura ----------

  getSnapshot(): SnapshotObs {
    return {
      version: 1,
      generado: new Date().toISOString(),
      aviso: 'Datos locales de este navegador; no se envían a ningún servidor.',
      limite_eventos: MAX_EVENTOS,
      entorno: this.entorno(),
      metricas: { ...this.metricas },
      resumen: this.resumen(),
      eventos: this.eventos.map((e) => ({ ...e, datos: e.datos ? { ...e.datos } : undefined })),
    };
  }

  resumen(): ResumenObs {
    const api = this.eventos.filter((e) => e.tipo === 'api');
    const ms = api.map((e) => Number(e.datos?.['ms'])).filter((n) => Number.isFinite(n));
    return {
      eventos: this.eventos.length,
      errores: this.eventos.filter((e) => ['error-js', 'error-angular', 'promesa', 'recurso'].includes(e.tipo)).length,
      clics: this.eventos.filter((e) => e.tipo === 'clic').length,
      llamadas_api: api.length,
      errores_api: api.filter((e) => Number(e.datos?.['estado']) >= 400 || Number(e.datos?.['estado']) === 0).length,
      p95_api_ms: percentil(ms, 95),
      carga_ms: this.metricas.carga_ms,
      lcp_ms: this.metricas.lcp_ms,
    };
  }

  entorno(): EntornoObs {
    const soporte: Record<string, boolean> = {};
    const probar = (nombre: string, f: () => unknown) => {
      try {
        soporte[nombre] = !!f();
      } catch {
        soporte[nombre] = false;
      }
    };
    probar('Performance API', () => typeof performance !== 'undefined' && typeof performance.getEntriesByType === 'function');
    probar('PerformanceObserver', () => typeof PerformanceObserver !== 'undefined');
    probar('localStorage', () => {
      const s = almacen();
      if (!s) return false;
      s.setItem(`${PREFIJO_OBS}:prueba`, '1');
      s.removeItem(`${PREFIJO_OBS}:prueba`);
      return true;
    });
    probar('sessionStorage', () => typeof sessionStorage !== 'undefined');
    probar('Portapapeles', () => !!navigator.clipboard);
    probar('Fetch', () => typeof fetch === 'function');
    probar('IntersectionObserver', () => typeof IntersectionObserver !== 'undefined');
    probar('Diálogo <dialog>', () => typeof HTMLDialogElement !== 'undefined');
    probar('Service Worker', () => 'serviceWorker' in navigator);
    probar('Network Information', () => 'connection' in navigator);

    let viewport: EntornoObs['viewport'] = null;
    let conexion: EntornoObs['conexion'] = null;
    try {
      viewport = { ancho: window.innerWidth, alto: window.innerHeight, dpr: window.devicePixelRatio || 1 };
    } catch { /* sin window */ }
    try {
      const c = (navigator as Navigator & { connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean } }).connection;
      if (c) conexion = { tipo: c.effectiveType ?? null, downlink_mbps: c.downlink ?? null, rtt_ms: c.rtt ?? null, ahorro_datos: c.saveData ?? null };
    } catch { /* sin navigator.connection */ }
    let idioma: string | null = null;
    try {
      idioma = navigator.language ?? null;
    } catch { /* sin navigator */ }
    return { viewport, conexion, idioma, soporte };
  }

  // ---------- Escuchas del navegador ----------

  private escucharErrores(): void {
    try {
      // Captura: los errores de carga de recursos (img, script, link) no burbujean
      window.addEventListener(
        'error',
        (ev: Event) => {
          const objetivo = ev.target;
          if (objetivo && objetivo !== window && objetivo instanceof Element) {
            const el = objetivo as HTMLElement & { src?: string; href?: string };
            const url = el.src || el.href || '';
            this.registrar('recurso', `No cargó <${el.tagName.toLowerCase()}> ${rutaPatron(url)}`, {
              elemento: el.tagName.toLowerCase(), ruta: rutaPatron(url),
            });
            return;
          }
          if (ev instanceof ErrorEvent) {
            const archivo = ev.filename ? rutaPatron(ev.filename).split('/').pop() ?? '' : '';
            this.registrar('error-js', `${ev.message || 'Error'}`, { archivo, linea: ev.lineno ?? null });
          }
        },
        true,
      );
      window.addEventListener('unhandledrejection', (ev: PromiseRejectionEvent) => this.registrarError('promesa', ev.reason));
    } catch { /* sin window */ }
  }

  private escucharClics(): void {
    try {
      document.addEventListener(
        'click',
        (ev) => {
          const d = describirElemento(ev.target);
          if (d) this.registrar('clic', `${d.tipo}: ${d.etiqueta}`, { elemento: d.tipo, etiqueta: d.etiqueta, ruta: rutaPatron(location.pathname) });
        },
        true,
      );
    } catch { /* sin document */ }
  }

  private escucharVisibilidad(): void {
    try {
      document.addEventListener('visibilitychange', () => {
        this.registrar('visibilidad', document.visibilityState === 'hidden' ? 'Pestaña oculta' : 'Pestaña visible', { visibilidad: document.visibilityState });
      });
    } catch { /* sin document */ }
  }

  private medirCarga(): void {
    try {
      if (typeof performance === 'undefined' || typeof performance.getEntriesByType !== 'function') return;
      const leer = () => {
        try {
          const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
          if (nav) {
            this.metricas.ttfb_ms = Math.round(nav.responseStart);
            this.metricas.dom_listo_ms = Math.round(nav.domContentLoadedEventEnd);
            this.metricas.carga_ms = nav.loadEventEnd ? Math.round(nav.loadEventEnd) : null;
          }
          const fcp = performance.getEntriesByType('paint').find((p) => p.name === 'first-contentful-paint');
          if (fcp) this.metricas.fcp_ms = Math.round(fcp.startTime);
          this.registrar('carga', 'Tiempos de carga de la página', { ...this.metricas });
        } catch { /* entradas no disponibles */ }
      };
      if (document.readyState === 'complete') setTimeout(leer, 0);
      else window.addEventListener('load', () => setTimeout(leer, 0), { once: true });

      if (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('largest-contentful-paint')) {
        new PerformanceObserver((lista) => {
          const ultima = lista.getEntries().at(-1);
          if (ultima) {
            this.metricas.lcp_ms = Math.round(ultima.startTime);
            this.guardar();
          }
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      }
    } catch { /* Performance API no disponible */ }
  }

  // ---------- Persistencia ----------

  private cargar(): void {
    try {
      const crudo = almacen()?.getItem(CLAVE_OBS);
      if (!crudo) return;
      const g = JSON.parse(crudo) as Partial<Guardado>;
      if (Array.isArray(g.eventos)) this.eventos = g.eventos.slice(-MAX_EVENTOS);
    } catch { /* datos corruptos: se ignoran */ }
  }

  private guardar(): void {
    try {
      almacen()?.setItem(CLAVE_OBS, JSON.stringify({ eventos: this.eventos, metricas: this.metricas } satisfies Guardado));
    } catch { /* cuota llena o almacenamiento bloqueado */ }
  }
}

/** ErrorHandler de Angular: registra el error y conserva el comportamiento por defecto (consola). */
@Injectable()
export class ObservabilidadErrorHandler extends ErrorHandler {
  private readonly obs = inject(ObservabilidadService);
  override handleError(error: unknown): void {
    this.obs.registrarError('error-angular', error);
    super.handleError(error);
  }
}
