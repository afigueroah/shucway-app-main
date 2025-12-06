import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Modal, Select, Tooltip, Typography, message } from 'antd';
import {
  DeleteOutlined,
  DownloadOutlined,
  LeftOutlined,
  ReloadOutlined,
  RollbackOutlined,
  RightOutlined,
  DatabaseOutlined,
  InfoCircleOutlined,
  FileTextOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { localStore } from '../../../../utils/storage';

const { Paragraph, Text, Title } = Typography;

const tableStyles = `
.inv-table {
  width: 100%;
  border-collapse: collapse;
  background: #ffffff;
  border-radius: 0.75rem;
  overflow: hidden;
  box-shadow: 0 6px 20px rgba(16,24,40,0.06);
}

.inv-table th, .inv-table td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid #f1f3f4;
  font-size: 0.9rem;
}

.inv-table th {
  background: #f8f9fa;
  font-weight: 600;
  color: #12443D;
  text-transform: uppercase;
  font-size: 0.8rem;
  letter-spacing: 0.5px;
}

.inv-table tbody tr:hover {
  background: #f8f9fa;
}

.inv-table tbody tr:last-child td {
  border-bottom: none;
}

.inv-table tfoot td {
  background: #f8f9fa;
  font-weight: 500;
  color: #12443D;
  border-top: 1px solid #e4e7eb;
}
`;

interface SchemaSnippet {
  name: string;
  definition: string;
}

interface SchemaSqlPayload {
  success?: boolean;
  generatedAt: string;
  tables: SchemaSnippet[];
  inserts: string[];
  triggers: SchemaSnippet[];
  functions: SchemaSnippet[];
  details?: string;
}

export type IncrementalTableKey = 'inventario' | 'ventas' | 'compras' | 'gastos' | 'usuarios' | 'caja';

interface IncrementalSqlPayload {
  success?: boolean;
  generatedAt: string;
  tables: Record<IncrementalTableKey, { sql: string; count: number }>;
  details?: string;
}

interface BackupHistoryItem {
  id: string;
  type: 'schema' | 'incremental';
  label: string;
  filename: string;
  createdAt: string;
  sizeBytes: number;
  sourceGeneratedAt?: string;
  tableKey?: IncrementalTableKey;
}

const MAX_HISTORY_ITEMS = 10;
const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

const INCREMENTAL_OPTIONS: { value: IncrementalTableKey; label: string }[] = [
  { value: 'inventario', label: 'Inventario' },
  { value: 'ventas', label: 'Ventas' },
  { value: 'compras', label: 'Compras' },
  { value: 'gastos', label: 'Gastos Operativos' },
  { value: 'usuarios', label: 'Usuarios' },
  { value: 'caja', label: 'Caja' },
];

const createId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 12);

const sanitizeFilenameFragment = (value: string) => value.replace(/[:.]/g, '-');

const formatBytes = (bytes?: number) => {
  if (!bytes || Number.isNaN(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index++;
  }
  return `${value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
};

const composeSchemaSql = (payload: SchemaSqlPayload): string => {
  const sections: string[] = [];

  sections.push('-- SHUCWAY ERP - Backup de Datos');
  sections.push(`-- Generado: ${payload.generatedAt}`);
  sections.push('-- Este archivo incluye TODOS los datos actuales de la base de datos');
  sections.push('');

  if (payload.inserts.length) {
    payload.inserts.forEach((statement) => {
      sections.push(statement.trim());
    });
    sections.push('');
  }

  sections.push('-- Fin del respaldo');

  return sections.join('\n');
};

const loadStoredHistory = (): BackupHistoryItem[] => {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStore.get<BackupHistoryItem[]>('backups');
    if (!stored || !Array.isArray(stored)) {
      return [];
    }

    return stored
      .map((item: Partial<BackupHistoryItem>) => ({
        id: item.id ?? createId(),
        type: (item.type as BackupHistoryItem['type']) ?? 'schema',
        label: item.label ?? 'Desconocido',
        filename: item.filename ?? 'backup.sql',
        createdAt: item.createdAt ?? new Date().toISOString(),
        sizeBytes: typeof item.sizeBytes === 'number' ? item.sizeBytes : 0,
        sourceGeneratedAt: item.sourceGeneratedAt,
        tableKey: item.tableKey as IncrementalTableKey | undefined,
      }))
      .slice(0, MAX_HISTORY_ITEMS);
  } catch {
    return [];
  }
};

const formatDateTime = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const formatSize = (bytes: number) => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

const Backup: React.FC = () => {
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();

  const apiBaseUrl = useMemo(
    () => ((import.meta.env.VITE_API_URL as string | undefined) || '/api').replace(/\/$/, ''),
    []
  );

  const [schemaData, setSchemaData] = useState<SchemaSqlPayload | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  const [incrementalData, setIncrementalData] = useState<IncrementalSqlPayload | null>(null);
  const [incrementalLoading, setIncrementalLoading] = useState(false);
  const [incrementalError, setIncrementalError] = useState<string | null>(null);

  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const [history, setHistory] = useState<BackupHistoryItem[]>(() => loadStoredHistory());
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(10);
  const [selectedTable, setSelectedTable] = useState<IncrementalTableKey>('inventario');

  const persistHistory = useCallback((records: BackupHistoryItem[]) => {
    localStore.set('backups', records, { expires: 60 * 24 * 30 }); // 30 días
  }, []);

  const registerHistory = useCallback(
    (entry: BackupHistoryItem) => {
      setHistory((prev) => {
        const next = [entry, ...prev].slice(0, MAX_HISTORY_ITEMS);
        persistHistory(next);
        return next;
      });
      setHistoryPage(1);
    },
    [persistHistory]
  );

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(history.length / historyPageSize));
    setHistoryPage((prev) => (prev > totalPages ? totalPages : prev));
  }, [history, historyPageSize]);

  const downloadTextFile = useCallback((content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/sql;charset=utf-8;' });
    const size = blob.size;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return size;
  }, []);

  const fetchSchema = useCallback(
    async (showFeedback = false) => {
      setSchemaLoading(true);
      setSchemaError(null);

      try {
        const response = await fetch(`${apiBaseUrl}/backup/schema-sql`);
        if (!response.ok) {
          throw new Error(`No se pudo obtener el esquema (HTTP ${response.status}).`);
        }

        const payload = (await response.json()) as SchemaSqlPayload;
        if (!payload.success) {
          throw new Error(payload.details || 'La API devolvió un error al generar el esquema SQL.');
        }

        setSchemaData(payload);
        if (showFeedback) {
          messageApi.success('Esquema SQL actualizado.');
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Error desconocido al cargar el esquema SQL.';
        setSchemaError(errorMessage);
        messageApi.error(errorMessage);
      } finally {
        setSchemaLoading(false);
      }
    },
    [apiBaseUrl, messageApi]
  );

  const fetchIncremental = useCallback(
    async (showFeedback = false) => {
      setIncrementalLoading(true);
      setIncrementalError(null);

      try {
        const response = await fetch(`${apiBaseUrl}/backup/incremental-sql`);
        if (!response.ok) {
          throw new Error(`No se pudo obtener el SQL incremental (HTTP ${response.status}).`);
        }

        const payload = (await response.json()) as IncrementalSqlPayload;
        if (!payload.success) {
          throw new Error(payload.details || 'La API devolvió un error al generar el SQL incremental.');
        }

        setIncrementalData(payload);
        if (showFeedback) {
          messageApi.success('SQL incremental actualizado.');
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Error desconocido al cargar el SQL incremental.';
        setIncrementalError(errorMessage);
        messageApi.error(errorMessage);
      } finally {
        setIncrementalLoading(false);
      }
    },
    [apiBaseUrl, messageApi]
  );

  useEffect(() => {
    fetchSchema();
    fetchIncremental();
  }, [fetchSchema, fetchIncremental]);

  const handleDownloadSchema = useCallback(() => {
    if (!schemaData) {
      messageApi.warning('Aún no se cargó la información del esquema.');
      return;
    }

    const sql = composeSchemaSql(schemaData);
    const timestamp = sanitizeFilenameFragment(schemaData.generatedAt || new Date().toISOString());
    const filename = `backup-completo-${timestamp}.sql`;

    const sizeBytes = downloadTextFile(sql, filename);
    registerHistory({
      id: createId(),
      type: 'schema',
      label: 'Backup de Datos',
      createdAt: new Date().toISOString(),
      filename,
      sizeBytes,
      sourceGeneratedAt: schemaData.generatedAt,
    });
    messageApi.success('Backup de datos exportado exitosamente con todos los datos actuales.');
  }, [schemaData, downloadTextFile, registerHistory, messageApi]);

  const downloadIncremental = useCallback(
    (table: IncrementalTableKey) => {
      if (!incrementalData) {
        messageApi.warning('Aún no se cargó la información incremental.');
        return;
      }

      const tablePayload = incrementalData.tables[table];
      if (!tablePayload || !tablePayload.sql.trim()) {
        messageApi.warning('No hay datos disponibles para la tabla seleccionada.');
        return;
      }

      const timestamp = sanitizeFilenameFragment(incrementalData.generatedAt || new Date().toISOString());
      const filename = `backup-incremental-${table}-${timestamp}.sql`;

      const sizeBytes = downloadTextFile(tablePayload.sql, filename);
      const label =
        INCREMENTAL_OPTIONS.find((option) => option.value === table)?.label ?? table;

      registerHistory({
        id: createId(),
        type: 'incremental',
        label,
        createdAt: new Date().toISOString(),
        filename,
        sizeBytes,
        sourceGeneratedAt: incrementalData.generatedAt,
        tableKey: table,
      });

      messageApi.success(`SQL incremental de ${label.toLowerCase()} exportado.`);
    },
    [incrementalData, downloadTextFile, registerHistory, messageApi]
  );

  const handleDownloadIncremental = useCallback(() => {
    downloadIncremental(selectedTable);
  }, [downloadIncremental, selectedTable]);

  const handleHistoryDownload = useCallback(
    (item: BackupHistoryItem) => {
      if (item.type === 'schema') {
        handleDownloadSchema();
      } else if (item.tableKey) {
        downloadIncremental(item.tableKey);
      } else {
        handleDownloadIncremental();
      }
    },
    [downloadIncremental, handleDownloadIncremental, handleDownloadSchema]
  );

  const handleDeleteHistory = useCallback(
    (id: string) => {
      Modal.confirm({
        title: '¿Eliminar registro de backup?',
        content: 'Esta acción no se puede deshacer. ¿Deseas eliminar este registro? ',
        okText: 'Eliminar',
        okType: 'danger',
        cancelText: 'Cancelar',
        onOk: () => {
          setHistory((prev) => {
            const next = prev.filter((item) => item.id !== id);
            persistHistory(next);
            return next;
          });
          messageApi.success('Registro eliminado correctamente.');
        },
      });
    },
    [messageApi, persistHistory]
  );

  const handleClearHistory = useCallback(() => {
    if (!history.length) {
      messageApi.info('No hay registros para limpiar.');
      return;
    }

    Modal.confirm({
      title: '¿Limpiar historial local?',
      content: 'Esto eliminará todos los registros de backups guardados en este navegador.',
      okText: 'Limpiar',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk: () => {
        setHistory([]);
        persistHistory([]);
        messageApi.success('Historial local eliminado.');
      },
    });
  }, [history.length, messageApi, persistHistory]);

  const handleRestoreBackup = useCallback(async () => {
    if (!selectedFile) {
      messageApi.error('Por favor selecciona un archivo SQL para restaurar.');
      return;
    }

    Modal.confirm({
      title: (
        <div className="flex items-center gap-2">
          <DatabaseOutlined className="text-blue-500" />
          <span className="text-lg font-semibold">Restaurar Backup</span>
        </div>
      ),
      content: (
        <div className="space-y-4 py-2">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <InfoCircleOutlined className="text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-blue-900 mb-1">¿Estás seguro de restaurar este backup?</h4>
                <p className="text-sm text-blue-700">
                  Esta acción importará los datos del archivo seleccionado a la base de datos.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <h5 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
              <FileTextOutlined />
              Información del archivo
            </h5>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Nombre:</span>
                <span className="font-medium text-gray-900 truncate max-w-48" title={selectedFile.name}>
                  {selectedFile.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tamaño:</span>
                <span className="font-medium text-gray-900">{formatBytes(selectedFile.size)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tipo:</span>
                <span className="font-medium text-gray-900">SQL Database</span>
              </div>
            </div>
          </div>

          <Alert
            message={
              <div className="flex items-center gap-2">
                <ExclamationCircleOutlined />
                <span className="font-medium">Advertencia importante</span>
              </div>
            }
            description={
              <div className="space-y-1">
                <p>• Esta acción puede sobrescribir datos existentes</p>
                <p>• Asegúrate de tener un backup actual antes de continuar</p>
                <p>• Los datos existentes podrían perderse permanentemente</p>
              </div>
            }
            type="warning"
            showIcon={false}
            className="border-orange-200 bg-orange-50"
          />

          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircleOutlined />
              <span className="font-medium">¿Todo listo?</span>
            </div>
            <p className="text-sm text-green-700 mt-1">
              Una vez confirmado, el sistema procesará todos los INSERT statements del archivo.
            </p>
          </div>
        </div>
      ),
      okText: (
        <div className="flex items-center gap-2">
          <UploadOutlined />
          <span>Restaurar Backup</span>
        </div>
      ),
      okType: 'primary',
      okButtonProps: {
        className: 'bg-blue-600 hover:bg-blue-700 border-blue-600',
        size: 'large',
      },
      cancelText: 'Cancelar',
      cancelButtonProps: {
        size: 'large',
      },
      width: 600,
      centered: true,
      onOk: async () => {
        setRestoreLoading(true);
        setRestoreError(null);

        try {
          const formData = new FormData();
          formData.append('backupFile', selectedFile);

          const response = await fetch(`${apiBaseUrl}/backup/restore`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStore.get('access_token')}`,
            },
            body: formData,
          });

          const result = await response.json();

          if (response.ok && result.success) {
            messageApi.success(
              `Backup restaurado exitosamente. ${result.results.success} inserts procesados correctamente.`
            );
            setSelectedFile(null);

            // Mostrar detalles si hay errores
            if (result.results.errors > 0) {
              Modal.info({
                title: 'Detalles de la restauración',
                content: (
                  <div className="max-h-96 overflow-y-auto">
                    <p className="mb-4">
                      <strong>Total:</strong> {result.results.total} statements<br />
                      <strong>Éxitos:</strong> {result.results.success}<br />
                      <strong>Errores:</strong> {result.results.errors}
                    </p>
                    {result.results.details.filter((d: any) => !d.success).length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2">Errores encontrados:</h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {result.results.details
                            .filter((d: any) => !d.success)
                            .map((detail: any, index: number) => (
                              <div key={index} className="text-sm bg-red-50 p-2 rounded border">
                                <strong>Statement {detail.index}:</strong> {detail.error}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                ),
                width: 600,
              });
            }
          } else {
            throw new Error(result.details || result.error || 'Error al restaurar el backup');
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error desconocido al restaurar backup';
          setRestoreError(errorMessage);
          messageApi.error(errorMessage);
        } finally {
          setRestoreLoading(false);
        }
      },
    });
  }, [selectedFile, apiBaseUrl, messageApi]);

  const incrementalTotals = useMemo(() => {
    if (!incrementalData) return null;
    const entries = Object.entries(incrementalData.tables) as [IncrementalTableKey, { sql: string; count: number }][];
    const total = entries.reduce((acc, [, value]) => acc + value.count, 0);
    return {
      total,
      entries,
      generatedAt: incrementalData.generatedAt,
    };
  }, [incrementalData]);

  const schemaMetrics = useMemo(
    () => [
      { label: 'Tablas', value: schemaData?.tables.length ?? null },
      { label: 'Triggers', value: schemaData?.triggers.length ?? null },
      { label: 'Funciones', value: schemaData?.functions.length ?? null },
      { label: 'Inserts', value: schemaData?.inserts.length ?? null },
    ],
    [schemaData]
  );

  const totalPages = useMemo(() => Math.max(1, Math.ceil(history.length / historyPageSize)), [historyPageSize, history]);

  const paginatedHistory = useMemo(() => {
    const startIndex = (historyPage - 1) * historyPageSize;
    return history.slice(startIndex, startIndex + historyPageSize);
  }, [historyPageSize, history, historyPage]);

  return (
    <div className="min-h-screen bg-white py-8 px-4">
      {contextHolder}
      <style>{tableStyles}</style>
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-10">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-sky-500 p-8 shadow-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3 text-white">
              <Title level={2} className="!mb-0 !text-white !text-3xl">
                Gestor de Backups SQL
              </Title>
              <Paragraph className="!mb-0 max-w-xl text-sm leading-relaxed text-white/70">
                Centraliza la generación de respaldos de estructura y datos incrementales con acciones rápidas, métricas
                en vivo y un historial listo para volver a descargar.
              </Paragraph>
              <div className="flex items-center gap-3 text-xs text-white/75">
                <Tooltip title="Actualizar esquema e incrementales">
                  <Button
                    shape="circle"
                    icon={<ReloadOutlined />}
                    onClick={() => {
                      fetchSchema(true);
                      fetchIncremental(true);
                    }}
                    loading={schemaLoading || incrementalLoading}
                    className="border border-white/30 bg-white/10 !text-white hover:bg-white/20"
                  />
                </Tooltip>
                <Tooltip title="Regresar">
                  <Button
                    shape="circle"
                    icon={<RollbackOutlined />}
                    onClick={() => navigate(-1)}
                    className="border border-white/30 bg-white/10 !text-white hover:bg-white/20"
                  />
                </Tooltip>
                <span>
                  {schemaData ? `Esquema generado ${formatDateTime(schemaData.generatedAt)}` : 'Aún no se genera un esquema'}
                </span>
              </div>
            </div>
            <div className="grid w-full gap-3 text-white sm:grid-cols-2 lg:grid-cols-4">
              {schemaMetrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-2xl bg-white/10 p-4 text-center backdrop-blur-sm transition hover:bg-white/20"
                >
                  <span className="text-[11px] uppercase tracking-wide text-white/70">{metric.label}</span>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {metric.value !== null ? metric.value : '—'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="grid gap-10 lg:grid-cols-[2fr,1fr]">
          <div className="flex flex-col gap-8">
            <section className="rounded-3xl border border-emerald-100 bg-white p-8 shadow-xl">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-xl space-y-2">
                  <Text strong className="text-emerald-700">
                    Backup de Datos
                  </Text>
                  <Paragraph className="!mb-0 text-sm text-emerald-900/75">
                    Exporta la definición completa de tu base de datos incluyendo tablas, triggers, funciones y TODOS los datos actuales. Ideal para migraciones completas o restauraciones totales con información actual.
                  </Paragraph>
                </div>
                <Button
                  type="primary"
                  size="large"
                  className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 focus:from-emerald-600 focus:to-emerald-700 active:from-emerald-700 active:to-emerald-800 border-0 shadow-lg hover:shadow-xl focus:shadow-xl active:shadow-xl transform hover:scale-105 focus:scale-105 active:scale-105 transition-all duration-200"
                  onClick={handleDownloadSchema}
                  loading={schemaLoading}
                  disabled={schemaLoading || !schemaData}
                >
                  <div className="flex items-center gap-2">
                    <DownloadOutlined className="text-lg" />
                    <span className="font-semibold">Backup de Datos</span>
                  </div>
                </Button>
              </div>
              {schemaError ? <Alert type="error" message={schemaError} showIcon className="mt-4" /> : null}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
              <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <Text strong className="text-lg text-slate-800">Historial de descargas</Text>
                  <Paragraph className="!mb-0 text-sm text-slate-500">
                    Tabla con el mismo estilo que el inventario para volver a descargar o limpiar registros locales.
                  </Paragraph>
                </div>
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="inv-table">
                    <thead>
                      <tr>
                        <th className="min-w-[200px]">Fecha</th>
                        <th className="min-w-[130px]">Tipo</th>
                        <th className="min-w-[160px]">Archivo</th>
                        <th className="min-w-[110px]">Tamaño</th>
                        <th className="min-w-[150px]">Acciones</th>
                        <th className="min-w-[90px]">Eliminar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.length ? (
                        paginatedHistory.map((item) => (
                          <tr key={item.id}>
                            <td>{formatDateTime(item.createdAt)}</td>
                            <td>{item.type === 'schema' ? 'Estructura' : `Incremental · ${item.label}`}</td>
                            <td>{item.filename}</td>
                            <td>{formatSize(item.sizeBytes)}</td>
                            <td>
                              <Tooltip title="Descargar respaldo">
                                <Button
                                  size="small"
                                  shape="circle"
                                  icon={<DownloadOutlined />}
                                  onClick={() => handleHistoryDownload(item)}
                                  className="border-0 bg-emerald-600 text-white hover:bg-emerald-700"
                                />
                              </Tooltip>
                            </td>
                            <td>
                              <Button
                                size="middle"
                                icon={<DeleteOutlined style={{ fontSize: '16px' }} />}
                                danger
                                onClick={() => handleDeleteHistory(item.id)}
                                className="border-0"
                              />
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-sm text-slate-500">
                            Todavía no hay descargas registradas en este equipo.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {history.length ? (
                      <tfoot>
                        <tr>
                          <td colSpan={6}>
                            <div className="flex flex-col gap-4 text-xs text-slate-600">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <span>
                                  Mostrando {paginatedHistory.length} de {history.length}{' '}
                                  {history.length === 1
                                    ? 'respaldo guardado localmente.'
                                    : 'respaldos guardados localmente.'}
                                </span>
                                <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
                                  <span className="text-slate-400">
                                    Última descarga registrada {formatDateTime(history[0]?.createdAt)}
                                  </span>
                                  <Tooltip title="Eliminar todos los registros locales">
                                    <Button
                                      type="primary"
                                      size="small"
                                      danger
                                      icon={<DeleteOutlined />}
                                      onClick={handleClearHistory}
                                    >
                                      Limpiar historial
                                    </Button>
                                  </Tooltip>
                                </div>
                              </div>
                              {totalPages > 1 ? (
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-[11px] uppercase tracking-wide text-slate-500">
                                  <div className="flex items-center gap-3">
                                    <span>Página {historyPage} de {totalPages}</span>
                                    <Button
                                      size="small"
                                      onClick={() => setHistoryPage((prev) => Math.max(1, prev - 1))}
                                      disabled={historyPage <= 1}
                                    >
                                      <LeftOutlined /> Anterior
                                    </Button>
                                    <Button
                                      size="small"
                                      onClick={() => setHistoryPage((prev) => (prev < totalPages ? prev + 1 : prev))}
                                      disabled={historyPage >= totalPages}
                                    >
                                      Siguiente <RightOutlined />
                                    </Button>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-400 mr-2">Mostrar:</span>
                                    <Select
                                      size="small"
                                      value={historyPageSize}
                                      onChange={(val: number) => {
                                        setHistoryPageSize(Number(val));
                                        setHistoryPage(1);
                                      }}
                                      options={PAGE_SIZE_OPTIONS.map(n => ({ value: n, label: String(n) }))}
                                      style={{ width: 96 }}
                                    />
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      </tfoot>
                    ) : null}
                  </table>
                </div>
              </div>
            </section>
          </div>

          <div className="flex flex-col gap-8">
            <section className="rounded-3xl border border-sky-100 bg-white p-8 shadow-xl">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Text strong className="text-sky-700">
                    Incrementales por módulo
                  </Text>
                  <Paragraph className="!mb-0 text-sm text-sky-900/75">
                    Genera scripts INSERT con los datos operativos recientes. Selecciona un módulo, previsualiza el SQL y
                    descarga el archivo listo para ejecutar.
                  </Paragraph>
                </div>
                <Select
                  value={selectedTable}
                  onChange={(value: IncrementalTableKey) => setSelectedTable(value)}
                  options={INCREMENTAL_OPTIONS}
                  size="large"
                  className="w-full"
                />
                <div className="flex items-center gap-2">
                  <Tooltip title="Descargar SQL incremental">
                    <Button
                      type="primary"
                      shape="circle"
                      icon={<DownloadOutlined />}
                      className="border-0 bg-sky-600 hover:bg-sky-700"
                      onClick={handleDownloadIncremental}
                      loading={incrementalLoading}
                      disabled={incrementalLoading || !incrementalData}
                    />
                  </Tooltip>
                </div>
                {incrementalTotals ? (
                  <div className="grid gap-3 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm text-sky-700">
                    <div className="flex items-center justify-between">
                      <span>Total incremental</span>
                      <span className="font-semibold text-sky-900">{incrementalTotals.total} filas</span>
                    </div>
                    <div className="text-xs text-sky-600/90">
                      {incrementalTotals.generatedAt
                        ? `Generado ${formatDateTime(incrementalTotals.generatedAt)}`
                        : 'Actualiza incrementales para conocer el detalle.'}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-sky-200 bg-sky-50/60 p-4 text-center text-sm text-sky-600">
                    Genera o actualiza incrementales para ver las métricas.
                  </div>
                )}
                {incrementalError ? <Alert type="error" message={incrementalError} showIcon /> : null}
              </div>
            </section>

            <section className="rounded-3xl border border-red-100 bg-white p-8 shadow-xl">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Text strong className="text-red-700">
                    Restaurar Backup
                  </Text>
                  <Paragraph className="!mb-0 text-sm text-red-900/75">
                    Sube un archivo SQL de backup para restaurar los datos. Solo se procesarán los statements INSERT.
                  </Paragraph>
                </div>

                <div className="space-y-4">
                  <div>
                    <input
                      type="file"
                      accept=".sql"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setSelectedFile(file);
                        setRestoreError(null);
                      }}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100"
                    />
                    {selectedFile && (
                      <div className="mt-2 text-sm text-gray-600">
                        Archivo seleccionado: <strong>{selectedFile.name}</strong> ({formatBytes(selectedFile.size)})
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Tooltip title="Restaurar backup desde archivo SQL">
                      <Button
                        type="primary"
                        shape="circle"
                        icon={<RollbackOutlined />}
                        className="border-0 bg-red-600 hover:bg-red-700"
                        onClick={handleRestoreBackup}
                        loading={restoreLoading}
                        disabled={restoreLoading || !selectedFile}
                      />
                    </Tooltip>
                  </div>
                </div>

                {restoreError ? <Alert type="error" message={restoreError} showIcon /> : null}

                <Alert
                  message="Importante"
                  description="Asegúrate de que el archivo SQL contenga solo statements INSERT válidos. La restauración puede tomar tiempo dependiendo del tamaño del archivo."
                  type="info"
                  showIcon
                />
              </div>
            </section>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Backup;
