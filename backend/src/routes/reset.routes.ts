import { Router } from 'express';
import { resetController } from '../controllers/reset.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticateToken);

router.post('/:module', resetController.resetModule);
router.post('/all', resetController.resetAll);

export default router;