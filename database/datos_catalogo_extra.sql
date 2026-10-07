-- =====================================================================
--  CATÁLOGO EXTRA: 10 alojamientos más (ejecutar DESPUÉS de 01, 02 y 03)
--  Mezcla los 5 tipos en 10 ciudades; cada uno con 2 unidades, amenidades, 3 fotos
--  (portada revisada a ojo: muestra el alojamiento), PUBLICADO y de reserva inmediata.
--  Idempotente: un alojamiento que ya existe (por nombre) se omite. No crea tablas.
--  Dueños: los anfitriones demo de 02_datos_demo.sql. Fotos: Unsplash (licencia Unsplash).
--  Mismo listado de fotos que actualizar_imagenes.sql.
-- =====================================================================
SET search_path = booking, public, extensions;

-- Ciudades necesarias (ya vienen en 01; se agregan solo si faltan)
INSERT INTO ciudad (provincia, nombre, latitud, longitud)
SELECT v.p::provincia_ec, v.n, v.lat, v.lng FROM (VALUES
  ('Pichincha','Quito',-0.180700,-78.467800),('Guayas','Guayaquil',-2.171000,-79.922400),('Azuay','Cuenca',-2.900100,-79.005900),
  ('Tungurahua','Baños de Agua Santa',-1.396400,-78.424700),('Tungurahua','Ambato',-1.241700,-78.619700),
  ('Chimborazo','Riobamba',-1.663600,-78.654600),('Loja','Loja',-3.993100,-79.204200),('Napo','Tena',-0.993800,-77.812900),
  ('Santa Elena','Montañita',-1.827500,-80.752800),('Imbabura','Ibarra',0.351700,-78.122300)
) AS v(p, n, lat, lng)
WHERE NOT EXISTS (SELECT 1 FROM ciudad c WHERE c.nombre = v.n);

CREATE TEMP TABLE IF NOT EXISTS extra_foto (nombre text, orden smallint, url text);
TRUNCATE pg_temp.extra_foto;
INSERT INTO pg_temp.extra_foto (nombre, orden, url)
SELECT f.nombre, f.orden, 'https://images.unsplash.com/photo-' || f.foto || '?w=800&q=75'
FROM (VALUES
  ('Hotel Jardín La Floresta',0,'1591088398332-8a7791972843'),('Hotel Jardín La Floresta',1,'1540518614846-7eded433c457'),('Hotel Jardín La Floresta',2,'1618773928121-c32242e63f39'),
  ('Departamento Puerto Santa Ana',0,'1554995207-c18c203602cb'),('Departamento Puerto Santa Ana',1,'1568495248636-6432b97bd949'),('Departamento Puerto Santa Ana',2,'1565183997392-2f6f122e5912'),
  ('Casa Tomebamba',0,'1416331108676-a22ccb276e35'),('Casa Tomebamba',1,'1618221195710-dd6b41faaea6'),('Casa Tomebamba',2,'1507089947368-19c1da9775ae'),
  ('Cabañas Río Pastaza',0,'1590725140246-20acdee442be'),('Cabañas Río Pastaza',1,'1600210492493-0946911123ea'),('Cabañas Río Pastaza',2,'1571508601891-ca5e7a713859'),
  ('Hostal Ficoa Ambato',0,'1505693416388-ac5ce068fe85'),('Hostal Ficoa Ambato',1,'1505692952047-1a78307da8f2'),('Hostal Ficoa Ambato',2,'1616594039964-ae9021a400a0'),
  ('Hotel Chimborazo Centro',0,'1578683010236-d716f9a3f461'),('Hotel Chimborazo Centro',1,'1631049552057-403cdb8f0658'),('Hotel Chimborazo Centro',2,'1617098900591-3f90928e8c54'),
  ('Departamento Jipiro Loja',0,'1522708323590-d24dbb6b0267'),('Departamento Jipiro Loja',1,'1484101403633-562f891dc89a'),('Departamento Jipiro Loja',2,'1549638441-b787d2e11f14'),
  ('Cabañas Amazonía Tena',0,'1774280954999-9758f11f3d41'),('Cabañas Amazonía Tena',1,'1507652313519-d4e9174996dd'),('Cabañas Amazonía Tena',2,'1611892440504-42a792e24d32'),
  ('Hostal Surf Montañita',0,'1555854877-bab0e564b8d5'),('Hostal Surf Montañita',1,'1520483601560-389dff434fdf'),('Hostal Surf Montañita',2,'1595526114035-0d45ed16cfbf'),
  ('Casa Yahuarcocha',0,'1568605114967-8130f3a36994'),('Casa Yahuarcocha',1,'1616486338812-3dadae4b4ace'),('Casa Yahuarcocha',2,'1601760562234-9814eea6663a')
) AS f(nombre, orden, foto);

-- Mismo patrón que pg_temp.demo_aloj de 02, con descripción y dirección propias; no hace nada si el nombre ya existe
CREATE OR REPLACE FUNCTION pg_temp.extra_aloj(
  p_host text, p_nombre text, p_tipo text, p_ciudad text, p_politica text,
  p_lat numeric, p_lng numeric, p_estrellas smallint, p_limpieza numeric,
  p_desc text, p_direccion text, p_unidades jsonb, p_amen text[],
  p_reglas text DEFAULT 'No fumar. Respetar el silencio después de las 22:00.') RETURNS void
LANGUAGE plpgsql AS $$
DECLARE v_id uuid; x jsonb;
BEGIN
  IF EXISTS (SELECT 1 FROM alojamiento WHERE nombre = p_nombre) THEN RETURN; END IF;
  INSERT INTO alojamiento (anfitrion_id, tipo_id, ciudad_id, politica_id, nombre, descripcion, direccion, latitud, longitud,
                           telefono_contacto, tarifa_limpieza, modo_reserva, reglas_casa, categoria_estrellas, estado)
  VALUES ((SELECT id FROM usuario WHERE split_part(email,'.',1) = p_host),
          (SELECT id FROM tipo_alojamiento WHERE nombre = p_tipo),
          (SELECT id FROM ciudad WHERE nombre = p_ciudad),
          (SELECT id FROM politica_cancelacion WHERE nombre = p_politica),
          p_nombre, p_desc, p_direccion, p_lat, p_lng, '+59322000000', p_limpieza, 'INSTANTANEA', p_reglas, p_estrellas, 'PUBLICADO')
  RETURNING id INTO v_id;

  FOR x IN SELECT * FROM jsonb_array_elements(p_unidades) LOOP
    INSERT INTO unidad_alojamiento (alojamiento_id, nombre, capacidad_huespedes, num_habitaciones, num_camas, num_banos, cantidad, precio_noche_base)
    VALUES (v_id, x->>'n', (x->>'cap')::smallint, (x->>'hab')::smallint, (x->>'camas')::smallint, 1, (x->>'q')::smallint, (x->>'p')::numeric);
  END LOOP;

  INSERT INTO alojamiento_amenidad SELECT v_id, id FROM amenidad WHERE nombre = ANY (p_amen);

  INSERT INTO imagen_alojamiento (alojamiento_id, url, orden, es_portada)
  SELECT v_id, f.url, f.orden, f.orden = 0 FROM pg_temp.extra_foto f WHERE f.nombre = p_nombre;
END $$;

SELECT pg_temp.extra_aloj('ana','Hotel Jardín La Floresta','Hotel','Quito','FLEXIBLE',-0.2045,-78.4870,3::smallint,0,
  'Hotel de 3 estrellas en La Floresta, barrio de cafés y galerías, a 10 minutos del centro histórico.',
  'Calle Madrid y Lérida, La Floresta, Quito',
  '[{"n":"Habitación Doble","cap":2,"hab":1,"camas":1,"p":68,"q":8},{"n":"Suite Jardín","cap":3,"hab":1,"camas":2,"p":115,"q":2}]',
  ARRAY['Wi-Fi','Agua caliente','Calefacción','Desayuno incluido','Recepción 24 horas']);
SELECT pg_temp.extra_aloj('carla','Departamento Puerto Santa Ana','Departamento','Guayaquil','MODERADA',-2.1835,-79.8780,NULL,15,
  'Departamentos con aire acondicionado junto al malecón de Puerto Santa Ana y el barrio Las Peñas.',
  'Malecón Puerto Santa Ana, Guayaquil',
  '[{"n":"Departamento 1 dormitorio","cap":2,"hab":1,"camas":1,"p":55,"q":2},{"n":"Departamento 2 dormitorios","cap":4,"hab":2,"camas":3,"p":85,"q":2}]',
  ARRAY['Wi-Fi','Aire acondicionado','Cocina equipada','Piscina','TV','Parqueadero gratuito']);
SELECT pg_temp.extra_aloj('diego','Casa Tomebamba','Casa','Cuenca','MODERADA',-2.9035,-79.0040,NULL,25,
  'Casa tradicional a orillas del río Tomebamba, a pocas cuadras del Parque Calderón.',
  'Paseo 3 de Noviembre, Cuenca',
  '[{"n":"Casa completa","cap":6,"hab":3,"camas":4,"p":140,"q":1},{"n":"Habitación con baño privado","cap":2,"hab":1,"camas":1,"p":40,"q":2}]',
  ARRAY['Wi-Fi','Agua caliente','Cocina equipada','Calefacción','Lavandería'], 'No fumar. Sin fiestas.');
SELECT pg_temp.extra_aloj('elena','Cabañas Río Pastaza','Cabaña','Baños de Agua Santa','NO_REEMBOLSABLE',-1.3970,-78.4230,NULL,10,
  'Cabañas de madera a pasos del centro de Baños, cerca de las termas y la ruta de las cascadas.',
  'Av. Amazonas y Pastaza, Baños de Agua Santa',
  '[{"n":"Cabaña Pareja","cap":2,"hab":1,"camas":1,"p":58,"q":4},{"n":"Cabaña Familiar","cap":5,"hab":2,"camas":3,"p":98,"q":2}]',
  ARRAY['Wi-Fi','Agua caliente','Jacuzzi','Parqueadero gratuito','Desayuno incluido']);
SELECT pg_temp.extra_aloj('ana','Hostal Ficoa Ambato','Hostal','Ambato','FLEXIBLE',-1.2400,-78.6400,1::smallint,0,
  'Hostal tranquilo en Ficoa, la zona de huertos y quintas de Ambato, con desayuno casero.',
  'Av. Los Guaytambos, Ficoa, Ambato',
  '[{"n":"Habitación Doble","cap":2,"hab":1,"camas":1,"p":32,"q":6},{"n":"Habitación Triple","cap":3,"hab":1,"camas":2,"p":45,"q":3}]',
  ARRAY['Wi-Fi','Agua caliente','Desayuno incluido','Parqueadero gratuito']);
SELECT pg_temp.extra_aloj('bruno','Hotel Chimborazo Centro','Hotel','Riobamba','MODERADA',-1.6710,-78.6480,3::smallint,0,
  'Hotel céntrico en Riobamba, punto de partida para visitar el volcán Chimborazo y el tren de la Nariz del Diablo.',
  'Calle Primera Constituyente y Pichincha, Riobamba',
  '[{"n":"Habitación Estándar","cap":2,"hab":1,"camas":1,"p":50,"q":10},{"n":"Habitación Familiar","cap":4,"hab":2,"camas":3,"p":88,"q":3}]',
  ARRAY['Wi-Fi','Agua caliente','Calefacción','Restaurante','Recepción 24 horas']);
SELECT pg_temp.extra_aloj('diego','Departamento Jipiro Loja','Departamento','Loja','FLEXIBLE',-3.9800,-79.2000,NULL,10,
  'Departamentos amoblados frente al parque Jipiro, cómodos para estancias largas en Loja.',
  'Av. Salvador Bustamante Celi, Jipiro, Loja',
  '[{"n":"Estudio","cap":2,"hab":1,"camas":1,"p":35,"q":2},{"n":"Departamento 2 dormitorios","cap":4,"hab":2,"camas":2,"p":60,"q":2}]',
  ARRAY['Wi-Fi','Agua caliente','Cocina equipada','TV','Lavandería']);
SELECT pg_temp.extra_aloj('bruno','Cabañas Amazonía Tena','Cabaña','Tena','MODERADA',-0.9930,-77.8130,NULL,15,
  'Cabañas con piscina rodeadas de selva, cerca del río Napo y de las rutas de rafting de Tena.',
  'Vía a Puerto Misahuallí km 3, Tena',
  '[{"n":"Cabaña Selva","cap":2,"hab":1,"camas":1,"p":65,"q":4},{"n":"Cabaña Familiar","cap":5,"hab":2,"camas":3,"p":110,"q":2}]',
  ARRAY['Wi-Fi','Piscina','Desayuno incluido','Restaurante','Parqueadero gratuito']);
SELECT pg_temp.extra_aloj('carla','Hostal Surf Montañita','Hostal','Montañita','FLEXIBLE',-1.8280,-80.7530,NULL,0,
  'Hostal surfero a dos cuadras de la playa de Montañita, con habitaciones compartidas y privadas.',
  'Calle 10 de Agosto, Montañita',
  '[{"n":"Cama en dormitorio compartido","cap":1,"hab":1,"camas":1,"p":30,"q":8},{"n":"Habitación Doble","cap":2,"hab":1,"camas":1,"p":55,"q":4}]',
  ARRAY['Wi-Fi','Aire acondicionado','Lavandería']);
SELECT pg_temp.extra_aloj('elena','Casa Yahuarcocha','Casa','Ibarra','NO_REEMBOLSABLE',0.3700,-78.1050,NULL,30,
  'Casa de campo junto a la laguna de Yahuarcocha, a 10 minutos de Ibarra; ideal para familias.',
  'Vía a Yahuarcocha, Ibarra',
  '[{"n":"Casa completa","cap":8,"hab":4,"camas":5,"p":160,"q":1},{"n":"Suite en la casa","cap":2,"hab":1,"camas":1,"p":60,"q":1}]',
  ARRAY['Wi-Fi','Agua caliente','Cocina equipada','Parqueadero gratuito','TV'], 'Se admiten mascotas. Sin fiestas.');
