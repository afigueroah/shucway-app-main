import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware';
import { supabase } from '../config/database';

const router = Router();

const getQueryParamValue = (param: unknown): string | undefined => {
  if (typeof param === 'string') return param;
  if (Array.isArray(param) && typeof param[0] === 'string') return param[0];
  return undefined;
};

const normalizeDateParam = (value?: string, endOfDay: boolean = false): string | undefined => {
  if (!value) return undefined;

  if (value.includes('T')) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return undefined;
    if (endOfDay) {
      date.setHours(23, 59, 59, 999);
    }
    return date.toISOString();
  }

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return undefined;

  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  }

  return date.toISOString();
};

/**
 * GET /api/reportes/ventas
 * Obtener todas las ventas con detalles para reportes
 */
router.get('/ventas', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const fechaInicioStr = getQueryParamValue(req.query.fechaInicio);
    const fechaFinStr = getQueryParamValue(req.query.fechaFin);

    if (!fechaInicioStr || !fechaFinStr) {
      res.status(400).json({ error: 'fechaInicio y fechaFin son requeridos' });
      return;
    }

    const fechaInicioIso = normalizeDateParam(fechaInicioStr, false);
    const fechaFinIso = normalizeDateParam(fechaFinStr, true);

    if (!fechaInicioIso || !fechaFinIso) {
      res.status(400).json({ error: 'Los parámetros de fecha no tienen un formato válido' });
      return;
    }

    const { data, error } = await supabase
      .from('detalle_venta')
      .select(`
        cantidad,
        precio_unitario,
        costo_unitario,
        subtotal,
        venta:venta!inner (
          fecha_venta,
          tipo_pago,
          estado
        ),
        producto:id_producto (
          nombre_producto,
          categoria_producto:id_categoria (
            nombre_categoria
          )
        ),
        producto_variante:id_variante (
          nombre_variante
        )
      `)
  .gte('venta.fecha_venta', fechaInicioIso)
  .lte('venta.fecha_venta', fechaFinIso)
      .eq('venta.estado', 'confirmada');

    if (error) throw error;

    // Transformar datos al formato esperado
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ventas = (data as any[]).map((d) => ({
      fechaISO: d.venta?.fecha_venta?.split('T')[0] || '',
      producto: d.producto?.nombre_producto + (d.producto_variante?.nombre_variante ? ` (${d.producto_variante.nombre_variante})` : ''),
      categoria: d.producto?.categoria_producto?.nombre_categoria || 'Sin categoría',
      cantidad: d.cantidad || 0,
      totalQ: d.subtotal || 0,
      cogsQ: (d.costo_unitario || 0) * (d.cantidad || 0),
      metodo: d.venta?.tipo_pago || 'Efectivo'
    }));

    res.json(ventas);
  } catch (error) {
    console.error('Error al obtener ventas para reporte:', error);
    res.status(500).json({ 
      error: 'Error al obtener ventas para reporte', 
      details: error instanceof Error ? error.message : 'Error desconocido' 
    });
  }
});

/**
 * GET /api/reportes/kpis
 * Obtener KPIs del negocio (ventas, costos, ganancia)
 */
router.get('/kpis', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const fechaInicioStr = getQueryParamValue(req.query.fechaInicio);
    const fechaFinStr = getQueryParamValue(req.query.fechaFin);

    if (!fechaInicioStr || !fechaFinStr) {
      res.status(400).json({ error: 'fechaInicio y fechaFin son requeridos' });
      return;
    }

    const fechaInicioIso = normalizeDateParam(fechaInicioStr, false);
    const fechaFinIso = normalizeDateParam(fechaFinStr, true);

    if (!fechaInicioIso || !fechaFinIso) {
      res.status(400).json({ error: 'Los parámetros de fecha no tienen un formato válido' });
      return;
    }

    const { data, error } = await supabase
      .from('venta')
      .select('total_venta, total_costo')
      .gte('fecha_venta', fechaInicioIso)
      .lte('fecha_venta', fechaFinIso)
      .eq('estado', 'confirmada');

    if (error) throw error;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ventaTotal = (data as any[]).reduce((sum, v) => sum + (v.total_venta || 0), 0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cogsTotal = (data as any[]).reduce((sum, v) => sum + (v.total_costo || 0), 0);
    const gananciaBruta = ventaTotal - cogsTotal;
    
    // Gastos operativos - dejar en 0 por ahora (pendiente)
    const gastosOperativos = 0;
    const gananciaNeta = gananciaBruta - gastosOperativos;

    res.json({
      ventaTotal: Math.round(ventaTotal * 100) / 100,
      cogsTotal: Math.round(cogsTotal * 100) / 100,
      gananciaBruta: Math.round(gananciaBruta * 100) / 100,
      gastosOperativos: Math.round(gastosOperativos * 100) / 100,
      gananciaNeta: Math.round(gananciaNeta * 100) / 100
    });
  } catch (error) {
    console.error('Error al obtener KPIs:', error);
    res.status(500).json({ 
      error: 'Error al obtener KPIs', 
      details: error instanceof Error ? error.message : 'Error desconocido' 
    });
  }
});

/**
 * GET /api/reportes/productos
 * Obtener productos agregados con filtros
 */
router.get('/productos', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const fechaInicioStr = getQueryParamValue(req.query.fechaInicio);
    const fechaFinStr = getQueryParamValue(req.query.fechaFin);

    if (!fechaInicioStr || !fechaFinStr) {
      res.status(400).json({ error: 'fechaInicio y fechaFin son requeridos' });
      return;
    }

    const fechaInicioIso = normalizeDateParam(fechaInicioStr, false);
    const fechaFinIso = normalizeDateParam(fechaFinStr, true);

    if (!fechaInicioIso || !fechaFinIso) {
      res.status(400).json({ error: 'Los parámetros de fecha no tienen un formato válido' });
      return;
    }

    const categoriaStr = getQueryParamValue(req.query.categoria);
    const metodoStr = getQueryParamValue(req.query.metodo);
    const busquedaStr = getQueryParamValue(req.query.busqueda);

    const query = supabase
      .from('detalle_venta')
      .select(`
        cantidad,
        subtotal,
        costo_unitario,
        venta:venta!inner (
          fecha_venta,
          tipo_pago,
          estado
        ),
        producto:id_producto (
          nombre_producto,
          categoria_producto:id_categoria (
            nombre_categoria
          )
        ),
        producto_variante:id_variante (
          nombre_variante
        )
      `)
  .gte('venta.fecha_venta', fechaInicioIso)
  .lte('venta.fecha_venta', fechaFinIso)
      .eq('venta.estado', 'confirmada');

    const { data, error } = await query;

    if (error) throw error;

    // Filtrar y agrupar en memoria
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let filteredData = data as any[];

    if (metodoStr && metodoStr !== 'Todos') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      filteredData = filteredData.filter((d: any) => d.venta?.tipo_pago === metodoStr);
    }

    if (categoriaStr && categoriaStr !== 'Todas') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      filteredData = filteredData.filter((d: any) => 
        d.producto?.categoria_producto?.nombre_categoria === categoriaStr
      );
    }

    if (busquedaStr) {
      const searchLower = busquedaStr.toLowerCase();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      filteredData = filteredData.filter((d: any) =>
        d.producto?.nombre_producto?.toLowerCase().includes(searchLower)
      );
    }

    // Agrupar por producto
    interface ProductoAgregado {
      producto: string;
      categoria: string;
      unidades: number;
      ventaQ: number;
      cogsQ: number;
      gananciaQ: number;
    }
    const productosMap = new Map<string, ProductoAgregado>();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filteredData.forEach((d: any) => {
      const nombreProducto = d.producto?.nombre_producto + 
        (d.producto_variante?.nombre_variante ? ` (${d.producto_variante.nombre_variante})` : '');
      const categoriaProducto = d.producto?.categoria_producto?.nombre_categoria || 'Sin categoría';
      
      if (!productosMap.has(nombreProducto)) {
        productosMap.set(nombreProducto, {
          producto: nombreProducto,
          categoria: categoriaProducto,
          unidades: 0,
          ventaQ: 0,
          cogsQ: 0,
          gananciaQ: 0
        });
      }

      const prod = productosMap.get(nombreProducto)!;
      prod.unidades += d.cantidad || 0;
      prod.ventaQ += d.subtotal || 0;
      prod.cogsQ += (d.costo_unitario || 0) * (d.cantidad || 0);
      prod.gananciaQ = prod.ventaQ - prod.cogsQ;
    });

    const productos = Array.from(productosMap.values()).map(p => ({
      ...p,
      ventaQ: Math.round(p.ventaQ * 100) / 100,
      cogsQ: Math.round(p.cogsQ * 100) / 100,
      gananciaQ: Math.round(p.gananciaQ * 100) / 100
    }));

    res.json(productos);
  } catch (error) {
    console.error('Error al obtener productos para reporte:', error);
    res.status(500).json({ 
      error: 'Error al obtener productos para reporte', 
      details: error instanceof Error ? error.message : 'Error desconocido' 
    });
  }
});

/**
 * GET /api/reportes/distribucion-categoria
 * Obtener distribución de ventas por categoría
 */
router.get('/distribucion-categoria', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const fechaInicioStr = getQueryParamValue(req.query.fechaInicio);
    const fechaFinStr = getQueryParamValue(req.query.fechaFin);

    if (!fechaInicioStr || !fechaFinStr) {
      res.status(400).json({ error: 'fechaInicio y fechaFin son requeridos' });
      return;
    }

    const fechaInicioIso = normalizeDateParam(fechaInicioStr, false);
    const fechaFinIso = normalizeDateParam(fechaFinStr, true);

    if (!fechaInicioIso || !fechaFinIso) {
      res.status(400).json({ error: 'Los parámetros de fecha no tienen un formato válido' });
      return;
    }

    const { data, error } = await supabase
      .from('detalle_venta')
      .select(`
        subtotal,
        producto:id_producto (
          categoria_producto:id_categoria (
            nombre_categoria
          )
        ),
        venta:venta!inner (
          fecha_venta,
          estado
        )
  `)
  .gte('venta.fecha_venta', fechaInicioIso)
  .lte('venta.fecha_venta', fechaFinIso)
      .eq('venta.estado', 'confirmada');

    if (error) throw error;

    // Agrupar por categoría
    const categoriasMap = new Map<string, number>();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data as any[]).forEach((d: any) => {
      const categoria = d.producto?.categoria_producto?.nombre_categoria || 'Sin categoría';
      const total = d.subtotal || 0;
      categoriasMap.set(categoria, (categoriasMap.get(categoria) || 0) + total);
    });

    const distribucion = Array.from(categoriasMap.entries()).map(([categoria, total]) => ({
      categoria,
      total: Math.round(total * 100) / 100
    }));

    res.json(distribucion);
  } catch (error) {
    console.error('Error al obtener distribución por categoría:', error);
    res.status(500).json({ 
      error: 'Error al obtener distribución por categoría', 
      details: error instanceof Error ? error.message : 'Error desconocido' 
    });
  }
});

/**
 * GET /api/reportes/distribucion-metodo
 * Obtener distribución de ventas por método de pago
 */
router.get('/distribucion-metodo', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const fechaInicioStr = getQueryParamValue(req.query.fechaInicio);
    const fechaFinStr = getQueryParamValue(req.query.fechaFin);

    if (!fechaInicioStr || !fechaFinStr) {
      res.status(400).json({ error: 'fechaInicio y fechaFin son requeridos' });
      return;
    }

    const fechaInicioIso = normalizeDateParam(fechaInicioStr, false);
    const fechaFinIso = normalizeDateParam(fechaFinStr, true);

    if (!fechaInicioIso || !fechaFinIso) {
      res.status(400).json({ error: 'Los parámetros de fecha no tienen un formato válido' });
      return;
    }

    const { data, error } = await supabase
      .from('venta')
      .select('tipo_pago, total_venta')
      .gte('fecha_venta', fechaInicioIso)
      .lte('fecha_venta', fechaFinIso)
      .eq('estado', 'confirmada');

    if (error) throw error;

    // Agrupar por método
    const metodosMap = new Map<string, number>();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data as any[]).forEach((v: any) => {
      const metodo = v.tipo_pago || 'Efectivo';
      const total = v.total_venta || 0;
      metodosMap.set(metodo, (metodosMap.get(metodo) || 0) + total);
    });

    const distribucion = Array.from(metodosMap.entries()).map(([metodo, total]) => ({
      metodo,
      total: Math.round(total * 100) / 100
    }));

    res.json(distribucion);
  } catch (error) {
    console.error('Error al obtener distribución por método:', error);
    res.status(500).json({ 
      error: 'Error al obtener distribución por método', 
      details: error instanceof Error ? error.message : 'Error desconocido' 
    });
  }
});

export default router;
