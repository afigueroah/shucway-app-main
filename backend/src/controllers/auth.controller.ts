import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { logger } from '../utils/logger';
import { AuthRequest } from '../types';

import { UsuariosService } from '../services/usuarios.service';

export class AuthController {
  // GET /api/auth/profile
  async profile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id_perfil;
      if (!userId) {
        res.status(401).json({ success: false, message: 'No autenticado' });
        return;
      }
      // Obtener perfil completo con rol
      const perfil = await new UsuariosService().getUsuarioById(userId);
      if (!perfil) {
        res.status(404).json({ success: false, message: 'Perfil no encontrado' });
        return;
      }
      res.status(200).json({ success: true, data: perfil });
  } catch (error: unknown) {
      logger.error('Error en profile controller:', error);
  const statusCode = typeof error === 'object' && error && 'statusCode' in error ? (error as { statusCode?: number }).statusCode : 500;
  const errorMsg = typeof error === 'object' && error && 'message' in error ? (error as { message?: string }).message : 'Error al obtener perfil';
  res.status(statusCode ?? 500).json({
        success: false,
        error: errorMsg
      });
    }
  }
  // POST /api/auth/register
  async register(req: Request, res: Response): Promise<void> {
    try {
      const user = await authService.register(req.body);

      res.status(201).json({
        success: true,
        data: user,
        message: 'Usuario registrado exitosamente'
      });
  } catch (error: unknown) {
      logger.error('Error en register controller:', error);
  const statusCode = typeof error === 'object' && error && 'statusCode' in error ? (error as { statusCode?: number }).statusCode : 500;
  const errorMsg = typeof error === 'object' && error && 'message' in error ? (error as { message?: string }).message : 'Error al registrar usuario';
  res.status(statusCode ?? 500).json({
        success: false,
        error: errorMsg
      });
    }
  }

  // POST /api/auth/login
  async login(req: Request, res: Response): Promise<void> {
    try {
      const result = await authService.login(req.body);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Login exitoso'
      });
  } catch (error: unknown) {
      logger.error('Error en login controller:', error);
  const statusCode = typeof error === 'object' && error && 'statusCode' in error ? (error as { statusCode?: number }).statusCode : 500;
  const errorMsg = typeof error === 'object' && error && 'message' in error ? (error as { message?: string }).message : 'Error al iniciar sesión';
  res.status(statusCode ?? 500).json({
        success: false,
        error: errorMsg
      });
    }
  }

  // GET /api/auth/validate
  async validateToken(req: AuthRequest, res: Response): Promise<void> {
    try {
      // El middleware ya validó el token
      res.status(200).json({
        success: true,
        data: req.user,
        message: 'Token válido'
      });
  } catch (error: unknown) {
      logger.error('Error en validateToken controller:', error);
  const statusCode = typeof error === 'object' && error && 'statusCode' in error ? (error as { statusCode?: number }).statusCode : 500;
  const errorMsg = typeof error === 'object' && error && 'message' in error ? (error as { message?: string }).message : 'Error al validar token';
  res.status(statusCode ?? 500).json({
        success: false,
        error: errorMsg
      });
    }
  }

  // POST /api/auth/refresh
  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          error: 'Refresh token no proporcionado'
        });
        return;
      }

      const result = await authService.refreshToken(refreshToken);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Token renovado exitosamente'
      });
  } catch (error: unknown) {
      logger.error('Error en refreshToken controller:', error);
  const statusCode = typeof error === 'object' && error && 'statusCode' in error ? (error as { statusCode?: number }).statusCode : 500;
  const errorMsg = typeof error === 'object' && error && 'message' in error ? (error as { message?: string }).message : 'Error al renovar token';
  res.status(statusCode ?? 500).json({
        success: false,
        error: errorMsg
      });
    }
  }

  // POST /api/auth/logout
  async logout(req: AuthRequest, res: Response): Promise<void> {
    try {
      // En JWT no hay "logout" real en el backend
      // El cliente simplemente elimina el token
      logger.info(`Logout: usuario ${req.user?.id_perfil}`);

      res.status(200).json({
        success: true,
        message: 'Logout exitoso'
      });
  } catch (error: unknown) {
      logger.error('Error en logout controller:', error);
      res.status(500).json({
        success: false,
        error: 'Error al cerrar sesión'
      });
    }
  }
}

export const authController = new AuthController();
