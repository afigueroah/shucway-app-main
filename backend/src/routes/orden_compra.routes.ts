import { Router } from 'express';
import supabase from '../config/database';
import { getOrdenesCompra, getOrdenCompraById, updateOrdenCompra, deleteOrdenCompra, getDetallesOrdenCompra } from '../controllers/orden_compra.controller';
import { crearOrdenCompra, crearDetalleOrdenCompra } from '../controllers/orden_compra_create.controller';
import { validate } from '../middlewares/validator.middleware';
import { authenticateToken } from '../middlewares/auth.middleware';
import { z } from 'zod';

const router = Router();

// Validación para query params (opcional, e.g., filtros)
const querySchema = z.object({
  estado: z.string().optional(),
});

router.get('/', validate(querySchema), getOrdenesCompra);
router.get('/:id', getOrdenCompraById);
router.get('/:id/detalles', getDetallesOrdenCompra);
router.post('/', authenticateToken, crearOrdenCompra);
router.put('/:id', authenticateToken, updateOrdenCompra);
router.delete('/:id', authenticateToken, deleteOrdenCompra);
router.delete('/:id/detalles', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('detalle_orden_compra')
      .delete()
      .eq('id_orden', id);

    if (error) {
      console.error('Error eliminando detalles de orden:', error);
      return res.status(500).json({ message: 'Error interno del servidor' });
    }

    return res.json({ message: 'Detalles de orden eliminados correctamente' });
  } catch (error) {
    console.error('Error inesperado:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});
router.post('/detalle', authenticateToken, crearDetalleOrdenCompra);

export default router;