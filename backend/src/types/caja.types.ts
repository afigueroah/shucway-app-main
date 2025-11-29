// ================================================================
// 💵 TIPOS DE CAJA
// ================================================================

export type CajaEstado = 'abierta' | 'cerrada' | 'expirada';

export interface CajaSesion {
  id_sesion: number;
  id_cajero_apertura: number | null;
  id_cajero_cierre: number | null;
  fecha_apertura: string;
  fecha_cierre: string | null;
  monto_inicial: number;
  monto_cierre: number | null;
  observaciones: string | null;
  estado: CajaEstado;
  auto_cierre: boolean;
}

export interface AbrirCajaDTO {
  monto_inicial?: number;
}

export interface CerrarCajaDTO {
  monto_cierre?: number;
  observaciones?: string;
}

export interface CajaEstadoResponse {
  abierta: boolean;
  sesion: CajaSesion | null;
  expirada?: boolean;
}

export interface Arqueo {
  id_arqueo: number;
  fecha_arqueo: string;
  id_cajero: number | null;
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
}
