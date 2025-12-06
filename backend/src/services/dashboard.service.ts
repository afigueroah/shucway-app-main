import { StatsData, InventoryItem } from '../types';
import supabase from '../config/database';

interface Alerta {
  id: string;
  message: string;
  module: string;
  type: 'warning' | 'info' | 'error';
  timestamp: string;
}

interface InsumoBajo {
  nombre_insumo: string;
  stock_actual: number;
  stock_minimo: number;
}

interface OrdenPendiente {
  id_orden: number;
  proveedor: string;
}

export const dashboardService = {
  // Mapa explícito table -> primary key para evitar heurísticas
  primaryKeyMap: {
    rol_usuario: 'id_rol',
    perfil_usuario: 'id_perfil',
    bitacora_seguridad: 'id_bitacora_seguridad',
    categoria_insumo: 'id_categoria',
    proveedor: 'id_proveedor',
    insumo: 'id_insumo',
    lote_insumo: 'id_lote',
    movimiento_inventario: 'id_movimiento',
    orden_compra: 'id_orden',
    detalle_orden_compra: 'id_detalle',
    recepcion_mercaderia: 'id_recepcion',
    detalle_recepcion_mercaderia: 'id_detalle',
    categoria_producto: 'id_categoria',
    producto: 'id_producto',
    producto_variante: 'id_variante',
    receta_detalle: 'id_receta',
    cliente: 'id_cliente',
    venta: 'id_venta',
    detalle_venta: 'id_detalle',
    categoria_gasto: 'id_categoria',
    gasto_operativo: 'id_gasto',
    deposito_banco: 'id_deposito',
    arqueo_caja: 'id_arqueo',
    historial_puntos: 'id_historial',
    bitacora_inventario: 'id_bitacora_inventario',
    bitacora_ventas: 'id_bitacora_venta',
    bitacora_ordenes_compra: 'id_bitacora_orden',
    bitacora_productos: 'id_bitacora_producto'
  } as Record<string, string>,
  async getStats(): Promise<StatsData> {

    // Por ahora devolver datos de ejemplo para que compile
    return {
      ventas: {
        total: 0,
        change: 0
      },
      inventario: {
        total: 0,
        change: 0
      },
      clientes: {
        total: 0,
        change: 0
      },
      ganancias: {
        total: 0,
        change: 0
      }
    };
  },

  async getVentasSemana() {
    // TODO: Convertir consulta SQL a usar Supabase API
    // Por ahora devolver datos de ejemplo
    return [];
  },

  async getAlertasRecientes(): Promise<Alerta[]> {
    const alertas: Alerta[] = [];

    try {
      // Insumos bajos en stock (notifications)
      const { data: insumos, error: errorInsumos } = await supabase
        .from('insumo')
        .select('nombre_insumo, stock_actual, stock_minimo');

      if (!errorInsumos && insumos) {
        const insumosBajos = insumos.filter((i: InsumoBajo) => {
          const stockActual = Number(i.stock_actual ?? 0);
          const stockMinimo = Number(i.stock_minimo ?? 0);
          return stockActual <= stockMinimo;
        });

        insumosBajos.forEach((i: InsumoBajo) => {
          const stockActual = Number(i.stock_actual ?? 0);
          const stockMinimo = Number(i.stock_minimo ?? 0);
          const agotado = stockActual <= 0;
          const diferencia = Math.max(stockMinimo - stockActual, 0);
          const message = agotado
            ? `Sin stock: '${i.nombre_insumo}' está agotado. Genera una nueva orden de compra.`
            : `Stock crítico: '${i.nombre_insumo}' tiene ${stockActual} unidades (mínimo ${stockMinimo}). Faltan ${diferencia} para el mínimo.`;

          alertas.push({
            id: `insumo-${i.nombre_insumo}`,
            message,
            module: 'Inventario',
            type: agotado ? 'warning' : 'warning',
            timestamp: new Date().toISOString()
          });
        });
      }

      // Órdenes de compra pendientes (notifications)
      const { data: ordenesPendientes, error: errorOrdenes } = await supabase
        .from('orden_compra')
        .select('id_orden, proveedor')
        .eq('estado', 'pendiente');

      if (!errorOrdenes && ordenesPendientes) {
        ordenesPendientes.forEach((o: OrdenPendiente) => {
          alertas.push({
            id: `orden-${o.id_orden}`,
            message: `Orden de compra pendiente: proveedor '${o.proveedor}'`,
            module: 'Ventas',
            type: 'info',
            timestamp: new Date().toISOString()
          });
        });
      }

      // Alertas de errores (por ahora, agregar algunas de ejemplo o vacías)
      // TODO: Implementar alertas de errores desde logs o bitácoras
      // Por ejemplo, conexiones fallidas, etc.

    } catch (error) {
      console.error('Error obteniendo alertas recientes:', error);
    }

    return alertas;
  },

  async getAvailableTables(): Promise<string[]> {
    // Lista de tablas disponibles para mantenimiento
    // Estas son las tablas principales del sistema que deberían estar accesibles
    return [
      'rol_usuario',
      'perfil_usuario',
      'bitacora_seguridad',
      'categoria_insumo',
      'proveedor',
      'insumo',
      'lote_insumo',
      'movimiento_inventario',
      'orden_compra',
      'detalle_orden_compra',
      'recepcion_mercaderia',
      'detalle_recepcion_mercaderia',
      'categoria_producto',
      'producto',
      'producto_variante',
      'receta_detalle',
      'cliente',
      'venta',
      'detalle_venta',
      'categoria_gasto',
      'gasto_operativo',
      'arqueo_caja',
      'historial_puntos',
      'auditoria_inventario',
      'auditoria_detalle',
      'bitacora_auditoria',
      'bitacora_inventario',
      'bitacora_ventas',
      'bitacora_ordenes_compra',
      'bitacora_productos'
    ];
  },

  async getTableColumns(tableName: string): Promise<{ column_name: string; data_type: string; is_nullable: string; ordinal_position: number }[]> {
    try {
      // En Supabase no podemos acceder a information_schema.columns
      // Usamos una consulta con LIMIT 1 para inferir las columnas desde los datos
      const { data: sampleData, error: sampleError } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);

      if (sampleError) {
        console.warn('No se pudieron obtener columnas consultando la tabla:', sampleError.message);
        return [];
      }

      if (sampleData && sampleData.length > 0) {
        // Inferir columnas desde el primer registro
        const columns = Object.keys(sampleData[0]).map((key, index) => ({
          column_name: key,
          data_type: 'text', // No podemos determinar el tipo exacto sin information_schema
          is_nullable: 'YES', // Asumimos nullable por defecto
          ordinal_position: index + 1
        }));
        return columns;
      }

      return [];
    } catch (error) {
      console.error('Error obteniendo columnas de tabla:', error);
      return [];
    }
  },

  async getTableData(tableName: string, filters: Record<string, unknown> = {}): Promise<unknown[]> {
    try {
      // Verificar que la tabla esté en la lista de tablas permitidas
      const allowedTables = await this.getAvailableTables();
      if (!allowedTables.includes(tableName)) {
        throw new Error(`Tabla '${tableName}' no está permitida para acceso directo`);
      }

      let query = supabase.from(tableName).select('*');

      // Aplicar filtros si existen
      if (filters && Object.keys(filters).length > 0) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            query = query.eq(key, value);
          }
        });
      }

      // Limitar resultados para evitar sobrecarga (máximo 1000 registros)
      query = query.limit(1000);

      const { data, error } = await query;

      if (error) {
        console.error(`Error consultando tabla ${tableName}:`, error);
        throw new Error(`Error al acceder a la tabla ${tableName}: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error(`Error en getTableData para tabla ${tableName}:`, error);
      throw error;
    }
  },

  async createRecord(tableName: string, values: Record<string, unknown>) {
    try {
      if (tableName === 'categoria_insumo' && !values.id_categoria) {
        // Obtener el máximo id_categoria usando rpc o consulta directa
        const { data: maxData, error: maxError } = await supabase
          .from('categoria_insumo')
          .select('id_categoria')
          .order('id_categoria', { ascending: false })
          .limit(1);

        if (maxError) throw maxError;
        const maxId = maxData && maxData.length > 0 ? maxData[0].id_categoria : 0;
        values.id_categoria = maxId + 1;
      }
      const { data, error } = await supabase.from(tableName).insert(values).select().single();
      if (error) {
        console.error('Error creando registro en', tableName, error.message);
        throw error;
      }
      return data;
    } catch (error) {
      console.error('Error en createRecord:', error);
      throw error;
    }
  },

  async updateRecord(tableName: string, id: string, values: Record<string, unknown>) {
    // Usar primaryKeyMap si existe, sino fallback a 'id'
    const pk = (this.primaryKeyMap && this.primaryKeyMap[tableName]) || 'id';

    try {
      const { data, error } = await supabase.from(tableName).update(values).eq(pk, id).select().single();
      if (error) {
        console.error('Error actualizando registro en', tableName, error.message);
        throw error;
      }
      return data;
    } catch (error: unknown) {
      console.error('Error en updateRecord:', error);
      // Fallback para categoria_producto, producto, producto_variante: si falla constraint en 'estado', intentar con 'estado = 'desactivado''
      const err = error as { code?: string; message?: string };
      if ((tableName === 'categoria_producto' || tableName === 'producto' || tableName === 'producto_variante') && err?.code === '23514' && err?.message?.includes('estado_check')) {
        console.log(`Intentando fallback para ${tableName}: usar estado = desactivado`);
        try {
          const { data, error: fallbackError } = await supabase.from(tableName).update({ estado: 'desactivado' }).eq(pk, id).select().single();
          if (fallbackError) {
            console.error('Fallback también falló:', fallbackError);
            throw fallbackError;
          }
          return data;
        } catch (fallbackErr) {
          console.error('Error en fallback updateRecord:', fallbackErr);
          throw fallbackErr;
        }
      }
      throw error;
    }
  },

  async deleteRecord(tableName: string, id: string) {
    try {
      // Usar primaryKeyMap si existe, sino fallback a 'id'
      const pk = (this.primaryKeyMap && this.primaryKeyMap[tableName]) || 'id';

      // Manejo especial para insumo: eliminar dependencias primero
      if (tableName === 'insumo') {
        // Primero obtener los lotes relacionados para eliminar sus dependencias
        const { data: lotesRelacionados, error: lotesQueryError } = await supabase
          .from('lote_insumo')
          .select('id_lote')
          .eq('id_insumo', id);

        if (lotesQueryError) {
          console.error('Error obteniendo lotes para insumo', id, lotesQueryError.message);
          throw lotesQueryError;
        }

        const loteIds = lotesRelacionados ? lotesRelacionados.map(l => l.id_lote) : [];

        // 1. Eliminar movimiento_inventario que referencian directamente el insumo (primero)
        const { error: movimientosInsumoError } = await supabase
          .from('movimiento_inventario')
          .delete()
          .eq('id_insumo', id);

        if (movimientosInsumoError) {
          console.error('Error eliminando movimientos para insumo', id, movimientosInsumoError.message);
          throw movimientosInsumoError;
        }

        // 2. Eliminar movimiento_inventario que referencian estos lotes
        if (loteIds.length > 0) {
          const { error: movimientosLotesError } = await supabase
            .from('movimiento_inventario')
            .delete()
            .in('id_lote', loteIds);

          if (movimientosLotesError) {
            console.error('Error eliminando movimientos para lotes', loteIds, movimientosLotesError.message);
            throw movimientosLotesError;
          }
        }

        // 3. Eliminar detalle_recepcion_mercaderia que referencia estos lotes
        if (loteIds.length > 0) {
          const { error: detalleRecepcionError } = await supabase
            .from('detalle_recepcion_mercaderia')
            .delete()
            .in('id_lote', loteIds);

          if (detalleRecepcionError) {
            console.error('Error eliminando detalle_recepcion_mercaderia para lotes', loteIds, detalleRecepcionError.message);
            throw detalleRecepcionError;
          }
        }

        // 4. Eliminar detalle_orden_compra que referencia el insumo
        const { error: detalleOrdenError } = await supabase
          .from('detalle_orden_compra')
          .delete()
          .eq('id_insumo', id);

        if (detalleOrdenError) {
          console.error('Error eliminando detalle_orden_compra para insumo', id, detalleOrdenError.message);
          throw detalleOrdenError;
        }

        // 5. Eliminar presentaciones relacionadas (antes de lotes para evitar restricciones)
        const { error: presentacionesError } = await supabase
          .from('insumo_presentacion')
          .delete()
          .eq('id_insumo', id);

        if (presentacionesError) {
          console.error('Error eliminando presentaciones para insumo', id, presentacionesError.message);
          throw presentacionesError;
        }

        // 6. Eliminar lotes relacionados (usar los lotes específicos obtenidos)
        if (loteIds.length > 0) {
          const { error: lotesError } = await supabase
            .from('lote_insumo')
            .delete()
            .in('id_lote', loteIds);

          if (lotesError) {
            console.error('Error eliminando lotes específicos', loteIds, lotesError.message);
            throw lotesError;
          }
        }

        // 7. Eliminar otros registros relacionados que referencian insumo
        const { error: recetaDetalleError } = await supabase
          .from('receta_detalle')
          .delete()
          .eq('id_insumo', id);

        if (recetaDetalleError) {
          console.error('Error eliminando receta_detalle para insumo', id, recetaDetalleError.message);
          throw recetaDetalleError;
        }

        const { error: bitacoraError } = await supabase
          .from('bitacora_inventario')
          .delete()
          .eq('id_insumo', id);

        if (bitacoraError) {
          console.error('Error eliminando bitacora_inventario para insumo', id, bitacoraError.message);
          throw bitacoraError;
        }
      }

      const { error } = await supabase.from(tableName).delete().eq(pk, id);
      if (error) {
        console.error('Error eliminando registro en', tableName, error.message);
        throw error;
      }
      return true;
    } catch (error) {
      console.error('Error en deleteRecord:', error);
      throw error;
    }
  },

  async getInventoryData(): Promise<{ 
    perpetual: InventoryItem[]; 
    operational: InventoryItem[]; 
    totalPerpetualStock: number; 
    totalOperationalStock: number; 
    totalPerpetualItems: number; 
    totalOperationalItems: number; 
  }> {
    try {
      // Obtener stock actual por insumo desde lotes
      const { data: lotesData, error: lotesError } = await supabase
        .from('lote_insumo')
        .select('id_insumo, cantidad_actual');

      if (lotesError) {
        console.error('Error leyendo lotes:', lotesError);
        throw lotesError;
      }

      // Agrupar stock por id_insumo
      const stockMap = new Map<number, number>();
      if (Array.isArray(lotesData)) {
        lotesData.forEach((lote: { id_insumo: number; cantidad_actual: string | number }) => {
          const id = lote.id_insumo;
          const qty = Number(lote.cantidad_actual) || 0;
          stockMap.set(id, (stockMap.get(id) || 0) + qty);
        });
      }

      // Obtener todos los insumos y su categoría
      const { data: insumos, error } = await supabase
        .from('insumo')
        .select(`
          id_insumo,
          nombre_insumo,
          id_categoria,
          activo,
          unidad_base,
          stock_minimo,
          stock_maximo,
          categoria_insumo(id_categoria, nombre, tipo_categoria)
        `)
        .order('nombre_insumo', { ascending: true });


      if (error) {
        console.error('Error leyendo insumo:', error);
        throw error;
      }

      if (!Array.isArray(insumos) || insumos.length === 0) {
        return {
          perpetual: [],
          operational: [],
          totalPerpetualStock: 0,
          totalOperationalStock: 0,
          totalPerpetualItems: 0,
          totalOperationalItems: 0
        };
      }

      // Mapear todos los insumos, aunque no tengan lotes
      const mappedAll = insumos.map((row: Record<string, unknown>) => {
        // Obtener stock desde el map
        const cantidad_actual = stockMap.get(row.id_insumo as number) || 0;
        const stockMinimo = Number(row.stock_minimo) || 0;
        let estado = 'Normal';
        if (cantidad_actual === 0) {
          estado = 'Sin Stock';
        } else if (cantidad_actual <= stockMinimo) {
          estado = 'Stock Bajo';
        } else if (cantidad_actual > stockMinimo * 2) {
          estado = 'OK';
        }
        return {
          id: row.id_insumo as number,
          name: row.nombre_insumo as string,
          qty: cantidad_actual.toString(),
          cantidad_actual,
          note: estado,
          tipo_insumo: (row.categoria_insumo as { tipo_categoria: string })?.tipo_categoria || 'perpetuo',
          categoriaNombre: (row.categoria_insumo as { nombre: string })?.nombre || 'Sin Categoría'
        };
      });

      const perpetualItems = mappedAll.filter(m => m.tipo_insumo === 'perpetuo');
      const operationalItems = mappedAll.filter(m => m.tipo_insumo === 'operativo');

      // Calcular totales
      const totalPerpetualStock = perpetualItems.reduce((sum, item) => sum + (parseFloat(item.qty || '0') || 0), 0);
      const totalOperationalStock = operationalItems.reduce((sum, item) => sum + (parseFloat(item.qty || '0') || 0), 0);
      const totalPerpetualItems = perpetualItems.length;
      const totalOperationalItems = operationalItems.length;

      return { 
        perpetual: perpetualItems, 
        operational: operationalItems, 
        totalPerpetualStock, 
        totalOperationalStock, 
        totalPerpetualItems, 
        totalOperationalItems 
      };
    } catch (error) {
      console.error('Error cargando datos de inventario:', error);
      throw error;
    }
  }
};
