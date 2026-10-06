import { Injectable } from '@nestjs/common';
import { logJson } from '../../common/logging/log-json';

/** Evento de negocio tal como sale de evento_outbox. */
export interface EventoNegocio {
  id: number;
  tipo: string;
  agregado: string;
  agregado_id: string;
  correlacion_id: string;
  payload: Record<string, unknown>;
  created_at: Date;
}

export type Consumidor = (evento: EventoNegocio) => void | Promise<void>;

/**
 * Bus de eventos EN MEMORIA (monolito modular). En una evolución a microservicios
 * se reemplaza por un broker (RabbitMQ/Kafka) sin cambiar a los productores: ellos solo escriben en el outbox.
 */
@Injectable()
export class BusEventos {
  private readonly consumidores: Consumidor[] = [];

  suscribir(c: Consumidor): void {
    this.consumidores.push(c);
  }

  async publicar(evento: EventoNegocio): Promise<void> {
    for (const c of this.consumidores) await c(evento);
  }
}

/** Consumidor de auditoría idempotente: procesa cada evento una sola vez aunque se reentregue. */
@Injectable()
export class AuditoriaConsumidor {
  private readonly vistos = new Set<number>();
  private static readonly MAX = 10_000;

  constructor(bus: BusEventos) {
    bus.suscribir((e) => this.manejar(e));
  }

  manejar(e: EventoNegocio): void {
    if (this.vistos.has(e.id)) return; // entrega duplicada: se ignora
    if (this.vistos.size >= AuditoriaConsumidor.MAX) this.vistos.clear();
    this.vistos.add(e.id);
    // Solo identificadores: el payload puede tener datos personales
    logJson('info', 'auditoria_evento', { evento_id: e.id, tipo: e.tipo, agregado: e.agregado, correlacion_id: e.correlacion_id });
  }
}
