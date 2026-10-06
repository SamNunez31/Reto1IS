import { Component, effect, ElementRef, inject, Injectable, signal, viewChild } from '@angular/core';

export type TonoConfirmacion = 'normal' | 'peligro';

export interface OpcionesConfirmacion {
  titulo: string;
  mensaje: string;
  /** Detalle opcional en una segunda línea (p. ej. el reembolso calculado). */
  detalle?: string;
  confirmar: string;
  cancelar?: string;
  tono?: TonoConfirmacion;
}

interface Pendiente extends OpcionesConfirmacion {
  resolver: (ok: boolean) => void;
}

/**
 * Diálogo de confirmación único para toda la app.
 * Uso: `if (await this.confirmar.pedir({ titulo, mensaje, confirmar: 'Despublicar', tono: 'peligro' })) { ... }`
 */
@Injectable({ providedIn: 'root' })
export class ConfirmarService {
  readonly actual = signal<Pendiente | null>(null);

  pedir(opciones: OpcionesConfirmacion): Promise<boolean> {
    // Si hubiera uno abierto, se da por cancelado
    this.actual()?.resolver(false);
    return new Promise<boolean>((resolver) => this.actual.set({ ...opciones, resolver }));
  }

  responder(ok: boolean): void {
    const p = this.actual();
    if (!p) return;
    this.actual.set(null);
    p.resolver(ok);
  }
}

/** Se monta una sola vez en AppComponent. <dialog> modal: foco atrapado, fondo inerte, Esc = Cancelar. */
@Component({
  selector: 'app-confirmar',
  template: `
    <!-- Clic en el fondo = Cancelar; con teclado se cancela con Esc (evento cancel del <dialog>) -->
    <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events -->
    <dialog #dialogo class="dialogo" role="alertdialog" aria-modal="true" aria-labelledby="conf-titulo" aria-describedby="conf-mensaje"
            (cancel)="$event.preventDefault(); svc.responder(false)" (click)="clicFondo($event)">
      @if (svc.actual(); as c) {
        <div class="dialogo-cuerpo">
          <p class="dialogo-icono" aria-hidden="true">{{ c.tono === 'peligro' ? '⚠️' : '❓' }}</p>
          <h2 id="conf-titulo">{{ c.titulo }}</h2>
          <div id="conf-mensaje">
            <p>{{ c.mensaje }}</p>
            @if (c.detalle) { <p class="dialogo-detalle">{{ c.detalle }}</p> }
          </div>
          <div class="dialogo-acciones">
            <button #cancelar type="button" class="btn" (click)="svc.responder(false)">{{ c.cancelar ?? 'Cancelar' }}</button>
            <button #confirmar type="button" class="btn" [class.btn-peligro]="c.tono === 'peligro'" [class.btn-secundario]="c.tono !== 'peligro'"
                    (click)="svc.responder(true)">{{ c.confirmar }}</button>
          </div>
        </div>
      }
    </dialog>
  `,
})
export class ConfirmarComponent {
  readonly svc = inject(ConfirmarService);
  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');
  private readonly btnCancelar = viewChild<ElementRef<HTMLButtonElement>>('cancelar');
  private readonly btnConfirmar = viewChild<ElementRef<HTMLButtonElement>>('confirmar');
  private foco: HTMLElement | null = null;

  constructor() {
    effect(() => {
      const c = this.svc.actual();
      const d = this.dialogo().nativeElement;
      if (c && !d.open) {
        this.foco = document.activeElement as HTMLElement | null;
        d.showModal();
        // Acción destructiva: el foco empieza en "Cancelar" para no confirmar por accidente con Enter
        setTimeout(() => (c.tono === 'peligro' ? this.btnCancelar() : this.btnConfirmar())?.nativeElement.focus());
      } else if (!c && d.open) {
        d.close();
        this.foco?.focus?.();
        this.foco = null;
      }
    });
  }

  /** Clic en el fondo oscuro (fuera del cuadro) = Cancelar. */
  clicFondo(ev: MouseEvent): void {
    if (ev.target === this.dialogo().nativeElement) this.svc.responder(false);
  }
}
