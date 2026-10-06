import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DetalleAlojamiento, EventoTraza, Factura, Liquidacion, MiOrden } from '../../core/models/api.models';
import { ErrorVista, leerError } from '../../core/services/api-base';
import { CatalogoService } from '../../core/services/catalogo.service';
import { ReservasService } from '../../core/services/reservas.service';
import { fechaMasDias } from '../../shared/fechas';
import { avisoTemporal } from '../../shared/aviso';
import { SelectorEstrellasComponent } from '../../shared/calificacion';
import { PagoComponent } from '../../shared/pago';
import { problemaResena, RESENA } from '../../shared/texto-libre';
import { rangoLargo } from '../../shared/textos';
import { instanteCheckin, lineaCancelacion } from '../../shared/cancelacion';
import { ConfirmarService } from '../../shared/confirmar';
import { AlertaErrorComponent, CargandoComponent, EstadoComponent } from '../../shared/ui';

type Panel = 'detalle' | 'modificar' | 'factura' | 'resena' | null;
type Pestana = 'proximas' | 'completadas' | 'canceladas';

/** Agrupa los estados internos de la reserva en las pestañas de "Viajes". */
const GRUPO: Record<string, Pestana> = {
  PENDIENTE: 'proximas', CONFIRMADA: 'proximas',
  COMPLETADA: 'completadas',
  CANCELADA: 'canceladas', RECHAZADA: 'canceladas', EXPIRADA: 'canceladas',
};

@Component({
  selector: 'app-mis-reservas',
  imports: [CurrencyPipe, DatePipe, FormsModule, RouterLink, AlertaErrorComponent, CargandoComponent, EstadoComponent, SelectorEstrellasComponent, PagoComponent],
  template: `
    <div class="pagina-cabecera">
      <h1>Mis viajes</h1>
      <p class="meta">Tus reservas, facturas y reseñas en un solo lugar.</p>
    </div>
    <div class="pestanas" role="tablist" aria-label="Filtrar reservas">
      @for (p of pestanas; track p.id) {
        <button type="button" role="tab" [id]="'tab-' + p.id" [attr.aria-selected]="pestana() === p.id" aria-controls="lista-viajes" (click)="cambiar(p.id)">
          {{ p.nombre }} <span class="contador-tab">{{ cuenta()[p.id] }}</span>
        </button>
      }
    </div>
    <app-alerta-error [error]="error()" />
    @if (ok.texto()) { <p class="alerta alerta-ok" role="status">{{ ok.texto() }}</p> }

    <div id="lista-viajes" role="tabpanel" [attr.aria-labelledby]="'tab-' + pestana()">
      @if (cargando()) {
        <app-cargando texto="Cargando tus viajes…" />
      } @else {
        <div class="lista-viajes">
          @for (o of visibles(); track o.order_id) {
            <article class="viaje">
              <a class="viaje-foto" [routerLink]="['/alojamientos', o.accommodation_details.id]" tabindex="-1" aria-hidden="true">
                <img [src]="o.portada || 'https://placehold.co/600x400?text=Sin+foto'" alt="" loading="lazy" />
              </a>
              <div class="viaje-cuerpo">
                <div class="viaje-titulo d-flex justify-content-between align-items-start">
                  <h2><a [routerLink]="['/alojamientos', o.accommodation_details.id]">{{ o.accommodation_details.name }}</a></h2>
                  <app-estado [estado]="o.estado_interno" />
                  @if (o.estado_interno === 'CONFIRMADA' || o.estado_interno === 'COMPLETADA') {
                    <app-pago [metodo]="o.metodo_pago" [estado]="o.estado_pago" vista="huesped" />
                  }
                </div>
                @if (ciudades()[o.accommodation_details.id]; as ciudad) { <p class="meta">📍 {{ ciudad }}</p> }
                <ul class="viaje-datos">
                  <li><span aria-hidden="true">📅</span> {{ o.accommodation_details.checkin | date: 'd MMM' }} – {{ o.accommodation_details.checkout | date: 'd MMM y' }}</li>
                  <li><span aria-hidden="true">👥</span> {{ o.accommodation_details.guests }} huésped{{ o.accommodation_details.guests === 1 ? '' : 'es' }}</li>
                  <li><span aria-hidden="true">🧾</span> Código de reserva <strong>{{ o.locator }}</strong></li>
                  @if (o._links['cancel'] && politicaDe(o); as linea) { <li><span aria-hidden="true">↩️</span> {{ linea }}</li> }
                </ul>
                <p class="viaje-total">Total <strong>{{ o.total_price | currency: 'USD' }}</strong></p>
                <div class="acciones">
                  <button class="btn btn-chico" type="button" (click)="abrir(o, 'detalle')" [attr.aria-expanded]="abierto(o, 'detalle')">Ver detalle</button>
                  @if (o._links['modify']) { <button class="btn btn-chico" type="button" (click)="abrir(o, 'modificar')" [attr.aria-expanded]="abierto(o, 'modificar')">Cambiar fechas</button> }
                  <button class="btn btn-chico" type="button" (click)="abrir(o, 'factura')" [attr.aria-expanded]="abierto(o, 'factura')">Factura</button>
                  @if (o.estado_interno === 'COMPLETADA' && !o.tiene_resena) {
                    <button class="btn btn-chico btn-secundario" type="button" (click)="abrir(o, 'resena')" [attr.aria-expanded]="abierto(o, 'resena')">★ Calificar</button>
                  }
                  @if (o._links['cancel']) {
                    <button class="btn btn-chico btn-peligro-borde" type="button" (click)="pedirCancelacion(o)" [disabled]="cancelando() === o.order_id">
                      {{ cancelando() === o.order_id ? 'Calculando reembolso…' : 'Cancelar' }}</button>
                  }
                </div>

                @if (activa() === o.order_id) {
                  <div class="panel">
                    <app-alerta-error [error]="errorPanel()" />
                    @switch (panel()) {
                      @case ('detalle') {
                        <dl class="desglose">
                          <dt>Reservado el</dt><dd>{{ o.creation_date | date: 'medium' }}</dd>
                          @for (u of o.accommodation_details.units; track u.name) { <dt>Unidad</dt><dd>{{ u.quantity }} × {{ u.name }}</dd> }
                        </dl>
                        <h3>Historial</h3>
                        <ol class="timeline">
                          @for (e of eventos(); track e.evento_id) {
                            <li><strong>{{ e.tipo }}</strong> · {{ e.created_at | date: 'medium' }}</li>
                          } @empty { <li>Sin eventos</li> }
                        </ol>
                      }
                      @case ('modificar') {
                        <form class="fila" (ngSubmit)="modificar(o)">
                          <label>Nueva entrada <input type="date" name="ci" [(ngModel)]="nuevaEntrada" [min]="manana" required /></label>
                          <label>Nueva salida <input type="date" name="co" [(ngModel)]="nuevaSalida" [min]="nuevaEntrada" required /></label>
                          <button class="btn btn-primario" type="submit" [disabled]="trabajando() || !!problemaFechas(o)" [attr.aria-describedby]="'msg-mod-' + o.order_id">Guardar cambios</button>
                        </form>
                        @if (problemaFechas(o); as p) { <p class="msg-campo msg-error" [id]="'msg-mod-' + o.order_id" role="alert"><span aria-hidden="true">✗</span> {{ p }}</p> }
                        <p class="ayuda">El precio se recalcula; la diferencia se cobra o se reembolsa (simulado).</p>
                      }
                      @case ('factura') {
                        @if (factura(); as f) {
                          <dl class="desglose">
                            <dt>Número</dt><dd>{{ f.numero }} ({{ f.estado }})</dd>
                            <dt>Emisor</dt><dd>{{ f.emisor_nombre }}</dd>
                            <dt>Comprador</dt><dd>{{ f.comprador_nombre }} · {{ f.comprador_identificacion }}</dd>
                            <dt>Subtotal</dt><dd>{{ f.subtotal_sin_impuestos | currency: 'USD' }}</dd>
                            <dt>Servicio</dt><dd>{{ f.servicio | currency: 'USD' }}</dd>
                            <dt>IVA</dt><dd>{{ f.iva | currency: 'USD' }}</dd>
                            <dt class="total">Total</dt><dd class="total">{{ f.total | currency: 'USD' }}</dd>
                          </dl>
                        } @else if (!errorPanel()) { <app-cargando /> }
                      }
                      @case ('resena') {
                        <form (ngSubmit)="resenar(o)">
                          <app-selector-estrellas [(valor)]="estrellas" [nombre]="'estrellas-' + o.order_id" />
                          <label [for]="'com-' + o.order_id">Comentario (opcional)</label>
                          <textarea [id]="'com-' + o.order_id" name="comentario" [ngModel]="comentario()" (ngModelChange)="comentario.set($event)"
                                    [attr.maxlength]="limiteResena.max" rows="3" [attr.aria-invalid]="!!problemaComentario()"
                                    [attr.aria-describedby]="'msg-com-' + o.order_id"></textarea>
                          <p class="msg-campo" [class.msg-error]="!!problemaComentario()" [id]="'msg-com-' + o.order_id" aria-live="polite">
                            @if (problemaComentario(); as p) { <span aria-hidden="true">✗</span> {{ p }} }
                            @else { {{ comentario().trim().length }}/{{ limiteResena.max }} · entre {{ limiteResena.min }} y {{ limiteResena.max }} caracteres, sin enlaces, correos ni teléfonos }
                          </p>
                          <button class="btn btn-primario" type="submit" [disabled]="trabajando() || !!problemaComentario()">Publicar reseña</button>
                        </form>
                      }
                    }
                  </div>
                }
              </div>
            </article>
          } @empty {
            <div class="sin-resultados">
              <p class="icono" aria-hidden="true">{{ pestana() === 'proximas' ? '🧳' : pestana() === 'completadas' ? '🏔️' : '🌤️' }}</p>
              <h2>{{ vacio().titulo }}</h2>
              <p>{{ vacio().texto }}</p>
              @if (pestana() === 'proximas') { <a class="btn btn-primario" routerLink="/">Buscar alojamiento</a> }
            </div>
          }
        </div>
        @if (total() > limite) {
          <nav class="paginacion d-flex justify-content-center align-items-center gap-3" aria-label="Paginación">
            <button class="btn" type="button" (click)="pagina(-1)" [disabled]="offset() === 0">Anterior</button>
            <button class="btn" type="button" (click)="pagina(1)" [disabled]="offset() + limite >= total()">Siguiente</button>
          </nav>
        }
      }
    </div>
  `,
})
export class MisReservasComponent implements OnInit {
  private readonly reservas = inject(ReservasService);
  private readonly catalogo = inject(CatalogoService);
  private readonly confirmar = inject(ConfirmarService);
  readonly ok = avisoTemporal(6000);
  /** order_id cuya cancelación se está calculando o enviando. */
  readonly cancelando = signal<string | null>(null);
  readonly limite = 50;
  readonly manana = fechaMasDias(1);
  readonly pestanas: { id: Pestana; nombre: string }[] = [
    { id: 'proximas', nombre: 'Próximas' },
    { id: 'completadas', nombre: 'Completadas' },
    { id: 'canceladas', nombre: 'Canceladas' },
  ];
  readonly pestana = signal<Pestana>('proximas');
  readonly ordenes = signal<MiOrden[]>([]);
  readonly ciudades = signal<Record<number, string>>({});
  /** Política de cancelación y hora de check-in de cada alojamiento (de /details con extras=policies). */
  readonly politicas = signal<Record<number, NonNullable<DetalleAlojamiento['policies']>>>({});
  readonly total = signal(0);
  readonly offset = signal(0);
  readonly cargando = signal(true);
  readonly error = signal<ErrorVista | null>(null);
  readonly activa = signal<string | null>(null);
  readonly panel = signal<Panel>(null);
  readonly errorPanel = signal<ErrorVista | null>(null);
  readonly trabajando = signal(false);
  readonly factura = signal<Factura | null>(null);
  readonly eventos = signal<EventoTraza[]>([]);
  nuevaEntrada = '';
  nuevaSalida = '';
  /** Selector de 1 a 5 estrellas; el backend recibe nota = estrellas × 2 (escala 1–10). */
  readonly estrellas = signal(5);
  /** Comentario con control automático en vivo (mismas reglas que el backend, que vuelve a validar). */
  readonly comentario = signal('');
  readonly problemaComentario = computed(() => problemaResena(this.comentario()));
  readonly limiteResena = RESENA;

  readonly visibles = computed(() => this.ordenes().filter((o) => (GRUPO[o.estado_interno] ?? 'proximas') === this.pestana()));
  readonly cuenta = computed(() => {
    const c: Record<Pestana, number> = { proximas: 0, completadas: 0, canceladas: 0 };
    for (const o of this.ordenes()) c[GRUPO[o.estado_interno] ?? 'proximas']++;
    return c;
  });
  readonly vacio = computed(() => {
    switch (this.pestana()) {
      case 'proximas': return { titulo: 'Aún no tienes viajes próximos', texto: 'Cuando reserves, tu próxima escapada aparecerá aquí. ¿Volcanes, playa o Galápagos?' };
      case 'completadas': return { titulo: 'Todavía no hay viajes completados', texto: 'Después de tu estadía podrás calificar el alojamiento desde aquí.' };
      default: return { titulo: 'No tienes reservas canceladas', texto: '¡Bien! Ninguno de tus planes se ha caído.' };
    }
  });

  ngOnInit(): void {
    this.cargar();
  }

  cambiar(p: Pestana): void {
    this.pestana.set(p);
    this.activa.set(null);
  }

  abierto(o: MiOrden, panel: Panel): boolean {
    return this.activa() === o.order_id && this.panel() === panel;
  }

  cargar(): void {
    this.cargando.set(true);
    this.reservas.misOrdenes(this.limite, this.offset()).subscribe({
      next: (l) => {
        this.ordenes.set(l.items);
        this.total.set(l.total);
        this.cargando.set(false);
        this.cargarCiudades(l.items);
      },
      error: (e) => {
        this.error.set(leerError(e));
        this.cargando.set(false);
      },
    });
  }

  /**
   * La ciudad y la política no vienen en /me/orders: se toman de /details (si falla, simplemente no se muestran).
   * Es la política vigente del alojamiento; el reembolso exacto de ESTA reserva lo da cancel-preview al cancelar.
   */
  private cargarCiudades(items: MiOrden[]): void {
    const ids = [...new Set(items.map((o) => o.accommodation_details.id))];
    this.catalogo.detalles(ids, ['policies']).subscribe({
      next: (d) => {
        this.ciudades.set(Object.fromEntries(d.map((a) => [a.id, `${a.city.name}, ${a.city.province}`])));
        this.politicas.set(Object.fromEntries(d.filter((a) => a.policies).map((a) => [a.id, a.policies!])));
      },
      error: () => undefined,
    });
  }

  /** "Cancelación gratis hasta el 9 nov, 14:00 · …" con las fechas de esta reserva ('' si no hay datos). */
  politicaDe(o: MiOrden): string {
    const p = this.politicas()[o.accommodation_details.id];
    if (!p?.cancellation) return '';
    return lineaCancelacion(p.cancellation.name, p.cancellation.rules ?? [], instanteCheckin(o.accommodation_details.checkin, p.checkin_from));
  }

  pagina(delta: number): void {
    this.offset.update((o) => Math.max(0, o + delta * this.limite));
    this.cargar();
  }

  abrir(o: MiOrden, panel: Panel): void {
    if (this.abierto(o, panel)) {
      this.activa.set(null);
      return;
    }
    this.activa.set(o.order_id);
    this.panel.set(panel);
    this.errorPanel.set(null);
    this.ok.limpiar();
    const err = (e: unknown) => this.errorPanel.set(leerError(e));
    if (panel === 'factura') {
      this.factura.set(null);
      this.reservas.factura(o.order_id).subscribe({ next: (f) => this.factura.set(f), error: err });
    } else if (panel === 'detalle') {
      this.eventos.set([]);
      this.reservas.timeline(o.order_id).subscribe({ next: (t) => this.eventos.set(t), error: err });
    } else if (panel === 'modificar') {
      this.nuevaEntrada = o.accommodation_details.checkin;
      this.nuevaSalida = o.accommodation_details.checkout;
    }
  }

  /** Calcula el reembolso con cancel-preview y lo muestra en el diálogo antes de cancelar. */
  pedirCancelacion(o: MiOrden): void {
    const usd = (n: number) => `USD ${n.toFixed(2)}`;
    const fin = () => this.cancelando.set(null);
    this.error.set(null);
    this.ok.limpiar();
    this.cancelando.set(o.order_id);
    this.reservas.previsualizarCancelacion(o.order_id).subscribe({
      next: async (l: Liquidacion) => {
        const si = await this.confirmar.pedir({
          titulo: '¿Cancelar esta reserva?',
          mensaje: `Vas a cancelar tu reserva en «${o.accommodation_details.name}» (${rangoLargo(o.accommodation_details.checkin, o.accommodation_details.checkout)}, código de reserva ${o.locator}). No se puede deshacer.`,
          detalle: o.estado_pago === 'PENDIENTE'
            ? 'Elegiste pagar en efectivo y aún no has pagado: no se cobra nada ni hay reembolso.'
            : l.penalty > 0
              ? `Faltan ${Math.round(l.horas_anticipacion)} h para el check-in: se cobra una penalidad del ${l.porcentaje_aplicado} % del hospedaje (${usd(l.penalty)}). Te devolvemos ${usd(l.refund)}.`
              : `Sin penalidad: te devolvemos ${usd(l.refund)}.`,
          confirmar: 'Sí, cancelar reserva',
          cancelar: 'Mantener reserva',
          tono: 'peligro',
        });
        if (!si) return fin();
        this.reservas.cancelar(o.order_id).subscribe({
          next: (r) => {
            fin();
            this.terminar(`Reserva ${o.locator} cancelada. Reembolso: ${usd(r.refund)}.`);
          },
          error: (e) => {
            fin();
            this.error.set(leerError(e));
          },
        });
      },
      error: (e) => {
        fin();
        this.error.set(leerError(e));
      },
    });
  }

  /** Validación de las nuevas fechas antes de llamar al API ('' = válidas). */
  problemaFechas(o: MiOrden): string {
    if (!this.nuevaEntrada || !this.nuevaSalida) return 'Elige la nueva entrada y la nueva salida.';
    if (this.nuevaEntrada < this.manana) return 'La nueva entrada debe ser a partir de mañana.';
    if (this.nuevaSalida <= this.nuevaEntrada) return 'La salida debe ser al menos un día después de la entrada.';
    if (this.nuevaEntrada === o.accommodation_details.checkin && this.nuevaSalida === o.accommodation_details.checkout) return 'Las fechas son las mismas de la reserva.';
    return '';
  }

  modificar(o: MiOrden): void {
    if (this.problemaFechas(o)) return;
    this.trabajando.set(true);
    this.reservas.modificar(o.order_id, { checkin: this.nuevaEntrada, checkout: this.nuevaSalida }).subscribe({
      next: (r) => this.terminar(`Reserva ${r.locator} modificada. Nuevo total: USD ${r.total_price.toFixed(2)}`),
      error: (e) => this.falloPanel(e),
    });
  }

  resenar(o: MiOrden): void {
    if (this.problemaComentario()) return;
    this.trabajando.set(true);
    this.reservas.resenar(o.order_id, this.estrellas() * 2, this.comentario().trim()).subscribe({
      next: () => {
        this.comentario.set('');
        this.terminar('¡Gracias por tu reseña!');
      },
      error: (e) => this.falloPanel(e),
    });
  }

  private terminar(msg: string): void {
    this.trabajando.set(false);
    this.activa.set(null);
    this.ok.mostrar(msg);
    this.cargar();
  }

  private falloPanel(e: unknown): void {
    this.trabajando.set(false);
    this.errorPanel.set(leerError(e));
  }
}
