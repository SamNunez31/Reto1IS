-- =====================================================================
--  DATOS: cierra las reservas que quedaron PENDIENTE del antiguo flujo "por solicitud"
--  Posada EC confirma cada reserva al aprobarse el pago; ya no hay forma de aceptar o rechazar
--  una solicitud desde la aplicación. Las PENDIENTE que queden se marcan EXPIRADA:
--    - no se borran (conservan detalle, eventos y trazabilidad);
--    - la transición PENDIENTE -> EXPIRADA está permitida por tg_reserva_transicion
--      y libera el cupo (fn_cupo_unidad solo cuenta PENDIENTE/CONFIRMADA/COMPLETADA);
--    - el trigger de eventos registra ReservaExpirada en el outbox.
--  No toca webhook_entrega.estado = 'PENDIENTE' (cola de entregas del Reto 2, otro concepto).
--
--  Filas afectadas: en una BD creada con los scripts actuales, 0 (la demo ya nace confirmada).
--  En una BD anterior: la reserva demo de andres.naranjo en "Casa Colonial Centro Histórico",
--  si el job de expiración aún no la cerró.
--
--  Idempotente (si no hay PENDIENTE, no cambia nada) y en UNA transacción.
--  Uso (Docker):  Get-Content database\datos_sin_pendientes.sql -Raw |
--                   docker exec -i booking_db_container psql -U postgres -d booking_db -v ON_ERROR_STOP=1
-- =====================================================================
BEGIN;
SET LOCAL search_path = booking, public;

UPDATE reserva SET estado = 'EXPIRADA', expira_en = NULL WHERE estado = 'PENDIENTE';

COMMIT;
