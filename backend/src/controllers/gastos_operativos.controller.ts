import { Request, Response } from 'express';
import { supabase } from '../config/database';
import { CategoriaGasto } from '../types/finanzas.types';

const CATEGORIAS_VALIDAS: CategoriaGasto[] = [
  'Gastos de Personal',
  'Servicios Fijos (Mensuales)',
  'Insumos Operativos',
  'Gastos de Transporte',
  'Mantenimiento y Reemplazos',
];

const FRECUENCIAS_VALIDAS = ['quincenal', 'mensual'] as const;
type FrecuenciaValida = (typeof FRECUENCIAS_VALIDAS)[number];

const GASTO_FIELDS = 'id_gasto, numero_gasto, fecha_gasto, fecha_creacion, nombre_gasto, categoria_gasto, detalle, frecuencia, monto, estado';

const isCategoriaValida = (valor: unknown): valor is CategoriaGasto =>
  typeof valor === 'string' && CATEGORIAS_VALIDAS.includes(valor as CategoriaGasto);

const isFrecuenciaValida = (valor: unknown): valor is FrecuenciaValida =>
  typeof valor === 'string' && FRECUENCIAS_VALIDAS.includes(valor as FrecuenciaValida);

/* ============ GET: Listar todos los gastos operativos ============ */
export const getGastosOperativos = async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('gasto_operativo')
      .select(GASTO_FIELDS)
      .order('fecha_gasto', { ascending: false });

    if (error) {
      console.error('Error fetching gastos operativos:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
      return;
    }

    res.json(data || []);
  } catch (err) {
    console.error('Error in getGastosOperativos:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/* ============ GET: Obtener gasto operativo por ID ============ */
export const getGastoById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('gasto_operativo')
      .select(GASTO_FIELDS)
      .eq('id_gasto', id)
      .single();

    if (error || !data) {
      console.error('Error fetching gasto:', error);
      res.status(404).json({ error: 'Gasto operativo no encontrado' });
      return;
    }

    res.json(data);
  } catch (err) {
    console.error('Error in getGastoById:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/* ============ GET: Obtener gastos por rango de fechas ============ */
export const getGastoPorFechas = async (req: Request, res: Response) => {
  try {
    const { fechaInicio, fechaFin } = req.query;

    if (!fechaInicio || !fechaFin) {
      res.status(400).json({ error: 'Debe proporcionar fechaInicio y fechaFin' });
      return;
    }

    const { data, error } = await supabase
      .from('gasto_operativo')
      .select(GASTO_FIELDS)
      .gte('fecha_gasto', fechaInicio as string)
      .lte('fecha_gasto', fechaFin as string)
      .order('fecha_gasto', { ascending: false });

    if (error) {
      console.error('Error fetching gastos por fechas:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
      return;
    }

    res.json(data || []);
  } catch (err) {
    console.error('Error in getGastoPorFechas:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/* ============ GET: Obtener gastos por categoría ============ */
export const getGastoPorCategoria = async (req: Request, res: Response) => {
  try {
    const categoriaQuery = (req.query.categoria || req.query.categoriaId) as string | undefined;

    if (!categoriaQuery || !isCategoriaValida(categoriaQuery)) {
      res.status(400).json({ error: 'Debe proporcionar una categoría válida' });
      return;
    }

    const { data, error } = await supabase
      .from('gasto_operativo')
      .select(GASTO_FIELDS)
      .eq('categoria_gasto', categoriaQuery)
      .order('fecha_gasto', { ascending: false });

    if (error) {
      console.error('Error fetching gastos por categoría:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
      return;
    }

    res.json(data || []);
  } catch (err) {
    console.error('Error in getGastoPorCategoria:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/* ============ POST: Crear nuevo gasto operativo ============ */
export const createGasto = async (req: Request, res: Response) => {
  try {
    const { nombre_gasto, categoria_gasto, detalle, frecuencia, monto, estado } = req.body;
    console.log('🟢 CREATE - Estado recibido:', estado);

    if (!nombre_gasto || !categoria_gasto || !detalle || !frecuencia || monto === undefined) {
      res.status(400).json({ error: 'Faltan campos requeridos' });
      return;
    }

    if (!isCategoriaValida(categoria_gasto)) {
      res.status(400).json({ error: 'Categoría inválida' });
      return;
    }

    if (!isFrecuenciaValida(frecuencia)) {
      res.status(400).json({ error: 'Frecuencia inválida' });
      return;
    }

    const montoNumerico = Number(monto);
    if (Number.isNaN(montoNumerico) || montoNumerico <= 0) {
      res.status(400).json({ error: 'El monto debe ser un número mayor a 0' });
      return;
    }

    const { data, error } = await supabase
      .from('gasto_operativo')
      .insert([
        {
          nombre_gasto: nombre_gasto.trim(),
          categoria_gasto,
          detalle: detalle.trim(),
          frecuencia,
          monto: montoNumerico,
          estado: estado || 'activo',
        },
      ])
      .select(GASTO_FIELDS)
      .single();

    if (error) {
      console.error('Error creating gasto:', error);
      res.status(500).json({ error: 'Error al crear el gasto operativo' });
      return;
    }

    res.status(201).json(data);
  } catch (err) {
    console.error('Error in createGasto:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/* ============ PUT: Actualizar gasto operativo ============ */
export const updateGasto = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { nombre_gasto, categoria_gasto, detalle, frecuencia, monto, estado } = req.body;
    console.log('🔵 UPDATE - Estado recibido:', estado, 'para ID:', id);

    const updateData: Record<string, unknown> = {};

    if (nombre_gasto) {
      updateData.nombre_gasto = String(nombre_gasto).trim();
    }

    if (categoria_gasto !== undefined) {
      if (!isCategoriaValida(categoria_gasto)) {
        res.status(400).json({ error: 'Categoría inválida' });
        return;
      }
      updateData.categoria_gasto = categoria_gasto;
    }

    if (detalle) {
      updateData.detalle = String(detalle).trim();
    }

    if (frecuencia !== undefined) {
      if (!isFrecuenciaValida(frecuencia)) {
        res.status(400).json({ error: 'Frecuencia inválida' });
        return;
      }
      updateData.frecuencia = frecuencia;
    }

    if (monto !== undefined) {
      const montoNumerico = Number(monto);
      if (Number.isNaN(montoNumerico) || montoNumerico <= 0) {
        res.status(400).json({ error: 'El monto debe ser un número mayor a 0' });
        return;
      }
      updateData.monto = montoNumerico;
    }

    if (estado !== undefined) {
      if (estado !== 'activo' && estado !== 'desactivado') {
        res.status(400).json({ error: 'Estado inválido. Debe ser "activo" o "desactivado"' });
        return;
      }
      updateData.estado = estado;
    }

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ error: 'No se proporcionaron campos para actualizar' });
      return;
    }

    const { data, error } = await supabase
      .from('gasto_operativo')
      .update(updateData)
      .eq('id_gasto', id)
      .select(GASTO_FIELDS)
      .single();

    if (error) {
      console.error('Error updating gasto:', error);
      res.status(500).json({ error: 'Error al actualizar el gasto' });
      return;
    }

    if (!data) {
      res.status(404).json({ error: 'Gasto operativo no encontrado' });
      return;
    }

    res.json(data);
  } catch (err) {
    console.error('Error in updateGasto:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/* ============ DELETE: Eliminar gasto operativo ============ */
export const deleteGasto = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('gasto_operativo')
      .delete()
      .eq('id_gasto', id);

    if (error) {
      console.error('Error deleting gasto:', error);
      res.status(500).json({ error: 'Error al eliminar el gasto' });
      return;
    }

    res.json({ message: 'Gasto operativo eliminado correctamente' });
  } catch (err) {
    console.error('Error in deleteGasto:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/* ============ GET: Obtener resumen/estadísticas de gastos ============ */
export const getResumenGastos = async (req: Request, res: Response) => {
  try {
    const { fechaInicio, fechaFin } = req.query;

    let query = supabase
      .from('gasto_operativo')
      .select(GASTO_FIELDS);

    if (fechaInicio && fechaFin) {
      query = query
        .gte('fecha_gasto', fechaInicio as string)
        .lte('fecha_gasto', fechaFin as string);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching resumen:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
      return;
    }

    const gastos = data || [];

    let totalBase = 0;
    let totalAjustado = 0;
    let totalQuincenal = 0;
    let totalMensual = 0;
    let countQuincenal = 0;
    let countMensual = 0;

    gastos.forEach((gasto) => {
      const monto = Number(gasto.monto) || 0;
      totalBase += monto;

      if (gasto.frecuencia === 'quincenal') {
        totalAjustado += monto * 2;
        totalQuincenal += monto;
        countQuincenal += 1;
      } else {
        totalAjustado += monto;
        totalMensual += monto;
        countMensual += 1;
      }
    });

    const promedioMensual = gastos.length > 0 ? totalAjustado / gastos.length : 0;

    res.json({
      total_registros: gastos.length,
      total_base: totalBase,
      total_ajustado: totalAjustado,
      total_quincenal: totalQuincenal,
      total_mensual: totalMensual,
      count_quincenal: countQuincenal,
      count_mensual: countMensual,
      promedio_mensual: promedioMensual,
    });
  } catch (err) {
    console.error('Error in getResumenGastos:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/* ============ GET: Obtener catálogo de categorías ================= */
export const getCategoriasGasto = (_req: Request, res: Response) => {
  const payload = CATEGORIAS_VALIDAS.map((nombre) => ({ nombre, value: nombre }));
  res.json(payload);
};
