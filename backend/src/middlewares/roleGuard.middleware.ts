import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/express.types';

// ================================================================
// 🔐 MIDDLEWARE DE PERMISOS POR NIVEL
// ================================================================

/**
 * Niveles de permisos según BD-modificado.sql
 */
export enum PermissionLevel {
  PROPIETARIO = 100,
  ADMINISTRADOR = 80,
  CAJERO = 30,
  CLIENTE = 10,
}

/**
 * Middleware para verificar nivel de permisos
 * @param requiredLevel - Nivel mínimo requerido para acceder
 */
export const requirePermission = (requiredLevel: PermissionLevel) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    try {
      // El usuario debe estar autenticado (por authMiddleware)
      const user = req.user;

      if (!user) {
        res.status(401).json({
          success: false,
          message: 'No autenticado',
        });
        return;
      }

      // Verificar si tiene el rol con su nivel
      const userLevel = user.role?.nivel_permisos || 0;

      if (userLevel < requiredLevel) {
        res.status(403).json({
          success: false,
          message: 'No tienes permisos suficientes para acceder a este recurso',
          requiredLevel,
          userLevel,
        });
        return;
      }

      // Usuario tiene permisos suficientes
      next();
    } catch (error) {
      console.error('Error en requirePermission middleware:', error);
      res.status(500).json({
        success: false,
        message: 'Error al verificar permisos',
      });
    }
  };
};

/**
 * Shortcuts para niveles comunes
 */
export const requirePropietario = requirePermission(PermissionLevel.PROPIETARIO);
export const requireAdministrador = requirePermission(PermissionLevel.ADMINISTRADOR);
export const requireCajero = requirePermission(PermissionLevel.CAJERO);
export const requireCliente = requirePermission(PermissionLevel.CLIENTE);

/**
 * Middleware para verificar que el usuario es propietario o está accediendo a su propio recurso
 * @param userIdParam - Nombre del parámetro de ruta que contiene el ID del usuario (ej: 'id', 'userId')
 */
export const requireOwnerOrPropietario = (userIdParam: string = 'id') => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    try {
      const user = req.user;

      if (!user) {
        res.status(401).json({
          success: false,
          message: 'No autenticado',
        });
        return;
      }

      const userLevel = user.role?.nivel_permisos || 0;
      const targetUserId = req.params[userIdParam];

      // Es propietario O está accediendo a su propio perfil
      if (userLevel >= PermissionLevel.PROPIETARIO || user.id_perfil === targetUserId) {
        next();
        return;
      }

      res.status(403).json({
        success: false,
        message: 'No tienes permisos para acceder a este recurso',
      });
    } catch (error) {
      console.error('Error en requireOwnerOrPropietario middleware:', error);
      res.status(500).json({
        success: false,
        message: 'Error al verificar permisos',
      });
    }
  };
};
