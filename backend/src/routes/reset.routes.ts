import { Router } from 'express';
import { resetController } from '../controllers/reset.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticateToken);

router.post('/all', resetController.resetAll);
router.post('/:module', resetController.resetModule);

export default router;