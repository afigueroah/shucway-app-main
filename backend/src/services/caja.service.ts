import { supabase } from '../config/database';
import { AppError } from '../middlewares/errorHandler.middleware';
import { AbrirCajaDTO, CajaEstadoResponse, CajaSesion, CerrarCajaDTO, Arqueo } from '../types/caja.types';

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

    // Crear arqueo automático al cerrar automáticamente
    await this.crearArqueoAutomatico(session, fechaCierre);

    return this.toCajaSesion(data);
  }

  private async crearArqueoManual(session: CajaSesion, dto: CerrarCajaDTO): Promise<void> {
    const fechaArqueo = new Date().toISOString().split('T')[0];
    
    // Calcular totales de ventas en efectivo para esa sesión
    const fechaDia = fechaArqueo;
    const { data: ventas, error: errorVentas } = await supabase
      .from('venta')
      .select('total_venta, tipo_pago')
      .eq('estado', 'confirmada')
      .gte('fecha_venta', fechaDia + ' 00:00:00')
      .lte('fecha_venta', fechaDia + ' 23:59:59');

    if (errorVentas) {
      console.error('Error obteniendo ventas para arqueo manual:', errorVentas);
      return;
    }

    const totalEfectivo = ventas?.filter(v => v.tipo_pago === 'Cash').reduce((sum, v) => sum + Number(v.total_venta), 0) || 0;
    const transferencias = await this.getTransferenciasPorFecha(fechaArqueo);

    // Si no se proporcionaron datos del arqueo, usar valores por defecto
    const totalContado = dto.monto_cierre || totalEfectivo;
    const diferencia = totalContado - totalEfectivo;

    // Insertar arqueo
    const { error } = await supabase
      .from('arqueo_caja')
      .insert({
        fecha_arqueo: fechaArqueo,
        id_cajero: session.id_cajero_cierre || session.id_cajero_apertura,
        billetes_100: dto.arqueo?.billetes_100 || 0,
        billetes_50: dto.arqueo?.billetes_50 || 0,
        billetes_20: dto.arqueo?.billetes_20 || 0,
        billetes_10: dto.arqueo?.billetes_10 || 0,
        billetes_5: dto.arqueo?.billetes_5 || 0,
        monedas_1: dto.arqueo?.monedas_1 || 0,
        monedas_050: dto.arqueo?.monedas_050 || 0,
        monedas_025: dto.arqueo?.monedas_025 || 0,
        total_billetes_100: (dto.arqueo?.billetes_100 || 0) * 100,
        total_billetes_50: (dto.arqueo?.billetes_50 || 0) * 50,
        total_billetes_20: (dto.arqueo?.billetes_20 || 0) * 20,
        total_billetes_10: (dto.arqueo?.billetes_10 || 0) * 10,
        total_billetes_5: (dto.arqueo?.billetes_5 || 0) * 5,
        total_monedas_1: (dto.arqueo?.monedas_1 || 0) * 1,
        total_monedas_050: (dto.arqueo?.monedas_050 || 0) * 0.5,
        total_monedas_025: (dto.arqueo?.monedas_025 || 0) * 0.25,
        total_contado: totalContado,
        total_sistema: totalEfectivo,
        diferencia: diferencia,
        transferencias: transferencias,
        observaciones: dto.observaciones || 'Arqueo automático al cerrar caja',
        estado: 'cerrado'
      });

    if (error) {
      console.error('Error creando arqueo manual:', error);
    }
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

    const sesionCerrada = this.toCajaSesion(data);

    // Crear arqueo automático al cerrar la caja manualmente
    await this.crearArqueoManual(sesionCerrada, dto);

    return sesionCerrada;
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

  async getArqueos(fechaInicio?: string, fechaFin?: string): Promise<Arqueo[]> {
    let query = supabase
      .from('arqueo_caja')
      .select(`
        *,
        caja_sesion!left(fecha_apertura, fecha_cierre)
      `)
      .order('fecha_arqueo', { ascending: false });

    if (fechaInicio) {
      query = query.gte('fecha_arqueo', fechaInicio);
    }
    if (fechaFin) {
      query = query.lte('fecha_arqueo', fechaFin + ' 23:59:59');
    }

    const { data, error } = await query;

    if (error) {
      throw new AppError(`Error al obtener arqueos: ${error.message}`, 500);
    }

    // Para cada arqueo, si transferencias está vacío, poblarlo
    const arqueos = await Promise.all(data.map(async (row) => {
      let transferencias = row.transferencias || [];
      if (transferencias.length === 0) {
        transferencias = await this.getTransferenciasPorFecha(row.fecha_arqueo);
        // Opcional: actualizar la BD, pero por ahora solo en memoria
      }
      
      // Si no hay información de sesión, intentar buscarla por fecha y cajero
      let fecha_apertura = row.caja_sesion?.fecha_apertura;
      let fecha_cierre = row.caja_sesion?.fecha_cierre;
      
      if (!fecha_apertura && row.id_cajero) {
        // Buscar sesión por cajero y fecha aproximada
        const fechaArqueo = new Date(row.fecha_arqueo);
        const fechaInicio = new Date(fechaArqueo);
        fechaInicio.setHours(0, 0, 0, 0);
        const fechaFin = new Date(fechaArqueo);
        fechaFin.setHours(23, 59, 59, 999);
        
        const { data: sesiones } = await supabase
          .from('caja_sesion')
          .select('fecha_apertura, fecha_cierre')
          .eq('id_cajero_apertura', row.id_cajero)
          .gte('fecha_apertura', fechaInicio.toISOString())
          .lte('fecha_apertura', fechaFin.toISOString())
          .order('fecha_apertura', { ascending: false })
          .limit(1);
          
        if (sesiones && sesiones.length > 0) {
          fecha_apertura = sesiones[0].fecha_apertura;
          fecha_cierre = sesiones[0].fecha_cierre;
        }
      }
      
      return {
        id_arqueo: row.id_arqueo,
        fecha_arqueo: row.fecha_arqueo,
        id_cajero: row.id_cajero,
        billetes_100: row.billetes_100,
        billetes_50: row.billetes_50,
        billetes_20: row.billetes_20,
        billetes_10: row.billetes_10,
        billetes_5: row.billetes_5,
        monedas_1: row.monedas_1,
        monedas_050: row.monedas_050,
        monedas_025: row.monedas_025,
        total_billetes_100: Number(row.total_billetes_100),
        total_billetes_50: Number(row.total_billetes_50),
        total_billetes_20: Number(row.total_billetes_20),
        total_billetes_10: Number(row.total_billetes_10),
        total_billetes_5: Number(row.total_billetes_5),
        total_monedas_1: Number(row.total_monedas_1),
        total_monedas_050: Number(row.total_monedas_050),
        total_monedas_025: Number(row.total_monedas_025),
        total_contado: Number(row.total_contado),
        total_sistema: Number(row.total_sistema),
        diferencia: Number(row.diferencia),
        transferencias,
        observaciones: row.observaciones,
        estado: row.estado,
        fecha_apertura,
        fecha_cierre,
      };
    }));

    return arqueos;
  }

  private async getTransferenciasPorFecha(fecha: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('deposito_banco')
      .select('*')
      .eq('fecha_deposito', fecha);

    if (error) {
      console.error('Error obteniendo transferencias:', error);
      return [];
    }

    return data || [];
  }

  async deleteArqueo(id: number): Promise<void> {
    const { error } = await supabase
      .from('arqueo_caja')
      .delete()
      .eq('id_arqueo', id);

    if (error) {
      throw new AppError(`Error al eliminar arqueo: ${error.message}`, 500);
    }
  }
}

export const cajaService = new CajaService();
