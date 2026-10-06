-- =====================================================================
--  MIGRACIÓN: el ADMIN (operador de Posada EC) puede ser dueño de alojamientos
--  Antes: el trigger tg_alojamiento_anfitrion rechazaba con ANFITRION_INVALIDO a un ADMIN.
--  Ahora: el admin crea el catálogo a su nombre; solo se exige que el dueño sea una cuenta activa.
--  No borra columnas, tipos ni datos: solo reemplaza el cuerpo de la función.
--
--  Idempotente (CREATE OR REPLACE) y en UNA transacción.
--  Uso (Docker):  Get-Content database\migracion_admin_dueno.sql -Raw |
--                   docker exec -i booking_db_container psql -U postgres -d booking_db -v ON_ERROR_STOP=1
-- =====================================================================
BEGIN;
SET LOCAL search_path = booking, public;

CREATE OR REPLACE FUNCTION tg_alojamiento_anfitrion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT COALESCE((SELECT activo FROM usuario WHERE id = NEW.anfitrion_id), false) THEN
    RAISE EXCEPTION 'ANFITRION_INVALIDO: el dueño del alojamiento debe ser una cuenta activa';
  END IF;
  RETURN NEW;
END $$;

-- El trigger ya existe (trg_alojamiento_anf); se recrea solo si faltara
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
                  WHERE c.relname = 'alojamiento' AND c.relnamespace = 'booking'::regnamespace
                    AND t.tgname = 'trg_alojamiento_anf') THEN
    CREATE TRIGGER trg_alojamiento_anf BEFORE INSERT OR UPDATE OF anfitrion_id ON booking.alojamiento
      FOR EACH ROW EXECUTE FUNCTION booking.tg_alojamiento_anfitrion();
  END IF;
END $$;

COMMIT;
