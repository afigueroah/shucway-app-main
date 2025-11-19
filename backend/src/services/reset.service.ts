import { supabase } from '../config/database';

export const resetService = {
  async resetVentas() {
    // Eliminar detalles primero
    await supabase.from('detalle_venta').delete().neq('id_detalle_venta', 0);
    // Luego ventas
    await supabase.from('venta').delete().neq('id_venta', 0);
  },

  async resetInventario() {
    // Eliminar movimientos
    await supabase.from('movimiento_inventario').delete().neq('id_movimiento', 0);
    // Eliminar lotes
    await supabase.from('lote_insumo').delete().neq('id_lote', 0);
    // Eliminar presentaciones
    await supabase.from('insumo_presentacion').delete().neq('id_presentacion', 0);
    // Eliminar insumos
    await supabase.from('insumo').delete().neq('id_insumo', 0);
  },

  async resetProductos() {
    // Eliminar detalles de receta
    await supabase.from('receta_detalle').delete().neq('id_receta_detalle', 0);
    // Eliminar variantes
    await supabase.from('producto_variante').delete().neq('id_variante', 0);
    // Eliminar productos
    await supabase.from('producto').delete().neq('id_producto', 0);
    // Eliminar categorías
    await supabase.from('categoria_producto').delete().neq('id_categoria', 0);
  },

  async resetCompras() {
    // Eliminar detalles de recepción
    await supabase.from('detalle_recepcion_mercaderia').delete().neq('id_detalle_recepcion', 0);
    // Eliminar recepciones
    await supabase.from('recepcion_mercaderia').delete().neq('id_recepcion', 0);
    // Eliminar detalles de orden
    await supabase.from('detalle_orden_compra').delete().neq('id_detalle_orden', 0);
    // Eliminar órdenes
    await supabase.from('orden_compra').delete().neq('id_orden_compra', 0);
  },

  async resetClientes() {
    await supabase.from('cliente').delete().neq('id_cliente', 0);
  },

  async resetProveedores() {
    await supabase.from('proveedor').delete().neq('id_proveedor', 0);
  },

  async resetGastos() {
    // Asumiendo tabla gasto_operativo
    await supabase.from('gasto_operativo').delete().neq('id_gasto', 0);
    await supabase.from('categoria_gasto').delete().neq('id_categoria_gasto', 0);
  },

  async resetAll() {
    // Resetear en orden para evitar violaciones de FK
    await this.resetVentas();
    await this.resetInventario();
    await this.resetProductos();
    await this.resetCompras();
    await this.resetClientes();
    await this.resetProveedores();
    await this.resetGastos();
    // Nota: No resetear perfil_usuario ni rol_usuario
  }
};