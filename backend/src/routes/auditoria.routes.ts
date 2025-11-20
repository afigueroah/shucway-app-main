import { Router, Response } from 'express';
import { supabase } from '../config/database';
import { authenticateToken } from '../middlewares/auth.middleware';
import { AuthRequest } from '../types/express.types';

const router = Router();

/**
 * GET /auditoria/test-auth
 * Endpoint de prueba para verificar autenticación
 */
router.get('/test-auth', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    console.log('✅ Test auth exitoso:', {
      userId: req.user?.id_perfil,
      userEmail: req.user?.email,
      userRole: req.user?.role?.nombre_rol
    });
    return res.json({
      success: true,
      message: 'Autenticación exitosa',
      user: {
        id: req.user?.id_perfil,
        email: req.user?.email,
        role: req.user?.role?.nombre_rol
      }
    });
  } catch (error) {
    console.error('Error en test auth:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /auditoria/detalle/:id_auditoria
 * Carga los detalles de una auditoría (auditoria_detalle)
 * Respeta RLS del backend
 */
router.get('/detalle/:id_auditoria', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id_auditoria } = req.params;
    const userId = req.user?.id_perfil;
    const userRole = req.user?.role?.nombre_rol;

    console.log('🔍 Cargando detalles de auditoría:', {
      id_auditoria,
      userId,
      userRole,
      userEmail: req.user?.email
    });

    if (!id_auditoria || isNaN(Number(id_auditoria))) {
      return res.status(400).json({ error: 'ID de auditoría inválido' });
    }

    // Usar Supabase del backend (con permisos de servidor)
    // Primero verificar que la auditoría existe
    const { data: auditoriaExists, error: checkError } = await supabase
      .from('auditoria_inventario')
      .select('id_auditoria')
      .eq('id_auditoria', Number(id_auditoria))
      .single();

    if (checkError || !auditoriaExists) {
      console.error('❌ Auditoría no encontrada:', {
        id_auditoria,
        error: checkError?.message,
        exists: !!auditoriaExists
      });
      return res.status(404).json({ error: 'Auditoría no encontrada' });
    }

    console.log('✅ Auditoría existe:', auditoriaExists);

    // Verificar permisos del usuario para esta auditoría
    // Por ahora, permitir acceso a todos los usuarios autenticados
    console.log('🔍 Usuario autorizado para acceder a auditoría:', {
      userId: req.user?.id_perfil,
      userRole: req.user?.role?.nombre_rol,
      auditoriaId: id_auditoria
    });

    // Primero intentar una consulta simple sin joins
    const { data: simpleData, error: simpleError } = await supabase
      .from('auditoria_detalle')
      .select('id_detalle, id_insumo, stock_esperado, conteo_fisico')
      .eq('id_auditoria', Number(id_auditoria))
      .limit(5);

    if (simpleError) {
      console.error('❌ Error en consulta simple:', {
        error: simpleError.message,
        code: simpleError.code,
        details: simpleError.details
      });
      return res.status(500).json({
        error: 'Error en consulta simple',
        details: simpleError.message
      });
    }

    console.log('✅ Consulta simple exitosa, registros encontrados:', simpleData?.length || 0);

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
      console.error('❌ Error cargando auditoria_detalle:', {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        id_auditoria,
        userId
      });
      return res.status(500).json({ error: 'Error al cargar detalles de auditoría', details: error.message });
    }

    console.log('✅ Detalles de auditoría cargados exitosamente:', {
      id_auditoria,
      registros: data?.length || 0,
      userId
    });

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

    if (!id_auditoria || isNaN(Number(id_auditoria))) {
      return res.status(400).json({ error: 'ID de auditoría inválido' });
    }

    // Actualizar el estado de la auditoría a 'cancelada'
    const { error } = await supabase
      .from('auditoria_inventario')
      .update({
        estado: 'cancelada'
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
 * POST /auditoria/cancelar-todas
 * Cancela todas las auditorías en progreso
 */
router.post('/cancelar-todas', authenticateToken, async (_req: AuthRequest, res: Response) => {
  try {

    // Actualizar el estado de todas las auditorías en progreso a 'cancelada'
    const { error } = await supabase
      .from('auditoria_inventario')
      .update({
        estado: 'cancelada'
      })
      .eq('estado', 'en_progreso');

    if (error) {
      console.error('Error cancelando todas las auditorías:', error);
      return res.status(500).json({ error: 'Error al cancelar auditorías' });
    }

    return res.json({ message: 'Todas las auditorías en progreso han sido canceladas exitosamente' });
  } catch (error) {
    console.error('Error en POST /auditoria/cancelar-todas:', error);
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
