import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/express.types';
import { productosService } from '../services/productos.service';
import { CreateProductoDTO, UpdateProductoDTO, CreateVarianteDTO, CreateRecetaDTO } from '../types/productos.types';

// ================================================================
// 🍔 CONTROLADOR DE PRODUCTOS
// ================================================================

export class ProductosController {
  // ================== CATEGORÍAS ==================

  async getCategorias(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const categorias = await productosService.getCategorias();
      res.json({
        success: true,
        data: categorias,
      });
    } catch (error) {
      next(error);
    }
  }

  async getCategoriaById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const categoria = await productosService.getCategoriaById(id);

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

  async createCategoria(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { nombre, descripcion } = req.body;
      const categoria = await productosService.createCategoria(nombre, descripcion);

      res.status(201).json({
        success: true,
        data: categoria,
        message: 'Categoría creada exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  // ================== PRODUCTOS ==================

  async getProductos(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const activos = req.query.activos === 'true' ? true : req.query.activos === 'false' ? false : undefined;
      const productos = await productosService.getProductos(activos);

      res.json({
        success: true,
        data: productos,
      });
    } catch (error) {
      next(error);
    }
  }

  async getProductoById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const conReceta = req.query.receta === 'true';

      let producto;
      if (conReceta) {
        producto = await productosService.getProductoConReceta(id);
      } else {
        producto = await productosService.getProductoById(id);
      }

      if (!producto) {
        res.status(404).json({
          success: false,
          message: 'Producto no encontrado',
        });
        return;
      }

      res.json({
        success: true,
        data: producto,
      });
    } catch (error) {
      next(error);
    }
  }

  async createProducto(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const dto: CreateProductoDTO = req.body;
      const producto = await productosService.createProducto(dto);

      res.status(201).json({
        success: true,
        data: producto,
        message: 'Producto creado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProducto(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const dto: UpdateProductoDTO = req.body;
      const producto = await productosService.updateProducto(id, dto);

      res.json({
        success: true,
        data: producto,
        message: 'Producto actualizado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteProducto(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      await productosService.deleteProducto(id);

      res.json({
        success: true,
        message: 'Producto eliminado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  // ================== VARIANTES ==================

  async getVariantesByProducto(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const idProducto = parseInt(req.params.idProducto);
      const variantes = await productosService.getVariantesByProducto(idProducto);

      res.json({
        success: true,
        data: variantes,
      });
    } catch (error) {
      next(error);
    }
  }

  async createVariante(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const dto: CreateVarianteDTO = req.body;
      const variante = await productosService.createVariante(dto);

      res.status(201).json({
        success: true,
        data: variante,
        message: 'Variante creada exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteVariante(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      await productosService.deleteVariante(id);

      res.json({
        success: true,
        message: 'Variante eliminada exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  // ================== RECETAS ==================

  async getRecetaByProducto(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const idProducto = parseInt(req.params.idProducto);
      const receta = await productosService.getRecetaByProducto(idProducto);

      res.json({
        success: true,
        data: receta,
      });
    } catch (error) {
      next(error);
    }
  }

  async createRecetaDetalle(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const dto: CreateRecetaDTO = req.body;
      const receta = await productosService.createRecetaDetalle(dto);

      res.status(201).json({
        success: true,
        data: receta,
        message: 'Detalle de receta creado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteRecetaDetalle(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      await productosService.deleteRecetaDetalle(id);

      res.json({
        success: true,
        message: 'Detalle de receta eliminado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const productosController = new ProductosController();
