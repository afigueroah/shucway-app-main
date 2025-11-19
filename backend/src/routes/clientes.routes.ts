import { Router } from 'express';
import { clientesController } from '../controllers/clientes.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import {
  requireCajero,
  requireAdministrador,
} from '../middlewares/roleGuard.middleware';

const router = Router();

// ================================================================
// 👥 RUTAS DE CLIENTES
// ================================================================

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// ================== CLIENTES ==================
// Nivel mínimo: Cajero (30) para consultar y crear, Administrador (80) para modificar/eliminar

router.get('/', requireCajero, clientesController.getClientes.bind(clientesController));
router.get('/:id', requireCajero, clientesController.getClienteById.bind(clientesController));
router.get('/telefono/:telefono', requireCajero, clientesController.buscarPorTelefono.bind(clientesController));
router.post('/', requireCajero, clientesController.createCliente.bind(clientesController));
router.put('/:id', requireAdministrador, clientesController.updateCliente.bind(clientesController));
router.delete('/:id', requireAdministrador, clientesController.deleteCliente.bind(clientesController));

// ================== PUNTOS ==================
// Nivel mínimo: Cajero (30)

router.get('/:id/puntos', requireCajero, clientesController.consultarPuntos.bind(clientesController));
router.post('/:id/puntos/gestionar', requireCajero, clientesController.gestionarPuntos.bind(clientesController));
router.post('/puntos/canjear', requireCajero, clientesController.canjearPuntos.bind(clientesController));
router.get('/:id/historial-puntos', requireCajero, clientesController.getHistorialPuntos.bind(clientesController));
router.get('/:id/producto-favorito', requireCajero, clientesController.getProductoFavorito.bind(clientesController));

export default router;
