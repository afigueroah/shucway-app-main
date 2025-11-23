// ================================================================
// 📦 TIPOS DE PRODUCTOS
// ================================================================

export interface CategoriaProducto {
  id_categoria: number;
  nombre_categoria: string;
  descripcion?: string;
  estado: 'activo' | 'desactivado';
}

export interface Producto {
  id_producto: number;
  nombre_producto: string;
  descripcion?: string;
  precio_venta: number;
  costo_producto: number;
  id_categoria?: number;
  estado: 'activo' | 'desactivado';
  imagen_url?: string;
  fecha_creacion: Date;
}

export interface ProductoVariante {
  id_variante: number;
  id_producto: number;
  id_insumo?: number;  // Insumo asociado a esta variante (opcional)
  nombre_variante: string;
  precio_variante: number;
  costo_variante?: number;
  cantidad_insumo?: number;  // Cantidad del insumo a descontar del inventario
  estado: 'activo' | 'desactivado';
}

export interface RecetaDetalle {
  id_receta: number;
  id_producto: number;
  id_variante?: number | null;
  id_insumo: number;
  cantidad_requerida: number;
  unidad_base: string;
  // Eliminado: es_obligatorio ya no se almacena en receta_detalle
}

export interface BitacoraProductos {
  id_bitacora: number;
  tabla_afectada: string;
  operacion: 'INSERT' | 'UPDATE' | 'DELETE';
  id_registro: number;
  datos_anteriores?: Record<string, unknown>;
  datos_nuevos?: Record<string, unknown>;
  id_perfil?: number;
  fecha_operacion: Date;
}

// ================================================================
// DTOs para Productos
// ================================================================

export interface CreateProductoDTO {
  nombre_producto: string;
  descripcion?: string;
  precio_venta: number;
  costo_producto?: number;
  id_categoria?: number;
  estado?: 'activo' | 'desactivado';
  imagen_url?: string;
  variantes?: Array<Omit<CreateVarianteDTO, 'id_producto'>>;
  receta?: Array<Omit<CreateRecetaDTO, 'id_producto'>>;
}

export interface UpdateProductoDTO {
  nombre_producto?: string;
  descripcion?: string;
  precio_venta?: number;
  costo_producto?: number;
  id_categoria?: number;
  estado?: 'activo' | 'desactivado';
  imagen_url?: string;
  variantes?: Array<Omit<CreateVarianteDTO, 'id_producto'>>;
  receta?: Array<Omit<CreateRecetaDTO, 'id_producto'>>;
}

export interface CreateVarianteDTO {
  id_producto: number;
  id_insumo?: number;  // Insumo asociado a la variante (opcional)
  nombre_variante: string;
  precio_variante: number;
  costo_variante?: number;
  cantidad_insumo?: number;  // Cantidad del insumo a descontar
  estado?: 'activo' | 'desactivado';
}

export interface CreateRecetaDTO {
  id_producto: number;
  id_variante?: number | null;
  id_insumo: number;
  cantidad_requerida: number;
  unidad_base: string;
  // Eliminado: es_obligatorio ya no se parte del DTO
}

export interface ProductoConReceta extends Producto {
  receta: RecetaDetalle[];
  variantes?: ProductoVariante[];
}
