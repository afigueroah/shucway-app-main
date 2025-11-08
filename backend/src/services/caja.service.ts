import { supabase } from '../config/database';
import { AppError } from '../middlewares/errorHandler.middleware';
import { AbrirCajaDTO, CajaEstadoResponse, CajaSesion, CerrarCajaDTO } from '../types/caja.types';

type CajaSesionRow = {
  id_sesion: number;
  id_cajero_apertura: number | null;
  id_cajero_cierre: number | null;
  fecha_apertura: string;
  fecha_cierre: string | null;
  monto_inicial: number | string | null;
  monto_cierre: number | string | null;
  observaciones: string | null;
  estado: 'abierta' | 'cerrada' | 'expirada';
  auto_cierre: boolean | null;
};

const AUTO_CLOSE_HOURS = 12;

class CajaService {
  private toCajaSesion(data: CajaSesionRow): CajaSesion {
    return {
      id_sesion: data.id_sesion,
      id_cajero_apertura: data.id_cajero_apertura ?? null,
      id_cajero_cierre: data.id_cajero_cierre ?? null,
      fecha_apertura: data.fecha_apertura,
      fecha_cierre: data.fecha_cierre ?? null,
      monto_inicial: Number(data.monto_inicial ?? 0),
      monto_cierre: data.monto_cierre != null ? Number(data.monto_cierre) : null,
      observaciones: data.observaciones ?? null,
      estado: data.estado,
      auto_cierre: Boolean(data.auto_cierre),
    };
  }

  private computeExpiration(fechaApertura: string): Date {
    const openedAt = new Date(fechaApertura);
    return new Date(openedAt.getTime() + AUTO_CLOSE_HOURS * 60 * 60 * 1000);
  }

  private isExpired(session: CajaSesion): boolean {
    if (session.estado !== 'abierta' || session.fecha_cierre) {
      return false;
    }
    const expiresAt = this.computeExpiration(session.fecha_apertura);
    return expiresAt.getTime() <= Date.now();
  }

  private async fetchActiveSession(): Promise<CajaSesion | null> {
    const { data, error } = await supabase
      .from('caja_sesion')
      .select('*')
      .eq('estado', 'abierta')
      .order('fecha_apertura', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Error al obtener sesión de caja: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return this.toCajaSesion(data);
  }

  private async markAsExpired(session: CajaSesion): Promise<CajaSesion> {
    const fechaCierre = this.computeExpiration(session.fecha_apertura).toISOString();
    const { data, error } = await supabase
      .from('caja_sesion')
      .update({
        estado: 'expirada',
        fecha_cierre: fechaCierre,
        auto_cierre: true,
        id_cajero_cierre: session.id_cajero_apertura,
      })
      .eq('id_sesion', session.id_sesion)
      .select()
      .single();

    if (error) {
      throw new Error(`Error al marcar caja expirada: ${error.message}`);
    }

    return this.toCajaSesion(data);
  }

  private async ensureActiveSession(): Promise<CajaEstadoResponse> {
    const current = await this.fetchActiveSession();
    if (!current) {
      return { abierta: false, sesion: null };
    }

    if (this.isExpired(current)) {
      const expired = await this.markAsExpired(current);
      return { abierta: false, sesion: expired, expirada: true };
    }

    return { abierta: true, sesion: current };
  }

  async getEstado(): Promise<CajaEstadoResponse> {
    return this.ensureActiveSession();
  }

  async abrirCaja(idCajero: number, dto: AbrirCajaDTO): Promise<CajaSesion> {
    const estado = await this.ensureActiveSession();
    if (estado.abierta) {
      throw new AppError('Ya existe una caja abierta actualmente.', 409);
    }

    const montoInicial = dto.monto_inicial != null ? Number(dto.monto_inicial) : 0;

    const { data, error } = await supabase
      .from('caja_sesion')
      .insert({
        id_cajero_apertura: idCajero,
        monto_inicial: montoInicial,
        estado: 'abierta',
        auto_cierre: false,
      })
      .select()
      .single();

    if (error || !data) {
      throw new AppError(error?.message ?? 'No se pudo abrir la caja.', 500);
    }

    return this.toCajaSesion(data);
  }

  async cerrarCaja(idCajero: number, dto: CerrarCajaDTO): Promise<CajaSesion> {
    const estado = await this.ensureActiveSession();
    if (!estado.abierta || !estado.sesion) {
      throw new AppError('No hay una caja abierta para cerrar.', 400);
    }

    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('caja_sesion')
      .update({
        estado: 'cerrada',
        fecha_cierre: nowIso,
        monto_cierre: dto.monto_cierre != null ? Number(dto.monto_cierre) : null,
        observaciones: dto.observaciones ?? null,
        auto_cierre: false,
        id_cajero_cierre: idCajero,
      })
      .eq('id_sesion', estado.sesion.id_sesion)
      .select()
      .single();

    if (error || !data) {
      throw new AppError(error?.message ?? 'No se pudo cerrar la caja.', 500);
    }

    return this.toCajaSesion(data);
  }

  async requireCajaAbierta(idCajero: number): Promise<CajaSesion> {
    const estado = await this.ensureActiveSession();
    if (!estado.abierta || !estado.sesion) {
      throw new AppError('Debes abrir la caja antes de registrar ventas.', 403);
    }

    if (estado.sesion.id_cajero_apertura !== null && estado.sesion.id_cajero_apertura !== idCajero) {
      // Permitimos que otros cajeros vendan, pero la sesión sigue siendo global.
      return estado.sesion;
    }

    return estado.sesion;
  }
}

export const cajaService = new CajaService();
