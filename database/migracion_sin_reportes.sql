-- =====================================================================
--  MIGRACIÓN: se eliminan las denuncias (tabla reporte) — pasan a "evolución futura"
--  Resultado: 27 tablas.
--
--  Dependencias de reporte (revisadas en pg_depend antes de escribir esto):
--    - vista v_admin_indicadores (columna reportes_pendientes)  -> se recrea sin esa columna
--    - triggers trg_reporte_validar y trg_evt_reporte           -> se van con la tabla
--    - funciones tg_reporte_validar() y tg_evt_reporte()        -> se borran (solo servían a reporte)
--    - tipo estado_reporte (solo reporte.estado)                -> se borra
--    - ninguna llave foránea apunta a reporte; sin políticas RLS
--  Se conserva: el tipo motivo_reporte (queda sin uso) y los eventos históricos
--  AlojamientoReportado / UsuarioReportado en evento_outbox (son historia).
--
--  Idempotente (IF EXISTS) y en UNA transacción. Sin CASCADE: si apareciera otra
--  dependencia no prevista, falla y no se borra nada.
--  Uso (Docker):  Get-Content database\migracion_sin_reportes.sql -Raw |
--                   docker exec -i booking_db_container psql -U postgres -d booking_db -v ON_ERROR_STOP=1
-- =====================================================================
BEGIN;
SET LOCAL search_path = booking, public;

DROP VIEW IF EXISTS v_admin_indicadores;
CREATE VIEW v_admin_indicadores AS
SELECT (SELECT count(*) FROM usuario WHERE activo)                                   AS usuarios_activos,
       (SELECT count(*) FROM alojamiento WHERE estado = 'PUBLICADO')                 AS alojamientos_publicados,
       (SELECT count(*) FROM alojamiento WHERE estado = 'SUSPENDIDO')                AS alojamientos_suspendidos,
       (SELECT count(*) FROM reserva WHERE estado = 'CONFIRMADA')                    AS reservas_confirmadas,
       (SELECT count(*) FROM reserva WHERE estado = 'PENDIENTE')                     AS solicitudes_pendientes,
       (SELECT count(*) FROM reserva WHERE estado = 'CANCELADA')                     AS reservas_canceladas,
       (SELECT COALESCE(sum(t.total), 0) FROM reserva r JOIN v_reserva_total t ON t.reserva_id = r.id
         WHERE r.estado IN ('CONFIRMADA','COMPLETADA'))                              AS volumen_reservado;

DROP TABLE IF EXISTS reporte;                 -- sus índices y triggers se van con ella
DROP FUNCTION IF EXISTS tg_reporte_validar();
DROP FUNCTION IF EXISTS tg_evt_reporte();
DROP TYPE IF EXISTS estado_reporte;

COMMIT;
