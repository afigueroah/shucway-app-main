-- Migration: Add cantidad_insumo to producto_variante table
-- Date: 2025-11-22
-- Description: Add cantidad_insumo field to specify the amount of insumo to deduct from inventory for product variants

ALTER TABLE producto_variante
ADD COLUMN cantidad_insumo DECIMAL(10,3) DEFAULT 0;