-- =====================================================================
--  Actualiza las fotos de los 20 alojamientos demo en una BD ya cargada
--  (antes: picsum.photos aleatorias; ahora: Unsplash según tipo y ciudad).
--  Solo UPDATE de la URL por (nombre del alojamiento, orden); no crea ni borra filas.
--  Idempotente: se puede ejecutar varias veces. Mismo listado que 02_datos_demo.sql.
--  Fuente: Unsplash (https://unsplash.com/license).
-- =====================================================================
SET search_path = booking, public;

BEGIN;

UPDATE imagen_alojamiento i
   SET url = 'https://images.unsplash.com/photo-' || f.foto || '?w=800&q=75'
  FROM alojamiento a,
       (VALUES
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
       ) AS f(nombre, orden, foto)
 WHERE a.id = i.alojamiento_id
   AND a.nombre = f.nombre
   AND i.orden = f.orden;

COMMIT;

-- Comprobación: cuántas fotos de los demo siguen en picsum (debe ser 0)
SELECT count(*) AS fotos_picsum_restantes
  FROM imagen_alojamiento i JOIN alojamiento a ON a.id = i.alojamiento_id
 WHERE i.url LIKE 'https://picsum.photos/%';
