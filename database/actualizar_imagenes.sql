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
  ('Hotel Mariscal Boutique',0,'1590490360182-c33d57733427'),('Hotel Mariscal Boutique',1,'1702014859878-5d4743176d28'),('Hotel Mariscal Boutique',2,'1767324672977-3b051d4cdb88'),
  ('Departamento La Carolina',0,'1665249934445-1de680641f50'),('Departamento La Carolina',1,'1654506012740-09321c969dc2'),('Departamento La Carolina',2,'1493809842364-78817add7ffb'),
  ('Hostal Tababela Inn',0,'1631049307264-da0ec9d70304'),('Hostal Tababela Inn',1,'1725962479542-1be0a6b0d444'),('Hostal Tababela Inn',2,'1520277739336-7bf67edfa768'),
  ('Suite Latacunga Cotopaxi View',0,'1560448204-e02f11c3d0e2'),('Suite Latacunga Cotopaxi View',1,'1493809842364-78817add7ffb'),('Suite Latacunga Cotopaxi View',2,'1502672260266-1c1ef2d93688'),
  ('Casa Colonial Centro Histórico',0,'1773137159005-f0ecd1201f01'),('Casa Colonial Centro Histórico',1,'1721369483526-62f48a00b949'),('Casa Colonial Centro Histórico',2,'1582719478250-c89cae4dc85b'),
  ('Cabañas Mindo Cloud Forest',0,'1767334573989-ffa2720523b2'),('Cabañas Mindo Cloud Forest',1,'1777913319909-1d27d36db93e'),('Cabañas Mindo Cloud Forest',2,'1449158743715-0a90ebb6d2d8'),
  ('Hotel Quito Tababela Plaza',0,'1702014859878-5d4743176d28'),('Hotel Quito Tababela Plaza',1,'1542314831-068cd1dbfeeb'),('Hotel Quito Tababela Plaza',2,'1551882547-ff40c63fe5fa'),
  ('Hostal Otavalo Mercado',0,'1595576508898-0ad5c879a061'),('Hostal Otavalo Mercado',1,'1520277739336-7bf67edfa768'),('Hostal Otavalo Mercado',2,'1555854877-bab0e564b8d5'),
  ('Hotel Malecón Guayaquil',0,'1571896349842-33c89424de2d'),('Hotel Malecón Guayaquil',1,'1551882547-ff40c63fe5fa'),('Hotel Malecón Guayaquil',2,'1564501049412-61c2a3083791'),
  ('Departamento Samborondón',0,'1654506012740-09321c969dc2'),('Departamento Samborondón',1,'1554995207-c18c203602cb'),('Departamento Samborondón',2,'1560448204-e02f11c3d0e2'),
  ('Hostal Guayaquil Norte',0,'1725962479542-1be0a6b0d444'),('Hostal Guayaquil Norte',1,'1505693416388-ac5ce068fe85'),('Hostal Guayaquil Norte',2,'1631049307264-da0ec9d70304'),
  ('Casa de Playa Salinas',0,'1721369483526-62f48a00b949'),('Casa de Playa Salinas',1,'1564013799919-ab600027ffc6'),('Casa de Playa Salinas',2,'1570129477492-45c003edd2be'),
  ('Hotel Casa del Parque Cuenca',0,'1590381105924-c72589b9ef3f'),('Hotel Casa del Parque Cuenca',1,'1571896349842-33c89424de2d'),('Hotel Casa del Parque Cuenca',2,'1631049035182-249067d7618e'),
  ('Loft El Barranco',0,'1586023492125-27b2c045efd7'),('Loft El Barranco',1,'1560448204-e02f11c3d0e2'),('Loft El Barranco',2,'1556020685-ae41abfc9365'),
  ('Habitación Privada Centro Cuenca',0,'1582719478250-c89cae4dc85b'),('Habitación Privada Centro Cuenca',1,'1580587771525-78b9dba3b914'),('Habitación Privada Centro Cuenca',2,'1512917774080-9991f1c4c750'),
  ('Cabaña Vilcabamba Valle Sagrado',0,'1777913319909-1d27d36db93e'),('Cabaña Vilcabamba Valle Sagrado',1,'1587061949409-02df41d5e562'),('Cabaña Vilcabamba Valle Sagrado',2,'1510798831971-661eb04b3739'),
  ('Hotel Galápagos Puerto Ayora',0,'1564501049412-61c2a3083791'),('Hotel Galápagos Puerto Ayora',1,'1578683010236-d716f9a3f461'),('Hotel Galápagos Puerto Ayora',2,'1590490360182-c33d57733427'),
  ('Casa Isabela Backpackers',0,'1520277739336-7bf67edfa768'),('Casa Isabela Backpackers',1,'1725962479542-1be0a6b0d444'),('Casa Isabela Backpackers',2,'1555854877-bab0e564b8d5'),
  ('Hostería Baños Termas',0,'1767324672977-3b051d4cdb88'),('Hostería Baños Termas',1,'1702014859878-5d4743176d28'),('Hostería Baños Termas',2,'1542314831-068cd1dbfeeb'),
  ('Hotel Manta Playa',0,'1551882547-ff40c63fe5fa'),('Hotel Manta Playa',1,'1542314831-068cd1dbfeeb'),('Hotel Manta Playa',2,'1564501049412-61c2a3083791'),
  -- datos_catalogo_extra.sql
  ('Hotel Jardín La Floresta',0,'1542314831-068cd1dbfeeb'),('Hotel Jardín La Floresta',1,'1590490360182-c33d57733427'),('Hotel Jardín La Floresta',2,'1702014859878-5d4743176d28'),
  ('Departamento Puerto Santa Ana',0,'1554995207-c18c203602cb'),('Departamento Puerto Santa Ana',1,'1665249934445-1de680641f50'),('Departamento Puerto Santa Ana',2,'1654506012740-09321c969dc2'),
  ('Casa Tomebamba',0,'1570129477492-45c003edd2be'),('Casa Tomebamba',1,'1773137159005-f0ecd1201f01'),('Casa Tomebamba',2,'1721369483526-62f48a00b949'),
  ('Cabañas Río Pastaza',0,'1587061949409-02df41d5e562'),('Cabañas Río Pastaza',1,'1767334573989-ffa2720523b2'),('Cabañas Río Pastaza',2,'1777913319909-1d27d36db93e'),
  ('Hostal Ficoa Ambato',0,'1505693416388-ac5ce068fe85'),('Hostal Ficoa Ambato',1,'1631049307264-da0ec9d70304'),('Hostal Ficoa Ambato',2,'1725962479542-1be0a6b0d444'),
  ('Hotel Chimborazo Centro',0,'1578683010236-d716f9a3f461'),('Hotel Chimborazo Centro',1,'1767324672977-3b051d4cdb88'),('Hotel Chimborazo Centro',2,'1542314831-068cd1dbfeeb'),
  ('Departamento Jipiro Loja',0,'1522708323590-d24dbb6b0267'),('Departamento Jipiro Loja',1,'1493809842364-78817add7ffb'),('Departamento Jipiro Loja',2,'1502672260266-1c1ef2d93688'),
  ('Cabañas Amazonía Tena',0,'1566073771259-6a8506099945'),('Cabañas Amazonía Tena',1,'1449158743715-0a90ebb6d2d8'),('Cabañas Amazonía Tena',2,'1587061949409-02df41d5e562'),
  ('Hostal Surf Montañita',0,'1555854877-bab0e564b8d5'),('Hostal Surf Montañita',1,'1520277739336-7bf67edfa768'),('Hostal Surf Montañita',2,'1595576508898-0ad5c879a061'),
  ('Casa Yahuarcocha',0,'1568605114967-8130f3a36994'),('Casa Yahuarcocha',1,'1582719478250-c89cae4dc85b'),('Casa Yahuarcocha',2,'1564013799919-ab600027ffc6')
       ) AS f(nombre, orden, foto)
 WHERE a.id = i.alojamiento_id
   AND a.nombre = f.nombre
   AND i.orden = f.orden
   AND i.url IS DISTINCT FROM 'https://images.unsplash.com/photo-' || f.foto || '?w=800&q=75';

COMMIT;
