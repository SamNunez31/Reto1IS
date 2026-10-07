-- =====================================================================
--  Regla: un mismo huésped no puede tener dos reservas activas (PENDIENTE/CONFIRMADA)
--  de la misma unidad con fechas que se solapan (incluye la reserva idéntica).
--  Error nuevo: RESERVA_DUPLICADA -> HTTP 409 (ProblemDetails.code = VALIDATION_FAILED).
--  Idempotente: solo reemplaza fn_crear_orden (misma firma). Ejecutar en el SQL Editor de Supabase
--  ANTES de desplegar el backend. Un reintento con el mismo preview sigue devolviendo la misma reserva.
-- =====================================================================
SET search_path = booking, public;

-- Crea la reserva a partir de un preview vigente (si el precio cambió: PRECIO_CAMBIO -> PRICE_CHANGED)
CREATE OR REPLACE FUNCTION fn_crear_orden(p_preview uuid, p_usuario uuid) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE p orden_preview%ROWTYPE; v_total numeric; v_aloj uuid; v_res uuid;
BEGIN
  SELECT * INTO p FROM orden_preview WHERE id = p_preview FOR UPDATE;
  IF NOT FOUND OR p.usuario_id <> p_usuario THEN RAISE EXCEPTION 'PREVIEW_NO_EXISTE: la previsualización no existe'; END IF;
  IF p.reserva_id IS NOT NULL THEN RETURN p.reserva_id; END IF;          -- reintento: devuelve la misma orden
  IF p.expira_en < now() THEN RAISE EXCEPTION 'PREVIEW_EXPIRADO: la previsualización expiró, vuelve a cotizar'; END IF;
  -- Regla de negocio: un mismo huésped no puede tener dos reservas activas de la misma unidad con fechas que se solapan
  IF EXISTS (SELECT 1 FROM reserva r JOIN reserva_detalle d ON d.reserva_id = r.id
              WHERE r.huesped_id = p_usuario AND d.unidad_id = p.unidad_id
                AND r.estado IN ('PENDIENTE','CONFIRMADA')
                AND r.fecha_entrada < p.fecha_salida AND r.fecha_salida > p.fecha_entrada) THEN
    RAISE EXCEPTION 'RESERVA_DUPLICADA: ya no está disponible para ti, porque ya tienes una reserva activa de este alojamiento en esas fechas';
  END IF;
  SELECT total INTO v_total FROM fn_cotizar(p.unidad_id, p.fecha_entrada, p.fecha_salida, p.cantidad);
  IF v_total <> p.total_cotizado THEN RAISE EXCEPTION 'PRECIO_CAMBIO: el precio cambió de % a %', p.total_cotizado, v_total; END IF;
  SELECT alojamiento_id INTO v_aloj FROM unidad_alojamiento WHERE id = p.unidad_id;
  v_res := fn_crear_reserva(p_usuario, v_aloj, p.fecha_entrada, p.fecha_salida, p.num_huespedes,
                            jsonb_build_array(jsonb_build_object('unidad_id', p.unidad_id, 'cantidad', p.cantidad)));
  UPDATE orden_preview SET reserva_id = v_res WHERE id = p.id;
  RETURN v_res;
END $$;
