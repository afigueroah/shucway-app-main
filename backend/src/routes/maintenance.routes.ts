import { Router } from 'express';
import { maintenanceController } from '../controllers/maintenance.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticateToken);

router.get('/tables', maintenanceController.listTables);
router.get('/tables/:tableName/columns', maintenanceController.getTableColumns);
router.get('/tables/:tableName/records', maintenanceController.getTableData);
router.post('/tables/:tableName/records', maintenanceController.createRecord);
router.put('/tables/:tableName/records/:id', maintenanceController.updateRecord);
router.delete('/tables/:tableName/records/:id', maintenanceController.deleteRecord);

export default router;
