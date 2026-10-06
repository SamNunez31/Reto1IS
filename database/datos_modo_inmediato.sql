-- =====================================================================
--  DATOS: todos los alojamientos pasan a reserva inmediata (INSTANTANEA)
--  Posada EC confirma cada reserva al aprobarse el pago; ya no hay "reserva por solicitud".
--  No borra el valor SOLICITUD del enum ni toca reservas existentes: una solicitud
--  PENDIENTE que ya exista sigue su curso (el job la expira a las 24 h).
--
--  Idempotente (si ya no hay SOLICITUD, no cambia nada) y en UNA transacción.
--  Uso (Docker):  Get-Content database\datos_modo_inmediato.sql -Raw |
--                   docker exec -i booking_db_container psql -U postgres -d booking_db -v ON_ERROR_STOP=1
-- =====================================================================
BEGIN;
SET LOCAL search_path = booking, public;

UPDATE alojamiento SET modo_reserva = 'INSTANTANEA' WHERE modo_reserva = 'SOLICITUD';

COMMIT;
