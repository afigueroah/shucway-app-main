import { Router } from 'express';
import {
	getFullBackup,
	getIncrementalBackup,
	getIncrementalSqlDump,
	getSchemaSqlDump,
} from '../controllers/backup.controller';

const router = Router();

// Ruta para backup completo
router.get('/full', getFullBackup);

// Ruta para backup incremental (simulado para free tier)
router.get('/incremental', getIncrementalBackup);
router.get('/schema-sql', getSchemaSqlDump);
router.get('/incremental-sql', getIncrementalSqlDump);

export default router;