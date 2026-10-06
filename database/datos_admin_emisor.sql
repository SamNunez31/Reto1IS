-- =====================================================================
--  DATOS (DEMO): datos de EMISOR de factura para el administrador
--  ¿Por qué? El emisor de la factura es el dueño del alojamiento (vista v_factura).
--  Probado en una base temporal: con el admin como dueño, fn_emitir_factura SÍ emite,
--  pero la factura sale con emisor "Administrador Plataforma" y SIN identificación
--  (emisor_identificacion NULL), mientras que todas las facturas existentes tienen RUC/cédula
--  del emisor. Una factura sin identificación del emisor no es válida.
--
--  ATENCIÓN: RUC FICTICIO 1799999999001, solo para la demo académica (no existe en el SRI).
--  En producción, reemplazar por el RUC y la razón social reales del operador.
--
--  No pisa datos: solo actúa si el admin demo aún no tiene documento. Idempotente, una transacción.
--  Uso (Docker):  Get-Content database\datos_admin_emisor.sql -Raw |
--                   docker exec -i booking_db_container psql -U postgres -d booking_db -v ON_ERROR_STOP=1
-- =====================================================================
BEGIN;
SET LOCAL search_path = booking, public;

UPDATE usuario
   SET tipo_documento = 'RUC',
       numero_documento = '1799999999001',          -- FICTICIO (demo)
       razon_social = 'Posada EC (demo, RUC ficticio)'
 WHERE email = 'admin.plataforma@gmail.com'
   AND rol = 'ADMIN'
   AND numero_documento IS NULL;

COMMIT;
