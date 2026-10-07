import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { aNumero, filtrarDecimal, filtrarEntero, filtrarNombre, filtrarRazon, FiltroDirective, permitido } from './entrada';
import { formatearNumero, motivoCvv, motivoNumero, motivoTitular } from './tarjeta';
import { filtrarTelefono } from './validadores';
import {
  motivoNombre, motivoNombreLugar, motivoPrecio, motivoRango, motivoRazon, vRango, vTelefono,
} from './validadores';

describe('Validadores de campos', () => {
  describe('teléfono', () => {
    it('al escribir/pegar deja solo dígitos y un "+" inicial, con el largo máximo del formato', () => {
      expect(filtrarTelefono('099-123 45ab67')).toBe('0991234567');
      expect(filtrarTelefono('+593 99 123 4567')).toBe('+593991234567');
      expect(filtrarTelefono('09+91234567')).toBe('0991234567');
      expect(filtrarTelefono('09912345678999')).toBe('0991234567');
    });
    it('acepta celular y fijo de Ecuador; rechaza otros formatos con mensaje en español', () => {
      expect(vTelefono(new FormControl('0991234567'))).toBeNull();
      expect(vTelefono(new FormControl('+593991234567'))).toBeNull();
      expect(vTelefono(new FormControl('022345678'))).toBeNull();
      expect(vTelefono(new FormControl(''))).toBeNull(); // opcional
      expect(vTelefono(new FormControl('12345'))?.['mensaje']).toContain('teléfono de Ecuador');
    });
  });

  describe('tarjeta', () => {
    it('formatea en grupos, solo dígitos y máximo 19', () => {
      expect(formatearNumero('4242abc4242-4242 4242')).toBe('4242 4242 4242 4242');
      expect(formatearNumero('4'.repeat(25)).replace(/\s/g, '').length).toBe(19);
      expect(formatearNumero('378282246310005')).toBe('3782 822463 10005'); // Amex 4-6-5
    });
    it('valida largo y dígito verificador (Luhn)', () => {
      expect(motivoNumero('4242 4242 4242 4242')).toBeNull();
      expect(motivoNumero('')).toContain('Ingresa');
      expect(motivoNumero('4242 4242')).toContain('incompleto');
      expect(motivoNumero('4242 4242 4242 4241')).toContain('no es válido');
    });
  });

  describe('CVV', () => {
    it('3 dígitos (4 en American Express)', () => {
      expect(motivoCvv('123', 'visa')).toBeNull();
      expect(motivoCvv('1234', 'amex')).toBeNull();
      expect(motivoCvv('12', 'visa')).toContain('3 dígitos');
      expect(motivoCvv('123', 'amex')).toContain('4 dígitos');
      expect(motivoCvv('', 'visa')).toContain('Ingresa');
    });
  });

  describe('nombres', () => {
    it('al escribir quita dígitos y símbolos; deja tildes, ñ, espacio, apóstrofe y guion', () => {
      expect(filtrarNombre('José1 María@')).toBe('José María');
      expect(filtrarNombre("O'Brien-Núñez")).toBe("O'Brien-Núñez");
      expect(filtrarNombre('  Ana   Paula')).toBe('Ana Paula');
      expect(filtrarRazon('Pérez & Hijos Cía. Ltda. 2')).toBe('Pérez & Hijos Cía. Ltda. ');
    });
    it('nombres y apellidos de persona', () => {
      expect(motivoNombre('María José', 'nombres')).toBeNull();
      expect(motivoNombre("D'Alessandro-Peña", 'apellidos')).toBeNull();
      expect(motivoNombre('Juan2', 'nombres')).toContain('números');
      expect(motivoNombre('Juan_', 'nombres')).toContain('solo pueden tener letras');
      expect(motivoNombre('', 'apellidos')).toContain('Ingresa');
    });
    it('titular de la tarjeta', () => {
      expect(motivoTitular('MARIA PEREZ')).toBeNull();
      expect(motivoTitular('Maria 3')).toContain('números');
      expect(motivoTitular('Maria $')).toContain('solo puede tener letras');
    });
    it('razón social y ciudad', () => {
      expect(motivoRazon('Comercial Andina S.A.')).toBeNull();
      expect(motivoRazon('Hotel 3 Estrellas')).toContain('números');
      expect(motivoNombreLugar('Santo Domingo', 'la ciudad')).toBeNull();
      expect(motivoNombreLugar('Quito#', 'la ciudad')).toContain('Solo letras');
    });
  });

  describe('precios y cantidades', () => {
    it('precio: número > 0, con hasta 2 decimales (punto o coma)', () => {
      expect(motivoPrecio(105)).toBeNull();
      expect(motivoPrecio('105,50')).toBeNull();
      expect(motivoPrecio('105.5')).toBeNull();
      expect(motivoPrecio('105,505')).toContain('2 decimales');
      expect(motivoPrecio(0)).toContain('entre 1');
      expect(motivoPrecio('-5')).toContain('entre 1');
      expect(motivoPrecio('1e3')).toBe('Escribe solo números');
      expect(motivoPrecio('')).toBe('Completa este campo');
      expect(motivoPrecio('', 1, 100000, false)).toBeNull(); // opcional (calendario)
    });
    it('al escribir un precio solo quedan dígitos y un separador con 2 decimales', () => {
      expect(filtrarDecimal('12.5')).toBe('12,5');
      expect(filtrarDecimal('1,234')).toBe('1,23');
      expect(filtrarDecimal('1a2e+3-')).toBe('123');
      expect(filtrarDecimal('1.2.3')).toBe('1,23');
      expect(aNumero('12,50')).toBe(12.5);
      expect(aNumero('')).toBeNull();
      expect(permitido('decimal', '12.')).toBeTrue();
      expect(permitido('decimal', '12,345')).toBeFalse();
      expect(permitido('decimal', '1e')).toBeFalse();
    });
    it('enteros: sin letras, signos ni decimales', () => {
      expect(filtrarEntero('1e2+-3.5')).toBe('1235');
      expect(filtrarEntero('123456', 3)).toBe('123');
      expect(motivoRango('2.5', 1, 30, { entero: true })).toContain('entero');
      expect(motivoRango(31, 1, 30, { entero: true })).toContain('entre 1 y 30');
      expect(vRango(1, 30, { entero: true, obligatorio: true })(new FormControl(null))?.['mensaje']).toBe('Completa este campo');
    });
  });
});

@Component({
  imports: [ReactiveFormsModule, FiltroDirective],
  template: `<input id="n" appFiltro="entero" [formControl]="numero" /><input id="t" appFiltro="nombre" [formControl]="texto" />
    <input id="g" appFiltro="nombre" autocomplete="given-name" [formControl]="texto" />`,
})
class PruebaFiltroComponent {
  numero = new FormControl<number | null>(null);
  texto = new FormControl('');
}

describe('FiltroDirective', () => {
  const escribir = (el: HTMLInputElement, data: string): boolean => {
    const ev = new InputEvent('beforeinput', { data, inputType: 'insertText', cancelable: true });
    el.dispatchEvent(ev);
    return !ev.defaultPrevented;
  };

  it('bloquea letras y "e" en un campo numérico, y limpia lo pegado', () => {
    const f = TestBed.createComponent(PruebaFiltroComponent);
    f.detectChanges();
    const el = f.nativeElement.querySelector('#n') as HTMLInputElement;
    expect(el.getAttribute('inputmode')).toBe('numeric');
    expect(escribir(el, '5')).toBeTrue();
    expect(escribir(el, 'e')).toBeFalse();
    expect(escribir(el, '-')).toBeFalse();
    el.value = '12a3';
    el.dispatchEvent(new Event('input'));
    expect(el.value).toBe('123');
    expect(f.componentInstance.numero.value).toBe(123);
  });

  it('respeta el autocomplete del campo (WCAG 1.3.5) y solo pone "off" si el campo no declara uno', () => {
    const f = TestBed.createComponent(PruebaFiltroComponent);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('#g')?.getAttribute('autocomplete')).toBe('given-name');
    expect(el.querySelector('#t')?.getAttribute('autocomplete')).toBe('off');
  });

  it('bloquea dígitos en un campo de nombre', () => {
    const f = TestBed.createComponent(PruebaFiltroComponent);
    f.detectChanges();
    const el = f.nativeElement.querySelector('#t') as HTMLInputElement;
    expect(escribir(el, 'ñ')).toBeTrue();
    expect(escribir(el, '7')).toBeFalse();
    el.value = 'Ana1 Peña';
    el.dispatchEvent(new Event('input'));
    expect(f.componentInstance.texto.value).toBe('Ana Peña');
  });
});
