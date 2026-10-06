# Declaración de uso de IA (borrador — completar y ajustar por el equipo)

**Herramienta:** Claude Code (asistente de programación de Anthropic), usado en el editor.

**Para qué se usó:**
- Generar el esqueleto del backend NestJS a partir de la plantilla del curso y del contrato `contracts/alojamientos-openapi.yaml` (DTOs, controladores, servicios, filtro de errores, guards).
- Generar el frontend Angular 19 (servicios, componentes y estilos).
- Redactar la documentación (`docs/`), el contrato gRPC/GraphQL conceptual y los scripts `docs:openapi` y `contract:check`.
- Ejecutar pruebas manuales con curl contra la BD usando solo cuentas demo.

**Qué hizo el equipo (completar):**
- Diseño del modelo de datos y scripts SQL (`database/`): …
- Revisión línea por línea del código generado y correcciones: …
- Decisiones de alcance y supuestos (`docs/SUPUESTOS.md`): …
- Despliegue en Render/Vercel y verificación: …

**Verificación:** el código compila (`npm run build` en backend y frontend), `npm run contract:check` confirma las 17 operaciones del contrato y el flujo de reserva se probó de punta a punta (ver `docs/PENDIENTES.md`).

**Responsabilidad:** el equipo revisó, entiende y puede explicar todo el código entregado (ver `docs/GUIA_DE_DEFENSA.md`).
