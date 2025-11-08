import { Router, Response } from 'express';
import { supabase } from '../config/database';
import { authenticateToken } from '../middlewares/auth.middleware';
import { AuthRequest } from '../types/express.types';

const router = Router();

/**
 * GET /auditoria/detalle/:id_auditoria
 * Carga los detalles de una auditoría (auditoria_detalle)
 * Respeta RLS del backend
 */
router.get('/detalle/:id_auditoria', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id_auditoria } = req.params;

    if (!id_auditoria || isNaN(Number(id_auditoria))) {
      return res.status(400).json({ error: 'ID de auditoría inválido' });
    }

    // Usar Supabase del backend (con permisos de servidor)
    const { data, error } = await supabase
      .from('auditoria_detalle')
      .select(`
        id_detalle,
        id_insumo,
        tipo_categoria,
        stock_esperado,
        conteo_fisico,
        diferencia,
        causa_ajuste,
        notas,
        insumo (
          nombre_insumo,
          unidad_base,
          categoria_insumo (
            nombre
          )
        )
      `)
      .eq('id_auditoria', Number(id_auditoria))
      .order('tipo_categoria', { ascending: true })
      .order('id_insumo', { ascending: true });

    if (error) {
      console.error('Error cargando auditoria_detalle:', error);
      return res.status(500).json({ error: 'Error al cargar detalles de auditoría' });
    }

    return res.json(data || []);
  } catch (error) {
    console.error('Error en GET /auditoria/detalle:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /auditoria/lista
 * Carga la lista de auditorías activas
 */
router.get('/lista', authenticateToken, async (_req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('auditoria_inventario')
      .select('*')
      .eq('estado', 'en_progreso')
      .order('fecha_creacion', { ascending: false });

    if (error) {
      console.error('Error cargando auditorías:', error);
      return res.status(500).json({ error: 'Error al cargar auditorías' });
    }

    return res.json(data || []);
  } catch (error) {
    console.error('Error en GET /auditoria/lista:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /auditoria/cancelar/:id_auditoria
 * Cancela una auditoría en progreso
 */
router.post('/cancelar/:id_auditoria', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id_auditoria } = req.params;
    const { motivo } = req.body;

    if (!id_auditoria || isNaN(Number(id_auditoria))) {
      return res.status(400).json({ error: 'ID de auditoría inválido' });
    }

    // Actualizar el estado de la auditoría a 'cancelada'
    const { error } = await supabase
      .from('auditoria_inventario')
      .update({
        estado: 'cancelada',
        observaciones: motivo || 'Cancelada por el usuario',
        fecha_finalizacion: new Date().toISOString()
      })
      .eq('id_auditoria', Number(id_auditoria));

    if (error) {
      console.error('Error cancelando auditoría:', error);
      return res.status(500).json({ error: 'Error al cancelar auditoría' });
    }

    return res.json({ message: 'Auditoría cancelada exitosamente' });
  } catch (error) {
    console.error('Error en POST /auditoria/cancelar:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /auditoria/completadas/count
 * Cuenta las auditorías completadas
 */
router.get('/completadas/count', authenticateToken, async (_req: AuthRequest, res: Response) => {
  try {
    const { count, error } = await supabase
      .from('auditoria_inventario')
      .select('*', { count: 'exact', head: true })
      .eq('estado', 'completada');

    if (error) {
      console.error('Error contando auditorías completadas:', error);
      return res.status(500).json({ error: 'Error al contar auditorías' });
    }

    return res.json({ count: count || 0 });
  } catch (error) {
    console.error('Error en GET /auditoria/completadas/count:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /auditoria/pendientes/count
 * Cuenta las auditorías pendientes (en_progreso)
 */
router.get('/pendientes/count', authenticateToken, async (_req: AuthRequest, res: Response) => {
  try {
    const { count, error } = await supabase
      .from('auditoria_inventario')
      .select('*', { count: 'exact', head: true })
      .eq('estado', 'en_progreso');

    if (error) {
      console.error('Error contando auditorías pendientes:', error);
      return res.status(500).json({ error: 'Error al contar auditorías' });
    }

    return res.json({ count: count || 0 });
  } catch (error) {
    console.error('Error en GET /auditoria/pendientes/count:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
