-- Migration: Add acumula_puntos column to venta table
-- This column controls whether points should be accumulated for a sale

BEGIN;

ALTER TABLE venta ADD COLUMN IF NOT EXISTS acumula_puntos BOOLEAN DEFAULT TRUE;

COMMIT;