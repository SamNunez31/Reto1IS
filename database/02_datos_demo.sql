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
  ('Hotel Mariscal Boutique',0,'1590490360182-c33d57733427'),('Hotel Mariscal Boutique',1,'1592229505726-ca121723b8ef'),('Hotel Mariscal Boutique',2,'1564540583246-934409427776'),
  ('Departamento La Carolina',0,'1665249934445-1de680641f50'),('Departamento La Carolina',1,'1493663284031-b7e3aefcae8e'),('Departamento La Carolina',2,'1502005097973-6a7082348e28'),
  ('Hostal Tababela Inn',0,'1631049307264-da0ec9d70304'),('Hostal Tababela Inn',1,'1560185893-a55cbc8c57e8'),('Hostal Tababela Inn',2,'1552321554-5fefe8c9ef14'),
  ('Suite Latacunga Cotopaxi View',0,'1560448204-e02f11c3d0e2'),('Suite Latacunga Cotopaxi View',1,'1493809842364-78817add7ffb'),('Suite Latacunga Cotopaxi View',2,'1502672260266-1c1ef2d93688'),
  ('Casa Colonial Centro Histórico',0,'1785099367591-4f56f80c587f'),('Casa Colonial Centro Histórico',1,'1600210491892-03d54c0aaf87'),('Casa Colonial Centro Histórico',2,'1499916078039-922301b0eb9b'),
  ('Cabañas Mindo Cloud Forest',0,'1767334573989-ffa2720523b2'),('Cabañas Mindo Cloud Forest',1,'1586375300773-8384e3e4916f'),('Cabañas Mindo Cloud Forest',2,'1617104678098-de229db51175'),
  ('Hotel Quito Tababela Plaza',0,'1702014859878-5d4743176d28'),('Hotel Quito Tababela Plaza',1,'1566665797739-1674de7a421a'),('Hotel Quito Tababela Plaza',2,'1604709177225-055f99402ea3'),
  ('Hostal Otavalo Mercado',0,'1595576508898-0ad5c879a061'),('Hostal Otavalo Mercado',1,'1615874959474-d609969a20ed'),('Hostal Otavalo Mercado',2,'1513161455079-7dc1de15ef3e'),
  ('Hotel Malecón Guayaquil',0,'1571896349842-33c89424de2d'),('Hotel Malecón Guayaquil',1,'1590490359683-658d3d23f972'),('Hotel Malecón Guayaquil',2,'1596436889106-be35e843f974'),
  ('Departamento Samborondón',0,'1654506012740-09321c969dc2'),('Departamento Samborondón',1,'1612419299101-6c294dc2901d'),('Departamento Samborondón',2,'1556912172-45b7abe8b7e1'),
  ('Hostal Guayaquil Norte',0,'1725962479542-1be0a6b0d444'),('Hostal Guayaquil Norte',1,'1522771739844-6a9f6d5f14af'),('Hostal Guayaquil Norte',2,'1618220179428-22790b461013'),
  ('Casa de Playa Salinas',0,'1721369483526-62f48a00b949'),('Casa de Playa Salinas',1,'1564013799919-ab600027ffc6'),('Casa de Playa Salinas',2,'1580587771525-78b9dba3b914'),
  ('Hotel Casa del Parque Cuenca',0,'1590381105924-c72589b9ef3f'),('Hotel Casa del Parque Cuenca',1,'1611048267451-e6ed903d4a38'),('Hotel Casa del Parque Cuenca',2,'1631049035182-249067d7618e'),
  ('Loft El Barranco',0,'1586023492125-27b2c045efd7'),('Loft El Barranco',1,'1505873242700-f289a29e1e0f'),('Loft El Barranco',2,'1556020685-ae41abfc9365'),
  ('Habitación Privada Centro Cuenca',0,'1582719478250-c89cae4dc85b'),('Habitación Privada Centro Cuenca',1,'1579656381226-5fc0f0100c3b'),('Habitación Privada Centro Cuenca',2,'1560448075-bb485b067938'),
  ('Cabaña Vilcabamba Valle Sagrado',0,'1777913319909-1d27d36db93e'),('Cabaña Vilcabamba Valle Sagrado',1,'1559841644-08984562005a'),('Cabaña Vilcabamba Valle Sagrado',2,'1616046229478-9901c5536a45'),
  ('Hotel Galápagos Puerto Ayora',0,'1564501049412-61c2a3083791'),('Hotel Galápagos Puerto Ayora',1,'1566073771259-6a8506099945'),('Hotel Galápagos Puerto Ayora',2,'1600011689032-8b628b8a8747'),
  ('Casa Isabela Backpackers',0,'1520277739336-7bf67edfa768'),('Casa Isabela Backpackers',1,'1709805619372-40de3f158e83'),('Casa Isabela Backpackers',2,'1524758631624-e2822e304c36'),
  ('Hostería Baños Termas',0,'1767324672977-3b051d4cdb88'),('Hostería Baños Termas',1,'1512918728675-ed5a9ecdebfd'),('Hostería Baños Termas',2,'1587874522487-fe10e954d035'),
  ('Hotel Manta Playa',0,'1551882547-ff40c63fe5fa'),('Hotel Manta Playa',1,'1542314831-068cd1dbfeeb'),('Hotel Manta Playa',2,'1561501900-3701fa6a0864')
) AS f(nombre, orden, foto);

-- Función auxiliar temporal para crear un alojamiento completo ---------------
CREATE FUNCTION pg_temp.demo_aloj(
  p_host text, p_nombre text, p_tipo text, p_ciudad text, p_politica text, p_modo modo_reserva,
  p_lat numeric, p_lng numeric, p_estrellas smallint, p_registro boolean,
  p_limpieza numeric,
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
          NULL, NULL,   -- registro_turismo y luaf: columnas sin uso en la aplicación (p_registro se ignora)
          'PUBLICADO')
  RETURNING id INTO v_id;

  FOR x IN SELECT * FROM jsonb_array_elements(p_unidades) LOOP
    INSERT INTO unidad_alojamiento (alojamiento_id, nombre, capacidad_huespedes, num_habitaciones, num_camas, num_banos, cantidad, precio_noche_base)
    VALUES (v_id, x->>'n', (x->>'cap')::smallint, (x->>'hab')::smallint, (x->>'camas')::smallint, 1, (x->>'q')::smallint, (x->>'p')::numeric);
  END LOOP;

  INSERT INTO alojamiento_amenidad SELECT v_id, id FROM amenidad WHERE nombre = ANY (p_amen);

  INSERT INTO imagen_alojamiento (alojamiento_id, url, orden, es_portada)
  SELECT v_id, f.url, f.orden, f.orden = 0 FROM pg_temp.demo_foto f WHERE f.nombre = p_nombre;
  RETURN v_id;
END $$;

-- Alojamientos (20): hoteles categorizados y alojamientos de particulares ----
SELECT pg_temp.demo_aloj('ana','Hotel Mariscal Boutique','Hotel','Quito','FLEXIBLE','INSTANTANEA',-0.2010,-78.4950,3::smallint,true,0,
  '[{"n":"Habitación Estándar","cap":2,"hab":1,"camas":1,"p":65,"q":8},{"n":"Suite Familiar","cap":4,"hab":2,"camas":3,"p":110,"q":3}]',
  ARRAY['Wi-Fi','Agua caliente','Desayuno incluido','Recepción 24 horas','Calefacción']);
SELECT pg_temp.demo_aloj('ana','Departamento La Carolina','Departamento','Quito','MODERADA','INSTANTANEA',-0.1807,-78.4840,NULL,false,15,
  '[{"n":"Departamento completo","cap":4,"hab":2,"camas":3,"p":58,"q":1}]',
  ARRAY['Wi-Fi','Agua caliente','Cocina equipada','Parqueadero gratuito','TV']);
SELECT pg_temp.demo_aloj('ana','Hostal Tababela Inn','Hostal','Tababela','FLEXIBLE','INSTANTANEA',-0.1100,-78.3700,2::smallint,true,0,
  '[{"n":"Habitación Doble","cap":2,"hab":1,"camas":1,"p":42,"q":10},{"n":"Habitación Triple","cap":3,"hab":1,"camas":2,"p":55,"q":4}]',
  ARRAY['Wi-Fi','Agua caliente','Transporte desde/hacia el aeropuerto','Recepción 24 horas','Desayuno incluido']);
SELECT pg_temp.demo_aloj('ana','Suite Latacunga Cotopaxi View','Departamento','Latacunga','FLEXIBLE','INSTANTANEA',-0.9340,-78.6150,NULL,false,8,
  '[{"n":"Suite completa","cap":3,"hab":1,"camas":2,"p":52,"q":1}]',
  ARRAY['Wi-Fi','Agua caliente','Calefacción','Parqueadero gratuito']);
SELECT pg_temp.demo_aloj('bruno','Casa Colonial Centro Histórico','Casa','Quito','MODERADA','INSTANTANEA',-0.2200,-78.5120,NULL,false,30,
  '[{"n":"Casa completa","cap":6,"hab":3,"camas":4,"p":120,"q":1}]',
  ARRAY['Wi-Fi','Agua caliente','Cocina equipada','Calefacción'], 'Se admiten mascotas pequeñas. No fiestas.');
SELECT pg_temp.demo_aloj('bruno','Cabañas Mindo Cloud Forest','Cabaña','Mindo','NO_REEMBOLSABLE','INSTANTANEA',-0.0510,-78.7780,NULL,true,10,
  '[{"n":"Cabaña Pareja","cap":2,"hab":1,"camas":1,"p":75,"q":4},{"n":"Cabaña Familiar","cap":5,"hab":2,"camas":3,"p":130,"q":2}]',
  ARRAY['Wi-Fi','Agua caliente','Desayuno incluido','Restaurante','Parqueadero gratuito']);
SELECT pg_temp.demo_aloj('bruno','Hotel Quito Tababela Plaza','Hotel','Tababela','FLEXIBLE','INSTANTANEA',-0.1150,-78.3650,4::smallint,true,0,
  '[{"n":"Habitación Ejecutiva","cap":2,"hab":1,"camas":1,"p":78,"q":12},{"n":"Suite Junior","cap":3,"hab":1,"camas":2,"p":120,"q":4}]',
  ARRAY['Wi-Fi','Aire acondicionado','Transporte desde/hacia el aeropuerto','Restaurante','Recepción 24 horas','Gimnasio']);
SELECT pg_temp.demo_aloj('bruno','Hostal Otavalo Mercado','Hostal','Otavalo','FLEXIBLE','INSTANTANEA',0.2330,-78.2610,1::smallint,true,0,
  '[{"n":"Habitación Doble","cap":2,"hab":1,"camas":1,"p":35,"q":6}]',
  ARRAY['Wi-Fi','Agua caliente','Desayuno incluido']);
SELECT pg_temp.demo_aloj('carla','Hotel Malecón Guayaquil','Hotel','Guayaquil','FLEXIBLE','INSTANTANEA',-2.1930,-79.8800,4::smallint,true,0,
  '[{"n":"Habitación Estándar","cap":2,"hab":1,"camas":1,"p":70,"q":10},{"n":"Suite Vista al Río","cap":3,"hab":1,"camas":2,"p":130,"q":3}]',
  ARRAY['Wi-Fi','Aire acondicionado','Piscina','Desayuno incluido','Recepción 24 horas']);
SELECT pg_temp.demo_aloj('carla','Departamento Samborondón','Departamento','Guayaquil','MODERADA','INSTANTANEA',-2.1300,-79.8650,NULL,false,12,
  '[{"n":"Departamento 2 dormitorios","cap":4,"hab":2,"camas":3,"p":62,"q":1}]',
  ARRAY['Wi-Fi','Aire acondicionado','Cocina equipada','Piscina','Parqueadero gratuito']);
SELECT pg_temp.demo_aloj('carla','Hostal Guayaquil Norte','Hostal','Guayaquil','FLEXIBLE','INSTANTANEA',-2.1700,-79.8900,2::smallint,true,0,
  '[{"n":"Habitación Doble","cap":2,"hab":1,"camas":1,"p":38,"q":8}]',
  ARRAY['Wi-Fi','Aire acondicionado','Transporte desde/hacia el aeropuerto','Parqueadero gratuito']);
SELECT pg_temp.demo_aloj('carla','Casa de Playa Salinas','Casa','Salinas','MODERADA','INSTANTANEA',-2.2140,-80.9560,NULL,false,40,
  '[{"n":"Casa frente al mar","cap":8,"hab":4,"camas":6,"p":180,"q":1}]',
  ARRAY['Wi-Fi','Aire acondicionado','Cocina equipada','Parqueadero gratuito'], 'Se admiten mascotas. Sin fiestas.');
SELECT pg_temp.demo_aloj('diego','Hotel Casa del Parque Cuenca','Hotel','Cuenca','MODERADA','INSTANTANEA',-2.8975,-79.0040,5::smallint,true,0,
  '[{"n":"Habitación Colonial","cap":2,"hab":1,"camas":1,"p":85,"q":6},{"n":"Suite Patio","cap":3,"hab":1,"camas":2,"p":140,"q":2}]',
  ARRAY['Wi-Fi','Agua caliente','Desayuno incluido','Calefacción','Restaurante']);
SELECT pg_temp.demo_aloj('diego','Loft El Barranco','Departamento','Cuenca','FLEXIBLE','INSTANTANEA',-2.9040,-79.0010,NULL,false,10,
  '[{"n":"Loft completo","cap":2,"hab":1,"camas":1,"p":48,"q":1}]',
  ARRAY['Wi-Fi','Agua caliente','Cocina equipada','TV']);
SELECT pg_temp.demo_aloj('diego','Habitación Privada Centro Cuenca','Casa','Cuenca','FLEXIBLE','INSTANTANEA',-2.8990,-79.0050,NULL,false,5,
  '[{"n":"Habitación privada","cap":2,"hab":1,"camas":1,"p":28,"q":1}]',
  ARRAY['Wi-Fi','Agua caliente','Lavandería']);
SELECT pg_temp.demo_aloj('diego','Cabaña Vilcabamba Valle Sagrado','Cabaña','Vilcabamba','MODERADA','INSTANTANEA',-4.2610,-79.2210,NULL,false,15,
  '[{"n":"Cabaña con vista","cap":4,"hab":2,"camas":3,"p":70,"q":2}]',
  ARRAY['Wi-Fi','Agua caliente','Piscina','Parqueadero gratuito']);
SELECT pg_temp.demo_aloj('elena','Hotel Galápagos Puerto Ayora','Hotel','Puerto Ayora','MODERADA','INSTANTANEA',-0.7440,-90.3140,3::smallint,true,0,
  '[{"n":"Habitación Estándar","cap":2,"hab":1,"camas":1,"p":120,"q":6},{"n":"Habitación Familiar","cap":4,"hab":2,"camas":3,"p":190,"q":2}]',
  ARRAY['Wi-Fi','Aire acondicionado','Desayuno incluido','Piscina','Transporte desde/hacia el aeropuerto']);
SELECT pg_temp.demo_aloj('elena','Casa Isabela Backpackers','Hostal','Puerto Baquerizo Moreno','FLEXIBLE','INSTANTANEA',-0.9000,-89.6100,1::smallint,true,0,
  '[{"n":"Habitación Compartida 4 pax","cap":4,"hab":1,"camas":2,"p":45,"q":3},{"n":"Habitación Doble","cap":2,"hab":1,"camas":1,"p":70,"q":4}]',
  ARRAY['Wi-Fi','Agua caliente','Lavandería']);
SELECT pg_temp.demo_aloj('elena','Hostería Baños Termas','Hotel','Baños de Agua Santa','MODERADA','INSTANTANEA',-1.3960,-78.4260,3::smallint,true,0,
  '[{"n":"Habitación Doble","cap":2,"hab":1,"camas":1,"p":60,"q":8},{"n":"Cabaña Familiar","cap":5,"hab":2,"camas":3,"p":105,"q":3}]',
  ARRAY['Wi-Fi','Agua caliente','Jacuzzi','Piscina','Desayuno incluido']);
SELECT pg_temp.demo_aloj('elena','Hotel Manta Playa','Hotel','Manta','FLEXIBLE','INSTANTANEA',-0.9500,-80.7100,4::smallint,true,0,
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
SELECT pg_temp.demo_hist('andres','Hostal Tababela Inn','Habitación Doble', date '2026-09-12', 1, 2, 7,  'Muy cerca del aeropuerto, ideal para un vuelo temprano.');
SELECT pg_temp.demo_hist('sofia','Hotel Galápagos Puerto Ayora','Habitación Estándar', date '2026-09-18', 4, 2, 10, 'Galápagos increíble, el hotel nos ayudó con todo.');
SET CONSTRAINTS ALL IMMEDIATE;
ALTER TABLE reserva ENABLE TRIGGER trg_reserva_validar;
SET CONSTRAINTS ALL DEFERRED;
UPDATE resena SET respuesta_anfitrion = '¡Gracias por tu visita! Te esperamos pronto.', respondida_en = now() WHERE nota_global = 10;

-- Reservas futuras con la lógica real (no se salta ninguna regla) ------------
-- 1) Instantánea con DOS tipos de habitación en una misma reserva (hotel 4 estrellas: lleva 10% servicio)
SELECT fn_crear_reserva((SELECT id FROM usuario WHERE email='mateo.cevallos@hotmail.com'),
  (SELECT id FROM alojamiento WHERE nombre='Hotel Quito Tababela Plaza'), current_date + 15, current_date + 17, 5::smallint,
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
