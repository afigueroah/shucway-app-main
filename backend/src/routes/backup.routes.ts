import { Router } from 'express';
import multer from 'multer';
import {
	getFullBackup,
	getIncrementalBackup,
	getIncrementalSqlDump,
	getSchemaSqlDump,
	restoreBackup,
} from '../controllers/backup.controller';

const router = Router();

// Configurar multer para subida de archivos
const upload = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: 50 * 1024 * 1024, // 50MB máximo
	},
	fileFilter: (_req, file, cb) => {
		// Solo permitir archivos .sql
		if (file.mimetype === 'application/sql' || file.originalname.endsWith('.sql')) {
			cb(null, true);
		} else {
			cb(new Error('Solo se permiten archivos .sql'));
		}
	},
});

// Ruta para backup completo
router.get('/full', getFullBackup);

// Ruta para backup incremental (simulado para free tier)
router.get('/incremental', getIncrementalBackup);
router.get('/schema-sql', getSchemaSqlDump);
router.get('/incremental-sql', getIncrementalSqlDump);

// Ruta para restaurar backup
router.post('/restore', upload.single('backupFile'), restoreBackup);

export default router;