import { Injectable } from '@angular/core';

const CLAVE = 'device_fingerprint';

/** Identificador anónimo del navegador (X-Device-Fingerprint), guardado en localStorage. */
@Injectable({ providedIn: 'root' })
export class DispositivoService {
  private valor: string | null = null;

  huella(): string {
    if (this.valor) return this.valor;
    try {
      this.valor = localStorage.getItem(CLAVE);
      if (!this.valor) {
        this.valor = crypto.randomUUID();
        localStorage.setItem(CLAVE, this.valor);
      }
    } catch {
      this.valor = this.valor ?? crypto.randomUUID();
    }
    return this.valor;
  }
}
