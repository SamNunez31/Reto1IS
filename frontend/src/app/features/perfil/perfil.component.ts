import { Component, ElementRef, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ErrorVista, leerError } from '../../core/services/api-base';
import { CambiosPerfil, PerfilService } from '../../core/services/perfil.service';
import { CampoMensajeComponent, conError } from '../../shared/campo';
import { avisoTemporal } from '../../shared/aviso';
import { TelefonoDirective } from '../../shared/telefono.directive';
import { AlertaErrorComponent, CargandoComponent } from '../../shared/ui';
import {
  aplicarErroresApi, LIMITES, normalizarNombre, normalizarTelefono, PISTA_TELEFONO, revisarYEnfocar, vNombre, vTelefono,
} from '../../shared/validadores';

type Campo = 'nombres' | 'apellidos' | 'telefono';

/**
 * Perfil: nombre y teléfono. Los datos de facturación (cédula, RUC, pasaporte) ya no se piden aquí:
 * se ingresan en cada pago y solo quedan en la factura.
 */
@Component({
  selector: 'app-perfil',
  imports: [ReactiveFormsModule, AlertaErrorComponent, CargandoComponent, CampoMensajeComponent, TelefonoDirective],
  template: `
    <section class="tarjeta auth">
      <h1>Mi perfil</h1>
      @if (cargando()) { <app-cargando /> }
      <p class="meta">{{ email() }}</p>
      <app-alerta-error [error]="error()" />
      <form [formGroup]="form" (ngSubmit)="guardar()" novalidate>
        <div class="fila">
          <div class="grupo">
            <label for="per-nombres">Nombres</label>
            <input id="per-nombres" formControlName="nombres" autocomplete="given-name" [maxlength]="L.nombre.max"
                   [attr.aria-invalid]="mal('nombres')" aria-describedby="msg-per-nombres" (blur)="limpiarNombre('nombres')" />
            <app-campo-mensaje [control]="form.controls.nombres" id="msg-per-nombres" />
          </div>
          <div class="grupo">
            <label for="per-apellidos">Apellidos</label>
            <input id="per-apellidos" formControlName="apellidos" autocomplete="family-name" [maxlength]="L.nombre.max"
                   [attr.aria-invalid]="mal('apellidos')" aria-describedby="msg-per-apellidos" (blur)="limpiarNombre('apellidos')" />
            <app-campo-mensaje [control]="form.controls.apellidos" id="msg-per-apellidos" />
          </div>
        </div>
        <div class="grupo">
          <label for="per-telefono">Teléfono (opcional)</label>
          <input id="per-telefono" appTelefono formControlName="telefono" placeholder="0991234567"
                 [attr.aria-invalid]="mal('telefono')" aria-describedby="ayuda-per-telefono msg-per-telefono" />
          <small id="ayuda-per-telefono" class="ayuda">{{ pistaTelefono }}</small>
          <app-campo-mensaje [control]="form.controls.telefono" id="msg-per-telefono" />
        </div>
        <p class="ayuda">Los datos para la factura los ingresas al momento de pagar cada reserva.</p>
        <button class="btn btn-primario" type="submit" [disabled]="enviando()">{{ enviando() ? 'Guardando…' : 'Guardar' }}</button>
        @if (ok.texto()) { <p class="aviso-guardado ok" role="status">✓ {{ ok.texto() }}</p> }
      </form>
    </section>
  `,
})
export class PerfilComponent implements OnInit {
  private readonly perfil = inject(PerfilService);
  private readonly raiz = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly L = LIMITES;
  readonly cargando = signal(true);
  readonly enviando = signal(false);
  readonly email = signal('');
  readonly error = signal<ErrorVista | null>(null);
  readonly ok = avisoTemporal();
  readonly pistaTelefono = PISTA_TELEFONO;
  readonly form = inject(FormBuilder).nonNullable.group({
    nombres: ['', vNombre('nombres')],
    apellidos: ['', vNombre('apellidos')],
    telefono: ['', vTelefono],
  });

  ngOnInit(): void {
    this.perfil.obtener().subscribe({
      next: (p) => {
        this.email.set(p.email);
        this.form.patchValue({ nombres: p.nombres, apellidos: p.apellidos, telefono: p.telefono ?? '' });
        this.cargando.set(false);
      },
      error: (e) => {
        this.error.set(leerError(e));
        this.cargando.set(false);
      },
    });
  }

  mal(campo: Campo): boolean {
    return conError(this.form.controls[campo]);
  }

  limpiarNombre(campo: 'nombres' | 'apellidos'): void {
    const c = this.form.controls[campo];
    const n = normalizarNombre(c.value);
    if (n !== c.value) c.setValue(n);
  }

  guardar(): void {
    this.error.set(null);
    this.ok.limpiar();
    if (!revisarYEnfocar(this.form, this.raiz.nativeElement)) return;
    const v = this.form.getRawValue();
    // Solo nombre y teléfono: el documento del perfil no se envía ni se modifica
    const cambios: CambiosPerfil = { nombres: normalizarNombre(v.nombres), apellidos: normalizarNombre(v.apellidos) };
    if (v.telefono.trim()) cambios.telefono = normalizarTelefono(v.telefono.trim());
    this.enviando.set(true);
    this.perfil.actualizar(cambios).subscribe({
      next: () => {
        this.ok.mostrar('Datos actualizados');
        this.enviando.set(false);
      },
      error: (e) => {
        const error = leerError(e);
        if (error.status !== 400 || !aplicarErroresApi(this.form, error.campos)) this.error.set(error);
        this.enviando.set(false);
        revisarYEnfocar(this.form, this.raiz.nativeElement);
      },
    });
  }
}
