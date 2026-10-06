import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormArray, FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { leerError } from '../../core/services/api-base';
import { AnfitrionService, DiaCalendario, Unidad } from '../../core/services/anfitrion.service';
import { avisoTemporal } from '../../shared/aviso';
import { CampoMensajeComponent, conError } from '../../shared/campo';
import { ConfirmarService } from '../../shared/confirmar';
import { fechaMasDias } from '../../shared/fechas';
import { fechaConDia } from '../../shared/textos';
import { FiltroDirective } from '../../shared/entrada';
import { motivoPrecio, motivoRango, traducirMotivoApi } from '../../shared/validadores';
import { FormUnidad, grupoUnidad, L, Modalidad } from './alojamiento-form';

/** Campos de una unidad (los mismos en el asistente y en la edición). `completo` oculta nombre y cantidad. */
@Component({
  selector: 'app-campos-unidad',
  imports: [ReactiveFormsModule, CampoMensajeComponent, FiltroDirective],
  template: `
    <div class="campos-unidad" [formGroup]="grupo()">
      @if (!completo()) {
        <div class="fila">
          <div class="grupo ancho-2">
            <label [for]="p() + 'nombre'">Nombre de la habitación</label>
            <input [id]="p() + 'nombre'" formControlName="nombre" [maxlength]="U.nombre.max" placeholder="Ej.: Habitación doble con balcón"
                   [attr.aria-invalid]="mal('nombre')" [attr.aria-describedby]="p() + 'm-nombre'" />
            <app-campo-mensaje [control]="grupo().controls.nombre" [id]="p() + 'm-nombre'" [mostrarOk]="false" />
          </div>
          <div class="grupo">
            <label [for]="p() + 'cantidad'">Disponibles</label>
            <input [id]="p() + 'cantidad'" appFiltro="entero" formControlName="cantidad" maxlength="3" placeholder="1"
                   [attr.aria-invalid]="mal('cantidad')" [attr.aria-describedby]="p() + 'a-cant ' + p() + 'm-cant'" />
            <small [id]="p() + 'a-cant'" class="ayuda">Cuántas habitaciones iguales de este tipo tienes.</small>
            <app-campo-mensaje [control]="grupo().controls.cantidad" [id]="p() + 'm-cant'" [mostrarOk]="false" />
          </div>
        </div>
      }
      <div class="fila">
        @for (c of campos; track c.id) {
          <div class="grupo">
            <label [for]="p() + c.id">{{ c.etiqueta }}</label>
            <input [id]="p() + c.id" [appFiltro]="c.tipo" [formControlName]="c.id" [attr.maxlength]="c.largo" [placeholder]="c.ejemplo"
                   [attr.aria-invalid]="mal(c.id)" [attr.aria-describedby]="p() + 'm-' + c.id" />
            <app-campo-mensaje [control]="grupo().get(c.id)" [id]="p() + 'm-' + c.id" [mostrarOk]="false" />
          </div>
        }
      </div>
    </div>
  `,
})
export class CamposUnidadComponent {
  readonly grupo = input.required<FormUnidad>();
  readonly completo = input(false);
  /** Prefijo único para los id de los inputs. */
  readonly p = input.required<string>();
  readonly U = L.unidad;
  readonly campos = [
    { id: 'precio_noche_base', etiqueta: 'Precio por noche (USD)', tipo: 'decimal', largo: 9, ejemplo: '105,00' },
    { id: 'capacidad_huespedes', etiqueta: 'Huéspedes', tipo: 'entero', largo: 2, ejemplo: '2' },
    { id: 'num_habitaciones', etiqueta: 'Dormitorios', tipo: 'entero', largo: 2, ejemplo: '1' },
    { id: 'num_camas', etiqueta: 'Camas', tipo: 'entero', largo: 3, ejemplo: '1' },
    { id: 'num_banos', etiqueta: 'Baños', tipo: 'entero', largo: 2, ejemplo: '1' },
  ] as const;
  mal(c: string): boolean {
    return conError(this.grupo().get(c));
  }
}

/** Paso del asistente: lo que se reserva (una unidad "todo el alojamiento" o varias habitaciones). */
@Component({
  selector: 'app-unidades-nuevas',
  imports: [CamposUnidadComponent],
  template: `
    <p class="ayuda">Aquí defines lo que el huésped reserva y a qué precio por noche. Si alguna fecha necesita otro precio (feriados, temporada alta), podrás ajustarla después en "Precios y disponibilidad por fecha".</p>
    @if (modalidad() === 'COMPLETO') {
      <section class="unidad-tarjeta">
        <h3>🏠 Todo el alojamiento</h3>
        <p class="ayuda">El huésped reserva el lugar completo. Solo indica el precio y la capacidad.</p>
        <app-campos-unidad [grupo]="lista().controls[0]" [completo]="true" p="uc-" />
      </section>
    } @else {
      @for (g of lista().controls; track $index; let i = $index) {
        <section class="unidad-tarjeta">
          <header class="unidad-cabecera d-flex justify-content-between align-items-center flex-wrap">
            <h3>🛏️ Tipo de habitación {{ i + 1 }}</h3>
            @if (lista().length > 1) { <button type="button" class="btn btn-chico" (click)="quitar(i)">Quitar</button> }
          </header>
          <app-campos-unidad [grupo]="g" [p]="'u' + i + '-'" />
        </section>
      }
      @if (lista().length < 20) {
        <button type="button" class="btn" (click)="agregar()">+ Agregar otro tipo de habitación</button>
      }
    }
  `,
})
export class UnidadesNuevasComponent {
  readonly lista = input.required<FormArray<FormUnidad>>();
  readonly modalidad = input.required<Modalidad>();
  private readonly fb = inject(FormBuilder);
  private readonly confirmar = inject(ConfirmarService);
  agregar(): void {
    this.lista().push(grupoUnidad(this.fb));
  }
  async quitar(i: number): Promise<void> {
    const nombre = (this.lista().at(i).controls.nombre.value ?? '').trim();
    const si = await this.confirmar.pedir({
      titulo: '¿Quitar este tipo de habitación?',
      mensaje: `Se quitará ${nombre ? `«${nombre}»` : 'esta opción'} y los datos que escribiste en ella.`,
      confirmar: 'Quitar',
      tono: 'peligro',
    });
    if (si) this.lista().removeAt(i);
  }
}

/** Edición: "Habitaciones y precios" contra la API (crear, editar, activar/desactivar). */
@Component({
  selector: 'app-unidades-panel',
  imports: [CurrencyPipe, CamposUnidadComponent],
  template: `
    <p class="ayuda">Aquí defines lo que el huésped reserva y a qué precio por noche.</p>
    @if (!unidades().length && !formNueva()) {
      <div class="cta-vacia">
        <p class="icono" aria-hidden="true">🛏️</p>
        <h3>Falta lo más importante: qué se reserva y a qué precio</h3>
        <p>Sin esto el alojamiento no se puede publicar. ¿Qué ofreces?</p>
        <div class="acciones justify-content-center">
          <button type="button" class="btn btn-primario" (click)="nueva('COMPLETO')">Todo el alojamiento</button>
          <button type="button" class="btn btn-secundario" (click)="nueva('HABITACIONES')">Varios tipos de habitación</button>
        </div>
      </div>
    }

    <div class="lista-unidades">
      @for (u of unidades(); track u.id) {
        <article class="unidad-tarjeta" [class.inactiva]="!u.activa">
          <header class="unidad-cabecera d-flex justify-content-between align-items-center flex-wrap">
            <h3>{{ unica() ? 'Precio y capacidad' : u.nombre }}</h3>
            <span class="badge" [class.badge-publicado]="u.activa" [class.badge-borrador]="!u.activa">{{ u.activa ? 'Disponible para reservar' : 'Desactivada' }}</span>
          </header>
          @if (editando() === u.id && formEdicion(); as g) {
            <app-campos-unidad [grupo]="g" [completo]="unica()" [p]="'e-' + $index + '-'" />
            <div class="acciones">
              <button type="button" class="btn btn-secundario" (click)="guardar(u)" [disabled]="trabajando() || g.invalid">{{ trabajando() ? 'Guardando…' : 'Guardar cambios' }}</button>
              <button type="button" class="btn" (click)="editando.set(null)">Cancelar</button>
            </div>
          } @else {
            <dl class="datos-unidad">
              <div><dt>Precio por noche</dt><dd class="precio-unidad">{{ u.precio_noche_base | currency: 'USD' }}</dd></div>
              <div><dt>Huéspedes</dt><dd>{{ u.capacidad_huespedes }}</dd></div>
              <div><dt>Dormitorios</dt><dd>{{ u.num_habitaciones }}</dd></div>
              <div><dt>Camas</dt><dd>{{ u.num_camas }}</dd></div>
              <div><dt>Baños</dt><dd>{{ u.num_banos }}</dd></div>
              @if (!unica()) { <div><dt>Disponibles</dt><dd>{{ u.cantidad }}</dd></div> }
            </dl>
            <div class="acciones">
              <button type="button" class="btn btn-chico" (click)="editar(u)">Editar</button>
              <button type="button" class="btn btn-chico" (click)="verCalendario.emit(u)">Precios por fecha</button>
              <button type="button" class="btn btn-chico" [class.btn-peligro-borde]="u.activa" (click)="alternar(u)">{{ u.activa ? 'Desactivar' : 'Activar' }}</button>
            </div>
          }
          @if (avisos()[u.id]; as a) { <p class="aviso-guardado" [class.error]="a.error" [class.ok]="!a.error" role="status">{{ a.texto }}</p> }
        </article>
      }
    </div>

    @if (formNueva(); as g) {
      <section class="unidad-tarjeta nueva">
        <h3>{{ modalidadNueva() === 'COMPLETO' ? '🏠 Todo el alojamiento' : '🛏️ Nueva habitación' }}</h3>
        <app-campos-unidad [grupo]="g" [completo]="modalidadNueva() === 'COMPLETO'" p="n-" />
        <div class="acciones">
          <button type="button" class="btn btn-secundario" (click)="crear()" [disabled]="trabajando() || g.invalid">{{ trabajando() ? 'Guardando…' : 'Agregar' }}</button>
          <button type="button" class="btn" (click)="formNueva.set(null)">Cancelar</button>
        </div>
      </section>
    } @else if (unidades().length) {
      <button type="button" class="btn" (click)="nueva('HABITACIONES')">+ Agregar otra habitación</button>
    }
    @if (ok.texto()) { <p class="aviso-guardado ok" role="status">✓ {{ ok.texto() }}</p> }
    @if (error()) { <p class="aviso-guardado error" role="alert">✗ {{ error() }}</p> }
  `,
})
export class UnidadesPanelComponent {
  readonly codigo = input.required<number>();
  readonly nombreAlojamiento = input('');
  readonly unidades = input.required<Unidad[]>();
  readonly cambio = output<Unidad[]>();
  readonly verCalendario = output<Unidad>();

  private readonly api = inject(AnfitrionService);
  private readonly fb = inject(FormBuilder);
  private readonly confirmar = inject(ConfirmarService);
  readonly ok = avisoTemporal();
  readonly error = signal('');
  readonly trabajando = signal(false);
  readonly editando = signal<string | null>(null);
  readonly formEdicion = signal<FormUnidad | null>(null);
  readonly formNueva = signal<FormUnidad | null>(null);
  readonly modalidadNueva = signal<Modalidad>('HABITACIONES');
  readonly avisos = signal<Record<string, { texto: string; error: boolean }>>({});
  /** Una sola unidad con cantidad 1 = se alquila el alojamiento completo. */
  readonly unica = computed(() => this.unidades().length === 1 && this.unidades()[0].cantidad === 1);

  nueva(m: Modalidad): void {
    this.modalidadNueva.set(m);
    this.error.set('');
    this.formNueva.set(grupoUnidad(this.fb, m === 'COMPLETO' ? { nombre: this.nombreUnidad() } : {}));
  }

  editar(u: Unidad): void {
    this.editando.set(u.id);
    this.formEdicion.set(grupoUnidad(this.fb, u));
  }

  private nombreUnidad(): string {
    const n = (this.nombreAlojamiento() || 'Todo el alojamiento').trim();
    return n.length >= 2 ? n.slice(0, L.unidad.nombre.max) : 'Todo el alojamiento';
  }

  private valores(g: FormUnidad) {
    const v = g.getRawValue();
    return {
      nombre: (v.nombre ?? '').trim(), capacidad_huespedes: Number(v.capacidad_huespedes), num_habitaciones: Number(v.num_habitaciones),
      num_camas: Number(v.num_camas), num_banos: Number(v.num_banos), cantidad: Number(v.cantidad), precio_noche_base: Number(v.precio_noche_base),
    };
  }

  crear(): void {
    const g = this.formNueva();
    if (!g) return;
    g.markAllAsTouched();
    if (g.invalid) return;
    this.trabajando.set(true);
    this.error.set('');
    this.api.crearUnidad(this.codigo(), this.valores(g)).subscribe({
      next: (u) => {
        this.trabajando.set(false);
        this.formNueva.set(null);
        this.cambio.emit([...this.unidades(), u]);
        this.ok.mostrar('Guardado. Ya forma parte del alojamiento.');
      },
      error: (e) => this.fallo(e, g),
    });
  }

  guardar(u: Unidad): void {
    const g = this.formEdicion();
    if (!g) return;
    g.markAllAsTouched();
    if (g.invalid) return;
    this.trabajando.set(true);
    this.api.actualizarUnidad(u.id, this.valores(g)).subscribe({
      next: (n) => {
        this.trabajando.set(false);
        this.editando.set(null);
        this.cambio.emit(this.unidades().map((x) => (x.id === n.id ? n : x)));
        this.avisar(u.id, 'Guardado', false);
      },
      error: (e) => this.fallo(e, g, u.id),
    });
  }

  async alternar(u: Unidad): Promise<void> {
    const nombre = this.unica() ? 'el alojamiento' : `«${u.nombre}»`;
    const si = await this.confirmar.pedir(
      u.activa
        ? { titulo: '¿Desactivar esta opción?', mensaje: `Los huéspedes ya no podrán reservar ${nombre}. Las reservas existentes se mantienen. Si no queda ninguna activa, el alojamiento no se podrá publicar.`, confirmar: 'Desactivar', tono: 'peligro' }
        : { titulo: '¿Activar esta opción?', mensaje: `${nombre.charAt(0).toUpperCase() + nombre.slice(1)} volverá a estar disponible para reservar.`, confirmar: 'Activar' },
    );
    if (!si) return;
    this.api.actualizarUnidad(u.id, { activa: !u.activa }).subscribe({
      next: (n) => {
        this.cambio.emit(this.unidades().map((x) => (x.id === n.id ? n : x)));
        this.avisar(u.id, n.activa ? 'Activada' : 'Desactivada', false);
      },
      error: (e) => this.avisar(u.id, leerError(e).mensaje, true),
    });
  }

  private avisar(id: string, texto: string, error: boolean): void {
    this.avisos.update((a) => ({ ...a, [id]: { texto: (error ? '✗ ' : '✓ ') + texto, error } }));
    if (!error) setTimeout(() => this.avisos.update(({ [id]: _quitado, ...resto }) => resto), 4500);
  }

  private fallo(e: unknown, g: FormUnidad, id?: string): void {
    this.trabajando.set(false);
    const err = leerError(e);
    let ubicado = false;
    for (const [nombre, motivo] of Object.entries(err.campos)) {
      const c = g.get(nombre);
      if (c) {
        c.setErrors({ api: traducirMotivoApi(motivo) });
        c.markAsTouched();
        ubicado = true;
      }
    }
    if (!ubicado) {
      if (id) this.avisar(id, err.mensaje, true);
      else this.error.set(err.mensaje);
    }
  }
}

/**
 * Edición: precio especial y habitaciones a la venta por fecha de una unidad (GET/PUT units/:id/calendar).
 * Es opcional y viene plegado: vacío = precio normal y todas las habitaciones disponibles.
 */
@Component({
  selector: 'app-calendario-panel',
  imports: [CurrencyPipe, FormsModule, FiltroDirective],
  template: `
    <p class="ayuda" id="ayuda-calendario">Úsalo solo si quieres cobrar un precio distinto en fechas puntuales (feriados, temporada alta) o vender menos habitaciones un día. Si lo dejas vacío se usa el precio normal y todas las habitaciones disponibles.</p>
    <button type="button" class="btn" (click)="alternar()" [attr.aria-expanded]="abierto()" aria-controls="calendario-contenido">
      {{ abierto() ? 'Ocultar precios por fecha' : 'Ajustar precios por fecha' }}
    </button>
    @if (abierto()) {
      <div id="calendario-contenido">
        @if (!unidades().length) {
          <p class="ayuda">Primero agrega lo que ofreces en "Habitaciones y precios"; luego podrás ajustar fechas aquí.</p>
        } @else {
          <div class="fila">
            @if (unidades().length > 1) {
              <label>Habitación
                <select [ngModel]="unidadId()" (ngModelChange)="elegir($event)">
                  @for (u of unidades(); track u.id) { <option [value]="u.id">{{ u.nombre }}</option> }
                </select>
              </label>
            }
            <label>Desde <input type="date" [(ngModel)]="desde" [min]="hoy" /></label>
            <label>Hasta <input type="date" [(ngModel)]="hasta" [min]="desde" /></label>
            <button class="btn" type="button" (click)="cargar()" [disabled]="!!problemaRango()">Ver fechas</button>
          </div>
          @if (problemaRango(); as p) { <p class="msg-campo msg-error" role="alert"><span aria-hidden="true">✗</span> {{ p }}</p> }
          @if (dias().length) {
            <div class="tabla-scroll">
              <table class="tabla">
                <thead><tr><th>Fecha</th><th>Precio especial (USD)</th><th>Habitaciones a la venta ese día</th><th>Precio que se cobra</th><th>Libres</th></tr></thead>
                <tbody>
                  @for (d of dias(); track d.fecha) {
                    <tr>
                      <td>{{ fecha(d.fecha) }}</td>
                      <td class="calendario-celda">
                        <input appFiltro="decimal" maxlength="9" [placeholder]="precioNormal()" [(ngModel)]="d.precio_noche" (ngModelChange)="marcar(d.fecha)"
                               [attr.aria-label]="'Precio especial ' + fecha(d.fecha)" [attr.aria-invalid]="!!problemaPrecio(d)"
                               [attr.aria-describedby]="problemaPrecio(d) ? 'cal-p-' + d.fecha : null" />
                        @if (problemaPrecio(d); as p) { <small class="msg-campo msg-error" [id]="'cal-p-' + d.fecha">{{ p }}</small> }
                      </td>
                      <td class="calendario-celda">
                        <input appFiltro="entero" maxlength="3" [placeholder]="cantidadNormal()" [(ngModel)]="d.cantidad_a_la_venta" (ngModelChange)="marcar(d.fecha)"
                               [attr.aria-label]="'Habitaciones a la venta ' + fecha(d.fecha)" [attr.aria-invalid]="!!problemaCantidad(d)"
                               [attr.aria-describedby]="problemaCantidad(d) ? 'cal-c-' + d.fecha : null" />
                        @if (problemaCantidad(d); as p) { <small class="msg-campo msg-error" [id]="'cal-c-' + d.fecha">{{ p }}</small> }
                      </td>
                      <td>{{ d.precio_efectivo | currency: 'USD' }}</td>
                      <td>{{ d.cupo_libre }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <p class="ayuda">Pon 0 para cerrar ese día. Deja la casilla vacía para volver al precio o a la cantidad normal.</p>
            <div class="acciones">
              <button class="btn btn-secundario" type="button" (click)="guardar()" [disabled]="!cambiados().size || trabajando() || hayErrores()">
                {{ trabajando() ? 'Guardando…' : 'Guardar cambios (' + cambiados().size + ')' }}</button>
              <button class="btn" type="button" (click)="descartar()" [disabled]="!cambiados().size || trabajando()">Descartar cambios</button>
              @if (cambiados().size) { <span class="estado-seccion pendiente">Cambios sin guardar</span> }
            </div>
          }
        }
        @if (ok.texto()) { <p class="aviso-guardado ok" role="status">✓ {{ ok.texto() }}</p> }
        @if (error()) { <p class="aviso-guardado error" role="alert">✗ {{ error() }}</p> }
      </div>
    }
  `,
})
export class CalendarioPanelComponent {
  readonly unidades = input.required<Unidad[]>();
  private readonly api = inject(AnfitrionService);
  readonly ok = avisoTemporal();
  readonly hoy = fechaMasDias(0);
  readonly fecha = fechaConDia;
  /** Plegado por defecto: es un ajuste opcional. */
  readonly abierto = signal(false);
  readonly unidadId = signal<string | null>(null);
  readonly dias = signal<DiaCalendario[]>([]);
  /** Copia de lo cargado, para "Descartar cambios". */
  private originales: DiaCalendario[] = [];
  readonly cambiados = signal(new Set<string>());
  readonly trabajando = signal(false);
  readonly error = signal('');
  desde = fechaMasDias(0);
  hasta = fechaMasDias(30);

  private readonly unidad = computed(() => this.unidades().find((u) => u.id === this.unidadId()) ?? this.unidades()[0]);
  /** Placeholders con el valor normal de la unidad ("105,00" / "3"). */
  readonly precioNormal = computed(() => {
    const u = this.unidad();
    return u ? Number(u.precio_noche_base).toFixed(2).replace('.', ',') : '';
  });
  readonly cantidadNormal = computed(() => {
    const u = this.unidad();
    return u ? String(u.cantidad) : '';
  });

  alternar(): void {
    this.abierto.update((a) => !a);
    if (this.abierto() && !this.dias().length) this.cargar();
  }

  /** Abre el panel en una unidad concreta (botón "Precios por fecha" de la unidad). */
  abrir(u: Unidad): void {
    this.abierto.set(true);
    this.elegir(u.id);
  }

  elegir(id: string): void {
    this.unidadId.set(id);
    this.cargar();
  }

  hayCambios(): boolean {
    return this.cambiados().size > 0;
  }

  problemaRango(): string {
    if (!this.desde || !this.hasta) return 'Elige las fechas "Desde" y "Hasta".';
    if (this.hasta < this.desde) return '"Hasta" no puede ser antes de "Desde".';
    return '';
  }
  /** Vacío = precio normal; si se escribe, mayor que 0 (mín. 1 USD como el backend) y hasta 2 decimales. */
  problemaPrecio(d: DiaCalendario): string | null {
    return motivoPrecio(d.precio_noche, L.unidad.precio.min, L.unidad.precio.max, false);
  }
  problemaCantidad(d: DiaCalendario): string | null {
    return motivoRango(d.cantidad_a_la_venta, 0, L.unidad.cantidad, { entero: true });
  }
  hayErrores(): boolean {
    return this.dias().some((d) => this.cambiados().has(d.fecha) && (!!this.problemaPrecio(d) || !!this.problemaCantidad(d)));
  }

  cargar(): void {
    const id = this.unidadId() ?? this.unidades()[0]?.id;
    if (!id || this.problemaRango()) return;
    this.unidadId.set(id);
    this.error.set('');
    this.cambiados.set(new Set());
    this.api.calendario(id, this.desde, this.hasta).subscribe({
      next: (d) => {
        this.originales = d.map((x) => ({ ...x }));
        this.dias.set(d);
      },
      error: (e) => this.error.set(leerError(e).mensaje),
    });
  }

  marcar(fecha: string): void {
    this.cambiados.update((s) => new Set(s).add(fecha));
  }

  /** Vuelve a los valores cargados, sin llamar al API. */
  descartar(): void {
    this.dias.set(this.originales.map((x) => ({ ...x })));
    this.cambiados.set(new Set());
    this.error.set('');
  }

  guardar(): void {
    const id = this.unidadId();
    if (!id || this.hayErrores()) return;
    const vacio = (x: number | null | string) => (x === null || x === '' ? null : Number(x));
    const dias = this.dias()
      .filter((d) => this.cambiados().has(d.fecha))
      .map((d) => ({ fecha: d.fecha, precio_noche: vacio(d.precio_noche), cantidad_a_la_venta: vacio(d.cantidad_a_la_venta) }));
    this.trabajando.set(true);
    this.api.guardarCalendario(id, dias).subscribe({
      next: (r) => {
        this.trabajando.set(false);
        this.ok.mostrar(`Guardado (${r.dias} días)`);
        this.cargar();
      },
      error: (e) => {
        this.trabajando.set(false);
        this.error.set(leerError(e).mensaje);
      },
    });
  }
}
