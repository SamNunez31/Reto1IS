# PROMPT ÚNICO (eficiente) — Booking Prototipo · Reto 1 · Alojamientos

Carpeta de trabajo = la carpeta actual (`Reto1_IS`). Ya contiene: `template/` (plantilla del profe), `contracts/alojamientos-openapi.yaml` (contrato, **no editar**), `database/01_esquema.sql`, `02_datos_demo.sql`, `03_integracion.sql` (BD ya creada en Supabase, schema `booking`, 29 tablas; **no modificar ni ejecutar**).
Construye **en una sola corrida** el Reto 1: backend NestJS + frontend Angular 19 + documentación mínima. Entrega: **miércoles 7-oct-2026**.

## 0. Reglas de economía (tengo pocos créditos: respétalas)

- **No uses subagentes.** No releas archivos que ya leíste. No imprimas archivos completos en tu respuesta; escribe directo a disco.
- No leas `01_esquema.sql` entero: usa `grep -n "CREATE OR REPLACE FUNCTION\|CREATE VIEW\|CREATE OR REPLACE VIEW\|RAISE EXCEPTION\|CREATE TABLE"` en los 3 SQL y lee solo las firmas/columnas que necesites. Lee el YAML del contrato completo una vez (es la fuente de verdad).
- Mensajes de progreso de una línea. Nada de resúmenes intermedios largos. Un único resumen final de ≤15 líneas.
- Sin librerías de UI pesadas (nada de Angular Material/Bootstrap): un solo `styles.css` limpio y responsive. Sin features no pedidas aquí.
- **Orden estricto por etapas (§8)**: si me quedo sin créditos a mitad, lo hecho debe quedar compilando y utilizable. Si algo falla 2 veces, anótalo en `docs/PENDIENTES.md` y sigue con la siguiente etapa.
- Nunca secretos en el repo. El `DATABASE_URL` (pooler Supabase, SSL) lo pongo yo en `backend/.env`; si falta al probar, pídemelo una sola vez y no pegues su valor en ningún archivo versionado.
- Código TypeScript, comentarios y textos de usuario en español, **sin `any`** en cuerpos/respuestas del API. Debo poder explicar el código: simple, módulos pequeños.

## 0 bis. Seguridad de la operación (reglas duras, no negociables)

- **Git: PROHIBIDO escribir.** No ejecutes `git commit`, `git add`, `git push`, `git init`, `git reset`, `git checkout`, `git clean`, `git stash`, `git rebase` ni nada que cambie el historial o el remoto. Solo se permiten `git status`/`git diff`/`git log` de lectura. Yo haré los commits a mano.
- **Datos de prueba en la BD:** las pruebas pueden dejar filas de prueba (usuarios registrados, reservas CANCELADAS, tokens). Anótalas al final en `docs/PENDIENTES.md` (qué cuenta/correo usaste y qué reservas creaste) para que yo las revise; no intentes borrarlas con SQL.
- **Borrado:** no borres nada fuera de `backend/` y `frontend/` (y dentro de ellos solo lo que tú mismo generaste). Nunca `rm -rf` sobre rutas amplias, ni toques `database/`, `contracts/`, `template/`, `PROMPT_UNICO.md`, ni otras carpetas del Escritorio. No uses `npm audit fix --force`.
- **Base de datos (Supabase, real):** **no ejecutes los scripts `.sql`** ni sentencias `DROP`, `TRUNCATE`, `ALTER`, `CREATE` ni `DELETE`/`UPDATE` manuales. La app solo usa `SELECT`, las funciones `fn_*` y los `INSERT`/`UPDATE` que ellas hacen. Tus pruebas con curl/tests pueden crear reservas de prueba con las cuentas demo, pero **cancela o limpia con la propia API** lo que crees y nunca modifiques los datos sembrados.
- **Secretos:** no imprimas, copies ni versiones el contenido de `backend/.env` ni el `DATABASE_URL`. Verifica el `.gitignore` (que incluya `.env`) pero no subas nada.
- **Red/despliegue:** no despliegues, no publiques paquetes, no crees cuentas ni llames servicios externos. **Única excepción permitida:** el registro de npm para instalar dependencias. El despliegue lo hago yo.
- **Frontend:** crea el proyecto con `npx -p @angular/cli@19 ng new frontend --routing --style=css --skip-git --skip-tests=false --ssr=false` (**siempre con `--skip-git`**: el CLI de Angular hace `git init` y un commit inicial por defecto, y eso está prohibido). Después de crearlo, verifica con `git status` que no se haya creado ningún commit.
- Ante cualquier acción que no esté claramente cubierta aquí y pueda ser destructiva o irreversible, **no la hagas**: anótala en `docs/PENDIENTES.md` y sigue.

## 1. Qué exige el PDF (Reto 1) — y nada más

Sistema desplegado, backend con APIs documentadas y versionadas, admin funcional, marketplace funcional, BD operativa, documento técnico (arquitectura, modelo de datos, contratos, puntos de integración futuros, evolución a microservicios) y análisis **conceptual** de gRPC, GraphQL, colas/eventos y EDA/trazabilidad. Sin integración entre sistemas todavía. Seguridad de *Desarrollo de Plataformas* (JWT, bcrypt, RBAC, CORS, validación, rate limiting, errores) la pidió el profesor: se hace, en versión sencilla.
**Fuera de alcance** (es del Reto 2): tokens B2B `client_credentials`, entrega real de webhooks (worker/HMAC/reintentos/anti-SSRF), contract testing avanzado.

## 2. Backend (NestJS CommonJS) — parte de `template/`

1. **Base del backend = clon del repo del profe.** `backend/` ya existe como clon con `package.json`, `src/` y dependencias instaladas, y su `.env` ya tiene el `DATABASE_URL`: trabaja ahí, no lo vuelvas a clonar ni a copiar. Solo si `backend/` faltara o estuviera roto, copia `template/` a `backend/` (sin `.git`). **No hagas ningún comando de git que escriba** (ver §0 bis).
2 bis. **La plantilla NO compila tal cual** (verificado): `npm run build` falla con 5 errores `TS2393`/`TS2339` en `src/modules/atracciones/atracciones.controller.ts` (métodos duplicados; es código del equipo de Atracciones, no mío). **No edites los módulos `atracciones`, `autos` ni `vuelos`.** Crea `backend/tsconfig.build.json` (si no existe) con `{ "extends": "./tsconfig.json", "exclude": ["node_modules","dist","test","**/*spec.ts","src/modules/atracciones","src/modules/autos","src/modules/vuelos"] }`; con eso el build pasa (probado). Las rayas rojas de `baseUrl`/`outDir` en `tsconfig.json` son avisos del editor (TypeScript 6 de VS Code); **no toques `tsconfig.json`**.
2. **TypeORM `synchronize: false` SIEMPRE** (la plantilla lo trae en true y alteraría Supabase). Conexión: `url: DATABASE_URL`, `ssl: { rejectUnauthorized: false }`, `extra: { options: '-c search_path=booking,public,extensions' }`. Usa `dataSource.query()` con SQL **parametrizado**; la lógica crítica ya está en la BD: **llama a las funciones `fn_*` y consulta las vistas `v_*`, no las reimplementes**: `fn_buscar_alojamientos`, `fn_cotizar`, `fn_crear_preview`, `fn_crear_orden`, `fn_modificar_reserva`, `fn_cancelar_reserva`→(penalidad,reembolso), `fn_responder_solicitud`, `fn_cupo_unidad`, `fn_emitir_factura`, `fn_expirar_solicitudes`, `fn_completar_estancias`; vistas `v_orden`, `v_reserva_total`, `v_cancelacion_liquidacion`, `v_factura`, `v_alojamiento_resumen`, `v_ingresos_anfitrion`, `v_admin_indicadores`, `v_ventas_por_ciudad`, `v_top_alojamientos`, `v_trazabilidad_reserva`. Lee sus firmas exactas con grep.
3. Al arrancar verifica `SELECT count(*) FROM information_schema.tables WHERE table_schema='booking' AND table_type='BASE TABLE'` = **29**; si no, detente y dime que ejecute `03_integracion.sql` en el SQL Editor de Supabase.
4. **Una sola API, una sola Swagger** (`/api/docs`), tags del contrato (`Búsqueda y Catálogo`, `Disponibilidad y Precios`, `Gestión de Órdenes (Reservas)`, `Componentes Comunes`, `Webhooks`) + tags propios. Registra el esquema de seguridad **`OAuth2Security`** con los scopes del YAML (la plantilla lo usa en decoradores pero `main.ts` no lo define). Script `npm run docs:openapi` → `docs/openapi.json`.

## 3. Contrato (lo que más pesa en la nota): rutas del YAML bajo `/api/v1`

Implementa el controlador de la plantilla (ya alineado 1:1 con el YAML) con **DTOs fieles al YAML** (uno por esquema; `class-validator` reproduce `required/pattern/min/max/enum/format`; campos en snake_case como el contrato; `ValidationPipe` global `whitelist`+`forbidNonWhitelisted`+`transform`). Respuestas con la forma exacta del esquema; `request_id` = `X-Correlation-Id`. Solo `USD`, `country:"ec"`, idioma `es`. El alojamiento sale con **código entero** (`alojamiento_codigo.codigo`), nunca el UUID; las órdenes usan el UUID de la reserva.

| Operación | Implementación |
|---|---|
| `POST /search` (público; `X-Device-Fingerprint` obligatorio → 400) | `fn_buscar_alojamientos`; huéspedes = adultos+niños; `page` = cursor opaco base64 del offset; `rows` 10–100; `data:[{id:codigo,url}]` con `url=${PUBLIC_WEB_URL}/alojamientos/${codigo}` |
| `POST /availability` | por unidad activa: `fn_cotizar` + cupo ≥ `number_of_rooms`; `products[]{id,name,max_occupancy,available_rooms,price{base,service_fee,taxes,cleaning_fee,total},cancellation_policy}`; **`product_id` = base64url de `unidad_uuid\|checkin\|checkout`** (el preview no trae fechas) |
| `POST /bulk-availability` | lo mismo para lista; producto más barato disponible por alojamiento; `meal_plan` no soportado (declarar) |
| `POST /details` | `extras` ∈ description, bundles(`[]`), facilities, payment(`{methods:["simulado"]}`), photos, policies, rooms; + ubicación, estrellas, aeropuertos con km; paginado |
| `POST /details/changes`, `/chains`(`[]`), `/constants`, `/reviews`, `/reviews/scores` | según YAML; reseñas publicadas + `v_alojamiento_resumen`; constants = tipos, amenidades, políticas, provincias, ciudades, aeropuertos, estados |
| `POST /orders/preview` (read) | decodifica `product_id`; `fn_crear_preview(sub, unidad, entrada, salida, huéspedes, rooms)` → `{order_preview_id,total_price,currency}`; vale 15 min |
| `POST /orders/create` (book, Idempotency-Key) | valida `payment_reference` `^PAY-[A-Z0-9]{6,}$` (`PAY-DECLINED…` → `PAYMENT_NOT_AUTHORIZED`); `fn_crear_orden(preview, sub)` → **201** `OrderDetail` |
| `GET /orders/{id}` (read) | `v_orden` del dueño → `OrderDetail` + `_links` HATEOAS (`modify`/`cancel` solo si el estado lo permite); ajena → 404 |
| `POST /orders/{id}/modify` (book, Idempotency-Key) | `fn_modificar_reserva` → `OrderDetail` |
| `POST /orders/{id}/cancel` (cancel, Idempotency-Key) | `fn_cancelar_reserva` → 200 `{order_id,status,penalty,refund,currency}` |
| `GET/POST /webhooks`, `DELETE /webhooks/{id}` | solo CRUD sobre `webhook_suscripcion`/`webhook_evento` (propietario=`sub`; secreto de 32 bytes mostrado solo al crear; solo https); **sin worker de entrega** (documentar como Reto 2) |

**Errores = `ProblemDetails`** en TODA la API (`application/problem+json`; `type,title,status,detail,code,invalidParams[]`; `code` solo del enum del YAML). Filtro global que convierte `HttpException` y errores de Postgres (el `RAISE EXCEPTION` empieza con un código; lista los reales con grep) sin filtrar stack/SQL:

`SIN_DISPONIBILIDAD`/`UNIDAD_INACTIVA`→409 `ROOM_NO_LONGER_AVAILABLE` · `PRECIO_CAMBIO`/`PREVIEW_EXPIRADO`→409 `PRICE_CHANGED` (+`Retry-After`) · `CAPACIDAD_EXCEDIDA`/`FECHAS_INVALIDAS`/`ESTANCIA_INVALIDA`/`FECHA_PASADA`/DTO inválido→400 `VALIDATION_FAILED` (+`invalidParams`) · `AUTORESERVA`/`HUESPED_INVALIDO`→403 · `TRANSICION_INVALIDA`→409 `CANCELLATION_NOT_ALLOWED` · `MODIFICACION_NO_PERMITIDA`→409 `BOOKING_NOT_CONFIRMED` · pago inválido→400 `PAYMENT_REFERENCE_INVALID` · rate limit→429 `RATE_LIMIT_EXCEEDED` (+`Retry-After`) · inexistente/ajena→404.

**Cabeceras:** `Cache-Control` y `X-API-Deprecation-Date` (env `API_DEPRECATION_DATE`) como en el YAML en `search/details/chains/constants/reviews/reviews/scores`.
**Idempotency-Key** (UUID) en create/modify/cancel: extiende el `IdempotencyKeyGuard` + interceptor con la tabla `idempotencia` (misma clave+mismo hash → reproducir respuesta con `Idempotent-Replayed: true`; misma clave+otro cuerpo → 409; error 5xx → borrar la fila).
**Scopes** `alojamientos:read|book|cancel|webhooks` según el campo `security` de cada operación (`security: []` = público). JWT con claim `scope`: USUARIO → `read book cancel`; ADMIN → `read webhooks` (el ADMIN no reserva). El `ownerId` sale **siempre** del `sub`.

## 4. Rutas propias (lo que el contrato no cubre; sin chocar con él)

Éxito `{status,message,data}` (formato visto en clase), listados `{items,total,limit,offset}`, errores `ProblemDetails`.
- `auth/register|login|forgot-password|reset-password` (recuperación: token de 32 bytes, guardar solo SHA-256 en `token_usuario`, expira 30 min, uso único, respuesta siempre 200 genérica; "correo" simulado con `enlace_simulado` solo si `APP_ENV!=production`).
- `me` (GET/PATCH), `me/orders` (mis reservas), `orders/:id/invoice` (`v_factura`), `orders/:id/timeline` (`v_trazabilidad_reserva`; dueño, anfitrión de esa reserva y ADMIN), `orders/:id/cancel-preview` (`v_cancelacion_liquidacion`), `orders/:id/review`, `reports` (denunciar alojamiento).
- `host/*` (mis alojamientos CRUD+publicar, unidades, calendario de precio/cupo, solicitudes `host/orders/:id/respond` → `fn_responder_solicitud`, ingresos `v_ingresos_anfitrion`, responder reseñas). Anfitrión **no es rol**: es quien publica; solo gestiona lo suyo (ajeno → 404).
- `admin/*` (indicadores, ventas por ciudad, top alojamientos, reportes, usuarios activar/desactivar, catálogos y `impuesto_tarifa`/feriados, eventos, `jobs/:nombre/ejecutar`).
- `health` (app + `SELECT 1`).
- **Jobs** `@nestjs/schedule` con `pg_try_advisory_lock`: `fn_expirar_solicitudes()` cada 5 min, `fn_completar_estancias()` cada hora, publicador del outbox cada 5 s (lee `evento_outbox` no publicado → bus en memoria con consumidor de auditoría idempotente → marca `publicado_en`), purga de `idempotencia` diaria.

## 5. Seguridad (obligatoria, versión sencilla)

JWT HS256 (`sub,email,rol,scope,iat,exp`; `JWT_EXPIRES_IN=30m`; `JWT_SECRET` ≥32 bytes de env, la app no arranca en producción si falta/es débil; `algorithms:['HS256']`); `JwtAuthGuard` global con `@Public()`; `RolesGuard` + `ScopesGuard`; bcrypt costo 12 (los hashes demo `$2a$` funcionan con `bcrypt.compare`); login con mensaje genérico y rechazo de `activo=false`; política de clave (8+, may., min., número); **nunca devolver `password_hash`**; ADMIN no reserva ni publica (validar en servicio además del trigger); validación de cédula (módulo 10)/RUC/coordenadas de Ecuador; sanitizar texto libre; `express.json({limit:'100kb'})`; **CORS** con `CORS_ORIGINS` explícito (sin `*`); `helmet` + HSTS + redirección HTTPS por `x-forwarded-proto` en producción; **throttler** global ~100/min y estricto en login/register/forgot (429); middleware `X-Correlation-Id` + logs JSON sin datos sensibles; errores genéricos en 500.
Cuentas demo (clave `Demo1234!`): ADMIN `admin.plataforma@gmail.com`; anfitriones `ana.paredes@gmail.com`, `bruno.salazar@hotmail.com`, `carla.mendoza@gmail.com`, `diego.torres@hotmail.com`, `elena.villacis@gmail.com`; huéspedes `sofia.ruiz@gmail.com`, `mateo.cevallos@hotmail.com`, `lucia.andrade@gmail.com`, `andres.naranjo@hotmail.com`.

## 6. Frontend — Angular 19 standalone (`frontend/`)

`core/(services, interceptors, guards, models)`, `shared/`, `features/`; **Service Layer** (ningún componente conoce URLs); signals/servicios; interfaces tipadas; estados de carga/error/vacío; responsive y accesible; diseño propio limpio (no plantilla genérica); sin `innerHTML` ni `bypassSecurityTrust*`. JWT en memoria con respaldo en `sessionStorage`; interceptores: `Authorization`, 401→logout+login, 403→acceso denegado; `authGuard`/`roleGuard`. El cliente HTTP envía `X-Device-Fingerprint` (UUID en `localStorage`) y un **`Idempotency-Key` nuevo por acción**; muestra `ProblemDetails` (`detail` e `invalidParams` por campo). Proxy de desarrollo a `localhost:3000`; `environment` con `apiUrl`.
Pantallas (consumen las rutas del contrato para buscar/detalle/disponibilidad/reseñas/órdenes): **Búsqueda** (provincia→ciudad, aeropuerto+km, fechas, huéspedes, tipo, precio, estrellas, orden; tarjetas; paginación) · **Detalle** (galería, amenidades, política de cancelación clara, aeropuertos, unidades con disponibilidad y cotización con desglose, reseñas) · **Reserva** (disponibilidad → preview con total y vigencia de 15 min → pago **simulado** rotulado (genera `PAY-XXXXXXXX`) → create → orden con `locator`; manejar `PRICE_CHANGED`/`ROOM_NO_LONGER_AVAILABLE` volviendo a cotizar) · **Mis reservas** (estados, previsualizar cancelación con penalidad/reembolso, cancelar, modificar fechas, factura, timeline, reseña) · **Auth** (login, registro, recuperar) · **Panel anfitrión** (alojamientos, unidades, calendario, solicitudes aceptar/rechazar, ingresos) · **Panel admin** (indicadores, ventas por ciudad, top, reportes, usuarios, catálogos, impuestos/feriados, eventos, ejecutar jobs) · 401/403/404.

## 7. Documentación mínima (`docs/`, español, breve, con Mermaid)

`DOCUMENTO_TECNICO.md`: (1) problema, alcance, actores y enfoque API-first; (2) tabla *operación del contrato → endpoint → función/vista/tabla → estado* + supuestos (sin cadenas, sin `meal_plan`, solo USD/`ec`/`es`, OAuth2 simplificado, pagos simulados, `product_id` opaco, prefijo `api/v1`, webhooks sin entrega); (3) arquitectura (Angular → NestJS → Supabase; jobs; outbox) y por qué monolito modular ahora; (4) ER Mermaid de las 29 tablas + nota de 5FN (uniones binarias, totales en vistas, snapshots `orden_preview`/`idempotencia` a propósito); (5) seguridad: tabla OWASP ↔ control ↔ archivo; (6) puntos de integración futuros y **evolución a microservicios** (candidatos, base por servicio, strangler, `FOR UPDATE`→sagas); (7) **gRPC conceptual**: `docs/proto/alojamientos.proto` (`GetDisponibilidad` unario, `StreamCambios` streaming) con formato de `template/src/modules/atracciones/contracts/atracciones.proto`; (8) **GraphQL conceptual**: `docs/graphql/alojamientos.graphql` con `type Alojamiento @key(fields:"id")` y 2 consultas agregadas, formato de `atracciones.graphql`; (9) **eventos/EDA**: catálogo (`ReservaCreada`, `ReservaConfirmada`, `ReservaModificada`, `ReservaCancelada`, `PagoRegistrado`, `FacturaEmitida`), outbox, `correlacion_id`, webhooks `ORDER_CONFIRMED/CANCELLED` (entrega = Reto 2), ejemplo real de timeline; (10) limitaciones.
Además: `docs/SUPUESTOS.md`, `docs/GUIA_DE_DEFENSA.md` (por módulo clave: qué hace, por qué, pregunta probable del profesor), `docs/DECLARACION_USO_IA.md` (borrador), `docs/PENDIENTES.md`, y `README.md` (instalación, variables, scripts, cuentas demo, pasos de despliegue). Entrega `backend/.env.example` y `render.yaml` (backend) y `frontend/vercel.json` o `netlify.toml` listos para desplegar.
Recordatorios para el README: `CORS_ORIGINS` = URL real del frontend; `JWT_SECRET` fuerte en producción; los jobs los corre el backend; IVA 8% en feriados exige que el admin cargue feriados y que el alojamiento tenga `registro_turismo`/`luaf` (verificar con el SRI); cambiar/desactivar cuentas demo si queda público; Supabase gratis se pausa: revisar antes de presentar.

## 8. Etapas (en este orden; **sin commits**: yo haré los commits)

1. **Base:** `backend/` desde la plantilla, config, conexión SSL, `synchronize:false`, verificación de 29 tablas, `ProblemDetails`, correlación, helmet/CORS/throttler, `health`, Swagger con `OAuth2Security`. *Prueba:* `npm run build` y `GET /health`.
2. **Auth y seguridad:** register/login/recuperación, JWT con `scope`, guards. *Prueba con curl:* login de Sofía y del admin, 401/403.
3. **Contrato P0:** `search`, `availability`, `details`, `orders/preview|create|get|cancel`, `me/orders`, idempotencia. *Prueba con curl* el flujo completo disponibilidad→preview→create→get→cancel con Sofía.
4. **Frontend P0:** auth, búsqueda, detalle, reserva, mis reservas. *Prueba:* `ng build`.
5. **Contrato P1 + propias:** `bulk-availability`, `details/changes`, `chains`, `constants`, `reviews`, `reviews/scores`, `modify`, webhooks CRUD, factura, timeline, cancel-preview, reseñas, reportes, jobs + outbox.
6. **Paneles** anfitrión y admin (backend `host/*`, `admin/*` y pantallas).
7. **Documentación** (§7), `docs:openapi`, script `contract:check` (compara las rutas/métodos del YAML con el OpenAPI generado y falla si falta alguna), README.
8. Revisión final: `npm run build` en ambos, 0 secretos en el repo, `docs/PENDIENTES.md` al día.

**Final:** resumen de ≤15 líneas: qué quedó, qué no, qué debo hacer yo (poner `DATABASE_URL`, desplegar en Render/Vercel con las variables) y riesgos.

Empieza ahora por la etapa 1 y continúa hasta la 8 sin esperar mi aprobación.