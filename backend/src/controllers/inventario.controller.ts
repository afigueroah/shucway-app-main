import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/express.types';
import { inventarioService } from '../services/inventario.service';
import {
  CreateInsumoDTO,
  UpdateInsumoDTO,
  CreateLoteDTO,
  CreateMovimientoDTO,
} from '../types/inventario.types';

// ================================================================
// 📦 CONTROLADOR DE INVENTARIO
// ================================================================

export class InventarioController {
  // ================== CATEGORÍAS ==================

  async getCategoriasInsumo(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const categorias = await inventarioService.getCategoriasInsumo();
      res.json({
        success: true,
        data: categorias,
      });
    } catch (error) {
      next(error);
    }
  }

  async getCategoriaInsumoById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const categoria = await inventarioService.getCategoriaInsumoById(id);

      if (!categoria) {
        res.status(404).json({
          success: false,
          message: 'Categoría no encontrada',
        });
        return;
      }

      res.json({
        success: true,
        data: categoria,
      });
    } catch (error) {
      next(error);
    }
  }

  // ================== INSUMOS ==================

  async getInsumos(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const activos = req.query.activos === 'true' ? true : req.query.activos === 'false' ? false : undefined;
      const insumos = await inventarioService.getInsumos(activos);

      res.json({
        success: true,
        data: insumos,
      });
    } catch (error) {
      next(error);
    }
  }

  async getInsumoById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const insumo = await inventarioService.getInsumoById(id);

      if (!insumo) {
        res.status(404).json({
          success: false,
          message: 'Insumo no encontrado',
        });
        return;
      }

      res.json({
        success: true,
        data: insumo,
      });
    } catch (error) {
      next(error);
    }
  }

  async createInsumo(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const dto: CreateInsumoDTO = req.body;
      const insumo = await inventarioService.createInsumo(dto);

      res.status(201).json({
        success: true,
        data: insumo,
        message: 'Insumo creado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  async updateInsumo(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const dto: UpdateInsumoDTO = req.body;
      const insumo = await inventarioService.updateInsumo(id, dto);

      res.json({
        success: true,
        data: insumo,
        message: 'Insumo actualizado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteInsumo(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      await inventarioService.deleteInsumo(id);

      res.json({
        success: true,
        message: 'Insumo eliminado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  // ================== CATÁLOGO ==================

  async getCatalogoInsumos(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const insumos = await inventarioService.getCatalogoInsumos();
      res.json({
        success: true,
        data: insumos,
      });
    } catch (error) {
      next(error);
    }
  }

  // ================== PRESENTACIONES ==================

  async getPresentacionesByInsumo(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      console.log(`[BACKEND] getPresentacionesByInsumo called with id: ${id}`);
      const presentaciones = await inventarioService.getPresentacionesByInsumo(id);
      console.log(`[BACKEND] getPresentacionesByInsumo returned ${presentaciones.length} presentaciones`);

      res.json({
        success: true,
        data: presentaciones,
      });
    } catch (error) {
      console.error(`[BACKEND] Error in getPresentacionesByInsumo:`, error);
      next(error);
    }
  }

  // ================== LOTES ==================

  async getLotesByInsumo(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const idInsumo = parseInt(req.params.idInsumo);
      const lotes = await inventarioService.getLotesByInsumo(idInsumo);

      res.json({
        success: true,
        data: lotes,
      });
    } catch (error) {
      next(error);
    }
  }

  async getLoteById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const lote = await inventarioService.getLoteById(id);

      if (!lote) {
        res.status(404).json({
          success: false,
          message: 'Lote no encontrado',
        });
        return;
      }

      res.json({
        success: true,
        data: lote,
      });
    } catch (error) {
      next(error);
    }
  }

  async createLote(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const dto: CreateLoteDTO = req.body;
      const lote = await inventarioService.createLote(dto);

      res.status(201).json({
        success: true,
        data: lote,
        message: 'Lote creado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteLote(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      await inventarioService.deleteLote(id);

      res.json({
        success: true,
        message: 'Lote eliminado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  // ================== MOVIMIENTOS ==================

  async getMovimientos(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const idInsumo = req.query.idInsumo ? parseInt(req.query.idInsumo as string) : undefined;
      const fechaInicio = req.query.fechaInicio as string | undefined;
      const fechaFin = req.query.fechaFin as string | undefined;

      const movimientos = await inventarioService.getMovimientos(idInsumo, fechaInicio, fechaFin);

      res.json({
        success: true,
        data: movimientos,
      });
    } catch (error) {
      next(error);
    }
  }

  async createMovimiento(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const dto: CreateMovimientoDTO = req.body;
      const movimiento = await inventarioService.createMovimiento(dto);

      res.status(201).json({
        success: true,
        data: movimiento,
        message: 'Movimiento registrado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  // ================== STOCK ==================

  async getStockActual(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const idInsumo = req.query.idInsumo ? parseInt(req.query.idInsumo as string) : undefined;
      const stock = await inventarioService.getStockActual(idInsumo);

      res.json({
        success: true,
        data: stock,
      });
    } catch (error) {
      next(error);
    }
  }

  async getInsumosStockBajo(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const insumos = await inventarioService.getInsumosStockBajo();

      res.json({
        success: true,
        data: insumos,
        count: insumos.length,
      });
    } catch (error) {
      next(error);
    }
  }

  // ================== KARDEX ==================

  async getKardexInsumo(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const idInsumo = parseInt(req.params.id);
      const { fechaDesde, fechaHasta } = req.query;

      const kardex = await inventarioService.getKardexInsumo(
        idInsumo,
        fechaDesde as string | undefined,
        fechaHasta as string | undefined
      );

      res.json({
        success: true,
        data: kardex,
      });
    } catch (error) {
      next(error);
    }
  }

  // ================== DETALLES DE INSUMO ==================

  async getInsumoDetails(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const insumoDetails = await inventarioService.getInsumoDetails(id);

      res.json({
        success: true,
        data: insumoDetails,
      });
    } catch (error) {
      next(error);
    }
  }

  // ================== PRESENTACIONES ==================

  async updatePresentacion(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;

      const presentacion = await inventarioService.updatePresentacion(id, updates);

      res.json({
        success: true,
        data: presentacion,
        message: 'Presentación actualizada correctamente',
      });
    } catch (error) {
      next(error);
    }
  }

  async updateLote(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;

      const lote = await inventarioService.updateLote(id, updates);

      res.json({
        success: true,
        data: lote,
        message: 'Lote actualizado correctamente',
      });
    } catch (error) {
      next(error);
    }
  }

  // ================== RECEPCIONES DE MERCADERÍA ==================

  async getRecepcionesMercaderia(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const recepciones = await inventarioService.getRecepcionesMercaderia();
      res.json({
        success: true,
        data: recepciones,
      });
    } catch (error) {
      next(error);
    }
  }

  async createRecepcionMercaderia(req: AuthRequest, res: Response, next: NextFunction) {
    console.log('[BACKEND] createRecepcionMercaderia llamado con:', req.body);
    try {
      const recepcionData = req.body;
      const result = await inventarioService.createRecepcionMercaderia(recepcionData);
      console.log('[BACKEND] Recepción creada exitosamente:', result);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('[BACKEND] Error en createRecepcionMercaderia:', error);
      next(error);
    }
  }

  async updateRecepcionFactura(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      if (Number.isNaN(id)) {
        res.status(400).json({
          success: false,
          message: 'ID de recepción inválido',
        });
        return;
      }

      const { numeroFactura } = req.body as { numeroFactura?: string | null };
      const updated = await inventarioService.updateRecepcionFactura(id, numeroFactura?.trim() || null);

      res.json({
        success: true,
        data: updated,
        message: 'Número de factura actualizado correctamente',
      });
    } catch (error) {
      console.error('[BACKEND] Error en updateRecepcionFactura:', error);
      next(error);
    }
  }

  async createDetalleRecepcionMercaderia(req: AuthRequest, res: Response, next: NextFunction) {
    console.log('[BACKEND] createDetalleRecepcionMercaderia llamado con:', req.body);
    try {
      const detalleData = req.body;
      const result = await inventarioService.createDetalleRecepcionMercaderia(detalleData);
      console.log('[BACKEND] Detalle de recepción creado exitosamente:', result);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('[BACKEND] Error en createDetalleRecepcionMercaderia:', error);
      next(error);
    }
  }

  async deleteRecepcionMercaderia(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          message: 'ID inválido',
        });
        return;
      }
      
      await inventarioService.deleteRecepcionMercaderia(id);
      res.json({
        success: true,
        message: 'Recepción eliminada exitosamente',
      });
    } catch (error) {
      console.error('[BACKEND] Error en deleteRecepcionMercaderia:', error);
      next(error);
    }
  }
}

export const inventarioController = new InventarioController();
