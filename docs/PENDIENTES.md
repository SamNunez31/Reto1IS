# Pendientes y registro de pruebas

## Datos de prueba creados en la BD (Supabase) — revisar

Todas las pruebas usaron **solo cuentas demo** (no se registraron usuarios nuevos). Nada se borró con SQL manual.

| Fecha | Cuenta | Qué se creó | Estado final |
|---|---|---|---|
| 2026-10-04 | sofia.ruiz@gmail.com | `orden_preview` `e0ac6455-426c-4919-8527-82b09db1af27` (Hotel Quito Aeropuerto Plaza, código 1004) | usado por la reserva de abajo |
| 2026-10-04 | sofia.ruiz@gmail.com | `reserva` **BK-4DDB587F** (`61698ece-22a2-487f-b31f-9751d85dcb5c`), 1004, modificada a 2026-11-11 → 2026-11-13 | **CANCELADA** por la API (penalidad 0, reembolso 197.34) |
| 2026-10-04 | (efecto de la reserva) | `reserva_detalle`, `pago` COBRO `SIM-BK-4DDB587F` + REEMBOLSO `REF-BK-4DDB587F`, `factura` **001-001-000000015** (ANULADA), `cancelacion`, eventos en `evento_outbox` (ReservaCreada, PagoRegistrado, FacturaEmitida, ReservaModificada, ReservaCancelada, ReembolsoRegistrado, FacturaAnulada) | generados por las funciones/triggers de la BD |
| 2026-10-04 | sofia.ruiz@gmail.com | filas en `idempotencia` (orders.create, orders.modify, orders.cancel x2) | se purgan solas a las 24 h cuando el job diario corra |

**Sesión 2 (2026-10-05): no se creó nada en la BD.** No hubo conexión (ver BLOQUEANTE abajo); todas las llamadas fallaron antes de llegar a la BD. El webhook de prueba que se iba a crear y borrar con el admin no llegó a crearse.

Nota: la previsualización de cancelación (`GET /orders/:id/cancel-preview`) ejecuta `fn_cancelar_reserva` dentro de una transacción que **siempre hace ROLLBACK**; no deja filas (solo consume valores de secuencias/identity).

## Pendientes / decisiones a revisar

- **BLOQUEANTE para probar (2026-10-05):** el `DATABASE_URL` de `backend/.env` usa la conexión **directa** de Supabase (`db.<ref>.supabase.co`), que solo tiene IPv6. Hoy este equipo no tiene IPv6 (Node responde `getaddrinfo ENOTFOUND` y no hay ruta TCP a 5432). Cambia `DATABASE_URL` por la del **pooler** (Supabase → Connect → *Session/Transaction pooler*, host `aws-…pooler.supabase.com`, IPv4). Render tampoco tiene IPv6 de salida: en producción usa el pooler.
- Por eso, en la segunda sesión **no se probaron con la BD**: `bulk-availability`, `details/changes`, `constants`, `reviews`, `reviews/scores`, `details` con extras, CRUD de webhooks, reseñas, reportes, rutas `host/*` y `admin/*` (compilan; las de la etapa 3 sí se probaron el 2026-10-04). Al tener el pooler: `npm run build && npm run start:prod` y repetir las pruebas de `docs/GUIA_DE_DEFENSA.md` → "Pruebas rápidas".

- Los jobs (`fn_expirar_solicitudes`, `fn_completar_estancias`, outbox, purga) **no se ejecutaron** contra la BD real durante las pruebas (se arrancó con `JOBS_ENABLED=false`) para no alterar los datos sembrados. Al desplegar corren solos.
- Durante la prueba había otro proceso `node dist/main.js` ocupando el puerto 3000 (no lanzado por mí); las pruebas se hicieron en el puerto 3100.
- Antes de desplegar: poner la URL real de Render en `frontend/src/environments/environment.ts` y `CORS_ORIGINS`/`PUBLIC_WEB_URL`/`API_PUBLIC_URL` en Render (ver README → Despliegue).
- El frontend compila y su test pasa (`ng test`: 2/2), pero **no se probó en el navegador** contra el backend (sin BD). Recorrer: búsqueda → detalle → reserva (pago simulado) → mis reservas; panel anfitrión; panel admin.
- `npm audit --omit=dev`: 15 en backend y 7 en frontend (análisis en `DOCUMENTO_TECNICO.md` §13). **Pendiente:** 3 del backend (`@nestjs/common`, `qs`, `file-type`) tienen arreglo **sin** versión mayor: aplicar `npm audit fix` (nunca `--force`) y repetir build + `docs:openapi` + `contract:check`. El resto requiere NestJS 11+/Angular 21 (Reto 2).
- El proceso `node dist/main.js` (PID 23080) en el puerto 3000 no lo lancé yo; sigue corriendo. Mi servidor de pruebas (puerto 3100) quedó detenido.

## Sesión 3 (2026-10-05) — limpieza, Docker y auditoría

**No se tocó la BD** (ni Supabase ni `database/`). No se ejecutaron comandos docker ni git.

- Respaldo previo de `backend/src` (95 archivos) en `..\respaldo_backend_src` (fuera del proyecto). Se puede borrar cuando confirmes que todo está bien.
- Nuevo `docker-compose.yml` en la raíz (Postgres 16 + los 3 scripts de `database/` en solo lectura). **Sin probar**: correr `docker compose up -d` y arrancar el backend con `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/booking_db`; debe decir `BD verificada: 27 tablas` (con los scripts actuales). Si algún script falla en Postgres puro (están probados en Supabase), revisar `docker logs booking_db_container`.
- SSL condicional (`usarSsl` en `database.module.ts`): sin SSL en `localhost`/`127.0.0.1`/`::1`, con SSL en cualquier otro host.
- Auditoría de accesos (`common/logging/auditoria.ts`): `login_ok`, `login_fallido` (correo enmascarado), `acceso_401`, `acceso_403`, con `correlation_id`, `ip`, método, ruta y `usuario_id`. **Sin probar contra la BD** (sin conexión): verificar en los logs al hacer login correcto/incorrecto y al llamar una ruta protegida sin token o con un rol que no corresponde.
- Borrados: `template/`, `backend/contracts/`, módulos `atracciones`/`autos`/`vuelos`, archivos sin uso de la plantilla en `alojamientos/` y `common/dto/`, `common/transformers/`, `backend/README.md`, `backend/tsconfig.build.tsbuildinfo`, `backend/docker-compose.yml`. `PROMPT_UNICO.md` se movió a `docs/`.
- `tsconfig.build.json`: se desactivó `incremental`. Con `deleteOutDir: true` el segundo `nest build` borraba `dist/` y no volvía a emitir (el `.tsbuildinfo` decía "al día"), y `docs:openapi` fallaba con `MODULE_NOT_FOUND`.
- Verificación: `npm run build` OK, `npm run docs:openapi` OK (58 rutas), `npm run contract:check` **17/17**, `npx ng build` OK.
- `backend/tsconfig.build.json` aún excluye `src/modules/{atracciones,autos,vuelos}` y `app.module.ts` conserva esos imports comentados: inofensivos, se pueden limpiar.
- `backend/.git` (clon de la plantilla) sigue dentro de `backend/`; si se crea un repo en la raíz, decidir si se elimina para no tener un repo anidado.

## Sesión 4 (2026-10-05) — código público dentro de alojamiento

- `alojamiento_codigo` se fundió en la columna `alojamiento.codigo` (identity desde 1001, única). Docker local migrado con `database/migracion_codigo_en_alojamiento.sql`; los 21 códigos existentes se conservaron (1001–1021) y el próximo será 1023 (el 1022 lo consumió un INSERT de prueba deshecho con ROLLBACK).
- **Pendiente (tú):** ejecutar la misma migración en **Supabase** (SQL Editor, pegar el archivo completo). Hasta entonces, el backend nuevo no arranca contra Supabase (verifica el número de tablas al iniciar).
- Respaldos: `respaldo_database_pre_codigo`, `respaldo_backend_src_pre_codigo` y `respaldo_pre_codigo.dump` (pg_dump del schema booking) en el Escritorio.
- `docs/PROMPT_UNICO.md` no se modificó (documento histórico, con cifras de una versión anterior; se borrará en la limpieza final).

## Sesión 5 (2026-10-05) — simplificación: dos actores (27 tablas)

- El admin administra el catálogo (rutas de catálogo solo ADMIN, editor reutilizado bajo `/admin/alojamientos`); sin portal de anfitriones ni denuncias; toda reserva se confirma al pagar; reseñas con control automático.
- **Pendiente (tú):** ejecutar en `booking_db` (Docker) **y** en Supabase, en este orden: `migracion_admin_dueno.sql` → `migracion_sin_reportes.sql` → `datos_modo_inmediato.sql` → `datos_admin_emisor.sql`. Hasta entonces el backend nuevo no arranca (espera 27 tablas).
- Probado solo en bases temporales (copias con `pg_dump`, ya borradas) y con un backend temporal en el puerto 3100 (49 pruebas OK). No se probó en el navegador contra el backend real.
- Respaldos: `respaldo_frontend_src_pre_simple`, `respaldo_backend_src_pre_simple`, `respaldo_database_pre_simple` en el Escritorio.

## Sesión 6 (2026-10-06) — limpieza: solicitudes, campos legales, tipos y validaciones

- Sin flujo por solicitud en código (endpoint de respuesta, DTO y job eliminados; las funciones de BD quedan sin uso). Sin LUAF ni registro de turismo en la interfaz, DTO y servicios (columnas conservadas). Recuperar contraseña oculta en la interfaz. 5 tipos de alojamiento y sin opción de crear tipos. Validación de búsqueda y de "Modificar reserva".
- **Pendiente (tú):** ejecutar en `booking_db` (Docker) **y** en Supabase, en este orden: `datos_sin_pendientes.sql` → `datos_iva_feriados.sql` → `datos_tipos_alojamiento.sql`.
- Los SQL se probaron con PGlite (PostgreSQL embebido, en memoria) porque Docker Desktop estaba apagado; no se tocó `booking_db`.
- Respaldos: `respaldo_frontend_src_pre_k`, `respaldo_backend_src_pre_k`, `respaldo_database_pre_k` en el Escritorio.

## Sesión 7 (2026-10-06) — pago en efectivo y confirmaciones

- **Pendiente (tú):** ejecutar `database/migracion_pago_metodo.sql` en `booking_db` (Docker) y luego en Supabase. Sin la columna `pago.metodo`, los listados de reservas fallan.
- Probado con PGlite (BD en memoria servida por protocolo PostgreSQL) y un backend temporal en el puerto 3100: 20 pruebas OK. Respaldos `respaldo_*_pre_l` en el Escritorio.
- Los indicadores de ventas del dashboard cuentan las reservas confirmadas, también las de efectivo aún no cobrado.

## Sesión 8 (2026-10-06) — se quitan los aeropuertos y Docker queda al día

- Sin tablas `aeropuerto` y `alojamiento_aeropuerto` (25 tablas); `fn_buscar_alojamientos` sin parámetros de aeropuerto; quitados del backend (admin, búsqueda, detalle, constantes, formulario del anfitrión) y del frontend (filtros de búsqueda, tarjeta, detalle, formulario). Se conservan las ciudades y la amenidad «Transporte desde/hacia el aeropuerto».
- Docker (`booking_db_container`) se actualizó aplicando, en orden, las migraciones que le faltaban más `migracion_sin_aeropuertos.sql` (respaldo previo con `pg_dump`). Una BD nueva con `01`→`02`→`03` ya queda en 25 tablas.
- **Pendiente (tú):** ejecutar `database/migracion_sin_aeropuertos.sql` en Supabase (SQL Editor) **antes** de desplegar el backend nuevo en Render. Mientras Supabase tenga 27 tablas, el backend nuevo no arranca (espera 25); y mientras Render siga con el código anterior, ejecutar la migración rompe su búsqueda hasta el redespliegue.
- `docs/PROMPT_UNICO.md` sigue siendo histórico y aún menciona aeropuertos.
