-- =====================================================================
--  MIGRACIÓN: código público del alojamiento -> columna alojamiento.codigo
--  Para BDs creadas con la versión anterior (tabla 1 a 1 "alojamiento_codigo", 29 tablas).
--  Resultado: 28 tablas; los códigos existentes NO cambian; los nuevos siguen después del mayor.
--
--  Idempotente: si ya está migrada, no cambia nada (solo vuelve a escribir los comentarios de tabla).
--  Todo ocurre en UNA transacción: si algo falla, no queda nada a medias.
--  Uso (Docker):  Get-Content database\migracion_codigo_en_alojamiento.sql -Raw |
--                   docker exec -i booking_db_container psql -U postgres -d booking_db -v ON_ERROR_STOP=1
-- =====================================================================
BEGIN;
SET LOCAL search_path = booking, public;

DO $$
DECLARE
  tiene_columna boolean := EXISTS (SELECT 1 FROM information_schema.columns
                                    WHERE table_schema = 'booking' AND table_name = 'alojamiento' AND column_name = 'codigo');
  tiene_tabla   boolean := to_regclass('booking.alojamiento_codigo') IS NOT NULL;
  v_siguiente   integer;
  v_secuencia   bigint;
BEGIN
  IF tiene_columna AND NOT tiene_tabla THEN
    RAISE NOTICE 'Migración ya aplicada: alojamiento.codigo existe y alojamiento_codigo no. No se cambia nada.';
    RETURN;
  END IF;
  IF NOT tiene_tabla THEN
    RAISE EXCEPTION 'No existe alojamiento_codigo ni alojamiento.codigo: crea la BD con 01, 02 y 03.';
  END IF;

  -- 1) Columna nueva con los MISMOS códigos que ya tenía cada alojamiento
  IF NOT tiene_columna THEN
    ALTER TABLE alojamiento ADD COLUMN codigo integer;
  END IF;
  -- (sin tocar updated_at: es un cambio de estructura, no una edición del anfitrión)
  ALTER TABLE alojamiento DISABLE TRIGGER trg_alojamiento_upd;
  UPDATE alojamiento a SET codigo = ac.codigo FROM alojamiento_codigo ac WHERE ac.alojamiento_id = a.id;
  ALTER TABLE alojamiento ENABLE TRIGGER trg_alojamiento_upd;
  IF EXISTS (SELECT 1 FROM alojamiento WHERE codigo IS NULL) THEN
    RAISE EXCEPTION 'Hay alojamientos sin código en alojamiento_codigo; revisa los datos antes de migrar.';
  END IF;
  ALTER TABLE alojamiento ALTER COLUMN codigo SET NOT NULL;

  -- 2) Identity que continúa después del mayor código usado (ni reutiliza ni salta hacia atrás)
  SELECT last_value INTO v_secuencia FROM alojamiento_codigo_codigo_seq;
  SELECT GREATEST(COALESCE(max(codigo), 1000), COALESCE(v_secuencia, 1000)) + 1 INTO v_siguiente FROM alojamiento;
  EXECUTE format('ALTER TABLE alojamiento ALTER COLUMN codigo ADD GENERATED ALWAYS AS IDENTITY (START WITH %s)', v_siguiente);
  ALTER TABLE alojamiento ADD CONSTRAINT uq_alojamiento_codigo UNIQUE (codigo);

  -- 3) Quitar la tabla vieja y lo que depende de ella
  DROP VIEW IF EXISTS v_orden;
  DROP TRIGGER IF EXISTS trg_alojamiento_codigo ON alojamiento;
  DROP FUNCTION IF EXISTS tg_alojamiento_codigo();
  DROP TABLE alojamiento_codigo;      -- sin CASCADE: si algo más dependiera de ella, falla y no se borra nada

  -- 4) v_orden con el código leído directamente de alojamiento (misma definición que 03_integracion.sql)
  CREATE VIEW v_orden AS
  SELECT r.id AS order_id, r.codigo AS locator,
         CASE r.estado WHEN 'CONFIRMADA' THEN 'CONFIRMED' WHEN 'COMPLETADA' THEN 'CONFIRMED' WHEN 'PENDIENTE' THEN 'PENDING' ELSE 'CANCELLED' END AS status,
         r.estado AS estado_interno, r.huesped_id AS owner_id,
         a.codigo AS accommodation_id, a.nombre AS accommodation_name, r.fecha_entrada AS checkin, r.fecha_salida AS checkout,
         r.num_huespedes AS guests, t.total AS total_price, 'USD'::char(3) AS currency, r.created_at AS creation_date
  FROM reserva r
  JOIN alojamiento a ON a.id = r.alojamiento_id
  JOIN v_reserva_total t ON t.reserva_id = r.id;

  RAISE NOTICE 'Migración aplicada: % alojamientos con código; el próximo código será %.',
    (SELECT count(*) FROM alojamiento), v_siguiente;
END $$;

-- Documentación de las 28 tablas (mismo texto que en 01 y 03)
COMMENT ON TABLE usuario                    IS 'Cuentas de personas (huésped y/o anfitrión) y administradores: datos de acceso y, opcionalmente, de facturación.';
COMMENT ON TABLE token_usuario              IS 'Tokens de un solo uso (recuperar clave, verificar correo): solo se guarda su hash SHA-256 y su vencimiento.';
COMMENT ON TABLE ciudad                     IS 'Localidades donde hay alojamientos (provincia, nombre y coordenadas); sirven para buscar y filtrar.';
COMMENT ON TABLE aeropuerto                 IS 'Aeropuertos del país (código IATA y ubicación) para el filtro "cerca del aeropuerto".';
COMMENT ON TABLE tipo_alojamiento           IS 'Catálogo de tipos de alojamiento (Hotel, Hostal, Cabaña, etc.).';
COMMENT ON TABLE amenidad                   IS 'Catálogo de comodidades que puede ofrecer un alojamiento, agrupadas por categoría.';
COMMENT ON TABLE politica_cancelacion       IS 'Políticas de cancelación (FLEXIBLE, MODERADA, NO_REEMBOLSABLE) con el texto que ve el huésped.';
COMMENT ON TABLE politica_cancelacion_regla IS 'Tramos de cada política: horas mínimas de anticipación y porcentaje de penalidad que se cobra.';
COMMENT ON TABLE impuesto_tarifa            IS 'Tarifas de IVA y cargo de servicio con vigencia (incluye el IVA reducido de feriados que registra el administrador).';
COMMENT ON TABLE alojamiento                IS 'Anuncio de un anfitrión: datos, ubicación, reglas, política y estado; "codigo" es su identificador público entero.';
COMMENT ON TABLE unidad_alojamiento         IS 'Lo que se reserva dentro de un alojamiento: un tipo de habitación (con cantidad) o la propiedad completa, con precio base.';
COMMENT ON TABLE calendario_unidad          IS 'Excepciones diarias de una unidad: precio especial y/o cantidad a la venta (0 = cerrada ese día).';
COMMENT ON TABLE alojamiento_aeropuerto     IS 'Aeropuertos cercanos a cada alojamiento, con distancia por carretera, tiempo y si ofrece transfer.';
COMMENT ON TABLE alojamiento_amenidad       IS 'Qué amenidades tiene cada alojamiento (tabla puente).';
COMMENT ON TABLE imagen_alojamiento         IS 'Fotos de cada alojamiento (URL) con su orden de presentación y una sola portada.';
COMMENT ON TABLE reserva                    IS 'Cabecera de cada reserva: huésped, alojamiento, fechas, número de huéspedes, política aceptada y estado.';
COMMENT ON TABLE reserva_detalle            IS 'Líneas de la reserva: qué unidades y cuántas, con los montos acordados ese día (hospedaje, servicio, IVA).';
COMMENT ON TABLE cancelacion                IS 'Cancelación de una reserva (quién, cuándo y por qué); la penalidad y el reembolso se calculan en una vista.';
COMMENT ON TABLE pago                       IS 'Movimientos de dinero simulados de una reserva: cobros y reembolsos.';
COMMENT ON TABLE factura                    IS 'Factura simulada de una reserva con copia de los datos del comprador; los totales salen de la vista v_factura.';
COMMENT ON TABLE resena                     IS 'Calificación (1 a 10) y comentario del huésped tras una estancia completada, con respuesta opcional del anfitrión.';
COMMENT ON TABLE reporte                    IS 'Denuncias sobre un alojamiento o sobre otro usuario, y su resolución por un administrador.';
COMMENT ON TABLE evento_outbox              IS 'Eventos de negocio (outbox) escritos en la misma transacción que el cambio, para publicarlos y trazar cada flujo.';
COMMENT ON TABLE orden_preview              IS 'Cotización congelada 15 minutos entre /orders/preview y /orders/create; permite detectar cambios de precio.';
COMMENT ON TABLE idempotencia               IS 'Respuestas guardadas por Idempotency-Key para no duplicar crear, modificar o cancelar una orden.';
COMMENT ON TABLE webhook_suscripcion        IS 'Suscripciones de terceros a webhooks: URL de destino, secreto de firma y si está activa.';
COMMENT ON TABLE webhook_evento             IS 'Eventos a los que está suscrita cada suscripción (ORDER_CONFIRMED, ORDER_CANCELLED).';
COMMENT ON TABLE webhook_entrega            IS 'Cola de entregas de webhooks por evento y suscripción, con intentos y estado (la entrega real es del Reto 2).';

COMMIT;
