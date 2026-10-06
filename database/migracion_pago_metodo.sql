-- =====================================================================
--  MIGRACIÓN: método de pago (TARJETA o EFECTIVO) en la tabla pago
--  - Columna pago.metodo text NOT NULL DEFAULT 'TARJETA' con CHECK (TARJETA | EFECTIVO).
--    Los pagos existentes quedan como TARJETA (eran todos con tarjeta simulada).
--  - No cambia funciones: el backend, en la misma transacción que fn_crear_orden, deja el cobro
--    de una reserva en efectivo como estado PENDIENTE y metodo EFECTIVO. Como v_cancelacion_liquidacion
--    solo cuenta cobros APROBADO, cancelar una reserva con efectivo pendiente no genera reembolso.
--  Sigue habiendo 27 tablas (solo se agrega una columna).
--
--  Idempotente y en UNA transacción.
--  Uso (Docker):  Get-Content database\migracion_pago_metodo.sql -Raw |
--                   docker exec -i booking_db_container psql -U postgres -d booking_db -v ON_ERROR_STOP=1
-- =====================================================================
BEGIN;
SET LOCAL search_path = booking, public;

ALTER TABLE pago ADD COLUMN IF NOT EXISTS metodo text NOT NULL DEFAULT 'TARJETA';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'ck_pago_metodo' AND conrelid = 'booking.pago'::regclass) THEN
    ALTER TABLE booking.pago ADD CONSTRAINT ck_pago_metodo CHECK (metodo IN ('TARJETA','EFECTIVO'));
  END IF;
END $$;

COMMENT ON COLUMN pago.metodo IS 'Medio de pago: TARJETA (simulada, se aprueba al reservar) o EFECTIVO (queda PENDIENTE hasta que el admin confirma que lo recibió).';

COMMIT;
