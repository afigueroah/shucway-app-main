export type TableMeta = {
  pk?: string;
  labelFields?: string[]; // preferencia para mostrar labels humanos
  foreignKeys?: Record<string, string>;
  columns?: string[];
  autoCreated?: string[]; // campos con DEFAULT CURRENT_TIMESTAMP / DATE que deben ser automáticos
  // Valor que debe usarse para marcar un registro como "borrado" en esta tabla.
  // Puede ser un string (ej. 'inactivo') o boolean (ej. false para campos `activo`).
  deletedValue?: string | boolean;
};

const tables: Record<string, TableMeta> = {
  rol_usuario: { pk: 'id_rol', labelFields: ['nombre_rol'], autoCreated: ['fecha_creacion'], deletedValue: false },
  perfil_usuario: { pk: 'id_perfil', labelFields: ['primer_nombre','username','email'], foreignKeys: { id_rol: 'rol_usuario' }, autoCreated: ['fecha_registro'], deletedValue: 'inactivo' },
  bitacora_seguridad: { pk: 'id_bitacora_seguridad', foreignKeys: { id_perfil: 'perfil_usuario' }, autoCreated: ['fecha_evento'] },

  categoria_insumo: { pk: 'id_categoria', labelFields: ['nombre'] },
  proveedor: { pk: 'id_proveedor', labelFields: ['nombre_empresa'], deletedValue: false },
  insumo: { pk: 'id_insumo', labelFields: ['nombre_insumo'], foreignKeys: { id_categoria: 'categoria_insumo', id_proveedor_principal: 'proveedor' }, autoCreated: ['fecha_registro'], deletedValue: false },
  lote_insumo: { pk: 'id_lote', foreignKeys: { id_insumo: 'insumo' }, autoCreated: ['fecha_vencimiento'] },
  movimiento_inventario: { pk: 'id_movimiento', foreignKeys: { id_insumo: 'insumo', id_lote: 'lote_insumo' }, autoCreated: ['fecha_movimiento'] },

  orden_compra: { pk: 'id_orden', foreignKeys: { id_proveedor: 'proveedor', creado_por: 'perfil_usuario', aprobado_por: 'perfil_usuario' }, labelFields: ['fecha_orden'], autoCreated: ['fecha_orden'] },
  detalle_orden_compra: { pk: 'id_detalle', foreignKeys: { id_orden: 'orden_compra', id_insumo: 'insumo' } },
  recepcion_mercaderia: { pk: 'id_recepcion', foreignKeys: { id_orden: 'orden_compra', id_perfil: 'perfil_usuario' }, autoCreated: ['fecha_recepcion'] },
  detalle_recepcion_mercaderia: { pk: 'id_detalle', foreignKeys: { id_recepcion: 'recepcion_mercaderia', id_detalle_orden: 'detalle_orden_compra', id_lote: 'lote_insumo' } },

  // Para categoria_producto, producto, producto_variante: usar 'desactivado' ya que la constraint no permite 'inactivo'.
  // Para perfil_usuario: usar 'inactivo' (permitido por constraint).
  // Para tablas con activo BOOLEAN: usar false.
  // Para otras tablas con estado VARCHAR que no permiten valores de borrado, no definir deletedValue para usar hard delete.
  categoria_producto: { pk: 'id_categoria', labelFields: ['nombre_categoria'], deletedValue: 'desactivado' },
  producto: { pk: 'id_producto', labelFields: ['nombre_producto'], foreignKeys: { id_categoria: 'categoria_producto' }, autoCreated: ['fecha_creacion'], deletedValue: 'desactivado' },
  producto_variante: { pk: 'id_variante', labelFields: ['nombre_variante'], foreignKeys: { id_producto: 'producto' }, autoCreated: ['fecha_creacion'], deletedValue: 'desactivado' },
  receta_detalle: { pk: 'id_receta', foreignKeys: { id_producto: 'producto', id_insumo: 'insumo' } },

  cliente: { pk: 'id_cliente', labelFields: ['nombre'], autoCreated: ['fecha_registro'] },
  venta: { pk: 'id_venta', foreignKeys: { id_cliente: 'cliente', id_cajero: 'perfil_usuario' }, labelFields: ['fecha_venta'], autoCreated: ['fecha_venta'] },
  detalle_venta: { pk: 'id_detalle', foreignKeys: { id_venta: 'venta', id_producto: 'producto', id_variante: 'producto_variante' } },

  categoria_gasto: { pk: 'id_categoria', labelFields: ['nombre'] },
  gasto_operativo: { pk: 'id_gasto', labelFields: ['numero_gasto'], autoCreated: ['fecha_gasto', 'numero_gasto', 'fecha_creacion'] },
  deposito_banco: { pk: 'id_deposito', foreignKeys: { id_perfil: 'perfil_usuario' }, autoCreated: ['fecha_deposito'] },

  arqueo_caja: { pk: 'id_arqueo', foreignKeys: { id_cajero: 'perfil_usuario' }, autoCreated: ['fecha_arqueo'] },

  historial_puntos: { pk: 'id_historial', foreignKeys: { id_cliente: 'cliente', id_venta: 'venta' }, autoCreated: ['fecha_movimiento'] },

  bitacora_inventario: { pk: 'id_bitacora_inventario', foreignKeys: { id_insumo: 'insumo' }, autoCreated: ['fecha_accion'] },
  bitacora_ventas: { pk: 'id_bitacora_venta', foreignKeys: { id_venta: 'venta' }, autoCreated: ['fecha_accion'] },
  bitacora_ordenes_compra: { pk: 'id_bitacora_orden', foreignKeys: { id_orden: 'orden_compra' }, autoCreated: ['fecha_accion'] },
  bitacora_productos: { pk: 'id_bitacora_producto', foreignKeys: { id_producto: 'producto' }, autoCreated: ['fecha_accion'] },

  // Si faltan tablas concretas, se pueden añadir aquí con el mismo formato
};

// Crear un mapa explícito table -> primary key para evitar depender de heurísticas
const primaryKeyMap: Record<string, string> = Object.fromEntries(
  Object.entries(tables).map(([tableName, meta]) => [tableName, meta.pk || 'id'])
);

function getPrimaryKey(tableName: string): string {
  return primaryKeyMap[tableName] || 'id';
}

export { tables, primaryKeyMap, getPrimaryKey };

export default { tables, primaryKeyMap, getPrimaryKey };
