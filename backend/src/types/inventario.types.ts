// ================================================================
// 📦 TIPOS DE INVENTARIO
// ================================================================

export interface CategoriaInsumo {
  id_categoria: number;
  nombre: string;
  descripcion?: string;
  tipo_categoria: 'perpetuo' | 'operativo';
}

export interface Insumo {
  id_insumo: number;
  nombre_insumo: string;
  id_categoria: number;
  unidad_base: string;
  id_proveedor_principal?: number;
  stock_minimo: number;
  stock_maximo: number;
  costo_promedio: number;
  fecha_registro: Date;
  activo: boolean;
  descripcion_presentacion?: string;
  insumo_url?: string;
}

export interface CatalogoInsumo {
  id_insumo: number;
  nombre: string;
  unidad_base: string;
  stock_actual: number;
  stock_minimo: number;
  stock_maximo: number;
  costo_promedio: number;
  activo: boolean;
  fecha_creacion: Date;
  id_categoria: number;
  id_proveedor_principal?: number;
  categoria: {
    nombre: string;
    tipo_categoria: 'perpetuo' | 'operativo';
  };
  descripcion_presentacion?: string;
  ubicacion?: string;
  insumo_url?: string;
  fecha_vencimiento?: string;
}

export interface LoteInsumo {
  id_lote: number;
  id_insumo: number;
  fecha_vencimiento?: Date;
  cantidad_inicial: number;
  cantidad_actual: number;
  costo_unitario: number;
  ubicacion?: string;
}

export interface InsumoPresentacion {
  id_presentacion: number;
  id_insumo: number;
  id_proveedor?: number;
  descripcion_presentacion?: string;
  unidad_compra: string;
  unidades_por_presentacion: number;
  costo_compra_unitario: number;
  es_principal: boolean;
  activo: boolean;
}

export interface MovimientoInventario {
  id_movimiento: number;
  id_insumo: number;
  id_lote?: number;
  tipo_movimiento: 'entrada_compra' | 'salida_venta' | 'entrada_ajuste' | 'salida_ajuste' | 'perdida' | 'devolucion' | 'entrada_devolucion' | 'salida_devolucion' | 'entrada_transferencia' | 'salida_transferencia' | 'entrada_produccion' | 'salida_produccion' | 'ajuste_perpetuo' | 'ajuste_operativo';
  cantidad: number;
  fecha_movimiento: Date;
  id_perfil?: number;
  id_referencia?: number;
  descripcion?: string;
  costo_unitario_momento: number;
}

export interface BitacoraInventario {
  id_bitacora: number;
  tabla_afectada: string;
  operacion: 'INSERT' | 'UPDATE' | 'DELETE';
  id_registro: number;
  datos_anteriores?: Record<string, unknown>;
  datos_nuevos?: Record<string, unknown>;
  id_perfil?: number;
  fecha_operacion: Date;
  ip_address?: string;
}

// ================================================================
// DTOs para Inventario
// ================================================================

export interface CreateInsumoDTO {
  nombre_insumo: string;
  id_categoria: number;
  unidad_base: string;
  id_proveedor_principal?: number;
  stock_minimo: number;
  stock_maximo: number;
  costo_promedio?: number;
  descripcion_presentacion?: string;
  fecha_vencimiento?: string;
  ubicacion?: string;
  insumo_url?: string;
}

export interface UpdateInsumoDTO {
  nombre_insumo?: string;
  id_categoria?: number;
  unidad_base?: string;
  id_proveedor_principal?: number;
  stock_minimo?: number;
  stock_maximo?: number;
  costo_promedio?: number;
  descripcion_presentacion?: string;
  activo?: boolean;
  fecha_vencimiento?: string;
  ubicacion?: string;
  insumo_url?: string;
}

export interface CreateLoteDTO {
  id_insumo: number;
  fecha_vencimiento?: string;
  cantidad_inicial: number;
  costo_unitario: number;
  ubicacion?: string;
}

export interface CreatePresentacionDTO {
  id_insumo: number;
  id_proveedor?: number;
  descripcion_presentacion?: string;
  unidad_compra: string;
  unidades_por_presentacion: number;
  costo_compra_unitario: number;
  es_principal: boolean;
}

export interface CreateMovimientoDTO {
  id_insumo: number;
  id_lote?: number;
  tipo_movimiento: 'entrada_compra' | 'salida_venta' | 'entrada_ajuste' | 'salida_ajuste' | 'perdida' | 'devolucion' | 'entrada_devolucion' | 'salida_devolucion' | 'entrada_transferencia' | 'salida_transferencia' | 'entrada_produccion' | 'salida_produccion' | 'ajuste_perpetuo' | 'ajuste_operativo';
  cantidad: number;
  descripcion?: string;
  costo_unitario_momento: number;
}

export interface StockActual {
  id_insumo: number;
  nombre_insumo: string;
  cantidad_actual: number;
  unidad_base: string;
  stock_minimo: number;
  stock_maximo: number;
  costo_promedio: number;
  estado_stock: 'bajo' | 'normal' | 'alto';
}

export interface KardexInsumo {
  fecha: string;
  tipo_movimiento: string;
  referencia: string;
  entrada: number;
  salida: number;
  saldo: number;
  costo_unitario: number;
  valor_total: number;
  usuario: string;
  descripcion?: string;
  lote_fecha_vencimiento?: string;
  lote_ubicacion?: string;
  lote_cantidad_inicial?: number;
  lote_cantidad_actual?: number;
  presentacion_descripcion?: string;
  presentacion_unidad?: string;
}
