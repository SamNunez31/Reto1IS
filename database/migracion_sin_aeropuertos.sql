-- =====================================================================
--  MIGRACIÓN: se elimina todo lo de aeropuertos (el sitio ya no filtra ni muestra "cerca del aeropuerto")
--  Resultado: 25 tablas (antes 27).
--
--  Qué cambia:
--    - tabla alojamiento_aeropuerto (puente alojamiento <-> aeropuerto)  -> se borra
--    - tabla aeropuerto (catálogo IATA)                                  -> se borra
--    - función fn_buscar_alojamientos: pierde p_aeropuerto y p_max_km y las columnas
--      aeropuerto, distancia_km, tiempo_min y ofrece_transfer; ahora ordena por precio.
--  Qué NO cambia (a propósito):
--    - ciudades (Tababela, Baltra, etc. siguen siendo localidades válidas)
--    - la amenidad "Transporte desde/hacia el aeropuerto" (es un servicio, no un dato de aeropuerto)
--    - nombres de alojamientos demo que mencionan "Aeropuerto"/"Airport" y eventos históricos
--
--  Sin CASCADE: si apareciera una dependencia no prevista, falla y no se borra nada.
--  Idempotente (IF EXISTS) y en UNA transacción.
--  Uso (Docker):  Get-Content database\migracion_sin_aeropuertos.sql -Raw |
--                   docker exec -i booking_db_container psql -U postgres -d booking_db -v ON_ERROR_STOP=1
--  Uso (Supabase): pegar el archivo completo en SQL Editor y ejecutar ANTES de desplegar el backend nuevo.
-- =====================================================================
BEGIN;
SET LOCAL search_path = booking, public;

-- 1) Función de búsqueda: se borra la firma antigua (con aeropuerto) y se crea la nueva
DROP FUNCTION IF EXISTS fn_buscar_alojamientos(
  date, date, integer, provincia_ec, smallint, character, numeric, smallint, numeric, smallint, integer, integer);

CREATE OR REPLACE FUNCTION fn_buscar_alojamientos(
  p_entrada date, p_salida date, p_huespedes integer DEFAULT 1,
  p_provincia provincia_ec DEFAULT NULL, p_ciudad smallint DEFAULT NULL,
  p_tipo smallint DEFAULT NULL, p_precio_max numeric DEFAULT NULL, p_estrellas_min smallint DEFAULT NULL,
  p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
RETURNS TABLE (alojamiento_id uuid, nombre varchar, tipo varchar, ciudad varchar, provincia provincia_ec,
               estrellas smallint, precio_desde_noche numeric, calificacion numeric, num_resenas bigint, portada text)
LANGUAGE sql STABLE AS $$
  SELECT a.id, a.nombre, ta.nombre, c.nombre, c.provincia, a.categoria_estrellas, d.precio_desde,
         rt.prom, COALESCE(rt.n, 0), pi.url
  FROM alojamiento a
  JOIN tipo_alojamiento ta ON ta.id = a.tipo_id
  JOIN ciudad c ON c.id = a.ciudad_id
  CROSS JOIN LATERAL (
     SELECT sum(u.capacidad_huespedes * q.cupo) AS cap,
            min(round(fn_precio_estadia(u.id, p_entrada, p_salida) / (p_salida - p_entrada), 2)) AS precio_desde
     FROM unidad_alojamiento u
     CROSS JOIN LATERAL (SELECT fn_cupo_unidad(u.id, p_entrada, p_salida) AS cupo) q
     WHERE u.alojamiento_id = a.id AND u.activa AND q.cupo > 0) d
  LEFT JOIN LATERAL (
     SELECT round(avg(rs.nota_global), 1) AS prom, count(*) AS n
       FROM resena rs JOIN reserva rv ON rv.id = rs.reserva_id
      WHERE rv.alojamiento_id = a.id AND rs.estado = 'PUBLICADA') rt ON true
  LEFT JOIN LATERAL (
     SELECT i.url FROM imagen_alojamiento i WHERE i.alojamiento_id = a.id ORDER BY i.es_portada DESC, i.orden LIMIT 1) pi ON true
  WHERE a.estado = 'PUBLICADO'
    AND (p_salida - p_entrada) BETWEEN a.noches_min AND a.noches_max
    AND d.cap >= p_huespedes
    AND (p_provincia IS NULL OR c.provincia = p_provincia)
    AND (p_ciudad IS NULL OR a.ciudad_id = p_ciudad)
    AND (p_tipo IS NULL OR a.tipo_id = p_tipo)
    AND (p_estrellas_min IS NULL OR a.categoria_estrellas >= p_estrellas_min)
    AND (p_precio_max IS NULL OR d.precio_desde <= p_precio_max)
  ORDER BY d.precio_desde
  LIMIT p_limit OFFSET p_offset $$;

-- 2) Tablas (primero la puente, luego el catálogo; sus índices se van con ellas)
DROP TABLE IF EXISTS alojamiento_aeropuerto;
DROP TABLE IF EXISTS aeropuerto;

COMMIT;
