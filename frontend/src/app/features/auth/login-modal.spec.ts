import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { throwError } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { LoginModalService } from '../../core/services/login-modal.service';
import { LoginModalComponent } from './login-modal.component';

@Component({ template: '' })
class PaginaVaciaComponent {}

const esperar = () => new Promise((r) => setTimeout(r, 0));

describe('Ventana de inicio de sesión', () => {
  let f: ComponentFixture<LoginModalComponent>;
  let svc: LoginModalService;
  let dialogo: HTMLDialogElement;
  const credencialesMalas = new HttpErrorResponse({ status: 401, error: { status: 401, code: 'VALIDATION_FAILED', detail: 'Correo o clave incorrectos' } });

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LoginModalComponent],
      providers: [
        provideRouter([{ path: '', component: PaginaVaciaComponent }, { path: 'login', component: PaginaVaciaComponent }, { path: '**', component: PaginaVaciaComponent }]),
        { provide: AuthService, useValue: { login: () => throwError(() => credencialesMalas), autenticado: () => false } },
      ],
    });
    f = TestBed.createComponent(LoginModalComponent);
    svc = TestBed.inject(LoginModalService);
    f.detectChanges();
    dialogo = (f.nativeElement as HTMLElement).querySelector('dialog') as HTMLDialogElement;
  });

  afterEach(() => dialogo?.open && dialogo.close());

  it('se abre como diálogo modal con el texto pedido y el foco en el correo', async () => {
    svc.abrir();
    f.detectChanges();
    await esperar();
    expect(dialogo.open).toBeTrue();
    const texto = dialogo.textContent ?? '';
    expect(texto).toContain('Bienvenido a tu próxima escapada');
    expect(texto).toContain('Qué bueno verte.');
    expect(texto).toContain('Inicia sesión para reservar y gestionar tus viajes.');
    expect(dialogo.querySelector('button[aria-label="Cerrar"]')).not.toBeNull();
    expect(document.activeElement?.id).toBe('login-email');
  });

  it('Esc la cierra y el foco vuelve al botón que la abrió', async () => {
    const boton = document.createElement('button');
    document.body.appendChild(boton);
    boton.focus();
    svc.abrir();
    f.detectChanges();
    await esperar();
    dialogo.dispatchEvent(new Event('cancel', { cancelable: true })); // lo que dispara Esc en un <dialog>
    f.detectChanges();
    expect(svc.abierto()).toBeFalse();
    expect(dialogo.open).toBeFalse();
    expect(document.activeElement).toBe(boton);
    boton.remove();
  });

  it('credenciales incorrectas: error general dentro de la ventana, sin cerrarla', async () => {
    svc.abrir();
    f.detectChanges();
    await esperar();
    f.componentInstance.form.setValue({ email: 'ana@correo.com', password: 'mala' });
    f.componentInstance.enviar();
    f.detectChanges();
    expect(dialogo.open).toBeTrue();
    expect(dialogo.textContent).toContain('Correo o contraseña incorrectos');
  });

  it('/login?volver=… abre la ventana y recuerda a dónde volver', async () => {
    await TestBed.inject(Router).navigateByUrl('/login?volver=%2Fmis-reservas');
    f.detectChanges();
    expect(svc.abierto()).toBeTrue();
    expect(svc.volver()).toBe('/mis-reservas');
  });
});
