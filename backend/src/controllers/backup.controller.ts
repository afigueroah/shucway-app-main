import { Request, Response } from 'express';
import path from 'path';
import { promises as fs } from 'fs';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';

interface VentaBackupRecord {
  id_venta: number;
  total_venta?: number | null;
  [key: string]: unknown;
}

interface DetalleVentaBackupRecord {
  id_detalle: number;
  id_venta: number;
  [key: string]: unknown;
}

interface InsumoBackupRecord {
  id_insumo: number;
  stock_actual?: number;
  [key: string]: unknown;
}

interface LoteBackupRecord {
  id_insumo: number;
  cantidad_actual?: number | null;
  [key: string]: unknown;
}

type SchemaSnippet = {
  name: string;
  definition: string;
};

type IncrementalTableKey = 'inventario' | 'ventas' | 'compras' | 'gastos' | 'usuarios' | 'caja';

const schemaPathCandidates = [
  path.resolve(process.cwd(), 'database_complete_new.sql'),
  path.resolve(process.cwd(), '..', 'database_complete_new.sql'),
  path.resolve(process.cwd(), '../..', 'database_complete_new.sql'),
];

let resolvedSchemaPath: string | null = null;
const resolveSchemaPath = async (): Promise<string> => {
  if (resolvedSchemaPath) {
    return resolvedSchemaPath;
  }

  for (const candidate of schemaPathCandidates) {
    try {
      await fs.access(candidate);
      resolvedSchemaPath = candidate;
      return candidate;
    } catch {
      // try next candidate
    }
  }

  const fallback = schemaPathCandidates[schemaPathCandidates.length - 1];
  throw new Error(`No se encontró el archivo de respaldo en ${fallback}`);
};

let cachedSchemaContent: string | null = null;

const readSchemaFile = async (): Promise<string> => {
  if (cachedSchemaContent) return cachedSchemaContent;
  try {
    const schemaPath = await resolveSchemaPath();
    const content = await fs.readFile(schemaPath, 'utf8');
    cachedSchemaContent = content;
    return content;
  } catch (error) {
    logger.error('No se pudo leer el archivo de esquema SQL:', error);
    throw new Error('No se encontró el archivo de respaldo de la base de datos.');
  }
};

const extractTableSnippets = (content: string): SchemaSnippet[] => {
  const tables: SchemaSnippet[] = [];
  const tableRegex = /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+([\w." ]+)\s*\([\s\S]*?\);/gi;
  let match: RegExpExecArray | null;

  while ((match = tableRegex.exec(content)) !== null) {
    const definition = match[0].trim();
    const rawName = match[1]?.trim() ?? 'tabla_desconocida';
    const normalizedName = rawName.replace(/"/g, '');
    tables.push({ name: normalizedName, definition });
  }

  return tables;
};

const extractInsertStatements = (content: string): string[] =>
  Array.from(content.matchAll(/INSERT\s+INTO[\s\S]+?;\s*/gi)).map((item) => item[0].trim());

const extractTriggerSnippets = async (): Promise<SchemaSnippet[]> => {
  try {
    const { data, error } = await supabase.rpc('get_trigger_definitions');
    if (error) {
      logger.warn('Error obteniendo triggers de BD, usando archivo SQL:', error.message);
      // Fallback al archivo
      const content = await readSchemaFile();
      const triggers: SchemaSnippet[] = [];
      const triggerRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\s+[\s\S]+?;\s*/gi;
      let match: RegExpExecArray | null;
      while ((match = triggerRegex.exec(content)) !== null) {
        const definition = match[0].trim();
        const nameMatch = definition.match(/CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\s+([\w."-]+)/i);
        const name = nameMatch?.[1]?.replace(/"/g, '') ?? `trigger_${triggers.length + 1}`;
        triggers.push({ name, definition });
      }
      return triggers;
    }
    return data.map((row: any) => ({ name: row.trigger_name, definition: row.definition }));
  } catch (error) {
    logger.warn('Error obteniendo triggers:', error);
    return [];
  }
};

const extractFunctionSnippets = (content: string): SchemaSnippet[] => {
  const functions: SchemaSnippet[] = [];
  const functionStartRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION/gi;
  let match: RegExpExecArray | null;

  while ((match = functionStartRegex.exec(content)) !== null) {
    const startIndex = match.index;
    const delimiterMatch = content.slice(startIndex).match(/\$[\w]*\$/);
    if (!delimiterMatch) {
      logger.warn('Función sin delimitador $$ detectada; se omite el parseo.');
      continue;
    }

    const delimiter = delimiterMatch[0];
    const bodyStart = startIndex + delimiterMatch.index!;
    const bodyEnd = content.indexOf(delimiter, bodyStart + delimiter.length);
    if (bodyEnd === -1) {
      logger.warn('No se encontró el delimitador de cierre para una función SQL.');
      continue;
    }

    const afterBody = content.indexOf(';', bodyEnd + delimiter.length);
    const endIndex = afterBody === -1 ? bodyEnd + delimiter.length : afterBody + 1;
    const definition = content.slice(startIndex, endIndex).trim();
    const nameMatch = definition.match(/FUNCTION\s+([\w."-]+)/i);
    const name = nameMatch?.[1]?.replace(/"/g, '') ?? `function_${functions.length + 1}`;

    functions.push({ name, definition });
    functionStartRegex.lastIndex = endIndex;
  }

  return functions;
};

const extractIndexSnippets = (content: string): SchemaSnippet[] => {
  const indexes: SchemaSnippet[] = [];
  const indexRegex = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?([\w."]+)\s+ON\s+([\w."]+)\s*\([\s\S]*?\);/gi;
  let match: RegExpExecArray | null;

  while ((match = indexRegex.exec(content)) !== null) {
    const definition = match[0].trim();
    const name = match[1]?.replace(/"/g, '') ?? `index_${indexes.length + 1}`;
    indexes.push({ name, definition });
  }

  return indexes;
};

const extractViewSnippets = (content: string): SchemaSnippet[] => {
  const views: SchemaSnippet[] = [];
  const viewRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+([\w."]+)\s+AS[\s\S]*?;\s*/gi;
  let match: RegExpExecArray | null;

  while ((match = viewRegex.exec(content)) !== null) {
    const definition = match[0].trim();
    const name = match[1]?.replace(/"/g, '') ?? `view_${views.length + 1}`;
    views.push({ name, definition });
  }

  return views;
};

const extractAlterTableSnippets = (content: string): SchemaSnippet[] => {
  const alters: SchemaSnippet[] = [];
  const alterRegex = /ALTER\s+TABLE\s+([\w."]+)\s+[^;]+;/gi;
  let match: RegExpExecArray | null;

  while ((match = alterRegex.exec(content)) !== null) {
    const definition = match[0].trim();
    const tableName = match[1]?.replace(/"/g, '') ?? 'unknown_table';
    alters.push({ name: `alter_${tableName}`, definition });
  }

  return alters;
};

const formatSqlValue = (value: unknown): string => {
  if (value === null || value === undefined) return 'NULL';

  if (typeof value === 'number') {
    if (Number.isNaN(value)) return 'NULL';
    return value.toString();
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }

  if (value instanceof Date) {
    return `'${value.toISOString()}'`;
  }

  if (Array.isArray(value) || typeof value === 'object') {
    try {
      const jsonString = JSON.stringify(value);
      return `'${jsonString.replace(/'/g, "''")}'`;
    } catch {
      return `'${String(value).replace(/'/g, "''")}'`;
    }
  }

  const stringValue = String(value);
  return `'${stringValue.replace(/'/g, "''")}'`;
};

const buildInsertStatement = (table: string, row: Record<string, unknown>): string => {
  const columns = Object.keys(row);
  if (columns.length === 0) {
    return `-- No hay columnas para generar el INSERT en ${table}`;
  }

  const formattedColumns = columns.map((column) => `"${column}"`);
  const values = columns.map((column) => formatSqlValue(row[column]));
  return `INSERT INTO public.${table} (${formattedColumns.join(', ')}) VALUES (${values.join(', ')});`;
};

const buildInsertGroup = (table: string, rows: Record<string, unknown>[]): { sql: string; count: number } => {
  if (!rows.length) {
    return {
      sql: `-- No se encontraron registros en la tabla ${table}.`,
      count: 0,
    };
  }

  const statements = rows.map((row) => buildInsertStatement(table, row as Record<string, unknown>));
  return {
    sql: statements.join('\n'),
    count: rows.length,
  };
};

export const getFullBackup = async (_req: Request, res: Response) => {
  try {
    // Supabase no permite conexiones directas de PostgreSQL desde clientes externos
    // por razones de seguridad. Los backups deben hacerse desde el panel de Supabase.
    logger.warn('Intento de backup directo rechazado - usar panel de Supabase');

    res.status(403).json({
      success: false,
      error: 'Backup directo no disponible',
      message: 'Para backups completos, usa el panel de administración de Supabase en https://supabase.com/dashboard/project/cdrzomyyxyfhazkzuwou/sql',
      details: 'Supabase no permite conexiones PostgreSQL directas desde aplicaciones externas por seguridad.'
    });
  } catch (error) {
    logger.error('Error en backup completo:', error);
    res.status(500).json({
      success: false,
      error: 'Error generando backup completo',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};

export const getIncrementalBackup = async (req: Request, res: Response) => {
  try {
    const summaryParam = Array.isArray(req.query.summary) ? req.query.summary[0] : req.query.summary;
    const modeParam = Array.isArray(req.query.mode) ? req.query.mode[0] : req.query.mode;

    const normalizeParam = (value?: string) => (value ? value.toLowerCase().trim() : '');
    const summaryValue = typeof summaryParam === 'string' ? normalizeParam(summaryParam) : '';
    const modeValue = typeof modeParam === 'string' ? normalizeParam(modeParam) : '';

    const summaryOnly = summaryValue === 'true' || summaryValue === '1' || modeValue === 'summary';

    if (summaryOnly) {
      const [ventasCountResult, detallesCountResult, insumosCountResult] = await Promise.all([
        supabase.from('venta').select('id_venta', { count: 'exact', head: true }),
        supabase.from('detalle_venta').select('id_detalle', { count: 'exact', head: true }),
        supabase.from('insumo').select('id_insumo', { count: 'exact', head: true })
      ]);

      if (ventasCountResult.error) {
        throw new Error(`Error obteniendo conteo de ventas: ${ventasCountResult.error.message}`);
      }

      if (detallesCountResult.error) {
        throw new Error(`Error obteniendo conteo de detalles de venta: ${detallesCountResult.error.message}`);
      }

      if (insumosCountResult.error) {
        throw new Error(`Error obteniendo conteo de insumos: ${insumosCountResult.error.message}`);
      }

      const generatedAt = new Date().toISOString();

      return res.json({
        success: true,
        message: 'Resumen de backup incremental disponible.',
        metadata: {
          generatedAt,
          ventasCount: ventasCountResult.count ?? 0,
          detallesCount: detallesCountResult.count ?? 0,
          insumosCount: insumosCountResult.count ?? 0,
          note: 'Los datos completos incluyen ventas con sus detalles e insumos con stock calculado.'
        }
      });
    }

    const [ventasResult, detallesResult, insumosResult, lotesResult] = await Promise.all([
      supabase.from('venta').select('*').order('fecha_venta', { ascending: false }),
      supabase.from('detalle_venta').select('*'),
      supabase.from('insumo').select('*').order('nombre_insumo'),
      supabase.from('lote_insumo').select('*')
    ]);

    if (ventasResult.error) {
      throw new Error(`Error obteniendo ventas: ${ventasResult.error.message}`);
    }

    if (detallesResult.error) {
      throw new Error(`Error obteniendo detalles de venta: ${detallesResult.error.message}`);
    }

    if (insumosResult.error) {
      throw new Error(`Error obteniendo insumos: ${insumosResult.error.message}`);
    }

    if (lotesResult.error) {
      throw new Error(`Error obteniendo lotes de insumos: ${lotesResult.error.message}`);
    }

    const ventasData = (ventasResult.data ?? []) as VentaBackupRecord[];
    const detallesData = (detallesResult.data ?? []) as DetalleVentaBackupRecord[];
    const insumosData = (insumosResult.data ?? []) as InsumoBackupRecord[];
    const lotesData = (lotesResult.data ?? []) as LoteBackupRecord[];

    const detallesPorVenta = new Map<number, DetalleVentaBackupRecord[]>();
    detallesData.forEach((detalle) => {
      const existentes = detallesPorVenta.get(detalle.id_venta);
      if (existentes) {
        existentes.push(detalle);
      } else {
        detallesPorVenta.set(detalle.id_venta, [detalle]);
      }
    });

    const ventas = ventasData.map((venta) => ({
      ...venta,
      detalles: detallesPorVenta.get(venta.id_venta) ?? []
    }));

    const lotesPorInsumo = new Map<number, LoteBackupRecord[]>();
    lotesData.forEach((lote) => {
      const existentes = lotesPorInsumo.get(lote.id_insumo);
      if (existentes) {
        existentes.push(lote);
      } else {
        lotesPorInsumo.set(lote.id_insumo, [lote]);
      }
    });

    const insumos = insumosData.map((insumo) => {
      const lotes = lotesPorInsumo.get(insumo.id_insumo) ?? [];
      const stockActual = lotes.reduce(
        (total, lote) => total + (Number(lote.cantidad_actual) || 0),
        0
      );

      return {
        ...insumo,
        stock_actual: stockActual,
        lotes
      };
    });

    const generatedAt = new Date().toISOString();
    const filename = `backup-incremental-${generatedAt.replace(/[:.]/g, '-')}.json`;

    const totalVentas = ventas.reduce((total: number, venta) => total + (Number(venta.total_venta) || 0), 0);

    const totalStock = insumos.reduce(
      (total: number, insumo) => total + (Number(insumo.stock_actual) || 0),
      0
    );

    const payload = {
      success: true,
      message: 'Backup incremental exportado con datos de ventas e insumos.',
      metadata: {
        generatedAt,
        filename,
        ventasCount: ventas.length,
        detallesCount: detallesData.length,
        insumosCount: insumos.length,
        totalVentas,
        totalStock,
        note: 'Incluye ventas con sus detalles e insumos con stock calculado para auditoría incremental.'
      },
      datasets: {
        ventas,
        insumos
      }
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    return res.status(200).send(JSON.stringify(payload, null, 2));
  } catch (error) {
    logger.error('Error procesando solicitud de backup incremental:', error);
    return res.status(500).json({
      success: false,
      error: 'Error procesando backup incremental',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};

const generateAllDataInserts = async (): Promise<string[]> => {
  const inserts: string[] = [];

  // Lista de tablas en el orden de dependencias para evitar errores de clave foránea
  const tables = [
    'rol_usuario',
    'perfil_usuario',
    'bitacora_seguridad',
    'categoria_insumo',
    'proveedor',
    'insumo',
    'insumo_presentacion',
    'lote_insumo',
    'categoria_producto',
    'producto',
    'producto_variante',
    'receta_detalle',
    'cliente',
    'categoria_gasto',
    'gasto_operativo',
    'caja_sesion',
    'arqueo_caja',
    'venta',
    'detalle_venta',
    'deposito_banco',
    'orden_compra',
    'detalle_orden_compra',
    'recepcion_mercaderia',
    'detalle_recepcion_mercaderia',
    'historial_puntos',
    'movimiento_inventario',
    'bitacora_inventario',
    'bitacora_ventas',
    'bitacora_ordenes_compra',
    'bitacora_productos',
    'auditoria_inventario',
    'auditoria_detalle',
    'bitacora_auditoria'
  ];

  for (const tableName of tables) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .order(tableName === 'venta' ? 'fecha_venta' :
               tableName === 'gasto_operativo' ? 'fecha_gasto' :
               tableName === 'arqueo_caja' ? 'fecha_arqueo' :
               tableName === 'deposito_banco' ? 'fecha_deposito' :
               tableName === 'orden_compra' ? 'fecha_orden' :
               tableName === 'recepcion_mercaderia' ? 'fecha_recepcion' :
               tableName === 'movimiento_inventario' ? 'fecha_movimiento' :
               tableName === 'bitacora_inventario' ? 'fecha_accion' :
               tableName === 'bitacora_ventas' ? 'fecha_accion' :
               tableName === 'bitacora_ordenes_compra' ? 'fecha_accion' :
               tableName === 'bitacora_productos' ? 'fecha_accion' :
               tableName === 'auditoria_inventario' ? 'fecha_inicio_periodo' :
               tableName === 'historial_puntos' ? 'fecha_movimiento' :
               tableName === 'bitacora_seguridad' ? 'fecha_evento' :
               tableName === 'bitacora_auditoria' ? 'fecha_accion' :
               'id_' + tableName.split('_')[0]);

      if (error) {
        logger.warn(`Error obteniendo datos de tabla ${tableName}:`, error.message);
        continue;
      }

      if (data && data.length > 0) {
        // Generar INSERT statements para esta tabla
        const insertStatements = generateInsertStatements(tableName, data);
        inserts.push(...insertStatements);
      }
    } catch (error) {
      logger.warn(`Error procesando tabla ${tableName}:`, error);
      continue;
    }
  }

  return inserts;
};

const generateInsertStatements = (tableName: string, data: any[]): string[] => {
  if (!data || data.length === 0) return [];

  const statements: string[] = [];

  // Columnas que no se pueden insertar (GENERATED, DEFAULT, etc.)
  const excludedColumns: Record<string, string[]> = {
    'arqueo_caja': ['total_billetes_100', 'total_billetes_50', 'total_billetes_20', 'total_billetes_10', 'total_billetes_5', 'total_monedas_1', 'total_monedas_050', 'total_monedas_025', 'total_contado', 'diferencia'],
    'auditoria_detalle': ['diferencia'],
    'detalle_orden_compra': ['subtotal', 'iva'],
    'gasto_operativo': ['numero_gasto'],
    'venta': ['total_venta', 'total_costo'],
    'cliente': ['puntos_acumulados'],
    'insumo': ['costo_promedio', 'stock_actual'],
    'producto': ['costo_calculado'],
    'lote_insumo': ['cantidad_actual'],
    'movimiento_inventario': ['costo_unitario_momento'],
    'orden_compra': ['total'],
    'recepcion_mercaderia': ['total_recibido'],
    'detalle_recepcion_mercaderia': ['cantidad_aceptada'],
    'detalle_venta': ['subtotal', 'costo_total', 'precio_unitario', 'costo_unitario'],
    'historial_puntos': ['puntos_nuevo']
  };

  const columns = Object.keys(data[0])
    .filter(col => col !== 'created_at' && col !== 'updated_at')
    .filter(col => !excludedColumns[tableName]?.includes(col));

  if (columns.length === 0) {
    logger.warn(`No hay columnas válidas para insertar en la tabla ${tableName}`);
    return [];
  }

  // Crear INSERT statements individuales para mejor manejo de errores
  for (const row of data) {
    const rowValues = columns.map(col => {
      const value = row[col];
      if (value === null || value === undefined) return 'NULL';
      if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
      if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
      if (value instanceof Date) return `'${value.toISOString()}'`;
      if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
      return value.toString();
    });

    const insertStatement = `INSERT INTO ${tableName} (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${rowValues.join(', ')}) ON CONFLICT DO NOTHING;`;
    statements.push(insertStatement);
  }

  return statements;
};

export const getSchemaSqlDump = async (_req: Request, res: Response) => {
  try {
    const content = await readSchemaFile();
    const tables = extractTableSnippets(content);
    const staticInserts = extractInsertStatements(content);
    const triggers = await extractTriggerSnippets();
    const functions = extractFunctionSnippets(content);

    // Generar INSERT statements para todos los datos actuales
    const dataInserts = await generateAllDataInserts();

    // Combinar inserts estáticos con datos actuales
    const allInserts = [...staticInserts, ...dataInserts];

    return res.json({
      success: true,
      generatedAt: new Date().toISOString(),
      tables,
      inserts: allInserts,
      triggers,
      functions,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido al procesar el esquema SQL.';
    logger.error('Error generando el volcado de esquema SQL:', error);
    return res.status(500).json({
      success: false,
      error: 'No se pudo generar el esquema SQL',
      details: message,
    });
  }
};

export const getIncrementalSqlDump = async (_req: Request, res: Response) => {
  try {
    const content = await readSchemaFile();
    const allTables = extractTableSnippets(content);
    const allIndexes = extractIndexSnippets(content);
    const allTriggers = await extractTriggerSnippets();
    const allFunctions = extractFunctionSnippets(content);
    const allViews = extractViewSnippets(content);
    const allAlters = extractAlterTableSnippets(content);
    const modules: Record<IncrementalTableKey, { table: string; orderBy?: string }[]> = {
      inventario: [
        { table: 'categoria_insumo', orderBy: 'id_categoria' },
        { table: 'proveedor', orderBy: 'id_proveedor' },
        { table: 'insumo', orderBy: 'id_insumo' },
        { table: 'insumo_presentacion', orderBy: 'id_presentacion' },
        { table: 'lote_insumo', orderBy: 'id_lote' },
        { table: 'movimiento_inventario', orderBy: 'fecha_movimiento' },
        { table: 'bitacora_inventario', orderBy: 'fecha_accion' },
      ],
      ventas: [
        { table: 'categoria_producto', orderBy: 'id_categoria' },
        { table: 'producto', orderBy: 'id_producto' },
        { table: 'producto_variante', orderBy: 'id_variante' },
        { table: 'receta_detalle', orderBy: 'id_receta' },
        { table: 'cliente', orderBy: 'id_cliente' },
        { table: 'venta', orderBy: 'fecha_venta' },
        { table: 'detalle_venta', orderBy: 'id_detalle' },
        { table: 'historial_puntos', orderBy: 'fecha_movimiento' },
        { table: 'bitacora_ventas', orderBy: 'fecha_accion' },
        { table: 'deposito_banco', orderBy: 'fecha_deposito' },
      ],
      compras: [
        { table: 'proveedor', orderBy: 'id_proveedor' },
        { table: 'orden_compra', orderBy: 'fecha_orden' },
        { table: 'detalle_orden_compra', orderBy: 'id_detalle' },
        { table: 'recepcion_mercaderia', orderBy: 'fecha_recepcion' },
        { table: 'detalle_recepcion_mercaderia', orderBy: 'id_detalle' },
        { table: 'bitacora_ordenes_compra', orderBy: 'fecha_accion' },
      ],
      gastos: [
        { table: 'categoria_gasto', orderBy: 'id_categoria' },
        { table: 'gasto_operativo', orderBy: 'fecha_gasto' },
      ],
      usuarios: [
        { table: 'rol_usuario', orderBy: 'id_rol' },
        { table: 'perfil_usuario', orderBy: 'id_perfil' },
        { table: 'bitacora_seguridad', orderBy: 'fecha_evento' },
      ],
      caja: [
        { table: 'caja_sesion', orderBy: 'id_sesion' },
        { table: 'arqueo_caja', orderBy: 'id_arqueo' },
      ],
    };

    const result: Record<IncrementalTableKey, { sql: string; count: number }> = {
      inventario: { sql: '', count: 0 },
      ventas: { sql: '', count: 0 },
      compras: { sql: '', count: 0 },
      gastos: { sql: '', count: 0 },
      usuarios: { sql: '', count: 0 },
      caja: { sql: '', count: 0 },
    };

    for (const [moduleKey, tables] of Object.entries(modules) as [IncrementalTableKey, { table: string; orderBy?: string }[]][]) {
      const sqlParts: string[] = [];
      let totalCount = 0;

      // Add DDL for tables
      sqlParts.push(`-- === DDL de Tablas para ${moduleKey} ===`);
      tables.forEach(({ table }) => {
        const tableSnippet = allTables.find(t => t.name === table);
        if (tableSnippet) {
          sqlParts.push(`-- Tabla: ${table}`);
          sqlParts.push(tableSnippet.definition);
          sqlParts.push('');
        }
      });

      // Add indexes for these tables
      const moduleTableNames = tables.map(t => t.table);
      const relatedIndexes = allIndexes.filter((idx: SchemaSnippet) => {
        const def = idx.definition.toLowerCase();
        return moduleTableNames.some(table => def.includes(`on ${table}`) || def.includes(`on "${table}"`));
      });
      if (relatedIndexes.length) {
        sqlParts.push(`-- === Indexes para ${moduleKey} ===`);
        relatedIndexes.forEach((idx: SchemaSnippet) => {
          sqlParts.push(`-- Index: ${idx.name}`);
          sqlParts.push(idx.definition);
          sqlParts.push('');
        });
      }

      // Add triggers that affect these tables
      const relatedTriggers = allTriggers.filter((trg: SchemaSnippet) => {
        const def = trg.definition.toLowerCase();
        return moduleTableNames.some(table => def.includes(`on ${table}`) || def.includes(`on "${table}"`));
      });
      if (relatedTriggers.length) {
        sqlParts.push(`-- === Triggers para ${moduleKey} ===`);
        relatedTriggers.forEach((trg: SchemaSnippet) => {
          sqlParts.push(`-- Trigger: ${trg.name}`);
          sqlParts.push(trg.definition);
          sqlParts.push('');
        });
      }

      // Add functions (all, since they are global)
      if (allFunctions.length) {
        sqlParts.push(`-- === Funciones ===`);
        allFunctions.forEach((fn: SchemaSnippet) => {
          sqlParts.push(`-- Función: ${fn.name}`);
          sqlParts.push(fn.definition);
          sqlParts.push('');
        });
      }

      // Add ALTER TABLE statements for these tables
      const relatedAlters = allAlters.filter((alt: SchemaSnippet) => {
        const def = alt.definition.toLowerCase();
        return moduleTableNames.some(table => def.includes(`table ${table}`) || def.includes(`table "${table}"`));
      });
      if (relatedAlters.length) {
        sqlParts.push(`-- === Constraints y Alteraciones para ${moduleKey} ===`);
        relatedAlters.forEach((alt: SchemaSnippet) => {
          sqlParts.push(`-- Alter: ${alt.name}`);
          sqlParts.push(alt.definition);
          sqlParts.push('');
        });
      }

      // Add views (all, if any)
      if (allViews.length) {
        sqlParts.push(`-- === Views ===`);
        allViews.forEach((vw: SchemaSnippet) => {
          sqlParts.push(`-- View: ${vw.name}`);
          sqlParts.push(vw.definition);
          sqlParts.push('');
        });
      }

      // Add data inserts
      const queries = await Promise.all(
        tables.map(async ({ table, orderBy }) => {
          try {
            const query = orderBy
              ? supabase.from(table).select('*').order(orderBy, { ascending: true })
              : supabase.from(table).select('*');
            const { data, error } = await query;
            if (error) {
              logger.warn(`Error al obtener datos de ${table}: ${error.message}`);
              return { table, rows: [] };
            }
            return { table, rows: data ?? [] };
          } catch (err) {
            logger.warn(`Excepción al consultar ${table}: ${err}`);
            return { table, rows: [] };
          }
        })
      );

      sqlParts.push(`-- === Inserts para ${moduleKey} ===`);
      queries.forEach(({ table, rows }) => {
        if (rows.length > 0) {
          sqlParts.push(`-- Datos de ${table}`);
          const insertGroup = buildInsertGroup(table, rows as Record<string, unknown>[]);
          sqlParts.push(insertGroup.sql);
          totalCount += insertGroup.count;
        }
      });

      result[moduleKey] = {
        sql: sqlParts.join('\n'),
        count: totalCount,
      };
    }

    return res.json({
      success: true,
      generatedAt: new Date().toISOString(),
      tables: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido al generar SQL incremental';
    logger.error('Error generando inserts incrementales:', error);
    return res.status(500).json({
      success: false,
      error: 'No se pudo generar el SQL incremental',
      details: message,
    });
  }
};

// Función para restaurar backup desde archivo SQL
export const restoreBackup = async (req: Request, res: Response) => {
  try {
    // Verificar que se haya subido un archivo
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No se ha proporcionado ningún archivo',
      });
    }

    const fileContent = req.file.buffer.toString('utf-8');
    logger.info(`Iniciando restauración de backup. Tamaño del archivo: ${fileContent.length} caracteres`);

    // Parsear el archivo SQL para extraer INSERT statements
    const insertStatements = parseInsertStatements(fileContent);

    if (insertStatements.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No se encontraron statements INSERT válidos en el archivo',
      });
    }

    // Validar que los INSERT statements contengan datos reales, no código SQL con variables
    const invalidStatements = insertStatements.filter(stmt =>
      stmt.includes('v_') || stmt.includes('p_') || stmt.includes('NEW.') || stmt.includes('OLD.')
    );

    // Forzar el uso de execute_sql directo para archivos de backup procesados
    if (true || invalidStatements.length > 0) {
      // Usar el método directo de SQL que funciona desde el SQL Editor
      logger.info('Usando método directo de SQL para restauración de backup...');

      try {
        // Limpiar comentarios del SQL
        const cleanedSQL = fileContent
          .replace(/--.*$/gm, '') // Comentarios de línea
          .replace(/\/\*[\s\S]*?\*\//g, '') // Comentarios de bloque
          .trim();

        if (!cleanedSQL) {
          return res.status(400).json({
            success: false,
            error: 'El archivo no contiene SQL válido después de limpiar comentarios'
          });
        }

        // Ejecutar el SQL usando RPC
        const { data, error } = await supabase.rpc('execute_sql', {
          sql_query: cleanedSQL
        });

        if (error) {
          logger.error('Error al ejecutar SQL directamente:', error);

          // Verificar si la función no existe
          if (error.message?.includes('function') && error.message?.includes('does not exist')) {
            return res.status(500).json({
              success: false,
              error: 'La función execute_sql no está configurada en Supabase',
              details: 'Por favor, ejecuta el script SQL para crear la función execute_sql en el SQL Editor de Supabase.',
              sqlNeeded: true
            });
          }

          return res.status(500).json({
            success: false,
            error: 'Error al ejecutar el código SQL',
            details: error.message
          });
        }

        const rpcResult = Array.isArray(data) ? data[0] : data;
        const rpcSuccess = rpcResult?.success !== false;

        if (!rpcSuccess) {
          const rpcErrorMessage = rpcResult?.error || 'La función execute_sql reportó un error interno';
          logger.error('execute_sql devolvió error lógico:', rpcErrorMessage);
          return res.status(500).json({
            success: false,
            error: rpcErrorMessage,
            details: rpcResult?.detail || 'Verifique el contenido del archivo SQL.'
          });
        }

        logger.info('Código SQL ejecutado exitosamente');
        return res.json({
          success: true,
          message: 'Backup restaurado exitosamente usando SQL directo',
          type: 'sql_code',
          results: {
            total: insertStatements.length,
            success: insertStatements.length,
            errors: 0,
            details: []
          }
        });

      } catch (error) {
        logger.error('Error ejecutando SQL directamente:', error);
        return res.status(500).json({
          success: false,
          error: 'Error al ejecutar el código SQL',
          details: error instanceof Error ? error.message : 'Error desconocido'
        });
      }
    }

    logger.info(`Encontrados ${insertStatements.length} statements INSERT válidos para ejecutar`);

    // Ejecutar los INSERT statements
    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < insertStatements.length; i++) {
      const statement = insertStatements[i];
      try {
        const result = await executeInsertStatement(statement);

        if (!result.success) {
          logger.error(`Error ejecutando INSERT ${i + 1}:`, result.error);
          results.push({
            index: i + 1,
            statement: statement.substring(0, 100) + '...',
            success: false,
            error: result.error,
          });
          errorCount++;
        } else {
          results.push({
            index: i + 1,
            statement: statement.substring(0, 100) + '...',
            success: true,
          });
          successCount++;
        }
      } catch (error) {
        logger.error(`Error ejecutando INSERT ${i + 1}:`, error);
        results.push({
          index: i + 1,
          statement: statement.substring(0, 100) + '...',
          success: false,
          error: error instanceof Error ? error.message : 'Error desconocido',
        });
        errorCount++;
      }
    }

    logger.info(`Restauración completada. Éxitos: ${successCount}, Errores: ${errorCount}`);

    const payload = {
      message: `Restauración completada. ${successCount} inserts exitosos, ${errorCount} errores.`,
      results: {
        total: insertStatements.length,
        success: successCount,
        errors: errorCount,
        details: results,
      },
      partial: errorCount > 0,
    };

    if (successCount === 0) {
      return res.status(400).json({
        success: false,
        error: 'Ningún registro del backup pudo insertarse. Revisa el archivo e inténtalo nuevamente.',
        ...payload,
      });
    }

    return res.json({
      success: errorCount === 0,
      ...payload,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido al restaurar backup';
    logger.error('Error restaurando backup:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al restaurar el backup',
      details: message,
    });
  }
};

// Función para parsear y ejecutar INSERT statements usando operaciones CRUD normales
async function executeInsertStatement(insertSql: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Remover cláusula ON CONFLICT si existe (para compatibilidad con UPSERT)
    let cleanSql = insertSql.replace(/\s*ON\s+CONFLICT\s*\([^)]+\)\s*DO\s*NOTHING\s*;?$/i, '');

    // Parsear el INSERT statement - ahora soporta múltiples VALUES
    const insertRegex = /INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*(.+)/i;
    const match = cleanSql.match(insertRegex);

    if (!match) {
      return { success: false, error: 'Formato de INSERT no válido' };
    }

    const tableName = match[1];
    const columnsStr = match[2];
    const valuesPart = match[3].replace(/;$/, ''); // Remover ; al final si existe

    // Verificar si contiene variables (lo que indica que es código SQL, no datos)
    if (valuesPart.includes('v_') || valuesPart.includes('p_') || valuesPart.includes('NEW.') || valuesPart.includes('OLD.')) {
      return { success: false, error: 'Este INSERT statement contiene variables y no puede ser ejecutado como dato real' };
    }

    // Parsear columnas
    const columns = columnsStr.split(',').map(col => col.trim().replace(/["`]/g, ''));

    // Parsear múltiples VALUES separados por comas
    const valueSets = parseMultipleValueSets(valuesPart);

    if (valueSets.length === 0) {
      return { success: false, error: 'No se encontraron valores para insertar' };
    }

    // Ejecutar cada conjunto de valores
    for (const valueSet of valueSets) {
      const values = parseInsertValues(valueSet);

      if (columns.length !== values.length) {
        return { success: false, error: `Número de columnas (${columns.length}) no coincide con número de valores (${values.length}) en el conjunto: ${valueSet}` };
      }

      // Crear objeto de datos para insertar
      const data: Record<string, any> = {};
      columns.forEach((col, index) => {
        data[col] = values[index];
      });

      // Ejecutar inserción usando Supabase
      const { error } = await supabase.from(tableName).insert(data);

      if (error) {
        // Si es un error de clave duplicada, lo consideramos exitoso (el registro ya existe)
        if (error.code === '23505' || error.message?.includes('duplicate key value')) {
          continue; // Continuar con el siguiente conjunto de valores
        }
        // Para otros errores, los reportamos
        return { success: false, error: error.message };
      }
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}

// Función auxiliar para parsear valores de INSERT (simplificada)
function parseInsertValues(valuesStr: string): any[] {
  const values: any[] = [];
  let current = '';
  let inString = false;
  let stringChar = '';
  let parenDepth = 0;

  for (let i = 0; i < valuesStr.length; i++) {
    const char = valuesStr[i];

    if (!inString && (char === '"' || char === "'")) {
      inString = true;
      stringChar = char;
      current += char;
    } else if (inString && char === stringChar && valuesStr[i - 1] !== '\\') {
      inString = false;
      current += char;
    } else if (!inString && char === '(') {
      parenDepth++;
      current += char;
    } else if (!inString && char === ')') {
      parenDepth--;
      current += char;
    } else if (!inString && char === ',' && parenDepth === 0) {
      values.push(parseValue(current.trim()));
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    values.push(parseValue(current.trim()));
  }

  return values;
}

// Función auxiliar para parsear múltiples conjuntos de VALUES
function parseMultipleValueSets(valuesPart: string): string[] {
  const valueSets: string[] = [];
  let current = '';
  let inString = false;
  let stringChar = '';
  let parenDepth = 0;
  let braceDepth = 0;

  for (let i = 0; i < valuesPart.length; i++) {
    const char = valuesPart[i];

    if (!inString && (char === '"' || char === "'")) {
      inString = true;
      stringChar = char;
      current += char;
    } else if (inString && char === stringChar && valuesPart[i - 1] !== '\\') {
      inString = false;
      current += char;
    } else if (!inString && char === '(') {
      parenDepth++;
      current += char;
    } else if (!inString && char === ')') {
      parenDepth--;
      current += char;
      // Si cerramos el último paréntesis de un conjunto de valores
      if (parenDepth === 0 && current.trim()) {
        valueSets.push(current.trim());
        current = '';
        // Saltar la coma siguiente si existe
        if (valuesPart[i + 1] === ',') {
          i++; // Saltar la coma
        }
      }
    } else {
      current += char;
    }
  }

  // Agregar el último conjunto si existe
  if (current.trim()) {
    valueSets.push(current.trim());
  }

  return valueSets;
}

// Función auxiliar para parsear un valor individual
function parseValue(value: string): any {
  if (value === 'NULL' || value === 'null') {
    return null;
  }

  if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
    return value.slice(1, -1).replace(/\\'/g, "'").replace(/\\"/g, '"');
  }

  if (value === 'TRUE' || value === 'true') {
    return true;
  }

  if (value === 'FALSE' || value === 'false') {
    return false;
  }

  // Intentar parsear como número
  const num = Number(value);
  if (!isNaN(num)) {
    return num;
  }

  return value;
}

// Función auxiliar para parsear INSERT statements del archivo SQL
function parseInsertStatements(sqlContent: string): string[] {
  const statements: string[] = [];
  let currentStatement = '';
  let inString = false;
  let stringChar = '';
  let parenthesesDepth = 0;

  for (let i = 0; i < sqlContent.length; i++) {
    const char = sqlContent[i];
    const nextChar = sqlContent[i + 1] || '';

    // Manejar strings
    if (!inString && (char === '"' || char === "'")) {
      inString = true;
      stringChar = char;
    } else if (inString && char === stringChar && nextChar !== stringChar) {
      // No es un string escapado
      inString = false;
      stringChar = '';
    } else if (inString && char === stringChar && nextChar === stringChar) {
      // String escapado, saltar el siguiente
      i++;
    }

    // Contar paréntesis si no estamos en un string
    if (!inString) {
      if (char === '(') {
        parenthesesDepth++;
      } else if (char === ')') {
        parenthesesDepth--;
      }
    }

    currentStatement += char;

    // Si encontramos un punto y coma y no estamos en un string ni dentro de paréntesis
    if (char === ';' && !inString && parenthesesDepth === 0) {
      const trimmed = currentStatement.trim();
      if (trimmed.toUpperCase().startsWith('INSERT')) {
        statements.push(trimmed);
      }
      currentStatement = '';
    }
  }

  // Agregar el último statement si existe
  const trimmed = currentStatement.trim();
  if (trimmed && trimmed.toUpperCase().startsWith('INSERT')) {
    statements.push(trimmed);
  }

  return statements;
}