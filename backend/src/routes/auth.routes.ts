import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validate } from '../middlewares/validator.middleware';
import { authenticateToken } from '../middlewares/auth.middleware';
import { z } from 'zod';

const router = Router();

// Schemas de validación con Zod
const registerSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  primer_nombre: z.string().min(2, 'El primer nombre debe tener al menos 2 caracteres'),
  primer_apellido: z.string().min(2, 'El primer apellido debe tener al menos 2 caracteres'),
  segundo_nombre: z.string().optional(),
  segundo_apellido: z.string().optional(),
  telefono: z.string().optional(),
  direccion: z.string().optional(),
  username: z.string().optional()
});

const loginSchema = z.object({
  identifier: z.string().min(1, 'Usuario o correo es requerido'), // Acepta email O username
  password: z.string().min(1, 'La contraseña es requerida')
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token es requerido')
});

// Rutas públicas (sin autenticación)
router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshTokenSchema), authController.refreshToken);

// Rutas protegidas (requieren token JWT)
router.get('/validate', authenticateToken, authController.validateToken);
router.get('/profile', authenticateToken, authController.profile);
router.post('/logout', authenticateToken, authController.logout);

export default router;
