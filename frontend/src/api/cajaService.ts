import apiClient from './apiClient';

export interface CajaSesion {
  id_sesion: number;
  id_cajero_apertura: string | null;
  id_cajero_cierre: string | null;
  fecha_apertura: string;
  fecha_cierre: string | null;
  monto_inicial: number;
  monto_cierre: number | null;
  observaciones: string | null;
  estado: 'abierta' | 'cerrada' | 'expirada';
  auto_cierre: boolean;
}

export interface Arqueo {
  id_arqueo: number;
  fecha_arqueo: string;
  id_cajero: string | null;
  billetes_100: number;
  billetes_50: number;
  billetes_20: number;
  billetes_10: number;
  billetes_5: number;
  monedas_1: number;
  monedas_050: number;
  monedas_025: number;
  total_billetes_100: number;
  total_billetes_50: number;
  total_billetes_20: number;
  total_billetes_10: number;
  total_billetes_5: number;
  total_monedas_1: number;
  total_monedas_050: number;
  total_monedas_025: number;
  total_contado: number;
  total_sistema: number;
  diferencia: number;
  transferencias: any[]; // Lista de transferencias
  observaciones: string | null;
  estado: 'abierto' | 'cerrado' | 'revisado';
  // Información de la sesión de caja
  fecha_apertura?: string;
  fecha_cierre?: string;
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

  async getArqueos(fechaInicio?: string, fechaFin?: string): Promise<Arqueo[]> {
    const params = new URLSearchParams();
    if (fechaInicio) params.append('fechaInicio', fechaInicio);
    if (fechaFin) params.append('fechaFin', fechaFin);
    const { data } = await apiClient.get<{ success: boolean; data: Arqueo[] }>(`/caja/arqueos?${params.toString()}`);
    return data.data;
  },

  async deleteArqueo(id: number): Promise<void> {
    await apiClient.delete(`/caja/arqueos/${id}`);
  },
};
