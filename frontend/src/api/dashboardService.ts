import apiClient from "./apiClient";

export interface StatsData {
  ventas: {
    total: number;
    change: number;
  };
  inventario: {
    total: number;
    change: number;
  };
  clientes: {
    total: number;
    change: number;
  };
  ganancias: {
    total: number;
    change: number;
  };
}

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    borderColor: string;
    backgroundColor: string;
  }[];
}

export interface Alert {
  id?: string;
  type: 'warning' | 'info' | 'error';
  message: string;
  module: string;
  timestamp: string;
}

export interface InventoryItem {
  id?: number;
  name: string;
  qty?: string;
  cantidad_actual?: number;
  note?: string;
  tipo_insumo?: string;
}

export const dashboardService = {
  async getStats(): Promise<StatsData> {
    const response = await apiClient.get('/dashboard/stats');
    return response.data;
  },

  async getVentasSemana(): Promise<{ dia: string; total: number }[]> {
    const response = await apiClient.get('/dashboard/ventas-semana');
    return response.data;
  },

  async getAlertasRecientes(): Promise<Alert[]> {
    const response = await apiClient.get('/dashboard/alertas');
    return response.data;
  },

  async getInventoryData(): Promise<{ 
    perpetual: InventoryItem[]; 
    operational: InventoryItem[]; 
    totalPerpetualStock: number; 
    totalOperationalStock: number; 
    totalPerpetualItems: number; 
    totalOperationalItems: number; 
  }> {
    const response = await apiClient.get('/dashboard/inventory');
    type InsumoRaw = {
      id_insumo: number;
      nombre_insumo: string;
      tipo_insumo: string;
      cantidad_actual: number;
      stock_minimo: number;
      activo: boolean;
    };
    let insumos: InsumoRaw[] = [];
    if (Array.isArray(response.data.perpetual) && Array.isArray(response.data.operational)) {
      // Si el backend ya separa perpetuos y operativos
      return response.data;
    } else if (Array.isArray(response.data)) {
      insumos = response.data;
    } else if (Array.isArray(response.data.insumos)) {
      insumos = response.data.insumos;
    } else if (Array.isArray(response.data.data)) {
      insumos = response.data.data;
    }
    // Separar insumos perpetuos y operativos
    const perpetual = insumos.filter(i => i.tipo_insumo === 'perpetuo');
    const operational = insumos.filter(i => i.tipo_insumo === 'operativo');
    // Calcular totales de stock (sumar el campo cantidad_actual)
    const totalPerpetualStock = perpetual.reduce((acc, i) => acc + (i.cantidad_actual || 0), 0);
    const totalOperationalStock = operational.reduce((acc, i) => acc + (i.cantidad_actual || 0), 0);
    // Cantidad de insumos
    const totalPerpetualItems = perpetual.length;
    const totalOperationalItems = operational.length;
    // Mapear a InventoryItem para el frontend
    const mapItem = (i: InsumoRaw): InventoryItem => ({
      id: i.id_insumo,
      name: i.nombre_insumo,
      qty: i.cantidad_actual?.toString() ?? '0',
      cantidad_actual: i.cantidad_actual ?? 0,
      note: i.activo ? (i.cantidad_actual <= i.stock_minimo ? 'Stock Bajo' : (i.cantidad_actual === 0 ? 'Sin Stock' : 'OK')) : 'Inactivo',
      tipo_insumo: i.tipo_insumo
    });
    return {
      perpetual: perpetual.map(mapItem),
      operational: operational.map(mapItem),
      totalPerpetualStock,
      totalOperationalStock,
      totalPerpetualItems,
      totalOperationalItems
    };
  }
};