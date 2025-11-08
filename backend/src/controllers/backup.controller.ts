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

type IncrementalTableKey = 'insumo' | 'venta' | 'gasto_operativo';

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

const extractTriggerSnippets = (content: string): SchemaSnippet[] => {
  const triggers: SchemaSnippet[] = [];
  const triggerRegex = /CREATE\s+TRIGGER\s+[\s\S]+?;\s*/gi;
  let match: RegExpExecArray | null;

  while ((match = triggerRegex.exec(content)) !== null) {
    const definition = match[0].trim();
    const nameMatch = definition.match(/CREATE\s+TRIGGER\s+([\w."-]+)/i);
    const name = nameMatch?.[1]?.replace(/"/g, '') ?? `trigger_${triggers.length + 1}`;
    triggers.push({ name, definition });
  }

  return triggers;
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

export const getSchemaSqlDump = async (_req: Request, res: Response) => {
  try {
    const content = await readSchemaFile();
    const tables = extractTableSnippets(content);
    const inserts = extractInsertStatements(content);
    const triggers = extractTriggerSnippets(content);
    const functions = extractFunctionSnippets(content);

    return res.json({
      success: true,
      generatedAt: new Date().toISOString(),
      tables,
      inserts,
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
    const tables: { key: IncrementalTableKey; table: string; orderBy?: string }[] = [
      { key: 'insumo', table: 'insumo', orderBy: 'id_insumo' },
      { key: 'venta', table: 'venta', orderBy: 'fecha_venta' },
      { key: 'gasto_operativo', table: 'gasto_operativo', orderBy: 'fecha_gasto' },
    ];

    const queries = await Promise.all(
      tables.map(async ({ table, orderBy }) => {
        const query = orderBy
          ? supabase.from(table).select('*').order(orderBy, { ascending: true })
          : supabase.from(table).select('*');
        const { data, error } = await query;
        if (error) {
          throw new Error(`Error al obtener datos de ${table}: ${error.message}`);
        }
        return { table, rows: data ?? [] };
      })
    );

    const result: Record<IncrementalTableKey, { sql: string; count: number }> = {
      insumo: { sql: '', count: 0 },
      venta: { sql: '', count: 0 },
      gasto_operativo: { sql: '', count: 0 },
    };

    queries.forEach(({ table, rows }) => {
      const key = tables.find((item) => item.table === table)?.key;
      if (!key) return;
      result[key] = buildInsertGroup(table, rows as Record<string, unknown>[]);
    });

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