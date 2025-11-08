import apiClient from './apiClient';

export interface CajaSesion {
  id_sesion: number;
  id_cajero_apertura: number | null;
  id_cajero_cierre: number | null;
  fecha_apertura: string;
  fecha_cierre: string | null;
  monto_inicial: number;
  monto_cierre: number | null;
  observaciones: string | null;
  estado: 'abierta' | 'cerrada' | 'expirada';
  auto_cierre: boolean;
}

export interface CajaEstado {
  abierta: boolean;
  sesion: CajaSesion | null;
  expirada?: boolean;
}

export const cajaService = {
  async getEstado(): Promise<CajaEstado> {
    const { data } = await apiClient.get<{ success: boolean; data: CajaEstado }>('/caja/estado');
    return data.data;
  },

  async abrirCaja(montoInicial: number = 0): Promise<CajaSesion> {
    const { data } = await apiClient.post<{ success: boolean; data: CajaSesion }>('/caja/abrir', {
      monto_inicial: montoInicial,
    });
    return data.data;
  },

  async cerrarCaja(payload: { monto_cierre?: number; observaciones?: string } = {}): Promise<CajaSesion> {
    const { data } = await apiClient.post<{ success: boolean; data: CajaSesion }>('/caja/cerrar', payload);
    return data.data;
  },
};
