# Supuestos y decisiones

| # | Supuesto / decisión | Motivo |
|---|---|---|
| 1 | Prefijo `/api/v1` en vez de los `servers` del YAML (`…/alojamientos/v1`) | Plantilla del curso; la versión sigue en la URL |
| 2 | Solo `currency = USD`, `booker.country = "ec"`, idioma `es` (otros valores → 400) | Ecuador usa USD; alcance del reto |
| 3 | El alojamiento se expone con **código entero** (`alojamiento.codigo`, identity desde 1001); las órdenes usan el **UUID** de la reserva | El contrato tipa `accommodation` como entero y `orderId` como uuid |
| 4 | `product_id` = `base64url(unidad_uuid\|checkin\|checkout)` (opaco) | `OrderPreviewRequest` no trae fechas |
| 5 | Huéspedes = `number_of_adults + children.length`; `number_of_rooms` = unidades del mismo tipo | El contrato separa niños y habitaciones |
| 6 | `/chains` devuelve `[]`; `bundles` = `[]`; `filters.meal_plan` se ignora | El prototipo no maneja cadenas ni planes de comida |
| 7 | `/details` y `/reviews` aceptan `page`/`rows` de extensión; `/search` acepta filtros de extensión (`province`, `accommodation_type`, `max_price`, `min_stars`, `sort_by`) | El esquema no prohíbe propiedades adicionales (`additionalProperties` solo es `false` en ProblemDetails); el contrato no define filtros del marketplace |
| 8 | `bulk-availability` responde por alojamiento `{id, currency, available, cheapest_product, url}` | El esquema solo dice `data: array of object` |
| 9 | `ProblemDetails.code` solo usa el enum del YAML; para 401/403/404/500 (que el enum no cubre) se usa `VALIDATION_FAILED` y el `status`/`title` indican el tipo | El enum es cerrado |
| 10 | Pago rechazado (`PAY-DECLINED…`) → **402** `PAYMENT_NOT_AUTHORIZED` | Semántica HTTP de pago requerido; el contrato no lo fija |
| 11 | OAuth2 simplificado: `POST /auth/login` emite un JWT HS256 con claim `scope`. USUARIO = `read book cancel`; ADMIN = `read webhooks` | No hay servidor OAuth2 en el Reto 1 |
| 12 | `WebhookSubscription.id` lo envía el cliente (es `required` en el YAML); el `secret` lo genera el servidor y se muestra solo al crear | Fidelidad al esquema + seguridad |
| 13 | Webhooks: solo CRUD; la entrega es del Reto 2 | Fuera de alcance |
| 14 | Dos actores: huésped (`USUARIO`) y administrador (`ADMIN`, operador de Posada EC y dueño del catálogo). Portal de anfitriones externos y denuncias = evolución futura | Alcance simplificado; la BD conserva `anfitrion_id` y los valores de enum para ese día |
| 21 | Toda reserva se confirma al aprobarse el pago (modo `INSTANTANEA`); `SOLICITUD` sigue en el enum pero no se puede elegir | Un solo flujo de reserva; no se borran valores de enum |
| 22 | Reseñas con control automático (largo, repeticiones, contactos, groserías) y sin moderación humana; el admin no oculta reseñas | Alcance simplificado; el backend es la fuente de verdad |
| 15 | Pagos, facturas y correo de recuperación **simulados** (`enlace_simulado` solo fuera de producción) | Sin pasarela, sin SRI, sin SMTP |
| 16 | Precio de las tarjetas de búsqueda = "desde" (precio base mínimo); el precio exacto por fechas se ve en disponibilidad | `/search` del contrato solo devuelve `{id,url}` |
| 17 | `cancel-preview` ejecuta `fn_cancelar_reserva` dentro de una transacción que siempre hace ROLLBACK | Reutiliza la regla de la BD sin reimplementarla |
| 18 | Jobs con `pg_try_advisory_xact_lock` (variante transaccional) | El pooler de Supabase en modo transacción no conserva bloqueos de sesión |
| 19 | Errores de idempotencia 4xx se guardan y se reproducen; 5xx liberan la clave | Reintento seguro tras fallos del servidor |
| 20 | Fechas con zona `America/Guayaquil` (igual que la BD) | Evita errores de "fecha pasada" por UTC |
