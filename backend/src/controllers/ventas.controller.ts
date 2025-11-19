import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/express.types';
import { ventasService } from '../services/ventas.service';
import { CreateVentaDTO } from '../types/ventas.types';

// ================================================================
// 💰 CONTROLADOR DE VENTAS
// ================================================================

export class VentasController {
  // ================== VENTAS ==================

  async getVentas(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const estado = req.query.estado as string | undefined;
      const fechaInicio = req.query.fechaInicio as string | undefined;
      const fechaFin = req.query.fechaFin as string | undefined;
      const idCajero = req.query.idCajero ? parseInt(req.query.idCajero as string) : undefined;

      const ventas = await ventasService.getVentas(estado, fechaInicio, fechaFin, idCajero);

      res.json({
        success: true,
        data: ventas,
        count: ventas.length,
      });
    } catch (error) {
      next(error);
    }
  }

  async getVentaById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id) || id <= 0) {
        res.status(400).json({
          success: false,
          message: 'ID de venta inválido',
        });
        return;
      }

      const completa = req.query.completa === 'true';

      let venta;
      if (completa) {
        venta = await ventasService.getVentaCompleta(id);
      } else {
        venta = await ventasService.getVentaById(id);
      }

      if (!venta) {
        res.status(404).json({
          success: false,
          message: 'Venta no encontrada',
        });
        return;
      }

      res.json({
        success: true,
        data: venta,
      });
    } catch (error) {
      next(error);
    }
  }

  async createVenta(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const dto: CreateVentaDTO = req.body;
      const idCajero = req.user?.id_perfil;

      if (!idCajero) {
        res.status(401).json({
          success: false,
          message: 'Usuario no autenticado',
        });
        return;
      }

      const venta = await ventasService.createVenta(dto, idCajero);

      res.status(201).json({
        success: true,
        data: venta,
        message: 'Venta creada exitosamente. Inventario actualizado correctamente.',
      });
    } catch (error) {
      next(error);
    }
  }

  async updateEstadoVenta(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const { estado } = req.body;

      if (!['pendiente', 'confirmada', 'completada', 'cancelada'].includes(estado)) {
        res.status(400).json({
          success: false,
          message: 'Estado inválido',
        });
        return;
      }

      const venta = await ventasService.updateEstadoVenta(id, estado);

      res.json({
        success: true,
        data: venta,
        message: 'Estado de venta actualizado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  async cancelarVenta(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const venta = await ventasService.cancelarVenta(id);

      res.json({
        success: true,
        data: venta,
        message: 'Venta cancelada exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteVenta(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      await ventasService.deleteVenta(id);

      res.json({
        success: true,
        message: 'Venta eliminada exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  // ================== DETALLES DE VENTA ==================

  async getDetallesByVenta(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const idVenta = parseInt(req.params.idVenta);
      const detalles = await ventasService.getDetallesByVenta(idVenta);

      res.json({
        success: true,
        data: detalles,
      });
    } catch (error) {
      next(error);
    }
  }

  // ================== REPORTES RÁPIDOS ==================

  async getVentasDelDia(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const idCajero = req.query.idCajero ? parseInt(req.query.idCajero as string) : undefined;
      const ventas = await ventasService.getVentasDelDia(idCajero);

      const totalVentas = ventas.reduce((sum, v) => sum + (v.total_venta || 0), 0);
      const totalGanancia = ventas.reduce((sum, v) => sum + (v.ganancia || 0), 0);

      res.json({
        success: true,
        data: {
          ventas,
          resumen: {
            cantidad: ventas.length,
            total_ventas: totalVentas,
            total_ganancia: totalGanancia,
            promedio_ticket: ventas.length > 0 ? totalVentas / ventas.length : 0,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getTotalVentas(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const fechaInicio = req.query.fechaInicio as string;
      const fechaFin = req.query.fechaFin as string;

      if (!fechaInicio || !fechaFin) {
        res.status(400).json({
          success: false,
          message: 'fechaInicio y fechaFin son requeridos',
        });
        return;
      }

      const total = await ventasService.getTotalVentas(fechaInicio, fechaFin);

      res.json({
        success: true,
        data: {
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          total_ventas: total,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getTotalVentasSesion(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const fechaInicio = req.query.fechaInicio as string;

      if (!fechaInicio) {
        res.status(400).json({
          success: false,
          message: 'fechaInicio es requerido',
        });
        return;
      }

      const result = await ventasService.getTotalVentasSesion(fechaInicio);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getTransferenciasSesion(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const fechaInicio = req.query.fechaInicio as string;

      if (!fechaInicio) {
        res.status(400).json({
          success: false,
          message: 'fechaInicio es requerido',
        });
        return;
      }

      const transferencias = await ventasService.getTransferenciasSesion(fechaInicio);

      res.json({
        success: true,
        data: transferencias,
        count: transferencias.length,
      });
    } catch (error) {
      next(error);
    }
  }

  async getVentasPorCajero(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const idCajero = parseInt(req.params.idCajero);
      const fechaInicio = req.query.fechaInicio as string | undefined;
      const fechaFin = req.query.fechaFin as string | undefined;

      const ventas = await ventasService.getVentasPorCajero(idCajero, fechaInicio, fechaFin);

      const totalVentas = ventas.reduce((sum, v) => sum + (v.total_venta || 0), 0);

      res.json({
        success: true,
        data: {
          id_cajero: idCajero,
          cantidad_ventas: ventas.length,
          total_ventas: totalVentas,
          ventas,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getProductosPopulares(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const limitParam = req.query.limit as string;
      const limit = limitParam ? parseInt(limitParam) : 5;

      if (isNaN(limit) || limit < 1 || limit > 20) {
        res.status(400).json({
          success: false,
          message: 'El límite debe ser un número entre 1 y 20',
        });
        return;
      }

      const productos = await ventasService.getProductosPopulares(limit);

      res.json({
        success: true,
        data: productos,
        count: productos.length,
      });
    } catch (error) {
      next(error);
    }
  }

  async getProductosRecientes(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const limitParam = req.query.limit as string;
      const limit = limitParam ? parseInt(limitParam) : 5;

      if (isNaN(limit) || limit < 1 || limit > 20) {
        res.status(400).json({
          success: false,
          message: 'El límite debe ser un número entre 1 y 20',
        });
        return;
      }

      const productos = await ventasService.getProductosRecientes(limit);

      res.json({
        success: true,
        data: productos,
        count: productos.length,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateEstadoTransferencia(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const idVenta = parseInt(req.params.id);
      const { estado } = req.body as { estado: 'esperando' | 'recibido' };

      if (isNaN(idVenta) || idVenta <= 0) {
        res.status(400).json({
          success: false,
          message: 'ID de venta inválido',
        });
        return;
      }

      if (!estado || !['esperando', 'recibido'].includes(estado)) {
        res.status(400).json({
          success: false,
          message: 'Estado inválido. Debe ser "esperando" o "recibido"',
        });
        return;
      }

      await ventasService.updateEstadoTransferencia(idVenta, estado);

      res.json({
        success: true,
        message: `Estado de transferencia actualizado a ${estado}`,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const ventasController = new VentasController();
