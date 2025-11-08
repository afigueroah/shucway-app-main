import express, { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware';
import {
  getGastosOperativos,
  getGastoById,
  getGastoPorFechas,
  getGastoPorCategoria,
  createGasto,
  updateGasto,
  deleteGasto,
  getResumenGastos,
  getCategoriasGasto,
} from '../controllers/gastos_operativos.controller';

const router: Router = express.Router();

// Middlewares de autenticación aplicados a todas las rutas
router.use(authenticateToken);

// GET: Listar todos los gastos operativos
router.get('/', getGastosOperativos);

// GET: Obtener resumen/estadísticas
router.get('/resumen', getResumenGastos);

// GET: Catálogo de categorías válidas
router.get('/categorias', getCategoriasGasto);

// GET: Filtrar por rango de fechas
router.get('/fechas', getGastoPorFechas);

// GET: Filtrar por categoría
router.get('/categoria', getGastoPorCategoria);

// GET: Obtener gasto por ID (debe ir después de rutas específicas)
router.get('/:id', getGastoById);

// POST: Crear nuevo gasto
router.post('/', createGasto);

// PUT: Actualizar gasto
router.put('/:id', updateGasto);

// DELETE: Eliminar gasto
router.delete('/:id', deleteGasto);

export default router;
