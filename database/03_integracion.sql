-- =====================================================================
--  BOOKING PROTOTIPO - Extensión de integración v3.2  (ejecutar DESPUÉS de 01 y 02)
--  Soporta el contrato "GDS Alojamientos Core API" (backend/contracts/alojamientos-openapi.yaml):
--    * preview de orden con precio cotizado  (/orders/preview -> /orders/create, error PRICE_CHANGED)
--    * Idempotency-Key obligatoria en crear / modificar / cancelar
--    * modificación de una reserva (/orders/{id}/modify)
--    * suscripciones a webhooks (ORDER_CONFIRMED, ORDER_CANCELLED) con entrega a prueba de reintentos
--  El código público ENTERO del alojamiento es la columna alojamiento.codigo (definida en 01).
--  Es ADITIVO: no modifica ninguna tabla ni función de 01. Se puede re-ejecutar solo.
--  Agrega 5 tablas (total 27), todas con clave simple; los totales siguen calculándose en vistas.
-- =====================================================================
SET search_path = booking, public;

-- BD creada con la versión anterior (tabla alojamiento_codigo): primero hay que migrarla
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'booking' AND table_name = 'alojamiento' AND column_name = 'codigo') THEN
    RAISE EXCEPTION 'Falta la columna alojamiento.codigo: ejecuta primero database/migracion_codigo_en_alojamiento.sql';
  END IF;
END $$;

-- Limpieza para poder re-ejecutar este script por sí solo
DROP VIEW  IF EXISTS v_orden;
DROP TABLE IF EXISTS webhook_entrega, webhook_evento, webhook_suscripcion, idempotencia, orden_preview CASCADE;
DROP TYPE  IF EXISTS tipo_webhook_evento;
DROP TRIGGER IF EXISTS trg_outbox_webhooks ON evento_outbox;
DROP FUNCTION IF EXISTS tg_outbox_webhooks(), fn_cotizar(uuid,date,date,int),
  fn_crear_preview(uuid,uuid,date,date,smallint,int), fn_crear_orden(uuid,uuid), fn_modificar_reserva(uuid,uuid,date,date,smallint);

CREATE TYPE tipo_webhook_evento AS ENUM ('ORDER_CONFIRMED','ORDER_CANCELLED');

-- ---------------------------------------------------------------------
-- 1. Código público entero del alojamiento: ahora es la columna alojamiento.codigo
--    (identity desde 1001, única), definida en 01_esquema.sql. Ya no hay tabla aparte.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 2. Cotización y preview de orden
-- ---------------------------------------------------------------------
-- Desglose completo de una unidad (mismos cálculos que usa fn_crear_reserva)
CREATE FUNCTION fn_cotizar(p_unidad uuid, p_entrada date, p_salida date, p_cantidad int)
RETURNS TABLE (subtotal numeric, servicio numeric, iva numeric, limpieza numeric, iva_limpieza numeric,
               total numeric, cupo integer) LANGUAGE sql STABLE AS $$
  SELECT c.subtotal, c.servicio, c.iva + il.v, a.tarifa_limpieza, il.v,
         c.subtotal + c.servicio + c.iva + a.tarifa_limpieza + il.v,
         fn_cupo_unidad(u.id, p_entrada, p_salida)
  FROM unidad_alojamiento u
  JOIN alojamiento a ON a.id = u.alojamiento_id
  CROSS JOIN LATERAL fn_calcular_linea(u.id, p_entrada, p_salida, p_cantidad) c
  CROSS JOIN LATERAL (SELECT round(a.tarifa_limpieza * COALESCE(fn_iva_pct(a.id, p_entrada), 0) / 100, 2) AS v) il
  WHERE u.id = p_unidad $$;

-- Precio congelado por 15 minutos entre /orders/preview y /orders/create
CREATE TABLE orden_preview (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id     uuid NOT NULL REFERENCES usuario(id),
  unidad_id      uuid NOT NULL REFERENCES unidad_alojamiento(id),
  fecha_entrada  date NOT NULL,
  fecha_salida   date NOT NULL,
  num_huespedes  smallint NOT NULL,
  cantidad       smallint NOT NULL DEFAULT 1,
  total_cotizado numeric(12,2) NOT NULL,
  moneda         char(3) NOT NULL DEFAULT 'USD',
  creado_en      timestamptz NOT NULL DEFAULT now(),
  expira_en      timestamptz NOT NULL DEFAULT now() + interval '15 minutes',
  reserva_id     uuid UNIQUE REFERENCES reserva(id),      -- se llena al crear la orden
  CONSTRAINT ck_preview_fechas CHECK (fecha_salida > fecha_entrada),
  CONSTRAINT ck_preview_cant   CHECK (cantidad >= 1 AND num_huespedes >= 1),
  CONSTRAINT ck_preview_moneda CHECK (moneda = 'USD')
);
CREATE INDEX ix_preview_usuario ON orden_preview (usuario_id, creado_en DESC);

CREATE FUNCTION fn_crear_preview(p_usuario uuid, p_unidad uuid, p_entrada date, p_salida date,
                                 p_huespedes smallint, p_cantidad int DEFAULT 1)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid; q record; u unidad_alojamiento%ROWTYPE;
BEGIN
  IF p_salida <= p_entrada THEN RAISE EXCEPTION 'FECHAS_INVALIDAS: la salida debe ser posterior a la entrada'; END IF;
  SELECT * INTO u FROM unidad_alojamiento WHERE id = p_unidad AND activa;
  IF NOT FOUND THEN RAISE EXCEPTION 'UNIDAD_INACTIVA: la unidad no existe o no está disponible'; END IF;
  SELECT * INTO q FROM fn_cotizar(p_unidad, p_entrada, p_salida, p_cantidad);
  IF q.cupo < p_cantidad THEN RAISE EXCEPTION 'SIN_DISPONIBILIDAD: no hay cupo para esas fechas'; END IF;
  IF u.capacidad_huespedes * p_cantidad < p_huespedes THEN
    RAISE EXCEPTION 'CAPACIDAD_EXCEDIDA: las unidades alojan máximo % huéspedes', u.capacidad_huespedes * p_cantidad;
  END IF;
  INSERT INTO orden_preview (usuario_id, unidad_id, fecha_entrada, fecha_salida, num_huespedes, cantidad, total_cotizado)
  VALUES (p_usuario, p_unidad, p_entrada, p_salida, p_huespedes, p_cantidad, q.total) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- Crea la reserva a partir de un preview vigente (si el precio cambió: PRECIO_CAMBIO -> PRICE_CHANGED)
CREATE FUNCTION fn_crear_orden(p_preview uuid, p_usuario uuid) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE p orden_preview%ROWTYPE; v_total numeric; v_aloj uuid; v_res uuid;
BEGIN
  SELECT * INTO p FROM orden_preview WHERE id = p_preview FOR UPDATE;
  IF NOT FOUND OR p.usuario_id <> p_usuario THEN RAISE EXCEPTION 'PREVIEW_NO_EXISTE: la previsualización no existe'; END IF;
  IF p.reserva_id IS NOT NULL THEN RETURN p.reserva_id; END IF;          -- reintento: devuelve la misma orden
  IF p.expira_en < now() THEN RAISE EXCEPTION 'PREVIEW_EXPIRADO: la previsualización expiró, vuelve a cotizar'; END IF;
  SELECT total INTO v_total FROM fn_cotizar(p.unidad_id, p.fecha_entrada, p.fecha_salida, p.cantidad);
  IF v_total <> p.total_cotizado THEN RAISE EXCEPTION 'PRECIO_CAMBIO: el precio cambió de % a %', p.total_cotizado, v_total; END IF;
  SELECT alojamiento_id INTO v_aloj FROM unidad_alojamiento WHERE id = p.unidad_id;
  v_res := fn_crear_reserva(p_usuario, v_aloj, p.fecha_entrada, p.fecha_salida, p.num_huespedes,
                            jsonb_build_array(jsonb_build_object('unidad_id', p.unidad_id, 'cantidad', p.cantidad)));
  UPDATE orden_preview SET reserva_id = v_res WHERE id = p.id;
  RETURN v_res;
END $$;

-- ---------------------------------------------------------------------
-- 3. Idempotencia (Idempotency-Key obligatoria en crear / modificar / cancelar)
-- ---------------------------------------------------------------------
CREATE TABLE idempotencia (
  propietario   varchar(80)  NOT NULL,          -- sub del JWT
  clave         uuid         NOT NULL,          -- cabecera Idempotency-Key
  operacion     varchar(40)  NOT NULL,          -- p. ej. 'orders.create'
  hash_solicitud char(64)    NOT NULL,          -- SHA-256 del cuerpo: misma clave + otro cuerpo = conflicto
  estado_http   smallint,                       -- NULL mientras se procesa
  respuesta     jsonb,
  creado_en     timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (propietario, clave)
);
CREATE INDEX ix_idempotencia_creado ON idempotencia (creado_en);

-- ---------------------------------------------------------------------
-- 4. Modificación de una reserva (fechas y/o número de huéspedes), sin penalidad
-- ---------------------------------------------------------------------
CREATE FUNCTION fn_modificar_reserva(p_reserva uuid, p_usuario uuid, p_entrada date, p_salida date,
                                     p_huespedes smallint DEFAULT NULL)
RETURNS TABLE (total_anterior numeric, total_nuevo numeric) LANGUAGE plpgsql AS $$
DECLARE r reserva%ROWTYPE; a alojamiento%ROWTYPE; v_lineas jsonb; v_ant numeric; v_nue numeric;
        v_hoy date := (now() AT TIME ZONE 'America/Guayaquil')::date; v_cap int; v_huesp smallint; l record; v_dif numeric;
BEGIN
  SELECT * INTO r FROM reserva WHERE id = p_reserva FOR UPDATE;
  IF NOT FOUND OR r.huesped_id <> p_usuario THEN RAISE EXCEPTION 'RESERVA_NO_EXISTE: la reserva no existe'; END IF;
  IF r.estado NOT IN ('PENDIENTE','CONFIRMADA') THEN RAISE EXCEPTION 'MODIFICACION_NO_PERMITIDA: solo se modifican reservas pendientes o confirmadas'; END IF;
  IF r.fecha_entrada <= v_hoy THEN RAISE EXCEPTION 'MODIFICACION_NO_PERMITIDA: la estancia ya inició o inicia hoy'; END IF;
  p_entrada := COALESCE(p_entrada, r.fecha_entrada); p_salida := COALESCE(p_salida, r.fecha_salida);
  v_huesp := COALESCE(p_huespedes, r.num_huespedes);
  IF p_salida <= p_entrada THEN RAISE EXCEPTION 'FECHAS_INVALIDAS: la salida debe ser posterior a la entrada'; END IF;
  IF p_entrada < v_hoy THEN RAISE EXCEPTION 'FECHA_PASADA: la entrada no puede estar en el pasado'; END IF;
  SELECT * INTO a FROM alojamiento WHERE id = r.alojamiento_id;
  IF (p_salida - p_entrada) < a.noches_min OR (p_salida - p_entrada) > a.noches_max THEN
    RAISE EXCEPTION 'ESTANCIA_INVALIDA: noches permitidas entre % y %', a.noches_min, a.noches_max;
  END IF;

  PERFORM 1 FROM unidad_alojamiento u WHERE u.id IN (SELECT unidad_id FROM reserva_detalle WHERE reserva_id = p_reserva) FOR UPDATE;
  SELECT total INTO v_ant FROM v_reserva_total WHERE reserva_id = p_reserva;
  SELECT jsonb_agg(jsonb_build_object('unidad_id', unidad_id, 'cantidad', cantidad)) INTO v_lineas
    FROM reserva_detalle WHERE reserva_id = p_reserva;

  DELETE FROM reserva_detalle WHERE reserva_id = p_reserva;     -- libera el cupo propio antes de validar el nuevo
  UPDATE reserva SET fecha_entrada = p_entrada, fecha_salida = p_salida, num_huespedes = v_huesp,
         iva_limpieza = round(tarifa_limpieza_aplicada * COALESCE(fn_iva_pct(r.alojamiento_id, p_entrada), 0) / 100, 2)
   WHERE id = p_reserva;
  FOR l IN SELECT x.unidad_id, x.cantidad FROM jsonb_to_recordset(v_lineas) x(unidad_id uuid, cantidad int) LOOP
    INSERT INTO reserva_detalle (reserva_id, unidad_id, cantidad, subtotal_alojamiento, servicio_monto, iva_monto)
    SELECT p_reserva, l.unidad_id, l.cantidad, c.subtotal, c.servicio, c.iva
      FROM fn_calcular_linea(l.unidad_id, p_entrada, p_salida, l.cantidad) c;     -- el trigger valida el cupo
  END LOOP;
  SELECT COALESCE(sum(u.capacidad_huespedes * d.cantidad), 0) INTO v_cap
    FROM reserva_detalle d JOIN unidad_alojamiento u ON u.id = d.unidad_id WHERE d.reserva_id = p_reserva;
  IF v_cap < v_huesp THEN RAISE EXCEPTION 'CAPACIDAD_EXCEDIDA: las unidades reservadas alojan máximo % huéspedes', v_cap; END IF;

  SELECT total INTO v_nue FROM v_reserva_total WHERE reserva_id = p_reserva;
  IF r.estado = 'CONFIRMADA' THEN                                -- ajusta el cobro simulado (la factura toma los totales de la vista)
    v_dif := v_nue - COALESCE((SELECT sum(CASE tipo WHEN 'COBRO' THEN monto ELSE -monto END) FROM pago
                                WHERE reserva_id = p_reserva AND estado = 'APROBADO'), 0);
    IF v_dif > 0 THEN INSERT INTO pago (reserva_id, tipo, monto, referencia) VALUES (p_reserva, 'COBRO', v_dif, 'SIM-MOD-' || r.codigo);
    ELSIF v_dif < 0 THEN INSERT INTO pago (reserva_id, tipo, monto, referencia) VALUES (p_reserva, 'REEMBOLSO', -v_dif, 'REF-MOD-' || r.codigo);
    END IF;
  END IF;
  PERFORM fn_emitir_evento('ReservaModificada', 'Reserva', p_reserva, p_reserva, jsonb_build_object(
    'reservaId', p_reserva, 'codigo', r.codigo, 'entrada', p_entrada, 'salida', p_salida,
    'huespedes', v_huesp, 'totalAnterior', v_ant, 'totalNuevo', v_nue));
  RETURN QUERY SELECT v_ant, v_nue;
END $$;

-- ---------------------------------------------------------------------
-- 5. Webhooks: suscripciones y entregas (las alimenta el outbox)
-- ---------------------------------------------------------------------
CREATE TABLE webhook_suscripcion (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  propietario varchar(80) NOT NULL,                 -- sub del JWT que la creó
  url         text        NOT NULL,
  secreto     text        NOT NULL,                 -- clave HMAC-SHA256 con que se firma cada entrega
  activa      boolean     NOT NULL DEFAULT true,
  creado_en   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_webhook_url CHECK (url ~ '^https?://[^\s]+$')
);
CREATE TABLE webhook_evento (                        -- eventos a los que está suscrita (tabla de unión binaria, sin arreglos)
  suscripcion_id uuid NOT NULL REFERENCES webhook_suscripcion(id) ON DELETE CASCADE,
  evento         tipo_webhook_evento NOT NULL,
  PRIMARY KEY (suscripcion_id, evento)
);
CREATE TABLE webhook_entrega (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  suscripcion_id  uuid   NOT NULL REFERENCES webhook_suscripcion(id) ON DELETE CASCADE,
  evento_id       bigint NOT NULL REFERENCES evento_outbox(id),
  estado          varchar(10) NOT NULL DEFAULT 'PENDIENTE',
  intentos        smallint NOT NULL DEFAULT 0,
  proximo_intento timestamptz NOT NULL DEFAULT now(),
  ultimo_error    text,
  entregado_en    timestamptz,
  CONSTRAINT uq_entrega UNIQUE (suscripcion_id, evento_id),      -- una entrega por evento y suscripción (idempotente)
  CONSTRAINT ck_entrega_estado CHECK (estado IN ('PENDIENTE','ENTREGADO','FALLIDO'))
);
CREATE INDEX ix_entrega_pendiente ON webhook_entrega (proximo_intento) WHERE estado = 'PENDIENTE';

-- Cada evento del outbox genera su cola de entregas para los suscriptores
CREATE FUNCTION tg_outbox_webhooks() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_evt tipo_webhook_evento;
BEGIN
  -- una reserva instantánea nace ya CONFIRMADA: su evento es 'ReservaCreada' con estado CONFIRMADA
  v_evt := CASE WHEN NEW.tipo = 'ReservaConfirmada' OR (NEW.tipo = 'ReservaCreada' AND NEW.payload->>'estado' = 'CONFIRMADA')
                THEN 'ORDER_CONFIRMED'
                WHEN NEW.tipo = 'ReservaCancelada' THEN 'ORDER_CANCELLED' END;
  IF v_evt IS NOT NULL THEN
    INSERT INTO webhook_entrega (suscripcion_id, evento_id)
    SELECT s.id, NEW.id FROM webhook_suscripcion s
      JOIN webhook_evento e ON e.suscripcion_id = s.id AND e.evento = v_evt WHERE s.activa
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_outbox_webhooks AFTER INSERT ON evento_outbox FOR EACH ROW EXECUTE FUNCTION tg_outbox_webhooks();

-- ---------------------------------------------------------------------
-- 6. Vista "orden" con el vocabulario del contrato (OrderDetail)
-- ---------------------------------------------------------------------
CREATE VIEW v_orden AS
SELECT r.id AS order_id, r.codigo AS locator,
       CASE r.estado WHEN 'CONFIRMADA' THEN 'CONFIRMED' WHEN 'COMPLETADA' THEN 'CONFIRMED' WHEN 'PENDIENTE' THEN 'PENDING' ELSE 'CANCELLED' END AS status,
       r.estado AS estado_interno, r.huesped_id AS owner_id,
       a.codigo AS accommodation_id, a.nombre AS accommodation_name, r.fecha_entrada AS checkin, r.fecha_salida AS checkout,
       r.num_huespedes AS guests, t.total AS total_price, 'USD'::char(3) AS currency, r.created_at AS creation_date
FROM reserva r
JOIN alojamiento a ON a.id = r.alojamiento_id
JOIN v_reserva_total t ON t.reserva_id = r.id;

-- RLS activo sin políticas (el backend conecta como postgres), igual que en 01
ALTER TABLE orden_preview       ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotencia        ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_suscripcion ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_evento      ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_entrega     ENABLE ROW LEVEL SECURITY;

-- Documentación de las tablas de integración
COMMENT ON TABLE orden_preview       IS 'Cotización congelada 15 minutos entre /orders/preview y /orders/create; permite detectar cambios de precio.';
COMMENT ON TABLE idempotencia        IS 'Respuestas guardadas por Idempotency-Key para no duplicar crear, modificar o cancelar una orden.';
COMMENT ON TABLE webhook_suscripcion IS 'Suscripciones de terceros a webhooks: URL de destino, secreto de firma y si está activa.';
COMMENT ON TABLE webhook_evento      IS 'Eventos a los que está suscrita cada suscripción (ORDER_CONFIRMED, ORDER_CANCELLED).';
COMMENT ON TABLE webhook_entrega     IS 'Cola de entregas de webhooks por evento y suscripción, con intentos y estado (la entrega real es del Reto 2).';

DO $$ BEGIN
  RAISE NOTICE 'Integración OK: % tablas en total, % alojamientos con código público',
    (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'booking' AND table_type = 'BASE TABLE'),
    (SELECT count(*) FROM alojamiento WHERE codigo IS NOT NULL);
END $$;
