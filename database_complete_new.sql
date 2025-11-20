-- ===============================================
-- BASE DE DATOS COMPLETA NUEVA PARA SHUCWAY
-- Combinación de BD-modificado.sql + database_functions_triggers.sql
-- ===============================================

-- ===============================================
-- 1. TABLAS DE AUTENTICACIÓN Y USUARIOS
-- ===============================================

-- TABLA DE ROLES
CREATE TABLE IF NOT EXISTS rol_usuario (
    id_rol SERIAL PRIMARY KEY,
    nombre_rol VARCHAR(50) NOT NULL UNIQUE CHECK (nombre_rol IN ('cliente', 'cajero', 'administrador', 'propietario')),
    descripcion TEXT,
    nivel_permisos INTEGER DEFAULT 0 CHECK (nivel_permisos >= 0 AND nivel_permisos <= 100),
    permisos JSONB DEFAULT '{}'::jsonb,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS perfil_usuario (
    id_perfil SERIAL PRIMARY KEY,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    
    primer_nombre VARCHAR(50) NOT NULL,
    segundo_nombre VARCHAR(50),
    primer_apellido VARCHAR(50) NOT NULL,
    segundo_apellido VARCHAR(50),
    telefono VARCHAR(15),
    direccion TEXT,
    fecha_nacimiento DATE,
    username VARCHAR(50) UNIQUE,
    avatar_url VARCHAR(255),
    
    id_rol INTEGER NOT NULL REFERENCES rol_usuario(id_rol) ON DELETE RESTRICT,
    
    estado VARCHAR(20) DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo', 'suspendido', 'eliminado')),
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ultimo_acceso TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bitacora_seguridad (
    id_bitacora_seguridad SERIAL PRIMARY KEY,
    id_perfil INTEGER NOT NULL REFERENCES perfil_usuario(id_perfil) ON DELETE CASCADE,

    intentos_fallidos INTEGER DEFAULT 0,
    ultimo_intento_fallido TIMESTAMP,
    bloqueado_hasta TIMESTAMP,

    token_recuperacion VARCHAR(255),
    token_expiracion TIMESTAMP,

    tipo_evento VARCHAR(50) CHECK (tipo_evento IN (
        'login_exitoso', 'login_fallido', 'logout',
        'cambio_password', 'recuperacion_password',
        'bloqueo_cuenta', 'desbloqueo_cuenta',
        'actualizacion_perfil'
    )),
    ip_address VARCHAR(45),
    user_agent TEXT,
    descripcion TEXT,
    fecha_evento TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ELIMINAR LA CONSTRAINT PROBLEMÁTICA
ALTER TABLE bitacora_seguridad DROP CONSTRAINT IF EXISTS unique_active_token;

-- Crear un índice único solo para tokens de recuperación (cuando no son null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_token_recuperacion
ON bitacora_seguridad (id_perfil, token_recuperacion)
WHERE token_recuperacion IS NOT NULL;

-- ===============================================
-- MÓDULO: Inventario (Modelo Híbrido Perpetuo + Operativo)
-- ===============================================

CREATE TABLE categoria_insumo (
    id_categoria SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT,
    tipo_categoria VARCHAR(20) DEFAULT 'operativo' CHECK (tipo_categoria IN ('perpetuo', 'operativo'))
);

CREATE TABLE proveedor (
    id_proveedor SERIAL PRIMARY KEY,
    nombre_empresa VARCHAR(100) NOT NULL,
    nombre_contacto VARCHAR(100),
    telefono VARCHAR(20),
    correo VARCHAR(100),
    direccion TEXT,
    estado BOOLEAN DEFAULT TRUE,
    metodo_entrega VARCHAR(50) CHECK (metodo_entrega IN ('Recepcion', 'Recoger en tienda')),
    es_preferido BOOLEAN DEFAULT FALSE
);

CREATE TABLE insumo (
    id_insumo SERIAL PRIMARY KEY,
    nombre_insumo VARCHAR(100) NOT NULL,
    id_categoria INTEGER NOT NULL REFERENCES categoria_insumo(id_categoria),
    unidad_base VARCHAR(20) NOT NULL,
    id_proveedor_principal INTEGER REFERENCES proveedor(id_proveedor),
    stock_minimo DECIMAL(10,2) DEFAULT 0.00,
    stock_maximo DECIMAL(10,2) DEFAULT 0.00,
    costo_promedio DECIMAL(10,2) DEFAULT 0,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    insumo_url VARCHAR(255),
    activo BOOLEAN DEFAULT TRUE
);

-- TABLA DE PRESENTACIONES DE INSUMOS
CREATE TABLE IF NOT EXISTS insumo_presentacion (
    id_presentacion SERIAL PRIMARY KEY,
    id_insumo INTEGER NOT NULL REFERENCES insumo(id_insumo) ON DELETE CASCADE,
    id_proveedor INTEGER REFERENCES proveedor(id_proveedor),
    descripcion_presentacion TEXT NOT NULL,
    unidad_compra TEXT NOT NULL,
    unidades_por_presentacion NUMERIC NOT NULL DEFAULT 1,
    costo_compra_unitario NUMERIC(12,2) NOT NULL,
    es_principal BOOLEAN DEFAULT TRUE,
    activo BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_insu_pres_insumo ON insumo_presentacion(id_insumo);

CREATE TABLE lote_insumo (
    id_lote SERIAL PRIMARY KEY,
    id_insumo INTEGER REFERENCES insumo(id_insumo),
    fecha_vencimiento DATE,
    cantidad_inicial DECIMAL(10,2) NOT NULL,
    cantidad_actual DECIMAL(10,2) NOT NULL CHECK (cantidad_actual >= 0),
    costo_unitario DECIMAL(10,2),
    ubicacion VARCHAR(100)
);

CREATE TABLE movimiento_inventario (
    id_movimiento SERIAL PRIMARY KEY,
    id_insumo INTEGER REFERENCES insumo(id_insumo),
    id_lote INTEGER REFERENCES lote_insumo(id_lote),
    tipo_movimiento VARCHAR(20) CHECK (tipo_movimiento IN (
        'entrada_compra', 'salida_venta', 'entrada_ajuste', 'salida_ajuste', 'perdida', 'devolucion',
        'ajuste_perpetuo', 'ajuste_operativo'
    )),
    cantidad DECIMAL(10,2) NOT NULL,
    fecha_movimiento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    id_perfil INTEGER REFERENCES perfil_usuario(id_perfil),
    id_referencia INTEGER,
    descripcion TEXT,
    costo_unitario_momento DECIMAL(10,2) DEFAULT 0,
    costo_total DECIMAL(12,2) GENERATED ALWAYS AS (cantidad * costo_unitario_momento) STORED
);

-- ===============================================================
-- MÓDULO: Compras y Proveedores 
-- ===============================================================

CREATE TABLE orden_compra (
    id_orden SERIAL PRIMARY KEY,
    numero_orden VARCHAR(20) NULL,
    fecha_orden TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    id_proveedor INTEGER REFERENCES proveedor(id_proveedor),
    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'recibida', 'rechazado')),
    tipo_orden VARCHAR(20) DEFAULT 'manual' CHECK (tipo_orden IN ('manual', 'automatica')),
    motivo_generacion TEXT,
    fecha_aprobacion TIMESTAMP,
    total DECIMAL(12,2) DEFAULT 0,
    tipo_pago VARCHAR(20) DEFAULT 'credito' CHECK (tipo_pago IN ('efectivo', 'transferencias', 'tarjeta', 'credito')),
    fecha_entrega_estimada DATE,
    creado_por INTEGER REFERENCES perfil_usuario(id_perfil),
    aprobado_por INTEGER REFERENCES perfil_usuario(id_perfil)
);

CREATE TABLE detalle_orden_compra (
    id_detalle SERIAL PRIMARY KEY,
    id_orden INTEGER REFERENCES orden_compra(id_orden) ON DELETE CASCADE,
    id_insumo INTEGER REFERENCES insumo(id_insumo),
    cantidad DECIMAL(10,2) NOT NULL,
    precio_unitario DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(12,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
    iva DECIMAL(12,2) DEFAULT 0,
    cantidad_recibida DECIMAL(10,2) DEFAULT 0,
    id_presentacion INTEGER NOT NULL REFERENCES insumo_presentacion(id_presentacion)
);

-- Función para actualizar unidad_base en receta_detalle
CREATE OR REPLACE FUNCTION fn_actualizar_unidad_base_receta()
RETURNS TRIGGER AS $$
BEGIN
    -- Obtener la unidad_base del insumo y asignarla a unidad_base
    SELECT unidad_base INTO NEW.unidad_base
    FROM insumo
    WHERE id_insumo = NEW.id_insumo;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para calcular IVA en detalle_orden_compra
CREATE OR REPLACE FUNCTION fn_calcular_iva_detalle_oc()
RETURNS TRIGGER AS $$
BEGIN
    -- Calcular subtotal y IVA
    NEW.subtotal := NEW.cantidad * NEW.precio_unitario;
    NEW.iva := NEW.subtotal * 0.12;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para calcular IVA automáticamente en detalle_orden_compra
DROP TRIGGER IF EXISTS trg_calcular_iva_detalle_oc ON detalle_orden_compra;
CREATE TRIGGER trg_calcular_iva_detalle_oc
BEFORE INSERT OR UPDATE ON detalle_orden_compra
FOR EACH ROW
EXECUTE FUNCTION fn_calcular_iva_detalle_oc();

CREATE TABLE recepcion_mercaderia (
    id_recepcion SERIAL PRIMARY KEY,
    id_orden INTEGER REFERENCES orden_compra(id_orden),
    fecha_recepcion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    id_perfil INTEGER REFERENCES perfil_usuario(id_perfil),
    numero_factura VARCHAR(50)
);

CREATE TABLE detalle_recepcion_mercaderia (
    id_detalle SERIAL PRIMARY KEY,
    id_recepcion INTEGER REFERENCES recepcion_mercaderia(id_recepcion),
    id_detalle_orden INTEGER REFERENCES detalle_orden_compra(id_detalle),
    cantidad_recibida DECIMAL(10,2) NOT NULL,
    cantidad_aceptada DECIMAL(10,2) NOT NULL,
    id_lote INTEGER REFERENCES lote_insumo(id_lote),
    id_presentacion INTEGER REFERENCES insumo_presentacion(id_presentacion), -- Nueva columna
    CHECK (cantidad_aceptada = cantidad_recibida AND cantidad_recibida > 0)
);

-- ===============================================================
-- MÓDULO: Productos y Ventas 
-- ===============================================================

CREATE TABLE categoria_producto (
    id_categoria SERIAL PRIMARY KEY,
    nombre_categoria VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT,
    estado VARCHAR(20) DEFAULT 'activo' CHECK (estado IN ('activo', 'desactivado'))
);

CREATE TABLE producto (
    id_producto SERIAL PRIMARY KEY,
    nombre_producto VARCHAR(100) NOT NULL,
    descripcion TEXT,
    precio_venta DECIMAL(10,2) NOT NULL,
    costo_producto DECIMAL(10,2) DEFAULT 0, 
    id_categoria INTEGER REFERENCES categoria_producto(id_categoria),
    estado VARCHAR(20) DEFAULT 'activo' CHECK (estado IN ('activo', 'desactivado')),
    imagen_url VARCHAR(255),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE producto_variante (
    id_variante SERIAL PRIMARY KEY,
    id_producto INTEGER NOT NULL REFERENCES producto(id_producto) ON DELETE CASCADE,
    id_insumo INTEGER REFERENCES insumo(id_insumo),
    nombre_variante VARCHAR(100) NOT NULL,
    costo_variante DECIMAL(10,2) DEFAULT 0, 
    precio_variante DECIMAL(10,2) DEFAULT 0, 
    estado VARCHAR(20) DEFAULT 'activo' CHECK (estado IN ('activo', 'desactivado')),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(id_producto, nombre_variante)
);

CREATE TABLE receta_detalle (
    id_receta SERIAL PRIMARY KEY,
    id_producto INTEGER NOT NULL REFERENCES producto(id_producto) ON DELETE CASCADE,
    id_variante INTEGER REFERENCES producto_variante(id_variante),
    id_insumo INTEGER NOT NULL REFERENCES insumo(id_insumo) ON DELETE RESTRICT,
    cantidad_requerida DECIMAL(10,3) NOT NULL,
    unidad_base VARCHAR(20),
    es_obligatorio BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(id_producto, id_insumo, id_variante)
);

-- Trigger para actualizar unidad_base automáticamente en receta_detalle
DROP TRIGGER IF EXISTS trg_actualizar_unidad_base_receta ON receta_detalle;
CREATE TRIGGER trg_actualizar_unidad_base_receta
BEFORE INSERT OR UPDATE ON receta_detalle
FOR EACH ROW
EXECUTE FUNCTION fn_actualizar_unidad_base_receta();

CREATE TABLE cliente (
    id_cliente SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    telefono VARCHAR(15),
    puntos_acumulados INTEGER DEFAULT 0,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ultima_compra TIMESTAMP
);

CREATE TABLE venta (
    id_venta SERIAL PRIMARY KEY, 
    fecha_venta TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    id_cliente INTEGER REFERENCES cliente(id_cliente),
    tipo_pago VARCHAR(20) DEFAULT 'Cash' CHECK (tipo_pago IN ('Cash', 'Transferencia', 'Paggo', 'Tarjeta', 'Canje', 'Cupon')),
    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmada', 'completada', 'cancelada')),
    total_venta DECIMAL(12,2) DEFAULT 0,
    total_costo DECIMAL(12,2) DEFAULT 0,
    ganancia DECIMAL(12,2) GENERATED ALWAYS AS (total_venta - total_costo) STORED,
    id_cajero INTEGER REFERENCES perfil_usuario(id_perfil), 
    acumula_puntos BOOLEAN DEFAULT TRUE,
    notas TEXT
);

CREATE TABLE detalle_venta (
    id_detalle SERIAL PRIMARY KEY,
    id_venta INTEGER REFERENCES venta(id_venta) ON DELETE CASCADE,
    id_producto INTEGER REFERENCES producto(id_producto),
    id_variante INTEGER REFERENCES producto_variante(id_variante), -- Sub-artículo (opcional)
    cantidad DECIMAL(10,2) NOT NULL,
    precio_unitario DECIMAL(10,2) NOT NULL,
    costo_unitario DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(12,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
    costo_total DECIMAL(12,2) GENERATED ALWAYS AS (cantidad * costo_unitario) STORED,
    ganancia DECIMAL(12,2) GENERATED ALWAYS AS ((precio_unitario - costo_unitario) * cantidad) STORED,
    descuento DECIMAL(10,2) DEFAULT 0,
    es_canje_puntos BOOLEAN DEFAULT FALSE, -- TRUE si es producto gratis por canje de 10 puntos
    puntos_canjeados INTEGER DEFAULT 0 
);

-- ===============================================================
-- MÓDULO: Gastos Operativos y Movimientos
-- ===============================================================

CREATE TABLE categoria_gasto (
    id_categoria SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT,
    tipo_gasto VARCHAR(20) DEFAULT 'operativo' CHECK (tipo_gasto IN ('operativo', 'inversion')),
    activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE gasto_operativo (
    id_gasto SERIAL PRIMARY KEY,
    numero_gasto VARCHAR(20) GENERATED ALWAYS AS ('GAST-' || LPAD(id_gasto::TEXT, 6, '0')) STORED,
    fecha_gasto DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    nombre_gasto VARCHAR(120) NOT NULL,
    categoria_gasto VARCHAR(80) NOT NULL CHECK (categoria_gasto IN (
        'Gastos de Personal',
        'Servicios Fijos (Mensuales)',
        'Insumos Operativos',
        'Gastos de Transporte',
        'Mantenimiento y Reemplazos'
    )),
    detalle TEXT NOT NULL,
    frecuencia VARCHAR(15) NOT NULL CHECK (frecuencia IN ('quincenal', 'mensual')),
    monto DECIMAL(12,2) NOT NULL CHECK (monto > 0),
    CONSTRAINT uq_gasto_operativo_num UNIQUE (numero_gasto)
);

CREATE INDEX IF NOT EXISTS idx_gasto_operativo_categoria ON gasto_operativo(categoria_gasto);
CREATE INDEX IF NOT EXISTS idx_gasto_operativo_frecuencia ON gasto_operativo(frecuencia);

CREATE TABLE deposito_banco (
    id_deposito SERIAL PRIMARY KEY,
    fecha_deposito TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    descripcion TEXT NOT NULL,
    tipo_pago VARCHAR(20) NOT NULL CHECK (tipo_pago IN ('Transferencia')),
    monto DECIMAL(12,2) NOT NULL,
    id_perfil INTEGER REFERENCES perfil_usuario(id_perfil),
    comprobante_url VARCHAR(255),
    notas TEXT,
    nombre_cliente VARCHAR(100),
    numero_referencia VARCHAR(50),
    nombre_banco VARCHAR(100)
);

-- TABLA DE ARQUEO DE CAJA
CREATE TABLE arqueo_caja (
    id_arqueo SERIAL PRIMARY KEY,
    fecha_arqueo DATE DEFAULT CURRENT_DATE,
    id_cajero INTEGER REFERENCES perfil_usuario(id_perfil),
    billetes_100 INTEGER DEFAULT 0,
    billetes_50 INTEGER DEFAULT 0,
    billetes_20 INTEGER DEFAULT 0,
    billetes_10 INTEGER DEFAULT 0,
    billetes_5 INTEGER DEFAULT 0,
    monedas_1 INTEGER DEFAULT 0,
    monedas_050 INTEGER DEFAULT 0,
    monedas_025 INTEGER DEFAULT 0,
    total_billetes_100 DECIMAL(10,2) GENERATED ALWAYS AS (billetes_100 * 100) STORED,
    total_billetes_50 DECIMAL(10,2) GENERATED ALWAYS AS (billetes_50 * 50) STORED,
    total_billetes_20 DECIMAL(10,2) GENERATED ALWAYS AS (billetes_20 * 20) STORED,
    total_billetes_10 DECIMAL(10,2) GENERATED ALWAYS AS (billetes_10 * 10) STORED,
    total_billetes_5 DECIMAL(10,2) GENERATED ALWAYS AS (billetes_5 * 5) STORED,
    total_monedas_1 DECIMAL(10,2) GENERATED ALWAYS AS (monedas_1 * 1) STORED,
    total_monedas_050 DECIMAL(10,2) GENERATED ALWAYS AS (monedas_050 * 0.50) STORED,
    total_monedas_025 DECIMAL(10,2) GENERATED ALWAYS AS (monedas_025 * 0.25) STORED,
    total_contado DECIMAL(12,2) GENERATED ALWAYS AS (
        billetes_100 * 100 + billetes_50 * 50 + billetes_20 * 20 + 
        billetes_10 * 10 + billetes_5 * 5 + monedas_1 * 1 + 
        monedas_050 * 0.50 + monedas_025 * 0.25
    ) STORED,
    -- Comparación con sistema
    total_sistema DECIMAL(12,2) NOT NULL, -- Total esperado según ventas
    diferencia DECIMAL(12,2) GENERATED ALWAYS AS (
        (billetes_100 * 100 + billetes_50 * 50 + billetes_20 * 20 + 
         billetes_10 * 10 + billetes_5 * 5 + monedas_1 * 1 + 
         monedas_050 * 0.50 + monedas_025 * 0.25) - total_sistema
    ) STORED,
    observaciones TEXT,
    estado VARCHAR(20) DEFAULT 'abierto' CHECK (estado IN ('abierto', 'cerrado', 'revisado'))
);

-- ===============================================================
-- MÓDULO: Sistema de Puntos de Lealtad
-- ===============================================================

-- TABLA DE HISTORIAL DE PUNTOS
CREATE TABLE historial_puntos (
    id_historial SERIAL PRIMARY KEY,
    id_cliente INTEGER NOT NULL REFERENCES cliente(id_cliente) ON DELETE CASCADE,
    id_venta INTEGER REFERENCES venta(id_venta),
    tipo_movimiento VARCHAR(20) NOT NULL CHECK (tipo_movimiento IN ('acumulacion', 'canje', 'ajuste', 'expiracion')),
    puntos_anterior INTEGER NOT NULL,
    puntos_movimiento INTEGER NOT NULL,
    puntos_nuevo INTEGER NOT NULL,
    descripcion TEXT,
    fecha_movimiento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    id_cajero INTEGER REFERENCES perfil_usuario(id_perfil)
);

-- Función para consultar puntos del cliente (fallback sencillo sobre columna puntos_acumulados)
CREATE OR REPLACE FUNCTION fn_consultar_puntos(p_id_cliente INTEGER)
RETURNS INTEGER AS $$
DECLARE
    v_puntos INTEGER := 0;
BEGIN
    SELECT COALESCE(puntos_acumulados, 0) INTO v_puntos
    FROM cliente
    WHERE id_cliente = p_id_cliente;

    RETURN v_puntos;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===============================================================
-- MÓDULO: Bitácoras de Auditoría
-- ===============================================================

-- BITÁCORA DE CAMBIOS EN INVENTARIO
CREATE TABLE bitacora_inventario (
    id_bitacora_inventario SERIAL PRIMARY KEY,
    id_insumo INTEGER REFERENCES insumo(id_insumo),
    accion VARCHAR(50) CHECK (accion IN (
        'creacion', 'actualizacion', 'eliminacion',
        'cambio_precio', 'cambio_proveedor', 'cambio_stock_limites',
        'ajuste_manual'
    )),
    campo_modificado VARCHAR(100),
    valor_anterior TEXT,
    valor_nuevo TEXT,
    id_perfil INTEGER REFERENCES perfil_usuario(id_perfil),
    fecha_accion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    descripcion TEXT
);

CREATE TABLE bitacora_ventas (
    id_bitacora_venta SERIAL PRIMARY KEY,
    id_venta INTEGER REFERENCES venta(id_venta) ON DELETE CASCADE,
    accion VARCHAR(50) CHECK (accion IN (
        'creacion', 'modificacion', 'cancelacion',
        'cambio_estado', 'descuento_aplicado'
    )),
    estado_anterior VARCHAR(20),
    estado_nuevo VARCHAR(20),
    id_perfil INTEGER REFERENCES perfil_usuario(id_perfil),
    fecha_accion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    descripcion TEXT,
    datos_adicionales JSONB
);

CREATE TABLE bitacora_ordenes_compra (
    id_bitacora_orden SERIAL PRIMARY KEY,
    id_orden INTEGER REFERENCES orden_compra(id_orden) ON DELETE CASCADE,
    accion VARCHAR(50) CHECK (accion IN (
        'creacion_manual', 'creacion_automatica', 
        'aprobacion', 'rechazo', 'cancelacion',
        'recepcion_parcial', 'recepcion_completa', 'modificacion',
        'creacion', 'eliminacion'
    )),
    estado_anterior VARCHAR(20),
    estado_nuevo VARCHAR(20),
    id_perfil INTEGER REFERENCES perfil_usuario(id_perfil),
    fecha_accion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    descripcion TEXT,
    datos_adicionales JSONB
);

CREATE TABLE bitacora_productos (
    id_bitacora_producto SERIAL PRIMARY KEY,
    id_producto INTEGER REFERENCES producto(id_producto) ON DELETE CASCADE,
    accion VARCHAR(50) CHECK (accion IN (
        'creacion', 'actualizacion', 'eliminacion',
        'cambio_precio', 'cambio_receta', 'cambio_estado'
    )),
    campo_modificado VARCHAR(100),
    valor_anterior TEXT,
    valor_nuevo TEXT,
    id_perfil INTEGER REFERENCES perfil_usuario(id_perfil),
    fecha_accion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    descripcion TEXT
);

-- ===============================================
-- ÍNDICES PARA MEJOR RENDIMIENTO
-- ===============================================================
CREATE INDEX IF NOT EXISTS idx_perfil_email ON perfil_usuario(email);
CREATE INDEX IF NOT EXISTS idx_perfil_username ON perfil_usuario(username);
CREATE INDEX IF NOT EXISTS idx_perfil_rol ON perfil_usuario(id_rol);
CREATE INDEX IF NOT EXISTS idx_perfil_estado ON perfil_usuario(estado);
CREATE INDEX IF NOT EXISTS idx_bitacora_perfil ON bitacora_seguridad(id_perfil);
CREATE INDEX IF NOT EXISTS idx_bitacora_tipo_evento ON bitacora_seguridad(tipo_evento);
CREATE INDEX IF NOT EXISTS idx_bitacora_fecha ON bitacora_seguridad(fecha_evento);
CREATE INDEX IF NOT EXISTS idx_bitacora_token ON bitacora_seguridad(token_recuperacion) WHERE token_recuperacion IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_insumo_categoria ON insumo(id_categoria);
CREATE INDEX IF NOT EXISTS idx_insumo_nombre ON insumo(nombre_insumo); -- Para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_lote_vencimiento ON lote_insumo(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_lote_insumo ON lote_insumo(id_insumo);
CREATE INDEX IF NOT EXISTS idx_movimiento_fecha ON movimiento_inventario(fecha_movimiento);
CREATE INDEX IF NOT EXISTS idx_movimiento_insumo ON movimiento_inventario(id_insumo);
CREATE INDEX IF NOT EXISTS idx_orden_compra_estado ON orden_compra(estado);
CREATE INDEX IF NOT EXISTS idx_orden_compra_tipo ON orden_compra(tipo_orden);
CREATE INDEX IF NOT EXISTS idx_orden_compra_fecha ON orden_compra(fecha_orden);
CREATE INDEX IF NOT EXISTS idx_doc_orden ON detalle_orden_compra(id_orden);
CREATE INDEX IF NOT EXISTS idx_doc_presentacion ON detalle_orden_compra(id_presentacion);
CREATE INDEX IF NOT EXISTS idx_bitacora_inventario_insumo ON bitacora_inventario(id_insumo);
CREATE INDEX IF NOT EXISTS idx_bitacora_inventario_fecha ON bitacora_inventario(fecha_accion);
CREATE INDEX IF NOT EXISTS idx_bitacora_ventas_venta ON bitacora_ventas(id_venta);
CREATE INDEX IF NOT EXISTS idx_bitacora_ventas_fecha ON bitacora_ventas(fecha_accion);
CREATE INDEX IF NOT EXISTS idx_bitacora_ordenes_orden ON bitacora_ordenes_compra(id_orden);
CREATE INDEX IF NOT EXISTS idx_bitacora_ordenes_fecha ON bitacora_ordenes_compra(fecha_accion);
CREATE INDEX IF NOT EXISTS idx_bitacora_productos_producto ON bitacora_productos(id_producto);
CREATE INDEX IF NOT EXISTS idx_bitacora_productos_fecha ON bitacora_productos(fecha_accion);
CREATE INDEX IF NOT EXISTS idx_venta_fecha ON venta(fecha_venta);
CREATE INDEX IF NOT EXISTS idx_venta_tipo_pago ON venta(tipo_pago);
CREATE INDEX IF NOT EXISTS idx_detalle_venta_producto ON detalle_venta(id_producto);
CREATE INDEX IF NOT EXISTS idx_detalle_venta_variante ON detalle_venta(id_variante);
CREATE INDEX IF NOT EXISTS idx_receta_detalle_insumo ON receta_detalle(id_insumo);
CREATE INDEX IF NOT EXISTS idx_gasto_fecha ON gasto_operativo(fecha_gasto);
CREATE INDEX IF NOT EXISTS idx_deposito_fecha ON deposito_banco(fecha_deposito);
CREATE INDEX IF NOT EXISTS idx_historial_puntos_cliente ON historial_puntos(id_cliente);
CREATE INDEX IF NOT EXISTS idx_historial_puntos_venta ON historial_puntos(id_venta);
CREATE INDEX IF NOT EXISTS idx_historial_puntos_fecha ON historial_puntos(fecha_movimiento);
CREATE INDEX IF NOT EXISTS idx_recepcion_orden ON recepcion_mercaderia(id_orden);
CREATE INDEX IF NOT EXISTS idx_recepcion_fecha ON recepcion_mercaderia(fecha_recepcion);
CREATE INDEX IF NOT EXISTS idx_detalle_recepcion_recepcion ON detalle_recepcion_mercaderia(id_recepcion);
CREATE INDEX IF NOT EXISTS idx_detalle_recepcion_detalle_orden ON detalle_recepcion_mercaderia(id_detalle_orden);

-- ===============================================
-- FUNCIONES CRÍTICAS DEL SISTEMA
-- ===============================================================

-- FUNCIÓN PARA OBTENER EL STOCK REAL DE UN INSUMO SEGÚN SU CATEGORÍA
CREATE OR REPLACE FUNCTION fn_obtener_stock_actual(p_id_insumo INTEGER)
RETURNS DECIMAL(10, 2) AS $$
DECLARE
    v_stock_actual DECIMAL(10, 2);
    v_tipo_categoria VARCHAR(20);
BEGIN
    -- Obtener el tipo de categoría del insumo
    SELECT ci.tipo_categoria INTO v_tipo_categoria
    FROM insumo i
    JOIN categoria_insumo ci ON i.id_categoria = ci.id_categoria
    WHERE i.id_insumo = p_id_insumo;
    
    -- Calcular stock según el tipo de categoría
    IF v_tipo_categoria = 'perpetuo' THEN
        -- Para insumos perpetuos: usar movimiento_inventario con ajustes perpetuos
        SELECT COALESCE(SUM(
            CASE 
                WHEN tipo_movimiento IN ('entrada_compra', 'entrada_ajuste', 'devolucion', 'ajuste_perpetuo') THEN cantidad
                WHEN tipo_movimiento IN ('salida_venta', 'salida_ajuste', 'perdida') THEN -cantidad
                ELSE 0 
            END
        ), 0) INTO v_stock_actual
        FROM movimiento_inventario
        WHERE id_insumo = p_id_insumo;
    ELSE
        -- Para insumos operativos: usar movimiento_inventario con ajustes operativos
        SELECT COALESCE(SUM(
            CASE 
                WHEN tipo_movimiento IN ('entrada_compra', 'entrada_ajuste', 'devolucion', 'ajuste_operativo') THEN cantidad
                WHEN tipo_movimiento IN ('salida_venta', 'salida_ajuste', 'perdida') THEN -cantidad
                ELSE 0 
            END
        ), 0) INTO v_stock_actual
        FROM movimiento_inventario
        WHERE id_insumo = p_id_insumo;
    END IF;
    
    RETURN v_stock_actual;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FUNCIÓN PARA DESCONTAR INVENTARIO EN VENTA
CREATE OR REPLACE FUNCTION fn_descontar_inventario_venta(p_id_venta INTEGER, p_id_perfil INTEGER DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
    v_detalle RECORD;
    v_cantidad_a_descontar NUMERIC(12,3);
    v_costo_actual NUMERIC(12,2);
    v_stock_disponible NUMERIC(12,3);
    v_cantidad_restante NUMERIC(12,3);
    v_lote RECORD;
    v_consumo NUMERIC(12,3);
    v_valor_anterior NUMERIC(12,3);
    v_valor_nuevo NUMERIC(12,3);
BEGIN
    FOR v_detalle IN
        SELECT 
            dv.cantidad AS cantidad_vendida,
            rd.id_insumo, 
            rd.cantidad_requerida AS cantidad_receta,
            ci.tipo_categoria,
            i.costo_promedio,
            i.nombre_insumo,
            dv.id_producto
        FROM detalle_venta dv
        JOIN receta_detalle rd ON dv.id_producto = rd.id_producto
        JOIN insumo i ON rd.id_insumo = i.id_insumo
        JOIN categoria_insumo ci ON i.id_categoria = ci.id_categoria
        WHERE dv.id_venta = p_id_venta
        AND (rd.id_variante IS NULL OR rd.id_variante = dv.id_variante)
        AND ci.tipo_categoria = 'operativo'
    LOOP
        v_cantidad_a_descontar := ROUND(v_detalle.cantidad_vendida * v_detalle.cantidad_receta, 3);
        v_costo_actual := COALESCE(v_detalle.costo_promedio, 0);

        SELECT COALESCE(SUM(cantidad_actual), 0)
        INTO v_stock_disponible
        FROM lote_insumo
        WHERE id_insumo = v_detalle.id_insumo;

        IF v_stock_disponible < v_cantidad_a_descontar THEN
            RAISE EXCEPTION USING MESSAGE = format(
                'Stock insuficiente para el insumo "%s". Requerido: %.3f, disponible: %.3f',
                v_detalle.nombre_insumo,
                v_cantidad_a_descontar,
                v_stock_disponible
            );
        END IF;

        v_cantidad_restante := v_cantidad_a_descontar;

        FOR v_lote IN
            SELECT id_lote, cantidad_actual
            FROM lote_insumo
            WHERE id_insumo = v_detalle.id_insumo
            ORDER BY fecha_vencimiento ASC NULLS FIRST, id_lote
            FOR UPDATE
        LOOP
            EXIT WHEN v_cantidad_restante <= 0;

            v_consumo := LEAST(v_lote.cantidad_actual, v_cantidad_restante);

            IF v_consumo > 0 THEN
                v_valor_anterior := v_lote.cantidad_actual;
                v_valor_nuevo := ROUND(v_lote.cantidad_actual - v_consumo, 3);

                UPDATE lote_insumo
                SET cantidad_actual = v_valor_nuevo
                WHERE id_lote = v_lote.id_lote;

                INSERT INTO movimiento_inventario (
                    id_insumo,
                    id_lote,
                    tipo_movimiento,
                    cantidad,
                    id_perfil,
                    id_referencia,
                    descripcion,
                    costo_unitario_momento
                ) VALUES (
                    v_detalle.id_insumo,
                    v_lote.id_lote,
                    'salida_venta',
                    ROUND(v_consumo, 3),
                    p_id_perfil,
                    p_id_venta,
                    format('Venta #%s - %s', p_id_venta, v_detalle.nombre_insumo),
                    v_costo_actual
                );

                INSERT INTO bitacora_inventario (
                    id_insumo,
                    accion,
                    campo_modificado,
                    valor_anterior,
                    valor_nuevo,
                    id_perfil,
                    descripcion
                ) VALUES (
                    v_detalle.id_insumo,
                    'actualizacion',
                    'cantidad_actual',
                    to_char(v_valor_anterior, 'FM999999990.000'),
                    to_char(v_valor_nuevo, 'FM999999990.000'),
                    p_id_perfil,
                    format('Venta #%s - consumo de %.3f unidades (producto %s)', p_id_venta, v_consumo, v_detalle.id_producto)
                );

                v_cantidad_restante := ROUND(v_cantidad_restante - v_consumo, 3);
            END IF;
        END LOOP;

        IF v_cantidad_restante > 0.0001 THEN
            RAISE EXCEPTION USING MESSAGE = format(
                'No se pudo consumir completamente el insumo "%s" para la venta %s. Faltante: %.3f',
                v_detalle.nombre_insumo,
                p_id_venta,
                v_cantidad_restante
            );
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FUNCIÓN PARA CALCULAR PRECIO Y COSTO EN DETALLE DE VENTA
CREATE OR REPLACE FUNCTION fn_calcular_precio_costo_venta()
RETURNS TRIGGER AS $$
DECLARE
    v_precio_base DECIMAL(10, 2);
    v_costo_base DECIMAL(10, 2);
    v_precio_variante DECIMAL(10, 2) := 0;
    v_costo_variante DECIMAL(10, 2) := 0;
BEGIN
    -- Obtener precio y costo base del producto
    SELECT precio_venta, costo_producto 
    INTO v_precio_base, v_costo_base
    FROM producto 
    WHERE id_producto = NEW.id_producto;
    
    IF NEW.id_variante IS NOT NULL THEN
        SELECT precio_variante, costo_variante
        INTO v_precio_variante, v_costo_variante
        FROM producto_variante
        WHERE id_variante = NEW.id_variante;
    END IF;

    NEW.precio_unitario := v_precio_base + COALESCE(v_precio_variante, 0);
    NEW.costo_unitario := v_costo_base + COALESCE(v_costo_variante, 0);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION fn_actualizar_totales_venta()
RETURNS TRIGGER AS $$
DECLARE
    v_total_venta DECIMAL(12, 2);
    v_total_costo DECIMAL(12, 2);
BEGIN
    SELECT 
        COALESCE(SUM(subtotal - descuento), 0),
        COALESCE(SUM(costo_total), 0)
    INTO v_total_venta, v_total_costo
    FROM detalle_venta
    WHERE id_venta = COALESCE(NEW.id_venta, OLD.id_venta);

    UPDATE venta
    SET 
        total_venta = v_total_venta,
        total_costo = v_total_costo
    WHERE id_venta = COALESCE(NEW.id_venta, OLD.id_venta);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===============================================
-- TRIGGERS PARA FUNCIONES PRINCIPALES
-- ===============================================

-- Trigger para calcular precio y costo en detalle_venta
DROP TRIGGER IF EXISTS trg_calcular_precio_costo_venta ON detalle_venta;
CREATE TRIGGER trg_calcular_precio_costo_venta
BEFORE INSERT OR UPDATE ON detalle_venta
FOR EACH ROW
EXECUTE FUNCTION fn_calcular_precio_costo_venta();

-- Trigger para actualizar totales en venta
DROP TRIGGER IF EXISTS trg_actualizar_totales_venta ON detalle_venta;
CREATE TRIGGER trg_actualizar_totales_venta
AFTER INSERT OR UPDATE OR DELETE ON detalle_venta
FOR EACH ROW
EXECUTE FUNCTION fn_actualizar_totales_venta();

-- Trigger para descontar inventario cuando la venta se confirma
CREATE OR REPLACE FUNCTION trg_descontar_inventario_venta()
RETURNS TRIGGER AS $$
BEGIN
    -- Ejecutar cuando se inserta una venta confirmada o cuando se actualiza a confirmada
    IF (TG_OP = 'INSERT' AND NEW.estado = 'confirmada') OR
       (TG_OP = 'UPDATE' AND NEW.estado = 'confirmada' AND COALESCE(OLD.estado, '') <> 'confirmada') THEN
        PERFORM fn_descontar_inventario_venta(NEW.id_venta, NEW.id_cajero);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_descontar_inventario_venta ON venta;
CREATE TRIGGER trg_descontar_inventario_venta
AFTER INSERT OR UPDATE OF estado ON venta
FOR EACH ROW
EXECUTE FUNCTION trg_descontar_inventario_venta();

-- Trigger para insertar en deposito_banco cuando tipo_pago es 'Transferencia'
CREATE OR REPLACE FUNCTION trg_insertar_deposito_transferencia()
RETURNS TRIGGER AS $$
DECLARE
    v_nombre_cliente VARCHAR(100);
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.tipo_pago = 'Transferencia' AND NEW.estado = 'confirmada' AND COALESCE(OLD.estado, '') <> 'confirmada' THEN
        SELECT nombre INTO v_nombre_cliente
        FROM cliente
        WHERE id_cliente = NEW.id_cliente;

        INSERT INTO deposito_banco (
            descripcion,
            tipo_pago,
            monto,
            id_perfil,
            nombre_cliente,
            numero_referencia,
            nombre_banco
        ) VALUES (
            'Pago por venta #' || NEW.id_venta,
            'Transferencia',
            NEW.total_venta,
            NEW.id_cajero,
            v_nombre_cliente,
            NULL,
            NULL
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_insertar_deposito_transferencia ON venta;
CREATE TRIGGER trg_insertar_deposito_transferencia
AFTER UPDATE OF estado ON venta
FOR EACH ROW
EXECUTE FUNCTION trg_insertar_deposito_transferencia();

-- ===============================================
-- FUNCIONES PARA ÓRDENES DE COMPRA
-- ===============================================

-- Función para recalcular total en orden_compra
CREATE OR REPLACE FUNCTION fn_recalcular_totales_oc(p_id_orden INTEGER)
RETURNS VOID AS $$
DECLARE
    v_total DECIMAL(12,2) := 0;
BEGIN
    -- Calcular total sumando subtotales + IVA de los detalles
    SELECT COALESCE(SUM(subtotal + iva), 0) INTO v_total
    FROM detalle_orden_compra
    WHERE id_orden = p_id_orden;

    -- Actualizar la orden de compra
    UPDATE orden_compra
    SET total = v_total
    WHERE id_orden = p_id_orden;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para recalcular totales después de cambios en detalle_orden_compra
CREATE OR REPLACE FUNCTION trg_recalcular_totales_oc()
RETURNS TRIGGER AS $$
BEGIN
    -- Recalcular para la orden afectada
    PERFORM fn_recalcular_totales_oc(
        CASE
            WHEN TG_OP = 'DELETE' THEN OLD.id_orden
            ELSE NEW.id_orden
        END
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear el trigger
DROP TRIGGER IF EXISTS trg_recalcular_totales_oc ON detalle_orden_compra;
CREATE TRIGGER trg_recalcular_totales_oc
AFTER INSERT OR UPDATE OR DELETE ON detalle_orden_compra
FOR EACH ROW
EXECUTE FUNCTION trg_recalcular_totales_oc();

-- Función para derivar id_insumo desde id_presentacion en detalle_orden_compra
CREATE OR REPLACE FUNCTION fn_derivar_insumo_desde_presentacion()
RETURNS TRIGGER AS $$
BEGIN
    -- Derivar id_insumo desde id_presentacion
    SELECT ip.id_insumo INTO NEW.id_insumo
    FROM insumo_presentacion ip
    WHERE ip.id_presentacion = NEW.id_presentacion;

    -- Validar que se encontró el insumo
    IF NEW.id_insumo IS NULL THEN
        RAISE EXCEPTION 'No se encontró insumo para la presentación %', NEW.id_presentacion;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para derivar id_insumo automáticamente
DROP TRIGGER IF EXISTS trg_derivar_insumo_presentacion ON detalle_orden_compra;
CREATE TRIGGER trg_derivar_insumo_presentacion
BEFORE INSERT OR UPDATE ON detalle_orden_compra
FOR EACH ROW
EXECUTE FUNCTION fn_derivar_insumo_desde_presentacion();

-- Agregar constraint UNIQUE para evitar duplicados (orden, presentacion)
ALTER TABLE detalle_orden_compra DROP CONSTRAINT IF EXISTS unique_orden_presentacion;
ALTER TABLE detalle_orden_compra ADD CONSTRAINT unique_orden_presentacion
UNIQUE (id_orden, id_presentacion);

-- ===============================================
-- FUNCIONES PARA RECEPCIÓN Y COSTOS
-- ===============================================

-- Función completa para actualizar costo promedio al recibir mercadería
CREATE OR REPLACE FUNCTION fn_actualizar_costo_promedio(p_id_insumo INTEGER)
RETURNS VOID AS $$
DECLARE
    v_stock_actual DECIMAL(10,2);
    v_costo_promedio_actual DECIMAL(10,2);
    v_total_costo DECIMAL(12,2) := 0;
    v_total_cantidad DECIMAL(10,2) := 0;
BEGIN
    -- Obtener stock actual y costo promedio actual
    SELECT fn_obtener_stock_actual(p_id_insumo) INTO v_stock_actual;
    SELECT costo_promedio FROM insumo WHERE id_insumo = p_id_insumo INTO v_costo_promedio_actual;

    -- Calcular nuevo costo promedio ponderado
    -- Suma de (cantidad * costo_unitario) / suma de cantidades
    SELECT
        COALESCE(SUM(cantidad * costo_unitario_momento), 0),
        COALESCE(SUM(cantidad), 0)
    INTO v_total_costo, v_total_cantidad
    FROM movimiento_inventario
    WHERE id_insumo = p_id_insumo
    AND tipo_movimiento IN ('entrada_compra', 'entrada_ajuste');

    IF v_total_cantidad > 0 THEN
        UPDATE insumo
        SET costo_promedio = v_total_costo / v_total_cantidad
        WHERE id_insumo = p_id_insumo;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para procesar recepción de mercadería (solo cierre automático de OC)
CREATE OR REPLACE FUNCTION fn_procesar_recepcion_mercaderia()
RETURNS TRIGGER AS $$
BEGIN
    -- Esta función ahora solo maneja el cierre automático de OC
    -- Los movimientos de inventario se aplican cuando la OC pasa a 'recibida'
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para procesar recepción
DROP TRIGGER IF EXISTS trg_procesar_recepcion ON recepcion_mercaderia;
CREATE TRIGGER trg_procesar_recepcion
AFTER UPDATE ON recepcion_mercaderia
FOR EACH ROW
EXECUTE FUNCTION fn_procesar_recepcion_mercaderia();

-- Función para cerrar OC automáticamente cuando se complete la recepción
CREATE OR REPLACE FUNCTION fn_cerrar_oc_automaticamente()
RETURNS TRIGGER AS $$
DECLARE
    v_id_orden INTEGER;
    v_total_solicitado DECIMAL(10,2);
    v_total_aceptado DECIMAL(10,2);
BEGIN
    -- Obtener el ID de la orden desde la recepción
    SELECT id_orden INTO v_id_orden
    FROM recepcion_mercaderia
    WHERE id_recepcion = NEW.id_recepcion;

    -- Si no hay orden asociada, salir
    IF v_id_orden IS NULL THEN
        RETURN NEW;
    END IF;

    -- Calcular total solicitado vs aceptado para la orden
    SELECT
        SUM(doc.cantidad) as solicitado,
        SUM(drm.cantidad_aceptada) as aceptado
    INTO v_total_solicitado, v_total_aceptado
    FROM detalle_orden_compra doc
    LEFT JOIN detalle_recepcion_mercaderia drm ON doc.id_detalle = drm.id_detalle_orden
    LEFT JOIN recepcion_mercaderia rm ON drm.id_recepcion = rm.id_recepcion
    WHERE doc.id_orden = v_id_orden;

    -- Si la cantidad aceptada iguala la solicitada, marcar como recibida
    IF v_total_solicitado > 0 AND v_total_aceptado >= v_total_solicitado THEN
        UPDATE orden_compra
        SET estado = 'recibida'
        WHERE id_orden = v_id_orden AND estado != 'recibida';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para cerrar OC automáticamente después de actualizar detalle_recepcion_mercaderia
DROP TRIGGER IF EXISTS trg_cerrar_oc_automaticamente ON detalle_recepcion_mercaderia;
CREATE TRIGGER trg_cerrar_oc_automaticamente
AFTER INSERT OR UPDATE ON detalle_recepcion_mercaderia
FOR EACH ROW
EXECUTE FUNCTION fn_cerrar_oc_automaticamente();

-- Función para aplicar movimientos de inventario cuando OC pasa a 'recibida'
CREATE OR REPLACE FUNCTION fn_aplicar_movimientos_oc_recibida()
RETURNS TRIGGER AS $$
DECLARE
    v_detalle RECORD;
    v_cantidad_base DECIMAL(10,2);
    v_costo_unitario DECIMAL(10,2);
    v_costo_total DECIMAL(12,2);
    v_id_lote INTEGER;
    v_cantidad_anterior DECIMAL(10,2);
    v_cantidad_nueva DECIMAL(10,2);
BEGIN
    -- Solo procesar cuando la OC pasa a 'recibida'
    IF NEW.estado = 'recibida' AND (OLD.estado IS NULL OR OLD.estado != 'recibida') THEN
        -- Procesar todas las recepciones para esta OC
        FOR v_detalle IN
            SELECT
                dr.id_detalle,
                dr.cantidad_recibida,
                dr.id_detalle_orden,
                dr.id_lote,
                COALESCE(dr.id_presentacion, doc.id_presentacion) AS id_presentacion,
                doc.id_insumo,
                doc.precio_unitario,
                ip.unidades_por_presentacion,
                ip.costo_compra_unitario,
                i.nombre_insumo,
                rm.id_recepcion,
                rm.id_perfil
            FROM detalle_recepcion_mercaderia dr
            JOIN detalle_orden_compra doc ON dr.id_detalle_orden = doc.id_detalle
            JOIN insumo_presentacion ip ON doc.id_presentacion = ip.id_presentacion
            JOIN insumo i ON doc.id_insumo = i.id_insumo
            JOIN recepcion_mercaderia rm ON dr.id_recepcion = rm.id_recepcion
            WHERE doc.id_orden = NEW.id_orden
            AND dr.cantidad_aceptada > 0
        LOOP
            -- Convertir cantidad a unidad base
            v_cantidad_base := v_detalle.cantidad_recibida * v_detalle.unidades_por_presentacion;
            v_costo_unitario := COALESCE(v_detalle.precio_unitario, v_detalle.costo_compra_unitario) / v_detalle.unidades_por_presentacion;
            v_costo_total := v_cantidad_base * v_costo_unitario;

            -- Determinar el lote a usar
            IF v_detalle.id_lote IS NOT NULL THEN
                v_id_lote := v_detalle.id_lote;
                SELECT cantidad_actual INTO v_cantidad_anterior
                FROM lote_insumo
                WHERE id_lote = v_id_lote;
            ELSE
                SELECT id_lote, cantidad_actual INTO v_id_lote, v_cantidad_anterior
                FROM lote_insumo
                WHERE id_insumo = v_detalle.id_insumo
                ORDER BY fecha_vencimiento DESC
                LIMIT 1;
            END IF;

            IF v_id_lote IS NOT NULL THEN
                UPDATE lote_insumo
                SET cantidad_actual = cantidad_actual + v_cantidad_base,
                    costo_unitario = v_costo_unitario
                WHERE id_lote = v_id_lote
                RETURNING cantidad_actual INTO v_cantidad_nueva;
            ELSE
                INSERT INTO lote_insumo (
                    id_insumo, fecha_vencimiento, cantidad_inicial, cantidad_actual, costo_unitario, ubicacion
                ) VALUES (
                    v_detalle.id_insumo, CURRENT_DATE + INTERVAL '1 year', v_cantidad_base, v_cantidad_base, v_costo_unitario, 'almacen'
                ) RETURNING id_lote, cantidad_actual INTO v_id_lote, v_cantidad_nueva;
                v_cantidad_anterior := 0;
            END IF;

            -- Actualizar detalle_recepcion_mercaderia con el id_lote y la presentación derivada
            UPDATE detalle_recepcion_mercaderia
            SET id_lote = v_id_lote,
                id_presentacion = COALESCE(id_presentacion, v_detalle.id_presentacion)
            WHERE id_detalle = v_detalle.id_detalle;

            -- Sincronizar la cantidad recibida en el detalle de OC
            UPDATE detalle_orden_compra
            SET cantidad_recibida = COALESCE(cantidad_recibida, 0) + v_detalle.cantidad_recibida
            WHERE id_detalle = v_detalle.id_detalle_orden;

            -- Insertar movimiento de entrada con id_lote
            INSERT INTO movimiento_inventario (
                id_insumo,
                id_lote,
                tipo_movimiento,
                cantidad,
                id_perfil,
                id_referencia,
                descripcion,
                costo_unitario_momento,
                id_presentacion
            ) VALUES (
                v_detalle.id_insumo,
                v_id_lote,
                'entrada_compra',
                v_cantidad_base,
                v_detalle.id_perfil,
                v_detalle.id_recepcion,
                'Recepción de mercadería #' || v_detalle.id_recepcion || ' - ' || v_detalle.nombre_insumo,
                v_costo_unitario,
                v_detalle.id_presentacion
            );

            -- Registrar bitácora de inventario
            INSERT INTO bitacora_inventario (
                id_insumo,
                accion,
                campo_modificado,
                valor_anterior,
                valor_nuevo,
                id_perfil,
                descripcion
            ) VALUES (
                v_detalle.id_insumo,
                'actualizacion',
                'cantidad_actual',
                COALESCE(v_cantidad_anterior, 0)::text,
                COALESCE(v_cantidad_nueva, v_cantidad_anterior)::text,
                v_detalle.id_perfil,
                 FORMAT('Recepcion #%s (OC #%s) - %+s unidades base. Presentacion ID %s. Costo unitario %s. Total %s',
                    v_detalle.id_recepcion,
                    NEW.id_orden,
                    v_cantidad_base,
                    v_detalle.id_presentacion,
                    v_costo_unitario,
                    v_costo_total)
            );

            -- Registrar logs en el servidor de BD
            RAISE NOTICE 'OC % - Recepción % - Insumo % - Cantidad base % - Lote %',
                NEW.id_orden, v_detalle.id_recepcion, v_detalle.id_insumo, v_cantidad_base, v_id_lote;
        END LOOP;

        -- Recalcular costo promedio para todos los insumos afectados
        FOR v_detalle IN
            SELECT DISTINCT doc.id_insumo
            FROM detalle_recepcion_mercaderia dr
            JOIN detalle_orden_compra doc ON dr.id_detalle_orden = doc.id_detalle
            JOIN recepcion_mercaderia rm ON dr.id_recepcion = rm.id_recepcion
            WHERE doc.id_orden = NEW.id_orden
        LOOP
            PERFORM fn_actualizar_costo_promedio(v_detalle.id_insumo);
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para aplicar movimientos cuando OC pasa a 'recibida'
DROP TRIGGER IF EXISTS trg_aplicar_movimientos_oc_recibida ON orden_compra;
CREATE TRIGGER trg_aplicar_movimientos_oc_recibida
AFTER UPDATE ON orden_compra
FOR EACH ROW
EXECUTE FUNCTION fn_aplicar_movimientos_oc_recibida();

-- ===============================================
-- FUNCIONES PARA AUDITORÍA ADICIONAL
-- ===============================================

-- NOTA: La función fn_aplicar_ajustes_auditoria requiere las tablas de auditoría
-- (auditoria_cabecera, auditoria_detalle) que no están incluidas en este script.
-- Si se va a utilizar, incluir las tablas de auditoría o mover esta función
-- a su script correspondiente.

/*
-- FUNCIÓN PARA APLICAR AJUSTES DE AUDITORÍA
CREATE OR REPLACE FUNCTION fn_aplicar_ajustes_auditoria(p_id_auditoria INTEGER, p_id_perfil INTEGER)
RETURNS VOID AS $$
DECLARE
    v_ajuste RECORD;
    v_costo_actual DECIMAL(10,2);
BEGIN
    -- Aplicar ajustes para cada discrepancia encontrada
    FOR v_ajuste IN
        SELECT
            id_insumo,
            diferencia,
            causa_ajuste
        FROM auditoria_detalle
        WHERE id_auditoria = p_id_auditoria
        AND diferencia != 0
        AND causa_ajuste IS NOT NULL
    LOOP
        -- Obtener costo actual del insumo
        SELECT costo_promedio INTO v_costo_actual
        FROM insumo WHERE id_insumo = v_ajuste.id_insumo;

        -- Registrar ajuste en movimientos
        INSERT INTO movimiento_inventario (
            id_insumo,
            tipo_movimiento,
            cantidad,
            id_perfil,
            id_referencia,
            descripcion,
            costo_unitario_momento
        ) VALUES (
            v_ajuste.id_insumo,
            CASE WHEN v_ajuste.diferencia > 0 THEN 'entrada_ajuste' ELSE 'salida_ajuste' END,
            ABS(v_ajuste.diferencia),
            p_id_perfil,
            p_id_auditoria,
            'Ajuste por auditoría - ' || v_ajuste.causa_ajuste,
            v_costo_actual
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
*/

-- ===============================================
-- TRIGGER PARA BITÁCORA DE ÓRDENES DE COMPRA
-- ===============================================

-- Función para bitácora de órdenes de compra
CREATE OR REPLACE FUNCTION fn_bitacora_ordenes_compra()
RETURNS TRIGGER AS $$
DECLARE
    v_accion VARCHAR(50);
    v_descripcion TEXT;
BEGIN
    -- Determinar la acción basada en el cambio de estado
    IF TG_OP = 'INSERT' THEN
        v_accion := CASE WHEN NEW.tipo_orden = 'automatica' THEN 'creacion_automatica' ELSE 'creacion_manual' END;
        v_descripcion := 'Creación de orden de compra';
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.estado != NEW.estado THEN
            CASE NEW.estado
                WHEN 'aprobada' THEN v_accion := 'aprobacion';
                WHEN 'recibida' THEN v_accion := 'recepcion_completa';
                WHEN 'rechazado' THEN v_accion := 'rechazo';
                ELSE v_accion := 'modificacion';
            END CASE;
            v_descripcion := 'Cambio de estado: ' || OLD.estado || ' → ' || NEW.estado;
        ELSE
            v_accion := 'modificacion';
            v_descripcion := 'Modificación de orden de compra';
        END IF;
    END IF;

    -- Insertar en bitácora
    INSERT INTO bitacora_ordenes_compra (
        id_orden, accion, estado_anterior, estado_nuevo,
        id_perfil, descripcion, datos_adicionales
    ) VALUES (
        COALESCE(NEW.id_orden, OLD.id_orden),
        v_accion,
        OLD.estado,
        NEW.estado,
        COALESCE(NEW.creado_por, NEW.aprobado_por),
        v_descripcion,
        jsonb_build_object(
            'tipo_orden', COALESCE(NEW.tipo_orden, OLD.tipo_orden),
            'id_proveedor', COALESCE(NEW.id_proveedor, OLD.id_proveedor)
        )
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger de bitácora para ordenes_compra
DROP TRIGGER IF EXISTS trg_bitacora_ordenes_compra ON orden_compra;
CREATE TRIGGER trg_bitacora_ordenes_compra
AFTER INSERT OR UPDATE ON orden_compra
FOR EACH ROW
EXECUTE FUNCTION fn_bitacora_ordenes_compra();

-- ===============================================
-- FUNCIONES PARA BITÁCORA DE RECEPCIÓN DE MERCADERÍA
-- ===============================================

-- Función para bitácora de recepcion_mercaderia
CREATE OR REPLACE FUNCTION fn_bitacora_recepcion_mercaderia()
RETURNS TRIGGER AS $$
DECLARE
    v_accion VARCHAR(50);
    v_descripcion TEXT;
BEGIN
    -- Determinar la acción
    IF TG_OP = 'INSERT' THEN
        v_accion := 'creacion';
        v_descripcion := 'Creación de recepción de mercadería';
    ELSIF TG_OP = 'UPDATE' THEN
        v_accion := 'modificacion';
        v_descripcion := 'Modificación de recepción de mercadería';
    ELSIF TG_OP = 'DELETE' THEN
        v_accion := 'eliminacion';
        v_descripcion := 'Eliminación de recepción de mercadería';
    END IF;

    -- Insertar en bitácora (usando bitacora_ordenes_compra ya que no hay tabla específica para recepción)
    -- Nota: Podrías crear una tabla bitacora_recepcion_mercaderia si es necesario
    INSERT INTO bitacora_ordenes_compra (
        id_orden, accion, id_perfil, descripcion, datos_adicionales
    ) VALUES (
        COALESCE(NEW.id_orden, OLD.id_orden),
        v_accion,
        COALESCE(NEW.id_perfil, OLD.id_perfil),
        v_descripcion,
        jsonb_build_object(
            'tipo', 'recepcion_mercaderia',
            'id_recepcion', COALESCE(NEW.id_recepcion, OLD.id_recepcion),
            'numero_factura', COALESCE(NEW.numero_factura, OLD.numero_factura)
        )
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger de bitácora para recepcion_mercaderia
DROP TRIGGER IF EXISTS trg_bitacora_recepcion_mercaderia ON recepcion_mercaderia;
CREATE TRIGGER trg_bitacora_recepcion_mercaderia
AFTER INSERT OR UPDATE OR DELETE ON recepcion_mercaderia
FOR EACH ROW
EXECUTE FUNCTION fn_bitacora_recepcion_mercaderia();

-- ===============================================
-- FUNCIONES PARA BITÁCORA DE DETALLE DE RECEPCIÓN DE MERCADERÍA
-- ===============================================

-- Función para bitácora de detalle_recepcion_mercaderia
CREATE OR REPLACE FUNCTION fn_bitacora_detalle_recepcion_mercaderia()
RETURNS TRIGGER AS $$
DECLARE
    v_accion VARCHAR(50);
    v_descripcion TEXT;
BEGIN
    -- Determinar la acción
    IF TG_OP = 'INSERT' THEN
        v_accion := 'creacion';
        v_descripcion := 'Creación de detalle de recepción de mercadería';
    ELSIF TG_OP = 'UPDATE' THEN
        v_accion := 'modificacion';
        v_descripcion := 'Modificación de detalle de recepción de mercadería';
    ELSIF TG_OP = 'DELETE' THEN
        v_accion := 'eliminacion';
        v_descripcion := 'Eliminación de detalle de recepción de mercadería';
    END IF;

    -- Insertar en bitácora
    INSERT INTO bitacora_ordenes_compra (
        id_orden, accion, id_perfil, descripcion, datos_adicionales
    ) VALUES (
        (SELECT oc.id_orden FROM orden_compra oc 
         JOIN recepcion_mercaderia rm ON rm.id_orden = oc.id_orden 
         WHERE rm.id_recepcion = COALESCE(NEW.id_recepcion, OLD.id_recepcion)),
        v_accion,
        (SELECT rm.id_perfil FROM recepcion_mercaderia rm 
         WHERE rm.id_recepcion = COALESCE(NEW.id_recepcion, OLD.id_recepcion)),
        v_descripcion,
        jsonb_build_object(
            'tipo', 'detalle_recepcion_mercaderia',
            'id_detalle', COALESCE(NEW.id_detalle, OLD.id_detalle),
            'id_recepcion', COALESCE(NEW.id_recepcion, OLD.id_recepcion),
            'cantidad_recibida', COALESCE(NEW.cantidad_recibida, OLD.cantidad_recibida)
        )
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger de bitácora para detalle_recepcion_mercaderia
DROP TRIGGER IF EXISTS trg_bitacora_detalle_recepcion_mercaderia ON detalle_recepcion_mercaderia;
CREATE TRIGGER trg_bitacora_detalle_recepcion_mercaderia
AFTER INSERT OR UPDATE OR DELETE ON detalle_recepcion_mercaderia
FOR EACH ROW
EXECUTE FUNCTION fn_bitacora_detalle_recepcion_mercaderia();

-- ===============================================
-- MENSAJE FINAL
-- ===============================================

-- Este archivo contiene la base de datos completa nueva para Shucway
-- Incluye todas las tablas, funciones, triggers e índices necesarios
-- para el funcionamiento completo del sistema de inventario, ventas y auditoría.

-- Función para reiniciar puntos cuando llegue a 10
CREATE OR REPLACE FUNCTION fn_reiniciar_puntos_cliente()
RETURNS TRIGGER AS $$
BEGIN
    -- Si los puntos acumulados llegan a 10 o más, reiniciar el conteo a 0
    IF NEW.puntos_acumulados >= 10 THEN
        NEW.puntos_acumulados := 0;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para reiniciar puntos en cliente
DROP TRIGGER IF EXISTS trg_reiniciar_puntos_cliente ON cliente;
CREATE TRIGGER trg_reiniciar_puntos_cliente
BEFORE INSERT OR UPDATE ON cliente
FOR EACH ROW
EXECUTE FUNCTION fn_reiniciar_puntos_cliente();

-- ===========================amiwis

CREATE TABLE auditoria_inventario (
    id_auditoria SERIAL PRIMARY KEY,
    nombre_auditoria VARCHAR(100) NOT NULL,
    fecha_inicio_periodo DATE NOT NULL,  
    fecha_fin_periodo DATE NOT NULL,     
    fecha_inicio_auditoria DATE NOT NULL, 
    fecha_fin_auditoria DATE,             
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado VARCHAR(20) DEFAULT 'en_progreso' CHECK (estado IN ('en_progreso', 'completada', 'cancelada')),
    id_perfil INTEGER REFERENCES perfil_usuario(id_perfil),
    total_discrepancias INTEGER DEFAULT 0
);

CREATE TABLE auditoria_detalle (
    id_detalle SERIAL PRIMARY KEY,
    id_auditoria INTEGER REFERENCES auditoria_inventario(id_auditoria) ON DELETE CASCADE,
    id_insumo INTEGER REFERENCES insumo(id_insumo),
    tipo_categoria VARCHAR(20) DEFAULT 'operativo' CHECK (tipo_categoria IN ('perpetuo', 'operativo')),
    stock_esperado DECIMAL(10,2) NOT NULL,
    conteo_fisico DECIMAL(10,2),
    diferencia DECIMAL(10,2) GENERATED ALWAYS AS (conteo_fisico - stock_esperado) STORED,
    causa_ajuste VARCHAR(100),
    notas TEXT,
    ubicacion_conteo VARCHAR(100)
);

CREATE TABLE bitacora_auditoria (
    id_bitacora SERIAL PRIMARY KEY,
    id_auditoria INTEGER REFERENCES auditoria_inventario(id_auditoria) ON DELETE CASCADE,
    nombre_auditoria VARCHAR(100),
    accion VARCHAR(50) CHECK (accion IN (
        'creacion', 'conteo_actualizado', 'completada', 'cancelada',
        'ajuste_aplicado', 'reporte_generado', 'modificacion_manual'
    )),
    id_perfil INTEGER REFERENCES perfil_usuario(id_perfil),
    fecha_accion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    descripcion TEXT,
    datos_anteriores JSONB,
    datos_nuevos JSONB
);

CREATE INDEX IF NOT EXISTS idx_auditoria_fecha_inicio ON auditoria_inventario(fecha_inicio_periodo);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha_fin ON auditoria_inventario(fecha_fin_periodo);
CREATE INDEX IF NOT EXISTS idx_auditoria_estado ON auditoria_inventario(estado);
CREATE INDEX IF NOT EXISTS idx_auditoria_perfil ON auditoria_inventario(id_perfil);
CREATE INDEX IF NOT EXISTS idx_auditoria_detalle_auditoria ON auditoria_detalle(id_auditoria);
CREATE INDEX IF NOT EXISTS idx_auditoria_detalle_insumo ON auditoria_detalle(id_insumo);
CREATE INDEX IF NOT EXISTS idx_auditoria_detalle_tipo ON auditoria_detalle(tipo_categoria);
CREATE INDEX IF NOT EXISTS idx_bitacora_auditoria_auditoria ON bitacora_auditoria(id_auditoria);
CREATE INDEX IF NOT EXISTS idx_bitacora_auditoria_fecha ON bitacora_auditoria(fecha_accion);


-- FUNCIÓN PARA INICIAR AUDITORÍA
CREATE OR REPLACE FUNCTION fn_iniciar_auditoria(
    p_nombre_auditoria VARCHAR(100),
    p_fecha_inicio_periodo DATE,
    p_fecha_fin_periodo DATE,
    p_id_perfil INTEGER
)
RETURNS INTEGER AS $$
DECLARE
    v_id_auditoria INTEGER;
BEGIN
    IF p_fecha_inicio_periodo > p_fecha_fin_periodo THEN
        RAISE EXCEPTION 'La fecha de inicio del período no puede ser posterior a la fecha fin';
    END IF;

    INSERT INTO auditoria_inventario (
        nombre_auditoria,
        fecha_inicio_periodo,
        fecha_fin_periodo,
        fecha_inicio_auditoria,
        id_perfil
    ) VALUES (
        p_nombre_auditoria,
        p_fecha_inicio_periodo,
        p_fecha_fin_periodo,
        CURRENT_DATE,
        p_id_perfil
    ) RETURNING id_auditoria INTO v_id_auditoria;

    INSERT INTO auditoria_detalle (
        id_auditoria,
        id_insumo,
        tipo_categoria,
        stock_esperado
    )
    SELECT
        v_id_auditoria,
        i.id_insumo,
        ci.tipo_categoria,
        fn_obtener_stock_actual(i.id_insumo)
    FROM insumo i
    JOIN categoria_insumo ci ON i.id_categoria = ci.id_categoria
    WHERE i.activo = TRUE
    ORDER BY ci.tipo_categoria, i.nombre_insumo;

    INSERT INTO bitacora_auditoria (
        id_auditoria, nombre_auditoria, accion, id_perfil, descripcion
    ) VALUES (
        v_id_auditoria, p_nombre_auditoria, 'creacion', p_id_perfil,
        'Auditoría iniciada por ' || p_nombre_auditoria ||
        ' - Período: ' || p_fecha_inicio_periodo || ' a ' || p_fecha_fin_periodo
    );

    RETURN v_id_auditoria;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- FUNCIÓN PARA ACTUALIZAR CONTEO FÍSICO
CREATE OR REPLACE FUNCTION fn_actualizar_conteo_auditoria(
    p_id_auditoria INTEGER,
    p_id_insumo INTEGER,
    p_conteo_fisico DECIMAL(10,2),
    p_causa_ajuste VARCHAR(100) DEFAULT NULL,
    p_notas TEXT DEFAULT NULL,
    p_id_perfil INTEGER DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_datos_anteriores JSONB;
    v_datos_nuevos JSONB;
    v_nombre_auditoria VARCHAR(100);
    v_detalle auditoria_detalle%ROWTYPE;
    v_tipo_categoria VARCHAR(20);
    v_stock_actual DECIMAL(10,2);
    v_diferencia NUMERIC(12,4);
    v_diferencia_abs NUMERIC(12,4);
    v_costo_promedio DECIMAL(10,2);
    v_movimiento_entrada VARCHAR(20);
    v_id_lote INTEGER;
    v_cantidad_restante NUMERIC(12,4);
    v_a_retirar NUMERIC(12,4);
    v_lote RECORD;
    v_descripcion TEXT;
    v_etiqueta_auditoria TEXT;
BEGIN
    IF p_conteo_fisico IS NOT NULL AND p_conteo_fisico < 0 THEN
        RAISE EXCEPTION 'El conteo físico no puede ser negativo';
    END IF;

    SELECT nombre_auditoria INTO v_nombre_auditoria
    FROM auditoria_inventario
    WHERE id_auditoria = p_id_auditoria;

    SELECT row_to_json(ad) INTO v_datos_anteriores
    FROM auditoria_detalle ad
    WHERE ad.id_auditoria = p_id_auditoria AND ad.id_insumo = p_id_insumo;

    SELECT * INTO v_detalle
    FROM auditoria_detalle
    WHERE id_auditoria = p_id_auditoria AND id_insumo = p_id_insumo
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Detalle de auditoría no encontrado para auditoría % y insumo %', p_id_auditoria, p_id_insumo;
    END IF;

    v_tipo_categoria := COALESCE(v_detalle.tipo_categoria, 'operativo');

    UPDATE auditoria_detalle
    SET
        conteo_fisico = CASE WHEN p_conteo_fisico IS NULL THEN NULL ELSE ROUND(p_conteo_fisico::numeric, 2) END,
        causa_ajuste = p_causa_ajuste,
        notas = p_notas
    WHERE id_auditoria = p_id_auditoria AND id_insumo = p_id_insumo;

    SELECT row_to_json(ad) INTO v_datos_nuevos
    FROM auditoria_detalle ad
    WHERE ad.id_auditoria = p_id_auditoria AND ad.id_insumo = p_id_insumo;

    IF p_conteo_fisico IS NOT NULL THEN
        SELECT COALESCE(SUM(cantidad_actual), 0)
        INTO v_stock_actual
        FROM lote_insumo
        WHERE id_insumo = p_id_insumo;

        v_diferencia := ROUND(p_conteo_fisico - v_stock_actual, 4);

        IF v_diferencia <> 0 THEN
            v_diferencia_abs := ABS(v_diferencia);
            SELECT COALESCE(costo_promedio, 0)
            INTO v_costo_promedio
            FROM insumo
            WHERE id_insumo = p_id_insumo;

            v_etiqueta_auditoria := COALESCE(v_nombre_auditoria, 'Auditoría ' || p_id_auditoria::TEXT);

            IF v_diferencia > 0 THEN
                v_movimiento_entrada := CASE WHEN v_tipo_categoria = 'perpetuo' THEN 'ajuste_perpetuo' ELSE 'ajuste_operativo' END;

                SELECT id_lote
                INTO v_id_lote
                FROM lote_insumo
                WHERE id_insumo = p_id_insumo
                ORDER BY fecha_vencimiento NULLS LAST, id_lote DESC
                LIMIT 1;

                IF v_id_lote IS NULL THEN
                    INSERT INTO lote_insumo (
                        id_insumo, fecha_vencimiento, cantidad_inicial, cantidad_actual, costo_unitario, ubicacion
                    ) VALUES (
                        p_id_insumo, NULL, ROUND(v_diferencia_abs::numeric, 2), ROUND(v_diferencia_abs::numeric, 2), v_costo_promedio, 'Ajuste Auditoría'
                    ) RETURNING id_lote INTO v_id_lote;
                ELSE
                    UPDATE lote_insumo
                    SET cantidad_actual = cantidad_actual + ROUND(v_diferencia_abs::numeric, 2)
                    WHERE id_lote = v_id_lote;
                END IF;

                v_descripcion :=
                    'Ajuste auditoría (' || v_tipo_categoria || ') - Conteo físico mayor. Diferencia: ' ||
                    TO_CHAR(ROUND(v_diferencia_abs::numeric, 2), 'FM999999990.00');
                IF p_causa_ajuste IS NOT NULL THEN
                    v_descripcion := v_descripcion || ' - Causa: ' || p_causa_ajuste;
                END IF;

                INSERT INTO movimiento_inventario (
                    id_insumo,
                    id_lote,
                    tipo_movimiento,
                    cantidad,
                    id_perfil,
                    id_referencia,
                    descripcion,
                    costo_unitario_momento
                ) VALUES (
                    p_id_insumo,
                    v_id_lote,
                    v_movimiento_entrada,
                    ROUND(v_diferencia_abs::numeric, 2),
                    p_id_perfil,
                    p_id_auditoria,
                    v_descripcion || ' - ' || v_etiqueta_auditoria,
                    v_costo_promedio
                );

            ELSE
                v_cantidad_restante := v_diferencia_abs;

                FOR v_lote IN (
                    SELECT id_lote, cantidad_actual
                    FROM lote_insumo
                    WHERE id_insumo = p_id_insumo
                    ORDER BY fecha_vencimiento ASC NULLS FIRST, id_lote
                ) LOOP
                    EXIT WHEN v_cantidad_restante <= 0;
                    v_a_retirar := LEAST(v_lote.cantidad_actual, v_cantidad_restante);

                    IF v_a_retirar > 0 THEN
                        UPDATE lote_insumo
                        SET cantidad_actual = cantidad_actual - ROUND(v_a_retirar::numeric, 2)
                        WHERE id_lote = v_lote.id_lote;

                        v_descripcion :=
                            'Ajuste auditoría (' || v_tipo_categoria || ') - Conteo físico menor. Diferencia parcial: ' ||
                            TO_CHAR(ROUND(v_a_retirar::numeric, 2), 'FM999999990.00');
                        IF p_causa_ajuste IS NOT NULL THEN
                            v_descripcion := v_descripcion || ' - Causa: ' || p_causa_ajuste;
                        END IF;

                        INSERT INTO movimiento_inventario (
                            id_insumo,
                            id_lote,
                            tipo_movimiento,
                            cantidad,
                            id_perfil,
                            id_referencia,
                            descripcion,
                            costo_unitario_momento
                        ) VALUES (
                            p_id_insumo,
                            v_lote.id_lote,
                            'salida_ajuste',
                            ROUND(v_a_retirar::numeric, 2),
                            p_id_perfil,
                            p_id_auditoria,
                            v_descripcion || ' - ' || v_etiqueta_auditoria,
                            v_costo_promedio
                        );

                        v_cantidad_restante := v_cantidad_restante - v_a_retirar;
                    END IF;
                END LOOP;

                IF v_cantidad_restante > 0.0001 THEN
                    RAISE NOTICE 'Ajuste por auditoría dejó un remanente de % para el insumo %', v_cantidad_restante, p_id_insumo;
                END IF;
            END IF;
        END IF;
    END IF;

    INSERT INTO bitacora_auditoria (
        id_auditoria, nombre_auditoria, accion, id_perfil, descripcion,
        datos_anteriores, datos_nuevos
    ) VALUES (
        p_id_auditoria, v_nombre_auditoria, 'conteo_actualizado', p_id_perfil,
        'Conteo actualizado para insumo ' || p_id_insumo ||
        ' - Cantidad: ' || p_conteo_fisico,
        v_datos_anteriores, v_datos_nuevos
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FUNCIÓN PARA COMPLETAR AUDITORÍA
CREATE OR REPLACE FUNCTION fn_completar_auditoria(
    p_id_auditoria INTEGER,
    p_id_perfil INTEGER
)
RETURNS VOID AS $$
DECLARE
    v_total_items INTEGER;
    v_total_discrepancias INTEGER;
    v_nombre_auditoria VARCHAR(100);
BEGIN
    SELECT nombre_auditoria INTO v_nombre_auditoria
    FROM auditoria_inventario
    WHERE id_auditoria = p_id_auditoria;

    SELECT
        COUNT(*),
        COUNT(CASE WHEN diferencia != 0 THEN 1 END)
    INTO v_total_items, v_total_discrepancias
    FROM auditoria_detalle
    WHERE id_auditoria = p_id_auditoria AND conteo_fisico IS NOT NULL;

    UPDATE auditoria_inventario
    SET
        estado = 'completada',
        fecha_fin_auditoria = CURRENT_DATE
    WHERE id_auditoria = p_id_auditoria;

    INSERT INTO bitacora_auditoria (
        id_auditoria, nombre_auditoria, accion, id_perfil, descripcion
    ) VALUES (
        p_id_auditoria, v_nombre_auditoria, 'completada', p_id_perfil,
        'Auditoría completada - Items contados: ' || v_total_items ||
        ', Discrepancias: ' || v_total_discrepancias
    );

    -- Aplicar ajustes automáticos al inventario si hay discrepancias
    IF v_total_discrepancias > 0 THEN
        PERFORM fn_aplicar_ajustes_auditoria(p_id_auditoria, p_id_perfil);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FUNCIÓN PARA OBTENER REPORTE DE AUDITORÍA
CREATE OR REPLACE FUNCTION fn_reporte_auditoria(p_id_auditoria INTEGER)
RETURNS TABLE(
    tipo_categoria VARCHAR(20),
    insumo VARCHAR(100),
    unidad_base VARCHAR(20),
    stock_esperado DECIMAL(10,2),
    conteo_fisico DECIMAL(10,2),
    diferencia DECIMAL(10,2),
    causa_ajuste VARCHAR(100),
    notas TEXT,
    ubicacion_conteo VARCHAR(100),
    estado_conteo VARCHAR(20)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ad.tipo_categoria,
        i.nombre_insumo,
        i.unidad_base,
        ad.stock_esperado,
        ad.conteo_fisico,
        ad.diferencia,
        ad.causa_ajuste,
        ad.notas,
        ad.ubicacion_conteo,
        CASE
            WHEN ad.conteo_fisico IS NULL THEN 'Pendiente'
            WHEN ad.diferencia = 0 THEN 'Correcto'
            WHEN ad.diferencia > 0 THEN 'Sobrante'
            WHEN ad.diferencia < 0 THEN 'Faltante'
        END as estado_conteo
    FROM auditoria_detalle ad
    JOIN insumo i ON ad.id_insumo = i.id_insumo
    WHERE ad.id_auditoria = p_id_auditoria
    ORDER BY ad.tipo_categoria, i.nombre_insumo;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FUNCIÓN PARA OBTENER ESTADÍSTICAS DE AUDITORÍA
CREATE OR REPLACE FUNCTION fn_estadisticas_auditoria(p_id_auditoria INTEGER)
RETURNS TABLE(
    total_insumos INTEGER,
    insumos_contados INTEGER,
    insumos_pendientes INTEGER,
    total_discrepancias INTEGER,
    porcentaje_completado DECIMAL(5,2),
    insumos_correctos INTEGER,
    insumos_sobrantes INTEGER,
    insumos_faltantes INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::INTEGER as total_insumos,
        COUNT(CASE WHEN conteo_fisico IS NOT NULL THEN 1 END)::INTEGER as insumos_contados,
        COUNT(CASE WHEN conteo_fisico IS NULL THEN 1 END)::INTEGER as insumos_pendientes,
        COUNT(CASE WHEN diferencia != 0 AND conteo_fisico IS NOT NULL THEN 1 END)::INTEGER as total_discrepancias,
        ROUND(
            (COUNT(CASE WHEN conteo_fisico IS NOT NULL THEN 1 END)::DECIMAL /
             NULLIF(COUNT(*), 0)) * 100, 2
        ) as porcentaje_completado,
        COUNT(CASE WHEN diferencia = 0 AND conteo_fisico IS NOT NULL THEN 1 END)::INTEGER as insumos_correctos,
        COUNT(CASE WHEN diferencia > 0 THEN 1 END)::INTEGER as insumos_sobrantes,
        COUNT(CASE WHEN diferencia < 0 THEN 1 END)::INTEGER as insumos_faltantes
    FROM auditoria_detalle
    WHERE id_auditoria = p_id_auditoria;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;



-- TRIGGER PARA ACTUALIZAR ESTADO DE AUDITORÍA AUTOMÁTICAMENTE
-- Se ejecuta cuando el usuario completa el conteo_fisico en auditoria_detalle
CREATE OR REPLACE FUNCTION fn_actualizar_estado_auditoria()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo procesar si conteo_fisico fue actualizado a un valor (no NULL)
    IF NEW.conteo_fisico IS NOT NULL AND (OLD.conteo_fisico IS NULL OR OLD.conteo_fisico != NEW.conteo_fisico) THEN
        -- Verificar si ya no hay items sin conteo_fisico
        IF NOT EXISTS (
            SELECT 1 FROM auditoria_detalle
            WHERE id_auditoria = NEW.id_auditoria
            AND conteo_fisico IS NULL
        ) THEN
            -- Todos los items tienen conteo_fisico, marcar auditoría como completada
            UPDATE auditoria_inventario
            SET
                estado = 'completada',
                fecha_fin_auditoria = CURRENT_DATE
            WHERE id_auditoria = NEW.id_auditoria
            AND estado = 'en_progreso';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_actualizar_estado_auditoria
AFTER UPDATE ON auditoria_detalle
FOR EACH ROW
EXECUTE FUNCTION fn_actualizar_estado_auditoria();

-- TRIGGER PARA BITÁCORA DE CAMBIOS EN AUDITORÍA (SOLO PARA auditoria_inventario)
CREATE OR REPLACE FUNCTION fn_bitacora_auditoria_cambios()
RETURNS TRIGGER AS $$
DECLARE
    v_nombre_auditoria VARCHAR(100);
    v_accion VARCHAR(50);
BEGIN
    -- Esta función SOLO debe ejecutarse para auditoria_inventario
    -- No para auditoria_detalle
    
    -- Obtener el nombre de la auditoría
    SELECT nombre_auditoria INTO v_nombre_auditoria
    FROM auditoria_inventario
    WHERE id_auditoria = COALESCE(NEW.id_auditoria, OLD.id_auditoria);

    -- Determinar acción basada en el tipo de operación
    v_accion := CASE
        WHEN TG_OP = 'INSERT' THEN 'creacion'
        WHEN TG_OP = 'UPDATE' THEN 'modificacion'
        WHEN TG_OP = 'DELETE' THEN 'eliminacion'
        ELSE 'desconocida'
    END;

    -- Solo insertar si se cambió el estado
    IF TG_OP = 'UPDATE' AND OLD.estado != NEW.estado THEN
        v_accion := NEW.estado;
    END IF;

    INSERT INTO bitacora_auditoria (
        id_auditoria, nombre_auditoria, accion, id_perfil, descripcion,
        datos_anteriores, datos_nuevos
    ) VALUES (
        COALESCE(NEW.id_auditoria, OLD.id_auditoria),
        v_nombre_auditoria,
        v_accion,
        COALESCE(NEW.id_perfil, OLD.id_perfil),
        CASE
            WHEN TG_OP = 'INSERT' THEN 'Auditoría creada'
            WHEN TG_OP = 'UPDATE' THEN 'Auditoría actualizada - Estado: ' || NEW.estado
            WHEN TG_OP = 'DELETE' THEN 'Auditoría eliminada'
        END,
        CASE WHEN TG_OP != 'INSERT' THEN row_to_json(OLD) ELSE NULL END,
        CASE WHEN TG_OP != 'DELETE' THEN row_to_json(NEW) ELSE NULL END
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_bitacora_auditoria_inventario
AFTER INSERT OR UPDATE OR DELETE ON auditoria_inventario
FOR EACH ROW
EXECUTE FUNCTION fn_bitacora_auditoria_cambios();

-- SOLO EJECUTAR EN UPDATE para auditoria_detalle (no en INSERT, ya que el INSERT lo hace fn_iniciar_auditoria)
DROP TRIGGER IF EXISTS trg_bitacora_auditoria_detalle ON auditoria_detalle;
-- NO CREAR EL TRIGGER - la bitácora se maneja en fn_actualizar_conteo_auditoria

-- ===============================================
-- VISTAS ÚTILES PARA AUDITORÍA
-- ===============================================

-- VISTA PARA AUDITORÍAS ACTIVAS
CREATE OR REPLACE VIEW vista_auditorias_activas AS
SELECT
    ai.id_auditoria,
    ai.nombre_auditoria,
    ai.fecha_inicio_periodo,
    ai.fecha_fin_periodo,
    ai.fecha_inicio_auditoria,
    ai.fecha_fin_auditoria,
    ai.fecha_creacion,
    ai.estado,
    ai.id_perfil,
    p.primer_nombre || ' ' || p.primer_apellido as nombre_perfil,
    stats.total_insumos,
    stats.insumos_contados,
    stats.insumos_pendientes,
    stats.total_discrepancias as total_discrepancias,
    stats.porcentaje_completado,
    stats.insumos_correctos,
    stats.insumos_sobrantes,
    stats.insumos_faltantes
FROM auditoria_inventario ai
LEFT JOIN perfil_usuario p ON ai.id_perfil = p.id_perfil
LEFT JOIN LATERAL fn_estadisticas_auditoria(ai.id_auditoria) AS stats ON true
WHERE ai.estado = 'en_progreso'
ORDER BY ai.fecha_creacion DESC;

-- VISTA PARA HISTORIAL DE AUDITORÍAS
CREATE OR REPLACE VIEW vista_historial_auditorias AS
SELECT
    ai.id_auditoria,
    ai.nombre_auditoria,
    ai.fecha_inicio_periodo,
    ai.fecha_fin_periodo,
    ai.fecha_inicio_auditoria,
    ai.fecha_fin_auditoria,
    ai.fecha_creacion,
    ai.estado,
    ai.id_perfil,
    p.primer_nombre || ' ' || p.primer_apellido as nombre_perfil,
    stats.total_insumos,
    stats.insumos_contados,
    stats.insumos_pendientes,
    stats.total_discrepancias,
    stats.porcentaje_completado,
    stats.insumos_correctos,
    stats.insumos_sobrantes,
    stats.insumos_faltantes
FROM auditoria_inventario ai
LEFT JOIN perfil_usuario p ON ai.id_perfil = p.id_perfil
LEFT JOIN LATERAL fn_estadisticas_auditoria(ai.id_auditoria) AS stats ON true
WHERE ai.estado IN ('completada', 'cancelada')
ORDER BY ai.fecha_fin_auditoria DESC;

-- ===============================================
-- FUNCIÓN PARA APLICAR AJUSTES DE AUDITORÍA
-- ===============================================

-- FUNCIÓN PARA APLICAR AJUSTES AUTOMÁTICOS BASADOS EN DISCREPANCIAS
CREATE OR REPLACE FUNCTION fn_aplicar_ajustes_auditoria(
    p_id_auditoria INTEGER,
    p_id_perfil INTEGER
)
RETURNS VOID AS $$
DECLARE
    v_detalle RECORD;
    v_tipo_movimiento VARCHAR(20);
    v_cantidad DECIMAL(10,2);
    v_costo_actual DECIMAL(10,2);
    v_nombre_auditoria VARCHAR(100);
BEGIN
    -- Verificar que la auditoría esté completada
    IF NOT EXISTS (
        SELECT 1 FROM auditoria_inventario
        WHERE id_auditoria = p_id_auditoria AND estado = 'completada'
    ) THEN
        RAISE EXCEPTION 'La auditoría debe estar completada antes de aplicar ajustes';
    END IF;

    SELECT nombre_auditoria INTO v_nombre_auditoria
    FROM auditoria_inventario
    WHERE id_auditoria = p_id_auditoria;

    -- Recorrer cada detalle con discrepancia
    FOR v_detalle IN
        SELECT ad.id_insumo, ad.diferencia, ad.causa_ajuste, ad.notas, ad.tipo_categoria
        FROM auditoria_detalle ad
        WHERE ad.id_auditoria = p_id_auditoria AND ad.diferencia != 0
    LOOP
        IF EXISTS (
            SELECT 1
            FROM movimiento_inventario mi
            WHERE mi.id_insumo = v_detalle.id_insumo
              AND mi.id_referencia = p_id_auditoria
              AND mi.tipo_movimiento IN ('entrada_ajuste', 'salida_ajuste', 'ajuste_perpetuo', 'ajuste_operativo')
        ) THEN
            CONTINUE;
        END IF;

        -- Determinar tipo de movimiento: entrada_ajuste si hay más de lo esperado, salida_ajuste si hay menos
        IF v_detalle.diferencia > 0 THEN
            v_tipo_movimiento := 'entrada_ajuste';
        ELSE
            v_tipo_movimiento := 'salida_ajuste';
        END IF;

        -- La cantidad es siempre positiva en movimiento_inventario
        v_cantidad := ABS(v_detalle.diferencia);

        -- Obtener costo promedio actual del insumo
        SELECT COALESCE(costo_promedio, 0) INTO v_costo_actual
        FROM insumo WHERE id_insumo = v_detalle.id_insumo;

        -- Insertar movimiento de ajuste
        INSERT INTO movimiento_inventario (
            id_insumo,
            tipo_movimiento,
            cantidad,
            costo_unitario_momento,
            descripcion,
            id_perfil,
            id_referencia
        ) VALUES (
            v_detalle.id_insumo,
            v_tipo_movimiento,
            v_cantidad,
            v_costo_actual,
            'Ajuste por auditoría: ' || v_nombre_auditoria ||
            ' - Causa: ' || COALESCE(v_detalle.causa_ajuste, 'No especificada') ||
            ' - Notas: ' || COALESCE(v_detalle.notas, ''),
            p_id_perfil,
            p_id_auditoria
        );
    END LOOP;

    -- Registrar en bitácora de auditoría
    INSERT INTO bitacora_auditoria (
        id_auditoria, nombre_auditoria, accion, id_perfil, descripcion
    ) VALUES (
        p_id_auditoria, v_nombre_auditoria, 'ajuste_aplicado', p_id_perfil,
        'Ajustes aplicados al inventario basados en discrepancias de auditoría'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===============================================
-- FUNCIÓN KARDEX (Reporte de Movimientos de Inventario)
-- ===============================================

-- Eliminar función existente si tiene diferente firma de retorno
DROP FUNCTION IF EXISTS fn_kardex_insumo(INTEGER, DATE, DATE);

CREATE OR REPLACE FUNCTION fn_kardex_insumo(
    p_id_insumo INTEGER,
    p_fecha_desde DATE DEFAULT NULL,
    p_fecha_hasta DATE DEFAULT NULL
)
RETURNS TABLE(
    fecha TIMESTAMP,
    tipo_movimiento VARCHAR(20),
    referencia VARCHAR(100),
    entrada DECIMAL(10,2),
    salida DECIMAL(10,2),
    saldo DECIMAL(10,2),
    costo_unitario DECIMAL(10,2),
    valor_total DECIMAL(12,2),
    usuario VARCHAR(100),
    descripcion TEXT,
    lote_fecha_vencimiento DATE,
    lote_ubicacion VARCHAR(100),
    lote_cantidad_inicial DECIMAL(10,2),
    lote_cantidad_actual DECIMAL(10,2),
    presentacion_descripcion TEXT,
    presentacion_unidad TEXT
) AS $$
DECLARE
    v_saldo_actual DECIMAL(10,2) := 0;
    v_fecha_desde DATE;
    v_fecha_hasta DATE;
BEGIN
    -- Establecer fechas por defecto si no se proporcionan
    v_fecha_desde := COALESCE(p_fecha_desde, CURRENT_DATE - INTERVAL '30 days');
    v_fecha_hasta := COALESCE(p_fecha_hasta, CURRENT_DATE);
    
    RETURN QUERY
    WITH movimientos_ordenados AS (
        SELECT 
            mi.fecha_movimiento,
            mi.tipo_movimiento::VARCHAR(20),
            CASE 
                WHEN mi.tipo_movimiento IN ('entrada_compra', 'salida_venta') THEN 
                    'Ref: #' || COALESCE(mi.id_referencia::VARCHAR(100), 'N/A')
                ELSE 
                    'Ajuste manual'
            END::VARCHAR(100) as referencia,
            CASE 
                WHEN mi.tipo_movimiento IN ('entrada_compra', 'entrada_ajuste', 'devolucion', 'ajuste_perpetuo', 'ajuste_operativo') THEN mi.cantidad
                ELSE 0
            END as entrada,
            CASE 
                WHEN mi.tipo_movimiento IN ('salida_venta', 'salida_ajuste', 'perdida') THEN mi.cantidad
                ELSE 0
            END as salida,
            mi.costo_unitario_momento,
            CONCAT(pu.primer_nombre, ' ', pu.primer_apellido)::VARCHAR(100) as usuario,
            mi.descripcion,
            li.fecha_vencimiento as lote_fecha_vencimiento,
            li.ubicacion::VARCHAR(100) as lote_ubicacion,
            li.cantidad_inicial as lote_cantidad_inicial,
            li.cantidad_actual as lote_cantidad_actual,
            ip.descripcion_presentacion as presentacion_descripcion,
            ip.unidad_compra as presentacion_unidad
        FROM movimiento_inventario mi
        LEFT JOIN perfil_usuario pu ON mi.id_perfil = pu.id_perfil
        LEFT JOIN lote_insumo li ON mi.id_lote = li.id_lote
        LEFT JOIN insumo_presentacion ip ON ip.id_insumo = mi.id_insumo AND ip.es_principal = TRUE
        WHERE mi.id_insumo = p_id_insumo
        AND DATE(mi.fecha_movimiento) BETWEEN v_fecha_desde AND v_fecha_hasta
        ORDER BY mi.fecha_movimiento ASC, mi.id_movimiento ASC
    )
    SELECT 
        mo.fecha_movimiento::TIMESTAMP,
        mo.tipo_movimiento::VARCHAR(20),
        mo.referencia::VARCHAR(100),
        mo.entrada::DECIMAL(10,2),
        mo.salida::DECIMAL(10,2),
        -- Calcular saldo acumulado
        SUM(mo.entrada - mo.salida) OVER (ORDER BY mo.fecha_movimiento, mo.referencia ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)::DECIMAL(10,2) as saldo,
        mo.costo_unitario_momento::DECIMAL(10,2),
        ((mo.entrada + mo.salida) * mo.costo_unitario_momento)::DECIMAL(12,2) as valor_total,
        mo.usuario::VARCHAR(100),
        mo.descripcion::TEXT,
        mo.lote_fecha_vencimiento,
        mo.lote_ubicacion::VARCHAR(100),
        mo.lote_cantidad_inicial::DECIMAL(10,2),
        mo.lote_cantidad_actual::DECIMAL(10,2),
        mo.presentacion_descripcion::TEXT,
        mo.presentacion_unidad::TEXT
    FROM movimientos_ordenados mo;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===============================================
-- BASE DE DATOS COMPLETA - VERSIÓN FINAL
-- ===============================================

-- Esta es la versión final y completa de la base de datos para Shucway.
-- Incluye todos los módulos: autenticación, inventario, compras, ventas,
-- gastos, arqueo de caja, puntos de lealtad, auditoría de inventario,
-- y todas las funciones, triggers e índices necesarios.
-- Revisado y ajustado: duplicados eliminados, índices corregidos,
-- fórmulas verificadas. Listo para producción.

-- ===============================================
-- MIGRACIONES PARA ACTUALIZACIÓN DE ESQUEMA
-- ===============================================

-- Actualizar tabla movimiento_inventario para incluir nuevos tipos de movimiento
ALTER TABLE movimiento_inventario DROP CONSTRAINT IF EXISTS chk_tipo_movimiento;
ALTER TABLE movimiento_inventario ADD CONSTRAINT chk_tipo_movimiento CHECK (tipo_movimiento IN (
    'entrada_compra', 'salida_venta', 'entrada_ajuste', 'salida_ajuste',
    'entrada_devolucion', 'salida_devolucion', 'entrada_transferencia',
    'salida_transferencia', 'entrada_produccion', 'salida_produccion',
    'ajuste_perpetuo', 'ajuste_operativo'
));

-- Actualizar tabla auditoria_inventario
ALTER TABLE auditoria_inventario RENAME COLUMN nombre_auditor TO nombre_auditoria;
ALTER TABLE auditoria_inventario DROP COLUMN IF EXISTS notas_generales;
ALTER TABLE auditoria_inventario DROP COLUMN IF EXISTS total_items_contados;
ALTER TABLE auditoria_inventario DROP COLUMN IF EXISTS total_discrepancias;

-- Actualizar tabla auditoria_detalle
ALTER TABLE auditoria_detalle DROP COLUMN IF EXISTS ubicacion_conteo;
ALTER TABLE auditoria_detalle DROP COLUMN IF EXISTS fecha_conteo;

-- Actualizar tabla bitacora_auditoria
ALTER TABLE bitacora_auditoria ADD COLUMN IF NOT EXISTS nombre_auditoria VARCHAR(100);

-- ===============================================
-- TABLAS DE ÓRDENES DE COMPRA
-- ===============================================

CREATE TABLE IF NOT EXISTS orden_compra (
    id_orden SERIAL PRIMARY KEY,
    fecha_orden DATE NOT NULL DEFAULT CURRENT_DATE,
    id_proveedor INTEGER NOT NULL REFERENCES proveedor(id_proveedor) ON DELETE RESTRICT,
    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'recibida', 'cancelada')),
    tipo_orden VARCHAR(20) DEFAULT 'manual' CHECK (tipo_orden IN ('manual', 'automatica')),
    motivo_generacion TEXT,
    fecha_aprobacion TIMESTAMP,
    fecha_entrega_estimada DATE,
    total DECIMAL(10,2) DEFAULT 0,
    creado_por INTEGER REFERENCES perfil_usuario(id_perfil),
    aprobado_por INTEGER REFERENCES perfil_usuario(id_perfil),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS detalle_orden_compra (
    id_detalle SERIAL PRIMARY KEY,
    id_orden INTEGER NOT NULL REFERENCES orden_compra(id_orden) ON DELETE CASCADE,
    id_insumo INTEGER NOT NULL REFERENCES insumo(id_insumo) ON DELETE RESTRICT,
    cantidad DECIMAL(10,2) NOT NULL CHECK (cantidad > 0),
    precio_unitario DECIMAL(10,2) NOT NULL CHECK (precio_unitario >= 0),
    subtotal DECIMAL(10,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
    iva DECIMAL(10,2) DEFAULT 0,
    id_presentacion INTEGER REFERENCES insumo_presentacion(id_presentacion),
    cantidad_recibida DECIMAL(10,2) DEFAULT 0,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_orden_compra_fecha ON orden_compra(fecha_orden);
CREATE INDEX IF NOT EXISTS idx_orden_compra_proveedor ON orden_compra(id_proveedor);
CREATE INDEX IF NOT EXISTS idx_orden_compra_estado ON orden_compra(estado);
CREATE INDEX IF NOT EXISTS idx_detalle_orden_compra_orden ON detalle_orden_compra(id_orden);
CREATE INDEX IF NOT EXISTS idx_detalle_orden_compra_insumo ON detalle_orden_compra(id_insumo);

-- Trigger para actualizar fecha_actualizacion en orden_compra
CREATE OR REPLACE FUNCTION actualizar_fecha_orden_compra()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_actualizacion = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER IF NOT EXISTS trigger_actualizar_fecha_orden_compra
    BEFORE UPDATE ON orden_compra
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_fecha_orden_compra();

-- ===============================================================

-- Función para acumular puntos por venta confirmada
CREATE OR REPLACE FUNCTION fn_acumular_puntos_venta(p_id_venta INTEGER, p_id_cajero INTEGER DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
    v_id_cliente INTEGER;
    v_acumula_puntos BOOLEAN;
    v_puntos_anteriores INTEGER;
    v_puntos_nuevos INTEGER;
BEGIN
    -- Obtener el cliente y si acumula puntos de la venta
    SELECT id_cliente, acumula_puntos INTO v_id_cliente, v_acumula_puntos
    FROM venta
    WHERE id_venta = p_id_venta;

    RAISE NOTICE 'Procesando puntos para venta %, cliente %, acumula_puntos %', p_id_venta, v_id_cliente, v_acumula_puntos;

    -- Si no hay cliente o no acumula puntos, no acumular
    IF v_id_cliente IS NULL OR v_acumula_puntos = FALSE THEN
        RAISE NOTICE 'No hay cliente o no acumula puntos, saliendo';
        RETURN;
    END IF;

    -- Obtener puntos actuales del cliente
    SELECT COALESCE(puntos_acumulados, 0) INTO v_puntos_anteriores
    FROM cliente
    WHERE id_cliente = v_id_cliente;

    RAISE NOTICE 'Puntos anteriores: %', v_puntos_anteriores;

    -- Calcular nuevos puntos (1 punto por venta)
    v_puntos_nuevos := v_puntos_anteriores + 1;

    -- Si llega a 10 puntos, reiniciar a 0
    IF v_puntos_nuevos >= 10 THEN
        v_puntos_nuevos := 0;
    END IF;

    RAISE NOTICE 'Puntos nuevos: %', v_puntos_nuevos;

    -- Actualizar puntos del cliente
    UPDATE cliente
    SET puntos_acumulados = v_puntos_nuevos,
        ultima_compra = CURRENT_TIMESTAMP
    WHERE id_cliente = v_id_cliente;

    RAISE NOTICE 'Cliente actualizado';

    -- Registrar en historial de puntos
    INSERT INTO historial_puntos (
        id_cliente,
        id_venta,
        tipo_movimiento,
        puntos_anterior,
        puntos_movimiento,
        puntos_nuevo,
        descripcion,
        id_cajero
    ) VALUES (
        v_id_cliente,
        p_id_venta,
        CASE WHEN v_puntos_nuevos = 0 THEN 'ajuste' ELSE 'acumulacion' END,
        v_puntos_anteriores,
        CASE WHEN v_puntos_nuevos = 0 THEN -10 ELSE 1 END,
        v_puntos_nuevos,
        CASE WHEN v_puntos_nuevos = 0 THEN 'Reset de puntos después de 10 acumulaciones' ELSE 'Punto acumulado por venta' END,
        p_id_cajero
    );

    RAISE NOTICE 'Historial insertado';

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para canjear puntos
CREATE OR REPLACE FUNCTION fn_canjear_puntos(p_id_cliente INTEGER, p_id_venta INTEGER, p_id_cajero INTEGER DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
    v_puntos_actuales INTEGER;
    v_puntos_a_canjear INTEGER := 10; -- Canjear 10 puntos por defecto
    v_puntos_nuevos INTEGER;
BEGIN
    -- Obtener puntos actuales del cliente
    SELECT COALESCE(puntos_acumulados, 0) INTO v_puntos_actuales
    FROM cliente
    WHERE id_cliente = p_id_cliente;

    -- Verificar que tenga suficientes puntos
    IF v_puntos_actuales < v_puntos_a_canjear THEN
        RAISE EXCEPTION 'Puntos insuficientes para canje. Puntos actuales: %, requeridos: %', v_puntos_actuales, v_puntos_a_canjear;
    END IF;

    -- Calcular puntos nuevos
    v_puntos_nuevos := v_puntos_actuales - v_puntos_a_canjear;

    -- Actualizar puntos del cliente
    UPDATE cliente
    SET puntos_acumulados = v_puntos_nuevos
    WHERE id_cliente = p_id_cliente;

    -- Registrar en historial de puntos
    INSERT INTO historial_puntos (
        id_cliente,
        id_venta,
        tipo_movimiento,
        puntos_anterior,
        puntos_movimiento,
        puntos_nuevo,
        descripcion,
        id_cajero
    ) VALUES (
        p_id_cliente,
        p_id_venta,
        'canje',
        v_puntos_actuales,
        -v_puntos_a_canjear,
        v_puntos_nuevos,
        'Canje de 10 puntos por producto gratis',
        p_id_cajero
    );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para acumular puntos automáticamente al confirmar venta
CREATE OR REPLACE FUNCTION trg_acumular_puntos_venta()
RETURNS TRIGGER AS $$
BEGIN
    RAISE NOTICE 'Trigger trg_acumular_puntos_venta ejecutado para venta %', NEW.id_venta;
    -- Solo ejecutar cuando la venta se confirma por primera vez
    IF (TG_OP = 'INSERT' AND NEW.estado = 'confirmada') OR
       (TG_OP = 'UPDATE' AND NEW.estado = 'confirmada' AND COALESCE(OLD.estado, '') <> 'confirmada') THEN
        RAISE NOTICE 'Llamando a fn_acumular_puntos_venta para venta %', NEW.id_venta;
        PERFORM fn_acumular_puntos_venta(NEW.id_venta, NEW.id_cajero);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_acumular_puntos_venta ON venta;
CREATE TRIGGER trg_acumular_puntos_venta
AFTER INSERT OR UPDATE OF estado ON venta
FOR EACH ROW
EXECUTE FUNCTION trg_acumular_puntos_venta();

-- Agregar campo para estado de transferencias
ALTER TABLE venta ADD COLUMN IF NOT EXISTS estado_transferencia VARCHAR(20) DEFAULT 'esperando' CHECK (estado_transferencia IN ('esperando', 'recibido'));
