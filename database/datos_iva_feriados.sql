-- =====================================================================
--  DATOS: el IVA reducido de los feriados depende SOLO de las fechas
--  Antes, una tarifa marcada requiere_registro_turismo solo aplicaba a los alojamientos con
--  registro de turismo y LUAF. Esos campos ya no se piden en la aplicación, así que las tarifas
--  existentes se desmarcan: aplican a todos los alojamientos durante su vigencia.
--  No borra columnas ni cambia fn_iva_pct; las reservas ya hechas no cambian (sus montos están guardados).
--
--  Filas afectadas: las tarifas con requiere_registro_turismo = true (la semilla no trae ninguna;
--  solo las que haya registrado el administrador).
--
--  Idempotente y en UNA transacción.
--  Uso (Docker):  Get-Content database\datos_iva_feriados.sql -Raw |
--                   docker exec -i booking_db_container psql -U postgres -d booking_db -v ON_ERROR_STOP=1
-- =====================================================================
BEGIN;
SET LOCAL search_path = booking, public;

UPDATE impuesto_tarifa SET requiere_registro_turismo = false WHERE requiere_registro_turismo;

COMMIT;
