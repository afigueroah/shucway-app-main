-- Migration: remove es_obligatorio column from receta_detalle
-- Fecha: 2025-11-22

ALTER TABLE receta_detalle
  DROP COLUMN IF EXISTS es_obligatorio;

-- Nota: si tu DB aún tiene filas que dependen de esta columna, asegúrate
-- de revisar la lógica de la app antes de ejecutar esta migración en producción.
