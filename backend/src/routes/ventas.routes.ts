import { Router } from 'express';
import { ventasController } from '../controllers/ventas.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import {
  requireCajero,
  requireAdministrador,
} from '../middlewares/roleGuard.middleware';

const router = Router();

// ================================================================
// 💰 RUTAS DE VENTAS
// ================================================================

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// ================== VENTAS ==================
// Nivel mínimo: Cajero (30) para crear y consultar, Administrador (80) para cancelar/eliminar

router.get('/', requireCajero, ventasController.getVentas.bind(ventasController));
router.get('/del-dia', requireCajero, ventasController.getVentasDelDia.bind(ventasController));
router.get('/total', requireCajero, ventasController.getTotalVentas.bind(ventasController));
router.get('/sesion', requireCajero, ventasController.getTotalVentasSesion.bind(ventasController));
router.get('/transferencias-sesion', requireCajero, ventasController.getTransferenciasSesion.bind(ventasController));
router.get('/cajero/:idCajero', requireCajero, ventasController.getVentasPorCajero.bind(ventasController));
router.get('/productos-populares', requireCajero, ventasController.getProductosPopulares.bind(ventasController));
router.get('/productos-recientes', requireCajero, ventasController.getProductosRecientes.bind(ventasController));
router.get('/:idVenta/detalles', requireCajero, ventasController.getDetallesByVenta.bind(ventasController));
router.get('/:id', requireCajero, ventasController.getVentaById.bind(ventasController));

router.post('/', requireCajero, ventasController.createVenta.bind(ventasController));

router.put('/:id/estado', requireAdministrador, ventasController.updateEstadoVenta.bind(ventasController));
router.put('/:id/transferencia', requireCajero, ventasController.updateEstadoTransferencia.bind(ventasController));
router.post('/:id/cancelar', requireAdministrador, ventasController.cancelarVenta.bind(ventasController));
router.delete('/:id', requireAdministrador, ventasController.deleteVenta.bind(ventasController));

// ================== DETALLES DE VENTA ==================
// Nivel mínimo: Cajero (30)


export default router;
