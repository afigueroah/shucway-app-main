import { Router } from 'express';
import { usuariosController } from '../controllers/usuarios.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { requireCajero, requireAdministrador, requirePropietario } from '../middlewares/roleGuard.middleware';
import { AuthRequest } from '../types/express.types';

const router = Router();

// ================================================================
// 👥 RUTAS DE USUARIOS
// ================================================================

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// 🧪 ENDPOINT DE PRUEBA - Sin protección de roles (solo autenticación)
router.get('/test', (req: AuthRequest, res) => {
  res.json({
    success: true,
    message: 'Token válido - autenticación funcionando',
    user: req.user
  });
});

// Obtener usuarios (paginado con filtros) - Requiere Cajero (nivel 30)
router.get('/', requireCajero, usuariosController.getUsuarios);

// Verificar si email existe - Requiere Cajero (nivel 30) - DEBE IR ANTES DE /:id
router.get('/check-email', requireCajero, usuariosController.checkEmailExists);

// Verificar si username existe - Requiere Cajero (nivel 30) - DEBE IR ANTES DE /:id
router.get('/check-username', requireCajero, usuariosController.checkUsernameExists);

// Crear nuevo usuario - Requiere Propietario (nivel 100)
router.post('/', requirePropietario, usuariosController.createUsuario);

// Obtener estadísticas de usuarios - Requiere Administrador (nivel 80)
router.get('/estadisticas', requireAdministrador, usuariosController.getEstadisticas);

// Obtener un usuario por ID - Requiere Cajero (nivel 30)
router.get('/:id', requireCajero, usuariosController.getUsuarioById);

// Actualizar usuario - Requiere Administrador (nivel 80)
router.put('/:id', requireAdministrador, usuariosController.updateUsuario);

// Cambiar estado de usuario - Requiere Administrador (nivel 80)
router.patch('/:id/estado', requireAdministrador, usuariosController.cambiarEstado);

// Eliminar usuario (soft delete) - Requiere Administrador (nivel 80)
router.delete('/:id', requireAdministrador, usuariosController.deleteUsuario);

// Obtener roles de un usuario - Requiere Cajero (nivel 30)
router.get('/:id/roles', requireCajero, usuariosController.getRolesByUsuario);

// Asignar rol a usuario - Requiere Administrador (nivel 80)
router.post('/:id/roles', requireAdministrador, usuariosController.asignarRol);

// Remover rol de usuario - Requiere Administrador (nivel 80)
router.delete('/:idUsuario/roles', requireAdministrador, usuariosController.removerRol);

// Obtener todos los roles disponibles - Requiere Cajero (nivel 30)
router.get('/roles/all', requireCajero, usuariosController.getRoles);

// Eliminar rol - Requiere Administrador (nivel 80)
router.delete('/roles/:id', requireAdministrador, usuariosController.deleteRol);

// Obtener rol por ID - Requiere Administrador (nivel 80)
router.get('/roles/:id', requireAdministrador, usuariosController.getRolById);

// Obtener usuarios por rol - Requiere Cajero (nivel 30)
router.get('/roles/:idRol/usuarios', requireCajero, usuariosController.getUsuariosByRol);

// Crear nuevo rol - Requiere Propietario (nivel 100)
router.post('/roles', requireAdministrador, usuariosController.createRol);

// Actualizar rol - Requiere Propietario (nivel 100)
router.put('/roles/:id', requireAdministrador, usuariosController.updateRol);

export default router;
