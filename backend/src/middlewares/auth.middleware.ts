import { Response, NextFunction } from 'express';
import { jwt } from '../utils/jwt';                 // ⬅️ usa el wrapper
import { config } from '../config/env';
import { AuthRequest, AuthUser } from '../types/express.types';
import { logger } from '../utils/logger';

const JWT_SECRET = config.jwt.secret;
const isDevelopment = config.env === 'development';

// Middleware para verificar el token JWT
export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

    // Solo logs detallados en desarrollo, pero excluir rutas de alta frecuencia
    const rutasAltaFrecuencia = ['/api/caja/estado', '/api/auth/validate'];
    const debeLoguear = isDevelopment && !rutasAltaFrecuencia.includes(req.path);

    if (debeLoguear) {
      logger.info(`🔍 Auth Check - Path: ${req.path}`);
      logger.info(`🔍 Auth Header: ${authHeader ? 'Presente' : 'Ausente'}`);
      logger.info(
        `🔍 Token: ${
          token ? 'Presente (primeros 20 chars): ' + token.substring(0, 20) + '...' : 'Ausente'
        }`
      );
    }

    if (!token) {
      logger.warn(`❌ Token no proporcionado - Path: ${req.path}`);
      res.status(401).json({ success: false, error: 'Token no proporcionado' });
      return;
    }

    // Verificar token
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;

      if (!decoded.role || !decoded.role.nombre_rol) {
        logger.error('❌ Token no contiene información de rol válida');
        res.status(403).json({ success: false, error: 'Token inválido - falta información de rol' });
        return;
      }

      req.user = decoded;

      // Solo log detallado en desarrollo para rutas no de alta frecuencia
      const rutasAltaFrecuencia = ['/api/caja/estado', '/api/auth/validate'];
      const debeLoguearExito = isDevelopment && !rutasAltaFrecuencia.includes(req.path);

      if (debeLoguearExito) {
        logger.info(`✅ Token válido - Usuario: ${req.user.email} (${req.user.role.nombre_rol})`);
      } else if (!isDevelopment) {
        // En producción, log más conciso
        logger.info(`✅ Auth - ${req.path} - ${req.user.email}`);
      }

      next();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'verify error';
      logger.warn(`❌ Token inválido: ${errorMessage}`);
      res.status(403).json({
        success: false,
        error: 'Token inválido o expirado',
        details: errorMessage
      });
    }
  } catch (error) {
    logger.error('Error en authenticateToken:', error);
    res.status(500).json({ success: false, error: 'Error al verificar autenticación' });
  }
};

// Middleware para verificar roles específicos
export const requireRoles = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado' });
        return;
      }

      const userRole = req.user.role.nombre_rol;
      const hasRole = allowedRoles.includes(userRole);

      if (!hasRole) {
        logger.warn(
          `Usuario ${req.user.id_perfil} sin permisos. Requerido: ${allowedRoles.join(', ')}. Tiene: ${userRole}`
        );
        res.status(403).json({ success: false, error: 'No tienes permisos para realizar esta acción' });
        return;
      }

      next();
    } catch (error) {
      logger.error('Error en requireRoles:', error);
      res.status(500).json({ success: false, error: 'Error al verificar permisos' });
    }
  };
};

// Autenticación opcional (no falla si no hay token)
export const optionalAuth = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

    if (token) {
      try {
        req.user = jwt.verify(token, JWT_SECRET) as AuthUser;
      } catch {
        // Silencioso: si falla el token opcional, seguimos sin user
      }
    }

    next();
  } catch (error) {
    logger.error('Error en optionalAuth:', error);
    next();
  }
};
