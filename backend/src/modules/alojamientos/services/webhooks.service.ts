import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { conflicto, noEncontrado } from '../../../common/problem/problem';
import { DbService } from '../../../database/db.service';
import { WebhookSubscriptionDto } from '../dto/ordenes.dto';
import { WebhookSubscription } from '../dto/respuestas.dto';

/**
 * CRUD de suscripciones (webhook_suscripcion + webhook_evento). Propietario = sub del JWT.
 * La ENTREGA (worker, firma HMAC, reintentos, anti-SSRF) es del Reto 2: aquí no se envía nada.
 */
@Injectable()
export class WebhooksService {
  constructor(private readonly db: DbService) {}

  listar(propietario: string): Promise<WebhookSubscription[]> {
    return this.db.query<WebhookSubscription>(
      `SELECT s.id, s.url, array_agg(e.evento::text ORDER BY e.evento) AS events
         FROM webhook_suscripcion s JOIN webhook_evento e ON e.suscripcion_id = s.id
        WHERE s.propietario = $1 AND s.activa
        GROUP BY s.id ORDER BY s.creado_en`,
      [propietario],
    );
  }

  /** El secreto (32 bytes) solo se muestra en esta respuesta. */
  async crear(dto: WebhookSubscriptionDto, propietario: string): Promise<WebhookSubscription> {
    const existe = await this.db.uno(`SELECT 1 FROM webhook_suscripcion WHERE id = $1`, [dto.id]);
    if (existe) throw conflicto('Ya existe una suscripción con ese id');
    const secreto = randomBytes(32).toString('hex');
    await this.db.transaccion(async (q) => {
      await q(`INSERT INTO webhook_suscripcion (id, propietario, url, secreto) VALUES ($1, $2, $3, $4)`, [dto.id, propietario, dto.url, secreto]);
      await q(`INSERT INTO webhook_evento (suscripcion_id, evento) SELECT $1, unnest($2::tipo_webhook_evento[])`, [dto.id, dto.events]);
    });
    return { id: dto.id, url: dto.url, events: [...dto.events].sort(), secret: secreto };
  }

  async eliminar(id: string, propietario: string): Promise<void> {
    const borradas = await this.db.query(`DELETE FROM webhook_suscripcion WHERE id = $1 AND propietario = $2 RETURNING id`, [id, propietario]);
    if (!borradas.length) throw noEncontrado('La suscripción no existe');
  }
}
