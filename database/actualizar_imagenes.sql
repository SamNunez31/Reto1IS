-- =====================================================================
--  Actualiza nombres y fotos de los alojamientos demo en una BD ya cargada.
--  1) Renombra 3 alojamientos (sin "Aeropuerto"/"Airport" en el nombre; la amenidad
--     "Transporte desde/hacia el aeropuerto" no se toca).
--  2) Fotos: portada (orden 0) revisada a ojo para que muestre el alojamiento (fachada,
--     habitación, sala o cabaña), nunca un paisaje o animal; fotos 1 y 2 del mismo tipo.
--  Solo UPDATE por nombre (y orden); no crea ni borra filas. Idempotente.
--  Mismo listado que 02_datos_demo.sql y datos_catalogo_extra.sql (si no se cargó, sus filas no cambian nada).
--  Fuente: Unsplash (https://unsplash.com/license).
-- =====================================================================
SET search_path = booking, public;

BEGIN;

UPDATE alojamiento a SET nombre = r.nuevo
  FROM (VALUES ('Hotel Quito Aeropuerto Plaza','Hotel Quito Tababela Plaza'),
               ('Hostal Aeropuerto Guayaquil','Hostal Guayaquil Norte'),
               ('Hostal Tababela Airport Inn','Hostal Tababela Inn')) AS r(viejo, nuevo)
 WHERE a.nombre = r.viejo
   AND NOT EXISTS (SELECT 1 FROM alojamiento b WHERE b.nombre = r.nuevo);

UPDATE imagen_alojamiento i
   SET url = 'https://images.unsplash.com/photo-' || f.foto || '?w=800&q=75'
  FROM alojamiento a,
       (VALUES
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
  ('Hotel Manta Playa',0,'1551882547-ff40c63fe5fa'),('Hotel Manta Playa',1,'1542314831-068cd1dbfeeb'),('Hotel Manta Playa',2,'1561501900-3701fa6a0864'),
  -- datos_catalogo_extra.sql
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
       ) AS f(nombre, orden, foto)
 WHERE a.id = i.alojamiento_id
   AND a.nombre = f.nombre
   AND i.orden = f.orden
   AND i.url IS DISTINCT FROM 'https://images.unsplash.com/photo-' || f.foto || '?w=800&q=75';

COMMIT;
