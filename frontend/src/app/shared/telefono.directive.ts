import { Directive, ElementRef, HostListener, inject } from '@angular/core';
import { NgControl } from '@angular/forms';
import { filtrarTelefono, maxTelefono } from './validadores';

/**
 * Teléfono de Ecuador: mientras se escribe o se pega deja solo dígitos y un "+" inicial,
 * con máximo 13 caracteres si empieza con +593 y 10 si empieza con 0 (las letras ni siquiera aparecen).
 * Uso: <input appTelefono formControlName="telefono" />
 */
@Directive({
  selector: 'input[appTelefono]',
  host: { inputmode: 'tel', autocomplete: 'tel', '[attr.maxlength]': 'maximo()' },
})
export class TelefonoDirective {
  private readonly el = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private readonly control = inject(NgControl, { optional: true, self: true });

  maximo(): number {
    return maxTelefono(this.el.nativeElement.value);
  }

  @HostListener('beforeinput', ['$event'])
  antes(ev: InputEvent): void {
    if (ev.inputType !== 'insertText' || ev.data === null) return;
    const input = this.el.nativeElement;
    const inicio = input.selectionStart ?? 0;
    const fin = input.selectionEnd ?? inicio;
    const enInicio = inicio === 0 && !input.value.startsWith('+');
    // Solo dígitos, y "+" únicamente como primer carácter
    if (!/^\d+$/.test(ev.data) && !(ev.data === '+' && enInicio)) {
      ev.preventDefault();
      return;
    }
    // Largo máximo según el formato resultante
    const resultado = input.value.slice(0, inicio) + ev.data + input.value.slice(fin);
    if (resultado.length > maxTelefono(resultado)) ev.preventDefault();
  }

  @HostListener('input')
  alEscribir(): void {
    // Cubre pegado, autocompletado y teclados móviles
    const input = this.el.nativeElement;
    const limpio = filtrarTelefono(input.value);
    if (limpio !== input.value) {
      input.value = limpio;
      this.control?.control?.setValue(limpio);
    }
  }
}
