import { Router } from 'express';
import { inventarioController } from '../controllers/inventario.controller';
import { ComprasController } from '../controllers/compras.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import {
  requireCajero,
  requireAdministrador,
} from '../middlewares/roleGuard.middleware';

const router = Router();
const comprasController = new ComprasController();

console.log('[BACKEND] Cargando rutas de inventario...');

// ================================================================
// 📦 RUTAS DE INVENTARIO
// ================================================================

// Todas las rutas requieren autenticación
router.use(authenticateToken);

console.log('[BACKEND] Registrando rutas de inventario...');

// ================== INSUMOS - RUTAS ESPECÍFICAS ==================
// Nivel mínimo: Cajero (30) para consultar, Administrador (80) para modificar

// Ruta de prueba para verificar que las rutas se registran
console.log('[BACKEND] Registrando ruta de prueba GET /test');
router.get('/test', (_req, res) => {
  console.log('[BACKEND] Ruta de prueba accedida');
  res.json({ success: true, message: 'Ruta de prueba funcionando' });
});

// Ruta más específica primero para evitar conflictos
console.log('[BACKEND] Registrando ruta GET /insumos/:id/presentaciones');
router.get('/insumos/:id/presentaciones', requireCajero, inventarioController.getPresentacionesByInsumo.bind(inventarioController));

// ================== PROVEEDORES ==================
// Nivel mínimo: Cajero (30) para consultar

router.get('/proveedores', requireCajero, comprasController.getProveedores.bind(comprasController));

// ================== CATEGORÍAS DE INSUMOS ==================
// Nivel mínimo: Cajero (30) para consultar, Administrador (80) para modificar

router.get('/categorias', requireCajero, inventarioController.getCategoriasInsumo.bind(inventarioController));
router.get('/categorias/:id', requireCajero, inventarioController.getCategoriaInsumoById.bind(inventarioController));

// ================== INSUMOS ==================
// Nivel mínimo: Cajero (30) para consultar, Administrador (80) para modificar

router.get('/insumos', requireCajero, inventarioController.getInsumos.bind(inventarioController));

// Rutas más específicas primero
router.get('/insumos/:id/details', requireCajero, inventarioController.getInsumoDetails.bind(inventarioController));
router.get('/insumos/:id', requireCajero, inventarioController.getInsumoById.bind(inventarioController));

router.post('/insumos', requireAdministrador, inventarioController.createInsumo.bind(inventarioController));
router.put('/insumos/:id', requireAdministrador, inventarioController.updateInsumo.bind(inventarioController));
router.delete('/insumos/:id', requireAdministrador, inventarioController.deleteInsumo.bind(inventarioController));

// Ruta adicional para catálogo con joins
router.get('/catalogo', requireCajero, inventarioController.getCatalogoInsumos.bind(inventarioController));

// ================== PRESENTACIONES ==================
// Nivel mínimo: Administrador (80) para modificar
router.put('/presentaciones/:id', requireAdministrador, inventarioController.updatePresentacion.bind(inventarioController));

// ================== LOTES ==================
// Nivel mínimo: Administrador (80) para modificar
router.put('/lotes/:id', requireAdministrador, inventarioController.updateLote.bind(inventarioController));

router.get('/insumos/:idInsumo/lotes', requireCajero, inventarioController.getLotesByInsumo.bind(inventarioController));
router.get('/lotes/:id', requireCajero, inventarioController.getLoteById.bind(inventarioController));
router.post('/lotes', requireAdministrador, inventarioController.createLote.bind(inventarioController));
router.delete('/lotes/:id', requireAdministrador, inventarioController.deleteLote.bind(inventarioController));

// ================== MOVIMIENTOS ==================
// Nivel mínimo: Cajero (30) para consultar y registrar

router.get('/movimientos', requireCajero, inventarioController.getMovimientos.bind(inventarioController));
router.post('/movimientos', requireCajero, inventarioController.createMovimiento.bind(inventarioController));

// ================== STOCK ==================
// Nivel mínimo: Cajero (30)

router.get('/stock', requireCajero, inventarioController.getStockActual.bind(inventarioController));
router.get('/stock/bajo', requireCajero, inventarioController.getInsumosStockBajo.bind(inventarioController));

// ================== RECEPCIONES DE MERCADERÍA ==================
// Nivel mínimo: Cajero (30)

router.get('/recepciones-mercaderia', requireCajero, inventarioController.getRecepcionesMercaderia.bind(inventarioController));
router.post('/recepcion-mercaderia', requireCajero, inventarioController.createRecepcionMercaderia.bind(inventarioController));
router.patch('/recepciones-mercaderia/:id/factura', requireCajero, inventarioController.updateRecepcionFactura.bind(inventarioController));
router.post('/detalle-recepcion-mercaderia', requireCajero, inventarioController.createDetalleRecepcionMercaderia.bind(inventarioController));
router.delete('/recepciones-mercaderia/:id', requireAdministrador, inventarioController.deleteRecepcionMercaderia.bind(inventarioController));

console.log('[BACKEND] Rutas de recepción registradas:');
console.log('- GET /recepciones-mercaderia');
console.log('- POST /recepcion-mercaderia');
console.log('- PATCH /recepciones-mercaderia/:id/factura');
console.log('- POST /detalle-recepcion-mercaderia');
console.log('- DELETE /recepciones-mercaderia/:id');

export default router;
