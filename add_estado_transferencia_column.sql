-- Script para agregar la columna estado_transferencia a la tabla venta
-- Ejecutar este script en la base de datos PostgreSQL/Supabase

-- Agregar la columna estado_transferencia si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'venta' AND column_name = 'estado_transferencia'
    ) THEN
        ALTER TABLE venta ADD COLUMN estado_transferencia VARCHAR(20) DEFAULT 'esperando';
        ALTER TABLE venta ADD CONSTRAINT chk_estado_transferencia CHECK (estado_transferencia IN ('esperando', 'recibido'));
        RAISE NOTICE 'Columna estado_transferencia agregada exitosamente a la tabla venta';
    ELSE
        RAISE NOTICE 'La columna estado_transferencia ya existe en la tabla venta';
    END IF;
END $$;