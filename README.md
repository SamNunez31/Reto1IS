# Posada EC · Reto 1 · Alojamientos

> Proyecto académico PUCE. **Los pagos y facturas son simulados con fines académicos**: no se cobra dinero real, los datos de la tarjeta no salen del navegador y las facturas no tienen autorización del SRI.

Plataforma de alojamientos en Ecuador: **backend NestJS** (contrato "GDS Alojamientos Core API" bajo `/api/v1`) + **frontend Angular 19** + **PostgreSQL en Supabase** (schema `booking`, 25 tablas).

**Dos actores.** El **administrador** es el operador de Posada EC y dueño del catálogo: crea, edita, publica, despublica y suspende los alojamientos (Administración → Alojamientos). Los **huéspedes** buscan, reservan (confirmación inmediata al aprobarse el pago), pagan, ven sus reservas y dejan reseñas de estancias completadas, validadas automáticamente sin moderación manual. El portal de anfitriones externos y las denuncias quedan como **evolución futura**.

| Carpeta | Contenido |
|---|---|
| `backend/` | API NestJS (Swagger en `/api/docs`) |
| `frontend/` | SPA Angular 19 |
| `backend/contracts/` | `alojamientos-openapi.yaml`: contrato OpenAPI oficial del curso (no editar) · `posada-ec-openapi.yaml`: **contrato propio** de Posada EC (todas las rutas, generado de la API real) |
| `database/` | scripts SQL (ya ejecutados en Supabase) |
| `docs/` | documento técnico, supuestos, guía de defensa, OpenAPI generado, proto, GraphQL, pendientes |

## Requisitos
Node 20+ y npm. Una BD con los scripts de `database/` ejecutados: **Supabase** (producción) o **Postgres local con Docker** (desarrollo).

**Orden de los scripts** (Supabase: SQL Editor, uno por uno en este orden; Docker: los monta así en `docker-entrypoint-initdb.d`):
1. `01_esquema.sql` — 25 tablas, vistas, funciones y catálogos.
2. `02_datos_demo.sql` — usuarios, 20 alojamientos demo, historial y reservas.
3. `03_integracion.sql`.
4. `datos_catalogo_extra.sql` — 10 alojamientos más (idempotente: se puede volver a ejecutar sin duplicar).

En una BD **ya cargada** antes de estos cambios, ejecuta además `actualizar_imagenes.sql` (renombra 3 alojamientos y corrige las fotos; idempotente) y luego `datos_catalogo_extra.sql`.

## Base de datos local con Docker (opcional)
Requiere Docker Desktop. Desde la raíz del proyecto:
```bash
docker compose up -d        # crea booking_db_container (postgres:16) y ejecuta los 4 scripts de database/ la primera vez
docker compose down -v      # detiene y BORRA el volumen pgdata (al volver a subir se recrean las 25 tablas y los datos demo)
```
En `backend/.env`: `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/booking_db` (sin SSL; el backend solo usa SSL cuando el host no es `localhost`). `docker compose down` sin `-v` conserva los datos.

`docker compose ps` debe mostrar `(healthy)` (healthcheck con `pg_isready`). La primera vez los scripts tardan unos segundos; espera a ver `PostgreSQL init process complete` en `docker compose logs postgres` antes de arrancar el backend. **Probado el 2026-10-05**: 27 tablas, datos demo, login, búsqueda, cotización, reserva con Idempotency-Key, cancelación y panel admin funcionan contra el contenedor.

## Instalación y ejecución local
```bash
# Backend
cd backend
cp .env.example .env        # completar DATABASE_URL (pooler de Supabase) y JWT_SECRET
npm ci
npm run start:dev           # http://localhost:3000  ·  Swagger: http://localhost:3000/api/docs  ·  /health

# Frontend (otra terminal)
cd frontend
npm ci
npm start                   # http://localhost:4200 (proxy /api -> localhost:3000)
```
Al arrancar, el backend verifica que existan las **25 tablas**; si no, indica qué script ejecutar.

**BD de una versión anterior con la tabla `alojamiento_codigo`:** ejecuta una vez `database/migracion_codigo_en_alojamiento.sql` (idempotente, en una transacción; conserva los códigos). En Docker:
```powershell
Get-Content database\migracion_codigo_en_alojamiento.sql -Raw | docker exec -i booking_db_container psql -U postgres -d booking_db -v ON_ERROR_STOP=1
```

**BD de una versión anterior con la tabla `reporte` (simplificación del 2026-10-05):** ejecuta una vez, en este orden (todos idempotentes y en una transacción): `migracion_admin_dueno.sql` → `migracion_sin_reportes.sql` → `datos_modo_inmediato.sql` → `datos_admin_emisor.sql` (RUC **ficticio** del admin como emisor de facturas). En Supabase: SQL Editor, pegar cada archivo completo en ese orden. En Docker:
```powershell
foreach ($f in 'migracion_admin_dueno','migracion_sin_reportes','datos_modo_inmediato','datos_admin_emisor') { Get-Content "database\$f.sql" -Raw | docker exec -i booking_db_container psql -U postgres -d booking_db -v ON_ERROR_STOP=1 }
```

**Limpieza del 2026-10-06 (BD creada antes de esa fecha):** ejecuta una vez, en este orden: `datos_sin_pendientes.sql` (las reservas PENDIENTE del antiguo flujo por solicitud pasan a EXPIRADA) → `datos_iva_feriados.sql` (el IVA reducido de los feriados depende solo de sus fechas) → `datos_tipos_alojamiento.sql` (deja 5 tipos y reasigna los alojamientos de los tipos eliminados). Mismo comando que arriba con esos nombres. Una BD nueva creada con `01`→`02`→`03` ya queda así.

**Sin aeropuertos (2026-10-06):** ejecuta una vez `migracion_sin_aeropuertos.sql` (borra las tablas `aeropuerto` y `alojamiento_aeropuerto` y recrea `fn_buscar_alojamientos` sin filtros de aeropuerto; idempotente, en una transacción; deja 25 tablas). En Supabase: SQL Editor, pegar el archivo completo **antes** de desplegar el backend nuevo (el backend nuevo espera 25 tablas). En Docker:
```powershell
Get-Content database\migracion_sin_aeropuertos.sql -Raw | docker exec -i booking_db_container psql -U postgres -d booking_db -v ON_ERROR_STOP=1
```
Una BD nueva creada con `01`→`02`→`03` ya queda así.

## Variables de entorno (backend)
| Variable | Ejemplo / nota |
|---|---|
| `DATABASE_URL` | URL del **pooler** de Supabase (IPv4), o la de Docker local (ver arriba). La conexión directa `db.<ref>.supabase.co` es solo IPv6 y no funciona desde Render ni desde redes sin IPv6 |
| `APP_ENV` / `NODE_ENV` | `development` o `production` |
| `JWT_SECRET` | ≥ 32 caracteres aleatorios (obligatorio en producción) |
| `JWT_EXPIRES_IN` | `30m` |
| `CORS_ORIGINS` | URL real del frontend (sin `*`), separadas por comas |
| `PUBLIC_WEB_URL` | URL del frontend (enlaces de alojamientos; la recuperación de clave está deshabilitada en la interfaz) |
| `API_PUBLIC_URL` | URL pública del backend (enlaces HATEOAS) |
| `API_DEPRECATION_DATE` | `2027-12-31` (cabecera `X-API-Deprecation-Date`) |
| `JOBS_ENABLED` | `true` (poner `false` para no correr jobs al probar) |

Frontend: `src/environments/environment.ts` → `apiUrl` con la URL del backend en Render.

## Scripts
| Dónde | Script | Qué hace |
|---|---|---|
| backend | `npm run build` / `npm run start:prod` | compilar / ejecutar |
| backend | `npm run docs:openapi` | genera `docs/openapi.json` (no necesita BD) |
| backend | `npm run contract:export` | exporta el contrato propio a `backend/contracts/posada-ec-openapi.yaml` (correr antes `docs:openapi`) |
| backend | `npm run contract:check` | compara rutas/métodos del YAML con el OpenAPI generado; falla si falta alguna |
| frontend | `npm start` / `npm run build` / `npm test` | desarrollo / producción / pruebas |

## Cuentas demo (clave `Demo1234!`)
- ADMIN (operador de Posada EC): `admin.plataforma@gmail.com`
- Huéspedes: `sofia.ruiz@gmail.com`, `mateo.cevallos@hotmail.com`, `lucia.andrade@gmail.com`, `andres.naranjo@hotmail.com`
- Dueños históricos de los alojamientos demo (cuentas de huésped; ya no publican): `ana.paredes@gmail.com`, `bruno.salazar@hotmail.com`, `carla.mendoza@gmail.com`, `diego.torres@hotmail.com`, `elena.villacis@gmail.com`

## Despliegue
1. **Backend en Render**: New → Blueprint con `render.yaml` (raíz). Cargar `DATABASE_URL` (pooler), `CORS_ORIGINS`, `PUBLIC_WEB_URL`, `API_PUBLIC_URL`. `JWT_SECRET` se genera solo. Verificar `https://<servicio>.onrender.com/health`.
2. **Frontend en Vercel**: importar el repo con *Root Directory* `frontend` (usa `frontend/vercel.json`). Antes, poner la URL de Render en `frontend/src/environments/environment.ts`.
3. Actualizar `CORS_ORIGINS` y `PUBLIC_WEB_URL` en Render con la URL final de Vercel y redeploy.

## Recordatorios
- `CORS_ORIGINS` = URL **real** del frontend; `JWT_SECRET` fuerte en producción.
- Los **jobs** (completar estancias, outbox, purga) los corre el backend; si Render duerme, se ponen al día al despertar.
- **IVA 8 % en feriados**: el admin registra el feriado con sus fechas (Administración → Impuestos y feriados) y aplica a todos los alojamientos en esas fechas. Verificar el decreto vigente con el SRI.
- **Pago**: el huésped elige **Tarjeta de crédito** (simulada; la reserva queda pagada) o **Efectivo** (la reserva queda confirmada y el pago `PENDIENTE` hasta que el admin pulsa "Confirmar pago recibido" en Administración → Reservas; `POST /host/orders/:id/confirm-payment`). Cancelar una reserva en efectivo pendiente no genera reembolso. Requiere la columna `pago.metodo`: en una BD existente ejecuta una vez `database/migracion_pago_metodo.sql` (primero Docker, luego Supabase).
- **Tipos de alojamiento**: catálogo cerrado de 5 (Hotel, Hostal, Cabaña, Casa, Departamento); el admin no agrega tipos.
- **Recuperar contraseña**: deshabilitada en la interfaz (sin enlace ni pantalla); el endpoint del backend sigue existiendo.
- Si el sitio queda público, **cambiar o desactivar las cuentas demo**.
- **Supabase gratis se pausa** por inactividad: revisar que esté activo antes de presentar.

## Dashboard y observabilidad (panel de admin)
- **Dashboard**: KPI (reservas confirmadas, ventas, ticket promedio, tasa de cancelación, publicados, usuarios activos), mejor reseñados, ventas por ciudad y por mes (gráficos SVG/CSS propios con tabla de datos) y mapa Leaflet de alojamientos publicados. Usa solo endpoints de lectura existentes.
- **Observabilidad**: tiempos de carga, errores, recursos que no cargan, clics (sin valores de campos), visibilidad y llamadas al API (método, ruta con patrón, estado, ms). Es **local de cada navegador** (`localStorage`, prefijo `posada-observability`, máx. 300 eventos) y **no se envía a ningún servidor**. En la consola: `window.PosadaObservability.getSnapshot()`. Detalle en `docs/DOCUMENTO_TECNICO.md` §14.
- Pruebas del frontend: `npm test` (Karma; en Windows sin Chrome: `$env:CHROME_BIN='C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'; npx ng test --watch=false --browsers=ChromeHeadless`).

## Mapas y direcciones
Al publicar un alojamiento, las direcciones se buscan con **[OpenStreetMap Nominatim](https://nominatim.org)** (solo Ecuador, en español, con espera de 800 ms entre pulsaciones y máximo 1 petición por segundo) y el mapa usa **[Leaflet](https://leafletjs.com)** con teselas de OpenStreetMap (© OpenStreetMap contributors). El administrador arrastra el pin para afinar; las coordenadas se guardan sin mostrarse. Para producción con tráfico real conviene un proveedor de geocodificación y teselas propio (las políticas de uso de los servidores públicos de OSM son para bajo volumen).

## Créditos de imágenes
Las fotos de los alojamientos demo y del banner de búsqueda (Cotopaxi) son de **[Unsplash](https://unsplash.com)** y se usan bajo la [licencia de Unsplash](https://unsplash.com/license) (uso gratuito, no requiere atribución; se agradece igualmente a sus autores). Se sirven directamente desde `images.unsplash.com` (`?w=800&q=75`); el listado completo por alojamiento está en `database/actualizar_imagenes.sql`. Cada URL se verificó (HEAD 200) y cada portada se revisó a ojo: muestra el alojamiento (fachada, habitación, sala o cabaña), nunca un paisaje o animal.

Documentación: [`docs/DOCUMENTO_TECNICO.md`](docs/DOCUMENTO_TECNICO.md)
