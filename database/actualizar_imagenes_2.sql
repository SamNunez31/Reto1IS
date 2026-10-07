-- =====================================================================
--  Fotos coherentes con el nombre, el tipo y la ciudad de cada alojamiento (revisión 2).
--  Corrige 59 fotos: edificios públicos/monumentos, lugares de otra región (playa o palmeras en la Sierra,
--  bosque de coníferas o nieve), tipo equivocado y fotos repetidas entre alojamientos.
--  Tras aplicarlo, cada alojamiento tiene 3 fotos y NINGUNA foto se repite entre alojamientos.
--  Todas las fotos nuevas se revisaron a ojo y responden HTTP 200 (images.unsplash.com, licencia Unsplash).
--
--  Solo UPDATE de la URL por (código del alojamiento, orden de la foto), con el nombre como resguardo:
--  si en otra BD los códigos no coinciden con estos nombres, no se modifica nada. Idempotente.
--  (Los scripts de Docker 02_datos_demo.sql y datos_catalogo_extra.sql ya traen estas mismas fotos por nombre.)
-- =====================================================================
SET search_path = booking, public;

BEGIN;

UPDATE imagen_alojamiento i
   SET url = 'https://images.unsplash.com/photo-' || f.foto || '?w=800&q=75'
  FROM alojamiento a,
       (VALUES
  (1001, 'Casa Colonial Centro Histórico', 0, '1785099367591-4f56f80c587f'),  -- antes 1773137159005-f0ecd1201f01: claustro monumental (edificio público)
  (1001, 'Casa Colonial Centro Histórico', 1, '1600210491892-03d54c0aaf87'),  -- antes 1721369483526-62f48a00b949: vista al mar en zona andina / repetida
  (1001, 'Casa Colonial Centro Histórico', 2, '1499916078039-922301b0eb9b'),  -- antes 1582719478250-c89cae4dc85b: repetida
  (1002, 'Hotel Galápagos Puerto Ayora', 1, '1566073771259-6a8506099945'),  -- antes 1578683010236-d716f9a3f461: repetida
  (1002, 'Hotel Galápagos Puerto Ayora', 2, '1600011689032-8b628b8a8747'),  -- antes 1590490360182-c33d57733427: repetida
  (1003, 'Habitación Privada Centro Cuenca', 1, '1579656381226-5fc0f0100c3b'),  -- antes 1580587771525-78b9dba3b914: villa con piscina en centro de Cuenca
  (1003, 'Habitación Privada Centro Cuenca', 2, '1560448075-bb485b067938'),  -- antes 1512917774080-9991f1c4c750: casa con palmeras en Cuenca
  (1004, 'Hotel Quito Tababela Plaza', 1, '1566665797739-1674de7a421a'),  -- antes 1542314831-068cd1dbfeeb: resort tropical en zona andina / repetida
  (1004, 'Hotel Quito Tababela Plaza', 2, '1604709177225-055f99402ea3'),  -- antes 1551882547-ff40c63fe5fa: resort con palmeras en zona andina / repetida
  (1005, 'Casa Isabela Backpackers', 1, '1709805619372-40de3f158e83'),  -- antes 1725962479542-1be0a6b0d444: repetida
  (1005, 'Casa Isabela Backpackers', 2, '1524758631624-e2822e304c36'),  -- antes 1555854877-bab0e564b8d5: repetida
  (1006, 'Cabaña Vilcabamba Valle Sagrado', 1, '1559841644-08984562005a'),  -- antes 1587061949409-02df41d5e562: cabaña de bosque de coníferas (otra región)
  (1006, 'Cabaña Vilcabamba Valle Sagrado', 2, '1616046229478-9901c5536a45'),  -- antes 1510798831971-661eb04b3739: cabaña con nieve y lago (lugar reconocible de otra región)
  (1007, 'Hotel Casa del Parque Cuenca', 1, '1611048267451-e6ed903d4a38'),  -- antes 1571896349842-33c89424de2d: resort tropical en Cuenca / repetida
  (1008, 'Hostal Tababela Inn', 1, '1560185893-a55cbc8c57e8'),  -- antes 1725962479542-1be0a6b0d444: repetida
  (1008, 'Hostal Tababela Inn', 2, '1552321554-5fefe8c9ef14'),  -- antes 1520277739336-7bf67edfa768: repetida
  (1009, 'Departamento Samborondón', 1, '1612419299101-6c294dc2901d'),  -- antes 1554995207-c18c203602cb: repetida
  (1009, 'Departamento Samborondón', 2, '1556912172-45b7abe8b7e1'),  -- antes 1560448204-e02f11c3d0e2: repetida
  (1011, 'Hotel Mariscal Boutique', 1, '1592229505726-ca121723b8ef'),  -- antes 1702014859878-5d4743176d28: repetida
  (1011, 'Hotel Mariscal Boutique', 2, '1564540583246-934409427776'),  -- antes 1767324672977-3b051d4cdb88: piscina termal en hotel urbano de Quito / repetida
  (1012, 'Casa de Playa Salinas', 2, '1580587771525-78b9dba3b914'),  -- antes 1570129477492-45c003edd2be: casa estilo Nueva Inglaterra (otra región) / repetida
  (1013, 'Hotel Malecón Guayaquil', 1, '1590490359683-658d3d23f972'),  -- antes 1551882547-ff40c63fe5fa: resort con palmeras en zona andina / repetida
  (1013, 'Hotel Malecón Guayaquil', 2, '1596436889106-be35e843f974'),  -- antes 1564501049412-61c2a3083791: resort de playa repetido
  (1014, 'Loft El Barranco', 1, '1505873242700-f289a29e1e0f'),  -- antes 1560448204-e02f11c3d0e2: repetida
  (1015, 'Departamento La Carolina', 1, '1493663284031-b7e3aefcae8e'),  -- antes 1654506012740-09321c969dc2: repetida
  (1015, 'Departamento La Carolina', 2, '1502005097973-6a7082348e28'),  -- antes 1493809842364-78817add7ffb: repetida
  (1016, 'Hostal Guayaquil Norte', 1, '1522771739844-6a9f6d5f14af'),  -- antes 1505693416388-ac5ce068fe85: repetida
  (1016, 'Hostal Guayaquil Norte', 2, '1618220179428-22790b461013'),  -- antes 1631049307264-da0ec9d70304: repetida
  (1017, 'Cabañas Mindo Cloud Forest', 1, '1586375300773-8384e3e4916f'),  -- antes 1777913319909-1d27d36db93e: repetida
  (1017, 'Cabañas Mindo Cloud Forest', 2, '1617104678098-de229db51175'),  -- antes 1449158743715-0a90ebb6d2d8: cabaña de bosque de coníferas (otra región)
  (1018, 'Hotel Manta Playa', 2, '1561501900-3701fa6a0864'),  -- antes 1564501049412-61c2a3083791: resort de playa repetido
  (1019, 'Hostería Baños Termas', 1, '1512918728675-ed5a9ecdebfd'),  -- antes 1702014859878-5d4743176d28: repetida
  (1019, 'Hostería Baños Termas', 2, '1587874522487-fe10e954d035'),  -- antes 1542314831-068cd1dbfeeb: resort tropical en zona andina / repetida
  (1020, 'Hostal Otavalo Mercado', 1, '1615874959474-d609969a20ed'),  -- antes 1520277739336-7bf67edfa768: repetida
  (1020, 'Hostal Otavalo Mercado', 2, '1513161455079-7dc1de15ef3e'),  -- antes 1555854877-bab0e564b8d5: repetida
  (1022, 'Hotel Jardín La Floresta', 0, '1591088398332-8a7791972843'),  -- antes 1542314831-068cd1dbfeeb: resort tropical en zona andina / repetida
  (1022, 'Hotel Jardín La Floresta', 1, '1540518614846-7eded433c457'),  -- antes 1590490360182-c33d57733427: repetida
  (1022, 'Hotel Jardín La Floresta', 2, '1618773928121-c32242e63f39'),  -- antes 1702014859878-5d4743176d28: repetida
  (1023, 'Departamento Puerto Santa Ana', 1, '1568495248636-6432b97bd949'),  -- antes 1665249934445-1de680641f50: repetida
  (1023, 'Departamento Puerto Santa Ana', 2, '1565183997392-2f6f122e5912'),  -- antes 1654506012740-09321c969dc2: repetida
  (1024, 'Casa Tomebamba', 0, '1416331108676-a22ccb276e35'),  -- antes 1570129477492-45c003edd2be: casa estilo Nueva Inglaterra (otra región) / repetida
  (1024, 'Casa Tomebamba', 1, '1618221195710-dd6b41faaea6'),  -- antes 1773137159005-f0ecd1201f01: claustro monumental (edificio público)
  (1024, 'Casa Tomebamba', 2, '1507089947368-19c1da9775ae'),  -- antes 1721369483526-62f48a00b949: vista al mar en zona andina / repetida
  (1025, 'Cabañas Río Pastaza', 0, '1590725140246-20acdee442be'),  -- antes 1587061949409-02df41d5e562: cabaña de bosque de coníferas (otra región)
  (1025, 'Cabañas Río Pastaza', 1, '1600210492493-0946911123ea'),  -- antes 1767334573989-ffa2720523b2: repetida
  (1025, 'Cabañas Río Pastaza', 2, '1571508601891-ca5e7a713859'),  -- antes 1777913319909-1d27d36db93e: repetida
  (1026, 'Hostal Ficoa Ambato', 1, '1505692952047-1a78307da8f2'),  -- antes 1631049307264-da0ec9d70304: repetida
  (1026, 'Hostal Ficoa Ambato', 2, '1616594039964-ae9021a400a0'),  -- antes 1725962479542-1be0a6b0d444: repetida
  (1027, 'Hotel Chimborazo Centro', 1, '1631049552057-403cdb8f0658'),  -- antes 1767324672977-3b051d4cdb88: piscina termal en hotel urbano de Quito / repetida
  (1027, 'Hotel Chimborazo Centro', 2, '1617098900591-3f90928e8c54'),  -- antes 1542314831-068cd1dbfeeb: resort tropical en zona andina / repetida
  (1028, 'Departamento Jipiro Loja', 1, '1484101403633-562f891dc89a'),  -- antes 1493809842364-78817add7ffb: repetida
  (1028, 'Departamento Jipiro Loja', 2, '1549638441-b787d2e11f14'),  -- antes 1502672260266-1c1ef2d93688: repetida
  (1029, 'Cabañas Amazonía Tena', 0, '1774280954999-9758f11f3d41'),  -- antes 1566073771259-6a8506099945: lodge junto al mar en la Amazonía (se reubica a Galápagos)
  (1029, 'Cabañas Amazonía Tena', 1, '1507652313519-d4e9174996dd'),  -- antes 1449158743715-0a90ebb6d2d8: cabaña de bosque de coníferas (otra región)
  (1029, 'Cabañas Amazonía Tena', 2, '1611892440504-42a792e24d32'),  -- antes 1587061949409-02df41d5e562: cabaña de bosque de coníferas (otra región)
  (1030, 'Hostal Surf Montañita', 1, '1520483601560-389dff434fdf'),  -- antes 1520277739336-7bf67edfa768: repetida
  (1030, 'Hostal Surf Montañita', 2, '1595526114035-0d45ed16cfbf'),  -- antes 1595576508898-0ad5c879a061: repetida
  (1031, 'Casa Yahuarcocha', 1, '1616486338812-3dadae4b4ace'),  -- antes 1582719478250-c89cae4dc85b: repetida
  (1031, 'Casa Yahuarcocha', 2, '1601760562234-9814eea6663a')   -- antes 1564013799919-ab600027ffc6: casa con palmeras en Ibarra / repetida
       ) AS f(codigo, nombre, orden, foto)
 WHERE a.id = i.alojamiento_id
   AND a.codigo = f.codigo
   AND a.nombre = f.nombre
   AND i.orden = f.orden
   AND i.url IS DISTINCT FROM 'https://images.unsplash.com/photo-' || f.foto || '?w=800&q=75';

COMMIT;

-- Comprobación (debe devolver 0 filas): fotos repetidas entre alojamientos
SELECT url, count(DISTINCT alojamiento_id) AS alojamientos
  FROM imagen_alojamiento GROUP BY url HAVING count(DISTINCT alojamiento_id) > 1;
