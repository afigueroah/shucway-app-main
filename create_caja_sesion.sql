-- Crear tabla caja_sesion para manejar sesiones de caja
-- Esta tabla es necesaria para el funcionamiento del módulo de caja

CREATE TABLE IF NOT EXISTS caja_sesion (
    id_sesion SERIAL PRIMARY KEY,
    id_cajero_apertura INTEGER REFERENCES perfil_usuario(id_perfil),
    id_cajero_cierre INTEGER REFERENCES perfil_usuario(id_perfil),
    fecha_apertura TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_cierre TIMESTAMP,
    monto_inicial DECIMAL(10,2) DEFAULT 0,
    monto_cierre DECIMAL(10,2),
    observaciones TEXT,
    estado VARCHAR(20) DEFAULT 'abierta' CHECK (estado IN ('abierta', 'cerrada', 'expirada')),
    auto_cierre BOOLEAN DEFAULT FALSE
);

-- Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_caja_sesion_estado ON caja_sesion(estado);
CREATE INDEX IF NOT EXISTS idx_caja_sesion_fecha_apertura ON caja_sesion(fecha_apertura);
CREATE INDEX IF NOT EXISTS idx_caja_sesion_id_cajero_apertura ON caja_sesion(id_cajero_apertura);
CREATE INDEX IF NOT EXISTS idx_caja_sesion_id_cajero_cierre ON caja_sesion(id_cajero_cierre);