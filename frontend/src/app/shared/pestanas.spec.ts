import { TestBed } from '@angular/core/testing';
import { indicePestana } from './pestanas';
import { EstrellasComponent } from './ui';

describe('Pestañas: navegación por teclado', () => {
  it('flechas circulares, Inicio y Fin; otras teclas no hacen nada', () => {
    expect(indicePestana('ArrowRight', 0, 3)).toBe(1);
    expect(indicePestana('ArrowRight', 2, 3)).toBe(0);
    expect(indicePestana('ArrowLeft', 0, 3)).toBe(2);
    expect(indicePestana('Home', 2, 3)).toBe(0);
    expect(indicePestana('End', 0, 3)).toBe(2);
    expect(indicePestana('Enter', 1, 3)).toBeNull();
    expect(indicePestana('ArrowRight', 0, 0)).toBeNull();
  });
});

describe('Estrellas de categoría', () => {
  it('se exponen como imagen con nombre accesible (role="img" + aria-label)', () => {
    const f = TestBed.createComponent(EstrellasComponent);
    f.componentRef.setInput('n', 4);
    f.detectChanges();
    const el = (f.nativeElement as HTMLElement).querySelector('.estrellas');
    expect(el?.getAttribute('role')).toBe('img');
    expect(el?.getAttribute('aria-label')).toBe('4 estrellas');
  });
});
