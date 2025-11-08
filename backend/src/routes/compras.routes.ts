import { Router } from 'express';
import { ComprasController } from '../controllers/compras.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validator.middleware';
import {
  createProveedorSchema,
  updateProveedorSchema,
} from '../validators/compras.validators';

const router = Router();
const comprasController = new ComprasController();

// ================== PROVEEDORES ==================

router.get('/proveedores', authenticateToken, comprasController.getProveedores.bind(comprasController));
router.get('/proveedores/:id', authenticateToken, comprasController.getProveedorById.bind(comprasController));
router.post(
  '/proveedores',
  authenticateToken,
  validate(createProveedorSchema),
  comprasController.createProveedor.bind(comprasController)
);
router.put(
  '/proveedores/:id',
  authenticateToken,
  validate(updateProveedorSchema),
  comprasController.updateProveedor.bind(comprasController)
);
router.delete('/proveedores/:id', authenticateToken, comprasController.deleteProveedor.bind(comprasController));
router.get('/proveedores/:id/insumos', authenticateToken, comprasController.getInsumosByProveedor.bind(comprasController));

export default router;