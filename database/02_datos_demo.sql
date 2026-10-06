-- =====================================================================
--  BOOKING PROTOTIPO - Datos de demostración v3 (ejecutar DESPUÉS de 01)
--  Contraseña de TODAS las cuentas demo:  Demo1234!
--    ADMIN      : admin.plataforma@gmail.com
--    anfitriones: ana.paredes@gmail.com, bruno.salazar@hotmail.com, carla.mendoza@gmail.com,
--                 diego.torres@hotmail.com, elena.villacis@gmail.com
--    huéspedes  : sofia.ruiz@gmail.com, mateo.cevallos@hotmail.com, lucia.andrade@gmail.com, andres.naranjo@hotmail.com
--  (el admin, operador de Posada EC, administra el catálogo; los huéspedes buscan, reservan y reseñan.
--   Los alojamientos demo siguen a nombre de los anfitriones originales: es historia de la demo)
-- =====================================================================
SET search_path = booking, public, extensions;   -- en Supabase pgcrypto vive en el schema "extensions"

-- Usuarios --------------------------------------------------------------
INSERT INTO usuario (email, password_hash, nombres, apellidos, telefono, tipo_documento, numero_documento, razon_social, rol)
SELECT v.email, crypt('Demo1234!', gen_salt('bf')), v.n, v.a, v.t, v.td::tipo_documento, v.nd, v.rs, v.r::rol_usuario
FROM (VALUES
 ('admin.plataforma@gmail.com','Administrador','Plataforma','+593990000000','RUC','1799999999001','Posada EC (demo, RUC ficticio)','ADMIN'),  -- RUC FICTICIO: emisor de las facturas del catálogo del admin
 ('ana.paredes@gmail.com','Ana','Paredes','+593991111111','RUC','1790012345001','Hoteles Paredes S.A.','USUARIO'),
 ('bruno.salazar@hotmail.com','Bruno','Salazar','+593992222222','CEDULA','1700000003',NULL,'USUARIO'),
 ('carla.mendoza@gmail.com','Carla','Mendoza','+593993333333','CEDULA','0900000004',NULL,'USUARIO'),
 ('diego.torres@hotmail.com','Diego','Torres','+593994444444','CEDULA','0100000005',NULL,'USUARIO'),
 ('elena.villacis@gmail.com','Elena','Villacís','+593995555555','CEDULA','1800000006',NULL,'USUARIO'),
 ('sofia.ruiz@gmail.com','Sofía','Ruiz','+593996666666','CEDULA','1700000007',NULL,'USUARIO'),
 ('mateo.cevallos@hotmail.com','Mateo','Cevallos','+593997777777','CEDULA','1700000008',NULL,'USUARIO'),
 ('lucia.andrade@gmail.com','Lucía','Andrade','+593998888888','CEDULA','0900000009',NULL,'USUARIO'),
 ('andres.naranjo@hotmail.com','Andrés','Naranjo','+593999999999',NULL,NULL,NULL,'USUARIO')   -- sin documento: factura a consumidor final
) AS v(email,n,a,t,td,nd,rs,r);

-- Fotos demo (Unsplash, licencia Unsplash) según tipo y ciudad; orden 0 = portada.
-- Mismo listado que database/actualizar_imagenes.sql.
CREATE TEMP TABLE demo_foto (nombre text, orden smallint, url text);
INSERT INTO pg_temp.demo_foto (nombre, orden, url)
SELECT f.nombre, f.orden, 'https://images.unsplash.com/photo-' || f.foto || '?w=800&q=75'
FROM (VALUES
  ('Hotel Mariscal Boutique',0,'1590490360182-c33d57733427'),('Hotel Mariscal Boutique',1,'1649960234302-a9402e57840d'),('Hotel Mariscal Boutique',2,'1706200972821-615812a4fbe5'),
  ('Departamento La Carolina',0,'1665249934445-1de680641f50'),('Departamento La Carolina',1,'1628004581461-13dd6f81ed07'),('Departamento La Carolina',2,'1612419299101-6c294dc2901d'),
  ('Hostal Tababela Airport Inn',0,'1631049307264-da0ec9d70304'),('Hostal Tababela Airport Inn',1,'1606591808963-8fc3c63fa6a2'),('Hostal Tababela Airport Inn',2,'1549638441-b787d2e11f14'),
  ('Suite Latacunga Cotopaxi View',0,'1694206078595-460a3ec27772'),('Suite Latacunga Cotopaxi View',1,'1600493505873-cddd69453072'),('Suite Latacunga Cotopaxi View',2,'1643054159199-46560f98c2f0'),
  ('Casa Colonial Centro Histórico',0,'1773137159005-f0ecd1201f01'),('Casa Colonial Centro Histórico',1,'1523911994826-b13e77719144'),('Casa Colonial Centro Histórico',2,'1631801010037-ae6f2c0b9307'),
  ('Cabañas Mindo Cloud Forest',0,'1767334573989-ffa2720523b2'),('Cabañas Mindo Cloud Forest',1,'1774280954999-9758f11f3d41'),('Cabañas Mindo Cloud Forest',2,'1641973240690-9c90ca32cfd4'),
  ('Hotel Quito Aeropuerto Plaza',0,'1702014859878-5d4743176d28'),('Hotel Quito Aeropuerto Plaza',1,'1631049552057-403cdb8f0658'),('Hotel Quito Aeropuerto Plaza',2,'1641312960722-368313c42d10'),
  ('Hostal Otavalo Mercado',0,'1546702005-7f8e5aeab4a6'),('Hostal Otavalo Mercado',1,'1582719478250-c89cae4dc85b'),('Hostal Otavalo Mercado',2,'1748013298733-0ae693a25de9'),
  ('Hotel Malecón Guayaquil',0,'1628004566999-83b23fdc411f'),('Hotel Malecón Guayaquil',1,'1618773928121-c32242e63f39'),('Hotel Malecón Guayaquil',2,'1649550519728-f78f78518a73'),
  ('Departamento Samborondón',0,'1654506012740-09321c969dc2'),('Departamento Samborondón',1,'1574570120538-4ec04e9ad951'),('Departamento Samborondón',2,'1656122381069-9ec666d95cf1'),
  ('Hostal Aeropuerto Guayaquil',0,'1725962479542-1be0a6b0d444'),('Hostal Aeropuerto Guayaquil',1,'1549638441-b787d2e11f14'),('Hostal Aeropuerto Guayaquil',2,'1628004566999-83b23fdc411f'),
  ('Casa de Playa Salinas',0,'1721369483526-62f48a00b949'),('Casa de Playa Salinas',1,'1588414698886-a128d309da5b'),('Casa de Playa Salinas',2,'1597475681177-809cfdc76cd2'),
  ('Hotel Casa del Parque Cuenca',0,'1504037738139-b281049f760e'),('Hotel Casa del Parque Cuenca',1,'1611892440504-42a792e24d32'),('Hotel Casa del Parque Cuenca',2,'1785099367591-4f56f80c587f'),
  ('Loft El Barranco',0,'1645327511973-9284c31e7a78'),('Loft El Barranco',1,'1600493505873-cddd69453072'),('Loft El Barranco',2,'1648430554149-edf2548b334c'),
  ('Habitación Privada Centro Cuenca',0,'1582719478250-c89cae4dc85b'),('Habitación Privada Centro Cuenca',1,'1504037738139-b281049f760e'),('Habitación Privada Centro Cuenca',2,'1648430554149-edf2548b334c'),
  ('Cabaña Vilcabamba Valle Sagrado',0,'1777913319909-1d27d36db93e'),('Cabaña Vilcabamba Valle Sagrado',1,'1616547141892-44cb8f6a87e2'),('Cabaña Vilcabamba Valle Sagrado',2,'1640554214186-788574b31564'),
  ('Hotel Galápagos Puerto Ayora',0,'1706957614198-8d2e5f0ed6ea'),('Hotel Galápagos Puerto Ayora',1,'1611892440504-42a792e24d32'),('Hotel Galápagos Puerto Ayora',2,'1676910914506-39578e3446b1'),
  ('Casa Isabela Backpackers',0,'1595517930215-d2778a56ac93'),('Casa Isabela Backpackers',1,'1709805619372-40de3f158e83'),('Casa Isabela Backpackers',2,'1503301360699-4f60cf292ec8'),
  ('Hostería Baños Termas',0,'1767324672977-3b051d4cdb88'),('Hostería Baños Termas',1,'1590367628204-bde83a38f515'),('Hostería Baños Termas',2,'1658874286769-ac34bec90fa0'),
  ('Hotel Manta Playa',0,'1701478008206-f84130836a9c'),('Hotel Manta Playa',1,'1618773928121-c32242e63f39'),('Hotel Manta Playa',2,'1603854690030-13b18ce2a495')
) AS f(nombre, orden, foto);

-- Función auxiliar temporal para crear un alojamiento completo ---------------
CREATE FUNCTION pg_temp.demo_aloj(
  p_host text, p_nombre text, p_tipo text, p_ciudad text, p_politica text, p_modo modo_reserva,
  p_lat numeric, p_lng numeric, p_estrellas smallint, p_registro boolean,
  p_aero text, p_km numeric, p_min integer, p_transfer boolean, p_limpieza numeric,
  p_unidades jsonb, p_amen text[], p_reglas text DEFAULT 'No fumar. Respetar el silencio después de las 22:00.') RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE v_id uuid; x jsonb;
BEGIN
  INSERT INTO alojamiento (anfitrion_id, tipo_id, ciudad_id, politica_id, nombre, descripcion, direccion, latitud, longitud,
                           telefono_contacto, tarifa_limpieza, modo_reserva, reglas_casa, categoria_estrellas,
                           registro_turismo, luaf, estado)
  VALUES ((SELECT id FROM usuario WHERE split_part(email,'.',1) = p_host),
          (SELECT id FROM tipo_alojamiento WHERE nombre = p_tipo),
          (SELECT id FROM ciudad WHERE nombre = p_ciudad),
          (SELECT id FROM politica_cancelacion WHERE nombre = p_politica),
          p_nombre,
          'Alojamiento de demostración en ' || p_ciudad || '. ' || p_nombre || ' ofrece una estadía cómoda y bien ubicada.',
          'Dirección demo, ' || p_ciudad, p_lat, p_lng, '+59322000000', p_limpieza, p_modo, p_reglas, p_estrellas,
          CASE WHEN p_registro THEN 'RT-' || upper(substr(md5(p_nombre),1,6)) END,
          CASE WHEN p_registro THEN 'LUAF-' || upper(substr(md5(p_nombre),7,6)) END,
          'PUBLICADO')
  RETURNING id INTO v_id;

  FOR x IN SELECT * FROM jsonb_array_elements(p_unidades) LOOP
    INSERT INTO unidad_alojamiento (alojamiento_id, nombre, capacidad_huespedes, num_habitaciones, num_camas, num_banos, cantidad, precio_noche_base)
    VALUES (v_id, x->>'n', (x->>'cap')::smallint, (x->>'hab')::smallint, (x->>'camas')::smallint, 1, (x->>'q')::smallint, (x->>'p')::numeric);
  END LOOP;

  INSERT INTO alojamiento_aeropuerto (alojamiento_id, aeropuerto_id, distancia_km, tiempo_min, ofrece_transfer)
  VALUES (v_id, (SELECT id FROM aeropuerto WHERE codigo_iata = p_aero), p_km, p_min, p_transfer);

  INSERT INTO alojamiento_amenidad SELECT v_id, id FROM amenidad WHERE nombre = ANY (p_amen);

  INSERT INTO imagen_alojamiento (alojamiento_id, url, orden, es_portada)
  SELECT v_id, f.url, f.orden, f.orden = 0 FROM pg_temp.demo_foto f WHERE f.nombre = p_nombre;
  RETURN v_id;
END $$;

-- Alojamientos (20): hoteles categorizados y alojamientos de particulares ----
SELECT pg_temp.demo_aloj('ana','Hotel Mariscal Boutique','Hotel','Quito','FLEXIBLE','INSTANTANEA',-0.2010,-78.4950,3::smallint,true,'UIO',38.0,55,true,0,
  '[{"n":"Habitación Estándar","cap":2,"hab":1,"camas":1,"p":65,"q":8},{"n":"Suite Familiar","cap":4,"hab":2,"camas":3,"p":110,"q":3}]',
  ARRAY['Wi-Fi','Agua caliente','Desayuno incluido','Recepción 24 horas','Calefacción']);
SELECT pg_temp.demo_aloj('ana','Departamento La Carolina','Departamento','Quito','MODERADA','INSTANTANEA',-0.1807,-78.4840,NULL,false,'UIO',36.0,50,false,15,
  '[{"n":"Departamento completo","cap":4,"hab":2,"camas":3,"p":58,"q":1}]',
  ARRAY['Wi-Fi','Agua caliente','Cocina equipada','Parqueadero gratuito','TV']);
SELECT pg_temp.demo_aloj('ana','Hostal Tababela Airport Inn','Hostal','Tababela','FLEXIBLE','INSTANTANEA',-0.1100,-78.3700,2::smallint,true,'UIO',2.5,6,true,0,
  '[{"n":"Habitación Doble","cap":2,"hab":1,"camas":1,"p":42,"q":10},{"n":"Habitación Triple","cap":3,"hab":1,"camas":2,"p":55,"q":4}]',
  ARRAY['Wi-Fi','Agua caliente','Transporte desde/hacia el aeropuerto','Recepción 24 horas','Desayuno incluido']);
SELECT pg_temp.demo_aloj('ana','Suite Latacunga Cotopaxi View','Departamento','Latacunga','FLEXIBLE','INSTANTANEA',-0.9340,-78.6150,NULL,false,'LTX',3.0,8,false,8,
  '[{"n":"Suite completa","cap":3,"hab":1,"camas":2,"p":52,"q":1}]',
  ARRAY['Wi-Fi','Agua caliente','Calefacción','Parqueadero gratuito']);
SELECT pg_temp.demo_aloj('bruno','Casa Colonial Centro Histórico','Casa','Quito','MODERADA','INSTANTANEA',-0.2200,-78.5120,NULL,false,'UIO',41.0,60,false,30,
  '[{"n":"Casa completa","cap":6,"hab":3,"camas":4,"p":120,"q":1}]',
  ARRAY['Wi-Fi','Agua caliente','Cocina equipada','Calefacción'], 'Se admiten mascotas pequeñas. No fiestas.');
SELECT pg_temp.demo_aloj('bruno','Cabañas Mindo Cloud Forest','Cabaña','Mindo','NO_REEMBOLSABLE','INSTANTANEA',-0.0510,-78.7780,NULL,true,'UIO',95.0,130,false,10,
  '[{"n":"Cabaña Pareja","cap":2,"hab":1,"camas":1,"p":75,"q":4},{"n":"Cabaña Familiar","cap":5,"hab":2,"camas":3,"p":130,"q":2}]',
  ARRAY['Wi-Fi','Agua caliente','Desayuno incluido','Restaurante','Parqueadero gratuito']);
SELECT pg_temp.demo_aloj('bruno','Hotel Quito Aeropuerto Plaza','Hotel','Tababela','FLEXIBLE','INSTANTANEA',-0.1150,-78.3650,4::smallint,true,'UIO',4.0,8,true,0,
  '[{"n":"Habitación Ejecutiva","cap":2,"hab":1,"camas":1,"p":78,"q":12},{"n":"Suite Junior","cap":3,"hab":1,"camas":2,"p":120,"q":4}]',
  ARRAY['Wi-Fi','Aire acondicionado','Transporte desde/hacia el aeropuerto','Restaurante','Recepción 24 horas','Gimnasio']);
SELECT pg_temp.demo_aloj('bruno','Hostal Otavalo Mercado','Hostal','Otavalo','FLEXIBLE','INSTANTANEA',0.2330,-78.2610,1::smallint,true,'UIO',92.0,100,false,0,
  '[{"n":"Habitación Doble","cap":2,"hab":1,"camas":1,"p":35,"q":6}]',
  ARRAY['Wi-Fi','Agua caliente','Desayuno incluido']);
SELECT pg_temp.demo_aloj('carla','Hotel Malecón Guayaquil','Hotel','Guayaquil','FLEXIBLE','INSTANTANEA',-2.1930,-79.8800,4::smallint,true,'GYE',8.0,20,true,0,
  '[{"n":"Habitación Estándar","cap":2,"hab":1,"camas":1,"p":70,"q":10},{"n":"Suite Vista al Río","cap":3,"hab":1,"camas":2,"p":130,"q":3}]',
  ARRAY['Wi-Fi','Aire acondicionado','Piscina','Desayuno incluido','Recepción 24 horas']);
SELECT pg_temp.demo_aloj('carla','Departamento Samborondón','Departamento','Guayaquil','MODERADA','INSTANTANEA',-2.1300,-79.8650,NULL,false,'GYE',12.0,22,false,12,
  '[{"n":"Departamento 2 dormitorios","cap":4,"hab":2,"camas":3,"p":62,"q":1}]',
  ARRAY['Wi-Fi','Aire acondicionado','Cocina equipada','Piscina','Parqueadero gratuito']);
SELECT pg_temp.demo_aloj('carla','Hostal Aeropuerto Guayaquil','Hostal','Guayaquil','FLEXIBLE','INSTANTANEA',-2.1700,-79.8900,2::smallint,true,'GYE',1.8,5,true,0,
  '[{"n":"Habitación Doble","cap":2,"hab":1,"camas":1,"p":38,"q":8}]',
  ARRAY['Wi-Fi','Aire acondicionado','Transporte desde/hacia el aeropuerto','Parqueadero gratuito']);
SELECT pg_temp.demo_aloj('carla','Casa de Playa Salinas','Casa','Salinas','MODERADA','INSTANTANEA',-2.2140,-80.9560,NULL,false,'GYE',140.0,150,false,40,
  '[{"n":"Casa frente al mar","cap":8,"hab":4,"camas":6,"p":180,"q":1}]',
  ARRAY['Wi-Fi','Aire acondicionado','Cocina equipada','Parqueadero gratuito'], 'Se admiten mascotas. Sin fiestas.');
SELECT pg_temp.demo_aloj('diego','Hotel Casa del Parque Cuenca','Hotel','Cuenca','MODERADA','INSTANTANEA',-2.8975,-79.0040,5::smallint,true,'CUE',2.5,8,true,0,
  '[{"n":"Habitación Colonial","cap":2,"hab":1,"camas":1,"p":85,"q":6},{"n":"Suite Patio","cap":3,"hab":1,"camas":2,"p":140,"q":2}]',
  ARRAY['Wi-Fi','Agua caliente','Desayuno incluido','Calefacción','Restaurante']);
SELECT pg_temp.demo_aloj('diego','Loft El Barranco','Departamento','Cuenca','FLEXIBLE','INSTANTANEA',-2.9040,-79.0010,NULL,false,'CUE',3.0,10,false,10,
  '[{"n":"Loft completo","cap":2,"hab":1,"camas":1,"p":48,"q":1}]',
  ARRAY['Wi-Fi','Agua caliente','Cocina equipada','TV']);
SELECT pg_temp.demo_aloj('diego','Habitación Privada Centro Cuenca','Habitación privada','Cuenca','FLEXIBLE','INSTANTANEA',-2.8990,-79.0050,NULL,false,'CUE',3.2,10,false,5,
  '[{"n":"Habitación privada","cap":2,"hab":1,"camas":1,"p":28,"q":1}]',
  ARRAY['Wi-Fi','Agua caliente','Lavandería']);
SELECT pg_temp.demo_aloj('diego','Cabaña Vilcabamba Valle Sagrado','Cabaña','Vilcabamba','MODERADA','INSTANTANEA',-4.2610,-79.2210,NULL,false,'LOH',62.0,95,false,15,
  '[{"n":"Cabaña con vista","cap":4,"hab":2,"camas":3,"p":70,"q":2}]',
  ARRAY['Wi-Fi','Agua caliente','Piscina','Parqueadero gratuito']);
SELECT pg_temp.demo_aloj('elena','Hotel Galápagos Puerto Ayora','Hotel','Puerto Ayora','MODERADA','INSTANTANEA',-0.7440,-90.3140,3::smallint,true,'GPS',43.0,70,true,0,
  '[{"n":"Habitación Estándar","cap":2,"hab":1,"camas":1,"p":120,"q":6},{"n":"Habitación Familiar","cap":4,"hab":2,"camas":3,"p":190,"q":2}]',
  ARRAY['Wi-Fi','Aire acondicionado','Desayuno incluido','Piscina','Transporte desde/hacia el aeropuerto']);
SELECT pg_temp.demo_aloj('elena','Casa Isabela Backpackers','Hostal','Puerto Baquerizo Moreno','FLEXIBLE','INSTANTANEA',-0.9000,-89.6100,1::smallint,true,'SCY',1.2,4,false,0,
  '[{"n":"Habitación Compartida 4 pax","cap":4,"hab":1,"camas":2,"p":45,"q":3},{"n":"Habitación Doble","cap":2,"hab":1,"camas":1,"p":70,"q":4}]',
  ARRAY['Wi-Fi','Agua caliente','Lavandería']);
SELECT pg_temp.demo_aloj('elena','Hostería Baños Termas','Hostería','Baños de Agua Santa','MODERADA','INSTANTANEA',-1.3960,-78.4260,3::smallint,true,'LTX',50.0,70,false,0,
  '[{"n":"Habitación Doble","cap":2,"hab":1,"camas":1,"p":60,"q":8},{"n":"Cabaña Familiar","cap":5,"hab":2,"camas":3,"p":105,"q":3}]',
  ARRAY['Wi-Fi','Agua caliente','Jacuzzi','Piscina','Desayuno incluido']);
SELECT pg_temp.demo_aloj('elena','Hotel Manta Playa','Hotel','Manta','FLEXIBLE','INSTANTANEA',-0.9500,-80.7100,4::smallint,true,'MEC',3.5,9,true,0,
  '[{"n":"Habitación Vista al Mar","cap":3,"hab":1,"camas":2,"p":90,"q":10}]',
  ARRAY['Wi-Fi','Aire acondicionado','Piscina','Restaurante','Recepción 24 horas']);

-- Las casas de Bruno y Carla aceptan mascotas (regla en reglas_casa, ya escrita arriba)

-- Calendario: excepciones (temporada alta, cierre por mantenimiento, venta parcial) ----
INSERT INTO calendario_unidad (unidad_id, fecha, precio_noche)
SELECT u.id, d::date, round(u.precio_noche_base * 1.25, 2)
FROM unidad_alojamiento u JOIN alojamiento a ON a.id = u.alojamiento_id
CROSS JOIN generate_series(date '2026-12-24', date '2026-12-31', interval '1 day') d
WHERE a.nombre IN ('Hotel Manta Playa','Casa de Playa Salinas','Hotel Galápagos Puerto Ayora');
INSERT INTO calendario_unidad (unidad_id, fecha, cantidad_a_la_venta)
SELECT u.id, d::date, 0 FROM unidad_alojamiento u CROSS JOIN generate_series(date '2026-11-10', date '2026-11-12', interval '1 day') d
WHERE u.nombre = 'Loft completo';                                         -- cerrada por mantenimiento
INSERT INTO calendario_unidad (unidad_id, fecha, cantidad_a_la_venta)
SELECT u.id, d::date, 3 FROM unidad_alojamiento u CROSS JOIN generate_series(date '2026-11-20', date '2026-11-22', interval '1 day') d
WHERE u.nombre = 'Habitación Ejecutiva';                                  -- solo 3 de 12 a la venta (convenio)

-- Estancias ya COMPLETADAS (histórico) con su cobro, factura y reseña.
-- Se desactiva solo la validación de "fecha pasada" para sembrar el histórico.
SET CONSTRAINTS ALL IMMEDIATE;   -- Supabase ejecuta todo en una transacción: se vacían eventos pendientes antes del ALTER
ALTER TABLE reserva DISABLE TRIGGER trg_reserva_validar;
SET CONSTRAINTS ALL DEFERRED;
CREATE FUNCTION pg_temp.demo_hist(p_huesped text, p_aloj text, p_unidad text, p_entrada date, p_noches int,
                                  p_huespedes int, p_nota int, p_texto text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_aloj uuid := (SELECT id FROM alojamiento WHERE nombre = p_aloj); v_res uuid;
BEGIN
  v_res := fn_crear_reserva((SELECT id FROM usuario WHERE split_part(email,'.',1) = p_huesped), v_aloj,
            p_entrada, p_entrada + p_noches, p_huespedes::smallint,
            jsonb_build_array(jsonb_build_object('unidad_id',
              (SELECT id FROM unidad_alojamiento WHERE alojamiento_id = v_aloj AND nombre = p_unidad), 'cantidad', 1)));
  UPDATE reserva SET estado = 'COMPLETADA' WHERE id = v_res;
  INSERT INTO resena (reserva_id, nota_global, comentario) VALUES (v_res, p_nota, p_texto);
END $$;
SELECT pg_temp.demo_hist('sofia','Hotel Mariscal Boutique','Habitación Estándar', date '2026-08-10', 3, 2, 9,  'Excelente ubicación y atención. Volvería sin dudarlo.');
SELECT pg_temp.demo_hist('mateo','Hotel Malecón Guayaquil','Habitación Estándar', date '2026-08-20', 2, 2, 8,  'Habitación cómoda, buen desayuno.');
SELECT pg_temp.demo_hist('lucia','Hotel Casa del Parque Cuenca','Habitación Colonial', date '2026-09-01', 2, 2, 10, 'Hermoso hotel colonial, personal muy amable.');
SELECT pg_temp.demo_hist('andres','Hostal Tababela Airport Inn','Habitación Doble', date '2026-09-12', 1, 2, 7,  'Muy cerca del aeropuerto, ideal para un vuelo temprano.');
SELECT pg_temp.demo_hist('sofia','Hotel Galápagos Puerto Ayora','Habitación Estándar', date '2026-09-18', 4, 2, 10, 'Galápagos increíble, el hotel nos ayudó con todo.');
SET CONSTRAINTS ALL IMMEDIATE;
ALTER TABLE reserva ENABLE TRIGGER trg_reserva_validar;
SET CONSTRAINTS ALL DEFERRED;
UPDATE resena SET respuesta_anfitrion = '¡Gracias por tu visita! Te esperamos pronto.', respondida_en = now() WHERE nota_global = 10;

-- Reservas futuras con la lógica real (no se salta ninguna regla) ------------
-- 1) Instantánea con DOS tipos de habitación en una misma reserva (hotel 4 estrellas: lleva 10% servicio)
SELECT fn_crear_reserva((SELECT id FROM usuario WHERE email='mateo.cevallos@hotmail.com'),
  (SELECT id FROM alojamiento WHERE nombre='Hotel Quito Aeropuerto Plaza'), current_date + 15, current_date + 17, 5::smallint,
  jsonb_build_array(
    jsonb_build_object('unidad_id',(SELECT id FROM unidad_alojamiento WHERE nombre='Habitación Ejecutiva'),'cantidad',1),
    jsonb_build_object('unidad_id',(SELECT id FROM unidad_alojamiento WHERE nombre='Suite Junior'),'cantidad',1)));
-- 2) Instantánea simple
SELECT fn_crear_reserva((SELECT id FROM usuario WHERE email='lucia.andrade@gmail.com'),
  (SELECT id FROM alojamiento WHERE nombre='Hotel Malecón Guayaquil'), current_date + 30, current_date + 33, 2::smallint,
  jsonb_build_array(jsonb_build_object('unidad_id',(SELECT id FROM unidad_alojamiento WHERE nombre='Suite Vista al Río'),'cantidad',1)));
-- 3) Instantánea de una casa completa (casa de Bruno)
SELECT fn_crear_reserva((SELECT id FROM usuario WHERE email='andres.naranjo@hotmail.com'),
  (SELECT id FROM alojamiento WHERE nombre='Casa Colonial Centro Histórico'), current_date + 45, current_date + 48, 4::smallint,
  jsonb_build_array(jsonb_build_object('unidad_id',(SELECT id FROM unidad_alojamiento WHERE nombre='Casa completa' AND capacidad_huespedes = 6),'cantidad',1)));
-- 4) Cancelación tardía del huésped: política MODERADA, entrada en 3 días -> penalidad del 50%
SELECT fn_cancelar_reserva(
  fn_crear_reserva((SELECT id FROM usuario WHERE email='sofia.ruiz@gmail.com'),
    (SELECT id FROM alojamiento WHERE nombre='Departamento La Carolina'), current_date + 3, current_date + 5, 2::smallint,
    jsonb_build_array(jsonb_build_object('unidad_id',(SELECT id FROM unidad_alojamiento WHERE nombre='Departamento completo'),'cantidad',1))),
  (SELECT id FROM usuario WHERE email='sofia.ruiz@gmail.com'), 'Cambio de planes');
-- 5) Cancelación del anfitrión: reembolso total
SELECT fn_cancelar_reserva(
  fn_crear_reserva((SELECT id FROM usuario WHERE email='mateo.cevallos@hotmail.com'),
    (SELECT id FROM alojamiento WHERE nombre='Suite Latacunga Cotopaxi View'), current_date + 20, current_date + 22, 2::smallint,
    jsonb_build_array(jsonb_build_object('unidad_id',(SELECT id FROM unidad_alojamiento WHERE nombre='Suite completa'),'cantidad',1))),
  (SELECT id FROM usuario WHERE email='ana.paredes@gmail.com'), 'Mantenimiento imprevisto');

DO $$ BEGIN RAISE NOTICE 'Demo OK: % usuarios, % alojamientos, % unidades, % reservas, % reseñas, % facturas, % eventos',
 (SELECT count(*) FROM usuario),(SELECT count(*) FROM alojamiento),(SELECT count(*) FROM unidad_alojamiento),
 (SELECT count(*) FROM reserva),(SELECT count(*) FROM resena),(SELECT count(*) FROM factura),
 (SELECT count(*) FROM evento_outbox); END $$;
