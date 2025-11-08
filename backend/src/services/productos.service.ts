import { supabase } from '../config/database';
import {
  Producto,
  CategoriaProducto,
  ProductoVariante,
  RecetaDetalle,
  CreateProductoDTO,
  UpdateProductoDTO,
  CreateVarianteDTO,
  CreateRecetaDTO,
  ProductoConReceta,
} from '../types/productos.types';

// ================================================================
// 🍔 SERVICIO DE PRODUCTOS
// ================================================================

export class ProductosService {
  // ================== CATEGORÍAS ==================

  async getCategorias(): Promise<CategoriaProducto[]> {
    const { data, error } = await supabase
      .from('categoria_producto')
      .select('*')
      .eq('estado', 'activo')
      .order('nombre_categoria');

    if (error) throw new Error(`Error al obtener categorías: ${error.message}`);
    return data || [];
  }

  async getCategoriaById(id: number): Promise<CategoriaProducto | null> {
    const { data, error } = await supabase
      .from('categoria_producto')
      .select('*')
      .eq('id_categoria', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Error al obtener categoría: ${error.message}`);
    }
    return data;
  }

  async createCategoria(
    nombre: string,
    descripcion?: string
  ): Promise<CategoriaProducto> {
    const { data, error } = await supabase
      .from('categoria_producto')
      .insert({ nombre_categoria: nombre, descripcion })
      .select()
      .single();

    if (error) throw new Error(`Error al crear categoría: ${error.message}`);
    return data;
  }

  // ================== PRODUCTOS ==================

  async getProductos(activos?: boolean): Promise<Producto[]> {
    let query = supabase
      .from('producto')
      .select('*')
      .order('nombre_producto');

    if (activos !== undefined) {
      query = query.eq('estado', activos ? 'activo' : 'desactivado');
    }

    const { data, error } = await query;

    if (error) throw new Error(`Error al obtener productos: ${error.message}`);
    return data || [];
  }

  async getProductoById(id: number): Promise<Producto | null> {
    const { data, error } = await supabase
      .from('producto')
      .select('*')
      .eq('id_producto', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Error al obtener producto: ${error.message}`);
    }
    return data;
  }

  async getProductoConReceta(id: number): Promise<ProductoConReceta | null> {
    // Obtener producto
    const producto = await this.getProductoById(id);
    if (!producto) return null;

    // Obtener receta
    const { data: receta, error: recetaError } = await supabase
      .from('receta_detalle')
      .select('*')
      .eq('id_producto', id);

    if (recetaError) {
      throw new Error(`Error al obtener receta: ${recetaError.message}`);
    }

    // Obtener variantes
    const { data: variantes, error: variantesError } = await supabase
      .from('producto_variante')
      .select('*')
      .eq('id_producto', id);

    if (variantesError) {
      throw new Error(`Error al obtener variantes: ${variantesError.message}`);
    }

    return {
      ...producto,
      receta: receta || [],
      variantes: variantes || [],
    };
  }

  async createProducto(dto: CreateProductoDTO): Promise<ProductoConReceta | Producto> {
    const { variantes, receta, ...productoDto } = dto;

    const payload = {
      nombre_producto: productoDto.nombre_producto,
      descripcion: productoDto.descripcion,
      precio_venta: productoDto.precio_venta,
      costo_producto: productoDto.costo_producto || 0,
      id_categoria: productoDto.id_categoria,
      imagen_url: productoDto.imagen_url,
      estado: productoDto.estado ?? 'activo',
    };

    const insertProducto = async (overrideId?: number) => {
      const record = overrideId != null ? { id_producto: overrideId, ...payload } : payload;
      return supabase.from('producto').insert(record).select().single();
    };

    let { data, error } = await insertProducto();

    if (error && error.message?.includes('duplicate key value')) {
      const { data: maxRows, error: maxError } = await supabase
        .from('producto')
        .select('id_producto')
        .order('id_producto', { ascending: false })
        .limit(1);

      if (maxError) {
        throw new Error(`Error al sincronizar secuencia de productos: ${maxError.message}`);
      }

      const maxId = Array.isArray(maxRows) && maxRows.length > 0 ? maxRows[0].id_producto : 0;
      const nextId = (maxId || 0) + 1;
      const retry = await insertProducto(nextId);
      data = retry.data;
      error = retry.error;
    }

    if (error || !data) {
      throw new Error(`Error al crear producto: ${error?.message ?? 'sin datos devueltos'}`);
    }

    const productoCreado = data as Producto;
    const productoId = productoCreado.id_producto;

    if (Array.isArray(variantes)) {
      // Obtener el último id_variante para asignar IDs explícitos
      const { data: maxVariante } = await supabase
        .from('producto_variante')
        .select('id_variante')
        .order('id_variante', { ascending: false })
        .limit(1)
        .single();

      let nextVarianteId = (maxVariante?.id_variante ?? 0) + 1;

      const variantesPayload = variantes.map((variant) => ({
        id_variante: nextVarianteId++,
        id_producto: productoId,
        id_insumo: variant.id_insumo ?? null,
        nombre_variante: variant.nombre_variante,
        precio_variante: variant.precio_variante,
        costo_variante: variant.costo_variante ?? null,
        estado: variant.estado ?? 'activo',
      }));

      if (variantesPayload.length > 0) {
        const { error: variantesError } = await supabase
          .from('producto_variante')
          .insert(variantesPayload);

        if (variantesError) {
          throw new Error(`Error al crear variantes: ${variantesError.message}`);
        }
      }
    }

    if (Array.isArray(receta)) {
      const recetaPayload = receta.map((linea) => ({
        id_variante: linea.id_variante ?? null,
        id_insumo: linea.id_insumo,
        cantidad_requerida: linea.cantidad_requerida,
        unidad_base: linea.unidad_base,
        es_obligatorio: linea.es_obligatorio ?? true,
      }));

      await this.insertRecetaDetalles(productoId, recetaPayload);
    }

    return (await this.getProductoConReceta(productoId)) ?? productoCreado;
  }

  async updateProducto(id: number, dto: UpdateProductoDTO): Promise<ProductoConReceta | Producto> {
    const { variantes, receta, ...productoDto } = dto;

    let productoActualizado: Producto | null = null;

    if (Object.keys(productoDto).length > 0) {
      const { data, error } = await supabase
        .from('producto')
        .update(productoDto)
        .eq('id_producto', id)
        .select()
        .single();

      if (error) {
        throw new Error(`Error al actualizar producto: ${error.message}`);
      }
      productoActualizado = data as Producto;
    }

    if (Array.isArray(variantes)) {
      const { error: deleteError } = await supabase
        .from('producto_variante')
        .delete()
        .eq('id_producto', id);

      if (deleteError) {
        throw new Error(`Error al limpiar variantes: ${deleteError.message}`);
      }

      if (variantes.length > 0) {
        // Obtener el último id_variante para asignar IDs explícitos
        const { data: maxVariante } = await supabase
          .from('producto_variante')
          .select('id_variante')
          .order('id_variante', { ascending: false })
          .limit(1)
          .single();

        let nextVarianteId = (maxVariante?.id_variante ?? 0) + 1;

        const variantesPayload = variantes.map((variant) => ({
          id_variante: nextVarianteId++,
          id_producto: id,
          id_insumo: variant.id_insumo ?? null,
          nombre_variante: variant.nombre_variante,
          precio_variante: variant.precio_variante,
          costo_variante: variant.costo_variante ?? null,
          estado: variant.estado ?? 'activo',
        }));

        const { error: insertVarianteError } = await supabase
          .from('producto_variante')
          .insert(variantesPayload);

        if (insertVarianteError) {
          throw new Error(`Error al registrar variantes: ${insertVarianteError.message}`);
        }
      }
    }

    if (Array.isArray(receta)) {
      const { error: deleteRecetaError } = await supabase
        .from('receta_detalle')
        .delete()
        .eq('id_producto', id);

      if (deleteRecetaError) {
        throw new Error(`Error al limpiar receta: ${deleteRecetaError.message}`);
      }

      if (receta.length > 0) {
        const recetaPayload = receta.map((linea) => ({
          id_variante: linea.id_variante ?? null,
          id_insumo: linea.id_insumo,
          cantidad_requerida: linea.cantidad_requerida,
          unidad_base: linea.unidad_base,
          es_obligatorio: linea.es_obligatorio ?? true,
        }));

        await this.insertRecetaDetalles(id, recetaPayload);
      }
    }

    const productoConReceta = await this.getProductoConReceta(id);
    if (productoConReceta) {
      return productoConReceta;
    }

    if (productoActualizado) {
      return productoActualizado;
    }

    const fallback = await this.getProductoById(id);
    if (!fallback) {
      throw new Error('Producto no encontrado después de actualizar.');
    }

    return fallback;
  }

  async deleteProducto(id: number): Promise<void> {
    const { error } = await supabase
      .from('producto')
      .delete()
      .eq('id_producto', id);

    if (error) throw new Error(`Error al eliminar producto: ${error.message}`);
  }

  private async insertRecetaDetalles(
    productoId: number,
    detalles: Array<Omit<CreateRecetaDTO, 'id_producto'>>
  ): Promise<void> {
    if (!detalles.length) {
      return;
    }

    const { data: maxRows, error: maxError } = await supabase
      .from('receta_detalle')
      .select('id_receta')
      .order('id_receta', { ascending: false })
      .limit(1);

    if (maxError) {
      throw new Error(`Error al sincronizar secuencia de recetas: ${maxError.message}`);
    }

    let nextId = (Array.isArray(maxRows) && maxRows.length > 0 ? maxRows[0].id_receta : 0) + 1;

    const payloadWithIds = detalles.map((detalle) => ({
      id_receta: nextId++,
      id_producto: productoId,
      id_variante: detalle.id_variante ?? null,
      id_insumo: detalle.id_insumo,
      cantidad_requerida: detalle.cantidad_requerida,
      unidad_base: detalle.unidad_base,
      es_obligatorio: detalle.es_obligatorio ?? true,
    }));

    const { error: insertError } = await supabase.from('receta_detalle').insert(payloadWithIds);

    if (insertError) {
      throw new Error(`Error al registrar receta: ${insertError.message}`);
    }
  }

  // ================== VARIANTES ==================

  async getVariantesByProducto(idProducto: number): Promise<ProductoVariante[]> {
    const { data, error } = await supabase
      .from('producto_variante')
      .select('*')
      .eq('id_producto', idProducto);

    if (error) throw new Error(`Error al obtener variantes: ${error.message}`);
    return data || [];
  }

  async createVariante(dto: CreateVarianteDTO): Promise<ProductoVariante> {
    const { data, error } = await supabase
      .from('producto_variante')
      .insert(dto)
      .select()
      .single();

    if (error) throw new Error(`Error al crear variante: ${error.message}`);
    return data;
  }

  async deleteVariante(id: number): Promise<void> {
    const { error } = await supabase
      .from('producto_variante')
      .delete()
      .eq('id_variante', id);

    if (error) throw new Error(`Error al eliminar variante: ${error.message}`);
  }

  // ================== RECETAS ==================

  async getRecetaByProducto(idProducto: number): Promise<RecetaDetalle[]> {
    const { data, error } = await supabase
      .from('receta_detalle')
      .select('*')
      .eq('id_producto', idProducto);

    if (error) throw new Error(`Error al obtener receta: ${error.message}`);
    return data || [];
  }

  async createRecetaDetalle(dto: CreateRecetaDTO): Promise<RecetaDetalle> {
    const { data, error } = await supabase
      .from('receta_detalle')
      .insert(dto)
      .select()
      .single();

    if (error) throw new Error(`Error al crear detalle de receta: ${error.message}`);
    return data;
  }

  async deleteRecetaDetalle(id: number): Promise<void> {
    const { error } = await supabase
      .from('receta_detalle')
      .delete()
      .eq('id_receta', id);

    if (error) throw new Error(`Error al eliminar detalle de receta: ${error.message}`);
  }
}

export const productosService = new ProductosService();
