-- Migración: Agregar columna id_sesion a tabla arqueo_caja
-- Fecha: 2025-11-30
-- Descripción: Agrega referencia a caja_sesion para relacionar arqueos con sesiones

-- Agregar columna id_sesion a arqueo_caja para relacionarla con caja_sesion
ALTER TABLE arqueo_caja ADD COLUMN IF NOT EXISTS id_sesion INTEGER REFERENCES caja_sesion(id_sesion);

-- Crear índice para mejorar rendimiento de consultas JOIN
CREATE INDEX IF NOT EXISTS idx_arqueo_caja_id_sesion ON arqueo_caja(id_sesion);