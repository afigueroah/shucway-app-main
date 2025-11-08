// Tipos para el Dashboard
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
  id?: number;
  type: 'warning' | 'info' | 'error';
  message: string;
  timestamp: string;
}