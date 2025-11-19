import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/express.types';
import { clientesService } from '../services/clientes.service';
import { CreateClienteDTO, UpdateClienteDTO, CanjearPuntosDTO, GestionarPuntosDTO } from '../types/ventas.types';

// ================================================================
// 👥 CONTROLADOR DE CLIENTES
// ================================================================

export class ClientesController {
  async getClientes(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const clientes = await clientesService.getClientes();
      res.json({
        success: true,
        data: clientes,
      });
    } catch (error) {
      next(error);
    }
  }

  async getClienteById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const cliente = await clientesService.getClienteById(id);

      if (!cliente) {
        res.status(404).json({
          success: false,
          message: 'Cliente no encontrado',
        });
        return;
      }

      res.json({
        success: true,
        data: cliente,
      });
    } catch (error) {
      next(error);
    }
  }

  async buscarPorTelefono(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const telefono = req.params.telefono;
      const cliente = await clientesService.buscarClientePorTelefono(telefono);

      if (!cliente) {
        res.status(404).json({
          success: false,
          message: 'Cliente no encontrado',
        });
        return;
      }

      res.json({
        success: true,
        data: cliente,
      });
    } catch (error) {
      next(error);
    }
  }

  async createCliente(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const dto: CreateClienteDTO = req.body;
      const cliente = await clientesService.createCliente(dto);

      res.status(201).json({
        success: true,
        data: cliente,
        message: 'Cliente creado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  async updateCliente(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const dto: UpdateClienteDTO = req.body;
      const cliente = await clientesService.updateCliente(id, dto);

      res.json({
        success: true,
        data: cliente,
        message: 'Cliente actualizado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteCliente(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      await clientesService.deleteCliente(id);

      res.json({
        success: true,
        message: 'Cliente eliminado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  // ================== PUNTOS ==================

  async consultarPuntos(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const idCliente = parseInt(req.params.id);
      const puntos = await clientesService.consultarPuntos(idCliente);

      res.json({
        success: true,
        data: {
          id_cliente: idCliente,
          puntos,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async gestionarPuntos(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const idCliente = parseInt(req.params.id);
      const dto: GestionarPuntosDTO = req.body;

      const resultado = await clientesService.gestionarPuntos(idCliente, dto);

      res.json({
        success: true,
        message: `Puntos ${dto.operacion === 'agregar' ? 'agregados' : 'restados'} exitosamente`,
        data: resultado,
      });
    } catch (error) {
      next(error);
    }
  }

  async canjearPuntos(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const dto: CanjearPuntosDTO = req.body;
      await clientesService.canjearPuntos(dto);

      res.json({
        success: true,
        message: 'Puntos canjeados exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  async getHistorialPuntos(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const idCliente = parseInt(req.params.id);
      const historial = await clientesService.getHistorialPuntos(idCliente);

      res.json({
        success: true,
        data: historial,
      });
    } catch (error) {
      next(error);
    }
  }

  async getProductoFavorito(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const idCliente = parseInt(req.params.id);
      const favorito = await clientesService.getProductoFavorito(idCliente);

      res.json({
        success: true,
        data: favorito,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const clientesController = new ClientesController();
