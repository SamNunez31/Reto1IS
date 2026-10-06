import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { throwError } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { MENSAJE_CORREO_DUPLICADO, mensajeCorreoDuplicado, RegistroComponent } from './registro.component';

describe('Registro: correo duplicado', () => {
  const conflicto = new HttpErrorResponse({
    status: 409,
    error: { type: 'about:blank', title: 'Conflict', status: 409, code: 'VALIDATION_FAILED', detail: 'Ya existe una cuenta con este correo' },
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RegistroComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: { registrar: () => throwError(() => conflicto) } }],
    });
  });

  it('el 409 se muestra bajo el campo correo, no como error general', () => {
    const f = TestBed.createComponent(RegistroComponent);
    const c = f.componentInstance;
    f.detectChanges(); // el formulario ya está en pantalla cuando el usuario envía
    c.form.setValue({ nombres: 'Ana', apellidos: 'Paz', email: 'Ana.Paz@Gmail.com', password: 'Clave1234', repetir: 'Clave1234' });
    c.enviar();
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(c.form.controls.email.errors?.['api']).toBe('Ya existe una cuenta con este correo');
    expect(el.querySelector('#msg-email')?.textContent).toContain('Ya existe una cuenta con este correo');
    expect(el.querySelector('#reg-email')?.getAttribute('aria-invalid')).toBe('true');
    expect(c.errorGeneral()).toBeNull();
  });

  it('sin detalle del servidor usa el mismo texto', () => {
    expect(mensajeCorreoDuplicado('')).toBe(MENSAJE_CORREO_DUPLICADO);
    expect(mensajeCorreoDuplicado(undefined)).toBe('Ya existe una cuenta con este correo');
  });

  it('ya no muestra "Completa todos los campos" ni "Ver qué falta"', () => {
    const f = TestBed.createComponent(RegistroComponent);
    f.detectChanges();
    const texto = (f.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).not.toContain('Completa todos los campos');
    expect(texto).not.toContain('Ver qué falta');
  });
});
