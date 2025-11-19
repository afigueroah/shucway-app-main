import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { message } from "antd";
import {
  BarChart3,
  CalendarDays,
  Download,
  Eye,
  FileText,
  FileSpreadsheet,
  Info,
  Pencil,
  Plus,
  RefreshCw,
  Repeat2,
  Search,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import gastosOperativosService, {
  CategoriaGasto,
  CreateGastoDTO,
  FrecuenciaGasto,
  GastoOperativo,
  UpdateGastoDTO,
} from "../../../api/gastosOperativosService";
import html2pdf from 'html2pdf.js';

type DateFilterValue = 30 | 90 | 365 | "all";

type FormState = {
  nombre_gasto: string;
  categoria_gasto: CategoriaGasto;
  frecuencia: FrecuenciaGasto;
  monto: string;
  detalle: string;
  estado: 'activo' | 'desactivado';
};

type FormErrors = Partial<Record<keyof FormState, string>> & { general?: string };

const CATEGORY_OPTIONS: Array<{ label: string; value: CategoriaGasto }> = [
  { label: "Gastos de Personal", value: "Gastos de Personal" },
  { label: "Servicios Fijos (Mensuales)", value: "Servicios Fijos (Mensuales)" },
  { label: "Insumos Operativos", value: "Insumos Operativos" },
  { label: "Gastos de Transporte", value: "Gastos de Transporte" },
  { label: "Mantenimiento y Reemplazos", value: "Mantenimiento y Reemplazos" },
];

const FREQUENCY_OPTIONS: Array<{ label: string; value: FrecuenciaGasto }> = [
  { label: "Mensual", value: "mensual" },
  { label: "Quincenal", value: "quincenal" },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const DATE_FILTERS: Array<{ label: string; value: DateFilterValue; helper?: string }> = [
  { label: "Últimos 30 días", value: 30 },
  { label: "Últimos 90 días", value: 90, helper: "Recomendado" },
  { label: "Últimos 12 meses", value: 365 },
  { label: "Todo", value: "all" },
];

const initialForm: FormState = {
  nombre_gasto: "",
  categoria_gasto: CATEGORY_OPTIONS[0].value,
  frecuencia: "mensual",
  monto: "",
  detalle: "",
  estado: "activo",
};

const currencyFormatter = new Intl.NumberFormat("es-GT", {
  style: "currency",
  currency: "GTQ",
  maximumFractionDigits: 2,
});

const formatCurrency = (value: number) => currencyFormatter.format(value);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-GT", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const getMonthlyEquivalent = (gasto: GastoOperativo) =>
  gasto.frecuencia === "quincenal" ? Number(gasto.monto) * 2 : Number(gasto.monto);

const highlightClass = "bg-emerald-600 text-white";

export default function GastosOperativos() {
  const navigate = useNavigate();
  const [gastos, setGastos] = useState<GastoOperativo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedGasto, setSelectedGasto] = useState<GastoOperativo | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [categoriaFilter, setCategoriaFilter] = useState<CategoriaGasto | "all">("all");
  const [frecuenciaFilter, setFrecuenciaFilter] = useState<FrecuenciaGasto | "all">("all");
  const [dateFilter, setDateFilter] = useState<DateFilterValue>(90);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [editingGasto, setEditingGasto] = useState<GastoOperativo | null>(null);
  const [editForm, setEditForm] = useState<FormState>(initialForm);
  const [editFormErrors, setEditFormErrors] = useState<FormErrors>({});
  const [updating, setUpdating] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingGasto, setDeletingGasto] = useState<GastoOperativo | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    loadData(true);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, categoriaFilter, frecuenciaFilter, dateFilter, pageSize]);

  const loadData = async (showSpinner = false) => {
    if (showSpinner) {
      setLoading(true);
    }
    setError(null);
    try {
      const [gastosList] = await Promise.all([
        gastosOperativosService.getGastos(),
      ]);
      setGastos(gastosList);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al cargar los gastos";
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const stats = useMemo(() => {
    let totalBase = 0;
    let totalAjustado = 0;
    let totalQuincenal = 0;
    let totalMensual = 0;
    let countQuincenal = 0;
    let countMensual = 0;

    // Solo contar gastos activos
    const gastosActivos = gastos.filter((g) => g.estado === 'activo');

    gastosActivos.forEach((gasto) => {
      const monto = Number(gasto.monto) || 0;
      totalBase += monto;
      if (gasto.frecuencia === "quincenal") {
        totalAjustado += monto * 2;
        totalQuincenal += monto;
        countQuincenal += 1;
      } else {
        totalAjustado += monto;
        totalMensual += monto;
        countMensual += 1;
      }
    });

    const promedioMensual = gastosActivos.length ? totalAjustado / gastosActivos.length : 0;

    return {
      totalBase,
      totalAjustado,
      totalQuincenal,
      totalMensual,
      countQuincenal,
      countMensual,
      promedioMensual,
    };
  }, [gastos]);

  const filteredGastos = useMemo(() => {
    const searchQuery = search.trim().toLowerCase();
    const now = new Date();
    const limitDate =
      dateFilter === "all"
        ? null
        : new Date(now.getFullYear(), now.getMonth(), now.getDate() - dateFilter);

    return gastos.filter((gasto) => {
      const matchSearch = !searchQuery
        || gasto.nombre_gasto.toLowerCase().includes(searchQuery)
        || gasto.detalle.toLowerCase().includes(searchQuery)
        || gasto.numero_gasto.toLowerCase().includes(searchQuery)
        || gasto.categoria_gasto.toLowerCase().includes(searchQuery);

      const matchCategoria = categoriaFilter === "all" || gasto.categoria_gasto === categoriaFilter;
      const matchFrecuencia = frecuenciaFilter === "all" || gasto.frecuencia === frecuenciaFilter;

      const fechaGasto = new Date(gasto.fecha_gasto);
      const matchFecha = !limitDate || fechaGasto >= limitDate;

      return matchSearch && matchCategoria && matchFrecuencia && matchFecha;
    });
  }, [gastos, search, categoriaFilter, frecuenciaFilter, dateFilter]);

  const paginatedGastos = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredGastos.slice(start, start + pageSize);
  }, [filteredGastos, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredGastos.length / pageSize));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  const validateForm = (state: FormState): FormErrors => {
    const errors: FormErrors = {};
    if (!state.nombre_gasto.trim() || state.nombre_gasto.trim().length < 3) {
      errors.nombre_gasto = "Ingresa un nombre de al menos 3 caracteres";
    }
    if (!state.detalle.trim() || state.detalle.trim().length < 5) {
      errors.detalle = "Describe brevemente el gasto";
    }
    if (!state.monto || Number(state.monto) <= 0) {
      errors.monto = "Ingresa un monto mayor a 0";
    }
    if (!state.categoria_gasto) {
      errors.categoria_gasto = "Selecciona una categoría";
    }
    if (!state.frecuencia) {
      errors.frecuencia = "Selecciona la frecuencia";
    }
    return errors;
  };

  const resetForm = () => {
    setForm(initialForm);
    setFormErrors({});
  };

  const resetEditForm = () => {
    setEditForm(initialForm);
    setEditFormErrors({});
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = validateForm(form);
    setFormErrors(validation);
    if (Object.keys(validation).length > 0) {
      return;
    }

    const payload = {
      nombre_gasto: form.nombre_gasto.trim(),
      categoria_gasto: form.categoria_gasto,
      detalle: form.detalle.trim(),
      frecuencia: form.frecuencia,
      monto: Number(form.monto),
      estado: form.estado,
    } satisfies CreateGastoDTO;

    try {
      setSaving(true);
      await gastosOperativosService.createGasto(payload);
      await loadData();
      resetForm();
      setDrawerOpen(false);
      message.success('Gasto operativo creado correctamente');
    } catch (err) {
      const message_text = err instanceof Error ? err.message : "No se pudo guardar el gasto";
      setFormErrors({ general: message_text });
      message.error(`Error al crear gasto: ${message_text}`);
    } finally {
      setSaving(false);
    }
  };

  const openDetailModal = (gasto: GastoOperativo) => {
    setSelectedGasto(gasto);
    setDetailOpen(true);
  };

  const openEditDrawer = (gasto: GastoOperativo) => {
    setEditingGasto(gasto);
    setEditForm({
      nombre_gasto: gasto.nombre_gasto,
      categoria_gasto: gasto.categoria_gasto,
      frecuencia: gasto.frecuencia,
      monto: String(gasto.monto),
      detalle: gasto.detalle,
      estado: gasto.estado,
    });
    setEditFormErrors({});
    setEditDrawerOpen(true);
  };

  const restoreEditForm = () => {
    if (!editingGasto) {
      return;
    }
    setEditForm({
      nombre_gasto: editingGasto.nombre_gasto,
      categoria_gasto: editingGasto.categoria_gasto,
      frecuencia: editingGasto.frecuencia,
      monto: String(editingGasto.monto),
      detalle: editingGasto.detalle,
      estado: editingGasto.estado,
    });
    setEditFormErrors({});
  };

  const closeEditDrawer = () => {
    setEditDrawerOpen(false);
    setEditingGasto(null);
    resetEditForm();
  };

  const handleEditSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingGasto) {
      return;
    }
    const validation = validateForm(editForm);
    setEditFormErrors(validation);
    if (Object.keys(validation).length > 0) {
      return;
    }

    const payload = {
      nombre_gasto: editForm.nombre_gasto.trim(),
      categoria_gasto: editForm.categoria_gasto,
      detalle: editForm.detalle.trim(),
      frecuencia: editForm.frecuencia,
      monto: Number(editForm.monto),
      estado: editForm.estado,
    } satisfies UpdateGastoDTO;

    try {
      setUpdating(true);
      await gastosOperativosService.updateGasto(editingGasto.id_gasto, payload);
      await loadData();
      closeEditDrawer();
      message.success('Gasto operativo actualizado correctamente');
    } catch (err) {
      const message_text = err instanceof Error ? err.message : "No se pudo actualizar el gasto";
      setEditFormErrors({ general: message_text });
      message.error(`Error al actualizar gasto: ${message_text}`);
    } finally {
      setUpdating(false);
    }
  };

  const openDeleteModal = (gasto: GastoOperativo) => {
    setDeletingGasto(gasto);
    setDeleteError(null);
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setDeleteModalOpen(false);
    setDeletingGasto(null);
    setDeleting(false);
    setDeleteError(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingGasto) {
      return;
    }
    try {
      setDeleteError(null);
      setDeleting(true);
      await gastosOperativosService.deleteGasto(deletingGasto.id_gasto);
      await loadData();
      closeDeleteModal();
      message.success('Gasto operativo eliminado correctamente');
    } catch (err) {
      const message_text = err instanceof Error ? err.message : "No se pudo eliminar el gasto";
      setDeleting(false);
      setDeleteError(message_text);
      message.error(`Error al eliminar gasto: ${message_text}`);
    }
  };

  const handleExportCSV = () => {
    const header = [
      "Referencia",
      "Nombre",
      "Categoría",
      "Frecuencia",
      "Monto base",
      "Monto mensual",
      "Fecha",
      "Detalle",
    ];

    const rows = filteredGastos.map((gasto) => [
      gasto.numero_gasto,
      gasto.nombre_gasto,
      gasto.categoria_gasto,
      gasto.frecuencia,
      Number(gasto.monto).toFixed(2),
      getMonthlyEquivalent(gasto).toFixed(2),
      formatDate(gasto.fecha_gasto),
      gasto.detalle.replace(/\n/g, " "),
    ]);

    const csv = [header, ...rows]
      .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gastos-operativos-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const rowsHtml = filteredGastos
      .map((gasto, index) => `
        <tr>
          <td style="padding:6px;border:1px solid #e5e7eb">${index + 1}</td>
          <td style="padding:6px;border:1px solid #e5e7eb">${escapeHtml(gasto.numero_gasto)}</td>
          <td style="padding:6px;border:1px solid #e5e7eb">${escapeHtml(gasto.nombre_gasto)}</td>
          <td style="padding:6px;border:1px solid #e5e7eb">${escapeHtml(gasto.categoria_gasto)}</td>
          <td style="padding:6px;border:1px solid #e5e7eb">${gasto.frecuencia === "quincenal" ? "Quincenal" : "Mensual"}</td>
          <td style="padding:6px;border:1px solid #e5e7eb;text-align:right">${formatCurrency(Number(gasto.monto))}</td>
          <td style="padding:6px;border:1px solid #e5e7eb;text-align:right">${formatCurrency(getMonthlyEquivalent(gasto))}</td>
          <td style="padding:6px;border:1px solid #e5e7eb">${escapeHtml(gasto.detalle)}</td>
          <td style="padding:6px;border:1px solid #e5e7eb">${formatDate(gasto.fecha_gasto)}</td>
        </tr>
      `)
      .join("");

    const resumenHtml = `
      <table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:12px">
        <thead>
          <tr>
            <th style="padding:6px;border:1px solid #e5e7eb;text-align:left">Indicador</th>
            <th style="padding:6px;border:1px solid #e5e7eb;text-align:left">Valor</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:6px;border:1px solid #e5e7eb">Total base</td>
            <td style="padding:6px;border:1px solid #e5e7eb">${formatCurrency(stats.totalBase)}</td>
          </tr>
          <tr>
            <td style="padding:6px;border:1px solid #e5e7eb">Total ajustado</td>
            <td style="padding:6px;border:1px solid #e5e7eb">${formatCurrency(stats.totalAjustado)}</td>
          </tr>
          <tr>
            <td style="padding:6px;border:1px solid #e5e7eb">Gastos quincenales</td>
            <td style="padding:6px;border:1px solid #e5e7eb">${stats.countQuincenal} registros (${formatCurrency(stats.totalQuincenal)})</td>
          </tr>
          <tr>
            <td style="padding:6px;border:1px solid #e5e7eb">Gastos mensuales</td>
            <td style="padding:6px;border:1px solid #e5e7eb">${stats.countMensual} registros (${formatCurrency(stats.totalMensual)})</td>
          </tr>
          <tr>
            <td style="padding:6px;border:1px solid #e5e7eb">Promedio mensual</td>
            <td style="padding:6px;border:1px solid #e5e7eb">${formatCurrency(stats.promedioMensual)}</td>
          </tr>
        </tbody>
      </table>
    `;

    const html = `
<div style="font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Arial,sans-serif;margin:16px;color:#111">
  <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:8px">
    <div>
      <h1 style="margin:0 0 8px 0">Gastos Operativos</h1>
      <div style="color:#6b7280;font-size:12px">Generado: ${new Date().toLocaleString()}</div>
      <div style="color:#6b7280;font-size:12px">Filtros activos: categoría ${categoriaFilter === "all" ? "Todas" : categoriaFilter}, frecuencia ${frecuenciaFilter === "all" ? "Todas" : frecuenciaFilter}</div>
    </div>
  </div>
  ${resumenHtml}
  <h3 style="margin:16px 0 8px 0">Detalle de gastos (${filteredGastos.length})</h3>
  <table style="font-size:12px;border-collapse:collapse;width:100%">
    <thead>
      <tr>
        <th style="padding:6px;border:1px solid #e5e7eb;text-align:left">#</th>
        <th style="padding:6px;border:1px solid #e5e7eb;text-align:left">Referencia</th>
        <th style="padding:6px;border:1px solid #e5e7eb;text-align:left">Nombre</th>
        <th style="padding:6px;border:1px solid #e5e7eb;text-align:left">Categoría</th>
        <th style="padding:6px;border:1px solid #e5e7eb;text-align:left">Frecuencia</th>
        <th style="padding:6px;border:1px solid #e5e7eb;text-align:right">Monto base</th>
        <th style="padding:6px;border:1px solid #e5e7eb;text-align:right">Equivalente mensual</th>
        <th style="padding:6px;border:1px solid #e5e7eb;text-align:left">Detalle</th>
        <th style="padding:6px;border:1px solid #e5e7eb;text-align:left">Fecha</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || `<tr><td colspan="9" style="padding:12px;border:1px solid #e5e7eb;text-align:center;color:#6b7280">Sin registros para los filtros actuales.</td></tr>`}
    </tbody>
  </table>
</div>`;

    // Crear elemento temporal
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    document.body.appendChild(tempDiv);

    const opt = {
      margin: 0.5,
      filename: `gastos-operativos-${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(tempDiv).save().then(() => {
      document.body.removeChild(tempDiv);
    });
  };

  const cards = [
    {
      title: "Gasto mensual ajustado",
      value: formatCurrency(stats.totalAjustado),
      helper: "Incluye quincenales x2",
      icon: <Wallet className="h-5 w-5" />,
    },
    {
      title: "Gastos quincenales",
      value: `${stats.countQuincenal} registros`,
      helper: `${formatCurrency(stats.totalQuincenal)} base`,
      icon: <Repeat2 className="h-5 w-5" />,
    },
    {
      title: "Gastos mensuales",
      value: `${stats.countMensual} registros`,
      helper: `${formatCurrency(stats.totalMensual)} base`,
      icon: <CalendarDays className="h-5 w-5" />,
    },
    {
      title: "Promedio mensual",
      value: formatCurrency(stats.promedioMensual),
      helper: "Promedio ajustado por gasto",
      icon: <BarChart3 className="h-5 w-5" />,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="mx-auto w-full max-w-[1400px] px-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate(-1)} 
              className="px-3 py-2 rounded-md border bg-white hover:bg-gray-50"
            >
              ← Regresar
            </button>
            <div>
              <h1 className="text-3xl font-semibold text-gray-900">Gastos operativos</h1>
              <p className="mt-1 text-sm text-gray-600">
                Seguimiento mensual de egresos fijos y quincenales para mantener el control financiero.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50"
            >
              <FileSpreadsheet className="h-4 w-4" /> Exportar CSV
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 rounded-full border border-emerald-500 bg-white px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 hover:shadow-sm"
            >
              <FileText className="h-4 w-4" /> Exportar PDF
            </button>
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" /> Nuevo gasto
            </button>
          </div>
        </header>

        {error && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <Info className="mt-0.5 h-4 w-4" />
            <div>
              <p className="font-medium">No pudimos cargar los gastos.</p>
              <p>{error}</p>
            </div>
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <motion.div
              key={card.title}
              whileHover={{ y: -4 }}
              className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">{card.title}</p>
                  <p className="mt-3 text-2xl font-semibold text-gray-900">{card.value}</p>
                </div>
                <div className="rounded-full bg-emerald-50 p-3 text-emerald-600">
                  {card.icon}
                </div>
              </div>
              <p className="mt-3 text-xs text-gray-500">{card.helper}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-8 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por referencia, nombre o detalle"
                  className="w-full rounded-full border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-700 outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <select
                value={categoriaFilter}
                onChange={(event) => setCategoriaFilter(event.target.value as CategoriaGasto | "all")}
                className="h-10 min-w-[180px] rounded-full border border-gray-200 bg-gray-50 px-4 text-sm text-gray-700 shadow-sm transition focus:border-emerald-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100"
              >
                <option value="all">Todas las categorías</option>
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                value={String(dateFilter)}
                onChange={(event) => {
                  const { value } = event.target;
                  if (value === "all") {
                    setDateFilter("all");
                  } else {
                    setDateFilter(Number(value) as DateFilterValue);
                  }
                }}
                className="h-10 min-w-[160px] rounded-full border border-gray-200 bg-gray-50 px-4 text-sm text-gray-700 shadow-sm transition focus:border-emerald-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100"
              >
                {DATE_FILTERS.map((option) => (
                  <option key={option.value} value={String(option.value)}>
                    {option.helper ? `${option.label} · ${option.helper}` : option.label}
                  </option>
                ))}
              </select>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Frecuencia</span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setFrecuenciaFilter("all")}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${frecuenciaFilter === "all" ? highlightClass : "border border-gray-200 bg-white text-gray-600 hover:border-emerald-200 hover:text-emerald-600"}`}
                  >
                    Todas
                  </button>
                  {FREQUENCY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setFrecuenciaFilter(option.value)}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition ${frecuenciaFilter === option.value ? highlightClass : "border border-gray-200 bg-white text-gray-600 hover:border-emerald-200 hover:text-emerald-600"}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm text-gray-600 transition hover:border-emerald-200 hover:text-emerald-600"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Recargar
            </button>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">Histórico de gastos</p>
              <p className="text-xs text-gray-500">
                Mostrando {paginatedGastos.length} de {filteredGastos.length} registros filtrados
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Download className="h-4 w-4" />
              <span>Equivalente mensual = quincenal × 2</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-left text-sm text-gray-700">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 font-semibold">Referencia</th>
                  <th className="px-6 py-3 font-semibold">Nombre</th>
                  <th className="px-6 py-3 font-semibold">Categoría</th>
                  <th className="px-6 py-3 font-semibold">Frecuencia</th>
                  <th className="px-6 py-3 font-semibold">Monto base</th>
                  <th className="px-6 py-3 font-semibold">Monto mensual</th>
                  <th className="px-6 py-3 font-semibold">Estado</th>
                  <th className="px-6 py-3 font-semibold">Fecha registro</th>
                  <th className="px-6 py-3 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-10 text-center text-sm text-gray-500">
                      Cargando gastos operativos...
                    </td>
                  </tr>
                ) : paginatedGastos.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-10 text-center text-sm text-gray-500">
                      {gastos.length === 0
                        ? "Aún no registras gastos operativos. Ingresa el primero para comenzar a medir tus egresos."
                        : "No encontramos registros que coincidan con los filtros seleccionados."}
                    </td>
                  </tr>
                ) : (
                  paginatedGastos.map((gasto) => (
                    <tr key={gasto.id_gasto} className="hover:bg-gray-50/80">
                      <td className="px-6 py-4 font-medium text-gray-900">{gasto.numero_gasto}</td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{gasto.nombre_gasto}</p>
                        <p className="text-xs text-gray-500 line-clamp-1">{gasto.detalle}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                          {gasto.categoria_gasto}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            gasto.frecuencia === "quincenal"
                              ? "bg-sky-50 text-sky-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {gasto.frecuencia === "quincenal" ? "Quincenal" : "Mensual"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-900">{formatCurrency(Number(gasto.monto))}</td>
                      <td className="px-6 py-4 font-semibold text-emerald-700">
                        {formatCurrency(getMonthlyEquivalent(gasto))}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            gasto.estado === "activo"
                              ? "bg-green-50 text-green-700"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          {gasto.estado === "activo" ? "Activo" : "Desactivado"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{formatDate(gasto.fecha_gasto)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openDetailModal(gasto)}
                            className="rounded-full border border-gray-200 p-2 text-gray-500 transition hover:border-emerald-200 hover:text-emerald-600"
                            aria-label="Ver detalle"
                            title="Ver detalle"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditDrawer(gasto)}
                            className="rounded-full border border-gray-200 p-2 text-gray-500 transition hover:border-emerald-200 hover:text-emerald-600"
                            aria-label="Editar"
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openDeleteModal(gasto)}
                            className="rounded-full border border-gray-200 p-2 text-gray-500 transition hover:border-emerald-200 hover:text-emerald-600"
                            aria-label="Eliminar"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50 px-6 py-3 text-sm text-gray-600 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-4">
              <span>
                Página {Math.min(page, totalPages)} de {totalPages}
              </span>
              <span className="text-xs text-gray-500">
                {filteredGastos.length} registros filtrados · {gastos.length} totales
              </span>
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
              <label className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Registros por página</span>
                <select
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value))}
                  className="h-9 rounded-full border border-gray-200 bg-white px-3 text-sm text-gray-700 shadow-sm transition focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page === 1}
                  className="rounded-full border border-gray-200 px-4 py-1.5 transition hover:border-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={page === totalPages}
                  className="rounded-full border border-gray-200 px-4 py-1.5 transition hover:border-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {detailOpen && selectedGasto && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 md:items-center"
            >
              <motion.div
                initial={{ y: 24, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 24, opacity: 0 }}
                className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-500">Referencia</p>
                    <h2 className="mt-1 text-2xl font-semibold text-gray-900">{selectedGasto.numero_gasto}</h2>
                  </div>
                  <button
                    onClick={() => {
                      setDetailOpen(false);
                      setSelectedGasto(null);
                    }}
                    className="rounded-full bg-gray-100 p-1 text-gray-500 transition hover:bg-gray-200 hover:text-gray-700"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl bg-gray-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Nombre</p>
                    <p className="mt-2 text-sm font-medium text-gray-900">{selectedGasto.nombre_gasto}</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Categoría</p>
                    <p className="mt-2 text-sm font-medium text-gray-900">{selectedGasto.categoria_gasto}</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Frecuencia</p>
                    <p className="mt-2 text-sm font-medium text-gray-900">
                      {selectedGasto.frecuencia === "quincenal" ? "Quincenal" : "Mensual"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Fecha de registro</p>
                    <p className="mt-2 text-sm font-medium text-gray-900">{formatDate(selectedGasto.fecha_gasto)}</p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Monto base</p>
                    <p className="mt-2 text-lg font-semibold text-emerald-800">{formatCurrency(Number(selectedGasto.monto))}</p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Equivalente mensual</p>
                    <p className="mt-2 text-lg font-semibold text-emerald-800">{formatCurrency(getMonthlyEquivalent(selectedGasto))}</p>
                  </div>
                </div>

                <div className="mt-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Detalle</p>
                  <div className="mt-2 rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm leading-relaxed text-gray-700">
                    {selectedGasto.detalle}
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => {
                      setDetailOpen(false);
                      setSelectedGasto(null);
                    }}
                    className="rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-emerald-200 hover:text-emerald-600"
                  >
                    Cerrar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {editDrawerOpen && editingGasto && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex"
            >
              <div
                className="flex-1 bg-black/40"
                onClick={closeEditDrawer}
              />
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "tween", duration: 0.25 }}
                className="relative w-full max-w-xl overflow-y-auto bg-white shadow-xl"
              >
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-6 py-5">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Editar gasto operativo</p>
                    <p className="text-xs text-gray-500">Referencia {editingGasto.numero_gasto}</p>
                  </div>
                  <button
                    onClick={closeEditDrawer}
                    className="rounded-full bg-gray-100 p-1 text-gray-500 transition hover:bg-gray-200 hover:text-gray-700"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {editFormErrors.general && (
                  <div className="mx-6 mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    <Info className="mt-0.5 h-4 w-4" />
                    <div>
                      <p className="font-medium">No se pudieron guardar los cambios.</p>
                      <p>{editFormErrors.general}</p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleEditSubmit} className="space-y-5 px-6 py-6">
                  <div className="grid gap-4">
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-gray-700">Nombre del gasto *</span>
                      <input
                        value={editForm.nombre_gasto}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, nombre_gasto: event.target.value }))}
                        placeholder="Ej. Renta de local"
                        className={`w-full rounded-xl border px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-emerald-100 ${
                          editFormErrors.nombre_gasto ? "border-red-300" : "border-gray-200"
                        }`}
                      />
                      {editFormErrors.nombre_gasto && (
                        <span className="block text-xs text-red-500">{editFormErrors.nombre_gasto}</span>
                      )}
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-gray-700">Categoría *</span>
                      <select
                        value={editForm.categoria_gasto}
                        onChange={(event) =>
                          setEditForm((prev) => ({ ...prev, categoria_gasto: event.target.value as CategoriaGasto }))
                        }
                        className={`w-full rounded-xl border px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-emerald-100 ${
                          editFormErrors.categoria_gasto ? "border-red-300" : "border-gray-200"
                        }`}
                      >
                        {CATEGORY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      {editFormErrors.categoria_gasto && (
                        <span className="block text-xs text-red-500">{editFormErrors.categoria_gasto}</span>
                      )}
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-gray-700">Frecuencia *</span>
                      <div className="flex gap-2">
                        {FREQUENCY_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setEditForm((prev) => ({ ...prev, frecuencia: option.value }))}
                            className={`flex-1 rounded-xl border px-4 py-2 text-sm font-medium transition ${
                              editForm.frecuencia === option.value
                                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                : "border-gray-200 text-gray-600 hover:border-emerald-200 hover:text-emerald-600"
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      {editFormErrors.frecuencia && (
                        <span className="block text-xs text-red-500">{editFormErrors.frecuencia}</span>
                      )}
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-gray-700">Monto (Q) *</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editForm.monto}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, monto: event.target.value }))}
                        placeholder="0.00"
                        className={`w-full rounded-xl border px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-emerald-100 ${
                          editFormErrors.monto ? "border-red-300" : "border-gray-200"
                        }`}
                      />
                      {editFormErrors.monto && (
                        <span className="block text-xs text-red-500">{editFormErrors.monto}</span>
                      )}
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-gray-700">Detalle *</span>
                      <textarea
                        rows={4}
                        value={editForm.detalle}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, detalle: event.target.value }))}
                        placeholder="Describe brevemente el gasto y su propósito"
                        className={`w-full rounded-xl border px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-emerald-100 ${
                          editFormErrors.detalle ? "border-red-300" : "border-gray-200"
                        }`}
                      />
                      {editFormErrors.detalle && (
                        <span className="block text-xs text-red-500">{editFormErrors.detalle}</span>
                      )}
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-gray-700">Estado *</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEditForm((prev) => ({ ...prev, estado: 'activo' }))}
                          className={`flex-1 rounded-xl border px-4 py-2 text-sm font-medium transition ${
                            editForm.estado === 'activo'
                              ? "border-green-500 bg-green-50 text-green-700"
                              : "border-gray-200 text-gray-600 hover:border-green-200 hover:text-green-600"
                          }`}
                        >
                          Activo
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditForm((prev) => ({ ...prev, estado: 'desactivado' }))}
                          className={`flex-1 rounded-xl border px-4 py-2 text-sm font-medium transition ${
                            editForm.estado === 'desactivado'
                              ? "border-red-500 bg-red-50 text-red-700"
                              : "border-gray-200 text-gray-600 hover:border-red-200 hover:text-red-600"
                          }`}
                        >
                          Desactivado
                        </button>
                      </div>
                      <p className="text-xs text-gray-500">
                        Los gastos desactivados no se incluyen en los cálculos financieros
                      </p>
                    </label>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={restoreEditForm}
                      className="flex-1 rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-emerald-200 hover:text-emerald-600"
                      disabled={updating}
                    >
                      Restablecer
                    </button>
                    <button
                      type="submit"
                      className="flex-1 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                      disabled={updating}
                    >
                      {updating ? "Guardando..." : "Guardar cambios"}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {drawerOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex"
            >
              <div
                className="flex-1 bg-black/40"
                onClick={() => {
                  setDrawerOpen(false);
                  resetForm();
                }}
              />
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "tween", duration: 0.25 }}
                className="relative w-full max-w-xl overflow-y-auto bg-white shadow-xl"
              >
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-6 py-5">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Registrar gasto operativo</p>
                    <p className="text-xs text-gray-500">La referencia y la fecha se generan automáticamente.</p>
                  </div>
                  <button
                    onClick={() => {
                      setDrawerOpen(false);
                      resetForm();
                    }}
                    className="rounded-full bg-gray-100 p-1 text-gray-500 transition hover:bg-gray-200 hover:text-gray-700"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {formErrors.general && (
                  <div className="mx-6 mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    <Info className="mt-0.5 h-4 w-4" />
                    <div>
                      <p className="font-medium">No se pudo guardar el gasto.</p>
                      <p>{formErrors.general}</p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
                  <div className="grid gap-4">
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-gray-700">Nombre del gasto *</span>
                      <input
                        value={form.nombre_gasto}
                        onChange={(event) => setForm((prev) => ({ ...prev, nombre_gasto: event.target.value }))}
                        placeholder="Ej. Renta de local"
                        className={`w-full rounded-xl border px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-emerald-100 ${
                          formErrors.nombre_gasto ? "border-red-300" : "border-gray-200"
                        }`}
                      />
                      {formErrors.nombre_gasto && <span className="block text-xs text-red-500">{formErrors.nombre_gasto}</span>}
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-gray-700">Categoría *</span>
                      <select
                        value={form.categoria_gasto}
                        onChange={(event) => setForm((prev) => ({ ...prev, categoria_gasto: event.target.value as CategoriaGasto }))}
                        className={`w-full rounded-xl border px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-emerald-100 ${
                          formErrors.categoria_gasto ? "border-red-300" : "border-gray-200"
                        }`}
                      >
                        {CATEGORY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      {formErrors.categoria_gasto && <span className="block text-xs text-red-500">{formErrors.categoria_gasto}</span>}
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-gray-700">Frecuencia *</span>
                      <div className="flex gap-2">
                        {FREQUENCY_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setForm((prev) => ({ ...prev, frecuencia: option.value }))}
                            className={`flex-1 rounded-xl border px-4 py-2 text-sm font-medium transition ${
                              form.frecuencia === option.value
                                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                : "border-gray-200 text-gray-600 hover:border-emerald-200 hover:text-emerald-600"
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      {formErrors.frecuencia && <span className="block text-xs text-red-500">{formErrors.frecuencia}</span>}
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-gray-700">Monto (Q) *</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.monto}
                        onChange={(event) => setForm((prev) => ({ ...prev, monto: event.target.value }))}
                        placeholder="0.00"
                        className={`w-full rounded-xl border px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-emerald-100 ${
                          formErrors.monto ? "border-red-300" : "border-gray-200"
                        }`}
                      />
                      {formErrors.monto && <span className="block text-xs text-red-500">{formErrors.monto}</span>}
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-gray-700">Detalle *</span>
                      <textarea
                        rows={4}
                        value={form.detalle}
                        onChange={(event) => setForm((prev) => ({ ...prev, detalle: event.target.value }))}
                        placeholder="Describe brevemente el gasto y su propósito"
                        className={`w-full rounded-xl border px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-emerald-100 ${
                          formErrors.detalle ? "border-red-300" : "border-gray-200"
                        }`}
                      />
                      {formErrors.detalle && <span className="block text-xs text-red-500">{formErrors.detalle}</span>}
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-gray-700">Estado *</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, estado: 'activo' }))}
                          className={`flex-1 rounded-xl border px-4 py-2 text-sm font-medium transition ${
                            form.estado === 'activo'
                              ? "border-green-500 bg-green-50 text-green-700"
                              : "border-gray-200 text-gray-600 hover:border-green-200 hover:text-green-600"
                          }`}
                        >
                          Activo
                        </button>
                        <button
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, estado: 'desactivado' }))}
                          className={`flex-1 rounded-xl border px-4 py-2 text-sm font-medium transition ${
                            form.estado === 'desactivado'
                              ? "border-red-500 bg-red-50 text-red-700"
                              : "border-gray-200 text-gray-600 hover:border-red-200 hover:text-red-600"
                          }`}
                        >
                          Desactivado
                        </button>
                      </div>
                      <p className="text-xs text-gray-500">
                        Los gastos desactivados no se incluyen en los cálculos financieros
                      </p>
                    </label>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="flex-1 rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-emerald-200 hover:text-emerald-600"
                      disabled={saving}
                    >
                      Limpiar
                    </button>
                    <button
                      type="submit"
                      className="flex-1 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                      disabled={saving}
                    >
                      {saving ? "Guardando..." : "Guardar gasto"}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {deleteModalOpen && deletingGasto && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 md:items-center"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-red-100 p-2 text-red-600">
                    <Trash2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Eliminar gasto operativo</h2>
                    <p className="mt-1 text-sm text-gray-600">
                      Esta acción eliminará definitivamente el registro {deletingGasto.numero_gasto}.
                    </p>
                    <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
                      <p className="font-medium text-gray-900">{deletingGasto.nombre_gasto}</p>
                      <p className="mt-1 text-xs text-gray-500">{deletingGasto.categoria_gasto} · {formatCurrency(Number(deletingGasto.monto))}</p>
                    </div>
                    {deleteError && (
                      <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        {deleteError}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeDeleteModal}
                    className="rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-emerald-200 hover:text-emerald-600"
                    disabled={deleting}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteConfirm}
                    className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                    disabled={deleting}
                  >
                    {deleting ? "Eliminando..." : "Eliminar"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
