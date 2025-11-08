import { Response, NextFunction } from 'express';
import { cajaService } from '../services/caja.service';
import { AuthRequest } from '../types/express.types';
import { AbrirCajaDTO, CerrarCajaDTO } from '../types/caja.types';

export class CajaController {
  async getEstado(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const estado = await cajaService.getEstado();
      res.json({ success: true, data: estado });
    } catch (error) {
      next(error);
    }
  }

  async abrirCaja(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const idCajero = req.user?.id_perfil;
      if (!idCajero) {
        res.status(401).json({ success: false, message: 'Usuario no autenticado' });
        return;
      }

      const dto = req.body as AbrirCajaDTO;
      const sesion = await cajaService.abrirCaja(idCajero, dto);
      res.status(201).json({ success: true, data: sesion, message: 'Caja abierta correctamente.' });
    } catch (error) {
      next(error);
    }
  }

  async cerrarCaja(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const idCajero = req.user?.id_perfil;
      if (!idCajero) {
        res.status(401).json({ success: false, message: 'Usuario no autenticado' });
        return;
      }

      const dto = req.body as CerrarCajaDTO;
      const sesion = await cajaService.cerrarCaja(idCajero, dto);
      res.json({ success: true, data: sesion, message: 'Caja cerrada correctamente.' });
    } catch (error) {
      next(error);
    }
  }
}

export const cajaController = new CajaController();
