-- =====================================================================
--  BOOKING PROTOTIPO (Ecuador) - Esquema PostgreSQL v3.2 | Reto 1 (S1-S6)
--  Integración de Sistemas - PUCE | Alcance: nivel nacional (Ecuador, USD)
--  22 tablas en este script (27 en total con 03_integracion.sql). Probado en PostgreSQL 16 / Supabase.
--  Modelo normalizado: sin listas en columnas; los totales y penalidades se derivan en vistas.
--
--  Ejecutar completo:  01_esquema.sql  ->  02_datos_demo.sql  ->  03_integracion.sql
--  Re-ejecutable: borra y recrea SOLO el schema 'booking'.
--  BD ya existente con la tabla alojamiento_codigo: usar migracion_codigo_en_alojamiento.sql.
--  BD ya existente con la tabla reporte: usar migracion_admin_dueno.sql y migracion_sin_reportes.sql.
--
--  MÓDULOS
--   Acceso      : usuario, token_usuario
--   Catálogos   : ciudad, aeropuerto, tipo_alojamiento, amenidad,
--                 politica_cancelacion, politica_cancelacion_regla, impuesto_tarifa
--   Oferta      : alojamiento, unidad_alojamiento, calendario_unidad,
--                 alojamiento_aeropuerto, alojamiento_amenidad, imagen_alojamiento
--   Ventas      : reserva, reserva_detalle, cancelacion, pago, factura
--   Confianza   : resena  (las denuncias quedan como evolución futura)
--   Integración : evento_outbox  (EDA, semanas 5-6)
--
--  Las tablas puente son binarias (alojamiento_amenidad, alojamiento_aeropuerto).
--  No se guardan totales ni penalidades derivables: salen de las
--  vistas v_reserva_total y v_cancelacion_liquidacion. Lo que sí se guarda
--  (montos por línea de reserva, datos del comprador en la factura, política
--  aceptada) es HISTORIA: lo acordado ese día, que no cambia si luego cambian
--  precios, impuestos o datos del usuario.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- fuera del schema (crypt() en datos demo)
DROP SCHEMA IF EXISTS booking CASCADE;
CREATE SCHEMA booking;
SET search_path = booking, public;

-- ---------------------------------------------------------------------
-- 1. TIPOS
-- ---------------------------------------------------------------------
CREATE TYPE rol_usuario        AS ENUM ('USUARIO','ADMIN');
CREATE TYPE tipo_documento     AS ENUM ('CEDULA','RUC','PASAPORTE');
CREATE TYPE modo_reserva       AS ENUM ('INSTANTANEA','SOLICITUD');
CREATE TYPE estado_alojamiento AS ENUM ('BORRADOR','PUBLICADO','SUSPENDIDO');
CREATE TYPE estado_reserva     AS ENUM ('PENDIENTE','CONFIRMADA','CANCELADA','RECHAZADA','EXPIRADA','COMPLETADA');
CREATE TYPE tipo_pago          AS ENUM ('COBRO','REEMBOLSO');
CREATE TYPE estado_pago        AS ENUM ('PENDIENTE','APROBADO','RECHAZADO');
CREATE TYPE tipo_impuesto      AS ENUM ('IVA','SERVICIO');
CREATE TYPE tipo_token         AS ENUM ('RECUPERAR_CLAVE','VERIFICAR_EMAIL');
CREATE TYPE estado_factura     AS ENUM ('EMITIDA','ANULADA');
CREATE TYPE estado_resena      AS ENUM ('PUBLICADA','OCULTA');
CREATE TYPE motivo_reporte     AS ENUM ('INFORMACION_FALSA','FOTOS_ENGANOSAS','ESTAFA','INSEGURO','COMPORTAMIENTO_INADECUADO','OTRO');  -- sin uso: reservado para las denuncias (evolución futura)
CREATE TYPE provincia_ec       AS ENUM (
  'Azuay','Bolívar','Cañar','Carchi','Chimborazo','Cotopaxi','El Oro','Esmeraldas',
  'Galápagos','Guayas','Imbabura','Loja','Los Ríos','Manabí','Morona Santiago','Napo',
  'Orellana','Pastaza','Pichincha','Santa Elena','Santo Domingo de los Tsáchilas',
  'Sucumbíos','Tungurahua','Zamora Chinchipe');

CREATE SEQUENCE seq_factura START 1;

-- ---------------------------------------------------------------------
-- 2. ACCESO
-- ---------------------------------------------------------------------
-- Una sola cuenta sirve para reservar y para publicar ("anfitrión" = tener >=1 alojamiento).
CREATE TABLE usuario (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email            varchar(160) NOT NULL,
  password_hash    text         NOT NULL,
  nombres          varchar(80)  NOT NULL,
  apellidos        varchar(80)  NOT NULL,
  telefono         varchar(20),
  foto_url         text,                      -- opcional
  tipo_documento   tipo_documento,            -- opcional (se usa para facturar)
  numero_documento varchar(13),
  razon_social     varchar(160),              -- opcional (hoteles/empresas)
  rol              rol_usuario  NOT NULL DEFAULT 'USUARIO',
  activo           boolean      NOT NULL DEFAULT true,
  created_at       timestamptz  NOT NULL DEFAULT now(),
  updated_at       timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT uq_usuario_email UNIQUE (email),
  CONSTRAINT uq_usuario_doc   UNIQUE (tipo_documento, numero_documento),
  CONSTRAINT ck_usuario_email CHECK (email = lower(email) AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  CONSTRAINT ck_usuario_tel   CHECK (telefono IS NULL OR telefono ~ '^\+?[0-9]{7,15}$'),
  CONSTRAINT ck_usuario_doc   CHECK ((tipo_documento IS NULL) = (numero_documento IS NULL)
        AND (tipo_documento IS DISTINCT FROM 'CEDULA' OR numero_documento ~ '^[0-9]{10}$')
        AND (tipo_documento IS DISTINCT FROM 'RUC'    OR numero_documento ~ '^[0-9]{13}$'))
);

-- Recuperación de clave / verificación de correo (solo se guarda el hash del token)
CREATE TABLE token_usuario (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  tipo       tipo_token  NOT NULL,
  token_hash text        NOT NULL,
  expira_en  timestamptz NOT NULL,
  usado_en   timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_token_hash UNIQUE (token_hash),
  CONSTRAINT ck_token_exp  CHECK (expira_en > created_at)
);

-- ---------------------------------------------------------------------
-- 3. CATÁLOGOS (los administra el ADMIN)
-- ---------------------------------------------------------------------
-- 'ciudad' = localidad que busca la gente (no el cantón oficial)
CREATE TABLE ciudad (
  id        smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provincia provincia_ec NOT NULL,
  nombre    varchar(80)  NOT NULL,
  latitud   numeric(9,6),
  longitud  numeric(9,6),
  CONSTRAINT uq_ciudad UNIQUE (nombre, provincia),
  CONSTRAINT ck_ciudad_coord CHECK ((latitud IS NULL) = (longitud IS NULL)
        AND (latitud IS NULL OR (latitud BETWEEN -5 AND 2 AND longitud BETWEEN -93 AND -75)))
);

CREATE TABLE aeropuerto (
  id          smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo_iata char(3)      NOT NULL,
  nombre      varchar(120) NOT NULL,
  ciudad_id   smallint     NOT NULL REFERENCES ciudad(id),
  latitud     numeric(9,6) NOT NULL,
  longitud    numeric(9,6) NOT NULL,
  CONSTRAINT uq_aeropuerto_iata UNIQUE (codigo_iata),
  CONSTRAINT ck_aero_coord CHECK (latitud BETWEEN -5 AND 2 AND longitud BETWEEN -93 AND -75)
);

CREATE TABLE tipo_alojamiento (
  id     smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre varchar(50) NOT NULL,
  CONSTRAINT uq_tipo_aloj UNIQUE (nombre)
);

CREATE TABLE amenidad (
  id        smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre    varchar(60) NOT NULL,
  categoria varchar(30) NOT NULL,
  CONSTRAINT uq_amenidad UNIQUE (nombre)
);

CREATE TABLE politica_cancelacion (
  id          smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre      varchar(40)  NOT NULL,
  descripcion varchar(300) NOT NULL,
  CONSTRAINT uq_politica UNIQUE (nombre)
);

-- Tramos: "si cancelas con >= horas_minimas de anticipación, pagas porcentaje_penalidad %
-- del subtotal de alojamiento". Aplica el tramo con mayor horas_minimas que se cumpla.
-- Las reglas de una política NO se editan: si cambian, se crea una política nueva.
CREATE TABLE politica_cancelacion_regla (
  politica_id         smallint NOT NULL REFERENCES politica_cancelacion(id) ON DELETE CASCADE,
  horas_minimas       integer  NOT NULL,
  porcentaje_penalidad numeric(5,2) NOT NULL,
  PRIMARY KEY (politica_id, horas_minimas),
  CONSTRAINT ck_regla CHECK (horas_minimas >= 0 AND porcentaje_penalidad BETWEEN 0 AND 100)
);

-- IVA y cargo de servicio con vigencia. El admin carga aquí los feriados decretados.
CREATE TABLE impuesto_tarifa (
  id                      smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre                  varchar(80) NOT NULL,
  tipo                    tipo_impuesto NOT NULL,
  porcentaje              numeric(5,2) NOT NULL,
  vigente_desde           date NOT NULL,
  vigente_hasta           date,
  requiere_registro_turismo boolean NOT NULL DEFAULT false,  -- exige registro_turismo y LUAF
  estrellas_minimas       smallint,                          -- p. ej. servicio 10% desde 4 estrellas
  CONSTRAINT uq_impuesto UNIQUE (nombre, vigente_desde),
  CONSTRAINT ck_imp_pct   CHECK (porcentaje BETWEEN 0 AND 100),
  CONSTRAINT ck_imp_vig   CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde),
  CONSTRAINT ck_imp_estr  CHECK (estrellas_minimas IS NULL OR estrellas_minimas BETWEEN 1 AND 5)
);

-- ---------------------------------------------------------------------
-- 4. OFERTA
-- ---------------------------------------------------------------------
CREATE TABLE alojamiento (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo             integer GENERATED ALWAYS AS IDENTITY (START WITH 1001) NOT NULL,  -- código público entero (el contrato no expone el UUID)
  anfitrion_id       uuid NOT NULL REFERENCES usuario(id),
  tipo_id            smallint NOT NULL REFERENCES tipo_alojamiento(id),
  ciudad_id          smallint NOT NULL REFERENCES ciudad(id),
  politica_id        smallint NOT NULL REFERENCES politica_cancelacion(id),
  nombre             varchar(140) NOT NULL,
  descripcion        text         NOT NULL,
  direccion          varchar(200) NOT NULL,
  latitud            numeric(9,6) NOT NULL,
  longitud           numeric(9,6) NOT NULL,
  telefono_contacto  varchar(20),
  hora_checkin       time NOT NULL DEFAULT '14:00',
  hora_checkout      time NOT NULL DEFAULT '12:00',
  noches_min         smallint NOT NULL DEFAULT 1,
  noches_max         smallint NOT NULL DEFAULT 30,
  tarifa_limpieza    numeric(10,2) NOT NULL DEFAULT 0,
  modo_reserva       modo_reserva NOT NULL DEFAULT 'INSTANTANEA',
  reglas_casa        text,
  categoria_estrellas smallint,          -- solo establecimientos categorizados
  registro_turismo   varchar(30),        -- opcional; con luaf habilita IVA reducido en feriados
  luaf               varchar(30),
  estado             estado_alojamiento NOT NULL DEFAULT 'BORRADOR',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_alojamiento_codigo UNIQUE (codigo),
  CONSTRAINT ck_aloj_coord  CHECK (latitud BETWEEN -5 AND 2 AND longitud BETWEEN -93 AND -75),
  CONSTRAINT ck_aloj_noches CHECK (noches_min >= 1 AND noches_max >= noches_min),
  CONSTRAINT ck_aloj_limp   CHECK (tarifa_limpieza >= 0),
  CONSTRAINT ck_aloj_estr   CHECK (categoria_estrellas IS NULL OR categoria_estrellas BETWEEN 1 AND 5),
  CONSTRAINT ck_aloj_tel    CHECK (telefono_contacto IS NULL OR telefono_contacto ~ '^\+?[0-9]{7,15}$')
);

-- Lo que se reserva: tipo de habitación (cantidad = N) o propiedad completa (cantidad = 1)
CREATE TABLE unidad_alojamiento (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alojamiento_id    uuid NOT NULL REFERENCES alojamiento(id) ON DELETE CASCADE,
  nombre            varchar(100) NOT NULL,
  capacidad_huespedes smallint NOT NULL,
  num_habitaciones  smallint NOT NULL DEFAULT 1,
  num_camas         smallint NOT NULL DEFAULT 1,
  num_banos         smallint NOT NULL DEFAULT 1,
  cantidad          smallint NOT NULL DEFAULT 1,
  precio_noche_base numeric(10,2) NOT NULL,
  activa            boolean NOT NULL DEFAULT true,
  CONSTRAINT uq_unidad UNIQUE (alojamiento_id, nombre),
  CONSTRAINT ck_unidad_cap    CHECK (capacidad_huespedes BETWEEN 1 AND 30),
  CONSTRAINT ck_unidad_conteo CHECK (num_habitaciones >= 0 AND num_camas >= 1 AND num_banos >= 0),
  CONSTRAINT ck_unidad_cant   CHECK (cantidad >= 1),
  CONSTRAINT ck_unidad_precio CHECK (precio_noche_base > 0)
);

-- Solo EXCEPCIONES: precio especial y/o cantidad a la venta distinta a la base (0 = cerrada)
CREATE TABLE calendario_unidad (
  unidad_id            uuid NOT NULL REFERENCES unidad_alojamiento(id) ON DELETE CASCADE,
  fecha                date NOT NULL,
  precio_noche         numeric(10,2),
  cantidad_a_la_venta  smallint,
  PRIMARY KEY (unidad_id, fecha),
  CONSTRAINT ck_cal_algo   CHECK (precio_noche IS NOT NULL OR cantidad_a_la_venta IS NOT NULL),
  CONSTRAINT ck_cal_precio CHECK (precio_noche IS NULL OR precio_noche > 0),
  CONSTRAINT ck_cal_cant   CHECK (cantidad_a_la_venta IS NULL OR cantidad_a_la_venta >= 0)
);

-- Distancia por carretera y tiempo NO se derivan de las coordenadas
CREATE TABLE alojamiento_aeropuerto (
  alojamiento_id  uuid     NOT NULL REFERENCES alojamiento(id) ON DELETE CASCADE,
  aeropuerto_id   smallint NOT NULL REFERENCES aeropuerto(id),
  distancia_km    numeric(6,1) NOT NULL,
  tiempo_min      smallint NOT NULL,
  ofrece_transfer boolean  NOT NULL DEFAULT false,
  PRIMARY KEY (alojamiento_id, aeropuerto_id),
  CONSTRAINT ck_aa CHECK (distancia_km >= 0 AND tiempo_min >= 0)
);

CREATE TABLE alojamiento_amenidad (
  alojamiento_id uuid     NOT NULL REFERENCES alojamiento(id) ON DELETE CASCADE,
  amenidad_id    smallint NOT NULL REFERENCES amenidad(id),
  PRIMARY KEY (alojamiento_id, amenidad_id)
);

CREATE TABLE imagen_alojamiento (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alojamiento_id uuid NOT NULL REFERENCES alojamiento(id) ON DELETE CASCADE,
  url            text NOT NULL,
  orden          smallint NOT NULL DEFAULT 0,
  es_portada     boolean NOT NULL DEFAULT false,
  CONSTRAINT uq_imagen_orden UNIQUE (alojamiento_id, orden)
);
CREATE UNIQUE INDEX uq_imagen_portada ON imagen_alojamiento (alojamiento_id) WHERE es_portada;

-- ---------------------------------------------------------------------
-- 5. VENTAS
-- ---------------------------------------------------------------------
-- Cabecera de reserva. El total NO se guarda: v_reserva_total lo calcula.
CREATE TABLE reserva (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo                  varchar(12) NOT NULL DEFAULT ('BK-' || upper(substr(md5(random()::text || clock_timestamp()::text),1,8))),
  huesped_id              uuid NOT NULL REFERENCES usuario(id),
  alojamiento_id          uuid NOT NULL REFERENCES alojamiento(id),
  politica_id             smallint NOT NULL REFERENCES politica_cancelacion(id),   -- la que aceptó el huésped
  fecha_entrada           date NOT NULL,
  fecha_salida            date NOT NULL,
  noches                  integer GENERATED ALWAYS AS (fecha_salida - fecha_entrada) STORED,
  num_huespedes           smallint NOT NULL,
  modo                    modo_reserva NOT NULL,
  expira_en               timestamptz,
  tarifa_limpieza_aplicada numeric(10,2) NOT NULL DEFAULT 0,
  iva_limpieza            numeric(10,2) NOT NULL DEFAULT 0,
  estado                  estado_reserva NOT NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_reserva_codigo UNIQUE (codigo),
  CONSTRAINT ck_reserva_fechas CHECK (fecha_salida > fecha_entrada),
  CONSTRAINT ck_reserva_huesp  CHECK (num_huespedes >= 1),
  CONSTRAINT ck_reserva_limp   CHECK (tarifa_limpieza_aplicada >= 0 AND iva_limpieza >= 0)
);

-- Una línea por tipo de unidad reservada (un hotel permite varias en una reserva)
CREATE TABLE reserva_detalle (
  reserva_id          uuid NOT NULL REFERENCES reserva(id) ON DELETE CASCADE,
  unidad_id           uuid NOT NULL REFERENCES unidad_alojamiento(id),
  cantidad            smallint NOT NULL,
  subtotal_alojamiento numeric(12,2) NOT NULL,
  servicio_monto      numeric(12,2) NOT NULL DEFAULT 0,
  iva_monto           numeric(12,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (reserva_id, unidad_id),
  CONSTRAINT ck_det CHECK (cantidad >= 1 AND subtotal_alojamiento > 0 AND servicio_monto >= 0 AND iva_monto >= 0)
);

-- Solo existe para reservas canceladas. Penalidad y reembolso salen de v_cancelacion_liquidacion.
CREATE TABLE cancelacion (
  reserva_id    uuid PRIMARY KEY REFERENCES reserva(id),
  cancelada_en  timestamptz NOT NULL DEFAULT now(),
  cancelada_por uuid NOT NULL REFERENCES usuario(id),
  motivo        varchar(300)
);

CREATE TABLE pago (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reserva_id uuid NOT NULL REFERENCES reserva(id),
  tipo       tipo_pago   NOT NULL,
  monto      numeric(12,2) NOT NULL,
  estado     estado_pago NOT NULL DEFAULT 'APROBADO',
  referencia varchar(60),
  fecha      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_pago_monto CHECK (monto > 0)
);

-- Factura SIMULADA (sin autorización del SRI). Guarda copia de los datos del comprador
-- (si el usuario los cambia luego, la factura no cambia). Los totales salen de v_factura.
CREATE TABLE factura (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reserva_id               uuid NOT NULL REFERENCES reserva(id),
  secuencial               integer NOT NULL DEFAULT nextval('seq_factura'),
  emitida_en               timestamptz NOT NULL DEFAULT now(),
  comprador_nombre         varchar(160) NOT NULL,
  comprador_tipo_documento tipo_documento,            -- NULL = consumidor final
  comprador_identificacion varchar(13) NOT NULL,
  comprador_email          varchar(160) NOT NULL,
  estado                   estado_factura NOT NULL DEFAULT 'EMITIDA',
  anulada_en               timestamptz,
  CONSTRAINT uq_factura_reserva UNIQUE (reserva_id),
  CONSTRAINT uq_factura_sec     UNIQUE (secuencial),
  CONSTRAINT ck_factura_anul    CHECK ((estado = 'ANULADA') = (anulada_en IS NOT NULL))
);

-- ---------------------------------------------------------------------
-- 6. CONFIANZA
-- ---------------------------------------------------------------------
CREATE TABLE resena (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reserva_id          uuid NOT NULL REFERENCES reserva(id),     -- autor y alojamiento salen de la reserva
  nota_global         smallint NOT NULL,
  comentario          text,
  respuesta_anfitrion text,
  respondida_en       timestamptz,
  estado              estado_resena NOT NULL DEFAULT 'PUBLICADA',
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_resena_reserva UNIQUE (reserva_id),
  CONSTRAINT ck_resena_nota CHECK (nota_global BETWEEN 1 AND 10),
  CONSTRAINT ck_resena_resp CHECK ((respuesta_anfitrion IS NULL) = (respondida_en IS NULL))
);

-- ---------------------------------------------------------------------
-- 7. INTEGRACIÓN (Outbox: eventos de negocio y trazabilidad, S5-S6)
-- ---------------------------------------------------------------------
CREATE TABLE evento_outbox (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo           varchar(60) NOT NULL,
  agregado       varchar(30) NOT NULL,
  agregado_id    uuid        NOT NULL,
  correlacion_id uuid        NOT NULL,       -- une todos los eventos de un mismo flujo
  payload        jsonb       NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  publicado_en   timestamptz                 -- NULL = pendiente de publicar
);

-- ---------------------------------------------------------------------
-- 8. ÍNDICES
-- ---------------------------------------------------------------------
CREATE INDEX ix_token_usuario  ON token_usuario (usuario_id, tipo);
CREATE INDEX ix_aloj_busqueda  ON alojamiento (ciudad_id, estado);
CREATE INDEX ix_aloj_anfitrion ON alojamiento (anfitrion_id);
CREATE INDEX ix_unidad_aloj    ON unidad_alojamiento (alojamiento_id) WHERE activa;
CREATE INDEX ix_aa_aeropuerto  ON alojamiento_aeropuerto (aeropuerto_id, distancia_km);
CREATE INDEX ix_reserva_aloj   ON reserva (alojamiento_id, fecha_entrada, fecha_salida);
CREATE INDEX ix_reserva_huesp  ON reserva (huesped_id, fecha_entrada DESC);
CREATE INDEX ix_reserva_expira ON reserva (expira_en) WHERE estado = 'PENDIENTE';
CREATE INDEX ix_detalle_unidad ON reserva_detalle (unidad_id);
CREATE INDEX ix_pago_reserva   ON pago (reserva_id);
CREATE INDEX ix_outbox_pend    ON evento_outbox (id) WHERE publicado_en IS NULL;
CREATE INDEX ix_outbox_corr    ON evento_outbox (correlacion_id);

-- ---------------------------------------------------------------------
-- 9. FUNCIONES DE CÁLCULO
-- ---------------------------------------------------------------------
-- Tarifa IVA vigente en una fecha. El tramo "requiere_registro_turismo" solo aplica si el
-- alojamiento declara registro_turismo y luaf; entre las aplicables gana la más específica.
CREATE OR REPLACE FUNCTION fn_iva_pct(p_alojamiento uuid, p_fecha date) RETURNS numeric
LANGUAGE sql STABLE AS $$
  SELECT t.porcentaje
  FROM impuesto_tarifa t, alojamiento a
  WHERE a.id = p_alojamiento AND t.tipo = 'IVA'
    AND p_fecha BETWEEN t.vigente_desde AND COALESCE(t.vigente_hasta, date '9999-12-31')
    AND (NOT t.requiere_registro_turismo OR (a.registro_turismo IS NOT NULL AND a.luaf IS NOT NULL))
  ORDER BY t.requiere_registro_turismo DESC, t.vigente_desde DESC
  LIMIT 1 $$;

-- Cargo de servicio (10%) para establecimientos con estrellas suficientes; 0 si no aplica
CREATE OR REPLACE FUNCTION fn_servicio_pct(p_alojamiento uuid, p_fecha date) RETURNS numeric
LANGUAGE sql STABLE AS $$
  SELECT COALESCE((
    SELECT t.porcentaje FROM impuesto_tarifa t, alojamiento a
    WHERE a.id = p_alojamiento AND t.tipo = 'SERVICIO'
      AND p_fecha BETWEEN t.vigente_desde AND COALESCE(t.vigente_hasta, date '9999-12-31')
      AND a.categoria_estrellas >= COALESCE(t.estrellas_minimas, 1)
    ORDER BY t.vigente_desde DESC LIMIT 1), 0) $$;

-- Unidades libres en TODO el rango [entrada, salida): mínimo diario de (a la venta - ocupadas)
CREATE OR REPLACE FUNCTION fn_cupo_unidad(p_unidad uuid, p_entrada date, p_salida date) RETURNS integer
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(min(
           COALESCE(c.cantidad_a_la_venta, u.cantidad)
           - COALESCE((SELECT sum(d.cantidad) FROM reserva_detalle d JOIN reserva r ON r.id = d.reserva_id
                        WHERE d.unidad_id = u.id AND r.estado IN ('PENDIENTE','CONFIRMADA','COMPLETADA')
                          AND r.fecha_entrada <= n::date AND r.fecha_salida > n::date), 0)), 0)
  FROM unidad_alojamiento u
  CROSS JOIN generate_series(p_entrada, p_salida - 1, interval '1 day') n
  LEFT JOIN calendario_unidad c ON c.unidad_id = u.id AND c.fecha = n::date
  WHERE u.id = p_unidad $$;

-- Precio del hospedaje de UNA unidad en el rango (precio especial del calendario o precio base)
CREATE OR REPLACE FUNCTION fn_precio_estadia(p_unidad uuid, p_entrada date, p_salida date) RETURNS numeric
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(sum(COALESCE(c.precio_noche, u.precio_noche_base)), 0)
  FROM unidad_alojamiento u
  CROSS JOIN generate_series(p_entrada, p_salida - 1, interval '1 day') n
  LEFT JOIN calendario_unidad c ON c.unidad_id = u.id AND c.fecha = n::date
  WHERE u.id = p_unidad $$;

-- Montos de una línea de reserva, noche por noche (el IVA se aplica sobre hospedaje + servicio)
CREATE OR REPLACE FUNCTION fn_calcular_linea(p_unidad uuid, p_entrada date, p_salida date, p_cantidad int)
RETURNS TABLE (subtotal numeric, servicio numeric, iva numeric) LANGUAGE sql STABLE AS $$
  SELECT round(sum(x.p), 2),
         round(sum(x.p * x.sp / 100), 2),
         round(sum((x.p + x.p * x.sp / 100) * x.ip / 100), 2)
  FROM (SELECT COALESCE(c.precio_noche, u.precio_noche_base) * p_cantidad AS p,
               fn_servicio_pct(u.alojamiento_id, n::date) AS sp,
               fn_iva_pct(u.alojamiento_id, n::date)      AS ip
        FROM unidad_alojamiento u
        CROSS JOIN generate_series(p_entrada, p_salida - 1, interval '1 day') n
        LEFT JOIN calendario_unidad c ON c.unidad_id = u.id AND c.fecha = n::date
        WHERE u.id = p_unidad) x $$;

-- ---------------------------------------------------------------------
-- 10. TRIGGERS DE INTEGRIDAD
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION tg_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TRIGGER trg_usuario_upd     BEFORE UPDATE ON usuario     FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER trg_alojamiento_upd BEFORE UPDATE ON alojamiento FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER trg_reserva_upd     BEFORE UPDATE ON reserva     FOR EACH ROW EXECUTE FUNCTION tg_updated_at();

-- El dueño del alojamiento debe ser una cuenta activa (el ADMIN, operador de Posada EC, administra el catálogo)
CREATE OR REPLACE FUNCTION tg_alojamiento_anfitrion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT COALESCE((SELECT activo FROM usuario WHERE id = NEW.anfitrion_id), false) THEN
    RAISE EXCEPTION 'ANFITRION_INVALIDO: el dueño del alojamiento debe ser una cuenta activa';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_alojamiento_anf BEFORE INSERT OR UPDATE OF anfitrion_id ON alojamiento
  FOR EACH ROW EXECUTE FUNCTION tg_alojamiento_anfitrion();

-- Reglas de la cabecera de reserva
CREATE OR REPLACE FUNCTION tg_reserva_validar() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a alojamiento%ROWTYPE; hoy date := (now() AT TIME ZONE 'America/Guayaquil')::date;
BEGIN
  SELECT * INTO a FROM alojamiento WHERE id = NEW.alojamiento_id;
  IF a.estado <> 'PUBLICADO' THEN
    RAISE EXCEPTION 'NO_RESERVABLE: el alojamiento no está publicado';
  END IF;
  IF (SELECT rol FROM usuario WHERE id = NEW.huesped_id) = 'ADMIN' THEN
    RAISE EXCEPTION 'HUESPED_INVALIDO: un ADMIN no puede reservar';
  END IF;
  IF a.anfitrion_id = NEW.huesped_id THEN
    RAISE EXCEPTION 'AUTORESERVA: no puedes reservar tu propio alojamiento';
  END IF;
  IF NEW.fecha_entrada < hoy THEN
    RAISE EXCEPTION 'FECHA_PASADA: la entrada no puede estar en el pasado';
  END IF;
  IF NEW.noches < a.noches_min OR NEW.noches > a.noches_max THEN
    RAISE EXCEPTION 'ESTANCIA_INVALIDA: noches permitidas entre % y %', a.noches_min, a.noches_max;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_reserva_validar BEFORE INSERT ON reserva
  FOR EACH ROW EXECUTE FUNCTION tg_reserva_validar();

-- Cada línea: misma propiedad, unidad activa, y cupo suficiente (con candado de fila: sin sobreventa)
CREATE OR REPLACE FUNCTION tg_detalle_validar() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r reserva%ROWTYPE; u unidad_alojamiento%ROWTYPE;
BEGIN
  SELECT * INTO u FROM unidad_alojamiento WHERE id = NEW.unidad_id FOR UPDATE;
  SELECT * INTO r FROM reserva WHERE id = NEW.reserva_id;
  IF u.alojamiento_id <> r.alojamiento_id THEN
    RAISE EXCEPTION 'UNIDAD_AJENA: la unidad no pertenece al alojamiento de la reserva';
  END IF;
  IF NOT u.activa THEN RAISE EXCEPTION 'UNIDAD_INACTIVA: la unidad no está disponible'; END IF;
  IF fn_cupo_unidad(NEW.unidad_id, r.fecha_entrada, r.fecha_salida) < NEW.cantidad THEN
    RAISE EXCEPTION 'SIN_DISPONIBILIDAD: no hay cupo para esas fechas';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_detalle_validar BEFORE INSERT ON reserva_detalle
  FOR EACH ROW EXECUTE FUNCTION tg_detalle_validar();

-- Al cerrar la transacción: toda reserva tiene líneas y estas alcanzan para los huéspedes
CREATE OR REPLACE FUNCTION tg_reserva_requiere_detalle() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_cap int;
BEGIN
  SELECT COALESCE(sum(u.capacidad_huespedes * d.cantidad), 0) INTO v_cap
    FROM reserva_detalle d JOIN unidad_alojamiento u ON u.id = d.unidad_id WHERE d.reserva_id = NEW.id;
  IF v_cap = 0 THEN RAISE EXCEPTION 'RESERVA_SIN_DETALLE: la reserva debe tener al menos una unidad'; END IF;
  IF v_cap < NEW.num_huespedes THEN
    RAISE EXCEPTION 'CAPACIDAD_EXCEDIDA: las unidades reservadas alojan máximo % huéspedes', v_cap;
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER trg_reserva_requiere_detalle AFTER INSERT ON reserva
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION tg_reserva_requiere_detalle();

-- Máquina de estados de la reserva
CREATE OR REPLACE FUNCTION tg_reserva_transicion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.estado = OLD.estado THEN RETURN NEW; END IF;
  IF NOT (
       (OLD.estado = 'PENDIENTE'  AND NEW.estado IN ('CONFIRMADA','RECHAZADA','EXPIRADA','CANCELADA'))
    OR (OLD.estado = 'CONFIRMADA' AND NEW.estado IN ('CANCELADA','COMPLETADA'))
  ) THEN
    RAISE EXCEPTION 'TRANSICION_INVALIDA: % -> %', OLD.estado, NEW.estado;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_reserva_transicion BEFORE UPDATE OF estado ON reserva
  FOR EACH ROW EXECUTE FUNCTION tg_reserva_transicion();

-- Solo cancelan el huésped, el anfitrión del alojamiento o un ADMIN; solo reservas vivas
CREATE OR REPLACE FUNCTION tg_cancelacion_validar() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r reserva%ROWTYPE; v_host uuid;
BEGIN
  SELECT * INTO r FROM reserva WHERE id = NEW.reserva_id;
  SELECT anfitrion_id INTO v_host FROM alojamiento WHERE id = r.alojamiento_id;
  IF r.estado NOT IN ('PENDIENTE','CONFIRMADA') THEN
    RAISE EXCEPTION 'ESTADO_INVALIDO: no se puede cancelar una reserva %', r.estado;
  END IF;
  IF NOT (NEW.cancelada_por = r.huesped_id OR NEW.cancelada_por = v_host
          OR (SELECT rol FROM usuario WHERE id = NEW.cancelada_por) = 'ADMIN') THEN
    RAISE EXCEPTION 'NO_AUTORIZADO: no puedes cancelar esta reserva';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_cancelacion_validar BEFORE INSERT ON cancelacion
  FOR EACH ROW EXECUTE FUNCTION tg_cancelacion_validar();

-- Reseña: solo de estancias COMPLETADAS
CREATE OR REPLACE FUNCTION tg_resena_validar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT estado FROM reserva WHERE id = NEW.reserva_id) <> 'COMPLETADA' THEN
    RAISE EXCEPTION 'RESENA_INVALIDA: solo se puede reseñar una reserva COMPLETADA';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_resena_validar BEFORE INSERT ON resena FOR EACH ROW EXECUTE FUNCTION tg_resena_validar();

-- ---------------------------------------------------------------------
-- 11. EVENTOS DE NEGOCIO (Outbox), generados por trigger: ningún camino los omite
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_emitir_evento(p_tipo text, p_agregado text, p_id uuid, p_corr uuid, p_payload jsonb)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO evento_outbox (tipo, agregado, agregado_id, correlacion_id, payload)
  VALUES (p_tipo, p_agregado, p_id, p_corr, p_payload) $$;

CREATE OR REPLACE FUNCTION tg_evt_reserva() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE t text;
BEGIN
  IF TG_OP = 'INSERT' THEN t := 'ReservaCreada';
  ELSE t := CASE NEW.estado WHEN 'CONFIRMADA' THEN 'ReservaConfirmada' WHEN 'CANCELADA' THEN 'ReservaCancelada'
                            WHEN 'RECHAZADA' THEN 'ReservaRechazada'   WHEN 'EXPIRADA'  THEN 'ReservaExpirada'
                            WHEN 'COMPLETADA' THEN 'EstanciaCompletada' END;
  END IF;
  IF t IS NOT NULL THEN
    PERFORM fn_emitir_evento(t, 'Reserva', NEW.id, NEW.id, jsonb_build_object(
      'reservaId', NEW.id, 'codigo', NEW.codigo, 'estado', NEW.estado, 'huespedId', NEW.huesped_id,
      'alojamientoId', NEW.alojamiento_id, 'entrada', NEW.fecha_entrada, 'salida', NEW.fecha_salida));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_evt_reserva_ins AFTER INSERT ON reserva FOR EACH ROW EXECUTE FUNCTION tg_evt_reserva();
CREATE TRIGGER trg_evt_reserva_upd AFTER UPDATE OF estado ON reserva
  FOR EACH ROW WHEN (OLD.estado IS DISTINCT FROM NEW.estado) EXECUTE FUNCTION tg_evt_reserva();

CREATE OR REPLACE FUNCTION tg_evt_pago() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM fn_emitir_evento(CASE NEW.tipo WHEN 'COBRO' THEN 'PagoRegistrado' ELSE 'ReembolsoRegistrado' END,
    'Pago', NEW.id, NEW.reserva_id,
    jsonb_build_object('pagoId', NEW.id, 'reservaId', NEW.reserva_id, 'tipo', NEW.tipo, 'monto', NEW.monto));
  RETURN NEW;
END $$;
CREATE TRIGGER trg_evt_pago AFTER INSERT ON pago FOR EACH ROW EXECUTE FUNCTION tg_evt_pago();

CREATE OR REPLACE FUNCTION tg_evt_factura() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM fn_emitir_evento(CASE WHEN TG_OP = 'INSERT' THEN 'FacturaEmitida' ELSE 'FacturaAnulada' END,
    'Factura', NEW.id, NEW.reserva_id,
    jsonb_build_object('facturaId', NEW.id, 'reservaId', NEW.reserva_id, 'secuencial', NEW.secuencial));
  RETURN NEW;
END $$;
CREATE TRIGGER trg_evt_factura_ins AFTER INSERT ON factura FOR EACH ROW EXECUTE FUNCTION tg_evt_factura();
CREATE TRIGGER trg_evt_factura_upd AFTER UPDATE OF estado ON factura
  FOR EACH ROW WHEN (NEW.estado = 'ANULADA' AND OLD.estado <> 'ANULADA') EXECUTE FUNCTION tg_evt_factura();

CREATE OR REPLACE FUNCTION tg_evt_resena() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM fn_emitir_evento('ResenaPublicada', 'Resena', NEW.id, NEW.reserva_id,
    jsonb_build_object('resenaId', NEW.id, 'reservaId', NEW.reserva_id, 'nota', NEW.nota_global));
  RETURN NEW;
END $$;
CREATE TRIGGER trg_evt_resena AFTER INSERT ON resena FOR EACH ROW EXECUTE FUNCTION tg_evt_resena();

CREATE OR REPLACE FUNCTION tg_evt_alojamiento() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.estado = 'PUBLICADO' THEN
    PERFORM fn_emitir_evento('AlojamientoPublicado', 'Alojamiento', NEW.id, NEW.id,
      jsonb_build_object('alojamientoId', NEW.id, 'nombre', NEW.nombre, 'anfitrionId', NEW.anfitrion_id));
  ELSIF NEW.estado = 'SUSPENDIDO' THEN
    PERFORM fn_emitir_evento('AlojamientoSuspendido', 'Alojamiento', NEW.id, NEW.id,
      jsonb_build_object('alojamientoId', NEW.id, 'nombre', NEW.nombre));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_evt_alojamiento_ins AFTER INSERT ON alojamiento
  FOR EACH ROW WHEN (NEW.estado <> 'BORRADOR') EXECUTE FUNCTION tg_evt_alojamiento();
CREATE TRIGGER trg_evt_alojamiento_upd AFTER UPDATE OF estado ON alojamiento
  FOR EACH ROW WHEN (OLD.estado IS DISTINCT FROM NEW.estado) EXECUTE FUNCTION tg_evt_alojamiento();

-- ---------------------------------------------------------------------
-- 12. VISTAS
-- ---------------------------------------------------------------------
-- Total de la reserva (no se guarda: se calcula)
CREATE VIEW v_reserva_total AS
SELECT r.id AS reserva_id,
       COALESCE(sum(d.subtotal_alojamiento), 0)                       AS subtotal_alojamiento,
       COALESCE(sum(d.servicio_monto), 0)                             AS servicio,
       r.tarifa_limpieza_aplicada                                     AS limpieza,
       COALESCE(sum(d.iva_monto), 0) + r.iva_limpieza                 AS iva,
       COALESCE(sum(d.subtotal_alojamiento + d.servicio_monto + d.iva_monto), 0)
         + r.tarifa_limpieza_aplicada + r.iva_limpieza                AS total
FROM reserva r LEFT JOIN reserva_detalle d ON d.reserva_id = r.id
GROUP BY r.id;

-- Penalidad y reembolso de cada cancelación (la plata realmente devuelta queda en 'pago')
CREATE VIEW v_cancelacion_liquidacion AS
SELECT b.reserva_id, round(b.horas::numeric, 1) AS horas_anticipacion, p.pct AS porcentaje_aplicado,
       LEAST(round(b.subtotal * p.pct / 100, 2), b.pagado)            AS penalidad,
       b.pagado - LEAST(round(b.subtotal * p.pct / 100, 2), b.pagado) AS reembolso
FROM (SELECT c.reserva_id, r.politica_id, (c.cancelada_por = r.huesped_id) AS por_huesped,
             EXTRACT(EPOCH FROM (((r.fecha_entrada + a.hora_checkin) AT TIME ZONE 'America/Guayaquil') - c.cancelada_en)) / 3600.0 AS horas,
             COALESCE((SELECT sum(subtotal_alojamiento) FROM reserva_detalle WHERE reserva_id = r.id), 0) AS subtotal,
             COALESCE((SELECT sum(monto) FROM pago WHERE reserva_id = r.id AND tipo = 'COBRO' AND estado = 'APROBADO'), 0) AS pagado
      FROM cancelacion c JOIN reserva r ON r.id = c.reserva_id JOIN alojamiento a ON a.id = r.alojamiento_id) b
CROSS JOIN LATERAL (
  SELECT CASE WHEN b.por_huesped THEN COALESCE((SELECT g.porcentaje_penalidad FROM politica_cancelacion_regla g
                                                WHERE g.politica_id = b.politica_id AND g.horas_minimas <= b.horas
                                                ORDER BY g.horas_minimas DESC LIMIT 1), 100)
              ELSE 0 END AS pct) p;

-- Factura con número 001-001-NNNNNNNNN, emisor (anfitrión) y totales
CREATE VIEW v_factura AS
SELECT f.id, '001-001-' || lpad(f.secuencial::text, 9, '0') AS numero, f.estado, f.emitida_en, f.anulada_en,
       r.codigo AS reserva_codigo,
       COALESCE(em.razon_social, em.nombres || ' ' || em.apellidos) AS emisor_nombre,
       em.numero_documento AS emisor_identificacion,
       f.comprador_nombre, f.comprador_tipo_documento, f.comprador_identificacion, f.comprador_email,
       t.subtotal_alojamiento + t.limpieza AS subtotal_sin_impuestos, t.servicio, t.iva, t.total
FROM factura f
JOIN reserva r ON r.id = f.reserva_id
JOIN alojamiento a ON a.id = r.alojamiento_id
JOIN usuario em ON em.id = a.anfitrion_id
JOIN v_reserva_total t ON t.reserva_id = r.id;

CREATE VIEW v_alojamiento_resumen AS
SELECT a.id, a.nombre, ta.nombre AS tipo, c.nombre AS ciudad, c.provincia, a.categoria_estrellas, a.estado, a.modo_reserva,
       (SELECT min(u.precio_noche_base) FROM unidad_alojamiento u WHERE u.alojamiento_id = a.id AND u.activa) AS precio_desde,
       (SELECT i.url FROM imagen_alojamiento i WHERE i.alojamiento_id = a.id ORDER BY i.es_portada DESC, i.orden LIMIT 1) AS portada,
       (SELECT round(avg(rs.nota_global), 1) FROM resena rs JOIN reserva rv ON rv.id = rs.reserva_id
         WHERE rv.alojamiento_id = a.id AND rs.estado = 'PUBLICADA') AS calificacion,
       (SELECT count(*) FROM resena rs JOIN reserva rv ON rv.id = rs.reserva_id
         WHERE rv.alojamiento_id = a.id AND rs.estado = 'PUBLICADA') AS num_resenas
FROM alojamiento a
JOIN tipo_alojamiento ta ON ta.id = a.tipo_id
JOIN ciudad c ON c.id = a.ciudad_id;

-- Panel "Mi negocio": ingresos del anfitrión por mes (sin IVA) = completadas + penalidades retenidas
CREATE VIEW v_ingresos_anfitrion AS
SELECT x.anfitrion_id, date_trunc('month', x.fecha)::date AS mes,
       count(*) FILTER (WHERE x.estado = 'COMPLETADA') AS estancias,
       sum(x.ingreso) AS ingreso_sin_iva
FROM (SELECT a.anfitrion_id, r.estado,
             CASE WHEN r.estado = 'COMPLETADA' THEN r.fecha_salida ELSE cn.cancelada_en::date END AS fecha,
             CASE WHEN r.estado = 'COMPLETADA' THEN t.subtotal_alojamiento + t.servicio + t.limpieza
                  ELSE cl.penalidad END AS ingreso
      FROM reserva r
      JOIN alojamiento a ON a.id = r.alojamiento_id
      JOIN v_reserva_total t ON t.reserva_id = r.id
      LEFT JOIN cancelacion cn ON cn.reserva_id = r.id
      LEFT JOIN v_cancelacion_liquidacion cl ON cl.reserva_id = r.id
      WHERE r.estado = 'COMPLETADA' OR (r.estado = 'CANCELADA' AND cl.penalidad > 0)) x
GROUP BY x.anfitrion_id, date_trunc('month', x.fecha);

-- Dashboard del admin
CREATE VIEW v_admin_indicadores AS
SELECT (SELECT count(*) FROM usuario WHERE activo)                                   AS usuarios_activos,
       (SELECT count(*) FROM alojamiento WHERE estado = 'PUBLICADO')                 AS alojamientos_publicados,
       (SELECT count(*) FROM alojamiento WHERE estado = 'SUSPENDIDO')                AS alojamientos_suspendidos,
       (SELECT count(*) FROM reserva WHERE estado = 'CONFIRMADA')                    AS reservas_confirmadas,
       (SELECT count(*) FROM reserva WHERE estado = 'PENDIENTE')                     AS solicitudes_pendientes,
       (SELECT count(*) FROM reserva WHERE estado = 'CANCELADA')                     AS reservas_canceladas,
       (SELECT COALESCE(sum(t.total), 0) FROM reserva r JOIN v_reserva_total t ON t.reserva_id = r.id
         WHERE r.estado IN ('CONFIRMADA','COMPLETADA'))                              AS volumen_reservado;

CREATE VIEW v_ventas_por_ciudad AS
SELECT c.provincia, c.nombre AS ciudad, count(DISTINCT r.id) AS reservas, sum(r.noches) AS noches,
       sum(t.total) AS volumen
FROM reserva r JOIN alojamiento a ON a.id = r.alojamiento_id JOIN ciudad c ON c.id = a.ciudad_id
JOIN v_reserva_total t ON t.reserva_id = r.id
WHERE r.estado IN ('CONFIRMADA','COMPLETADA')
GROUP BY c.provincia, c.nombre;

CREATE VIEW v_top_alojamientos AS
SELECT a.id, a.nombre, count(r.id) AS reservas, COALESCE(sum(t.total), 0) AS volumen
FROM alojamiento a
JOIN reserva r ON r.alojamiento_id = a.id AND r.estado IN ('CONFIRMADA','COMPLETADA')
JOIN v_reserva_total t ON t.reserva_id = r.id
GROUP BY a.id, a.nombre ORDER BY reservas DESC, volumen DESC;

CREATE VIEW v_trazabilidad_reserva AS
SELECT correlacion_id, id AS evento_id, tipo, agregado, created_at, publicado_en, payload
FROM evento_outbox ORDER BY correlacion_id, id;

-- ---------------------------------------------------------------------
-- 13. OPERACIONES DE NEGOCIO (transaccionales)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_emitir_factura(p_reserva uuid) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO factura (reserva_id, comprador_nombre, comprador_tipo_documento, comprador_identificacion, comprador_email)
  SELECT r.id,
         CASE WHEN u.numero_documento IS NULL THEN 'CONSUMIDOR FINAL'
              ELSE COALESCE(u.razon_social, u.nombres || ' ' || u.apellidos) END,
         u.tipo_documento,
         COALESCE(u.numero_documento, '9999999999999'),
         u.email
    FROM reserva r JOIN usuario u ON u.id = r.huesped_id WHERE r.id = p_reserva
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- p_lineas: [{"unidad_id":"<uuid>","cantidad":2}, ...]
CREATE OR REPLACE FUNCTION fn_crear_reserva(p_huesped uuid, p_alojamiento uuid, p_entrada date, p_salida date,
                                            p_huespedes smallint, p_lineas jsonb)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE a alojamiento%ROWTYPE; v_id uuid; v_estado estado_reserva; v_total numeric; l record;
BEGIN
  IF p_salida <= p_entrada THEN RAISE EXCEPTION 'FECHAS_INVALIDAS: la salida debe ser posterior a la entrada'; END IF;
  IF p_lineas IS NULL OR jsonb_array_length(p_lineas) = 0 THEN
    RAISE EXCEPTION 'RESERVA_SIN_DETALLE: indica al menos una unidad';
  END IF;
  SELECT * INTO a FROM alojamiento WHERE id = p_alojamiento;
  IF NOT FOUND THEN RAISE EXCEPTION 'ALOJAMIENTO_NO_EXISTE'; END IF;
  v_estado := CASE a.modo_reserva WHEN 'INSTANTANEA' THEN 'CONFIRMADA' ELSE 'PENDIENTE' END;

  INSERT INTO reserva (huesped_id, alojamiento_id, politica_id, fecha_entrada, fecha_salida, num_huespedes, modo,
                       expira_en, tarifa_limpieza_aplicada, iva_limpieza, estado)
  VALUES (p_huesped, p_alojamiento, a.politica_id, p_entrada, p_salida, p_huespedes, a.modo_reserva,
          CASE WHEN v_estado = 'PENDIENTE' THEN now() + interval '24 hours' END,
          a.tarifa_limpieza, round(a.tarifa_limpieza * COALESCE(fn_iva_pct(a.id, p_entrada), 0) / 100, 2), v_estado)
  RETURNING id INTO v_id;

  FOR l IN SELECT x.unidad_id, x.cantidad FROM jsonb_to_recordset(p_lineas) x(unidad_id uuid, cantidad int) LOOP
    INSERT INTO reserva_detalle (reserva_id, unidad_id, cantidad, subtotal_alojamiento, servicio_monto, iva_monto)
    SELECT v_id, l.unidad_id, l.cantidad, c.subtotal, c.servicio, c.iva
      FROM fn_calcular_linea(l.unidad_id, p_entrada, p_salida, l.cantidad) c;
  END LOOP;

  IF v_estado = 'CONFIRMADA' THEN       -- instantánea: cobro simulado + factura simulada
    SELECT total INTO v_total FROM v_reserva_total WHERE reserva_id = v_id;
    INSERT INTO pago (reserva_id, tipo, monto, referencia)
    SELECT id, 'COBRO', v_total, 'SIM-' || codigo FROM reserva WHERE id = v_id;
    PERFORM fn_emitir_factura(v_id);
  END IF;
  RETURN v_id;
END $$;

-- El anfitrión acepta o rechaza una solicitud pendiente
CREATE OR REPLACE FUNCTION fn_responder_solicitud(p_reserva uuid, p_anfitrion uuid, p_acepta boolean)
RETURNS estado_reserva LANGUAGE plpgsql AS $$
DECLARE r reserva%ROWTYPE; v_total numeric;
BEGIN
  SELECT r2.* INTO r FROM reserva r2 JOIN alojamiento a ON a.id = r2.alojamiento_id
   WHERE r2.id = p_reserva AND a.anfitrion_id = p_anfitrion FOR UPDATE OF r2;
  IF NOT FOUND THEN RAISE EXCEPTION 'NO_AUTORIZADO: la reserva no pertenece a tus alojamientos'; END IF;
  IF r.estado <> 'PENDIENTE' THEN RAISE EXCEPTION 'ESTADO_INVALIDO: la reserva está %', r.estado; END IF;
  IF r.expira_en < now() THEN RAISE EXCEPTION 'SOLICITUD_EXPIRADA'; END IF;

  IF p_acepta THEN
    UPDATE reserva SET estado = 'CONFIRMADA', expira_en = NULL WHERE id = p_reserva;
    SELECT total INTO v_total FROM v_reserva_total WHERE reserva_id = p_reserva;
    INSERT INTO pago (reserva_id, tipo, monto, referencia) VALUES (p_reserva, 'COBRO', v_total, 'SIM-' || r.codigo);
    PERFORM fn_emitir_factura(p_reserva);
    RETURN 'CONFIRMADA';
  END IF;
  UPDATE reserva SET estado = 'RECHAZADA', expira_en = NULL WHERE id = p_reserva;
  RETURN 'RECHAZADA';
END $$;

-- Cancelación: registra la cancelación, calcula penalidad/reembolso con la vista, devuelve la plata
-- (movimiento REEMBOLSO en 'pago') y anula la factura si existía.
CREATE OR REPLACE FUNCTION fn_cancelar_reserva(p_reserva uuid, p_usuario uuid, p_motivo text DEFAULT NULL)
RETURNS TABLE (penalidad numeric, reembolso numeric) LANGUAGE plpgsql AS $$
DECLARE v_pen numeric; v_reemb numeric; v_cod text;
BEGIN
  PERFORM 1 FROM reserva WHERE id = p_reserva FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'RESERVA_NO_EXISTE'; END IF;
  INSERT INTO cancelacion (reserva_id, cancelada_por, motivo) VALUES (p_reserva, p_usuario, p_motivo);
  SELECT l.penalidad, l.reembolso INTO v_pen, v_reemb FROM v_cancelacion_liquidacion l WHERE l.reserva_id = p_reserva;
  UPDATE reserva SET estado = 'CANCELADA', expira_en = NULL WHERE id = p_reserva RETURNING codigo INTO v_cod;
  IF v_reemb > 0 THEN
    INSERT INTO pago (reserva_id, tipo, monto, referencia) VALUES (p_reserva, 'REEMBOLSO', v_reemb, 'REF-' || v_cod);
  END IF;
  UPDATE factura SET estado = 'ANULADA', anulada_en = now() WHERE reserva_id = p_reserva AND estado = 'EMITIDA';
  RETURN QUERY SELECT v_pen, v_reemb;
END $$;

-- Jobs periódicos (el backend los agenda, p. ej. cada 5-15 min)
CREATE OR REPLACE FUNCTION fn_expirar_solicitudes() RETURNS integer LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  UPDATE reserva SET estado = 'EXPIRADA', expira_en = NULL WHERE estado = 'PENDIENTE' AND expira_en < now();
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END $$;

CREATE OR REPLACE FUNCTION fn_completar_estancias() RETURNS integer LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  UPDATE reserva SET estado = 'COMPLETADA'
   WHERE estado = 'CONFIRMADA' AND fecha_salida <= (now() AT TIME ZONE 'America/Guayaquil')::date;
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END $$;

-- Búsqueda del marketplace: una fila por alojamiento con cupo en las fechas pedidas
CREATE OR REPLACE FUNCTION fn_buscar_alojamientos(
  p_entrada date, p_salida date, p_huespedes integer DEFAULT 1,
  p_provincia provincia_ec DEFAULT NULL, p_ciudad smallint DEFAULT NULL,
  p_aeropuerto char(3) DEFAULT NULL, p_max_km numeric DEFAULT NULL,
  p_tipo smallint DEFAULT NULL, p_precio_max numeric DEFAULT NULL, p_estrellas_min smallint DEFAULT NULL,
  p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
RETURNS TABLE (alojamiento_id uuid, nombre varchar, tipo varchar, ciudad varchar, provincia provincia_ec,
               estrellas smallint, precio_desde_noche numeric, aeropuerto char, distancia_km numeric,
               tiempo_min smallint, ofrece_transfer boolean, calificacion numeric, num_resenas bigint, portada text)
LANGUAGE sql STABLE AS $$
  SELECT a.id, a.nombre, ta.nombre, c.nombre, c.provincia, a.categoria_estrellas, d.precio_desde,
         ae.codigo_iata, aa.distancia_km, aa.tiempo_min, aa.ofrece_transfer, rt.prom, COALESCE(rt.n, 0), pi.url
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
     SELECT x.* FROM alojamiento_aeropuerto x JOIN aeropuerto y ON y.id = x.aeropuerto_id
      WHERE x.alojamiento_id = a.id AND (p_aeropuerto IS NULL OR y.codigo_iata = p_aeropuerto)
      ORDER BY x.distancia_km LIMIT 1) aa ON true
  LEFT JOIN aeropuerto ae ON ae.id = aa.aeropuerto_id
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
    AND (p_aeropuerto IS NULL OR aa.aeropuerto_id IS NOT NULL)
    AND (p_max_km IS NULL OR aa.distancia_km <= p_max_km)
  ORDER BY aa.distancia_km NULLS LAST, d.precio_desde
  LIMIT p_limit OFFSET p_offset $$;

-- ---------------------------------------------------------------------
-- 14. SEGURIDAD (Supabase): RLS sin políticas = la API pública no accede a las tablas.
--     El backend se conecta con el rol 'postgres', que omite RLS.
-- ---------------------------------------------------------------------
DO $$ DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'booking' LOOP
    EXECUTE format('ALTER TABLE booking.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 15. CATÁLOGOS INICIALES
-- ---------------------------------------------------------------------
-- Tipos oficiales del Reglamento de Alojamiento Turístico + tipos no categorizados
INSERT INTO tipo_alojamiento (nombre) VALUES
 ('Hotel'),('Hostal'),('Hostería'),('Hacienda turística'),('Lodge'),('Resort'),('Refugio'),
 ('Campamento turístico'),('Casa de huéspedes'),('Casa'),('Departamento'),('Habitación privada'),('Cabaña');

INSERT INTO politica_cancelacion (nombre, descripcion) VALUES
 ('FLEXIBLE','Gratis hasta 48 h antes del check-in; entre 48 y 24 h se cobra el 50% del hospedaje; con menos de 24 h, el 100%.'),
 ('MODERADA','Gratis hasta 5 días (120 h) antes; entre 5 días y 48 h se cobra el 50%; con menos de 48 h, el 100%.'),
 ('NO_REEMBOLSABLE','Se cobra el 100% del hospedaje en cualquier momento.');
INSERT INTO politica_cancelacion_regla (politica_id, horas_minimas, porcentaje_penalidad)
SELECT p.id, v.h, v.pct FROM politica_cancelacion p JOIN (VALUES
 ('FLEXIBLE',48,0),('FLEXIBLE',24,50),('FLEXIBLE',0,100),
 ('MODERADA',120,0),('MODERADA',48,50),('MODERADA',0,100),
 ('NO_REEMBOLSABLE',0,100)) v(n,h,pct) ON v.n = p.nombre;

-- IVA general y cargo de servicio. Los feriados con IVA reducido NO se siembran:
-- el ADMIN los registra desde el decreto oficial (verificar en el SRI), por ejemplo:
--   INSERT INTO impuesto_tarifa (nombre,tipo,porcentaje,vigente_desde,vigente_hasta,requiere_registro_turismo)
--   VALUES ('IVA turismo - Feriado X','IVA',8,'2026-12-24','2026-12-27',true);
INSERT INTO impuesto_tarifa (nombre, tipo, porcentaje, vigente_desde, requiere_registro_turismo, estrellas_minimas) VALUES
 ('IVA general','IVA',15,'2024-04-01',false,NULL),
 ('Servicio 10% (4 y 5 estrellas)','SERVICIO',10,'2015-01-01',false,4);

INSERT INTO ciudad (provincia, nombre, latitud, longitud) VALUES
 ('Pichincha','Quito',-0.180700,-78.467800),('Pichincha','Mindo',-0.052700,-78.776100),('Pichincha','Tababela',-0.116700,-78.350000),
 ('Guayas','Guayaquil',-2.171000,-79.922400),('Azuay','Cuenca',-2.900100,-79.005900),('Cotopaxi','Latacunga',-0.931900,-78.615000),
 ('Manabí','Manta',-0.967700,-80.708900),('Manabí','Portoviejo',-1.054600,-80.454500),('Manabí','Puerto López',-1.554700,-80.808800),
 ('Loja','Loja',-3.993100,-79.204200),('Loja','Vilcabamba',-4.261000,-79.221000),('Loja','Catamayo',-3.988900,-79.354700),
 ('Galápagos','Puerto Ayora',-0.743000,-90.313000),('Galápagos','Puerto Baquerizo Moreno',-0.900000,-89.610000),('Galápagos','Baltra',-0.454000,-90.266000),
 ('Tungurahua','Baños de Agua Santa',-1.396400,-78.424700),('Tungurahua','Ambato',-1.241700,-78.619700),('Chimborazo','Riobamba',-1.663600,-78.654600),
 ('Imbabura','Otavalo',0.234200,-78.261000),('Imbabura','Ibarra',0.351700,-78.122300),('Esmeraldas','Esmeraldas',0.959200,-79.654000),
 ('Esmeraldas','Atacames',0.870600,-79.842000),('Santa Elena','Salinas',-2.214600,-80.954600),('Santa Elena','Montañita',-1.827500,-80.752800),
 ('Napo','Tena',-0.993800,-77.812900),('Pastaza','Puyo',-1.492400,-78.002400),('El Oro','Machala',-3.258100,-79.955400),
 ('Santo Domingo de los Tsáchilas','Santo Domingo',-0.253000,-79.175400),('Orellana','Coca',-0.466000,-76.987000),
 ('Sucumbíos','Lago Agrio',0.084700,-76.890600),('Carchi','Tulcán',0.811900,-77.717300),('Cañar','Azogues',-2.739700,-78.848600),
 ('Bolívar','Guaranda',-1.590500,-79.001000),('Morona Santiago','Macas',-2.308700,-78.111400),
 ('Zamora Chinchipe','Zamora',-4.069200,-78.956700),('Los Ríos','Babahoyo',-1.802200,-79.534400);

INSERT INTO aeropuerto (codigo_iata, nombre, ciudad_id, latitud, longitud) VALUES
 ('UIO','Aeropuerto Internacional Mariscal Sucre',        (SELECT id FROM ciudad WHERE nombre='Tababela'),      -0.129167,-78.357500),
 ('GYE','Aeropuerto Internacional José Joaquín de Olmedo',(SELECT id FROM ciudad WHERE nombre='Guayaquil'),     -2.157419,-79.883558),
 ('CUE','Aeropuerto Mariscal Lamar',                      (SELECT id FROM ciudad WHERE nombre='Cuenca'),       -2.889475,-78.984397),
 ('GPS','Aeropuerto Seymour (Baltra)',                    (SELECT id FROM ciudad WHERE nombre='Baltra'),       -0.453758,-90.265917),
 ('SCY','Aeropuerto San Cristóbal',                       (SELECT id FROM ciudad WHERE nombre='Puerto Baquerizo Moreno'), -0.910206,-89.617433),
 ('MEC','Aeropuerto Internacional Eloy Alfaro (Manta)',   (SELECT id FROM ciudad WHERE nombre='Manta'),        -0.946078,-80.678808),
 ('LTX','Aeropuerto Internacional Cotopaxi',              (SELECT id FROM ciudad WHERE nombre='Latacunga'),    -0.906836,-78.615761),
 ('LOH','Aeropuerto Camilo Ponce Enríquez',               (SELECT id FROM ciudad WHERE nombre='Catamayo'),     -3.995889,-79.371889);

-- (mascotas, fumar y fiestas son reglas de la casa, no amenidades)
INSERT INTO amenidad (nombre, categoria) VALUES
 ('Wi-Fi','Esenciales'),('Agua caliente','Esenciales'),('Cocina equipada','Esenciales'),
 ('Aire acondicionado','Clima'),('Calefacción','Clima'),('TV','Entretenimiento'),
 ('Parqueadero gratuito','Estacionamiento'),('Piscina','Exteriores'),('Jacuzzi','Exteriores'),
 ('Desayuno incluido','Servicios'),('Transporte desde/hacia el aeropuerto','Servicios'),
 ('Recepción 24 horas','Servicios'),('Lavandería','Servicios'),
 ('Accesible para silla de ruedas','Accesibilidad'),('Restaurante','Servicios'),('Gimnasio','Exteriores');

-- ---------------------------------------------------------------------
-- 16. DOCUMENTACIÓN DE TABLAS (visible con \dt+ o en el panel de Supabase)
-- ---------------------------------------------------------------------
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
COMMENT ON TABLE evento_outbox              IS 'Eventos de negocio (outbox) escritos en la misma transacción que el cambio, para publicarlos y trazar cada flujo.';

DO $$ BEGIN
  RAISE NOTICE 'OK: % tablas, % ciudades, % aeropuertos, % tipos de alojamiento',
    (SELECT count(*) FROM pg_tables WHERE schemaname='booking'),
    (SELECT count(*) FROM ciudad), (SELECT count(*) FROM aeropuerto), (SELECT count(*) FROM tipo_alojamiento);
END $$;
