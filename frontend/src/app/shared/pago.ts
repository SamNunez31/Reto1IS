import { Component, computed, input } from '@angular/core';

/**
 * Etiqueta del pago de una reserva (texto + color + icono: nunca solo color).
 * Huésped: "Pago en efectivo pendiente" | "Pagado". Admin: "Tarjeta · pagado" | "Efectivo · pendiente de confirmar" | "Efectivo · pagado".
 */
@Component({
  selector: 'app-pago',
  template: `
    @if (texto()) {
      <span class="badge" [class.badge-pendiente]="pendiente()" [class.badge-confirmada]="!pendiente()">
        <span aria-hidden="true">{{ pendiente() ? '⏳' : '✓' }} </span>{{ texto() }}
      </span>
    }
  `,
})
export class PagoComponent {
  /** TARJETA | EFECTIVO */
  readonly metodo = input<string | null | undefined>(null);
  /** PENDIENTE | APROBADO */
  readonly estado = input<string | null | undefined>(null);
  readonly vista = input<'huesped' | 'admin'>('huesped');
  readonly pendiente = computed(() => this.estado() === 'PENDIENTE');
  readonly texto = computed(() => {
    const m = this.metodo();
    const e = this.estado();
    if (!m || !e) return '';
    if (this.vista() === 'huesped') return e === 'PENDIENTE' ? 'Pago en efectivo pendiente' : 'Pagado';
    const medio = m === 'EFECTIVO' ? 'Efectivo' : 'Tarjeta';
    return `${medio} · ${e === 'PENDIENTE' ? 'pendiente de confirmar' : 'pagado'}`;
  });
}
