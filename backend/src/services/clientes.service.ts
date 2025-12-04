import { supabase } from '../config/database';
import { Cliente, CreateClienteDTO, UpdateClienteDTO, CanjearPuntosDTO, GestionarPuntosDTO } from '../types/ventas.types';

// ================================================================
// 👥 SERVICIO DE CLIENTES
// ================================================================

export class ClientesService {
  // ================== CLIENTES ==================

  async getClientes(): Promise<Cliente[]> {
    const { data, error } = await supabase
      .from('cliente')
      .select('*')
      .order('nombre');

    if (error) throw new Error(`Error al obtener clientes: ${error.message}`);

    // Para cada cliente, verificar si tiene transferencias pendientes
    const clientesConDeudas = await Promise.all(
      (data || []).map(async (cliente) => {
        const transferenciasPendientes = await this.getTransferenciasPendientes(cliente.id_cliente);
        return {
          ...cliente,
          tiene_transferencias_pendientes: transferenciasPendientes.length > 0,
          cantidad_transferencias_pendientes: transferenciasPendientes.length,
        };
      })
    );

    return clientesConDeudas;
  }

  async getClienteById(id: number): Promise<Cliente | null> {
    const { data, error } = await supabase
      .from('cliente')
      .select('*')
      .eq('id_cliente', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Error al obtener cliente: ${error.message}`);
    }
    return data;
  }

  async buscarClientePorTelefono(telefono: string): Promise<Cliente | null> {
    const { data, error } = await supabase
      .from('cliente')
      .select('*')
      .eq('telefono', telefono)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Error al buscar cliente: ${error.message}`);
    }
    return data;
  }

  async createCliente(dto: CreateClienteDTO): Promise<Cliente> {
    console.log('📝 Datos del cliente a crear:', dto);

    // Validar que el teléfono sea único si se proporciona
    if (dto.telefono && dto.telefono.trim()) {
      const clienteExistente = await this.buscarClientePorTelefono(dto.telefono.trim());
      if (clienteExistente) {
        throw new Error(`Ya existe un cliente con el teléfono ${dto.telefono}`);
      }
    }

    const { data, error } = await supabase
      .from('cliente')
      .insert(dto)
      .select()
      .single();

    if (error) {
      console.error('❌ Error de Supabase:', error);
      throw new Error(`Error al crear cliente: ${error.message}`);
    }

    console.log('✅ Cliente creado exitosamente:', data);
    return data;
  }

  async updateCliente(id: number, dto: UpdateClienteDTO): Promise<Cliente> {
    const { data, error } = await supabase
      .from('cliente')
      .update(dto)
      .eq('id_cliente', id)
      .select()
      .single();

    if (error) throw new Error(`Error al actualizar cliente: ${error.message}`);
    return data;
  }

  async deleteCliente(id: number): Promise<void> {
    const { error } = await supabase
      .from('cliente')
      .delete()
      .eq('id_cliente', id);

    if (error) throw new Error(`Error al eliminar cliente: ${error.message}`);
  }

  // ================== PUNTOS ==================

  /**
   * Consultar puntos de cliente usando función PL/pgSQL fn_consultar_puntos
   */
  async consultarPuntos(idCliente: number): Promise<number> {
    const { data, error } = await supabase.rpc('fn_consultar_puntos', {
      p_id_cliente: idCliente,
    });

    if (error) throw new Error(`Error al consultar puntos: ${error.message}`);
    return data || 0;
  }

  /**
   * Gestionar puntos (agregar/restar) manualmente
   */
  async gestionarPuntos(idCliente: number, dto: GestionarPuntosDTO): Promise<{ puntos_anteriores: number; puntos_nuevos: number }> {
    // Primero obtener los puntos actuales
    const puntosActuales = await this.consultarPuntos(idCliente);

    // Calcular los puntos nuevos
    const puntosNuevos = dto.operacion === 'agregar'
      ? puntosActuales + dto.cantidad
      : Math.max(0, puntosActuales - dto.cantidad); // No permitir puntos negativos

    // Actualizar los puntos en la base de datos
    const { error: updateError } = await supabase
      .from('cliente')
      .update({ puntos_acumulados: puntosNuevos })
      .eq('id_cliente', idCliente);

    if (updateError) {
      throw new Error(`Error al actualizar puntos: ${updateError.message}`);
    }

    // Registrar en el historial de puntos
    const { error: historialError } = await supabase
      .from('historial_puntos')
      .insert({
        id_cliente: idCliente,
        tipo_movimiento: dto.operacion === 'agregar' ? 'acumulacion' : 'ajuste',
        puntos: dto.cantidad,
        descripcion: dto.motivo || `Puntos ${dto.operacion === 'agregar' ? 'agregados' : 'restados'} manualmente`,
        puntos_anterior: puntosActuales,
        puntos_movimiento: dto.operacion === 'agregar' ? dto.cantidad : -dto.cantidad,
        puntos_nuevo: puntosNuevos,
        fecha_movimiento: new Date().toISOString(),
      });

    if (historialError) {
      console.warn('Error al registrar en historial de puntos:', historialError);
      // No lanzamos error aquí para no fallar la operación principal
    }

    return {
      puntos_anteriores: puntosActuales,
      puntos_nuevos: puntosNuevos,
    };
  }

  /**
   * Canjear puntos usando función PL/pgSQL fn_canjear_puntos
   */
  async canjearPuntos(dto: CanjearPuntosDTO): Promise<void> {
    const { error } = await supabase.rpc('fn_canjear_puntos', {
      p_id_cliente: dto.id_cliente,
      p_puntos: dto.puntos_a_canjear,
      p_descripcion: dto.descripcion || 'Canje de puntos',
    });

    if (error) throw new Error(`Error al canjear puntos: ${error.message}`);
  }

  /**
   * Obtener historial de puntos
   */
  async getHistorialPuntos(idCliente: number): Promise<unknown[]> {
    const { data, error } = await supabase
      .from('historial_puntos')
      .select('*')
      .eq('id_cliente', idCliente)
      .order('fecha_movimiento', { ascending: false });

    if (error) throw new Error(`Error al obtener historial de puntos: ${error.message}`);
    return data || [];
  }

  /**
   * Obtener transferencias pendientes de un cliente
   */
  async getTransferenciasPendientes(idCliente: number): Promise<any[]> {
    const { data, error } = await supabase
      .from('venta')
      .select(`
        id_venta,
        fecha_venta,
        total_venta,
        estado_transferencia,
        numero_referencia,
        nombre_banco
      `)
      .eq('id_cliente', idCliente)
      .eq('tipo_pago', 'Transferencia')
      .eq('estado_transferencia', 'esperando')
      .order('fecha_venta', { ascending: false });

    if (error) throw new Error(`Error al obtener transferencias pendientes: ${error.message}`);
    return data || [];
  }

  /**
   * Marcar una transferencia como pagada
   */
  async marcarTransferenciaPagada(idVenta: number): Promise<void> {
    // Primero obtener los datos de la venta
    const { data: venta, error: ventaError } = await supabase
      .from('venta')
      .select('id_cliente, total_venta, numero_referencia, nombre_banco, id_cajero')
      .eq('id_venta', idVenta)
      .eq('tipo_pago', 'Transferencia')
      .eq('estado_transferencia', 'esperando')
      .single();

    if (ventaError || !venta) {
      throw new Error(`Error al obtener datos de la venta: ${ventaError?.message || 'Venta no encontrada'}`);
    }

    // Actualizar el estado de la transferencia
    const { error: updateError } = await supabase
      .from('venta')
      .update({ estado_transferencia: 'recibido' })
      .eq('id_venta', idVenta);

    if (updateError) {
      throw new Error(`Error al actualizar estado de transferencia: ${updateError.message}`);
    }

    // Insertar en deposito_banco
    const { error: depositoError } = await supabase
      .from('deposito_banco')
      .insert({
        descripcion: `Pago por venta #${idVenta}`,
        tipo_pago: 'Transferencia',
        monto: venta.total_venta,
        id_perfil: venta.id_cajero,
        numero_referencia: venta.numero_referencia,
        nombre_banco: venta.nombre_banco,
        nombre_cliente: 'Cliente pendiente' // Se puede mejorar para obtener el nombre real
      });

    if (depositoError) {
      console.error(`Error al insertar depósito bancario: ${depositoError.message}`);
      // No lanzamos error aquí para no revertir el cambio de estado
    }
  }
  async getProductoFavorito(idCliente: number): Promise<{ producto: string; cantidad: number } | null> {
    // First get venta ids for the client
    const { data: ventas, error: errorVentas } = await supabase
      .from('venta')
      .select('id_venta')
      .eq('id_cliente', idCliente);

    if (errorVentas) throw new Error(`Error al obtener ventas del cliente: ${errorVentas.message}`);

    if (!ventas || ventas.length === 0) return null;

    const ventaIds = ventas.map(v => v.id_venta);

    // Then get detalles for those ventas with product names
    const { data: detalles, error } = await supabase
      .from('detalle_venta')
      .select(`
        cantidad,
        id_producto
      `)
      .in('id_venta', ventaIds);

    if (error) throw new Error(`Error al obtener detalles de venta: ${error.message}`);

    if (detalles && detalles.length > 0) {
      // Get unique product IDs
      const productIds = [...new Set(detalles.map(d => d.id_producto))];

      // Get product names
      const { data: productos, error: errorProductos } = await supabase
        .from('producto')
        .select('id_producto, nombre')
        .in('id_producto', productIds);

      if (errorProductos) throw new Error(`Error al obtener productos: ${errorProductos.message}`);

      // Create a map of product ID to name
      const productMap: { [key: number]: string } = {};
      productos?.forEach(p => {
        productMap[p.id_producto] = p.nombre;
      });

      // Count products
      const productCounts: { [key: string]: number } = {};
      detalles.forEach((item: any) => {
        const productName = productMap[item.id_producto];
        if (productName) {
          productCounts[productName] = (productCounts[productName] || 0) + item.cantidad;
        }
      });

      const favorite = Object.entries(productCounts).reduce((max, [name, count]) =>
        count > max.cantidad ? { producto: name, cantidad: count } : max,
        { producto: '', cantidad: 0 }
      );

      return favorite.producto ? favorite : null;
    }

    return null;
  }
}

export const clientesService = new ClientesService();
