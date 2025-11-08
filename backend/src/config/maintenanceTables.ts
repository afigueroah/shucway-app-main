import { z } from 'zod';

export type MaintenanceColumnType = 'string' | 'number' | 'boolean' | 'date' | 'json' | 'text';

export interface MaintenanceColumn {
  name: string;
  type: MaintenanceColumnType;
  label?: string;
  readOnly?: boolean;
}

export interface MaintenanceTableConfig {
  name: string;
  label: string;
  primaryKey: string;
  columns: MaintenanceColumn[];
  defaultOrder?: { column: string; ascending?: boolean };
  searchableColumns?: string[];
}

const maintenanceTablesSchema = z.record(
  z.string(),
  z.object({
    name: z.string(),
    label: z.string(),
    primaryKey: z.string(),
    columns: z
      .array(
        z.object({
          name: z.string(),
          type: z.enum(['string', 'number', 'boolean', 'date', 'json', 'text']),
          label: z.string().optional(),
          readOnly: z.boolean().optional(),
        })
      )
      .min(1),
    defaultOrder: z
      .object({
        column: z.string(),
        ascending: z.boolean().optional(),
      })
      .optional(),
    searchableColumns: z.array(z.string()).optional(),
  })
);

export const MAINTENANCE_TABLES: Record<string, MaintenanceTableConfig> = maintenanceTablesSchema.parse({
  bitacora_seguridad: {
    name: 'bitacora_seguridad',
    label: 'Bitácora de Seguridad',
    primaryKey: 'id_bitacora_seguridad',
    defaultOrder: { column: 'fecha_evento', ascending: false },
    searchableColumns: ['tipo_evento', 'descripcion', 'ip_address', 'user_agent'],
    columns: [
      { name: 'id_bitacora_seguridad', type: 'number', label: 'ID', readOnly: true },
      { name: 'id_perfil', type: 'number', label: 'Perfil' },
      { name: 'intentos_fallidos', type: 'number' },
      { name: 'ultimo_intento_fallido', type: 'date' },
      { name: 'bloqueado_hasta', type: 'date' },
      { name: 'token_recuperacion', type: 'string' },
      { name: 'token_expiracion', type: 'date' },
      { name: 'tipo_evento', type: 'string' },
      { name: 'ip_address', type: 'string' },
      { name: 'user_agent', type: 'text' },
      { name: 'descripcion', type: 'text' },
      { name: 'fecha_evento', type: 'date', readOnly: true },
    ],
  },
  bitacora_inventario: {
    name: 'bitacora_inventario',
    label: 'Bitácora de Inventario',
    primaryKey: 'id_bitacora_inventario',
    defaultOrder: { column: 'fecha_accion', ascending: false },
    searchableColumns: ['accion', 'campo_modificado', 'descripcion'],
    columns: [
      { name: 'id_bitacora_inventario', type: 'number', readOnly: true },
      { name: 'id_insumo', type: 'number' },
      { name: 'accion', type: 'string' },
      { name: 'campo_modificado', type: 'string' },
      { name: 'valor_anterior', type: 'text' },
      { name: 'valor_nuevo', type: 'text' },
      { name: 'id_perfil', type: 'number' },
      { name: 'fecha_accion', type: 'date', readOnly: true },
      { name: 'ip_address', type: 'string' },
      { name: 'descripcion', type: 'text' },
    ],
  },
  bitacora_ventas: {
    name: 'bitacora_ventas',
    label: 'Bitácora de Ventas',
    primaryKey: 'id_bitacora_venta',
    defaultOrder: { column: 'fecha_accion', ascending: false },
    searchableColumns: ['accion', 'descripcion', 'estado_nuevo', 'estado_anterior'],
    columns: [
      { name: 'id_bitacora_venta', type: 'number', readOnly: true },
      { name: 'id_venta', type: 'number' },
      { name: 'accion', type: 'string' },
      { name: 'estado_anterior', type: 'string' },
      { name: 'estado_nuevo', type: 'string' },
      { name: 'id_perfil', type: 'number' },
      { name: 'fecha_accion', type: 'date', readOnly: true },
      { name: 'ip_address', type: 'string' },
      { name: 'descripcion', type: 'text' },
      { name: 'datos_adicionales', type: 'json' },
    ],
  },
  bitacora_ordenes_compra: {
    name: 'bitacora_ordenes_compra',
    label: 'Bitácora Órdenes de Compra',
    primaryKey: 'id_bitacora_orden',
    defaultOrder: { column: 'fecha_accion', ascending: false },
    searchableColumns: ['accion', 'descripcion', 'estado_nuevo', 'estado_anterior'],
    columns: [
      { name: 'id_bitacora_orden', type: 'number', readOnly: true },
      { name: 'id_orden', type: 'number' },
      { name: 'accion', type: 'string' },
      { name: 'estado_anterior', type: 'string' },
      { name: 'estado_nuevo', type: 'string' },
      { name: 'id_perfil', type: 'number' },
      { name: 'fecha_accion', type: 'date', readOnly: true },
      { name: 'ip_address', type: 'string' },
      { name: 'descripcion', type: 'text' },
      { name: 'datos_adicionales', type: 'json' },
    ],
  },
  bitacora_productos: {
    name: 'bitacora_productos',
    label: 'Bitácora de Productos',
    primaryKey: 'id_bitacora_producto',
    defaultOrder: { column: 'fecha_accion', ascending: false },
    searchableColumns: ['accion', 'campo_modificado', 'descripcion'],
    columns: [
      { name: 'id_bitacora_producto', type: 'number', readOnly: true },
      { name: 'id_producto', type: 'number' },
      { name: 'accion', type: 'string' },
      { name: 'campo_modificado', type: 'string' },
      { name: 'valor_anterior', type: 'text' },
      { name: 'valor_nuevo', type: 'text' },
      { name: 'id_perfil', type: 'number' },
      { name: 'fecha_accion', type: 'date', readOnly: true },
      { name: 'descripcion', type: 'text' },
    ],
  },
  bitacora_auditoria: {
    name: 'bitacora_auditoria',
    label: 'Bitácora Auditoría',
    primaryKey: 'id_bitacora',
    defaultOrder: { column: 'fecha_accion', ascending: false },
    searchableColumns: ['accion', 'descripcion', 'nombre_auditoria'],
    columns: [
      { name: 'id_bitacora', type: 'number', readOnly: true },
      { name: 'id_auditoria', type: 'number' },
      { name: 'nombre_auditoria', type: 'string' },
      { name: 'accion', type: 'string' },
      { name: 'id_perfil', type: 'number' },
      { name: 'fecha_accion', type: 'date', readOnly: true },
      { name: 'descripcion', type: 'text' },
      { name: 'datos_anteriores', type: 'json' },
      { name: 'datos_nuevos', type: 'json' },
    ],
  },
  deposito_banco: {
    name: 'deposito_banco',
    label: 'Depósitos en Banco',
    primaryKey: 'id_deposito',
    defaultOrder: { column: 'fecha_deposito', ascending: false },
    searchableColumns: ['descripcion', 'nombre_cliente', 'numero_referencia', 'nombre_banco'],
    columns: [
      { name: 'id_deposito', type: 'number', readOnly: true },
      { name: 'fecha_deposito', type: 'date' },
      { name: 'descripcion', type: 'text' },
      { name: 'tipo_pago', type: 'string' },
      { name: 'monto', type: 'number' },
      { name: 'id_perfil', type: 'number' },
      { name: 'comprobante_url', type: 'string' },
      { name: 'notas', type: 'text' },
      { name: 'nombre_cliente', type: 'string' },
      { name: 'numero_referencia', type: 'string' },
      { name: 'nombre_banco', type: 'string' },
    ],
  },
  historial_puntos: {
    name: 'historial_puntos',
    label: 'Historial de Puntos',
    primaryKey: 'id_historial',
    defaultOrder: { column: 'fecha_movimiento', ascending: false },
    searchableColumns: ['tipo_movimiento', 'descripcion'],
    columns: [
      { name: 'id_historial', type: 'number', readOnly: true },
      { name: 'id_cliente', type: 'number' },
      { name: 'id_venta', type: 'number' },
      { name: 'tipo_movimiento', type: 'string' },
      { name: 'puntos_anterior', type: 'number' },
      { name: 'puntos_movimiento', type: 'number' },
      { name: 'puntos_nuevo', type: 'number' },
      { name: 'descripcion', type: 'text' },
      { name: 'fecha_movimiento', type: 'date', readOnly: true },
      { name: 'id_cajero', type: 'number' },
    ],
  },
  lote_insumo: {
    name: 'lote_insumo',
    label: 'Lotes de Insumos',
    primaryKey: 'id_lote',
    defaultOrder: { column: 'fecha_vencimiento', ascending: true },
    searchableColumns: ['ubicacion'],
    columns: [
      { name: 'id_lote', type: 'number', readOnly: true },
      { name: 'id_insumo', type: 'number' },
      { name: 'fecha_vencimiento', type: 'date' },
      { name: 'cantidad_inicial', type: 'number' },
      { name: 'cantidad_actual', type: 'number' },
      { name: 'costo_unitario', type: 'number' },
      { name: 'ubicacion', type: 'string' },
    ],
  },
  movimiento_inventario: {
    name: 'movimiento_inventario',
    label: 'Movimientos de Inventario',
    primaryKey: 'id_movimiento',
    defaultOrder: { column: 'fecha_movimiento', ascending: false },
    searchableColumns: ['tipo_movimiento', 'descripcion'],
    columns: [
      { name: 'id_movimiento', type: 'number', readOnly: true },
      { name: 'id_insumo', type: 'number' },
      { name: 'id_lote', type: 'number' },
      { name: 'tipo_movimiento', type: 'string' },
      { name: 'cantidad', type: 'number' },
      { name: 'fecha_movimiento', type: 'date', readOnly: true },
      { name: 'id_perfil', type: 'number' },
      { name: 'id_referencia', type: 'number' },
      { name: 'descripcion', type: 'text' },
      { name: 'costo_unitario_momento', type: 'number' },
      { name: 'costo_total', type: 'number', readOnly: true },
    ],
  },
  insumo_presentacion: {
    name: 'insumo_presentacion',
    label: 'Presentaciones de Insumo',
    primaryKey: 'id_presentacion',
    defaultOrder: { column: 'descripcion_presentacion', ascending: true },
    searchableColumns: ['descripcion_presentacion', 'unidad_compra'],
    columns: [
      { name: 'id_presentacion', type: 'number', readOnly: true },
      { name: 'id_insumo', type: 'number' },
      { name: 'id_proveedor', type: 'number' },
      { name: 'descripcion_presentacion', type: 'text' },
      { name: 'unidad_compra', type: 'string' },
      { name: 'unidades_por_presentacion', type: 'number' },
      { name: 'costo_compra_unitario', type: 'number' },
      { name: 'es_principal', type: 'boolean' },
      { name: 'activo', type: 'boolean' },
    ],
  },
});

export const MAINTENANCE_ALLOWED_TABLES = Object.keys(MAINTENANCE_TABLES);

export const getMaintenanceTable = (tableName: string): MaintenanceTableConfig | undefined =>
  MAINTENANCE_TABLES[tableName];

export const getMaintenancePrimaryKey = (tableName: string): string | undefined =>
  MAINTENANCE_TABLES[tableName]?.primaryKey;
