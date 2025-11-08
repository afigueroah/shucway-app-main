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
