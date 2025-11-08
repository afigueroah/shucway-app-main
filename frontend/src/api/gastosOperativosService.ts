import { api } from './apiClient';

/* =============== Tipos =============== */
export type CategoriaGasto =
  | 'Gastos de Personal'
  | 'Servicios Fijos (Mensuales)'
  | 'Insumos Operativos'
  | 'Gastos de Transporte'
  | 'Mantenimiento y Reemplazos';

export type FrecuenciaGasto = 'quincenal' | 'mensual';

export interface GastoOperativo {
  id_gasto: number;
  numero_gasto: string;
  fecha_gasto: string;
  fecha_creacion: string;
  nombre_gasto: string;
  categoria_gasto: CategoriaGasto;
  detalle: string;
  frecuencia: FrecuenciaGasto;
  monto: number;
  estado: 'activo' | 'desactivado';
}

export interface CreateGastoDTO {
  nombre_gasto: string;
  categoria_gasto: CategoriaGasto;
  detalle: string;
  frecuencia: FrecuenciaGasto;
  monto: number;
  estado?: 'activo' | 'desactivado';
}

export type UpdateGastoDTO = Partial<CreateGastoDTO>;

export interface ResumenGastos {
  total_registros: number;
  total_base: number;
  total_ajustado: number;
  total_quincenal: number;
  total_mensual: number;
  count_quincenal: number;
  count_mensual: number;
  promedio_mensual: number;
}

export interface CategoriaCatalogoItem {
  value: CategoriaGasto;
  nombre: CategoriaGasto;
}

/* =============== Service =============== */
const gastosOperativosService = {
  async getGastos(): Promise<GastoOperativo[]> {
    try {
      const response = await api.get('/gastos-operativos');
      return response.data || [];
    } catch (error) {
      console.error('Error fetching gastos operativos:', error);
      throw error;
    }
  },

  async getGastoById(id: number): Promise<GastoOperativo> {
    try {
      const response = await api.get(`/gastos-operativos/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching gasto by ID:', error);
      throw error;
    }
  },

  async getGastosPorFechas(fechaInicio: string, fechaFin: string): Promise<GastoOperativo[]> {
    try {
      const response = await api.get('/gastos-operativos/fechas', {
        params: { fechaInicio, fechaFin },
      });
      return response.data || [];
    } catch (error) {
      console.error('Error fetching gastos por fechas:', error);
      throw error;
    }
  },

  async getGastosPorCategoria(categoria: CategoriaGasto): Promise<GastoOperativo[]> {
    try {
      const response = await api.get('/gastos-operativos/categoria', {
        params: { categoria },
      });
      return response.data || [];
    } catch (error) {
      console.error('Error fetching gastos por categoría:', error);
      throw error;
    }
  },

  async createGasto(gasto: CreateGastoDTO): Promise<GastoOperativo> {
    try {
      const response = await api.post('/gastos-operativos', gasto);
      return response.data;
    } catch (error) {
      console.error('Error creating gasto:', error);
      throw error;
    }
  },

  async updateGasto(id: number, gasto: UpdateGastoDTO): Promise<GastoOperativo> {
    try {
      const response = await api.put(`/gastos-operativos/${id}`, gasto);
      return response.data;
    } catch (error) {
      console.error('Error updating gasto:', error);
      throw error;
    }
  },

  async deleteGasto(id: number): Promise<void> {
    try {
      await api.delete(`/gastos-operativos/${id}`);
    } catch (error) {
      console.error('Error deleting gasto:', error);
      throw error;
    }
  },

  async getResumenGastos(fechaInicio?: string, fechaFin?: string): Promise<ResumenGastos> {
    try {
      const params = fechaInicio && fechaFin ? { fechaInicio, fechaFin } : {};
      const response = await api.get('/gastos-operativos/resumen', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching resumen gastos:', error);
      throw error;
    }
  },

  async getCategorias(): Promise<CategoriaCatalogoItem[]> {
    try {
      const response = await api.get('/gastos-operativos/categorias');
      return response.data || [];
    } catch (error) {
      console.error('Error fetching catálogo de categorías de gasto:', error);
      throw error;
    }
  },
};

export default gastosOperativosService;
