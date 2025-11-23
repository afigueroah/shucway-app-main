import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import dbSchema, { TableMeta } from './dbSchema';
import api from '@/api/apiClient';
import { localStore } from '@/utils/storage';
import { FaEye, FaEdit, FaTrash, FaPlus, FaFilter, FaColumns, FaUndo, FaSearch, FaChevronRight, FaDatabase } from 'react-icons/fa';
import { Button, Spin, Table, message, Modal, Input, Select, Form, Drawer, Switch, Dropdown, Tag, Alert, Empty, Upload } from 'antd';
import { RollbackOutlined, UploadOutlined } from '@ant-design/icons';
import { ColumnsType } from 'antd/es/table';

interface TableRecord {
  [key: string]: string | number | boolean | null | undefined;
}

interface TableColumn {
  title: string;
  dataIndex: string;
  key: string;
  hidden?: boolean;
  width?: number;
  fixed?: 'left' | 'right';
  ellipsis?: boolean;
  render?: (value: string | number | boolean | null | undefined, record: TableRecord) => React.ReactNode;
}

const formatTableLabel = (tableName: string) =>
  tableName ? tableName.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) : '';

const TABLE_GROUPS: Record<string, string[]> = {
  'Auditoría y bitácoras': [
    'auditoria_inventario', 'auditoria_detalle', 'bitacora_auditoria',
    'bitacora_seguridad', 'bitacora_inventario', 'bitacora_ventas', 'bitacora_ordenes_compra', 'bitacora_productos'
  ],
};

const SCHEMA_TABLE_MAP = dbSchema.tables as Record<string, TableMeta>;
const SCHEMA_TABLE_KEYS = Object.keys(SCHEMA_TABLE_MAP);

const Mantenimiento: React.FC = () => {
  const navigate = useNavigate();
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [tables, setTables] = useState<string[]>([]);
  const [data, setData] = useState<TableRecord[]>([]);
  const [columns, setColumns] = useState<TableColumn[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [showDeleted, setShowDeleted] = useState<boolean>(false);
  const [estadoField, setEstadoField] = useState<string | null>(null);
  const [activoField, setActivoField] = useState<string | null>(null);

  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<TableRecord | null>(null);
  const [form] = Form.useForm();
  const [lookupOptions, setLookupOptions] = useState<Record<string, { value: string | number; label: string }[]>>({});
  const [primaryKey, setPrimaryKey] = useState<string>('id');
  const [lookupTables, setLookupTables] = useState<Record<string, string>>({});
  const [footerHeight, setFooterHeight] = useState<number>(0);
  const [tablePageSize, setTablePageSize] = useState<number>(10);
  const [tableCurrentPage, setTableCurrentPage] = useState<number>(1);
  const [tableSearch, setTableSearch] = useState<string>('');
  const [restoreModalVisible, setRestoreModalVisible] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const handleRestoreBackup = async () => {
    if (!restoreFile) {
      message.error('Selecciona un archivo de backup');
      return;
    }

    setRestoring(true);
    try {
      const text = await restoreFile.text();
      await api.post('/maintenance/execute-sql', { sql: text });
      message.success('Backup restaurado exitosamente');
      setRestoreModalVisible(false);
      setRestoreFile(null);
      // Recargar datos si hay tabla seleccionada
      if (selectedTable) {
        await loadTableData(selectedTable);
      }
    } catch (error) {
      console.error('Error al restaurar backup:', error);
      message.error('Error al restaurar backup');
    } finally {
      setRestoring(false);
    }
  };

  // metadata schema for the currently selected table (if available)
  const schemaForSelected: TableMeta | undefined = selectedTable ? SCHEMA_TABLE_MAP[selectedTable] : undefined;

  // Valor que representa el estado borrado para la tabla seleccionada (fallback a 'eliminado')
  const deletedMarker: string | boolean = schemaForSelected?.deletedValue ?? 'eliminado';
  const isDeletedValue = useCallback((val: unknown) => {
    if (typeof deletedMarker === 'boolean') return Boolean(val) === deletedMarker;
    return String(val) === String(deletedMarker);
  }, [deletedMarker]);


  const colors = {
    primary: '#346C60',    
    secondary: '#12443D', 
    accent: '#FFD40D'      
  };

  const availableTables = useMemo(() => {
    const union = new Set<string>([...tables, ...SCHEMA_TABLE_KEYS]);
    return Array.from(union).sort((a, b) =>
      formatTableLabel(a).localeCompare(formatTableLabel(b), 'es', { sensitivity: 'base' })
    );
  }, [tables]);

  const normalizedSearch = useMemo(() => tableSearch.trim().toLowerCase(), [tableSearch]);

  const groupedTables = useMemo(() => {
    if (!availableTables.length) return [] as { label: string; tables: string[] }[];

    const assigned = new Set<string>();
    const groups: { label: string; tables: string[] }[] = [];

    Object.entries(TABLE_GROUPS).forEach(([label, tableList]) => {
      const filtered = tableList.filter((name) => availableTables.includes(name));
      const searched = normalizedSearch
        ? filtered.filter((name) =>
            formatTableLabel(name).toLowerCase().includes(normalizedSearch)
          )
        : filtered;

      if (searched.length) {
        searched.forEach((name) => assigned.add(name));
        groups.push({ label, tables: searched });
      }
    });

    const remaining = availableTables.filter(
      (name) =>
        !assigned.has(name) &&
        (!normalizedSearch || formatTableLabel(name).toLowerCase().includes(normalizedSearch))
    );

    if (remaining.length) {
      groups.push({ label: 'Otras tablas', tables: remaining });
    }

    return groups;
  }, [availableTables, normalizedSearch]);

  const selectedTableLabel = formatTableLabel(selectedTable);
  const selectedGroupLabel = useMemo(() => {
    const entry = Object.entries(TABLE_GROUPS).find(([, tableList]) => tableList.includes(selectedTable));
    return entry ? entry[0] : null;
  }, [selectedTable]);

  const isLogTable = selectedTable.startsWith('bitacora_') || selectedTable.startsWith('auditoria_');

  const handleRestore = async (record: TableRecord) => {
    Modal.confirm({
      title: 'Confirmar restauración',
      content: "¿Deseas restaurar este registro a 'activo'?",
      okText: 'Restaurar a activo',
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
            const primaryKey = Object.keys(record).find(key => key.includes('id')) || 'id';

            if (estadoField && isDeletedValue(record[estadoField])) {
              const idValue = record[primaryKey];
              const resp = await api.put(`/dashboard/table-data/${selectedTable}/${encodeURIComponent(String(idValue))}`, { [estadoField]: 'activo' });
              if (!resp || resp.status >= 400) throw new Error('Error al restaurar el registro');
              message.success("Registro restaurado a 'activo' correctamente");
              await fetchData();
              return;
            }

            if (activoField && (record[activoField] === false || String(record[activoField]) === 'false')) {
              const idValue = record[primaryKey];
              const resp = await api.put(`/dashboard/table-data/${selectedTable}/${encodeURIComponent(String(idValue))}`, { [activoField]: true });
              if (!resp || resp.status >= 400) throw new Error('Error al activar el registro');
              message.success("Registro activado (activo = true) correctamente");
              await fetchData();
              return;
            }

          message.info('No aplica restauración para este registro');
        } catch (error) {
          console.error('Error restoring:', error);
          message.error('Error al restaurar el registro');
        }
      }
    });
  };

  useEffect(() => {
    const loadAvailableTables = async () => {
      try {
        // Usar el nuevo endpoint optimizado que devuelve todas las tablas disponibles en una sola llamada
        const response = await api.get('/dashboard/available-tables');

        if (response.status === 200) {
          const data = response.data;
          setTables(data.tables);
        } else if (response.status === 401) {
          message.error('Sesión expirada. Redirigiendo al login...');
          // Limpiar tokens y redirigir
          localStore.remove('access_token');
          localStore.remove('user');
          window.location.href = '/login';
        } else {
          // Si el endpoint no está disponible o falla, usar el esquema local (dbSchema)
          console.warn('Endpoint available-tables no disponible, usando dbSchema local');
          setTables(SCHEMA_TABLE_KEYS);
        }
      } catch (error) {
        console.error('Error al cargar tablas:', error);
        // fallback to local schema list
        setTables(SCHEMA_TABLE_KEYS);
      }
    };

    loadAvailableTables();
  }, []);

  useEffect(() => {
    if (!availableTables.length) return;
    if (!selectedTable || !availableTables.includes(selectedTable)) {
      setSelectedTable(availableTables[0]);
    }
  }, [availableTables, selectedTable]);

  // Construir opciones lookup para columnas FK detectadas (ej. categoria_id -> tablas 'categoria' o 'categorias')
  useEffect(() => {
    if (!columns || columns.length === 0 || !tables || tables.length === 0) return;

    let cancelled = false;

    const generateCandidates = (base: string) => {
      // heurísticas para nombres de tabla a partir de columna FK
      const candidates = [
        base,
        base + 's',
        base + 'es',
        base.replace(/ies$/, 'y'),
        base + '_id',
        base + 'es_tbl',
      ];
      return Array.from(new Set(candidates));
    };

    const detectLabelField = (rows: unknown[]) => {
      if (!rows || rows.length === 0) return null;
      const keys = Object.keys(rows[0] as Record<string, unknown>);
      const prefer = ['nombre', 'name', 'title', 'descripcion', 'label'];
      for (const p of prefer) {
        const found = keys.find(k => k.toLowerCase().includes(p));
        if (found) return found;
      }
      // fallback to first non-id field
      return keys.find(k => !k.toLowerCase().includes('id')) || keys[0];
    };

    const buildLookups = async () => {
      const newLookups: Record<string, { value: string | number; label: string }[]> = {};
      const newLookupTables: Record<string, string> = {};

      // metadata for current table (if available)
  const schemaForTable: TableMeta | null = selectedTable ? (dbSchema.tables as Record<string, TableMeta>)[selectedTable] ?? null : null;

      for (const col of columns) {
        const key = col.key as string;
        if (!key) continue;
        if (key.toLowerCase().endsWith('_id') && key !== primaryKey) {
          let match: string | undefined;

          // Prefer explicit foreignKey mapping from the DB schema metadata when available
          if (schemaForTable && schemaForTable.foreignKeys && schemaForTable.foreignKeys[key]) {
            match = schemaForTable.foreignKeys[key];
          } else {
            const base = key.replace(/_id$/i, '');
            const candidates = generateCandidates(base);
            match = candidates.find(c => tables.includes(c));
          }

          if (match) {
            try {
              const resp = await api.get(`/dashboard/table-data/${match}`);
              if (resp.status !== 200) continue;
              const js = resp.data;
              const rows = js.data || [];

              // prefer labelField and pk from schema for the matched table
              const schemaForMatch: TableMeta | undefined = (dbSchema.tables as Record<string, TableMeta>)[match];
              const labelField = schemaForMatch?.labelFields?.[0] ?? detectLabelField(rows) ?? primaryKey;
              const idField = (schemaForMatch?.pk ?? Object.keys((rows[0] as Record<string, unknown>) || {}).find(k => k.toLowerCase().includes('id'))) || primaryKey;

              const opts = (rows || []).slice(0, 500).map((r: unknown) => {
                const rec = r as Record<string, unknown>;
                const v = rec[idField];
                const lbl = rec[labelField as string];
                const value = (typeof v === 'number' || typeof v === 'string') ? v : String(v);
                const label = (typeof lbl === 'string' || typeof lbl === 'number') ? String(lbl) : String(value);
                return { value: value as string | number, label };
              });
              newLookups[key] = opts;
              newLookupTables[key] = match;
              } catch {
              // ignore lookup errors
            }
          }
        }
      }

      if (!cancelled) {
        setLookupOptions(newLookups);
        setLookupTables(newLookupTables);
      }
    };

    buildLookups();

    return () => { cancelled = true; };
  }, [columns, tables, primaryKey, selectedTable]);

  // función para buscar opciones de lookup remotamente (búsqueda en selects grandes)
  const fetchLookupOptionsRemote = async (table: string, query: string) => {
    try {
      const q = query ? `?q=${encodeURIComponent(query)}&limit=50` : '?limit=50';
      const resp = await api.get(`/dashboard/table-data/${table}${q}`);
      if (resp.status !== 200) return [];
      const js = resp.data;
      const rows = js.data || [];
      if (!rows || rows.length === 0) return [];
      const labelField = ((): string => {
        const keys = Object.keys(rows[0] as Record<string, unknown>);
        const prefer = ['nombre', 'name', 'title', 'descripcion', 'label'];
        for (const p of prefer) {
          const found = keys.find(k => k.toLowerCase().includes(p));
          if (found) return found;
        }
        return keys.find(k => !k.toLowerCase().includes('id')) || keys[0];
      })();
      const idField = Object.keys(rows[0] as Record<string, unknown>).find(k => k.toLowerCase().includes('id')) || primaryKey;
      const opts = (rows as unknown[]).slice(0, 200).map(r => {
        const rec = r as Record<string, unknown>;
        const v = rec[idField];
        const lbl = rec[labelField as string];
        const value = (typeof v === 'number' || typeof v === 'string') ? v : String(v);
        const label = (typeof lbl === 'string' || typeof lbl === 'number') ? String(lbl) : String(value);
        return { value: value as string | number, label };
      });
      return opts;
    } catch {
      return [];
    }
  };

  const generateColumns = useCallback((sampleData: TableRecord): TableColumn[] => {
    if (!sampleData) return [];

  return Object.keys(sampleData).map(key => ({
      title: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      dataIndex: key,
      key: key,
      hidden: false,
      width: key.includes('id') ? 80 : 
             key.includes('fecha') ? 120 : 
             key.includes('estado') || key.includes('activo') ? 100 :
             key.includes('nombre') || key.includes('descripcion') ? 200 : 150,
      ellipsis: true,
      render: (value: string | number | boolean | null | undefined) => {
        if (value === null || value === undefined) return '-';
        if (typeof value === 'boolean') return value ? 'Sí' : 'No';
        if ((key.includes('fecha') || key.includes('created_at') || key.includes('updated_at')) && value) {
          return new Date(value).toLocaleString('es-ES', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          });
        }
        if (typeof value === 'object') {
          return JSON.stringify(value);
        }
        return String(value);
      }
    }));
  }, []);

  const generateColumnsFromNames = useCallback((names: string[]): TableColumn[] => {
    if (!names || names.length === 0) return [];
    return names.map(key => ({
      title: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      dataIndex: key,
      key: key,
      hidden: false,
      width: key.includes('id') ? 80 : 
             key.includes('fecha') ? 120 : 
             key.includes('estado') || key.includes('activo') ? 100 :
             key.includes('nombre') || key.includes('descripcion') ? 200 : 150,
      ellipsis: true,
      render: (value: string | number | boolean | null | undefined) => {
        if (value === null || value === undefined) return '-';
        if (typeof value === 'boolean') return value ? 'Sí' : 'No';
        if ((key.includes('fecha') || key.includes('created_at') || key.includes('updated_at')) && value) {
          return new Date(value).toLocaleString('es-ES', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          });
        }
        return typeof value === 'object' ? JSON.stringify(value) : String(value);
      }
    }));
  }, []);

  const fetchColumnNames = useCallback(async (tableName: string): Promise<string[]> => {
    try {
      const response = await api.get(`/dashboard/table-columns/${tableName}`);

      if (response.status === 200) {
        const data = response.data;
        return (data.columns || []).map((c: { column_name: string }) => c.column_name);
      } else if (response.status === 401) {
        message.error('Sesión expirada. Redirigiendo al login...');
        localStore.remove('access_token');
        localStore.remove('user');
        window.location.href = '/login';
        return [];
      } else {
        console.warn('No se pudieron obtener columnas desde el endpoint:', response.statusText);
        return [];
      }
    } catch (err) {
      console.error('Error fetchColumnNames:', err);
      return [];
    }
  }, []);

  const fetchData = useCallback(async () => {
    if (!selectedTable) return;
    setLoading(true);
    setLastError(null);
    try {
      const filtersParam = Object.keys(filters).length > 0 ? `?filters=${encodeURIComponent(JSON.stringify(filters))}` : '';
      const response = await api.get(`/dashboard/table-data/${selectedTable}${filtersParam}`);

      if (response.status === 200) {
        const result = response.data;
        const rows = result.data || [];

        if (rows.length > 0) {
          setColumns(generateColumns(rows[0]));

          const detectedPrimary = Object.keys(rows[0]).find((k) => k.toLowerCase() === 'id') || Object.keys(rows[0])[0];
          setPrimaryKey(detectedPrimary);

          try {
            const ids = (rows as unknown[])
              .map((r) => Number((r as Record<string, unknown>)[detectedPrimary] as unknown))
              .filter((n: number) => !Number.isNaN(n));
            const maxId = ids.length ? Math.max(...ids) : 0;
            void maxId;
          } catch {
            /* noop */
          }

          const detectedEstado = Object.keys(rows[0]).find((k) => k.toLowerCase().includes('estado')) || null;
          const detectedActivo = Object.keys(rows[0]).find((k) => k.toLowerCase().includes('activo')) || null;
          setEstadoField(detectedEstado);
          setActivoField(detectedActivo);

          let filtered = rows;
          if (detectedEstado) {
            filtered = rows.filter((r: TableRecord) =>
              showDeleted
                ? isDeletedValue((r as Record<string, unknown>)[detectedEstado])
                : !isDeletedValue((r as Record<string, unknown>)[detectedEstado])
            );
          } else if (detectedActivo) {
            filtered = rows.filter((r: TableRecord) =>
              showDeleted
                ? r[detectedActivo] === false || String(r[detectedActivo]) === 'false'
                : !(r[detectedActivo] === false || String(r[detectedActivo]) === 'false')
            );
          }

          setData(filtered);
        } else {
          const colNames = await fetchColumnNames(selectedTable);
          if (colNames && colNames.length > 0) {
            setColumns(generateColumnsFromNames(colNames));

            const detectedPrimary = colNames.find((k) => k.toLowerCase() === 'id') || colNames[0];
            setPrimaryKey(detectedPrimary);

            const detectedEstado = colNames.find((k) => k.toLowerCase().includes('estado')) || null;
            const detectedActivo = colNames.find((k) => k.toLowerCase().includes('activo')) || null;
            setEstadoField(detectedEstado);
            setActivoField(detectedActivo);

            setData([]);
          } else {
            setColumns([]);
            setEstadoField(null);
            setActivoField(null);
            setData([]);
          }
        }
      } else if (response.status === 401) {
        message.error('Sesión expirada. Redirigiendo al login...');
        localStore.remove('access_token');
        localStore.remove('user');
        window.location.href = '/login';
      } else if (response.status === 403) {
        const errorData = await response.json();
        const errorMessage = errorData.message || 'No tienes permisos para acceder a esta tabla';
        message.error(errorMessage);
        setLastError(errorMessage);
        setColumns([]);
        setData([]);
      } else {
        const errorDetails = await response.text();
        const errorMessage = errorDetails || `Error al obtener los datos (HTTP ${response.status})`;
        console.error('Error fetching data:', errorMessage);
        message.error(errorMessage);
        setLastError(errorMessage);

        if (schemaForSelected?.columns && schemaForSelected.columns.length) {
          setColumns(generateColumnsFromNames(schemaForSelected.columns));
        } else {
          setColumns([]);
        }
        setEstadoField(null);
        setActivoField(null);
        setData([]);
      }
    } catch (error) {
      const fallbackMessage = error instanceof Error ? error.message : 'Error al cargar los datos';
      console.error('Error fetching data:', error);
      message.error(fallbackMessage);
      setLastError(fallbackMessage);
      setColumns([]);
      setEstadoField(null);
      setActivoField(null);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [selectedTable, filters, showDeleted, generateColumns, fetchColumnNames, generateColumnsFromNames, isDeletedValue, schemaForSelected]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setTableCurrentPage(1);
  }, [selectedTable, tablePageSize, showDeleted]);

  const handleAdd = () => {
    setSelectedRecord(null);
    form.resetFields();
    setAddModalVisible(true);
  };

  const handleView = (record: TableRecord) => {
    setSelectedRecord(record);
    form.resetFields();
    form.setFieldsValue(record);
    setViewModalVisible(true);
  };

  const handleEdit = (record: TableRecord) => {
    setSelectedRecord(record);
    form.setFieldsValue(record);
    setEditModalVisible(true);
  };

  const handleDelete = async (record: TableRecord) => {
    Modal.confirm({
      title: 'Confirmar eliminación',
      content: '¿Estás seguro de que deseas eliminar este registro?',
      okText: 'Eliminar',
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          // Comprobar token local antes de intentar operaciones que requieren auth
          const token = localStore.get('access_token');
          if (!token) {
            message.error('Sesión expirada. Redirigiendo al login...');
            localStore.remove('access_token');
            localStore.remove('user');
            window.location.href = '/login';
            return;
          }

          const primaryKey = Object.keys(record).find(key => key.includes('id')) || 'id';

          const estadoKey = Object.keys(record).find(k => k.toLowerCase().includes('estado'));
          const activoKey = Object.keys(record).find(k => k.toLowerCase().includes('activo'));

          if (estadoKey) {
            const idValue = record[primaryKey];
            // Usar el valor configurado en el schema para marcar borrado (fallback 'eliminado')
            const payload: Record<string, unknown> = {};
            payload[estadoKey] = deletedMarker;
            const resp = await api.put(`/dashboard/table-data/${selectedTable}/${encodeURIComponent(String(idValue))}`, payload);
            if (!resp || resp.status >= 400) throw new Error('Error al marcar como eliminado');
            message.success('Registro marcado como eliminado (borrado lógico)');
            await fetchData();
            return;
          }

          if (activoKey) {
            const idValue = record[primaryKey];
            const resp = await api.put(`/dashboard/table-data/${selectedTable}/${encodeURIComponent(String(idValue))}`, { [activoKey]: false });
            if (!resp || resp.status >= 400) throw new Error('Error al desactivar registro');
            message.success('Registro desactivado (borrado lógico)');
            await fetchData();
            return;
          }

          // llamar al backend para eliminar
          const idValue = record[primaryKey];
          const resp = await api.delete(`/dashboard/table-data/${selectedTable}/${encodeURIComponent(String(idValue))}`);
          if (!resp || resp.status >= 400) {
            throw new Error('Error al eliminar el registro');
          }
          message.success('Registro eliminado exitosamente');
          await fetchData();
        } catch (error) {
          console.error('Error deleting:', error);
          // normalizar el error a una forma conocida
          const e = (error as { status?: number; message?: string; error?: { message?: string } }) || {};
          // si el servidor devolvió 401, limpiar sesión y redirigir
          const is401 = e.status === 401 || (typeof e.message === 'string' && e.message.includes('401'));
          if (is401) {
            message.error('Sesión expirada. Redirigiendo al login...');
            localStore.remove('access_token');
            localStore.remove('user');
            window.location.href = '/login';
            return;
          }
          // Mensaje más informativo si el error tiene mensaje
          if (typeof e.message === 'string' || e.error) {
            const msg = e.message ?? (e.error && e.error.message) ?? 'Error al eliminar el registro';
            message.error(String(msg));
          } else {
            message.error('Error al eliminar el registro');
          }
        }
      }
    });
  };

  const handleSave = async (values: Record<string, string | number | boolean | null | undefined>) => {
    try {
      const processedValues = Object.entries(values).reduce<Record<string, string | number | boolean | null | undefined>>((acc, [key, value]) => {
        if (value === null || value === undefined) {
          acc[key] = value;
          return acc;
        }

        if ((key.includes('fecha') || key.includes('created_at') || key.includes('updated_at')) && value) {
          try {
            const dateStr = typeof value === 'boolean' ? '' : String(value);
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
              acc[key] = date.toISOString();
            } else {
              throw new Error(`Fecha inválida para el campo ${key}`);
            }
          } catch {
            throw new Error(`Error al procesar la fecha en el campo ${key}`);
          }
          return acc;
        }

        if (typeof value === 'boolean') {
          // Para campos 'estado' o 'activo', convertir boolean a string apropiado según schema
          if (key.toLowerCase().includes('estado') || key.toLowerCase().includes('activo')) {
            if (value) {
              acc[key] = 'activo';
            } else {
              // Usar deletedValue del schema si existe, sino 'inactivo'
              const deletedVal = schemaForSelected?.deletedValue;
              if (deletedVal === false) {
                acc[key] = false;
              } else if (typeof deletedVal === 'string') {
                acc[key] = deletedVal;
              } else {
                acc[key] = 'inactivo';
              }
            }
          } else {
            acc[key] = value;
          }
          return acc;
        }

        if (typeof value === 'number' || (typeof value === 'string' && !isNaN(Number(value)))) {
          acc[key] = Number(value);
          return acc;
        }

        acc[key] = value;
        return acc;
      }, {});

      // If creating a new record, remove the primary key so backend can assign it if it's serial
      if (!selectedRecord) {
        try {
          delete processedValues[primaryKey as string];
        } catch {
          // ignore
        }
        // Remove any auto-created fields so backend assigns them
        if (schemaForSelected?.autoCreated && schemaForSelected.autoCreated.length > 0) {
          for (const ac of schemaForSelected.autoCreated) {
            try { delete processedValues[ac]; } catch { /* ignore */ }
          }
        }
      }

      if (selectedRecord) {
        const primaryKey = Object.keys(selectedRecord).find(key => key.includes('id')) || 'id';
        const idValue = selectedRecord[primaryKey];
        // Usar API backend para update
        const resp = await api.put(`/dashboard/table-data/${selectedTable}/${encodeURIComponent(String(idValue))}`, processedValues);
        if (!resp || resp.status >= 400) {
          throw new Error('Error al actualizar el registro');
        }
        message.success('Registro actualizado exitosamente');
        setEditModalVisible(false);
      } else {
        // Crear vía backend
        const resp = await api.post(`/dashboard/table-data/${selectedTable}`, processedValues);
        if (!resp || resp.status >= 400) {
          throw new Error('Error al crear el registro');
        }
        message.success('Registro creado exitosamente');
        setAddModalVisible(false);
      }

      setSelectedRecord(null);
      form.resetFields();
      await fetchData();
    } catch (error) {
      console.error('Error saving:', error);
      if (error instanceof Error) {
        message.error(
          error.message.includes('duplicate key')
            ? 'Ya existe un registro con estos datos'
            : error.message
        );
      } else {
        message.error('Error al guardar el registro');
      }
    }
  };

  const handleFilterChange = (column: string, value: string) => {
    setFilters(prev => ({ ...prev, [column]: value }));
    setTableCurrentPage(1);
  };

  const handleColumnToggle = (key: string) => {
    setColumns(prev => prev.map(col =>
      col.key === key ? { ...col, hidden: !col.hidden } : col
    ));
  };

  const getPriorityColumns = useCallback((cols: TableColumn[]): TableColumn[] => {
    const priorityOrder = ['id', 'nombre', 'estado', 'activo', 'fecha', 'descripcion'];
    
    const sortedColumns = [...cols].sort((a, b) => {
      const aIndex = priorityOrder.findIndex(priority => a.key.toLowerCase().includes(priority));
      const bIndex = priorityOrder.findIndex(priority => b.key.toLowerCase().includes(priority));
      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });

    return sortedColumns.slice(0, 6);
  }, []);

  const visibleColumns = getPriorityColumns(columns.filter(col => !col.hidden));

  const actionColumn: TableColumn = {
    title: 'Acciones',
    key: 'actions',
    dataIndex: 'actions',
    width: 100,
    fixed: 'right',
    render: (_, record) => (
      <div className="flex gap-2">
        <Button
          size="small"
          shape="circle"
          icon={<FaEye />}
          onClick={() => handleView(record)}
          className="border-0 bg-transparent text-gray-600 hover:text-gray-800"
        />
        {!isLogTable && (
          <Button
            size="small"
            shape="circle"
            icon={<FaEdit />}
            onClick={() => handleEdit(record)}
            className="border-0 bg-transparent text-gray-600 hover:text-gray-800"
          />
        )}
        {/* Mostrar botón Restaurar si el registro está eliminado y no es log table */}
        {!isLogTable && ((estadoField && isDeletedValue(record[estadoField])) || (activoField && (record[activoField] === false || String(record[activoField]) === 'false'))) && (
          <Button
            size="small"
            shape="circle"
            icon={<FaUndo />}
            onClick={() => handleRestore(record)}
            className="border-0 bg-transparent text-gray-600 hover:text-gray-800"
          />
        )}
        <Button
          size="small"
          shape="circle"
          icon={<FaTrash />}
          onClick={() => handleDelete(record)}
          className="border-0 bg-transparent text-gray-600 hover:text-gray-800"
        />
      </div>
    )
  };

  const tableColumns: ColumnsType<TableRecord> = [
    ...visibleColumns.map(col => ({
      ...col,
      title: col.title,
      dataIndex: col.dataIndex,
      key: col.key,
      width: col.width,
      render: col.render
    })),
    actionColumn
  ];

  const renderFormFields = (isViewMode = false) => {
    if (!columns.length) return null;
    return columns
      .filter(col => !col.hidden && col.key !== 'actions')
      .map(col => {
        // Para cada columna decidimos el componente a renderizar
        // en vista, edición o creación
        // Si es primaryKey: ocultar en creación, mostrar deshabilitado en edición
        // Si la columna está marcada como autoCreated en el schema y estamos en creación,
        // no la mostramos (se gestionará automáticamente en el servidor).
        if (!isViewMode && !selectedRecord && schemaForSelected?.autoCreated && schemaForSelected.autoCreated.includes(col.key)) {
          return null;
        }
        if (!isViewMode && col.key === primaryKey) {
          if (!selectedRecord) {
            // en creación no mostramos el campo id (se delega al backend)
            return null;
          }
          // en edición mostramos el id pero deshabilitado
          return (
            <Form.Item
              key={col.key}
              name={col.key}
              label={
                <span style={{ color: colors.secondary, fontWeight: 'normal' }}>{col.title}</span>
              }
            >
              <Input type="number" disabled />
            </Form.Item>
          );
        }

        // modo vista: si la columna tiene lookupOptions (FK) mostrar la etiqueta humana
        if (isViewMode) {
          if (lookupOptions[col.key] && lookupOptions[col.key].length > 0) {
            const val = form.getFieldValue(col.key);
            const opts = lookupOptions[col.key] || [];
            const found = opts.find(o => o.value === val);
            const display = found ? found.label : String(val ?? '');
            return (
              <Form.Item key={col.key} name={col.key} label={<span style={{ color: colors.secondary, fontWeight: '600' }}>{col.title}</span>}>
                <Input bordered={false} readOnly value={display} />
              </Form.Item>
            );
          }

          if (col.key.includes('activo') || col.key.includes('estado')) {
            return (
              <Form.Item key={col.key} label={<span style={{ color: colors.secondary, fontWeight: '600' }}>{col.title}</span>} name={col.key} valuePropName="checked">
                <Switch disabled />
              </Form.Item>
            );
          }

          const val = form.getFieldValue(col.key);
          let displayVal = '-';
          if (val !== null && val !== undefined && val !== '') {
            // si parece fecha, formatear
            if (typeof val === 'string' && !isNaN(Date.parse(val))) {
              displayVal = new Date(val).toLocaleString('es-ES');
            } else if (val instanceof Date) {
              displayVal = val.toLocaleString('es-ES');
            } else {
              displayVal = String(val);
            }
          }

          return (
            <Form.Item key={col.key} label={<span style={{ color: colors.secondary, fontWeight: '600' }}>{col.title}</span>} name={col.key}>
              <Input className="view-mode-input" bordered={false} readOnly value={displayVal} />
            </Form.Item>
          );
        }

        // modo edición/creación (formulario editable)
        // si existe lookupOptions para esta columna (FK), mostrar Select con búsqueda remota
        if (lookupOptions[col.key] && lookupOptions[col.key].length > 0) {
          const tableForCol = lookupTables[col.key];
          return (
            <Form.Item key={col.key} name={col.key} label={<span style={{ color: colors.secondary }}>{col.title}</span>}>
              <Select
                showSearch
                allowClear
                options={lookupOptions[col.key]}
                placeholder={`Selecciona ${col.title.toLowerCase()}`}
                filterOption={false}
                onSearch={async (val) => {
                  if (!tableForCol) return;
                  if (!val || val.length < 2) return;
                  const opts = await fetchLookupOptionsRemote(tableForCol, val);
                  setLookupOptions(prev => ({ ...prev, [col.key]: opts }));
                }}
                onFocus={async () => {
                  if (!tableForCol) return;
                  if (!lookupOptions[col.key] || lookupOptions[col.key].length === 0) {
                    const opts = await fetchLookupOptionsRemote(tableForCol, '');
                    setLookupOptions(prev => ({ ...prev, [col.key]: opts }));
                  }
                }}
              />
            </Form.Item>
          );
        }

        // campos especiales
        if (col.key.includes('activo') || col.key.includes('estado')) {
          return (
            <Form.Item key={col.key} name={col.key} label={<span style={{ color: colors.secondary }}>{col.title}</span>} valuePropName="checked">
              <Switch />
            </Form.Item>
          );
        }

        if (col.key.includes('fecha') || col.key.includes('created_at') || col.key.includes('updated_at')) {
          return (
            <Form.Item key={col.key} name={col.key} label={<span style={{ color: colors.secondary }}>{col.title}</span>}>
              <Input type="datetime-local" />
            </Form.Item>
          );
        }

        if (col.key.includes('descripcion') || col.key.includes('detalle')) {
          return (
            <Form.Item key={col.key} name={col.key} label={<span style={{ color: colors.secondary }}>{col.title}</span>}>
              <Input.TextArea autoSize={{ minRows: 3, maxRows: 6 }} />
            </Form.Item>
          );
        }

        if (col.key.includes('email')) {
          return (
            <Form.Item key={col.key} name={col.key} label={<span style={{ color: colors.secondary }}>{col.title}</span>}>
              <Input type="email" />
            </Form.Item>
          );
        }

        if (col.key.includes('telefono') || col.key.includes('phone')) {
          return (
            <Form.Item key={col.key} name={col.key} label={<span style={{ color: colors.secondary }}>{col.title}</span>}>
              <Input type="tel" />
            </Form.Item>
          );
        }

        return (
          <Form.Item key={col.key} name={col.key} label={<span style={{ color: colors.secondary }}>{col.title}</span>}>
            <Input placeholder={`Ingrese ${col.title.toLowerCase()}`} />
          </Form.Item>
        );
      });
  };

  // Ajustar el padding-bottom para que el contenido no quede debajo del footer fijo
  useEffect(() => {
    const updateFooter = () => {
      const f = document.querySelector('footer');
      const h = f ? Math.ceil((f as HTMLElement).getBoundingClientRect().height) : 0;
      setFooterHeight(h);
    };

    updateFooter();
    window.addEventListener('resize', updateFooter);

    // Observar cambios en la estructura del footer (ej. se abre algo) para recalcular
    const footerNode = document.querySelector('footer');
    let mo: MutationObserver | null = null;
    if (footerNode && typeof MutationObserver !== 'undefined') {
      mo = new MutationObserver(() => updateFooter());
      mo.observe(footerNode, { childList: true, subtree: true, attributes: true });
    }

    return () => {
      window.removeEventListener('resize', updateFooter);
      if (mo) mo.disconnect();
    };
  }, []);

  return (
    <div className="w-full" style={{ paddingBottom: footerHeight || 16 }}>
      <div className="max-w-screen-2xl mx-auto px-4 lg:px-8">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold" style={{ color: colors.primary }}>
              Mantenimiento de Base de Datos
            </h1>
            <p className="text-gray-600">Gestiona las tablas de la base de datos de forma eficiente</p>
          </div>
          <div className="flex gap-2">
            <Button
              type="primary"
              icon={<RollbackOutlined />}
              onClick={() => setRestoreModalVisible(true)}
              style={{ backgroundColor: colors.secondary, borderColor: colors.secondary, fontWeight: 'bold' }}
            >
              Restaurar Backup
            </Button>
            <button
              onClick={() => navigate(-1)}
              className="self-start rounded-md border bg-white px-3 py-2 text-sm shadow-sm transition hover:bg-gray-50"
            >
              ← Regresar
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-6 xl:flex-row">
          <aside className="shrink-0 xl:w-80">
            <div className="rounded-lg bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: colors.secondary }}>
                  <FaDatabase />
                  <span>Tablas disponibles</span>
                </div>
                <Tag color="geekblue">{availableTables.length}</Tag>
              </div>

              <Select
                value={selectedTable || undefined}
                onChange={(value) => setSelectedTable(value)}
                allowClear
                placeholder="Selecciona una tabla"
                className="mb-3 w-full"
                showSearch
                optionFilterProp="children"
                onClear={() => setSelectedTable('')}
              >
                {availableTables.map((table) => (
                  <Select.Option key={table} value={table}>
                    {formatTableLabel(table)}
                  </Select.Option>
                ))}
              </Select>

              <Input
                allowClear
                value={tableSearch}
                onChange={(event) => setTableSearch(event.target.value)}
                prefix={<FaSearch className="text-gray-400" />}
                placeholder="Buscar tabla"
              />

              <div className="mt-4 max-h-[420px] space-y-4 overflow-y-auto pr-1">
                {groupedTables.length ? (
                  groupedTables.map((group) => (
                    <div key={group.label}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {group.label}
                      </p>
                      <div className="space-y-2">
                        {group.tables.map((tableName) => {
                          const isActive = selectedTable === tableName;
                          return (
                            <button
                              key={tableName}
                              type="button"
                              onClick={() => setSelectedTable(tableName)}
                              className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition ${
                                isActive
                                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm'
                                  : 'border-gray-200 hover:border-emerald-300 hover:bg-emerald-50'
                              }`}
                            >
                              <span className="font-medium">{formatTableLabel(tableName)}</span>
                              <FaChevronRight className="text-xs opacity-60" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                ) : (
                  <Empty description="No se encontraron tablas" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </div>
            </div>
          </aside>

          <section className="min-w-0 flex-1">
            {selectedTable ? (
              <div className="rounded-lg bg-white p-4 shadow-sm md:p-6">
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-xl font-semibold md:text-2xl" style={{ color: colors.primary }}>
                        {selectedTableLabel}
                      </h2>
                      {selectedGroupLabel && <Tag color="default">{selectedGroupLabel}</Tag>}
                      <Tag color="success">{data.length} registros</Tag>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      icon={<FaFilter />}
                      onClick={() => setShowFilters((prev) => !prev)}
                      style={{ borderColor: colors.primary, color: colors.primary }}
                    >
                      {showFilters ? 'Ocultar filtros' : 'Filtros'}
                    </Button>
                    {!isLogTable && (
                      <Button
                        type="primary"
                        icon={<FaPlus />}
                        onClick={handleAdd}
                        style={{ backgroundColor: colors.primary, borderColor: colors.primary }}
                      >
                        Agregar {selectedTableLabel.toLowerCase()}
                      </Button>
                    )}
                  </div>
                </div>

                {lastError && (
                  <Alert
                    type="error"
                    message="Hubo un problema al cargar la tabla"
                    description={lastError}
                    showIcon
                    closable
                    className="mb-4"
                    onClose={() => setLastError(null)}
                  />
                )}

                {showFilters && (
                  <div className="mb-6 rounded-lg bg-gray-50 p-4">
                    <h3 className="mb-4 text-lg font-semibold" style={{ color: colors.secondary }}>
                      Filtros rápidos
                    </h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
                      {visibleColumns.slice(0, 8).map((col) => (
                        lookupOptions[col.key] && lookupOptions[col.key].length > 0 ? (
                          <Select
                            key={col.key}
                            placeholder={`Filtrar ${col.title}`}
                            allowClear
                            options={lookupOptions[col.key]}
                            filterOption={false}
                            onSearch={async (val) => {
                              const tableForCol = lookupTables[col.key];
                              if (!tableForCol) return;
                              if (!val || val.length < 2) return;
                              const opts = await fetchLookupOptionsRemote(tableForCol, val);
                              setLookupOptions((prev) => ({ ...prev, [col.key]: opts }));
                            }}
                            onChange={(val) => handleFilterChange(col.key, String(val || ''))}
                            value={filters[col.key] || undefined}
                          />
                        ) : (
                          <Input
                            key={col.key}
                            placeholder={`Filtrar ${col.title}`}
                            value={filters[col.key] || ''}
                            onChange={(event) => handleFilterChange(col.key, event.target.value)}
                            allowClear
                          />
                        )
                      ))}
                    </div>
                  </div>
                )}

                {loading ? (
                  <div className="py-12 text-center">
                    <Spin size="large" />
                    <p className="mt-4 text-gray-600">Cargando datos...</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table
                      columns={tableColumns}
                      dataSource={data}
                      rowKey={(record) => {
                        const pkValue = primaryKey ? record[primaryKey] : undefined;
                        if (pkValue !== null && pkValue !== undefined) {
                          return String(pkValue);
                        }
                        return Object.values(record).join('-');
                      }}
                      rowClassName={(record) => {
                        try {
                          if (estadoField && isDeletedValue(record[estadoField])) return 'deleted-row';
                          if (activoField && String(record[activoField]) === 'false') return 'deleted-row';
                        } catch {
                          return '';
                        }
                        return '';
                      }}
                      pagination={{
                        current: tableCurrentPage,
                        pageSize: tablePageSize,
                        total: data.length,
                        showSizeChanger: true,
                        pageSizeOptions: ['5', '10', '20', '50'],
                        showQuickJumper: true,
                        onChange: (page, size) => {
                          setTableCurrentPage(page);
                          setTablePageSize(size as number);
                        },
                        showTotal: (total, range) => `${range[0]}-${range[1]} de ${total} registros`
                      }}
                      className="custom-table inv-table w-full"
                      size="middle"
                      scroll={{ x: true }}
                      locale={{
                        emptyText: (
                          <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description={showDeleted ? 'No hay registros eliminados' : 'Sin registros disponibles'}
                          />
                        )
                      }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 rounded-lg bg-white p-12 text-center shadow-sm">
                <Empty description="Selecciona una tabla para comenzar" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                <p className="text-sm text-gray-500">
                  Explora el listado de la izquierda y elige la tabla que deseas administrar.
                </p>
              </div>
            )}
          </section>
        </div>

        <Drawer
          title={`Ver ${selectedTable.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`}
          open={viewModalVisible}
          onClose={() => {
            setViewModalVisible(false);
            form.resetFields();
          }}
          width={500}
          footer={
            <div className="flex justify-end gap-2">
              <Button onClick={() => {
                setViewModalVisible(false);
                form.resetFields();
              }}>
                Cerrar
              </Button>
            </div>
          }
        >
          <Form
            form={form}
            layout="vertical"
            disabled={true}
          >
            {renderFormFields()}
          </Form>
        </Drawer>

        <Drawer
          title={`${selectedRecord ? 'Editar' : 'Agregar'} ${selectedTable.replace(/_/g, ' ')}`}
          open={addModalVisible || editModalVisible}
          onClose={() => {
            setAddModalVisible(false);
            setEditModalVisible(false);
            form.resetFields();
          }}
          width={500}
          footer={
            <div className="flex justify-end gap-2">
              <Button onClick={() => {
                setAddModalVisible(false);
                setEditModalVisible(false);
                form.resetFields();
              }}>
                Cancelar
              </Button>
              <Button
                type="primary"
                onClick={() => form.submit()}
                style={{ backgroundColor: colors.primary, borderColor: colors.primary }}
              >
                {selectedRecord ? 'Actualizar' : 'Crear'}
              </Button>
            </div>
          }
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSave}
          >
            {renderFormFields()}
          </Form>
        </Drawer>

        <Modal
          title="Restaurar Backup"
          open={restoreModalVisible}
          onOk={handleRestoreBackup}
          onCancel={() => setRestoreModalVisible(false)}
          confirmLoading={restoring}
          okText="Restaurar"
          cancelText="Cancelar"
        >
          <p>Selecciona un archivo SQL de backup para restaurar la base de datos.</p>
          <Upload
            beforeUpload={(file) => {
              setRestoreFile(file);
              return false;
            }}
            maxCount={1}
            accept=".sql"
          >
            <Button icon={<UploadOutlined />}>Seleccionar archivo SQL</Button>
          </Upload>
          {restoreFile && <p>Archivo seleccionado: {restoreFile.name}</p>}
        </Modal>
      </div>
    </div>
  );
};

export default Mantenimiento;
