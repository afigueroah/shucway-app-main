import { Router } from 'express';
import { crearOrdenCompra, crearDetalleOrdenCompra } from '../controllers/orden_compra_create.controller';

const router = Router();

router.post('/orden_compra', crearOrdenCompra);
router.post('/detalle_orden_compra', crearDetalleOrdenCompra);

export default router;
