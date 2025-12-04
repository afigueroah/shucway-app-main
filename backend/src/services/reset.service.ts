import { supabase } from '../config/database';

export const resetService = {
  async resetVentas() {
    try {
      console.log('Iniciando reset de ventas...');

      // Eliminar detalles de venta primero (dependen de venta)
      const { error: error1 } = await supabase.from('detalle_venta').delete();
      if (error1) console.error('Error eliminando detalles de venta:', error1);

      // Luego eliminar ventas
      const { error: error2 } = await supabase.from('venta').delete();
      if (error2) console.error('Error eliminando ventas:', error2);

      console.log('Reset de ventas completado');
    } catch (error) {
      console.error('Error general en resetVentas:', error);
      throw error;
    }
  },

  async resetInventario() {
    try {
      console.log('Iniciando reset de inventario...');

      // Primero eliminar registros relacionados en compras que referencian inventario
      const { error: error0 } = await supabase.from('detalle_recepcion_mercaderia').delete().gte('id_detalle', 0);
      if (error0) console.error('Error eliminando detalles de recepción:', error0);

      // Eliminar bitácoras de inventario que referencian insumos
      const { error: error02 } = await supabase.from('bitacora_inventario').delete().gte('id_bitacora_inventario', 0);
      if (error02) console.error('Error eliminando bitácora de inventario:', error02);

      // Eliminar movimientos primero (dependen de insumo)
      const { error: error1 } = await supabase.from('movimiento_inventario').delete().gte('id_movimiento', 0);
      if (error1) console.error('Error eliminando movimientos:', error1);

      // Eliminar lotes (dependen de insumo)
      const { error: error2 } = await supabase.from('lote_insumo').delete().gte('id_lote', 0);
      if (error2) console.error('Error eliminando lotes:', error2);

      // Eliminar presentaciones (dependen de insumo)
      const { error: error3 } = await supabase.from('insumo_presentacion').delete().gte('id_presentacion', 0);
      if (error3) console.error('Error eliminando presentaciones:', error3);

      // Obtener insumos que están referenciados en receta_detalle
      const { data: insumosEnRecetas, error: error4 } = await supabase
        .from('receta_detalle')
        .select('id_insumo')
        .not('id_insumo', 'is', null);
      if (error4) console.error('Error obteniendo insumos en recetas:', error4);

      const insumosIds = [...new Set(insumosEnRecetas?.map(d => d.id_insumo) || [])];
      console.log(`Insumos en recetas: ${insumosIds.length}`);

      // Eliminar insumos que NO estén referenciados en receta_detalle
      let error5;
      if (insumosIds.length > 0) {
        const { error } = await supabase.from('insumo').delete().not('id_insumo', 'in', `(${insumosIds.join(',')})`);
        error5 = error;
      } else {
        const { error } = await supabase.from('insumo').delete().gte('id_insumo', 0);
        error5 = error;
      }
      if (error5) console.error('Error eliminando insumos:', error5);

      // Obtener categorías que tienen insumos
      const { data: categoriasConInsumos, error: error6 } = await supabase
        .from('insumo')
        .select('id_categoria')
        .not('id_categoria', 'is', null);
      if (error6) console.error('Error obteniendo categorías con insumos:', error6);

      const categoriasIds = [...new Set(categoriasConInsumos?.map(d => d.id_categoria) || [])];
      console.log(`Categorías con insumos: ${categoriasIds.length}`);

      // Eliminar categorías que NO tengan insumos
      let error7;
      if (categoriasIds.length > 0) {
        const { error } = await supabase.from('categoria_insumo').delete().not('id_categoria', 'in', `(${categoriasIds.join(',')})`);
        error7 = error;
      } else {
        const { error } = await supabase.from('categoria_insumo').delete().gte('id_categoria', 0);
        error7 = error;
      }
      if (error7) console.error('Error eliminando categorías:', error7);

      console.log('Reset de inventario completado');
    } catch (error) {
      console.error('Error general en resetInventario:', error);
      throw error;
    }
  },

  async resetProductos() {
    try {
      console.log('Iniciando reset de productos...');

      // Eliminar detalles de receta primero (dependen de producto)
      const { error: error1 } = await supabase.from('receta_detalle').delete().gte('id_receta', 0);
      if (error1) console.error('Error eliminando detalles de receta:', error1);

      // Eliminar variantes (dependen de producto)
      const { error: error2 } = await supabase.from('producto_variante').delete().gte('id_variante', 0);
      if (error2) console.error('Error eliminando variantes:', error2);

      // Eliminar detalle_venta (depende de producto)
      const { error: error3 } = await supabase.from('detalle_venta').delete().gte('id_detalle', 0);
      if (error3) console.error('Error eliminando detalle_venta:', error3);

      // Eliminar detalle_compra (detalle_orden_compra)
      const { error: error4 } = await supabase.from('detalle_orden_compra').delete().gte('id_detalle', 0);
      if (error4) console.error('Error eliminando detalle_orden_compra:', error4);

      // Eliminar productos
      const { error: error5 } = await supabase.from('producto').delete().gte('id_producto', 0);
      if (error5) console.error('Error eliminando productos:', error5);

      // Obtener categorías que tienen productos
      const { data: categoriasConProductos, error: error6 } = await supabase
        .from('producto')
        .select('id_categoria')
        .not('id_categoria', 'is', null);
      if (error6) console.error('Error obteniendo categorías con productos:', error6);

      const categoriasIds = [...new Set(categoriasConProductos?.map(d => d.id_categoria) || [])];
      console.log(`Categorías con productos: ${categoriasIds.length}`);

      // Eliminar categorías que NO tengan productos
      let error7;
      if (categoriasIds.length > 0) {
        const { error } = await supabase.from('categoria_producto').delete().not('id_categoria', 'in', `(${categoriasIds.join(',')})`);
        error7 = error;
      } else {
        const { error } = await supabase.from('categoria_producto').delete().gte('id_categoria', 0);
        error7 = error;
      }
      if (error7) console.error('Error eliminando categorías de producto:', error7);

      console.log('Reset de productos completado');
    } catch (error) {
      console.error('Error general en resetProductos:', error);
      throw error;
    }
  },

  async resetCompras() {
    try {
      console.log('Iniciando reset de compras...');

      // Eliminar detalles de recepción primero (dependen de recepcion_mercaderia)
      const { error: error1 } = await supabase.from('detalle_recepcion_mercaderia').delete().gte('id_detalle', 0);
      if (error1) console.error('Error eliminando detalles de recepción:', error1);

      // Eliminar recepciones (dependen de orden_compra)
      const { error: error2 } = await supabase.from('recepcion_mercaderia').delete().gte('id_recepcion', 0);
      if (error2) console.error('Error eliminando recepciones:', error2);

      // Eliminar detalles de orden (dependen de orden_compra)
      const { error: error3 } = await supabase.from('detalle_orden_compra').delete().gte('id_detalle', 0);
      if (error3) console.error('Error eliminando detalles de orden:', error3);

      // Finalmente eliminar órdenes
      const { error: error4 } = await supabase.from('orden_compra').delete().gte('id_orden', 0);
      if (error4) console.error('Error eliminando órdenes:', error4);

      console.log('Reset de compras completado');
    } catch (error) {
      console.error('Error general en resetCompras:', error);
      throw error;
    }
  },

  async resetClientes() {
    try {
      console.log('Iniciando reset de clientes...');

      // Eliminar historial de puntos primero (depende de cliente)
      const { error: error1 } = await supabase.from('historial_puntos').delete().gte('id_historial', 0);
      if (error1) console.error('Error eliminando historial de puntos:', error1);

      // Eliminar detalles de venta (dependen de venta)
      const { error: error2 } = await supabase.from('detalle_venta').delete().gte('id_detalle', 0);
      if (error2) console.error('Error eliminando detalles de venta:', error2);

      // Eliminar ventas (dependen de cliente)
      const { error: error3 } = await supabase.from('venta').delete().gte('id_venta', 0);
      if (error3) console.error('Error eliminando ventas:', error3);

      // Finalmente eliminar clientes
      const { error: error4 } = await supabase.from('cliente').delete().gte('id_cliente', 0);
      if (error4) console.error('Error eliminando clientes:', error4);

      console.log('Reset de clientes completado');
    } catch (error) {
      console.error('Error general en resetClientes:', error);
      throw error;
    }
  },

  async resetProveedores() {
    try {
      console.log('Iniciando reset de proveedores...');

      // Eliminar detalles de recepción primero (dependen de recepcion_mercaderia)
      const { error: error1 } = await supabase.from('detalle_recepcion_mercaderia').delete().gte('id_detalle', 0);
      if (error1) console.error('Error eliminando detalles de recepción:', error1);

      // Eliminar recepciones (dependen de orden_compra)
      const { error: error2 } = await supabase.from('recepcion_mercaderia').delete().gte('id_recepcion', 0);
      if (error2) console.error('Error eliminando recepciones:', error2);

      // Eliminar detalles de orden (dependen de orden_compra)
      const { error: error3 } = await supabase.from('detalle_orden_compra').delete().gte('id_detalle', 0);
      if (error3) console.error('Error eliminando detalles de orden:', error3);

      // Eliminar órdenes de compra (dependen de proveedor)
      const { error: error4 } = await supabase.from('orden_compra').delete().gte('id_orden', 0);
      if (error4) console.error('Error eliminando órdenes de compra:', error4);

      // Obtener proveedores que están referenciados en insumo
      const { data: proveedoresEnInsumos, error: error5 } = await supabase
        .from('insumo')
        .select('id_proveedor_principal')
        .not('id_proveedor_principal', 'is', null);
      if (error5) console.error('Error obteniendo proveedores en insumos:', error5);

      const proveedoresIds = [...new Set(proveedoresEnInsumos?.map(d => d.id_proveedor_principal) || [])];
      console.log(`Proveedores en insumos: ${proveedoresIds.length}`);

      // Eliminar proveedores que NO estén referenciados en insumo
      let error6;
      if (proveedoresIds.length > 0) {
        const { error } = await supabase.from('proveedor').delete().not('id_proveedor', 'in', `(${proveedoresIds.join(',')})`);
        error6 = error;
      } else {
        const { error } = await supabase.from('proveedor').delete().gte('id_proveedor', 0);
        error6 = error;
      }
      if (error6) console.error('Error eliminando proveedores:', error6);

      console.log('Reset de proveedores completado');
    } catch (error) {
      console.error('Error general en resetProveedores:', error);
      throw error;
    }
  },

  async resetGastos() {
    try {
      console.log('Iniciando reset de gastos...');

      // Eliminar gastos operativos primero (dependen de categoria_gasto)
      const { error: error1 } = await supabase.from('gasto_operativo').delete().gte('id_gasto', 0);
      if (error1) console.error('Error eliminando gastos operativos:', error1);

      // Luego eliminar categorías
      const { error: error2 } = await supabase.from('categoria_gasto').delete().gte('id_categoria', 0);
      if (error2) console.error('Error eliminando categorías de gasto:', error2);

      console.log('Reset de gastos completado');
    } catch (error) {
      console.error('Error general en resetGastos:', error);
      throw error;
    }
  },

  async resetArqueos() {
    try {
      console.log('Iniciando reset de arqueos...');

      // Eliminar arqueos de caja
      const { error: error1 } = await supabase.from('arqueo_caja').delete().gte('id_arqueo', 0);
      if (error1) console.error('Error eliminando arqueos de caja:', error1);

      console.log('Reset de arqueos completado');
    } catch (error) {
      console.error('Error general en resetArqueos:', error);
      throw error;
    }
  },

  async resetAuditorias() {
    try {
      console.log('Iniciando reset de auditorías...');

      // Eliminar detalles de auditoría primero (dependen de auditoria_inventario)
      const { error: error1 } = await supabase.from('auditoria_detalle').delete().gte('id_detalle', 0);
      if (error1) console.error('Error eliminando detalles de auditoría:', error1);

      // Eliminar bitácora de auditoría (depende de auditoria_inventario)
      const { error: error2 } = await supabase.from('bitacora_auditoria').delete().gte('id_bitacora', 0);
      if (error2) console.error('Error eliminando bitácora de auditoría:', error2);

      // Eliminar auditorías de inventario
      const { error: error3 } = await supabase.from('auditoria_inventario').delete().gte('id_auditoria', 0);
      if (error3) console.error('Error eliminando auditorías de inventario:', error3);

      // Eliminar otras bitácoras
      const { error: error4 } = await supabase.from('bitacora_inventario').delete().gte('id_bitacora_inventario', 0);
      if (error4) console.error('Error eliminando bitácora de inventario:', error4);

      const { error: error5 } = await supabase.from('bitacora_ventas').delete().gte('id_bitacora_venta', 0);
      if (error5) console.error('Error eliminando bitácora de ventas:', error5);

      const { error: error6 } = await supabase.from('bitacora_ordenes_compra').delete().gte('id_bitacora_orden', 0);
      if (error6) console.error('Error eliminando bitácora de órdenes de compra:', error6);

      const { error: error7 } = await supabase.from('bitacora_productos').delete().gte('id_bitacora_producto', 0);
      if (error7) console.error('Error eliminando bitácora de productos:', error7);

      const { error: error8 } = await supabase.from('bitacora_seguridad').delete().gte('id_bitacora_seguridad', 0);
      if (error8) console.error('Error eliminando bitácora de seguridad:', error8);

      console.log('Reset de auditorías completado');
    } catch (error) {
      console.error('Error general en resetAuditorias:', error);
      throw error;
    }
  },

  async resetAll() {
    try {
      console.log('Iniciando limpieza total...');

      // Resetear en orden para evitar violaciones de FK
      console.log('Ejecutando resetVentas...');
      await this.resetVentas();
      console.log('resetVentas completado');

      console.log('Ejecutando resetInventario...');
      await this.resetInventario();
      console.log('resetInventario completado');

      console.log('Ejecutando resetProductos...');
      await this.resetProductos();
      console.log('resetProductos completado');

      console.log('Ejecutando resetCompras...');
      await this.resetCompras();
      console.log('resetCompras completado');

      console.log('Ejecutando resetClientes...');
      await this.resetClientes();
      console.log('resetClientes completado');

      console.log('Ejecutando resetProveedores...');
      await this.resetProveedores();
      console.log('resetProveedores completado');

      console.log('Ejecutando resetGastos...');
      await this.resetGastos();
      console.log('resetGastos completado');

      console.log('Ejecutando resetArqueos...');
      await this.resetArqueos();
      console.log('resetArqueos completado');

      // Reset de auditorías pero PRESERVANDO bitacora_seguridad
      console.log('Iniciando reset de auditorías (preservando bitacora_seguridad)...');

      // Eliminar detalles de auditoría primero (dependen de auditoria_inventario)
      console.log('Eliminando auditoria_detalle...');
      const { error: error1 } = await supabase.from('auditoria_detalle').delete().gte('id_detalle', 0);
      if (error1) console.error('Error eliminando detalles de auditoría:', error1);

      // Eliminar bitácora de auditoría (depende de auditoria_inventario)
      console.log('Eliminando bitacora_auditoria...');
      const { error: error2 } = await supabase.from('bitacora_auditoria').delete().gte('id_bitacora', 0);
      if (error2) console.error('Error eliminando bitácora de auditoría:', error2);

      // Eliminar auditorías de inventario
      console.log('Eliminando auditoria_inventario...');
      const { error: error3 } = await supabase.from('auditoria_inventario').delete().gte('id_auditoria', 0);
      if (error3) console.error('Error eliminando auditorías de inventario:', error3);

      // Eliminar otras bitácoras OPERATIVAS (pero NO bitacora_seguridad)
      console.log('Eliminando bitacora_inventario...');
      const { error: error4 } = await supabase.from('bitacora_inventario').delete().gte('id_bitacora_inventario', 0);
      if (error4) console.error('Error eliminando bitácora de inventario:', error4);

      console.log('Eliminando bitacora_ventas...');
      const { error: error5 } = await supabase.from('bitacora_ventas').delete().gte('id_bitacora_venta', 0);
      if (error5) console.error('Error eliminando bitácora de ventas:', error5);

      console.log('Eliminando bitacora_ordenes_compra...');
      const { error: error6 } = await supabase.from('bitacora_ordenes_compra').delete().gte('id_bitacora_orden', 0);
      if (error6) console.error('Error eliminando bitácora de órdenes de compra:', error6);

      console.log('Eliminando bitacora_productos...');
      const { error: error7 } = await supabase.from('bitacora_productos').delete().gte('id_bitacora_producto', 0);
      if (error7) console.error('Error eliminando bitácora de productos:', error7);

      // Eliminar bitácora de insumo
      console.log('Eliminando bitacora_insumo...');
      const { error: error9 } = await supabase.from('bitacora_insumo').delete().gte('id_bitacora_insumo', 0);
      if (error9) console.error('Error eliminando bitácora de insumo:', error9);

      // Eliminar depósitos bancarios y sesiones de caja
      console.log('Eliminando deposito_banco...');
      const { error: error10 } = await supabase.from('deposito_banco').delete().gte('id_deposito', 0);
      if (error10) console.error('Error eliminando depósitos bancarios:', error10);

      console.log('Eliminando caja_sesion...');
      const { error: error11 } = await supabase.from('caja_sesion').delete().gte('id_sesion', 0);
      if (error11) console.error('Error eliminando sesiones de caja:', error11);
      // NOTA: bitacora_seguridad NO se elimina en limpieza total

      console.log('Limpieza total completada (preservando rol_usuario, perfil_usuario y bitacora_seguridad)');
    } catch (error) {
      console.error('Error general en resetAll:', error);
      throw error;
    }
  }
};