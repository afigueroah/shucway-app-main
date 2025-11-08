import { supabase } from '../config/database';
import {
  Venta,
  DetalleVenta,
  CreateVentaDTO,
  VentaCompleta,
  ProductoPopular,
} from '../types/ventas.types';
import { cajaService } from './caja.service';

// ================================================================
// 💰 SERVICIO DE VENTAS
// ================================================================

export class VentasService {
  // ================== VENTAS ==================

  /**
   * Obtener todas las ventas con filtros opcionales
   */
  async getVentas(
    estado?: string,
    fechaInicio?: string,
    fechaFin?: string,
    idCajero?: number
  ): Promise<Venta[]> {
    try {
      const normalizeDateParam = (value?: string, endOfDay: boolean = false) => {
        if (!value) return undefined;
        if (value.includes('T')) {
          return endOfDay ? value : value;
        }
        return endOfDay ? `${value}T23:59:59.999` : `${value}T00:00:00.000`;
      };

      const fechaInicioIso = normalizeDateParam(fechaInicio, false);
      const fechaFinIso = normalizeDateParam(fechaFin, true);

      let query = supabase
        .from('venta')
        .select('*')
        .order('fecha_venta', { ascending: false });

      if (estado) {
        query = query.eq('estado', estado);
      }

      if (fechaInicioIso) {
        query = query.gte('fecha_venta', fechaInicioIso);
      }

      if (fechaFinIso) {
        query = query.lte('fecha_venta', fechaFinIso);
      }

      if (idCajero) {
        query = query.eq('id_cajero', idCajero);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error obteniendo ventas:', error);
        throw new Error(`Error al obtener ventas: ${error.message}`);
      }

      const ventas = data || [];

      if (!ventas.length) {
        return ventas;
      }

      const ventaIds = Array.from(new Set(ventas.map((venta) => venta.id_venta)));

      const { data: detalles, error: detallesAggError } = await supabase
        .from('detalle_venta')
        .select('id_venta, cantidad, id_producto, id_variante')
        .in('id_venta', ventaIds);

      if (detallesAggError) {
        console.warn('No se pudieron obtener detalles para resumen de ventas:', detallesAggError.message);
        return ventas;
      }

      const productoIds = new Set<number>();
      const varianteIds = new Set<number>();

      (detalles || []).forEach((detalle) => {
        if (typeof detalle.id_producto === 'number') {
          productoIds.add(detalle.id_producto);
        }
        if (typeof detalle.id_variante === 'number') {
          varianteIds.add(detalle.id_variante);
        }
      });

      const [productosRes, variantesRes] = await Promise.all([
        productoIds.size
          ? supabase
              .from('producto')
              .select('id_producto, nombre_producto')
              .in('id_producto', Array.from(productoIds))
          : Promise.resolve({ data: [], error: null }),
        varianteIds.size
          ? supabase
              .from('producto_variante')
              .select('id_variante, nombre_variante')
              .in('id_variante', Array.from(varianteIds))
          : Promise.resolve({ data: [], error: null }),
      ]);

      const productosMap = new Map<number, string>();
      const variantesMap = new Map<number, string>();

      if (!productosRes.error && productosRes.data) {
        productosRes.data.forEach((producto) => {
          if (typeof producto.id_producto === 'number') {
            productosMap.set(producto.id_producto, producto.nombre_producto ?? `Producto ${producto.id_producto}`);
          }
        });
      }

      if (!variantesRes.error && variantesRes.data) {
        variantesRes.data.forEach((variante) => {
          if (typeof variante.id_variante === 'number') {
            variantesMap.set(variante.id_variante, variante.nombre_variante ?? `Variante ${variante.id_variante}`);
          }
        });
      }

      const grupos = new Map<number, string>();

      (detalles || []).forEach((detalle) => {
        if (typeof detalle.id_venta !== 'number') return;

        const nombreProducto = productosMap.get(detalle.id_producto) ?? 'Producto';
        const nombreVariante =
          typeof detalle.id_variante === 'number' ? variantesMap.get(detalle.id_variante) : undefined;
        const cantidad = Number(detalle.cantidad) || 0;
        const descripcion = `${cantidad} x ${nombreProducto}${nombreVariante ? ` (${nombreVariante})` : ''}`;

        if (grupos.has(detalle.id_venta)) {
          grupos.set(detalle.id_venta, `${grupos.get(detalle.id_venta)} · ${descripcion}`);
        } else {
          grupos.set(detalle.id_venta, descripcion);
        }
      });

      return ventas.map((venta) => ({
        ...venta,
        productos_resumen: grupos.get(venta.id_venta) ?? 'Productos varios',
      }));
    } catch (error) {
      console.error('Error en getVentas:', error);
      throw error;
    }
  }

  /**
   * Obtener venta por ID
   */
  async getVentaById(id: number): Promise<Venta | null> {
    const { data, error } = await supabase
      .from('venta')
      .select('*')
      .eq('id_venta', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Error al obtener venta: ${error.message}`);
    }
    return data;
  }

  /**
   * Obtener venta completa con detalles, cliente y cajero
   */
  async getVentaCompleta(id: number): Promise<VentaCompleta | null> {
    // Obtener venta
    const venta = await this.getVentaById(id);
    if (!venta) return null;

    // Obtener detalles
    const { data: detalles, error: detallesError } = await supabase
      .from('detalle_venta')
      .select('*')
      .eq('id_venta', id);

    if (detallesError) {
      throw new Error(`Error al obtener detalles de venta: ${detallesError.message}`);
    }

    // Obtener cliente si existe
    let cliente = null;
    if (venta.id_cliente) {
      const { data: clienteData, error: clienteError } = await supabase
        .from('cliente')
        .select('*')
        .eq('id_cliente', venta.id_cliente)
        .single();

      if (clienteError && clienteError.code !== 'PGRST116') {
        throw new Error(`Error al obtener cliente: ${clienteError.message}`);
      }
      cliente = clienteData;
    }

    // Obtener cajero si existe
    let cajero: VentaCompleta['cajero'] = undefined;
    if (venta.id_cajero) {
      const { data: cajeroData, error: cajeroError } = await supabase
        .from('perfil_usuario')
        .select(
          'id_perfil, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, username, email'
        )
        .eq('id_perfil', venta.id_cajero)
        .single();

      if (cajeroError && cajeroError.code !== 'PGRST116') {
        throw new Error(`Error al obtener cajero: ${cajeroError.message}`);
      }
      if (cajeroData) {
        const nombrePartes = [
          cajeroData.primer_nombre,
          cajeroData.segundo_nombre,
          cajeroData.primer_apellido,
          cajeroData.segundo_apellido,
        ]
          .map((parte) => (typeof parte === 'string' ? parte.trim() : ''))
          .filter((parte) => parte.length > 0);

        const nombreFormateado =
          (Array.isArray(nombrePartes) && nombrePartes.length > 0
            ? nombrePartes.join(' ')
            : '') ||
          (typeof cajeroData.username === 'string' && cajeroData.username.trim()) ||
          (typeof cajeroData.email === 'string' && cajeroData.email.trim()) ||
          `Cajero #${venta.id_cajero}`;

        cajero = {
          id_perfil: cajeroData.id_perfil,
          nombre: nombreFormateado,
        };
      }
    }

    return {
      ...venta,
      detalles: detalles || [],
      cliente: cliente || undefined,
      cajero,
    };
  }

  /**
   * Crear venta con detalles
   * Esta función crea la venta directamente en estado 'confirmada' para que los triggers PL/pgSQL hagan su trabajo:
   * - fn_descontar_inventario_venta: Descuenta inventario operativo cuando se crea la venta confirmada
   * - fn_acumular_puntos_venta: Se ejecuta automáticamente por trigger al crear la venta confirmada
   */
  async createVenta(dto: CreateVentaDTO, idCajero: number): Promise<VentaCompleta> {
    await cajaService.requireCajaAbierta(idCajero);

    // 1. Crear venta principal directamente en estado 'confirmada'
    const { data: venta, error: ventaError } = await supabase
      .from('venta')
      .insert({
        id_cliente: dto.id_cliente,
        tipo_pago: dto.tipo_pago,
        estado: 'confirmada', // Crear directamente confirmada
        id_cajero: idCajero,
        notas: dto.notas,
      })
      .select()
      .single();

    if (ventaError) throw new Error(`Error al crear venta: ${ventaError.message}`);

    // 2. Crear detalles de venta (triggers calculan precio_unitario, costo_unitario y totales)
    const detallesConVenta = dto.detalles.map((detalle) => ({
      id_venta: venta.id_venta,
      id_producto: detalle.id_producto,
      id_variante: detalle.id_variante,
      cantidad: detalle.cantidad,
      precio_unitario: detalle.precio_unitario,
      costo_unitario: 0, // Se calcula automáticamente por trigger fn_calcular_precio_costo_venta
      descuento: detalle.descuento || 0,
      es_canje_puntos: detalle.es_canje_puntos || false,
      puntos_canjeados: detalle.puntos_canjeados || 0,
    }));

    const { error: detallesError } = await supabase
      .from('detalle_venta')
      .insert(detallesConVenta);

    if (detallesError) {
      // Si falla la inserción de detalles, eliminar la venta
      await supabase.from('venta').delete().eq('id_venta', venta.id_venta);
      throw new Error(`Error al crear detalles de venta: ${detallesError.message}`);
    }

    // 3. La venta ya está confirmada, ejecutar descuento de inventario
    // Esto dispara automáticamente:
    // - fn_descontar_inventario_venta (trigger en PostgreSQL)
    // - fn_acumular_puntos_venta (trigger automático)

    try {
      // Forzar descuento de inventario para asegurar que se ejecute siempre
      console.log(`Ejecutando descuento de inventario para venta ${venta.id_venta}...`);
      const { error: rpcError } = await supabase.rpc('fn_descontar_inventario_venta', {
        p_id_venta: venta.id_venta,
        p_id_perfil: idCajero,
      });

      if (rpcError) {
        console.error('Error ejecutando fn_descontar_inventario_venta:', rpcError.message);
        console.error('Detalles del error:', {
          message: rpcError.message,
          details: rpcError.details,
          hint: rpcError.hint,
          code: rpcError.code
        });
      } else {
        console.log(`Descuento de inventario completado exitosamente para venta ${venta.id_venta}`);
      }
    } catch (fallbackError) {
      console.warn('Error en el proceso de descuento de inventario:', fallbackError);
    }

    // 4. Manejar canje de puntos si existe
    if (dto.puntos_usados && dto.puntos_usados > 0 && dto.id_cliente) {
      const { error: canjeError } = await supabase.rpc('fn_canjear_puntos', {
        p_id_cliente: dto.id_cliente,
        p_id_venta: venta.id_venta,
        p_id_cajero: idCajero,
      });

      if (canjeError) {
        console.error(`Error al canjear puntos: ${canjeError.message}`);
        // No lanzar error, solo log
      }
    }

    // 5. Retornar venta completa
    const ventaCompleta = await this.getVentaCompleta(venta.id_venta);
    if (!ventaCompleta) {
      throw new Error('Error al obtener venta creada');
    }

    return ventaCompleta;
  }

  /**
   * Actualizar estado de venta
   */
  async updateEstadoVenta(
    id: number,
    estado: 'pendiente' | 'confirmada' | 'completada' | 'cancelada'
  ): Promise<Venta> {
    const { data, error } = await supabase
      .from('venta')
      .update({ estado })
      .eq('id_venta', id)
      .select()
      .single();

    if (error) throw new Error(`Error al actualizar estado de venta: ${error.message}`);
    return data;
  }

  /**
   * Cancelar venta
   */
  async cancelarVenta(id: number): Promise<Venta> {
    // Verificar que la venta existe y no está cancelada
    const venta = await this.getVentaById(id);
    if (!venta) {
      throw new Error('Venta no encontrada');
    }

    if (venta.estado === 'cancelada') {
      throw new Error('La venta ya está cancelada');
    }

    // Cambiar estado a cancelada
    return this.updateEstadoVenta(id, 'cancelada');
  }

  /**
   * Eliminar venta (solo si está en estado 'pendiente')
   */
  async deleteVenta(id: number): Promise<void> {
    const venta = await this.getVentaById(id);
    if (!venta) {
      throw new Error('Venta no encontrada');
    }

    if (venta.estado !== 'pendiente') {
      throw new Error('Solo se pueden eliminar ventas en estado pendiente');
    }

    const { error } = await supabase.from('venta').delete().eq('id_venta', id);

    if (error) throw new Error(`Error al eliminar venta: ${error.message}`);
  }

  // ================== DETALLES DE VENTA ==================

  /**
   * Obtener detalles de una venta
   */
  async getDetallesByVenta(idVenta: number): Promise<DetalleVenta[]> {
    const { data, error } = await supabase
      .from('detalle_venta')
      .select('*')
      .eq('id_venta', idVenta);

    if (error) throw new Error(`Error al obtener detalles de venta: ${error.message}`);
    return data || [];
  }

  // ================== REPORTES BÁSICOS ==================

  /**
   * Obtener ventas del día actual
   */
  async getVentasDelDia(idCajero?: number): Promise<Venta[]> {
    const hoy = new Date().toISOString().split('T')[0];
    return this.getVentas('confirmada', hoy, undefined, idCajero);
  }

  /**
   * Obtener total de ventas en un rango de fechas
   */
  async getTotalVentas(fechaInicio: string, fechaFin: string): Promise<number> {
    const { data, error } = await supabase
      .from('venta')
      .select('total_venta')
      .eq('estado', 'confirmada')
      .gte('fecha_venta', fechaInicio)
      .lte('fecha_venta', fechaFin);

    if (error) throw new Error(`Error al obtener total de ventas: ${error.message}`);

    return (data || []).reduce((sum, venta) => sum + (venta.total_venta || 0), 0);
  }

  /**
   * Obtener total de ventas de la sesión (desde fechaInicio hasta ahora)
   */
  async getTotalVentasSesion(fechaInicio: string): Promise<{ efectivo: number; transferencia: number; tarjeta: number; total: number; count: number }> {
    const { data, error } = await supabase
      .from('venta')
      .select('tipo_pago, total_venta')
      .eq('estado', 'confirmada')
      .gte('fecha_venta', fechaInicio);

    if (error) throw new Error(`Error al obtener total de ventas de sesión: ${error.message}`);

    let efectivo = 0;
    let transferencia = 0;
    let tarjeta = 0;
    let total = 0;
    let count = 0;

    (data || []).forEach((venta) => {
      total += venta.total_venta || 0;
      count++;
      if (venta.tipo_pago === 'Cash') {
        efectivo += venta.total_venta || 0;
      } else if (venta.tipo_pago === 'Transferencia') {
        transferencia += venta.total_venta || 0;
      } else if (venta.tipo_pago === 'Tarjeta') {
        tarjeta += venta.total_venta || 0;
      }
    });

    return { efectivo, transferencia, tarjeta, total, count };
  }

  /**
   * Obtener ventas por cajero en un rango de fechas
   */
  async getVentasPorCajero(
    idCajero: number,
    fechaInicio?: string,
    fechaFin?: string
  ): Promise<Venta[]> {
    return this.getVentas('confirmada', fechaInicio, fechaFin, idCajero);
  }

  /**
   * Obtener productos más populares (más vendidos) con fallback a productos recientes
   */
  async getProductosPopulares(limit: number = 5): Promise<ProductoPopular[]> {
    try {
      // Obtener estadísticas reales de productos más vendidos
      const { data: estadisticas, error: statsError } = await supabase
        .from('detalle_venta')
        .select(`
          id_producto,
          cantidad,
          precio_unitario,
          producto:producto(
            nombre_producto,
            imagen_url
          )
        `)
        .not('producto', 'is', null);

      if (statsError) {
        console.warn('Error obteniendo estadísticas de productos, usando fallback:', statsError.message);
        return this.getProductosRecientes(limit);
      }

      // Calcular estadísticas manualmente
      const statsMap = new Map<number, {
        id_producto: number;
        nombre_producto: string;
        total_vendido: number;
        veces_vendido: number;
        categoria: string;
        imagen_url?: string;
      }>();

      interface DetalleConProducto {
        id_producto: number;
        cantidad: number;
        precio_unitario: number;
        producto: {
          nombre_producto: string;
          imagen_url?: string;
        }[];
      }

      (estadisticas as unknown as DetalleConProducto[] || []).forEach((detalle) => {
        const producto = detalle.producto?.[0]; // Tomar el primer elemento del array
        if (!producto) return;

        const id = detalle.id_producto;
        const cantidad = detalle.cantidad || 0;
        const precio = detalle.precio_unitario || 0;

        if (statsMap.has(id)) {
          const existing = statsMap.get(id)!;
          existing.total_vendido += cantidad * precio;
          existing.veces_vendido += cantidad;
        } else {
          statsMap.set(id, {
            id_producto: id,
            nombre_producto: producto.nombre_producto || `Producto ${id}`,
            total_vendido: cantidad * precio,
            veces_vendido: cantidad,
            categoria: 'Producto', // Sin categoría por ahora
            imagen_url: producto.imagen_url,
          });
        }
      });

      // Ordenar por veces vendido (descendente)
      const sortedStats = Array.from(statsMap.values())
        .sort((a, b) => b.veces_vendido - a.veces_vendido);

      // Si tenemos suficientes productos vendidos, devolverlos
      if (sortedStats.length >= limit) {
        return sortedStats.slice(0, limit);
      }

      // Si no tenemos suficientes productos vendidos, combinar con productos recientes
      const productosVendidos = sortedStats;
      const productosRecientes = await this.getProductosRecientes(limit - productosVendidos.length);

      // Combinar y eliminar duplicados
      const combined = [...productosVendidos];
      for (const reciente of productosRecientes) {
        if (!combined.some(p => p.id_producto === reciente.id_producto)) {
          combined.push(reciente);
        }
      }

      return combined.slice(0, limit);
    } catch (error) {
      console.error('Error en getProductosPopulares:', error);
      return this.getProductosRecientes(limit);
    }
  }

  /**
   * Obtener productos más recientes (basados en ventas recientes)
   */
  async getProductosRecientes(limit: number = 5): Promise<ProductoPopular[]> {
    try {
      // Obtener productos vendidos en los últimos 30 días, ordenados por fecha de venta más reciente
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from('detalle_venta')
        .select(`
          id_producto,
          cantidad,
          precio_unitario,
          venta!inner(fecha_venta),
          producto!inner(nombre_producto, imagen_url)
        `)
        .gte('venta.fecha_venta', thirtyDaysAgo.toISOString());

      if (error) {
        console.warn('Error obteniendo productos recientes por ventas, usando fallback:', error.message);
        // Fallback: productos por fecha de creación
        return this.getProductosRecientesFallback(limit);
      }

      // Ordenar los datos por fecha de venta (más reciente primero) antes de procesar
      const sortedData = (data as unknown as DetalleConProducto[] || [])
        .sort((a, b) => new Date(b.venta.fecha_venta).getTime() - new Date(a.venta.fecha_venta).getTime());

      // Agrupar por producto y calcular estadísticas
      const productStats = new Map<number, {
        id_producto: number;
        nombre_producto: string;
        total_vendido: number;
        veces_vendido: number;
        categoria: string;
        imagen_url?: string;
        ultima_venta: string;
      }>();

      interface DetalleConProducto {
        id_producto: number;
        cantidad: number;
        precio_unitario: number;
        venta: {
          fecha_venta: string;
        };
        producto: {
          nombre_producto: string;
          imagen_url?: string;
        };
      }

      sortedData.forEach((detalle) => {
        const producto = detalle.producto;
        const venta = detalle.venta;
        if (!producto || !venta) return;

        const id = detalle.id_producto;
        const cantidad = detalle.cantidad || 0;
        const precio = detalle.precio_unitario || 0;

        if (productStats.has(id)) {
          const existing = productStats.get(id)!;
          existing.total_vendido += cantidad * precio;
          existing.veces_vendido += cantidad;
          // Mantener la fecha de venta más reciente
          if (venta.fecha_venta > existing.ultima_venta) {
            existing.ultima_venta = venta.fecha_venta;
          }
        } else {
          productStats.set(id, {
            id_producto: id,
            nombre_producto: producto.nombre_producto || `Producto ${id}`,
            total_vendido: cantidad * precio,
            veces_vendido: cantidad,
            categoria: 'Producto',
            imagen_url: producto.imagen_url,
            ultima_venta: venta.fecha_venta,
          });
        }
      });

      // Ordenar por fecha de última venta (más reciente primero)
      const sortedProducts = Array.from(productStats.values())
        .sort((a, b) => new Date(b.ultima_venta).getTime() - new Date(a.ultima_venta).getTime());

      return sortedProducts.slice(0, limit);
    } catch (error) {
      console.error('Error en getProductosRecientes:', error);
      return this.getProductosRecientesFallback(limit);
    }
  }

  /**
   * Fallback: Obtener productos por fecha de creación
   */
  private async getProductosRecientesFallback(limit: number): Promise<ProductoPopular[]> {
    const { data, error } = await supabase
      .from('producto')
      .select(`
        id_producto,
        nombre_producto,
        precio_venta,
        imagen_url
      `)
      .eq('estado', 'activo')
      .order('fecha_creacion', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Error al obtener productos recientes: ${error.message}`);

    return (data || []).map((producto) => ({
      id_producto: producto.id_producto,
      nombre_producto: producto.nombre_producto,
      total_vendido: 0,
      veces_vendido: 0,
      categoria: 'Producto',
      imagen_url: producto.imagen_url,
    }));
  }
}

export const ventasService = new VentasService();
