import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { observabilidadInterceptor } from '../interceptors/observabilidad.interceptor';
import { API } from './api-base';
import {
  CLAVE_OBS, describirElemento, limpiarTexto, MAX_EVENTOS, ObservabilidadService, percentil, rutaPatron,
} from './observabilidad.service';

describe('ObservabilidadService', () => {
  let obs: ObservabilidadService;
  const json = () => JSON.stringify(obs.getSnapshot());

  beforeEach(() => {
    try { localStorage.removeItem(CLAVE_OBS); } catch { /* */ }
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([observabilidadInterceptor])), provideHttpClientTesting()],
    });
    obs = TestBed.inject(ObservabilidadService);
    obs.limpiar();
  });

  afterEach(() => {
    try { localStorage.removeItem(CLAVE_OBS); } catch { /* */ }
  });

  it('nunca guarda el valor de un campo, solo su etiqueta', () => {
    const cont = document.createElement('div');
    cont.innerHTML = '<label for="obs-nom">Nombre</label><input id="obs-nom" name="nombre" value="SecretoXYZ">';
    document.body.appendChild(cont);
    const d = describirElemento(cont.querySelector('input'));
    obs.registrar('clic', `${d?.tipo}: ${d?.etiqueta}`, { etiqueta: d?.etiqueta ?? '' });
    cont.remove();
    expect(d).toEqual({ tipo: 'campo:text', etiqueta: 'Nombre' });
    expect(json()).not.toContain('SecretoXYZ');
  });

  it('contraseñas y tarjetas: ni valor ni etiqueta', () => {
    const cont = document.createElement('div');
    cont.innerHTML = '<label for="obs-pw">Mi clave</label><input id="obs-pw" type="password" value="Clave1234!">' +
      '<input id="tj-numero" autocomplete="cc-number" value="4242424242424242" aria-label="Número de tarjeta">';
    document.body.appendChild(cont);
    expect(describirElemento(cont.querySelector('#obs-pw'))).toEqual({ tipo: 'campo:password', etiqueta: '(oculto)' });
    expect(describirElemento(cont.querySelector('#tj-numero'))).toEqual({ tipo: 'campo:tarjeta', etiqueta: '(oculto)' });
    cont.remove();
  });

  it('enmascara números de tarjeta, correos y tokens en las etiquetas', () => {
    const boton = document.createElement('button');
    boton.textContent = 'Usar 4242 4242 4242 4242';
    expect(describirElemento(boton)?.etiqueta).toBe('Usar ••••');
    expect(limpiarTexto('Escribe a ana@correo.com')).toBe('Escribe a [correo]');
    expect(limpiarTexto('eyJhbGciOiJIUzI1NiJ9abcdefghij')).toBe('[token]');
    expect(limpiarTexto('x'.repeat(10) + ' ' + 'y'.repeat(50)).length).toBeLessThanOrEqual(40);
  });

  it('respeta el límite de eventos (descarta los más antiguos)', () => {
    for (let i = 0; i < MAX_EVENTOS + 25; i++) obs.registrar('demo', `evento ${i}`);
    const s = obs.getSnapshot();
    expect(s.eventos.length).toBe(MAX_EVENTOS);
    expect(s.eventos[0].detalle).toBe('evento 25');
    expect(s.eventos.at(-1)?.detalle).toBe(`evento ${MAX_EVENTOS + 24}`);
  });

  it('rutas con patrón: sin IDs ni query', () => {
    expect(rutaPatron('http://h/api/v1/orders/0b1e2c3d-1111-4222-8333-944455556666/cancel?x=1')).toBe('/api/v1/orders/:id/cancel');
    expect(rutaPatron('/api/v1/host/accommodations/1001/units')).toBe('/api/v1/host/accommodations/:n/units');
    expect(rutaPatron('/api/v1/auth/reset?token=abc')).toBe('/api/v1/auth/reset');
  });

  it('p95 por rango más cercano', () => {
    expect(percentil([], 95)).toBeNull();
    expect(percentil(Array.from({ length: 100 }, (_, i) => i + 1), 95)).toBe(95);
  });

  it('sigue funcionando si localStorage falla', () => {
    spyOn(Storage.prototype, 'setItem').and.throwError('QuotaExceeded');
    expect(() => obs.registrar('demo', 'sin almacenamiento')).not.toThrow();
    expect(obs.getSnapshot().eventos.at(-1)?.detalle).toBe('sin almacenamiento');
  });

  it('limpiar borra eventos y las claves con el prefijo', () => {
    obs.registrar('demo', 'algo');
    expect(localStorage.getItem(CLAVE_OBS)).not.toBeNull();
    obs.limpiar();
    expect(obs.getSnapshot().eventos.length).toBe(0);
    expect(localStorage.getItem(CLAVE_OBS)).toBeNull();
  });

  it('expone window.PosadaObservability.getSnapshot()', () => {
    obs.iniciar();
    const s = window.PosadaObservability?.getSnapshot();
    expect(s?.version).toBe(1);
    expect(s?.entorno.soporte['localStorage']).toBeTrue();
  });

  it('el interceptor registra método, ruta con patrón, estado y ms, sin cuerpo ni cabeceras', () => {
    const http = TestBed.inject(HttpClient);
    const ctrl = TestBed.inject(HttpTestingController);
    http.post(`${API}/orders/0b1e2c3d-1111-4222-8333-944455556666/cancel`, { secreto: 'CuerpoPrivado' }, { headers: { Authorization: 'Bearer TokenPrivado' } }).subscribe({ error: () => undefined });
    ctrl.expectOne(() => true).flush({ detail: 'x' }, { status: 409, statusText: 'Conflict' });
    const ev = obs.getSnapshot().eventos.find((e) => e.tipo === 'api');
    expect(ev?.datos?.['metodo']).toBe('POST');
    expect(String(ev?.datos?.['ruta'])).toContain('/orders/:id/cancel');
    expect(ev?.datos?.['estado']).toBe(409);
    expect(typeof ev?.datos?.['ms']).toBe('number');
    expect(json()).not.toContain('CuerpoPrivado');
    expect(json()).not.toContain('TokenPrivado');
    ctrl.verify();
  });
});
