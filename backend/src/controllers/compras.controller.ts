import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/express.types';
import { ComprasService } from '../services/compras.service';
import {
  CreateProveedorDTO,
  UpdateProveedorDTO,
} from '../types/compras.types';

// ================================================================
// 🛒 CONTROLADOR DE COMPRAS (PROVEEDORES)
// ================================================================

export class ComprasController {
  private comprasService = new ComprasService();
  // ================== PROVEEDORES ==================

  async getProveedores(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const proveedores = await this.comprasService.getProveedores();
      res.json({
        success: true,
        data: proveedores,
      });
    } catch (error) {
      next(error);
    }
  }

  async getProveedorById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const proveedor = await this.comprasService.getProveedorById(id);

      if (!proveedor) {
        res.status(404).json({
          success: false,
          message: 'Proveedor no encontrado',
        });
        return;
      }

      res.json({
        success: true,
        data: proveedor,
      });
    } catch (error) {
      next(error);
    }
  }

  async createProveedor(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const dto: CreateProveedorDTO = req.body;
      const proveedor = await this.comprasService.createProveedor(dto);
      res.status(201).json({
        success: true,
        data: proveedor,
        message: 'Proveedor creado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProveedor(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const dto: UpdateProveedorDTO = req.body;
      const proveedor = await this.comprasService.updateProveedor(id, dto);

      if (!proveedor) {
        res.status(404).json({
          success: false,
          message: 'Proveedor no encontrado',
        });
        return;
      }

      res.json({
        success: true,
        data: proveedor,
        message: 'Proveedor actualizado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteProveedor(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const deleted = await this.comprasService.deleteProveedor(id);

      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'Proveedor no encontrado',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Proveedor eliminado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  async getInsumosByProveedor(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const insumos = await this.comprasService.getInsumosByProveedor(id);

      res.json({
        success: true,
        data: insumos,
      });
    } catch (error) {
      next(error);
    }
  }
}