import { supabase } from '../config/database';
import { OrdenCompra, DetalleOrdenCompra } from '../types/orden_compra.types';

export async function createOrdenCompra(data: OrdenCompra) {
  const { data: orden, error } = await supabase
    .from('orden_compra')
    .insert([data])
    .select();
  if (error) throw error;
  return orden?.[0];
}

export async function getOrdenCompraById(id: number) {
  const { data, error } = await supabase
    .from('orden_compra')
    .select(`
      *,
      proveedor:proveedor(*),
      detalle_orden_compra(
        *,
        insumo:insumo(nombre_insumo),
        insumo_presentacion:insumo_presentacion(descripcion_presentacion)
      )
    `)
    .eq('id_orden', id)
    .single();
  if (error) throw error;
  return data;
}

export async function updateOrdenCompra(id: number, data: Partial<OrdenCompra>) {
  // VALIDACIÓN ESTRICTA: Si se intenta cambiar a 'recibida', verificar que haya detalles de recepción
  if (data.estado === 'recibida') {
    console.log(`[Backend] Validando cambio de estado a 'recibida' para OC #${id}`);
    
    // Verificar si existe una recepción con detalles para esta OC
    const { data: recepcionData, error: recepcionError } = await supabase
      .from('recepcion_mercaderia')
      .select('id_recepcion')
      .eq('id_orden', id)
      .maybeSingle();

    if (recepcionError) {
      console.error('[Backend] Error verificando recepción:', recepcionError.message);
      throw new Error(`Error al validar recepción: ${recepcionError.message}`);
    }

    if (!recepcionData) {
      const errorMsg = `❌ VALIDACIÓN FALLIDA: No se puede cambiar OC #${id} a 'recibida' sin crear una recepción de mercadería primero.`;
      console.error('[Backend]', errorMsg);
      throw new Error(errorMsg);
    }

    // Verificar que la recepción tenga detalles
    const { count: totalDetalles, error: countError } = await supabase
      .from('detalle_recepcion_mercaderia')
      .select('*', { count: 'exact', head: true })
      .eq('id_recepcion', recepcionData.id_recepcion);

    if (countError) {
      console.error('[Backend] Error contando detalles de recepción:', countError.message);
      throw new Error(`Error al validar detalles de recepción: ${countError.message}`);
    }

    if (!totalDetalles || totalDetalles === 0) {
      const errorMsg = `❌ VALIDACIÓN FALLIDA: No se puede cambiar OC #${id} a 'recibida' sin detalles de recepción. La recepción #${recepcionData.id_recepcion} existe pero no tiene productos recibidos. Agregue al menos un detalle para generar movimientos de inventario.`;
      console.error('[Backend]', errorMsg);
      throw new Error(errorMsg);
    }

    console.log(`[Backend] ✅ Validación OK: OC #${id} tiene ${totalDetalles} detalles de recepción. Procediendo con cambio de estado.`);
  }

  const { data: orden, error } = await supabase
    .from('orden_compra')
    .update(data)
    .eq('id_orden', id)
    .select()
    .single();
  if (error) throw error;
  return orden;
}

export async function deleteOrdenCompra(id: number) {
  const { error } = await supabase
    .from('orden_compra')
    .delete()
    .eq('id_orden', id);
  if (error) throw error;
  return true;
}

export async function createDetalleOrdenCompra(data: DetalleOrdenCompra) {
  console.log('[Backend] createDetalleOrdenCompra - datos recibidos:', data);
  
  // Usar upsert para actualizar si ya existe (basado en id_orden + id_presentacion)
  const { data: detalle, error } = await supabase
    .from('detalle_orden_compra')
    .upsert([data], { 
      onConflict: 'id_orden,id_presentacion',
      ignoreDuplicates: false 
    })
    .select();
  
  if (error) {
    console.error('[Backend] Error al crear/actualizar detalle de orden de compra:', error);
    throw error;
  }
  
  console.log('[Backend] Detalle creado/actualizado:', detalle?.[0]);
  return detalle?.[0];
}
