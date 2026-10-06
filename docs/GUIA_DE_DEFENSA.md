# Guía de defensa (para el equipo)

Por módulo: **qué hace**, **por qué así**, y **pregunta probable** del profesor con una respuesta corta.

## Base de datos (`database/`)
- **Qué:** 25 tablas en el schema `booking`; reglas en funciones `fn_*`, vistas `v_*` y triggers.
- **Por qué:** la regla de negocio crítica (cupo, precio, estados) queda en un solo lugar y se cumple aunque alguien entre por otro camino.
- **Pregunta:** *¿Cómo evitan la sobreventa?* → `tg_detalle_validar` bloquea la unidad con `FOR UPDATE` y vuelve a calcular `fn_cupo_unidad` antes de insertar la línea; dos reservas simultáneas se serializan.

## Contrato (`modules/alojamientos/`)
- **Qué:** las 17 operaciones del YAML, DTOs 1:1 con `class-validator`, respuestas con la forma exacta.
- **Por qué:** API-first: el contrato manda; `npm run contract:check` falla si falta una operación.
- **Pregunta:** *¿Por qué el alojamiento es un entero y la orden un UUID?* → el contrato los tipa así; la BD usa UUID como clave y la columna `alojamiento.codigo` (identity desde 1001) da el entero público sin exponer el UUID.

## Órdenes, preview e idempotencia
- **Qué:** preview congela el precio 15 min; create revalida el precio (`PRICE_CHANGED`) y el cupo (`ROOM_NO_LONGER_AVAILABLE`); `Idempotency-Key` en create/modify/cancel.
- **Por qué:** evitar cobros dobles (doble clic, reintento de red) y cobros a un precio distinto al mostrado.
- **Pregunta:** *¿Qué pasa si mando la misma Idempotency-Key dos veces?* → misma clave + mismo cuerpo: se devuelve la misma respuesta con `Idempotent-Replayed: true`; con otro cuerpo: 409.

## Seguridad (`common/auth`, `main.ts`)
- **Qué:** JWT HS256 (30 min) con `scope`, guards globales (rate limit → JWT → rol → scope), bcrypt 12, helmet, CORS explícito, límite 100 kb, ProblemDetails.
- **Por qué:** lo pide Desarrollo de Plataformas; tabla OWASP en el documento técnico §5.
- **Pregunta:** *¿De dónde sale el dueño de la reserva?* → siempre del `sub` del token, nunca del cuerpo; una orden ajena responde 404 (no se revela que existe).

## Alcance: dos actores (huésped y administrador)
- **Qué:** Posada EC administra su catálogo. El ADMIN crea, edita, publica, despublica y suspende alojamientos desde Administración → Alojamientos (reutiliza el editor por pasos y por secciones); los huéspedes buscan, reservan, pagan, ven sus reservas y reseñan. Toda reserva se confirma al aprobarse el pago.
- **Por qué:** menos flujos que probar y defender; el portal de anfitriones externos y las denuncias quedan como **evolución futura** (la BD conserva `anfitrion_id`, el valor `SOLICITUD` y el tipo `motivo_reporte` para ese día).
- **Pregunta:** *¿Puede un usuario volverse administrador al registrarse?* → no: `RegisterDto` no tiene `rol` y `forbidNonWhitelisted` responde 400 si lo envían; la cuenta nace `USUARIO`. Las rutas de catálogo y de admin exigen rol ADMIN (403 para el resto).

## Reseñas
- **Qué:** solo el huésped de una estancia COMPLETADA, una vez por reserva. Control automático del comentario en el backend (fuente de verdad) y en vivo en el frontend: 10–1000 caracteres, sin un carácter repetido 4+ veces, sin enlaces/correos/teléfonos y sin groserías (lista en `groserias.ts`, sin tildes ni mayúsculas).
- **Pregunta:** *¿Quién modera las reseñas?* → nadie a mano: el control es automático y el admin no oculta reseñas; solo puede responderlas.

## Cancelación
- **Qué:** `fn_cancelar_reserva` aplica el tramo de la política según las horas de anticipación; registra el reembolso y anula la factura.
- **Pregunta:** *¿Cómo muestran la penalidad antes de cancelar sin duplicar la regla?* → ejecutamos la misma función en una transacción que siempre hace ROLLBACK (`cancel-preview`).

## Jobs y outbox (`modules/jobs/`)
- **Qué:** completar estancias (1 h), publicar outbox (5 s), purgar idempotencia (diario), cada uno con `pg_try_advisory_xact_lock`.
- **Pregunta:** *¿Y si hay dos instancias del backend?* → solo la que obtiene el bloqueo consultivo ejecuta; la otra se salta esa vuelta. El outbox usa `FOR UPDATE SKIP LOCKED`.

## Frontend (`frontend/`)
- **Qué:** Angular 19 standalone, signals, capa de servicios (ningún componente conoce URLs), interceptor (Bearer, fingerprint, 401/403), guards por rol, Idempotency-Key nueva por acción.
- **Pregunta:** *¿Dónde guardan el token?* → en memoria con respaldo en `sessionStorage` (se borra al cerrar la pestaña); sin `innerHTML`.

## Evolución
- **Pregunta:** *¿Cómo lo pasarían a microservicios?* → strangler fig con gateway; BD por servicio; el `FOR UPDATE` de una transacción se reemplaza por una saga (reservar cupo → cobrar → confirmar, con compensaciones) usando el outbox. Ver documento técnico §6.

## Pruebas rápidas (curl)
```bash
B=http://localhost:3000/api/v1
TOKEN=$(curl -s -X POST $B/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"sofia.ruiz@gmail.com","password":"Demo1234!"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).data.access_token')
BK='"booker":{"country":"ec","platform":"desktop"},"checkin":"2026-11-10","checkout":"2026-11-12","guests":{"number_of_adults":2,"number_of_rooms":1}'
curl -s -X POST $B/search -H 'Content-Type: application/json' -H 'X-Device-Fingerprint: demo' -d "{$BK,\"rows\":10}"
curl -s -X POST $B/availability -H 'Content-Type: application/json' -d "{\"accommodation\":1004,$BK}"
# preview -> create (Idempotency-Key: uuid nuevo) -> GET /orders/{id} -> cancel-preview -> cancel
```
