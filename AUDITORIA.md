# Auditoría de accesibilidad (WCAG 2.2 AA), UX y diseño responsive — Posada EC

**Fecha:** 2026-10-06
**Método:** auditoría **no destructiva** (no se modificó ningún archivo del proyecto). Revisión estática de código, cálculo de contrastes según WCAG 2.x, y `npm run lint` (angular-eslint con reglas `templateAccessibility`).
**Alcance solicitado:** `index.html`, `styles.css`, `script.js`.

> **Nota de alcance importante:** en el repositorio **no existe `script.js`**. El `index.html` únicamente arranca Angular (`<app-root>`, `frontend/src/index.html`) y `angular.json` declara `"scripts": []`. Por lo tanto:
> - El JS/TS real vive en `frontend/src/main.ts` (bootstrap) y en los componentes/servicios Angular.
> - Como `index.html` no contiene marcado de interfaz, la verificación de estructura semántica, encabezados, ARIA, imágenes, foco, etc. se hizo sobre **las plantillas de los componentes Angular** que producen el DOM real (se indican con `archivo:línea`).
> - No se ejecutó una compilación ni un navegador real (para no generar/alterar artefactos). Los puntos que dependen del DOM renderizado se marcan como **“a verificar en DOM/navegador”**.

---

## 1. Resumen ejecutivo

El proyecto tiene una **base de accesibilidad muy sólida**: `lang="es"`, `title` por ruta, enlace “Saltar al contenido”, landmarks (`header/nav/main/footer`), foco visible global (`:focus-visible`), formularios con `label for/id`, `aria-describedby`, `aria-invalid`, `fieldset/legend`, mensajes con `role="alert"`, diálogos nativos `<dialog>` accesibles, `aria-live`/`role="status"`, respeto a `prefers-reduced-motion`, objetivos táctiles ≥ 24 px y `npm run lint` **sin errores** (incluye reglas de accesibilidad de plantillas).

No se identifican **hallazgos críticos** justificables con el código. Sí hay **2 hallazgos altos**, **6 medios** y varios **bajos** (varios de ellos buenas prácticas/UX, no incumplimientos estrictos de WCAG 2.2 AA).

| Severidad | Nº | Resumen |
|---|---|---|
| Crítico | 0 | — |
| Alto | 2 | Contraste de `--c-suave` sobre fondo (1.4.3); posible anulación de `autocomplete` por directiva (1.3.5) |
| Medio | 6 | `aria-label` en `<span>` de estrellas; contraste de estrellas; ruta sin `h1`; patrón de pestañas incompleto; `overflow-x: clip`; contraste del banner |
| Bajo | 14 | Foco de skip link, menú móvil, foco en SPA, enlaces-tarjeta verbosos, `scope`/`caption` en tablas, etc. |

**Comandos ejecutados (no destructivos):** `npm run lint` → *All files pass linting*. No se ejecutó build/test/análisis de navegador.

---

## 2. Hallazgos por severidad

### 2.1 Críticos

Ninguno. No se encontró ningún incumplimiento que bloquee el uso de la aplicación con teclado o lector de pantalla.

---

### 2.2 Altos

#### A1 — Contraste insuficiente de texto secundario sobre el fondo de la app (WCAG 1.4.3 AA)

**Evidencia (archivo:elemento):**
- Token: `frontend/src/styles.css:39` → `--c-suave: var(--gris-500)`; `:root` → `--gris-500: #6b7774` (`styles.css:18`).
- Fondo de la app: `styles.css:78` → `body { background: var(--c-fondo) }` y `styles.css:36` → `--c-fondo: var(--gris-100)` (`#f3f5f4`).
- Elementos con ese color sin superficie blanca detrás:
  - `busqueda.component.ts:150` → `<p>{{ resumenResultados() }}</p>` bajo `.resultados-cabecera` (`styles.css:239` → `color: var(--c-suave)`), dentro de `main.contenedor`.
  - `ui.ts:31` → `<app-cargando>` (`.cargando`, `styles.css:169`), usado p. ej. en `dashboard.component.ts:56`, `observabilidad.component.ts`, etc.
  - `admin.component.ts:61` → `<p class="meta">` (`.meta`, `styles.css:179`).
  - `busqueda.component.ts:174` → `<nav class="paginacion">` (`styles.css:191`).
  - `observabilidad.component.ts:16` → `<p class="ayuda">` (`.ayuda`, `styles.css:140`).

**Cálculo verificado:** `#6b7774` sobre `#f3f5f4` = **4.25:1** (requiere ≥ 4.5:1 para texto normal). Sobre blanco da 4.65:1, por eso **solo falla cuando no hay tarjeta/superficie blanca detrás**.

**Recomendación:** oscurecer `--c-suave` (p. ej. a `--gris-700` `#44514e`, ≈ 7.6:1 sobre `#f3f5f4`) o reservar `--c-suave` para fondos blancos y usar otro token para el fondo gris. Alternativa: dar superficie blanca/`.tarjeta` a esos bloques.

---

#### A2 — La directiva `appFiltro` puede anular el `autocomplete` de los campos (WCAG 1.3.5 AA) — *a verificar en DOM*

**Evidencia (archivo:elemento):**
- La directiva declara `autocomplete: 'off'` como **host attribute**: `frontend/src/app/shared/entrada.ts:74-78`.
- En el bundle compilado se confirma: `hostAttrs: ["autocomplete","off"]` (revisado en `frontend/dist/frontend/browser/chunk-UQQPY4B6.js`).
- Campos que declaran **a la vez** `appFiltro` y un `autocomplete` significativo:
  - `perfil.component.ts:36` → `appFiltro="nombre"` + `autocomplete="given-name"`.
  - `perfil.component.ts:42` → `appFiltro="nombre"` + `autocomplete="family-name"`.
  - `registro.component.ts:30` → `given-name`; `registro.component.ts:36` → `family-name`.
  - `reserva.component.ts:87` → `autocomplete="organization"` (razón social).
  - `reserva.component.ts:95` → `given-name`; `reserva.component.ts:101` → `family-name`.

**Análisis:** el host binding del directive y el atributo de plantilla compiten por el mismo atributo en el mismo `<input>`. En Angular el host binding de la directiva se aplica sobre el elemento, de modo que el valor probablemente queda en `off`. Como el `autocomplete` correcto existe en el resto de campos (`login.component.ts:20`, `reserva.component.ts:109`, tarjeta `cc-number`, etc.), la inconsistencia es real. **Confirmar en DevTools** (ver §5).

**Recomendación:** quitar `autocomplete: 'off'` del host de `FiltroDirective` (dejarlo en los pocos campos que realmente lo necesiten) o condicionarlo; conservar `given-name`/`family-name`/`organization`. Para teléfono, `TelefonoDirective` ya expone `autocomplete: 'tel'` sin conflicto (`telefono.directive.ts:12`).

---

### 2.3 Medios

#### M1 — `aria-label` sobre `<span>` genérico: las estrellas no se anuncian (WCAG 1.3.1 / 4.1.2)

**Evidencia:** `frontend/src/app/shared/ui.ts:47` →
`<span class="estrellas" [attr.aria-label]="v + ' estrellas'">{{ '★'.repeat(v) }}</span>`. El `aria-label` sobre un elemento de rol genérico (`span`) **no se expone de forma fiable** en muchos lectores (se ignora), y el contenido `★★★★★` no aporta información a AT. Se usa en `busqueda.component.ts:163` y `detalle.component.ts:38` (dentro del `h1`), donde las estrellas son la **única** representación de la categoría.
En contraste, `CalificacionComponent` sí lo hace bien: `calificacion.ts:9` usa `role="img"` + `aria-label`.

**Recomendación:** en `ui.ts:47` añadir `role="img"` (o sustituir por texto `sr-only`), igual que en `calificacion.ts:9`.

---

#### M2 — Contraste de las estrellas `#d89b1d` (WCAG 1.4.11 / 1.4.3)

**Evidencia:** `styles.css:48` → `--c-estrellas: #d89b1d`; usada en `.estrellas` (`styles.css:173`) y `.estrella.llena` (`styles.css:481`). Sobre blanco el contraste es **≈ 2.43:1**.
En `app-estrellas` las estrellas son el único indicador visual de la categoría (`busqueda.component.ts:163`, `detalle.component.ts:38`) → no alcanza 3:1 (gráfico) ni 4.5:1 (texto). En `app-calificacion` el valor numérico acompaña, por lo que ahí el riesgo es menor.

**Recomendación:** oscurecer el token (p. ej. `#8a6100` ≈ 5.3:1 sobre blanco) o mantener el color actual solo cuando haya refuerzo textual.

---

#### M3 — La ruta `/observabilidad` no tiene `<h1>` (jerarquía de encabezados; WCAG 1.3.1 / 2.4.6)

**Evidencia:** `app.routes.ts:47-50` carga `ObservabilidadComponent` como página independiente; en `observabilidad.component.ts:14-15` el primer encabezado es `<h2 id="obs-titulo">`. (Integrado como pestaña de admin sí existiría el `h1` de `admin.component.ts:32`.)

**Recomendación:** el encabezado principal de esa vista debe ser `<h1>` (y numerar los siguientes como `h2`).

---

#### M4 — Patrón ARIA de pestañas incompleto (WCAG 4.1.2 + teclado)

**Evidencia:**
- `admin.component.ts:33-37`: `role="tablist"` + botones `role="tab"` **sin `aria-controls`/`id`** y el contenido del `@switch` (líneas 39+) **no** tiene `role="tabpanel"` ni `aria-labelledby`. Además no hay navegación con flechas (solo Tab+Enter).
- `mis-reservas.component.ts:40-50`: sí tiene `role="tablist"`, `role="tab"`, `aria-controls` y `role="tabpanel"`/`aria-labelledby`, pero tampoco navegación con flechas (patrón APG).

**Recomendación:** completar el patrón (tabpanel + asociación + roving tabindex + flechas Inicio/Fin) o degradar a botones “normales” con `aria-pressed`/filtro sin `role="tab"`. Como mínimo, en admin añadir `role="tabpanel"` con `aria-labelledby`.

---

#### M5 — `overflow-x: clip` oculta el desbordamiento en lugar de evitarlo (WCAG 1.4.10 / 1.4.4)

**Evidencia:** `styles.css:77` → `html, body { overflow-x: clip; }`. El banner usa sangrado completo con `margin: -2rem calc(50% - 50vw) 0` (`styles.css:198`), cálculo basado en `vw` que incluye el ancho de la barra de desplazamiento. Cualquier desbordamiento (presente o futuro) quedaría **recortado sin scroll**, pudiendo ocultar contenido a 320 px o con zoom.

**Recomendación:** verificar a 320 px y 400 % de zoom que no se recorta nada; corregir la causa (p. ej. `calc(50% - 50%)`, `100dvw`) y quitar el `clip` global, o moverlo al contenedor del banner.

---

#### M6 — Contraste del banner dependiente de la imagen (WCAG 1.4.3) — *a verificar*

**Evidencia:** `styles.css:197-207`: `.banner` con `background: var(--marca-900) var(--banner-img) ...` y overlay `background: linear-gradient(180deg, rgb(7 53 50 / 35%) 0%, ...)` (solo 35 % de opacidad arriba). El `h1` (`.banner h1`, `styles.css:204`) y `.bajada` (`styles.css:206`) son blancos con `text-shadow`. `.banner .credito` lleva `opacity: .75` (`styles.css:207`). Sobre una foto clara (cielo del Cotopaxi) el 35 % de oscurecimiento puede no bastar para 4.5:1.

**Recomendación:** subir la opacidad del overlay en la zona superior (p. ej. ≥ 60 %) o añadir un panel semitransparente detrás del texto; verificar con una herramienta de contraste sobre la imagen real.

---

### 2.4 Bajos (mejoras de UX/buenas prácticas; no todos son incumplimientos)

| # | Hallazgo | Evidencia | Recomendación |
|---|---|---|---|
| B1 | Skip link depende del navegador para mover el foco | `app.component.ts:10` y `:43` (`<main id="contenido">` sin `tabindex="-1"`) | Añadir `tabindex="-1"` a `<main>` |
| B2 | El menú móvil no se cierra con `Escape` ni gestiona foco al abrir | `app.component.ts:13-16` (solo `(click)`); abierto/cerrado con `.abierto` (`styles.css:640`) | Añadir `(keydown.escape)` y enfocar primer enlace |
| B3 | Tras navegar (SPA) no se mueve el foco al contenido (sí el scroll) | `app.config.ts:16` (`scrollPositionRestoration: 'top'`) | Enfocar el `h1`/`main` tras cada navegación |
| B4 | Enlace-tarjeta con nombre accesible verboso y `alt` redundante | `busqueda.component.ts:155-170` (el `<a>` engloba `img alt="Foto de X"`, `h2`, calificación, ciudad, precio) | Poner `alt=""` en la portada (el `h2` ya nombra) y evitar duplicar info |
| B5 | `<th>` sin `scope="col"` en tablas de admin | `admin.component.ts:64, 104, 147, 199, 239` (en `dashboard.component.ts:119,165,193` **sí** se usa `scope="col"`) | Añadir `scope="col"` |
| B6 | `aria-label` de la marca no coincide con el texto visible | `app.component.ts:12`: visible `PosadaEC` vs `aria-label="Posada EC, inicio"` (WCAG 2.5.3) | Alinear texto visible y nombre accesible |
| B7 | Foco visible anulado en encabezados que reciben foco programático | `styles.css:296` `.paso-cabecera h2:focus` y `styles.css:426` `.seccion > h2:focus` (`outline: none`), con foco por JS en `edicion-alojamiento.component.ts:273-274` y `editor-alojamiento.component.ts` | No eliminar el indicador de foco |
| B8 | `aria-label` sobre `<span>` del contador | `calificacion.ts:71` (`.contador-valor`, rol genérico) | Añadir `role="img"`/`status` o texto `sr-only` |
| B9 | `role="application"` en el mapa Leaflet | `direccion-mapa.component.ts:40` | Valorar `role="region"` (como ya se hace en `dashboard.component.ts:186`) |
| B10 | Enlaces activos del nav sin `aria-current` | `app.component.ts:17-24` (solo `routerLinkActive="activo"`) | Añadir `aria-current="page"` (2.4.8 AAA, orientación) |
| B11 | Tablas de admin sin `<caption>`; las del dashboard sí lo tienen | `admin.component.ts:63-64` vs `dashboard.component.ts:164` | Añadir `<caption class="sr-only">` |
| B12 | CSS no usado (mantenimiento) | `styles.css:384-389` (`.escala-nota*`, sin plantilla que la use) | Eliminar o documentar |
| B13 | Pestañas de `mis-reservas` sin navegación por flechas (APG) | `mis-reservas.component.ts:40-50` | Implementar flechas Inicio/Fin |
| B14 | `index.html` sin `<noscript>` | `frontend/src/index.html:1-13` | Añadir aviso de “requiere JavaScript” (progresivo) |

---

## 3. Evidencia concreta (archivo:elemento)

### 3.1 Evidencia por hallazgo

| Hallazgo | Archivo:línea / elemento |
|---|---|
| A1 contraste | `styles.css:18,39,78`; `styles.css:169,179,191,239`; `busqueda.component.ts:150,174`; `admin.component.ts:61`; `observabilidad.component.ts:16` |
| A2 autocomplete | `entrada.ts:74-78`; `perfil.component.ts:36,42`; `registro.component.ts:30,36`; `reserva.component.ts:87,95,101` |
| M1 estrellas ARIA | `ui.ts:47`; usos `busqueda.component.ts:163`, `detalle.component.ts:38` |
| M2 contraste estrellas | `styles.css:48,173,481` |
| M3 sin h1 | `observabilidad.component.ts:14-15`; `app.routes.ts:47-50` |
| M4 pestañas | `admin.component.ts:33-37`; `mis-reservas.component.ts:40-50` |
| M5 overflow | `styles.css:77,198` |
| M6 banner | `styles.css:197-207` |
| B1 skip link | `app.component.ts:10,43` |
| B2 menú móvil | `app.component.ts:13-16`; `styles.css:638-640` |
| B3 foco SPA | `app.config.ts:16` |
| B4 enlace-tarjeta | `busqueda.component.ts:155-170` |
| B5/B11 tablas admin | `admin.component.ts:63-64,104,147,199,239` |
| B6 marca | `app.component.ts:12` |
| B7 foco en encabezados | `styles.css:296,426`; `edicion-alojamiento.component.ts:273-274` |
| B8 a B14 | `calificacion.ts:71`; `direccion-mapa.component.ts:40`; `app.component.ts:17-24`; `styles.css:384-389`; `mis-reservas.component.ts:40-50`; `index.html:1-13` |

### 3.2 Cumplimientos verificados (criterios que pasan)

- **Idioma/título/zoom (3.1.1, 2.4.2, 1.4.4):** `index.html:2` `lang="es"`; `index.html:5` `<title>`; `index.html:6` viewport **sin** `maximum-scale`/`user-scalable=no` (zoom permitido). Títulos por ruta en `app.routes.ts`.
- **Bypass Blocks (2.4.1):** enlace “Saltar al contenido” → `#contenido` (`app.component.ts:10,43`).
- **Landmarks/estructura (1.3.1):** `header.barra`, `nav#nav aria-label="Principal"`, `main#contenido`, `footer.pie-pagina` (`app.component.ts:11-50`).
- **Encabezados:** `h1` por página en las vistas principales (busqueda, detalle, reserva, mis-reservas, perfil, admin, login, registro, errores) — única excepción: M3.
- **Imágenes (1.1.1):** todas las `<img>` tienen `alt` (descriptivo o `alt=""`): `detalle.component.ts:47,54`, `busqueda.component.ts:157`, `mis-reservas.component.ts:58`, `secciones.ts:321`, `editor-alojamiento.component.ts:119`; con `loading="lazy"`.
- **Formularios (1.3.1, 3.3.1, 3.3.2, 1.3.5):** `label for/id` + `aria-describedby` + `aria-invalid` + `fieldset/legend` + `role="alert"` (`reserva.component.ts:64-197`, `perfil.component.ts:35-59`, `registro.component.ts`, `login.component.ts:20-27`); `inputmode`/`type` adecuados y `autocomplete` intencionado (salvo A2).
- **Botones vs enlaces (4.1.2 / semántica):** acciones = `<button type="button|submit">`; navegación = `<a routerLink>` (p. ej. `busqueda.component.ts:155`, `admin.component.ts:59`). Todos los botones declaran `type`.
- **Foco visible (2.4.7):** regla global `:focus-visible { outline: 3px solid var(--c-acento); outline-offset: 2px }` (`styles.css:85`); controles personalizados con `:has(input:focus-visible)` (`styles.css:317,389,500`); `btn-salir:focus-visible` propio (`styles.css:105`).
- **Diálogo modal (2.1.2, 3.2.x):** `<dialog>` nativo con `role="alertdialog"`, `aria-modal`, `aria-labelledby`/`aria-describedby`, cierre con `Escape`, clic en fondo y **restauración de foco** (`confirmar.ts:47-94`).
- **Estados dinámicos (4.1.3):** `role="status"`/`aria-live` en cargas y avisos (`ui.ts:31`, `observabilidad.component.ts:24`, `reserva.component.ts:151,207,238`).
- **Calificaciones interactivas (1.4.1, 2.1.1):** radios nativos en `fieldset/legend` con foco visible (`calificacion.ts:39-50`).
- **Reducción de movimiento (2.3.3):** `@media (prefers-reduced-motion: reduce)` (`styles.css:657-661`).
- **Objetivos táctiles (2.5.8):** `.btn` min-height 42px, `.btn-chico` 32px, `.btn-redondo` 34px, `.menu-btn` 38px, `.campo-boton` 30px; ninguno < 24 px (`styles.css:113,120,228,508`).
- **Responsive:** reflujo a 1 columna en `.dos-columnas`, `.viaje`, `.edicion`, `.buscador-fila` (`styles.css:613-650`); tablas en `.tabla-scroll`; miniaturas y menú lateral con scroll horizontal propio (`styles.css:187,573,626`); grid de tarjetas 1 col a ≤640 px (`styles.css:648`).
- **Runtime JS robusto:** `main.ts:5-6` captura el error de bootstrap; `ErrorHandler` global y listeners de `error`/`unhandledrejection` (`observabilidad.service.ts:322,396-404`); `localStorage`/`sessionStorage` siempre en `try/catch` (`observabilidad.service.ts:380-393`, `auth.service.ts:57-76`). No se detectan errores JS evidentes en el código revisado.
- **Lint:** `npm run lint` (angular-eslint + `templateAccessibility`) → sin errores.

---

## 4. Recomendación de corrección para cada hallazgo

| Hallazgo | Corrección propuesta |
|---|---|
| A1 | `styles.css:39`: cambiar `--c-suave` a un gris más oscuro (p. ej. `--gris-700`) o usarlo solo sobre superficies blancas. Recalcular con herramienta. |
| A2 | `entrada.ts:77`: eliminar `autocomplete: 'off'` del host (o condicionarlo) y validar que los campos conservan `given-name`/`family-name`/`organization`. |
| M1 | `ui.ts:47`: añadir `role="img"` al `<span class="estrellas">` (o texto `sr-only`). |
| M2 | `styles.css:48`: oscurecer `--c-estrellas` (p. ej. `#8a6100`). |
| M3 | `observabilidad.component.ts:15`: usar `<h1>` como encabezado principal. |
| M4 | `admin.component.ts:33-37` y `mis-reservas.component.ts:40-50`: completar `role="tabpanel"` + `aria-controls`/`aria-labelledby` y navegación por flechas. |
| M5 | `styles.css:77`: quitar `overflow-x: clip` y corregir el sangrado del banner (`styles.css:198`). |
| M6 | `styles.css:200-201`: reforzar el overlay del banner (≥ 60 % arriba) o añadir panel semitransparente. |
| B1 | `app.component.ts:43`: añadir `tabindex="-1"` a `main#contenido`. |
| B2 | `app.component.ts:13-16`: añadir `(keydown.escape)` y gestión de foco al abrir el menú. |
| B3 | `app.config.ts:16`: enfocar `h1`/`main` tras cada navegación. |
| B4 | `busqueda.component.ts:157`: poner `alt=""` en la portada dentro del enlace-tarjeta. |
| B5 | `admin.component.ts`: añadir `scope="col"` a los `<th>`. |
| B6 | `app.component.ts:12`: alinear el texto visible con el `aria-label`. |
| B7 | `styles.css:296,426`: no eliminar el indicador de foco. |
| B8 | `calificacion.ts:71`: añadir `role="img"`/`status` o texto `sr-only`. |
| B9 | `direccion-mapa.component.ts:40`: valorar `role="region"`. |
| B10 | `app.component.ts:17-24`: añadir `aria-current="page"` a los enlaces activos. |
| B11 | `admin.component.ts:63-64`: añadir `<caption class="sr-only">`. |
| B12 | `styles.css:384-389`: eliminar el CSS `.escala-nota*` no usado. |
| B13 | `mis-reservas.component.ts:40-50`: implementar navegación por flechas (Inicio/Fin). |
| B14 | `index.html:1-13`: añadir `<noscript>` con aviso. |

---

## 5. Pruebas que deberían repetirse tras corregir

**Automatizadas**
1. `npm run lint` (debe seguir en “All files pass linting”; incluye reglas a11y de plantillas).
2. Análisis estático en navegador con axe DevTools (o Lighthouse/Pa11y) en: `/`, `/alojamientos/:id`, `/reservar`, `/mis-reservas`, `/perfil`, `/admin`, `/observabilidad`, `/login`, `/registro`, `/no-encontrado`.

**Manuales de teclado (2.1.1, 2.4.3, 2.4.7)**
3. Recorrer cada pantalla solo con **Tab/Shift+Tab/Enter/Espacio/Esc**; confirmar orden lógico y foco visible (incl. estrellas, tarjetas-radio, pestañas, menú móvil, diálogo).
4. Activar “Saltar al contenido” y comprobar que el foco entra en `#contenido` (B1).
5. Confirmar `Escape` cierra el menú móvil y el diálogo de confirmación (B2).

**Contraste (1.4.3, 1.4.11)**
6. Medir `--c-suave` sobre `#f3f5f4` y `#ffffff`; estrellas `#d89b1d` sobre blanco (A1, M2).
7. Medir el texto del banner sobre la imagen real del Cotopaxi, arriba y abajo (M6).

**Autocompletado (1.3.5)**
8. Inspeccionar en DevTools el atributo `autocomplete` final de los campos de nombre/razón social (A2). Debe ser `given-name`/`family-name`/`organization`, no `off`.

**Responsive / reflujo (1.4.10, 1.4.4, 2.5.8)**
9. Probar a **320 px, 390 px, 768 px y escritorio** comprobando ausencia de scroll horizontal real y que **nada quede recortado** (ojo con `overflow-x: clip`): buscador, tarjetas, tablas, editor por secciones, calendario, miniaturas, banner.
9b. Con zoom de navegador al **400 %** a 1280 px de ancho, verificar que no aparece scroll horizontal ni contenido cortado.
9c. Recorrer zonas táctiles (`.btn-chico`, iconos, pestañas) a 320 px.

**Lector de pantalla**
10. Anuncio de estrellas de categoría en tarjetas y detalle (M1); encabezados de la ruta `/observabilidad` (M3); pestañas de admin (M4); restauración de foco del diálogo.

**Regresión funcional (sin relación directa con a11y pero afectada por los cambios)**
9. `npm test` y `npm run build` deben seguir pasando tras las correcciones.

---

### Conclusión
El proyecto cumple la mayor parte de WCAG 2.2 AA y destaca en formularios, foco, diálogos y semántica de acciones. Las acciones de mayor impacto son **A1 (contraste del texto secundario)** y **A2 (autocomplete)**, seguidas de **M1/M2 (estrellas)** y **M3 (h1 de observabilidad)**. El resto son mejoras de UX/robustez.