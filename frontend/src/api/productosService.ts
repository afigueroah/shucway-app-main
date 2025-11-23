// ================================================================
// 🍔 SERVICIO DE PRODUCTOS
// ================================================================

import apiClient from "./apiClient";

// Interfaces basadas en el backend
export interface CategoriaProducto {
  id_categoria: number;
  nombre_categoria: string;
  descripcion?: string;
  estado: 'activo' | 'desactivado';
}

export interface Producto {
  id_producto: number;
  nombre_producto: string;
  descripcion?: string;
  precio_venta: number;
  costo_producto: number;
  id_categoria?: number;
  estado: 'activo' | 'desactivado';
  imagen_url?: string;
  fecha_creacion: Date;
  categoria?: CategoriaProducto;
  variantes?: ProductoVariante[];
}

export interface ProductoVariante {
  id_variante: number;
  id_producto: number;
  id_insumo?: number;  // Insumo asociado a esta variante (opcional)
  nombre_variante: string;
  precio_variante?: number;
  costo_variante?: number;
  cantidad_insumo?: number;  // Cantidad del insumo a descontar
  estado: 'activo' | 'desactivado';
}

export interface RecetaDetalle {
  id_receta: number;
  id_producto: number;
  id_variante?: number | null;
  id_insumo: number;
  cantidad_requerida: number;
  unidad_base: string;
  // es_obligatorio removed from API surface - recipe lines are NOT obligatory by default
}

export interface ProductoConReceta extends Producto {
  receta: RecetaDetalle[];
  variantes?: ProductoVariante[];
}

export const productosService = {
  // ================== CATEGORÍAS ==================

  // Obtener todas las categorías
  async getCategorias(): Promise<CategoriaProducto[]> {
    try {
      const response = await apiClient.get('/productos/categorias');
      return response.data.data;
    } catch (error) {
      console.error('Error obteniendo categorías:', error);
      throw error;
    }
  },

  // ================== PRODUCTOS ==================

  // Obtener todos los productos
  async getProductos(activos?: boolean): Promise<Producto[]> {
    try {
      const params = activos !== undefined ? `?activos=${activos}` : '';
      const response = await apiClient.get(`/productos${params}`);
      return response.data.data;
    } catch (error) {
      console.error('Error obteniendo productos:', error);
      throw error;
    }
  },

  // Obtener producto por ID
  async getProductoById(id: number): Promise<Producto> {
    try {
      const response = await apiClient.get(`/productos/${id}`);
      return response.data.data;
    } catch (error) {
      console.error('Error obteniendo producto:', error);
      throw error;
    }
  },

  // Obtener producto con receta
  async getProductoConReceta(id: number): Promise<ProductoConReceta> {
    try {
      const response = await apiClient.get(`/productos/${id}?receta=true`);
      return response.data.data;
    } catch (error) {
      console.error('Error obteniendo producto con receta:', error);
      throw error;
    }
  },

  // Crear producto
  async createProducto(producto: Omit<Producto, 'id_producto' | 'fecha_creacion'>, variantes?: Omit<ProductoVariante, 'id_variante' | 'id_producto'>[], receta?: Omit<RecetaDetalle, 'id_receta' | 'id_producto'>[]): Promise<ProductoConReceta> {
    try {
      const response = await apiClient.post('/productos', {
        ...producto,
        variantes,
        receta
      });
      return response.data.data;
    } catch (error) {
      console.error('Error creando producto:', error);
      throw error;
    }
  },

  // Actualizar producto
  async updateProducto(id: number, producto: Partial<Omit<Producto, 'id_producto' | 'fecha_creacion'>>, variantes?: Omit<ProductoVariante, 'id_variante' | 'id_producto'>[], receta?: Omit<RecetaDetalle, 'id_receta' | 'id_producto'>[]): Promise<ProductoConReceta> {
    try {
      const response = await apiClient.put(`/productos/${id}`, {
        ...producto,
        variantes,
        receta
      });
      return response.data.data;
    } catch (error) {
      console.error('Error actualizando producto:', error);
      throw error;
    }
  },

  // Eliminar producto
  async deleteProducto(id: number): Promise<void> {
    try {
      await apiClient.delete(`/productos/${id}`);
    } catch (error) {
      console.error('Error eliminando producto:', error);
      throw error;
    }
  },

  // ================== VARIANTES ==================

  // Obtener variantes de un producto
  async getVariantesByProducto(idProducto: number): Promise<ProductoVariante[]> {
    try {
      const response = await apiClient.get(`/productos/${idProducto}/variantes`);
      return response.data.data;
    } catch (error) {
      console.error('Error obteniendo variantes:', error);
      throw error;
    }
  },

  // Crear variante
  async createVariante(variante: Omit<ProductoVariante, 'id_variante'>): Promise<ProductoVariante> {
    try {
      const response = await apiClient.post(`/productos/variantes`, variante);
      return response.data.data;
    } catch (error) {
      console.error('Error creando variante:', error);
      throw error;
    }
  },

  // Eliminar variante
  async deleteVariante(id: number): Promise<void> {
    try {
      await apiClient.delete(`/productos/variantes/${id}`);
    } catch (error) {
      console.error('Error eliminando variante:', error);
      throw error;
    }
  },
};