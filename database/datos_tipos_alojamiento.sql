-- =====================================================================
--  DATOS: catálogo de tipos de alojamiento reducido a 5
--  Quedan: Hotel, Hostal, Cabaña, Casa, Departamento.
--  1) Reasigna los alojamientos de los tipos que salen al tipo más parecido que queda:
--       Hostería, Hacienda turística, Resort -> Hotel
--       Casa de huéspedes                    -> Hostal
--       Lodge, Refugio, Campamento turístico -> Cabaña
--       Habitación privada                   -> Casa
--     (en la demo: "Hostería Baños Termas" -> Hotel y "Habitación Privada Centro Cuenca" -> Casa)
--  2) Borra los tipos que salen y que ya no usa ningún alojamiento (sin CASCADE: si algo más
--     dependiera de ellos, falla y no se borra nada).
--
--  Idempotente (si ya está aplicado, no cambia nada) y en UNA transacción.
--  Uso (Docker):  Get-Content database\datos_tipos_alojamiento.sql -Raw |
--                   docker exec -i booking_db_container psql -U postgres -d booking_db -v ON_ERROR_STOP=1
-- =====================================================================
BEGIN;
SET LOCAL search_path = booking, public;

-- Por si faltara alguno de los 5 que quedan
INSERT INTO tipo_alojamiento (nombre)
SELECT v.nombre FROM (VALUES ('Hotel'),('Hostal'),('Cabaña'),('Casa'),('Departamento')) v(nombre)
WHERE NOT EXISTS (SELECT 1 FROM tipo_alojamiento t WHERE t.nombre = v.nombre);

UPDATE alojamiento a
   SET tipo_id = (SELECT id FROM tipo_alojamiento WHERE nombre = m.destino)
  FROM tipo_alojamiento t
  JOIN (VALUES ('Hostería','Hotel'), ('Hacienda turística','Hotel'), ('Resort','Hotel'),
               ('Casa de huéspedes','Hostal'),
               ('Lodge','Cabaña'), ('Refugio','Cabaña'), ('Campamento turístico','Cabaña'),
               ('Habitación privada','Casa')) m(origen, destino) ON m.origen = t.nombre
 WHERE a.tipo_id = t.id;

DELETE FROM tipo_alojamiento t
 WHERE t.nombre NOT IN ('Hotel','Hostal','Cabaña','Casa','Departamento')
   AND NOT EXISTS (SELECT 1 FROM alojamiento a WHERE a.tipo_id = t.id);

COMMIT;
