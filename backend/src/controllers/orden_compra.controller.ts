import { Request, Response } from 'express';
import supabase from '../config/database';
import { inventarioService } from '../services/inventario.service';

type RecepcionRow = { id_recepcion: number };

const cleanRecepcionesForOrder = async (orderId: number): Promise<void> => {
  const { data: recepciones, error: recepcionesError } = await supabase
    .from('recepcion_mercaderia')
    .select('id_recepcion')
    .eq('id_orden', orderId);

  if (recepcionesError) {
    throw new Error(`Error al consultar recepciones para la orden ${orderId}: ${recepcionesError.message}`);
  }

  const recepcionIds = (recepciones ?? [])
    .map((row) => Number((row as RecepcionRow).id_recepcion))
    .filter((id) => Number.isFinite(id) && id > 0);

  if (recepcionIds.length === 0) {
    return;
  }

  // Intentar eliminar cada recepción usando el servicio (para respetar la lógica existente)
  for (const recepcionId of recepcionIds) {
    try {
      await inventarioService.deleteRecepcionMercaderia(recepcionId);
      console.log(`[Backend] Recepción ${recepcionId} eliminada durante limpieza de OC ${orderId}.`);
    } catch (error) {
      console.warn(`[Backend] No se pudo eliminar recepción ${recepcionId} con servicio. Intentando limpieza directa.`, error);
    }
  }

  // Limpieza directa por si aún quedan registros asociados (idempotente)
  const { error: movimientosError } = await supabase
    .from('movimiento_inventario')
    .delete()
    .in('id_referencia', recepcionIds);

  if (movimientosError) {
    throw new Error(`No se pudieron eliminar movimientos residuales: ${movimientosError.message}`);
  }

  const orFilters = recepcionIds
    .map((id) => `descripcion.ilike.%Recepcion #${id}%`)
    .join(',');

  if (orFilters.length > 0) {
    const { error: bitacoraError } = await supabase
      .from('bitacora_inventario')
      .delete()
      .or(orFilters);

    if (bitacoraError) {
      console.warn(`Advertencia limpiando bitácora de inventario para recepciones ${recepcionIds.join(', ')}: ${bitacoraError.message}`);
    }
  }

  const { error: detallesError } = await supabase
    .from('detalle_recepcion_mercaderia')
    .delete()
    .in('id_recepcion', recepcionIds);

  if (detallesError) {
    throw new Error(`No se pudieron eliminar detalles de recepción residuales: ${detallesError.message}`);
  }

  const { error: recepcionesDeleteError } = await supabase
    .from('recepcion_mercaderia')
    .delete()
    .in('id_recepcion', recepcionIds);

  if (recepcionesDeleteError) {
    throw new Error(`No se pudieron eliminar las recepciones asociadas a la orden: ${recepcionesDeleteError.message}`);
  }
};

export const getOrdenesCompra = async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('orden_compra')
      .select(`
        *,
        proveedor:proveedor(nombre_empresa),
        perfil_usuario:creado_por(primer_nombre, primer_apellido)
      `)
      .order('fecha_orden', { ascending: false });

    if (error) {
      console.error('Error al consultar ordenes de compra:', error);
      return res.status(500).json({ message: 'Error interno del servidor' });
    }

    return res.json(data);
  } catch (error) {
    console.error('Error inesperado:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const getOrdenCompraById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
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

    if (error) {
      console.error('Error al consultar orden de compra:', error);
      return res.status(500).json({ message: 'Error interno del servidor' });
    }

    if (!data) {
      return res.status(404).json({ message: 'Orden de compra no encontrada' });
    }

    return res.json(data);
  } catch (error) {
    console.error('Error inesperado:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const updateOrdenCompra = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const { data, error } = await supabase
      .from('orden_compra')
      .update(updateData)
      .eq('id_orden', id)
      .select()
      .single();

    if (error) {
      console.error('Error al actualizar orden de compra:', error);
      return res.status(500).json({ message: 'Error interno del servidor' });
    }

    return res.json(data);
  } catch (error) {
    console.error('Error inesperado:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const deleteOrdenCompra = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orderId = Number(id);

    if (!Number.isFinite(orderId) || orderId <= 0) {
      return res.status(400).json({ message: 'Identificador de orden no válido.' });
    }

    // Limpiar recepciones y sus dependencias antes de eliminar la orden
    try {
      await cleanRecepcionesForOrder(orderId);
    } catch (error) {
      console.error('Error al limpiar recepciones asociadas a la orden:', error);
      return res.status(500).json({ message: 'No se pudieron eliminar las recepciones asociadas a la orden.' });
    }

    // Segundo: comprobar si existen detalles de recepción que referencien los detalles de la orden
    const { data: detallesOC, error: detallesOCError } = await supabase
      .from('detalle_orden_compra')
      .select('id_detalle')
      .eq('id_orden', orderId);

    if (detallesOCError) {
      console.error('Error al consultar detalles de orden:', detallesOCError);
      return res.status(500).json({ message: 'Error interno del servidor' });
    }

    const detalleIds = (detallesOC || []).map((d: unknown) => {
      const row = d as Record<string, unknown>;
      return Number(row.id_detalle as number | string);
    });
    if (detalleIds.length > 0) {
      const { data: detallesRecepcion, error: detallesRecepcionError } = await supabase
        .from('detalle_recepcion_mercaderia')
        .select('id_detalle')
        .in('id_detalle_orden', detalleIds);

      if (detallesRecepcionError) {
        console.error('Error al verificar referencias en detalle_recepcion_mercaderia:', detallesRecepcionError);
        return res.status(500).json({ message: 'Error interno del servidor' });
      }

      if (detallesRecepcion && detallesRecepcion.length > 0) {
        const { error: deleteDetallesRecepcionError } = await supabase
          .from('detalle_recepcion_mercaderia')
          .delete()
          .in('id_detalle_orden', detalleIds);

        if (deleteDetallesRecepcionError) {
          console.error('Error al eliminar detalles de recepción residuales:', deleteDetallesRecepcionError);
          return res.status(500).json({ message: 'No se pudieron limpiar los detalles de recepción asociados.' });
        }
      }
    }

    // Si pasaron las verificaciones, eliminar primero los detalles de la orden y luego la orden
    const { error: delDetallesError } = await supabase
      .from('detalle_orden_compra')
      .delete()
      .eq('id_orden', orderId);

    if (delDetallesError) {
      console.error('Error al eliminar detalles de orden de compra:', delDetallesError);
      return res.status(500).json({ message: 'Error interno eliminando detalles' });
    }

    // Garantizar que no queden recepciones residuales antes de eliminar la orden
    try {
      await cleanRecepcionesForOrder(orderId);
    } catch (error) {
      console.error('Error al limpiar recepciones residuales antes de eliminar la orden:', error);
      return res.status(500).json({ message: 'No se pudieron eliminar las recepciones asociadas a la orden.' });
    }

    const { error: delOrdenError } = await supabase
      .from('orden_compra')
      .delete()
      .eq('id_orden', orderId);

    if (delOrdenError) {
      console.error('Error al eliminar orden de compra:', delOrdenError);
      return res.status(500).json({ message: 'Error interno al eliminar la orden' });
    }

    return res.status(200).json({ message: 'Orden de compra eliminada correctamente' });
  } catch (error) {
    console.error('Error inesperado:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const getDetallesOrdenCompra = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('detalle_orden_compra')
      .select(`
  *,
  insumo:insumo(nombre_insumo, unidad_base),
  insumo_presentacion:insumo_presentacion(descripcion_presentacion, unidades_por_presentacion, unidad_compra)
      `)
      .eq('id_orden', id)
      .order('id_detalle', { ascending: true });

    if (error) {
      console.error('Error al consultar detalles de orden de compra:', error);
      return res.status(500).json({ message: 'Error interno del servidor' });
    }

    return res.json(data);
  } catch (error) {
    console.error('Error inesperado:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
};