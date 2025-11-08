import { supabase } from '../config/database';
import {
  Insumo,
  CatalogoInsumo,
  CategoriaInsumo,
  LoteInsumo,
  MovimientoInventario,
  CreateInsumoDTO,
  UpdateInsumoDTO,
  CreateLoteDTO,
  CreatePresentacionDTO,
  CreateMovimientoDTO,
  StockActual,
} from '../types/inventario.types';

// Interface for the raw query result from Supabase with joins
interface CatalogoQueryResult {
  id_insumo: number;
  nombre_insumo: string;
  unidad_base: string;
  stock_minimo: number;
  stock_maximo: number;
  costo_promedio: number;
  activo: boolean;
  fecha_registro: Date;
  id_categoria: number;
  id_proveedor_principal?: number;
  insumo_url?: string;
  categoria_insumo: Array<{
    tipo_categoria: 'perpetuo' | 'operativo';
    nombre: string;
  }>;
  lote_insumo: Array<{
    cantidad_actual: number;
    ubicacion?: string;
    fecha_vencimiento?: string;
  }>;
  insumo_presentacion?: Array<{
    id_proveedor?: number;
    descripcion_presentacion?: string;
    es_principal?: boolean;
    activo?: boolean;
  }>;
}

// Interface for presentaciones with related data
interface PresentacionCompleta {
  insumo: {
    id_insumo: number;
    nombre_insumo: string;
    unidad_base: string;
    costo_promedio: number | null;
    stock_minimo: number;
    stock_maximo: number;
    stock_actual: number;
    activo: boolean;
  };
  presentacion: {
    id_presentacion: number;
    descripcion_presentacion: string;
    unidad_compra: string;
    unidades_por_presentacion: number;
    costo_compra_unitario: number;
    es_principal: boolean;
    activo: boolean;
  };
  proveedor: {
    id_proveedor: number;
    nombre_proveedor: string;
  } | null;
  lotes_disponibles: LoteInsumo[];
}

type MovimientoAplicacionResumen = {
  movimientosAplicados: boolean;
  movimientosGenerados: number;
  cantidadBaseTotal: number;
  lotesActualizados: number;
  insumosActualizados: number;
  seOmitioPorDuplicado: boolean;
  mensajes: string[];
};

type RecepcionSincronizacionResumen = {
  movimientos: MovimientoAplicacionResumen;
  ocCerrada: boolean;
  ocEstadoFinal: string;
  totalDetallesOrden: number | null;
  totalDetallesRecepcion: number | null;
  detallesPendientes: number;
};

// ================================================================
// 📦 SERVICIO DE INVENTARIO
// ================================================================

export class InventarioService {
  // ================== HELPERS ==================

  /**
   * Actualiza el id_proveedor_principal del insumo basado en sus presentaciones activas
   */
  private async updateProveedorPrincipal(idInsumo: number): Promise<void> {
    try {
      // Obtener presentaciones activas del insumo
      const { data: presentaciones, error } = await supabase
        .from('insumo_presentacion')
        .select('id_proveedor')
        .eq('id_insumo', idInsumo)
        .eq('activo', true)
        .order('es_principal', { ascending: false }); // Primero las principales

      if (error) {
        console.warn(`Error al obtener presentaciones para actualizar proveedor principal: ${error.message}`);
        return;
      }

      let nuevoProveedorPrincipal = null;
      if (presentaciones && presentaciones.length > 0) {
        // Usar el proveedor de la primera presentación (ya ordenada por es_principal)
        nuevoProveedorPrincipal = presentaciones[0].id_proveedor;
      }

      // Actualizar el insumo
      const { error: updateError } = await supabase
        .from('insumo')
        .update({ id_proveedor_principal: nuevoProveedorPrincipal })
        .eq('id_insumo', idInsumo);

      if (updateError) {
        console.warn(`Error al actualizar proveedor principal del insumo ${idInsumo}: ${updateError.message}`);
      } else {
        console.log(`Proveedor principal actualizado para insumo ${idInsumo}: ${nuevoProveedorPrincipal}`);
      }
    } catch (error) {
      console.error(`Error en updateProveedorPrincipal para insumo ${idInsumo}:`, error);
    }
  }

  /**
   * Genera un resumen visible en logs sobre la sincronización entre la OC, la recepción y los movimientos generados.
   */
  private async registrarResumenRecepcion(idOrden: number, idRecepcion: number): Promise<void> {
    try {
      const [
        detallesOrdenResp,
        detallesRecepcionResp,
        movimientosResp,
        ordenResp
      ] = await Promise.all([
        supabase
          .from('detalle_orden_compra')
          .select('id_detalle, cantidad, id_presentacion')
          .eq('id_orden', idOrden),
        supabase
          .from('detalle_recepcion_mercaderia')
          .select('id_detalle, cantidad_aceptada, id_lote, id_presentacion')
          .eq('id_recepcion', idRecepcion),
        supabase
          .from('movimiento_inventario')
          .select('id_movimiento, id_insumo, cantidad, tipo_movimiento, descripcion')
          .eq('id_referencia', idRecepcion)
          .eq('tipo_movimiento', 'entrada_compra'),
        supabase
          .from('orden_compra')
          .select('estado, fecha_aprobacion')
          .eq('id_orden', idOrden)
          .single()
      ]);

      if (detallesOrdenResp.error) {
        console.warn(`[Backend] No se pudo obtener el detalle de la OC ${idOrden} para el resumen:`, detallesOrdenResp.error.message);
      }
      if (detallesRecepcionResp.error) {
        console.warn(`[Backend] No se pudo obtener el detalle de la recepcion ${idRecepcion} para el resumen:`, detallesRecepcionResp.error.message);
      }
      if (movimientosResp.error) {
        console.warn(`[Backend] No se pudo obtener los movimientos de inventario para la recepcion ${idRecepcion}:`, movimientosResp.error.message);
      }
      if (ordenResp.error) {
        console.warn(`[Backend] No se pudo obtener la orden de compra ${idOrden} para el resumen:`, ordenResp.error.message);
      }

      const formatCantidad = (value: number) => (Number.isFinite(value) ? value.toFixed(2) : '0.00');

      const detallesOrden = detallesOrdenResp.data || [];
      const detallesRecepcion = detallesRecepcionResp.data || [];
      const movimientos = movimientosResp.data || [];

      const totalDetallesOrden = detallesOrden.length;
      const totalDetallesRecepcion = detallesRecepcion.length;

      const unidadesOrden = detallesOrden.reduce((acc, det) => acc + Number(det.cantidad ?? 0), 0);
      const unidadesRecepcion = detallesRecepcion.reduce((acc, det) => acc + Number(det.cantidad_aceptada ?? 0), 0);
      const movimientosCantidad = movimientos.reduce((acc, mov) => acc + Number(mov.cantidad ?? 0), 0);
      const lotesAsignados = detallesRecepcion.filter(det => det.id_lote !== null && det.id_lote !== undefined).length;
      const presentacionesPendientes = detallesOrden.filter(det => det.id_presentacion === null).length;

      const estadoOC = ordenResp.data?.estado ?? 'desconocido';
      const fechaAprobacion = ordenResp.data?.fecha_aprobacion ?? null;

      const bitacoraResp = await supabase
        .from('bitacora_inventario')
        .select('id_bitacora_inventario, fecha_accion, descripcion')
        .ilike('descripcion', `%Recepcion #${idRecepcion}%`)
        .order('fecha_accion', { ascending: false })
        .limit(3);

      if (bitacoraResp.error) {
        console.warn(`[Backend] No se pudo consultar la bitacora de inventario para la recepcion ${idRecepcion}:`, bitacoraResp.error.message);
      }

      const totalBitacora = bitacoraResp.data?.length ?? 0;
      const ultimaBitacora = bitacoraResp.data && bitacoraResp.data.length > 0 ? bitacoraResp.data[0] : null;

      console.log(`[Backend][Recepcion ${idRecepcion}] OC #${idOrden} estado: ${estadoOC}${fechaAprobacion ? `, fecha_aprobacion: ${fechaAprobacion}` : ''}.`);
      console.log(`[Backend][Recepcion ${idRecepcion}] Detalles OC: ${totalDetallesOrden} (${formatCantidad(unidadesOrden)} uds). Detalles recepcionados: ${totalDetallesRecepcion} (${formatCantidad(unidadesRecepcion)} uds, ${lotesAsignados} lotes asignados).`);
      console.log(`[Backend][Recepcion ${idRecepcion}] Movimientos entrada_compra generados: ${movimientos.length} (${formatCantidad(movimientosCantidad)} uds). Bitacora vinculada: ${totalBitacora} registros${ultimaBitacora ? `, ultimo: ${ultimaBitacora.descripcion}` : ''}.`);

      if (totalDetallesOrden !== totalDetallesRecepcion) {
        console.warn(`[Backend][Recepcion ${idRecepcion}] Advertencia: faltan sincronizar ${Math.max(totalDetallesOrden - totalDetallesRecepcion, 0)} detalles de la orden. Presentaciones sin asignar en la OC: ${presentacionesPendientes}.`);
      }
    } catch (error) {
      console.warn(`[Backend] No se pudo generar el resumen para la recepcion ${idRecepcion}:`, error);
    }
  }

  private async aplicarMovimientosRecepcion(idOrden: number, idRecepcion: number): Promise<MovimientoAplicacionResumen> {
    const resumen: MovimientoAplicacionResumen = {
      movimientosAplicados: false,
      movimientosGenerados: 0,
      cantidadBaseTotal: 0,
      lotesActualizados: 0,
      insumosActualizados: 0,
      seOmitioPorDuplicado: false,
      mensajes: [],
    };

    try {
      console.log(`[Backend] INICIO aplicarMovimientosRecepcion para OC ${idOrden}, Recepción ${idRecepcion}`);

      const formatNumero = (value: number) => (Number.isFinite(value) ? value.toFixed(2) : '0.00');

      const { data: existingMovimientos, error: movimientosError } = await supabase
        .from('movimiento_inventario')
        .select('id_movimiento')
        .eq('id_referencia', idRecepcion)
        .eq('tipo_movimiento', 'entrada_compra')
        .limit(1);

      if (movimientosError) {
        console.error(`[Backend] Error verificando movimientos previos para la recepción ${idRecepcion}:`, movimientosError.message);
        resumen.mensajes.push(`Error verificando movimientos previos: ${movimientosError.message}`);
        return resumen;
      }

      if (existingMovimientos && existingMovimientos.length > 0) {
        console.log(`[Backend] Movimientos ya aplicados para la recepción ${idRecepcion}. Se evita reprocesamiento.`);
        resumen.seOmitioPorDuplicado = true;
        resumen.mensajes.push('Los movimientos de inventario ya estaban aplicados.');
        return resumen;
      }

      const { data: recepcionInfo, error: recepcionError } = await supabase
        .from('recepcion_mercaderia')
        .select('id_perfil')
        .eq('id_recepcion', idRecepcion)
        .single();

      if (recepcionError) {
        console.error(`[Backend] No se pudo obtener la recepción ${idRecepcion} para aplicar movimientos:`, recepcionError.message);
        resumen.mensajes.push(`No se pudo obtener información de la recepción (ID ${idRecepcion}).`);
        return resumen;
      }

      const idPerfil = recepcionInfo?.id_perfil ?? null;

      const { data: detallesRecepcion, error: detallesError } = await supabase
        .from('detalle_recepcion_mercaderia')
        .select('id_detalle, cantidad_recibida, cantidad_aceptada, id_detalle_orden, id_lote, id_presentacion')
        .eq('id_recepcion', idRecepcion);

      if (detallesError) {
        console.error(`[Backend] Error obteniendo detalles de la recepción ${idRecepcion}:`, detallesError.message);
        resumen.mensajes.push(`No se pudieron leer los detalles de la recepción: ${detallesError.message}`);
        return resumen;
      }

      if (!detallesRecepcion || detallesRecepcion.length === 0) {
        console.warn(`[Backend] La recepción ${idRecepcion} no tiene detalles asociados. No se aplicarán movimientos.`);
        resumen.mensajes.push('La recepción no tiene detalles asociados.');
        return resumen;
      }

      const detalleOrdenIds = detallesRecepcion
        .map(det => det.id_detalle_orden)
        .filter((value): value is number => typeof value === 'number');

      if (detalleOrdenIds.length === 0) {
        console.warn(`[Backend] La recepción ${idRecepcion} no contiene referencias válidas a detalle_orden_compra.`);
        resumen.mensajes.push('Los detalles de recepción no tienen vínculo con la orden de compra.');
        return resumen;
      }

      const { data: detallesOrden, error: detOrdenError } = await supabase
        .from('detalle_orden_compra')
        .select('id_detalle, id_insumo, precio_unitario, id_presentacion, cantidad_recibida, insumo:insumo(nombre_insumo)')
        .in('id_detalle', detalleOrdenIds);

      if (detOrdenError) {
        console.error(`[Backend] Error obteniendo detalles de orden vinculados a la recepción ${idRecepcion}:`, detOrdenError.message);
        resumen.mensajes.push(`No se pudieron leer los detalles de la orden: ${detOrdenError.message}`);
        return resumen;
      }

      if (!detallesOrden || detallesOrden.length === 0) {
        console.warn(`[Backend] No se encontraron detalles de orden para la recepción ${idRecepcion}.`);
        resumen.mensajes.push('No se encontraron detalles de la orden vinculados.');
        return resumen;
      }

      type DetalleOrdenRow = {
        id_detalle: number;
        id_insumo: number;
        precio_unitario: number | null;
        id_presentacion: number | null;
        cantidad_recibida: number | null;
        insumo?: { nombre_insumo?: string | null } | { nombre_insumo?: string | null }[] | null;
      };

      const detallesOrdenRows = (detallesOrden ?? []) as DetalleOrdenRow[];

      const detallesOrdenMap = new Map<number, {
        id_detalle: number;
        id_insumo: number;
        precio_unitario: number | null;
        id_presentacion: number | null;
        cantidad_recibida: number | null;
        insumo?: { nombre_insumo?: string | null } | null;
      }>();
      for (const det of detallesOrdenRows) {
        const insumoInfo = Array.isArray(det.insumo) ? det.insumo[0] : det.insumo;
        detallesOrdenMap.set(det.id_detalle, {
          id_detalle: det.id_detalle,
          id_insumo: det.id_insumo,
          precio_unitario: det.precio_unitario,
          id_presentacion: det.id_presentacion,
          cantidad_recibida: det.cantidad_recibida,
          insumo: insumoInfo ?? undefined,
        });
      }

      const presentacionIds = Array.from(new Set([
        ...detallesOrdenRows
          .map(det => det.id_presentacion)
          .filter((value): value is number => typeof value === 'number'),
        ...detallesRecepcion
          .map(det => det.id_presentacion)
          .filter((value): value is number => typeof value === 'number')
      ]));

      const presentacionesMap = new Map<number, { unidades_por_presentacion: number | null; costo_compra_unitario: number | null }>();
      if (presentacionIds.length > 0) {
        const { data: presentaciones, error: presentacionError } = await supabase
          .from('insumo_presentacion')
          .select('id_presentacion, unidades_por_presentacion, costo_compra_unitario')
          .in('id_presentacion', presentacionIds);

        if (presentacionError) {
          console.error(`[Backend] Error obteniendo presentaciones para la recepción ${idRecepcion}:`, presentacionError.message);
          resumen.mensajes.push(`No se pudieron leer las presentaciones vinculadas: ${presentacionError.message}`);
        } else if (presentaciones) {
          for (const pres of presentaciones) {
            presentacionesMap.set(pres.id_presentacion, pres);
          }
        }
      }

      const insumosProcesados = new Set<number>();

      for (const detalle of detallesRecepcion) {
        const detalleOrden = detalle.id_detalle_orden ? detallesOrdenMap.get(detalle.id_detalle_orden) : undefined;
        if (!detalleOrden) {
          console.warn(`[Backend] Detalle de recepción ${detalle.id_detalle} sin detalle de OC asociado. Se omite.`);
          resumen.mensajes.push(`Detalle de recepción ${detalle.id_detalle} sin detalle de orden asociado.`);
          continue;
        }

        const presentacionDetalle = typeof detalle.id_presentacion === 'number' ? presentacionesMap.get(detalle.id_presentacion) : undefined;
        const presentacionOrden = typeof detalleOrden.id_presentacion === 'number' ? presentacionesMap.get(detalleOrden.id_presentacion) : undefined;
        const unidadesPorPresentacion = presentacionDetalle?.unidades_por_presentacion
          ?? presentacionOrden?.unidades_por_presentacion
          ?? 1;

        const cantidadAceptada = detalle.cantidad_aceptada ?? detalle.cantidad_recibida ?? 0;
        if (cantidadAceptada <= 0) {
          continue;
        }

        const cantidadBase = cantidadAceptada * unidadesPorPresentacion;
        const costoReferencia = (typeof detalleOrden.precio_unitario === 'number' && detalleOrden.precio_unitario > 0)
          ? detalleOrden.precio_unitario
          : (presentacionDetalle?.costo_compra_unitario ?? presentacionOrden?.costo_compra_unitario ?? 0);
        const costoUnitario = unidadesPorPresentacion > 0 ? costoReferencia / unidadesPorPresentacion : costoReferencia;

        let loteId = detalle.id_lote ?? null;
        let cantidadAnterior = 0;
        let cantidadNueva = cantidadBase;
        let actualizoLote = false;

        if (loteId) {
          const { data: loteInfo, error: loteInfoError } = await supabase
            .from('lote_insumo')
            .select('cantidad_actual')
            .eq('id_lote', loteId)
            .single();

          if (loteInfoError) {
            console.warn(`[Backend] No se pudo obtener información del lote ${loteId}:`, loteInfoError.message);
            cantidadAnterior = 0;
          } else {
            cantidadAnterior = loteInfo?.cantidad_actual ?? 0;
          }

          const { data: loteActualizado, error: loteUpdateError } = await supabase
            .from('lote_insumo')
            .update({
              cantidad_actual: cantidadAnterior + cantidadBase,
              costo_unitario: costoUnitario
            })
            .eq('id_lote', loteId)
            .select('cantidad_actual')
            .single();

          if (loteUpdateError) {
            console.error(`[Backend] Error actualizando lote ${loteId}:`, loteUpdateError.message);
            resumen.mensajes.push(`Error actualizando lote ${loteId}: ${loteUpdateError.message}`);
            continue;
          }

          cantidadNueva = loteActualizado?.cantidad_actual ?? (cantidadAnterior + cantidadBase);
          actualizoLote = true;
        } else {
          const { data: loteExistente, error: loteExistenteError } = await supabase
            .from('lote_insumo')
            .select('id_lote, cantidad_actual')
            .eq('id_insumo', detalleOrden.id_insumo)
            .order('fecha_vencimiento', { ascending: false })
            .limit(1);

          if (loteExistenteError) {
            console.warn(`[Backend] No se pudo obtener lote existente para insumo ${detalleOrden.id_insumo}:`, loteExistenteError.message);
          }

          if (loteExistente && loteExistente.length > 0) {
            loteId = loteExistente[0].id_lote;
            cantidadAnterior = loteExistente[0].cantidad_actual ?? 0;

            const { data: loteActualizado, error: loteUpdateError } = await supabase
              .from('lote_insumo')
              .update({
                cantidad_actual: cantidadAnterior + cantidadBase,
                costo_unitario: costoUnitario
              })
              .eq('id_lote', loteId)
              .select('cantidad_actual')
              .single();

            if (loteUpdateError) {
              console.error(`[Backend] Error actualizando lote ${loteId}:`, loteUpdateError.message);
              resumen.mensajes.push(`Error actualizando lote ${loteId}: ${loteUpdateError.message}`);
              continue;
            }

            cantidadNueva = loteActualizado?.cantidad_actual ?? (cantidadAnterior + cantidadBase);
            actualizoLote = true;
          } else {
            const fechaVencimiento = new Date();
            fechaVencimiento.setFullYear(fechaVencimiento.getFullYear() + 1);

            const { data: loteCreado, error: loteCreateError } = await supabase
              .from('lote_insumo')
              .insert({
                id_insumo: detalleOrden.id_insumo,
                fecha_vencimiento: fechaVencimiento.toISOString().slice(0, 10),
                cantidad_inicial: cantidadBase,
                cantidad_actual: cantidadBase,
                costo_unitario: costoUnitario,
                ubicacion: 'almacen'
              })
              .select('id_lote, cantidad_actual')
              .single();

            if (loteCreateError) {
              console.error(`[Backend] Error creando lote para insumo ${detalleOrden.id_insumo}:`, loteCreateError.message);
              resumen.mensajes.push(`Error creando lote para insumo ${detalleOrden.id_insumo}: ${loteCreateError.message}`);
              continue;
            }

            loteId = loteCreado?.id_lote ?? null;
            cantidadAnterior = 0;
            cantidadNueva = loteCreado?.cantidad_actual ?? cantidadBase;
            actualizoLote = true;
          }
        }

        if (actualizoLote) {
          resumen.lotesActualizados += 1;
        }

        const idPresentacionFinal = detalle.id_presentacion ?? detalleOrden.id_presentacion ?? null;

        await supabase
          .from('detalle_recepcion_mercaderia')
          .update({
            id_lote: loteId,
            id_presentacion: idPresentacionFinal
          })
          .eq('id_detalle', detalle.id_detalle);

        const cantidadRecibidaAnterior = detalleOrden.cantidad_recibida ?? 0;
        const nuevaCantidadRecibida = cantidadRecibidaAnterior + cantidadAceptada;

        await supabase
          .from('detalle_orden_compra')
          .update({ cantidad_recibida: nuevaCantidadRecibida })
          .eq('id_detalle', detalleOrden.id_detalle);

        detalleOrden.cantidad_recibida = nuevaCantidadRecibida;

        const descripcionMovimiento = `Recepción de mercadería #${idRecepcion} - ${detalleOrden.insumo?.nombre_insumo ?? 'Insumo'}`;

        await supabase
          .from('movimiento_inventario')
          .insert({
            id_insumo: detalleOrden.id_insumo,
            id_lote: loteId,
            tipo_movimiento: 'entrada_compra',
            cantidad: cantidadBase,
            id_perfil: idPerfil,
            id_referencia: idRecepcion,
            descripcion: descripcionMovimiento,
            costo_unitario_momento: costoUnitario,
            id_presentacion: idPresentacionFinal
          });

        resumen.movimientosGenerados += 1;
        resumen.cantidadBaseTotal += cantidadBase;

        await supabase
          .from('bitacora_inventario')
          .insert({
            id_insumo: detalleOrden.id_insumo,
            accion: 'actualizacion',
            campo_modificado: 'cantidad_actual',
            valor_anterior: `${cantidadAnterior}`,
            valor_nuevo: `${cantidadNueva}`,
            id_perfil: idPerfil,
            descripcion: `Recepcion #${idRecepcion} (OC #${idOrden}) - +${formatNumero(cantidadBase)} unidades base. Presentacion ID ${idPresentacionFinal ?? 'N/A'}. Costo unitario ${formatNumero(costoUnitario)}.`
          });

        insumosProcesados.add(detalleOrden.id_insumo);
      }

      for (const idInsumo of insumosProcesados) {
        const { error: costoError } = await supabase.rpc('fn_actualizar_costo_promedio', { p_id_insumo: idInsumo });
        if (costoError) {
          console.error(`[Backend] Error recalculando costo promedio para insumo ${idInsumo}:`, costoError.message);
          resumen.mensajes.push(`Error recalculando costo promedio de insumo ${idInsumo}: ${costoError.message}`);
        }
      }

      resumen.insumosActualizados = insumosProcesados.size;
      resumen.movimientosAplicados = resumen.movimientosGenerados > 0;

      console.log(`[Backend] Movimientos aplicados manualmente para recepción ${idRecepcion} (OC #${idOrden}). Registros: ${resumen.movimientosGenerados}, unidades base: ${formatNumero(resumen.cantidadBaseTotal)}.`);
      if (resumen.movimientosAplicados) {
        resumen.mensajes.push('Movimientos de inventario aplicados correctamente.');
      }

      return resumen;
    } catch (error) {
      console.error(`[Backend] Error aplicando movimientos para la recepción ${idRecepcion}:`, error);
      const message = error instanceof Error ? error.message : String(error);
      resumen.mensajes.push(`Error general aplicando movimientos: ${message}`);
      throw error;
    }
  }

    /**
     * Crea automáticamente los detalles de recepción a partir de los detalles de la OC.
     * Retorna la cantidad de detalles insertados.
     */
    private async crearDetallesRecepcionAutomaticos(idOrden: number, idRecepcion: number): Promise<number> {
      try {
        console.log(`[Backend] Iniciando crearDetallesRecepcionAutomaticos para OC ${idOrden}, Recepción ${idRecepcion}`);
        
        // Reintentar hasta 5 veces con delay si no encuentra detalles
        let detallesOrden = null;
        let intentos = 0;
        const maxIntentos = 5;
        
        while (intentos < maxIntentos && (!detallesOrden || detallesOrden.length === 0)) {
          if (intentos > 0) {
            console.log(`[Backend] Reintentando obtener detalles de OC ${idOrden} (intento ${intentos + 1}/${maxIntentos})`);
            await new Promise(resolve => setTimeout(resolve, 200 * intentos)); // Incrementar delay: 200ms, 400ms, 600ms...
          }
          
          const { data: detalles, error: detallesError } = await supabase
            .from('detalle_orden_compra')
            .select('id_detalle, cantidad, id_presentacion, id_insumo, precio_unitario')
            .eq('id_orden', idOrden);

          if (detallesError) {
            console.error(`[Backend] Error obteniendo detalles de OC ${idOrden}:`, detallesError.message);
            return 0;
          }

          detallesOrden = detalles;
          intentos++;
        }

        console.log(`[Backend] Detalles obtenidos de OC ${idOrden} (intento ${intentos}):`, detallesOrden);

        if (!detallesOrden || detallesOrden.length === 0) {
          console.warn(`[Backend] OC ${idOrden} sin detalles después de ${maxIntentos} intentos. No se crearán detalles de recepción automáticos.`);
          return 0;
        }

        const { data: detallesExistentes, error: existentesError } = await supabase
          .from('detalle_recepcion_mercaderia')
          .select('id_detalle_orden')
          .eq('id_recepcion', idRecepcion);

        if (existentesError) {
          console.error(`[Backend] Error verificando detalles existentes para recepción ${idRecepcion}:`, existentesError.message);
          return 0;
        }

        const existentesSet = new Set((detallesExistentes || []).map(det => det.id_detalle_orden));

        const detallesAInsertar = detallesOrden
          .filter(det => det.cantidad > 0 && !existentesSet.has(det.id_detalle))
          .map(det => ({
            id_recepcion: idRecepcion,
            id_detalle_orden: det.id_detalle,
            cantidad_recibida: det.cantidad,
            cantidad_aceptada: det.cantidad,
            id_presentacion: det.id_presentacion ?? null,
          }));

        console.log(`[Backend] Detalles a insertar para recepción ${idRecepcion}:`, detallesAInsertar);

        const detallesSinPresentacion = detallesOrden.filter(det => det.cantidad > 0 && det.id_presentacion === null);
        if (detallesSinPresentacion.length > 0) {
          console.warn(`[Backend] OC ${idOrden} con ${detallesSinPresentacion.length} detalle(s) sin presentacion asignada. Se insertara la recepcion con id_presentacion NULL.`);
        }

        if (detallesAInsertar.length === 0) {
          console.log(`[Backend] Recepción ${idRecepcion} ya tenía detalles sincronizados. No se insertaron nuevos registros.`);
          return 0;
        }

        const { data: detallesInsertados, error: insertError } = await supabase
          .from('detalle_recepcion_mercaderia')
          .insert(detallesAInsertar)
          .select('id_detalle');

        if (insertError) {
          console.error(`[Backend] Error insertando detalles automáticos para recepción ${idRecepcion}:`, insertError.message);
          throw new Error(`Error al crear detalles de recepción automáticos: ${insertError.message}`);
        }

        console.log(`[Backend] Detalles automáticos creados para recepción ${idRecepcion}:`, detallesAInsertar.length);
        return detallesInsertados?.length ?? detallesAInsertar.length;
      } catch (error) {
        console.error('[Backend] Error inesperado en crearDetallesRecepcionAutomaticos:', error);
        return 0;
      }
    }

    /**
     * Verifica si todos los detalles de la OC fueron recibidos y, de ser así, cierra la orden.
     * Siempre aplica los movimientos de inventario para la recepción actual.
     */
    private async intentarCerrarOrdenCompra(idOrden: number, idRecepcion: number): Promise<RecepcionSincronizacionResumen> {
      console.log('[Backend] Aplicando movimientos de inventario para recepción', idRecepcion);
      const movimientos = await this.aplicarMovimientosRecepcion(idOrden, idRecepcion);

      const { data: currentOC, error: fetchOCError } = await supabase
        .from('orden_compra')
        .select('estado, aprobado_por, fecha_aprobacion')
        .eq('id_orden', idOrden)
        .single();

      if (fetchOCError) {
        console.warn(`[Backend] No se pudo obtener estado de OC ${idOrden}:`, fetchOCError.message);
        movimientos.mensajes.push(`No se pudo determinar el estado actual de la OC: ${fetchOCError.message}`);
      }

      const resumen: RecepcionSincronizacionResumen = {
        movimientos,
        ocCerrada: false,
        ocEstadoFinal: currentOC?.estado ?? 'desconocido',
        totalDetallesOrden: null,
        totalDetallesRecepcion: null,
        detallesPendientes: 0,
      };

      const { count: totalDetallesOC, error: countOCError } = await supabase
        .from('detalle_orden_compra')
        .select('*', { count: 'exact', head: true })
        .eq('id_orden', idOrden);

      if (countOCError) {
        console.warn('[Backend] Error contando detalles de OC:', countOCError.message);
        throw new Error(`Error al contar detalles de la orden: ${countOCError.message}`);
      }

      resumen.totalDetallesOrden = totalDetallesOC ?? null;

      const { data: todasRecepciones, error: recepcionesError } = await supabase
        .from('recepcion_mercaderia')
        .select('id_recepcion')
        .eq('id_orden', idOrden);

      if (recepcionesError) {
        console.warn('[Backend] Error obteniendo recepciones de la OC:', recepcionesError.message);
        movimientos.mensajes.push(`No se pudieron obtener las recepciones para validar la sincronización: ${recepcionesError.message}`);
        return resumen;
      }

      const idsRecepciones = new Set<number>((todasRecepciones || []).map(r => r.id_recepcion));
      idsRecepciones.add(idRecepcion);

      if (idsRecepciones.size === 0) {
        resumen.totalDetallesRecepcion = 0;
        resumen.detallesPendientes = totalDetallesOC ?? 0;
        movimientos.mensajes.push('No se encontraron recepciones asociadas a la orden.');
        return resumen;
      }

      const { count: totalDetallesRecepcion, error: countRecepcionError } = await supabase
        .from('detalle_recepcion_mercaderia')
        .select('*', { count: 'exact', head: true })
        .in('id_recepcion', Array.from(idsRecepciones));

      if (countRecepcionError) {
        console.warn('[Backend] Error contando detalles de recepción:', countRecepcionError.message);
        throw new Error(`Error al contar detalles de recepción: ${countRecepcionError.message}`);
      }

      resumen.totalDetallesRecepcion = totalDetallesRecepcion ?? null;

      if (totalDetallesOC !== null && totalDetallesRecepcion !== null) {
        resumen.detallesPendientes = Math.max(totalDetallesOC - totalDetallesRecepcion, 0);
      }

      console.log('[Backend] Conteo sincronización OC', idOrden, '-> detalles OC:', totalDetallesOC, 'detalles recepcionados (todas las recepciones):', totalDetallesRecepcion);

      if (totalDetallesOC !== null && totalDetallesRecepcion !== null && totalDetallesOC === totalDetallesRecepcion) {
        if (totalDetallesRecepcion === 0) {
          const errorMsg = `❌ VALIDACIÓN FALLIDA: No se puede cambiar OC #${idOrden} a 'recibida' sin detalles de recepción.`;
          console.error('[Backend]', errorMsg);
          movimientos.mensajes.push('La orden no se puede cerrar porque no existen detalles recepcionados.');
          throw new Error(errorMsg);
        }

        if ((currentOC?.estado ?? '') !== 'recibida') {
          console.log('[Backend] ✅ Todos los detalles recibidos - Cambiando OC', idOrden, 'a estado recibida');

          const { data: recepcionInfo, error: recepcionError } = await supabase
            .from('recepcion_mercaderia')
            .select('id_perfil')
            .eq('id_recepcion', idRecepcion)
            .single();

          if (recepcionError) {
            console.warn(`[Backend] No se pudo obtener el perfil asociado a la recepcion ${idRecepcion}:`, recepcionError.message);
            movimientos.mensajes.push(`No se pudo identificar el perfil que recepcionó la mercadería: ${recepcionError.message}`);
          }

          const updatePayload: { estado: 'recibida'; fecha_aprobacion: string; aprobado_por?: number } = {
            estado: 'recibida',
            fecha_aprobacion: new Date().toISOString()
          };

          const perfilRecepcion = recepcionInfo?.id_perfil ?? null;
          if (perfilRecepcion) {
            updatePayload.aprobado_por = perfilRecepcion;
          } else if (currentOC?.aprobado_por) {
            updatePayload.aprobado_por = currentOC.aprobado_por;
          }

          const { error: updateError } = await supabase
            .from('orden_compra')
            .update(updatePayload)
            .eq('id_orden', idOrden);

          if (updateError) {
            console.error(`[Backend] No se pudo cambiar el estado de la OC ${idOrden}:`, updateError.message);
            throw new Error(`No se pudo cambiar el estado de la OC a 'recibida': ${updateError.message}`);
          }

          resumen.ocCerrada = true;
          resumen.ocEstadoFinal = 'recibida';
          movimientos.mensajes.push('Orden de compra actualizada a estado recibida.');
          console.log('[Backend] ✅ OC actualizada a estado recibida');
        } else {
          console.log('[Backend] OC', idOrden, 'ya estaba en estado recibida');
        }
      } else {
        console.log('[Backend] Aún faltan detalles por recibir para OC', idOrden, '- OC permanece en estado actual');
        if (resumen.detallesPendientes > 0) {
          movimientos.mensajes.push(`Faltan ${resumen.detallesPendientes} detalle(s) por recibir para cerrar la orden.`);
        }
      }

      return resumen;
    }
  // ================== CATEGORÍAS DE INSUMOS ==================

  async getCategoriasInsumo(): Promise<CategoriaInsumo[]> {
    const { data, error } = await supabase
      .from('categoria_insumo')
      .select('*')
      .order('nombre');

    if (error) throw new Error(`Error al obtener categorías de insumos: ${error.message}`);
    return data || [];
  }

  async getCategoriaInsumoById(id: number): Promise<CategoriaInsumo | null> {
    const { data, error } = await supabase
      .from('categoria_insumo')
      .select('*')
      .eq('id_categoria', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Error al obtener categoría: ${error.message}`);
    }
    return data;
  }

  // ================== INSUMOS ==================

  async getInsumos(activos?: boolean): Promise<Insumo[]> {
    let query = supabase
      .from('insumo')
      .select(`
        *,
        categoria_insumo(tipo_categoria),
        lote_insumo(cantidad_actual)
      `)
      .order('nombre_insumo');

    if (activos !== undefined) {
      query = query.eq('activo', activos);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Error al obtener insumos: ${error.message}`);

    // Calcular stock_actual sumando cantidad_actual de todos los lotes
    const insumosConStock = (data || []).map(insumo => ({
      ...insumo,
      tipo_insumo: insumo.categoria_insumo?.tipo_categoria || 'operativo',
      stock_actual: Array.isArray(insumo.lote_insumo)
        ? insumo.lote_insumo.reduce((sum: number, lote: { cantidad_actual: number }) => sum + (lote.cantidad_actual || 0), 0)
        : 0,
      insumo_url: insumo.insumo_url
    }));

    return insumosConStock;
  }

  async getInsumoById(id: number): Promise<Insumo | null> {
    const { data, error } = await supabase
      .from('insumo')
      .select('*')
      .eq('id_insumo', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Error al obtener insumo: ${error.message}`);
    }
    return data;
  }

  async createInsumo(dto: CreateInsumoDTO): Promise<Insumo> {
    // Extraer campos que no pertenecen a la tabla insumo
    const { fecha_vencimiento, ubicacion, descripcion_presentacion, ...insumoData } = dto;

    const { data, error } = await supabase
      .from('insumo')
      .insert({
        ...insumoData,
        costo_promedio: dto.costo_promedio || 0,
      })
      .select()
      .single();

    if (error) throw new Error(`Error al crear insumo: ${error.message}`);

    // Crear presentación principal para el insumo SIEMPRE
    if (data?.id_insumo) {
      console.log(`Creando presentación y lote para insumo ${data.id_insumo} (${dto.nombre_insumo})`);
      
      const presentacionData: CreatePresentacionDTO = {
        id_insumo: data.id_insumo,
        id_proveedor: dto.id_proveedor_principal,
        descripcion_presentacion: descripcion_presentacion || `Presentación principal de ${dto.nombre_insumo}`,
        unidad_compra: dto.unidad_base, // Usar la misma unidad base como unidad de compra por defecto
        unidades_por_presentacion: 1, // 1 unidad por presentación por defecto
        costo_compra_unitario: dto.costo_promedio || 0,
        es_principal: true, // Esta es la presentación principal
      };

      const { error: presentacionError } = await supabase
        .from('insumo_presentacion')
        .insert(presentacionData);

      if (presentacionError) {
        console.warn(`Error al crear presentación para insumo ${data.id_insumo}: ${presentacionError.message}`);
        // No lanzamos error aquí para no fallar la creación del insumo
      } else {
        console.log(`Presentación creada exitosamente para insumo ${data.id_insumo}`);
        // Actualizar el proveedor principal del insumo
        await this.updateProveedorPrincipal(data.id_insumo);
      }

      // Crear lote inicial SIEMPRE (incluso sin fecha de vencimiento)
      console.log(`Creando lote para insumo ${data.id_insumo}, fecha_vencimiento proporcionada:`, fecha_vencimiento);
      
      const loteData: Record<string, unknown> = {
        id_insumo: data.id_insumo,
        cantidad_inicial: 0,
        cantidad_actual: 0,
        costo_unitario: dto.costo_promedio || 0,
        ubicacion: ubicacion || 'Bodega'
      };

      // Solo agregar fecha_vencimiento si se proporcionó
      if (fecha_vencimiento) {
        loteData.fecha_vencimiento = fecha_vencimiento;
      }

      console.log('Datos del lote a insertar:', loteData);

      const { data: loteInsertado, error: loteError } = await supabase
        .from('lote_insumo')
        .insert(loteData)
        .select();

      if (loteError) {
        console.error(`Error al crear lote inicial para insumo ${data.id_insumo}:`, loteError);
        console.warn(`Error al crear lote inicial para insumo ${data.id_insumo}: ${loteError.message}`);
        // No lanzamos error aquí para no fallar la creación del insumo
      } else {
        console.log(`Lote creado exitosamente para insumo ${data.id_insumo}:`, loteInsertado);
      }
    }

    return data;
  }

  async updateInsumo(id: number, dto: UpdateInsumoDTO): Promise<Insumo> {
    // Extraer campos relacionados con presentaciones y lotes
    const { fecha_vencimiento, ubicacion, id_proveedor_principal, descripcion_presentacion, ...insumoData } = dto;

    // Actualizar el insumo principal
    const { data, error } = await supabase
      .from('insumo')
      .update(insumoData)
      .eq('id_insumo', id)
      .select()
      .single();

    if (error) throw new Error(`Error al actualizar insumo: ${error.message}`);

    // Actualizar presentación principal si se proporcionaron datos
    if (id_proveedor_principal || descripcion_presentacion) {
      const presentacionUpdate: Partial<CreatePresentacionDTO> = {};
      if (id_proveedor_principal) presentacionUpdate.id_proveedor = id_proveedor_principal;
      if (descripcion_presentacion) presentacionUpdate.descripcion_presentacion = descripcion_presentacion;

      if (Object.keys(presentacionUpdate).length > 0) {
        const { error: presentacionError } = await supabase
          .from('insumo_presentacion')
          .update(presentacionUpdate)
          .eq('id_insumo', id)
          .eq('es_principal', true);

        if (presentacionError) {
          console.warn(`Error al actualizar presentación para insumo ${id}: ${presentacionError.message}`);
        }
      }
    }

    // Actualizar ubicación en lotes si se proporcionó
    if (ubicacion) {
      const { error: loteError } = await supabase
        .from('lote_insumo')
        .update({ ubicacion })
        .eq('id_insumo', id);

      if (loteError) {
        console.warn(`Error al actualizar ubicación en lotes para insumo ${id}: ${loteError.message}`);
      }
    }

    // Si se proporcionó fecha_vencimiento, actualizar o crear lote
    if (fecha_vencimiento) {
      // Verificar si ya existe un lote para este insumo
      const { data: existingLote, error: loteCheckError } = await supabase
        .from('lote_insumo')
        .select('id_lote')
        .eq('id_insumo', id)
        .limit(1)
        .single();

      if (loteCheckError && loteCheckError.code !== 'PGRST116') {
        console.warn(`Error al verificar lote existente para insumo ${id}: ${loteCheckError.message}`);
      } else if (existingLote) {
        // Actualizar lote existente
        const { error: loteUpdateError } = await supabase
          .from('lote_insumo')
          .update({ fecha_vencimiento })
          .eq('id_insumo', id);

        if (loteUpdateError) {
          console.warn(`Error al actualizar lote para insumo ${id}: ${loteUpdateError.message}`);
        }
      } else {
        // Crear nuevo lote si no existe
        const { error: loteCreateError } = await supabase
          .from('lote_insumo')
          .insert({
            id_insumo: id,
            fecha_vencimiento: fecha_vencimiento,
            cantidad_inicial: 0,
            cantidad_actual: 0,
            costo_unitario: data.costo_promedio || 0,
            ubicacion: ubicacion || 'Bodega'
          });

        if (loteCreateError) {
          console.warn(`Error al crear lote para insumo ${id}: ${loteCreateError.message}`);
        }
      }
    }

    return data;
  }

  async deleteInsumo(id: number): Promise<void> {
    // Primero eliminar movimientos de inventario relacionados
    const { error: movimientosError } = await supabase
      .from('movimiento_inventario')
      .delete()
      .eq('id_insumo', id);

    if (movimientosError) {
      throw new Error(`Error al eliminar movimientos para insumo ${id}: ${movimientosError.message}`);
    }

    // Eliminar lotes relacionados
    const { error: lotesError } = await supabase
      .from('lote_insumo')
      .delete()
      .eq('id_insumo', id);

    if (lotesError) {
      throw new Error(`Error al eliminar lotes para insumo ${id}: ${lotesError.message}`);
    }

    // Eliminar presentaciones relacionadas
    const { error: presentacionesError } = await supabase
      .from('insumo_presentacion')
      .delete()
      .eq('id_insumo', id);

    if (presentacionesError) {
      throw new Error(`Error al eliminar presentaciones para insumo ${id}: ${presentacionesError.message}`);
    }

    // Finalmente eliminar el insumo principal
    const { error } = await supabase
      .from('insumo')
      .delete()
      .eq('id_insumo', id);

    if (error) throw new Error(`Error al eliminar insumo: ${error.message}`);
  }

  async getProveedorPrincipal(idInsumo: number): Promise<number | null> {
    const { data, error } = await supabase
      .from('insumo_presentacion')
      .select('id_proveedor')
      .eq('id_insumo', idInsumo)
      .eq('es_principal', true)
      .eq('activo', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Error al obtener proveedor principal: ${error.message}`);
    }
    return data?.id_proveedor || null;
  }

  // ================== CATÁLOGO ==================

  async getCatalogoInsumos(): Promise<CatalogoInsumo[]> {
    const { data, error } = await supabase
      .from('insumo')
      .select(`
        id_insumo,
        nombre_insumo,
        unidad_base,
        stock_minimo,
        stock_maximo,
        costo_promedio,
        activo,
        fecha_registro,
        id_categoria,
        id_proveedor_principal,
        insumo_url,
        categoria_insumo:categoria_insumo(nombre, tipo_categoria),
        lote_insumo:lote_insumo(cantidad_actual, ubicacion, fecha_vencimiento),
        insumo_presentacion(id_proveedor, descripcion_presentacion, es_principal, activo)
      `)
      .order('nombre_insumo', { ascending: true });

    if (error) {
      console.error('Error en consulta:', error);
      throw new Error(`Error al obtener catálogo de insumos: ${error.message}`);
    }

    // Mapeo igual que dashboard: incluye insumos sin lotes/categoría
    const result = (data || []).map((item: CatalogoQueryResult) => {
      // Calcular stock total desde lotes (si no hay, 0)
      const lotes = Array.isArray(item.lote_insumo) ? item.lote_insumo : [];
      const stock_actual = lotes.length ? lotes.reduce((sum, lote) => sum + (lote.cantidad_actual || 0), 0) : 0;

      // Calcular ubicación: tomar ubicaciones únicas de los lotes
      const ubicaciones = lotes
        .map(lote => lote.ubicacion)
        .filter(ubicacion => ubicacion && ubicacion.trim() !== '');
      const ubicacion = ubicaciones.length > 0 ? [...new Set(ubicaciones)].join(', ') : undefined;

      // Determinar fecha de vencimiento más próxima disponible
      const fecha_vencimiento = lotes
        .map(lote => lote.fecha_vencimiento)
        .filter((fecha): fecha is string => Boolean(fecha))
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];

      // Si no hay categoría, asigna tipo 'perpetuo' y nombre '—'
      let categoriaObj: { nombre: string; tipo_categoria: 'perpetuo' | 'operativo' };
      if (Array.isArray(item.categoria_insumo) && item.categoria_insumo.length > 0) {
        const raw = item.categoria_insumo[0];
        categoriaObj = {
          nombre: raw.nombre || '—',
          tipo_categoria: raw.tipo_categoria === 'operativo' ? 'operativo' : 'perpetuo'
        };
      } else {
        categoriaObj = { nombre: '—', tipo_categoria: 'perpetuo' };
      }

      // Obtener proveedor principal SIEMPRE de las presentaciones activas
      let id_proveedor_principal = undefined;
      let descripcion_presentacion = undefined;
      if (Array.isArray(item.insumo_presentacion) && item.insumo_presentacion.length > 0) {
        // Buscar la presentación principal (es_principal = true)
        let presentacionPrincipal = item.insumo_presentacion.find(p => p.es_principal && p.activo);
        
        // Si no hay presentación principal, usar la primera activa
        if (!presentacionPrincipal) {
          presentacionPrincipal = item.insumo_presentacion.find(p => p.activo);
        }
        
        if (presentacionPrincipal) {
          id_proveedor_principal = presentacionPrincipal.id_proveedor;
          descripcion_presentacion = presentacionPrincipal.descripcion_presentacion;
        }
      }
      
      // Si no hay presentaciones, usar el campo del insumo como fallback
      if (!id_proveedor_principal) {
        id_proveedor_principal = item.id_proveedor_principal;
      }

      return {
        id_insumo: item.id_insumo,
        nombre: item.nombre_insumo,
        unidad_base: item.unidad_base || 'unidades',
        stock_actual,
        stock_minimo: item.stock_minimo,
        stock_maximo: item.stock_maximo,
        costo_promedio: item.costo_promedio,
        activo: item.activo,
        fecha_creacion: item.fecha_registro,
        id_categoria: item.id_categoria,
        id_proveedor_principal,
        categoria: categoriaObj,
        ubicacion,
        descripcion_presentacion,
        insumo_url: item.insumo_url || undefined,
        fecha_vencimiento,
      };
    });
    return result;
  }

  // ================== PRESENTACIONES ==================

  async getPresentacionesByInsumo(idInsumo: number): Promise<PresentacionCompleta[]> {
    console.log(`[BACKEND] getPresentacionesByInsumo service called with idInsumo: ${idInsumo}`);

    // Primero obtenemos el insumo para incluir su información
    const { data: insumoData, error: insumoError } = await supabase
      .from('insumo')
      .select(`
        id_insumo,
        nombre_insumo,
        unidad_base,
        costo_promedio,
        stock_minimo,
        stock_maximo,
        activo
      `)
      .eq('id_insumo', idInsumo)
      .single();

    if (insumoError) {
      console.error(`[BACKEND] Error al obtener insumo ${idInsumo}:`, insumoError);
      // Si el insumo no existe, devolver array vacío en lugar de error
      if (insumoError.code === 'PGRST116') {
        console.log(`[BACKEND] Insumo ${idInsumo} no encontrado, retornando array vacío`);
        return [];
      }
      throw new Error(`Error al obtener insumo: ${insumoError.message}`);
    }

    if (!insumoData.activo) {
      console.log(`[BACKEND] Insumo ${idInsumo} inactivo, retornando array vacío`);
      return [];
    }

    console.log(`[BACKEND] Insumo encontrado:`, insumoData.nombre_insumo);

    // Obtenemos las presentaciones activas
    const { data: presentacionesData, error: presentacionesError } = await supabase
      .from('insumo_presentacion')
      .select(`
        id_presentacion,
        id_insumo,
        id_proveedor,
        descripcion_presentacion,
        unidad_compra,
        unidades_por_presentacion,
        costo_compra_unitario,
        es_principal,
        activo
      `)
      .eq('id_insumo', idInsumo)
      .eq('activo', true)
      .order('es_principal', { ascending: false });

    if (presentacionesError) {
      throw new Error(`Error al obtener presentaciones del insumo: ${presentacionesError.message}`);
    }

    // Obtenemos los lotes activos para calcular stock disponible
    const { data: lotesData, error: lotesError } = await supabase
      .from('lote_insumo')
      .select(`
        id_lote,
        id_insumo,
        cantidad_inicial,
        cantidad_actual,
        costo_unitario,
        fecha_vencimiento,
        ubicacion
      `)
      .eq('id_insumo', idInsumo)
      .gt('cantidad_actual', 0)
      .order('fecha_vencimiento', { ascending: true });

    if (lotesError) {
      console.warn(`Error al obtener lotes del insumo: ${lotesError.message}`);
    }

    // Calculamos el stock total disponible
    const stockTotal = lotesData ? lotesData.reduce((sum, lote) => sum + (lote.cantidad_actual || 0), 0) : 0;

    // Combinamos toda la información
    const result = await Promise.all((presentacionesData || []).map(async (presentacion) => {
      // Obtener información del proveedor si existe
      let proveedorInfo = null;
      if (presentacion.id_proveedor) {
        const { data: proveedorData } = await supabase
          .from('proveedor')
          .select('id_proveedor, nombre_empresa')
          .eq('id_proveedor', presentacion.id_proveedor)
          .single();

        if (proveedorData) {
          proveedorInfo = {
            id_proveedor: proveedorData.id_proveedor,
            nombre_proveedor: proveedorData.nombre_empresa
          };
        }
      }

      return {
        // Información del insumo
        insumo: {
          id_insumo: insumoData.id_insumo,
          nombre_insumo: insumoData.nombre_insumo,
          unidad_base: insumoData.unidad_base,
          costo_promedio: insumoData.costo_promedio,
          stock_minimo: insumoData.stock_minimo,
          stock_maximo: insumoData.stock_maximo,
          stock_actual: stockTotal,
          activo: insumoData.activo
        },
        // Información de la presentación
        presentacion: {
          id_presentacion: presentacion.id_presentacion,
          descripcion_presentacion: presentacion.descripcion_presentacion,
          unidad_compra: presentacion.unidad_compra,
          unidades_por_presentacion: presentacion.unidades_por_presentacion,
          costo_compra_unitario: presentacion.costo_compra_unitario,
          es_principal: presentacion.es_principal,
          activo: presentacion.activo
        },
        // Información del proveedor
        proveedor: proveedorInfo,
        // Información de lotes disponibles
        lotes_disponibles: lotesData || []
      };
    }));

    return result;
  }

  async updatePresentacion(idPresentacion: number, updates: { descripcion_presentacion?: string; unidades_por_presentacion?: number; unidad_compra?: string }) {
    const { data, error } = await supabase
      .from('insumo_presentacion')
      .update({
        ...(updates.descripcion_presentacion !== undefined && { descripcion_presentacion: updates.descripcion_presentacion }),
        ...(updates.unidades_por_presentacion !== undefined && { unidades_por_presentacion: updates.unidades_por_presentacion }),
        ...(updates.unidad_compra !== undefined && { unidad_compra: updates.unidad_compra }),
      })
      .eq('id_presentacion', idPresentacion)
      .select()
      .single();

    if (error) throw new Error(`Error al actualizar presentación: ${error.message}`);
    return data;
  }

  async updateLote(idLote: number, updates: { costo_unitario?: number }) {
    const { data, error } = await supabase
      .from('lote_insumo')
      .update({
        ...(updates.costo_unitario !== undefined && { costo_unitario: updates.costo_unitario }),
      })
      .eq('id_lote', idLote)
      .select()
      .single();

    if (error) throw new Error(`Error al actualizar lote: ${error.message}`);
    return data;
  }

  // ================== LOTES ==================

  async getLotesByInsumo(idInsumo: number): Promise<LoteInsumo[]> {
    const { data, error } = await supabase
      .from('lote_insumo')
      .select('*')
      .eq('id_insumo', idInsumo)
      .order('fecha_vencimiento', { ascending: true });

    if (error) throw new Error(`Error al obtener lotes: ${error.message}`);
    return data || [];
  }

  async getLoteById(id: number): Promise<LoteInsumo | null> {
    const { data, error } = await supabase
      .from('lote_insumo')
      .select('*')
      .eq('id_lote', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Error al obtener lote: ${error.message}`);
    }
    return data;
  }

  async createLote(dto: CreateLoteDTO): Promise<LoteInsumo> {
    const { data, error } = await supabase
      .from('lote_insumo')
      .insert({
        id_insumo: dto.id_insumo,
        fecha_vencimiento: dto.fecha_vencimiento,
        cantidad_inicial: dto.cantidad_inicial,
        cantidad_actual: dto.cantidad_inicial,
        costo_unitario: dto.costo_unitario,
        ubicacion: dto.ubicacion,
      })
      .select()
      .single();

    if (error) throw new Error(`Error al crear lote: ${error.message}`);

    // Actualizar costo promedio del insumo (función PL/pgSQL fn_actualizar_costo_promedio)
    await this.actualizarCostoPromedio(dto.id_insumo);

    return data;
  }

  async deleteLote(id: number): Promise<void> {
    const { error } = await supabase
      .from('lote_insumo')
      .delete()
      .eq('id_lote', id);

    if (error) throw new Error(`Error al eliminar lote: ${error.message}`);
  }

  // ================== MOVIMIENTOS ==================

  async getMovimientos(
    idInsumo?: number,
    fechaInicio?: string,
    fechaFin?: string
  ): Promise<MovimientoInventario[]> {
    let query = supabase
      .from('movimiento_inventario')
      .select('*')
      .order('fecha_movimiento', { ascending: false });

    if (idInsumo) {
      query = query.eq('id_insumo', idInsumo);
    }

    if (fechaInicio) {
      query = query.gte('fecha_movimiento', fechaInicio);
    }

    if (fechaFin) {
      query = query.lte('fecha_movimiento', fechaFin);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Error al obtener movimientos: ${error.message}`);
    return data || [];
  }

  async createMovimiento(dto: CreateMovimientoDTO): Promise<MovimientoInventario> {
    const { data, error } = await supabase
      .from('movimiento_inventario')
      .insert(dto)
      .select()
      .single();

    if (error) throw new Error(`Error al registrar movimiento: ${error.message}`);

    // Actualizar costo promedio después del movimiento
    if (dto.tipo_movimiento.startsWith('entrada')) {
      await this.actualizarCostoPromedio(dto.id_insumo);
    }

    return data;
  }

  // ================== STOCK ==================

  /**
   * Obtener stock actual usando función PL/pgSQL fn_obtener_stock_actual
   */
  async getStockActual(idInsumo?: number): Promise<StockActual[]> {
    const query = supabase.rpc('fn_obtener_stock_actual', {
      p_id_insumo: idInsumo || null,
    });

    const { data, error } = await query;

    if (error) throw new Error(`Error al obtener stock actual: ${error.message}`);

    // Determinar estado del stock
    return (data || []).map((item: Record<string, unknown>) => ({
      id_insumo: item.id_insumo as number,
      nombre_insumo: item.nombre_insumo as string,
      cantidad_actual: item.cantidad_actual as number,
      unidad_base: item.unidad_base as string,
      stock_minimo: item.stock_minimo as number,
      stock_maximo: item.stock_maximo as number,
      costo_promedio: item.costo_promedio as number,
      estado_stock:
        (item.cantidad_actual as number) < (item.stock_minimo as number)
          ? 'bajo'
          : (item.cantidad_actual as number) > (item.stock_maximo as number)
          ? 'alto'
          : 'normal',
    }));
  }

  /**
   * Obtener insumos con stock bajo
   */
  async getInsumosStockBajo(): Promise<StockActual[]> {
    const stock = await this.getStockActual();
    return stock.filter((s) => s.estado_stock === 'bajo');
  }

  /**
   * Actualizar costo promedio usando función PL/pgSQL
   */
  private async actualizarCostoPromedio(idInsumo: number): Promise<void> {
    const { error } = await supabase.rpc('fn_actualizar_costo_promedio', {
      p_id_insumo: idInsumo,
    });

    if (error) {
      console.error(`Error al actualizar costo promedio: ${error.message}`);
      // No lanzar error, solo log
    }
  }

  // ================== KARDEX ==================

  async getKardexInsumo(idInsumo: number, fechaDesde?: string, fechaHasta?: string) {
    const { data, error } = await supabase
      .rpc('fn_kardex_insumo', {
        p_id_insumo: idInsumo,
        p_fecha_desde: fechaDesde || null,
        p_fecha_hasta: fechaHasta || null,
      });

    if (error) throw new Error(`Error al obtener kardex del insumo: ${error.message}`);
    return data || [];
  }

  // ================== DETALLES DE INSUMO ==================

  async getInsumoDetails(idInsumo: number) {
    // Obtener datos básicos del insumo SIN JOIN con proveedor para evitar conflictos
    const { data: insumoData, error: insumoError } = await supabase
      .from('insumo')
      .select(`
        id_insumo,
        nombre_insumo,
        unidad_base,
        stock_minimo,
        stock_maximo,
        costo_promedio,
        activo,
        fecha_registro,
        id_categoria,
        id_proveedor_principal,
        insumo_url,
        categoria_insumo:categoria_insumo(nombre, tipo_categoria)
      `)
      .eq('id_insumo', idInsumo)
      .single();

    if (insumoError) throw new Error(`Error al obtener detalles del insumo: ${insumoError.message}`);

    // Obtener proveedor principal por separado si existe
    let proveedorPrincipal = null;
    if (insumoData.id_proveedor_principal) {
      const { data: provData } = await supabase
        .from('proveedor')
        .select('id_proveedor, nombre_empresa')
        .eq('id_proveedor', insumoData.id_proveedor_principal)
        .single();
      if (provData) {
        proveedorPrincipal = {
          id_proveedor: provData.id_proveedor,
          nombre: provData.nombre_empresa,
          nombre_empresa: provData.nombre_empresa
        };
      }
    }

    // Obtener presentaciones activas (no solo principal)
    let presentacionesData: unknown[] = [];
    try {
      const { data } = await supabase
        .from('insumo_presentacion')
        .select(`
          id_presentacion,
          id_proveedor,
          descripcion_presentacion,
          es_principal,
          activo,
          costo_compra_unitario,
          unidades_por_presentacion
        `)
        .eq('id_insumo', idInsumo)
        .eq('activo', true)
        .order('es_principal', { ascending: false }); // Principales primero
      presentacionesData = data || [];
    } catch (error) {
      console.warn(`Error al obtener presentaciones del insumo ${idInsumo}:`, error);
    }

    // Obtener lotes del insumo
    let lotesData: unknown[] = [];
    try {
      const { data } = await supabase
        .from('lote_insumo')
        .select(`
          id_lote,
          cantidad_inicial,
          cantidad_actual,
          costo_unitario,
          ubicacion,
          fecha_vencimiento
        `)
        .eq('id_insumo', idInsumo);
      lotesData = data || [];
    } catch (error) {
      console.warn(`Error al obtener lotes del insumo ${idInsumo}:`, error);
    }

    // Combinar los datos - mantener estructura compatible con frontend
    const result = {
      ...insumoData,
      // Agregar proveedor principal directamente al objeto insumo
      ...(proveedorPrincipal && { proveedor_principal: proveedorPrincipal }),
      insumo_presentacion: presentacionesData,
      lote_insumo: lotesData
    };

    // Si tenemos presentaciones con proveedor, obtener datos del proveedor para cada una
    if (result.insumo_presentacion && result.insumo_presentacion.length > 0) {
      for (const presentacion of result.insumo_presentacion) {
        if ((presentacion as Record<string, unknown>).id_proveedor) {
          const { data: proveedorData, error: proveedorError } = await supabase
            .from('proveedor')
            .select('id_proveedor, nombre_empresa')
            .eq('id_proveedor', (presentacion as Record<string, unknown>).id_proveedor)
            .single();

          if (!proveedorError && proveedorData) {
            (presentacion as Record<string, unknown>).proveedor = {
              id_proveedor: proveedorData.id_proveedor,
              nombre: proveedorData.nombre_empresa,
              nombre_empresa: proveedorData.nombre_empresa
            };
          }
        }
      }
    }

    return result;
  }

  // ================== RECEPCIONES DE MERCADERÍA ==================

  async getRecepcionesMercaderia() {
    // Primero obtener las recepciones básicas
    const { data: recepciones, error: recepcionesError } = await supabase
      .from('recepcion_mercaderia')
      .select(`
        id_recepcion,
        id_orden,
        fecha_recepcion,
        numero_factura,
        id_perfil
      `)
      .order('fecha_recepcion', { ascending: false });

    if (recepcionesError) {
      throw new Error(`Error al obtener recepciones de mercadería: ${recepcionesError.message}`);
    }

    // Helper para enriquecer detalles con información de insumo
    const enriquecerDetalles = async (detalles: Record<string, unknown>[]) => {
      if (!detalles || detalles.length === 0) return [];
      
      return Promise.all(
        detalles.map(async (det) => {
          let insumoInfo = null;
          const detWithPresentation = det as Record<string, unknown>;
          
          if (typeof detWithPresentation.id_presentacion === 'number' && detWithPresentation.id_presentacion) {
            const { data: presentacion } = await supabase
              .from('insumo_presentacion')
              .select('id_insumo')
              .eq('id_presentacion', detWithPresentation.id_presentacion)
              .single();
            
            if (presentacion && typeof (presentacion as Record<string, unknown>).id_insumo === 'number') {
              const { data: insumo } = await supabase
                .from('insumo')
                .select('id_insumo, nombre_insumo')
                .eq('id_insumo', (presentacion as Record<string, unknown>).id_insumo)
                .single();
              
              insumoInfo = {
                id_insumo: (insumo as Record<string, unknown>)?.id_insumo,
                insumo: {
                  nombre_insumo: (insumo as Record<string, unknown>)?.nombre_insumo
                }
              };
            }
          }
          
          return {
            ...det,
            insumo_presentacion: insumoInfo
          };
        })
      );
    };

    // Para cada recepción, obtener los datos relacionados por separado
    const result = await Promise.all((recepciones || []).map(async (recepcion) => {
      // Obtener perfil de usuario
      const { data: perfil } = await supabase
        .from('perfil_usuario')
        .select('primer_nombre, primer_apellido')
        .eq('id_perfil', recepcion.id_perfil)
        .single();

      // Obtener orden de compra si existe
      let ordenCompra = null;
      if (recepcion.id_orden) {
        // Obtener orden de compra
        const { data: orden, error: ordenError } = await supabase
          .from('orden_compra')
          .select('id_orden, fecha_orden, estado, id_proveedor')
          .eq('id_orden', recepcion.id_orden)
          .single();

        if (ordenError) {
          console.error('Error obteniendo orden de compra:', ordenError);
          ordenCompra = null;
        } else {
          // Obtener proveedor por separado si existe
          let proveedor = null;
          if (orden && typeof (orden as Record<string, unknown>).id_proveedor === 'number') {
            const { data: prov } = await supabase
              .from('proveedor')
              .select('id_proveedor, nombre_empresa')
              .eq('id_proveedor', (orden as Record<string, unknown>).id_proveedor)
              .single();
            proveedor = prov;
          }

          ordenCompra = {
            ...orden,
            numero_orden: `OC-${(orden as Record<string, unknown>).id_orden}`,
            proveedor: proveedor ? {
              id_proveedor: (proveedor as Record<string, unknown>).id_proveedor,
              nombre: (proveedor as Record<string, unknown>).nombre_empresa,
              nombre_empresa: (proveedor as Record<string, unknown>).nombre_empresa
            } : null
          };
        }

        // Obtener detalles de recepción
        const { data: detalles } = await supabase
          .from('detalle_recepcion_mercaderia')
          .select(`
            id_detalle,
            id_recepcion,
            id_detalle_orden,
            cantidad_recibida,
            cantidad_aceptada,
            id_lote,
            id_presentacion
          `)
          .eq('id_recepcion', recepcion.id_recepcion);

        const detallesEnriquecidos = await enriquecerDetalles(detalles || []);

        return {
          ...recepcion,
          numero_orden: recepcion.id_orden ? `OC-${recepcion.id_orden}` : 'Sin orden',
          perfil_usuario: perfil || null,
          orden_compra: ordenCompra,
          detalle_recepcion_mercaderia: detallesEnriquecidos,
          _count: {
            detalle_recepcion_mercaderia: detallesEnriquecidos?.length || 0
          }
        };
      } else {
        // Si no hay orden, obtener detalles de recepción directamente
        const { data: detalles } = await supabase
          .from('detalle_recepcion_mercaderia')
          .select(`
            id_detalle,
            id_recepcion,
            id_detalle_orden,
            cantidad_recibida,
            cantidad_aceptada,
            id_lote,
            id_presentacion
          `)
          .eq('id_recepcion', recepcion.id_recepcion);

        const detallesEnriquecidos = await enriquecerDetalles(detalles || []);

        return {
          ...recepcion,
          numero_orden: 'Sin orden',
          perfil_usuario: perfil || null,
          orden_compra: null,
          detalle_recepcion_mercaderia: detallesEnriquecidos,
          _count: {
            detalle_recepcion_mercaderia: detallesEnriquecidos?.length || 0
          }
        };
      }
    }));

    return result;
  }

  async createRecepcionMercaderia(recepcionData: {
    id_orden: number;
    fecha_recepcion: string;
    id_perfil: number;
    numero_factura?: string;
  }): Promise<{ id_recepcion: number; detalles_creados: number; sincronizacion: RecepcionSincronizacionResumen | null }> {
    console.log('[Backend] Creando recepción de mercadería:', recepcionData);
    
    const { data, error } = await supabase
      .from('recepcion_mercaderia')
      .insert({
        id_orden: recepcionData.id_orden,
        fecha_recepcion: recepcionData.fecha_recepcion,
        id_perfil: recepcionData.id_perfil,
        numero_factura: recepcionData.numero_factura,
      })
      .select('id_recepcion')
      .single();

    if (error) throw new Error(`Error creando recepción: ${error.message}`);
    
    console.log('[Backend] Recepción creada exitosamente:', data);

    let detallesCreados = 0;
    let sincronizacion: RecepcionSincronizacionResumen | null = null;
    try {
      detallesCreados = await this.crearDetallesRecepcionAutomaticos(recepcionData.id_orden, data.id_recepcion);
      if (detallesCreados > 0) {
        sincronizacion = await this.intentarCerrarOrdenCompra(recepcionData.id_orden, data.id_recepcion);
      }
    } catch (syncError) {
      console.error('[Backend] Error sincronizando detalles de recepción automáticos:', syncError);
    }

    await this.registrarResumenRecepcion(recepcionData.id_orden, data.id_recepcion);

    return { id_recepcion: data.id_recepcion, detalles_creados: detallesCreados, sincronizacion };
  }

  async updateRecepcionFactura(idRecepcion: number, numeroFactura: string | null) {
    const { data, error } = await supabase
      .from('recepcion_mercaderia')
      .update({ numero_factura: numeroFactura })
      .eq('id_recepcion', idRecepcion)
      .select(`
        id_recepcion,
        id_orden,
        fecha_recepcion,
        id_perfil,
        numero_factura
      `)
      .single();

    if (error) {
      throw new Error(`Error actualizando número de factura: ${error.message}`);
    }

    return data;
  }

  async createDetalleRecepcionMercaderia(detalleData: {
    id_recepcion: number;
    id_detalle_orden: number;
    cantidad_recibida: number;
    cantidad_aceptada: number;
    id_presentacion: number;
  }): Promise<{ id_detalle: number; sincronizacion: RecepcionSincronizacionResumen | null }> {
    console.log('[Backend] Creando detalle de recepción:', detalleData);
    
    const { data, error } = await supabase
      .from('detalle_recepcion_mercaderia')
      .insert({
        id_recepcion: detalleData.id_recepcion,
        id_detalle_orden: detalleData.id_detalle_orden,
        cantidad_recibida: detalleData.cantidad_recibida,
        cantidad_aceptada: detalleData.cantidad_aceptada,
        id_presentacion: detalleData.id_presentacion,
      })
      .select('id_detalle')
      .single();

    if (error) throw new Error(`Error creando detalle recepción: ${error.message}`);

    console.log('[Backend] Detalle de recepción creado:', data);

    // Después de crear el detalle, verificar si todos los detalles de la OC tienen recepción
    // Si sí, cambiar el estado de la OC a 'recibida' para activar el trigger
    const { data: recepcionData, error: recepcionError } = await supabase
      .from('recepcion_mercaderia')
      .select('id_orden')
      .eq('id_recepcion', detalleData.id_recepcion)
      .single();

    if (recepcionError) {
      console.warn(`[Backend] Advertencia: No se pudo obtener la OC para la recepción ${detalleData.id_recepcion}:`, recepcionError.message);
    } else {
      const id_orden = recepcionData.id_orden;
      console.log('[Backend] Verificando si completar OC:', id_orden);

      try {
        const sincronizacion = await this.intentarCerrarOrdenCompra(id_orden, detalleData.id_recepcion);
        await this.registrarResumenRecepcion(id_orden, detalleData.id_recepcion);
        return {
          id_detalle: data.id_detalle,
          sincronizacion,
        };
      } catch (syncError) {
        console.error('[Backend] Error al intentar cerrar la OC tras crear detalle de recepción:', syncError);
        throw syncError instanceof Error ? syncError : new Error(String(syncError));
      }
    }

    return {
      id_detalle: data.id_detalle,
      sincronizacion: null,
    };
  }

  async deleteRecepcionMercaderia(id: number): Promise<void> {
    const { error: deleteMovimientosError } = await supabase
      .from('movimiento_inventario')
      .delete()
      .eq('id_referencia', id);

    if (deleteMovimientosError) {
      throw new Error(`Error eliminando movimientos de inventario vinculados: ${deleteMovimientosError.message}`);
    }

    const { error: deleteBitacoraError } = await supabase
      .from('bitacora_inventario')
      .delete()
      .ilike('descripcion', `%Recepcion #${id}%`);

    if (deleteBitacoraError) {
      console.warn(`Advertencia eliminando bitácora asociada a recepción ${id}: ${deleteBitacoraError.message}`);
    }

    // Primero eliminar los detalles
    const { error: deleteDetailsError } = await supabase
      .from('detalle_recepcion_mercaderia')
      .delete()
      .eq('id_recepcion', id);

    if (deleteDetailsError) {
      throw new Error(`Error eliminando detalles de recepción: ${deleteDetailsError.message}`);
    }

    // Luego eliminar la recepción
    const { error } = await supabase
      .from('recepcion_mercaderia')
      .delete()
      .eq('id_recepcion', id);

    if (error) {
      throw new Error(`Error eliminando recepción: ${error.message}`);
    }
  }
}

export const inventarioService = new InventarioService();
