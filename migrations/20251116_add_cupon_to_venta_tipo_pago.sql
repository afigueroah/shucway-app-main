-- Migration: Allow 'Cupon' as a tipo_pago for ventas
-- Drop existing constraint and recreate it including 'Cupon'

BEGIN;

ALTER TABLE venta DROP CONSTRAINT IF EXISTS venta_tipo_pago_check;

ALTER TABLE venta ADD CONSTRAINT venta_tipo_pago_check CHECK (tipo_pago IN ('Cash', 'Transferencia', 'Paggo', 'Tarjeta', 'Canje', 'Cupon'));

COMMIT;
