import { Component, computed, input, model } from '@angular/core';
import { aEstrellas, plural } from './textos';

/** Calificación en estrellas (nota 1–10 del backend ÷ 2, a media estrella) + "(n reseñas)". Sin reseñas: "Nuevo". */
@Component({
  selector: 'app-calificacion',
  template: `
    @if (nota() !== null && nota() !== undefined && resenas() > 0) {
      <span class="calificacion" [class.chica]="chica()" role="img" [attr.aria-label]="etiqueta()">
        <span class="estrellas-calif" aria-hidden="true">
          @for (t of tipos(); track $index) { <span class="estrella" [class.llena]="t === 'llena'" [class.media]="t === 'media'">★</span> }
        </span>
        <span class="calif-valor" aria-hidden="true">{{ valorTexto() }}</span>
        <span class="calif-conteo" aria-hidden="true">({{ conteo() }})</span>
      </span>
    } @else {
      <span class="badge-nuevo" [class.chica]="chica()">Nuevo</span>
    }
  `,
})
export class CalificacionComponent {
  /** Nota 1–10 (promedio o de una reseña). */
  readonly nota = input<number | null | undefined>(null);
  readonly resenas = input(1);
  /** Oculta el conteo (para una reseña individual). */
  readonly sinConteo = input(false);
  readonly chica = input(false);
  readonly estrellas = computed(() => aEstrellas(this.nota() ?? 0));
  readonly valorTexto = computed(() => this.estrellas().toLocaleString('es-EC', { minimumFractionDigits: this.estrellas() % 1 ? 1 : 0 }));
  readonly conteo = computed(() => plural(this.resenas(), 'reseña'));
  readonly tipos = computed(() => [1, 2, 3, 4, 5].map((i) => (this.estrellas() >= i ? 'llena' : this.estrellas() >= i - 0.5 ? 'media' : 'vacia')));
  readonly etiqueta = computed(() => `${this.valorTexto()} de 5 estrellas` + (this.sinConteo() ? '' : ` · ${this.conteo()}`));
}

/** Selector de 1 a 5 estrellas (radios nativos: flechas del teclado y lectores de pantalla). */
@Component({
  selector: 'app-selector-estrellas',
  template: `
    <fieldset class="selector-estrellas">
      <legend>{{ leyenda() }}</legend>
      <div class="estrellas-opciones">
        @for (n of [1, 2, 3, 4, 5]; track n) {
          <label [class.activa]="n <= valor()" [attr.title]="n + ' de 5 estrellas'">
            <input type="radio" [name]="nombre()" [value]="n" [checked]="valor() === n" (change)="valor.set(n)" [attr.aria-label]="n + ' de 5 estrellas'" />
            <span aria-hidden="true">★</span>
          </label>
        }
        <span class="selector-texto" aria-hidden="true">{{ textos[valor() - 1] }}</span>
      </div>
    </fieldset>
  `,
})
export class SelectorEstrellasComponent {
  readonly valor = model(5);
  readonly nombre = input('estrellas');
  readonly leyenda = input('¿Cómo fue tu estadía?');
  readonly textos = ['Mala', 'Regular', 'Buena', 'Muy buena', 'Excelente'];
}

/** Contador con − y + (huéspedes, habitaciones). */
@Component({
  selector: 'app-contador',
  template: `
    <div class="contador-fila" role="group" [attr.aria-labelledby]="id() + '-et'">
      <div>
        <span class="contador-etiqueta" [id]="id() + '-et'">{{ etiqueta() }}</span>
        @if (detalle()) { <small class="ayuda">{{ detalle() }}</small> }
      </div>
      <div class="contador-control">
        <button type="button" class="btn-redondo" (click)="cambiar(-1)" [disabled]="valor() <= min()" [attr.aria-label]="'Quitar ' + singular()">−</button>
        <span class="contador-valor" aria-live="polite" [attr.aria-label]="valor() + ' ' + etiqueta().toLowerCase()">{{ valor() }}</span>
        <button type="button" class="btn-redondo" (click)="cambiar(1)" [disabled]="valor() >= max()" [attr.aria-label]="'Agregar ' + singular()">+</button>
      </div>
    </div>
  `,
})
export class ContadorComponent {
  readonly valor = model(0);
  readonly etiqueta = input.required<string>();
  readonly singular = input.required<string>();
  readonly detalle = input('');
  readonly min = input(0);
  readonly max = input(20);
  readonly id = input.required<string>();
  cambiar(d: number): void {
    this.valor.set(Math.min(this.max(), Math.max(this.min(), this.valor() + d)));
  }
}
