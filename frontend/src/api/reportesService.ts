import apiClient from './apiClient';

// Tipos para reportes
export interface VentaReporte {
  fechaISO: string;
  producto: string;
  categoria: string;
  cantidad: number;
  totalQ: number;
  cogsQ: number;
  metodo: 'Efectivo' | 'Tarjeta' | 'Transferencia';
}

export interface KPIReporte {
  ventaTotal: number;
  cogsTotal: number;
  gananciaBruta: number;
  gastosOperativos: number;
  gananciaNeta: number;
}

export interface ProductoReporte {
  producto: string;
  categoria: string;
  unidades: number;
  ventaQ: number;
  cogsQ: number;
  gananciaQ: number;
}

export interface DistribucionCategoria {
  categoria: string;
  total: number;
}

export interface DistribucionMetodo {
  metodo: string;
  total: number;
}

/**
 * Obtener ventas para reportes en un rango de fechas
 */
export const obtenerVentasReporte = async (
  fechaInicio: string,
  fechaFin: string
): Promise<VentaReporte[]> => {
  const response = await apiClient.get('/reportes/ventas', {
    params: { fechaInicio, fechaFin }
  });
  return response.data;
};

/**
 * Obtener KPIs del negocio
 */
export const obtenerKPIs = async (
  fechaInicio: string,
  fechaFin: string
): Promise<KPIReporte> => {
  const response = await apiClient.get('/reportes/kpis', {
    params: { fechaInicio, fechaFin }
  });
  return response.data;
};

/**
 * Obtener productos agregados para tabla
 */
export const obtenerProductosReporte = async (
  fechaInicio: string,
  fechaFin: string,
  categoria?: string,
  metodo?: string,
  busqueda?: string
): Promise<ProductoReporte[]> => {
  const response = await apiClient.get('/reportes/productos', {
    params: { 
      fechaInicio, 
      fechaFin,
      categoria: categoria && categoria !== 'Todas' ? categoria : undefined,
      metodo: metodo && metodo !== 'Todos' ? metodo : undefined,
      busqueda
    }
  });
  return response.data;
};

/**
 * Obtener distribución por categoría
 */
export const obtenerDistribucionCategoria = async (
  fechaInicio: string,
  fechaFin: string
): Promise<DistribucionCategoria[]> => {
  const response = await apiClient.get('/reportes/distribucion-categoria', {
    params: { fechaInicio, fechaFin }
  });
  return response.data;
};

/**
 * Obtener distribución por método de pago
 */
export const obtenerDistribucionMetodo = async (
  fechaInicio: string,
  fechaFin: string
): Promise<DistribucionMetodo[]> => {
  const response = await apiClient.get('/reportes/distribucion-metodo', {
    params: { fechaInicio, fechaFin }
  });
  return response.data;
};

export const reportesService = {
  obtenerVentasReporte,
  obtenerKPIs,
  obtenerProductosReporte,
  obtenerDistribucionCategoria,
  obtenerDistribucionMetodo,
};

export default reportesService;
