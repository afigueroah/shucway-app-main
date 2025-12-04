-- Agregar campos para transferencias pendientes en tabla venta
ALTER TABLE venta ADD COLUMN IF NOT EXISTS numero_referencia VARCHAR(50);
ALTER TABLE venta ADD COLUMN IF NOT EXISTS nombre_banco VARCHAR(100);