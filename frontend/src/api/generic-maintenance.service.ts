import { supabase } from './supabaseClient';

export interface TableMetadata {
  name: string;
  displayName: string;
  fields: FieldMetadata[];
  primaryKey: string;
  sortableFields: string[];
  filterableFields: string[];
}

export interface FieldMetadata {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'select' | 'textarea' | 'email' | 'password';
  label: string;
  displayName?: string;
  required?: boolean;
  readonly?: boolean;
  hidden?: boolean;
  options?: { value: string | number; label: string }[];
  maxLength?: number;
  minLength?: number;
  pattern?: string;
}

export interface QueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  filters?: Record<string, string | number | boolean>;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface QueryResult<T = Record<string, unknown>> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export class GenericMaintenanceService {
  static async getTableMetadata(tableName: string): Promise<TableMetadata> {
    // Esta es una implementación básica. En un caso real, esto vendría del backend
    // o de una configuración específica por tabla
    const mockMetadata: Record<string, TableMetadata> = {
      // Aquí se pueden agregar metadatos para diferentes tablas según sea necesario
      default: {
        name: tableName,
        displayName: tableName.charAt(0).toUpperCase() + tableName.slice(1),
        fields: [],
        primaryKey: 'id',
        sortableFields: ['id'],
        filterableFields: ['id'],
      },
    };

    const metadata = mockMetadata[tableName] || mockMetadata.default;
    return { ...metadata, name: tableName };
  }

  static async getRecords(tableName: string, params: QueryParams = {}): Promise<QueryResult> {
    const { page = 1, pageSize = 10, search, filters, sortBy, sortOrder = 'asc' } = params;

    let query = supabase.from(tableName).select('*', { count: 'exact' });

    // Aplicar filtros
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          query = query.eq(key, value);
        }
      });
    }

    // Aplicar búsqueda básica (si hay campos de texto)
    if (search) {
      // Esto es simplificado - en un caso real necesitarías saber qué campos buscar
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Aplicar ordenamiento
    if (sortBy) {
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });
    }

    // Aplicar paginación
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    return {
      data: data || [],
      total: count || 0,
      page,
      pageSize,
    };
  }

  static async createRecord(tableName: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const { data: result, error } = await supabase
      .from(tableName)
      .insert(data)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return result;
  }

  static async updateRecord(tableName: string, id: string | number, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const { data: result, error } = await supabase
      .from(tableName)
      .update(data)
      .eq('id', id) // Asumiendo que la PK es 'id'
      .select()
      .single();

    if (error) {
      throw error;
    }

    return result;
  }

  static async deleteRecord(tableName: string, id: string | number, primaryKey?: string): Promise<void> {
    const pk = primaryKey || 'id';

    // Manejo especial para insumo: eliminar dependencias primero
    if (tableName === 'insumo') {
      // Obtener lotes relacionados para eliminar movimientos por lote primero
      const { data: lotesRelacionados, error: lotesQueryError } = await supabase
        .from('lote_insumo')
        .select('id_lote')
        .eq('id_insumo', id);

      if (lotesQueryError) {
        throw new Error(`Error al obtener lotes para insumo ${id}: ${lotesQueryError.message}`);
      }

      const loteIds = lotesRelacionados ? lotesRelacionados.map(l => l.id_lote) : [];

      // Eliminar movimientos de inventario que referencian estos lotes
      if (loteIds.length > 0) {
        const { error: movimientosLoteError } = await supabase
          .from('movimiento_inventario')
          .delete()
          .in('id_lote', loteIds);

        if (movimientosLoteError) {
          throw new Error(`Error al eliminar movimientos por lote para insumo ${id}: ${movimientosLoteError.message}`);
        }
      }

      // Eliminar movimientos de inventario que referencian directamente el insumo
      const { error: movimientosInsumoError } = await supabase
        .from('movimiento_inventario')
        .delete()
        .eq('id_insumo', id);

      if (movimientosInsumoError) {
        throw new Error(`Error al eliminar movimientos por insumo para insumo ${id}: ${movimientosInsumoError.message}`);
      }

      // Eliminar detalle_recepcion_mercaderia que referencia estos lotes
      if (loteIds.length > 0) {
        const { error: detalleRecepcionError } = await supabase
          .from('detalle_recepcion_mercaderia')
          .delete()
          .in('id_lote', loteIds);

        if (detalleRecepcionError) {
          throw new Error(`Error al eliminar detalle_recepcion_mercaderia para lotes ${loteIds}: ${detalleRecepcionError.message}`);
        }
      }

      // Eliminar detalle_orden_compra que referencia el insumo
      const { error: detalleOrdenError } = await supabase
        .from('detalle_orden_compra')
        .delete()
        .eq('id_insumo', id);

      if (detalleOrdenError) {
        throw new Error(`Error al eliminar detalle_orden_compra para insumo ${id}: ${detalleOrdenError.message}`);
      }

      // Eliminar lotes relacionados (usar los lotes específicos obtenidos)
      if (loteIds.length > 0) {
        const { error: lotesError } = await supabase
          .from('lote_insumo')
          .delete()
          .in('id_lote', loteIds);

        if (lotesError) {
          throw new Error(`Error al eliminar lotes específicos ${loteIds}: ${lotesError.message}`);
        }
      }

      // Eliminar presentaciones relacionadas
      const { error: presentacionesError } = await supabase
        .from('insumo_presentacion')
        .delete()
        .eq('id_insumo', id);

      if (presentacionesError) {
        throw new Error(`Error al eliminar presentaciones para insumo ${id}: ${presentacionesError.message}`);
      }

      // Eliminar otros registros relacionados
      const { error: recetaDetalleError } = await supabase
        .from('receta_detalle')
        .delete()
        .eq('id_insumo', id);

      if (recetaDetalleError) {
        throw new Error(`Error al eliminar receta_detalle para insumo ${id}: ${recetaDetalleError.message}`);
      }

      const { error: bitacoraError } = await supabase
        .from('bitacora_inventario')
        .delete()
        .eq('id_insumo', id);

      if (bitacoraError) {
        throw new Error(`Error al eliminar bitacora_inventario para insumo ${id}: ${bitacoraError.message}`);
      }
    }

    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq(pk, id);

    if (error) {
      throw error;
    }
  }
}

export function formatFieldValue(value: unknown, type: string): string {
  if (value === null || value === undefined) {
    return '-';
  }

  switch (type) {
    case 'date':
      return new Date(value as string | number | Date).toLocaleDateString();
    case 'boolean':
      return value ? 'Sí' : 'No';
    case 'number':
      return Number(value).toLocaleString();
    default:
      return String(value);
  }
}