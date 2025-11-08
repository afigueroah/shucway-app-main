import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { logger } from '../utils/logger';

// Middleware genérico de validación
export const validate = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));

        logger.warn('Error de validación:', errors);

        res.status(400).json({
          success: false,
          error: 'Error de validación',
          details: errors
        });
        return;
      }

      logger.error('Error inesperado en validación:', error);
      res.status(500).json({
        success: false,
        error: 'Error al validar datos'
      });
    }
  };
};

// Validación de parámetros de query
export const validateQuery = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));

        res.status(400).json({
          success: false,
          error: 'Error de validación en parámetros',
          details: errors
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Error al validar parámetros'
      });
    }
  };
};

// Validación de parámetros de ruta
export const validateParams = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.params);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));

        res.status(400).json({
          success: false,
          error: 'Error de validación en parámetros de ruta',
          details: errors
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Error al validar parámetros de ruta'
      });
    }
  };
};
