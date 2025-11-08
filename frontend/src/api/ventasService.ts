// ================================================================
// 💰 SERVICIO DE VENTAS
// ================================================================

import apiClient from "./apiClient";

// Interfaces para ventas
export interface Venta {
  id_venta: number;
  fecha_venta: string;
  id_cliente?: number;
  estado: 'pendiente' | 'confirmada' | 'completada' | 'cancelada';
  tipo_pago: 'Cash' | 'Paggo' | 'Tarjeta' | 'Transferencia';
  total_venta: number;
  total_costo: number;
  ganancia: number;
  id_cajero: number;
  notas?: string;
  // Datos adicionales para el frontend
  productos?: string; // Para mostrar en la tabla
  metodo?: string; // Para mostrar en la tabla
  productos_resumen?: string;
  cliente?: {
    nombre: string;
    telefono?: string;
  };
  cajero?: {
    nombre: string;
  };
}

export interface DetalleVenta {
  id_detalle: number;
  id_venta: number;
  id_producto: number;
  id_variante?: number;
  cantidad: number;
  precio_unitario: number;
  costo_unitario: number;
  subtotal: number;
  costo_total: number;
  ganancia: number;
  descuento: number;
  es_canje_puntos: boolean;
  puntos_canjeados: number;
  producto?: {
    nombre: string;
  };
  variante?: {
    nombre_variante: string;
  };
}

export interface VentasResponse {
  success: boolean;
  data: Venta[];
  count: number;
}

export interface VentaCompleta extends Venta {
  detalles: DetalleVenta[];
}

export interface ProductoPopular {
  id_producto: number;
  nombre_producto: string;
  total_vendido: number;
  veces_vendido: number;
  rating_promedio?: number;
  categoria?: string;
  imagen_url?: string;
}

// DTOs para crear ventas
export interface CreateVentaDTO {
  id_cliente?: number;
  tipo_pago: 'Cash' | 'Paggo' | 'Tarjeta' | 'Transferencia';
  puntos_usados?: number;
  notas?: string;
  detalles: CreateDetalleVentaDTO[];
}

export interface CreateDetalleVentaDTO {
  id_producto?: number;
  id_variante?: number;
  cantidad: number;
  precio_unitario: number;
  descuento?: number;
  es_canje_puntos?: boolean;
  puntos_canjeados?: number;
}

export const ventasService = {
  // Obtener todas las ventas con filtros opcionales
  async getVentas(
    estado?: string,
    fechaInicio?: string,
    fechaFin?: string,
    idCajero?: number
  ): Promise<Venta[]> {
    try {
      const params = new URLSearchParams();
      if (estado) params.append('estado', estado);
      if (fechaInicio) params.append('fechaInicio', fechaInicio);
      if (fechaFin) params.append('fechaFin', fechaFin);
      if (idCajero) params.append('idCajero', idCajero.toString());

      const response = await apiClient.get<VentasResponse>(`/ventas?${params.toString()}`);
      return response.data.data;
    } catch (error) {
      console.error('Error obteniendo ventas:', error);
      throw error;
    }
  },

  // Obtener ventas del día actual
  async getVentasDelDia(): Promise<Venta[]> {
    try {
      const response = await apiClient.get<VentasResponse>('/ventas/del-dia');
      return response.data.data;
    } catch (error) {
      console.error('Error obteniendo ventas del día:', error);
      throw error;
    }
  },

  // Obtener total de ventas
  async getTotalVentas(fechaInicio?: string, fechaFin?: string): Promise<{ total: number; count: number }> {
    try {
      const params = new URLSearchParams();
      if (fechaInicio) params.append('fechaInicio', fechaInicio);
      if (fechaFin) params.append('fechaFin', fechaFin);

      const response = await apiClient.get(`/ventas/total?${params.toString()}`);
      return response.data.data;
    } catch (error) {
      console.error('Error obteniendo total de ventas:', error);
      throw error;
    }
  },

  // Obtener total de ventas de la sesión
  async getTotalVentasSesion(fechaInicio: string): Promise<{ efectivo: number; transferencia: number; tarjeta: number; total: number; count: number }> {
    try {
      const response = await apiClient.get(`/ventas/sesion?fechaInicio=${fechaInicio}`);
      return response.data.data;
    } catch (error) {
      console.error('Error obteniendo total de ventas de sesión:', error);
      throw error;
    }
  },

  // Obtener venta por ID
  async getVentaById(id: number): Promise<Venta> {
    try {
      const response = await apiClient.get(`/ventas/${id}`);
      return response.data.data;
    } catch (error) {
      console.error('Error obteniendo venta:', error);
      throw error;
    }
  },

  // Obtener venta completa con detalles
  async getVentaCompleta(id: number): Promise<VentaCompleta> {
    try {
      const response = await apiClient.get(`/ventas/${id}?completa=true`);
      return response.data.data;
    } catch (error) {
      console.error('Error obteniendo venta completa:', error);
      throw error;
    }
  },

  // Obtener detalles de una venta
  async getDetallesByVenta(idVenta: number): Promise<DetalleVenta[]> {
    try {
      const response = await apiClient.get(`/ventas/${idVenta}/detalles`);
      return response.data.data;
    } catch (error) {
      console.error('Error obteniendo detalles de venta:', error);
      throw error;
    }
  },

  // Obtener productos más populares (top vendidos)
  async getProductosPopulares(limit: number = 5): Promise<ProductoPopular[]> {
    try {
      const response = await apiClient.get(`/ventas/productos-populares?limit=${limit}`);
      return response.data.data;
    } catch (error) {
      console.error('Error obteniendo productos populares:', error);
      throw error;
    }
  },

  // Obtener productos recientemente vendidos
  async getProductosRecientes(limit: number = 5): Promise<ProductoPopular[]> {
    try {
      const response = await apiClient.get(`/ventas/productos-recientes?limit=${limit}`);
      return response.data.data;
    } catch (error) {
      console.error('Error obteniendo productos recientes:', error);
      throw error;
    }
  },

  // Crear una nueva venta
  async createVenta(venta: CreateVentaDTO): Promise<Venta> {
    try {
      const response = await apiClient.post('/ventas', venta);
      return response.data.data;
    } catch (error) {
      console.error('Error creando venta:', error);
      throw error;
    }
  },
};