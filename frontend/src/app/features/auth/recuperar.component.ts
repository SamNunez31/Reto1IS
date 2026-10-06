import { Component, ElementRef, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ErrorVista, leerError } from '../../core/services/api-base';
import { AuthService } from '../../core/services/auth.service';
import { CampoMensajeComponent, conError, OjoClaveComponent, RequisitosClaveComponent } from '../../shared/campo';
import { AlertaErrorComponent } from '../../shared/ui';
import { aplicarErroresApi, LIMITES, normalizarEmail, revisarYEnfocar, vClave, vEmail, vIgualA } from '../../shared/validadores';

/** Paso 1: pedir el enlace de recuperación. */
@Component({
  selector: 'app-recuperar',
  imports: [ReactiveFormsModule, RouterLink, AlertaErrorComponent, CampoMensajeComponent],
  template: `
    <section class="tarjeta auth">
      <h1>Recuperar clave</h1>
      <p class="ayuda">Escribe el correo de tu cuenta y te enviaremos un enlace para crear una clave nueva.</p>
      <app-alerta-error [error]="error()" />
      @if (mensaje()) {
        <div class="alerta alerta-ok" role="status">
          {{ mensaje() }}
          @if (enlace()) {
            <p class="ayuda">Correo simulado (solo en desarrollo):
              <a [href]="enlace()">abrir enlace de restablecimiento</a></p>
          }
        </div>
      }
      <form [formGroup]="form" (ngSubmit)="enviar()" novalidate>
        <div class="grupo">
          <label for="rec-email">Correo</label>
          <input id="rec-email" type="email" formControlName="email" autocomplete="email" inputmode="email" [maxlength]="L.email"
                 placeholder="nombre@correo.com" [attr.aria-invalid]="mal()" aria-describedby="msg-rec-email" />
          <app-campo-mensaje [control]="form.controls.email" id="msg-rec-email" />
        </div>
        <button class="btn btn-primario" type="submit" [disabled]="enviando()">{{ enviando() ? 'Enviando…' : 'Enviar enlace' }}</button>
      </form>
      <p class="pie"><a routerLink="/login">Volver al login</a></p>
    </section>
  `,
})
export class RecuperarComponent {
  private readonly auth = inject(AuthService);
  private readonly raiz = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly L = LIMITES;
  readonly error = signal<ErrorVista | null>(null);
  readonly mensaje = signal('');
  readonly enlace = signal<string | null>(null);
  readonly enviando = signal(false);
  readonly form = inject(FormBuilder).nonNullable.group({ email: ['', vEmail()] });

  mal(): boolean {
    return conError(this.form.controls.email);
  }

  enviar(): void {
    this.error.set(null);
    if (!revisarYEnfocar(this.form, this.raiz.nativeElement)) return;
    this.enviando.set(true);
    this.auth.olvideClave(normalizarEmail(this.form.getRawValue().email)).subscribe({
      next: (r) => {
        this.mensaje.set(r.message);
        this.enlace.set(r.data.enlace_simulado ?? null);
        this.enviando.set(false);
      },
      error: (e) => {
        const error = leerError(e);
        if (error.status !== 400 || !aplicarErroresApi(this.form, error.campos)) this.error.set(error);
        this.enviando.set(false);
      },
    });
  }
}

/** Paso 2: fijar la nueva clave con el token del enlace. */
@Component({
  selector: 'app-restablecer',
  imports: [ReactiveFormsModule, RouterLink, AlertaErrorComponent, CampoMensajeComponent, RequisitosClaveComponent, OjoClaveComponent],
  template: `
    <section class="tarjeta auth">
      <h1>Nueva clave</h1>
      <app-alerta-error [error]="error()" />
      @if (listo()) {
        <div class="alerta alerta-ok" role="status">Clave actualizada. <a routerLink="/login">Inicia sesión</a></div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="enviar()" novalidate>
          <div class="grupo">
            <label for="nueva-clave">Nueva clave</label>
            <app-ojo-clave #ojo>
              <input id="nueva-clave" [type]="ojo.visible() ? 'text' : 'password'" formControlName="password" autocomplete="new-password"
                     [maxlength]="L.clave.max" [attr.aria-invalid]="mal('password')" aria-describedby="req-nueva msg-nueva" />
            </app-ojo-clave>
            <app-requisitos-clave [valor]="form.controls.password.value" [tocado]="form.controls.password.touched" id="req-nueva" />
            <app-campo-mensaje [control]="form.controls.password" id="msg-nueva" />
          </div>
          <div class="grupo">
            <label for="nueva-repetir">Repetir clave</label>
            <app-ojo-clave #ojo2>
              <input id="nueva-repetir" [type]="ojo2.visible() ? 'text' : 'password'" formControlName="repetir" autocomplete="new-password"
                     [maxlength]="L.clave.max" [attr.aria-invalid]="mal('repetir')" aria-describedby="msg-nueva-repetir" />
            </app-ojo-clave>
            <app-campo-mensaje [control]="form.controls.repetir" id="msg-nueva-repetir" />
          </div>
          <button class="btn btn-primario" type="submit" [disabled]="!token || enviando()">{{ enviando() ? 'Guardando…' : 'Guardar' }}</button>
        </form>
      }
    </section>
  `,
})
export class RestablecerComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly raiz = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly L = LIMITES;
  token = '';
  readonly error = signal<ErrorVista | null>(null);
  readonly listo = signal(false);
  readonly enviando = signal(false);
  readonly form = inject(FormBuilder).nonNullable.group({
    password: ['', vClave],
    repetir: ['', vIgualA('password')],
  });

  constructor() {
    this.form.controls.password.valueChanges.subscribe(() => this.form.controls.repetir.updateValueAndValidity({ emitEvent: false }));
  }

  ngOnInit(): void {
    this.token = this.ruta.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) this.error.set({ status: 400, code: 'VALIDATION_FAILED', mensaje: 'El enlace no tiene token', campos: {} });
  }

  mal(campo: 'password' | 'repetir'): boolean {
    return conError(this.form.controls[campo]);
  }

  enviar(): void {
    this.error.set(null);
    if (!revisarYEnfocar(this.form, this.raiz.nativeElement)) return;
    this.enviando.set(true);
    this.auth.restablecer(this.token, this.form.getRawValue().password).subscribe({
      next: () => this.listo.set(true),
      error: (e) => {
        const error = leerError(e);
        if (error.status !== 400 || !aplicarErroresApi(this.form, error.campos)) this.error.set(error);
        this.enviando.set(false);
      },
    });
  }
}
