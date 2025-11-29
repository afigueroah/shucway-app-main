import { Router } from 'express';
import { cajaController } from '../controllers/caja.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticateToken);

router.get('/estado', cajaController.getEstado.bind(cajaController));
router.post('/abrir', cajaController.abrirCaja.bind(cajaController));
router.post('/cerrar', cajaController.cerrarCaja.bind(cajaController));
router.get('/arqueos', cajaController.getArqueos.bind(cajaController));
router.delete('/arqueos/:id', cajaController.deleteArqueo.bind(cajaController));

export default router;
