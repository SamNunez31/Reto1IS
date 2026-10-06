import { Component, ElementRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ErrorVista, leerError } from '../../core/services/api-base';
import { AuthService } from '../../core/services/auth.service';
import { CampoMensajeComponent, conError, OjoClaveComponent } from '../../shared/campo';
import { AlertaErrorComponent } from '../../shared/ui';
import { LIMITES, normalizarEmail, revisarYEnfocar, vEmail, vRequerido } from '../../shared/validadores';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, AlertaErrorComponent, CampoMensajeComponent, OjoClaveComponent],
  template: `
    <section class="tarjeta auth">
      <h1>Iniciar sesión</h1>
      <app-alerta-error [error]="error()" />
      <form [formGroup]="form" (ngSubmit)="enviar()" novalidate>
        <div class="grupo">
          <label for="login-email">Correo</label>
          <input id="login-email" type="email" formControlName="email" autocomplete="email" inputmode="email" [maxlength]="L.email"
                 placeholder="nombre@correo.com" [attr.aria-invalid]="mal('email')" aria-describedby="msg-login-email" />
          <app-campo-mensaje [control]="form.controls.email" id="msg-login-email" [mostrarOk]="false" />
        </div>
        <div class="grupo">
          <label for="login-clave">Clave</label>
          <app-ojo-clave #ojo>
            <input id="login-clave" [type]="ojo.visible() ? 'text' : 'password'" formControlName="password" autocomplete="current-password"
                   [maxlength]="L.clave.max" [attr.aria-invalid]="mal('password')" aria-describedby="msg-login-clave" />
          </app-ojo-clave>
          <app-campo-mensaje [control]="form.controls.password" id="msg-login-clave" [mostrarOk]="false" />
        </div>
        <button class="btn btn-primario" type="submit" [disabled]="enviando()">{{ enviando() ? 'Ingresando…' : 'Ingresar' }}</button>
      </form>
      <p class="pie">
        <a routerLink="/recuperar-clave">¿Olvidaste tu clave?</a> ·
        <a routerLink="/registro">Crear cuenta</a>
      </p>
    </section>
  `,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly raiz = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly L = LIMITES;
  readonly error = signal<ErrorVista | null>(null);
  readonly enviando = signal(false);
  readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', vEmail()],
    // En login solo se exige que no esté vacía: no se revela nada de la política ni de la cuenta
    password: ['', vRequerido('Ingresa tu clave')],
  });

  mal(campo: 'email' | 'password'): boolean {
    return conError(this.form.controls[campo]);
  }

  enviar(): void {
    this.error.set(null);
    if (!revisarYEnfocar(this.form, this.raiz.nativeElement)) return;
    this.enviando.set(true);
    const { email, password } = this.form.getRawValue();
    this.auth.login(normalizarEmail(email), password).subscribe({
      next: (u) => {
        const volver = this.ruta.snapshot.queryParamMap.get('volver');
        this.router.navigateByUrl(volver && volver.startsWith('/') ? volver : u.rol === 'ADMIN' ? '/admin' : '/');
      },
      error: (e) => {
        const error = leerError(e);
        // 401: mensaje único, sin decir si falló el correo o la clave
        this.error.set(error.status === 401 ? { ...error, mensaje: 'Correo o clave incorrectos. Revisa los datos e inténtalo de nuevo.', campos: {} } : error);
        this.enviando.set(false);
      },
    });
  }
}
