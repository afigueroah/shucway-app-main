import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { message } from "antd";
import {
  BarChart3,
  CalendarDays,
  Eye,
  FileSpreadsheet,
  Info,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
  X,
  Star,
} from "lucide-react";
import { clientesService, type Cliente } from "../../../api/clientesService";

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const formatDate = (date: Date | string | null | undefined) => {
  if (!date) return '—';
  const d = new Date(date);
  return d.toLocaleDateString("es-GT", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export default function Clientes() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [form, setForm] = useState({
    nombre: "",
    telefono: "",
    direccion: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [editForm, setEditForm] = useState({
    nombre: "",
    telefono: "",
    direccion: "",
  });
  const [editFormErrors, setEditFormErrors] = useState<Record<string, string>>({});
  const [updating, setUpdating] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingCliente, setDeletingCliente] = useState<Cliente | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [puntosModalOpen, setPuntosModalOpen] = useState(false);
  const [clientePuntos, setClientePuntos] = useState<Cliente | null>(null);
  const [puntosActuales, setPuntosActuales] = useState(0);
  const [puntosOperacion, setPuntosOperacion] = useState<'agregar' | 'restar'>('agregar');
  const [cantidadPuntos, setCantidadPuntos] = useState(0);
  const [motivoPuntos, setMotivoPuntos] = useState('');
  const [procesandoPuntos, setProcesandoPuntos] = useState(false);

  useEffect(() => {
    loadData(true);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  const loadData = async (showSpinner = false) => {
    if (showSpinner) {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await clientesService.getClientes();
      setClientes(data);
    } catch (err) {
      console.error('Error cargando clientes:', err);
      setError('Error al cargar los clientes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const stats = useMemo(() => {
    const totalClientes = clientes.length;
    const clientesConTelefono = clientes.filter(c => c.telefono).length;
    const totalPuntos = clientes.reduce((sum, c) => sum + c.puntos_acumulados, 0);
    const promedioPuntos = totalClientes > 0 ? totalPuntos / totalClientes : 0;

    return {
      totalClientes,
      clientesConTelefono,
      totalPuntos,
      promedioPuntos,
    };
  }, [clientes]);

  const filteredClientes = useMemo(() => {
    const searchQuery = search.trim().toLowerCase();
    return clientes.filter((cliente) => {
      if (!searchQuery) return true;
      return (
        cliente.nombre.toLowerCase().includes(searchQuery) ||
        (cliente.telefono && cliente.telefono.includes(searchQuery)) ||
        (cliente.direccion && cliente.direccion.toLowerCase().includes(searchQuery))
      );
    });
  }, [clientes, search]);

  const paginatedClientes = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredClientes.slice(start, start + pageSize);
  }, [filteredClientes, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredClientes.length / pageSize));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  const validateForm = async (data: typeof form, isEdit = false, currentClienteId?: number): Promise<Record<string, string>> => {
    const errors: Record<string, string> = {};

    if (!data.nombre.trim() || data.nombre.trim().length < 2) {
      errors.nombre = "El nombre es requerido y debe tener al menos 2 caracteres";
    }

    if (data.telefono && !/^\d{8,15}$/.test(data.telefono.replace(/\s+/g, ''))) {
      errors.telefono = "El teléfono debe contener solo números (8-15 dígitos)";
    }

    // Validar unicidad del teléfono si se proporciona
    if (data.telefono && data.telefono.trim()) {
      try {
        const telefonoLimpio = data.telefono.trim().replace(/\s+/g, '');
        const clienteExistente = await clientesService.buscarPorTelefono(telefonoLimpio);

        if (clienteExistente) {
          // Si estamos editando, permitir el mismo teléfono para el mismo cliente
          if (!isEdit || clienteExistente.id_cliente !== currentClienteId) {
            errors.telefono = "Este número de teléfono ya está registrado";
          }
        }
      } catch (error) {
        console.error('Error validando teléfono:', error);
        // No bloquear la validación por error de red, pero loguear
      }
    }

    return errors;
  };

  const resetForm = () => {
    setForm({
      nombre: "",
      telefono: "",
      direccion: "",
    });
    setFormErrors({});
  };

  const resetEditForm = () => {
    setEditForm({
      nombre: "",
      telefono: "",
      direccion: "",
    });
    setEditFormErrors({});
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = await validateForm(form);
    setFormErrors(validation);
    if (Object.keys(validation).length > 0) {
      return;
    }

    setSaving(true);
    try {
      await clientesService.createCliente({
        nombre: form.nombre.trim(),
        telefono: form.telefono.trim() || undefined,
        direccion: form.direccion.trim() || undefined,
      });

      message.success('Cliente creado exitosamente');
      setDrawerOpen(false);
      resetForm();
      await loadData();
    } catch (err) {
      console.error('Error creando cliente:', err);
      message.error('Error al crear el cliente');
    } finally {
      setSaving(false);
    }
  };

  const openDetailModal = (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setDetailOpen(true);
  };

  const openEditDrawer = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setEditForm({
      nombre: cliente.nombre,
      telefono: cliente.telefono || "",
      direccion: cliente.direccion || "",
    });
    setEditFormErrors({});
    setEditDrawerOpen(true);
  };

  const restoreEditForm = () => {
    if (!editingCliente) {
      return;
    }
    setEditForm({
      nombre: editingCliente.nombre,
      telefono: editingCliente.telefono || "",
      direccion: editingCliente.direccion || "",
    });
    setEditFormErrors({});
  };

  const closeEditDrawer = () => {
    setEditDrawerOpen(false);
    setEditingCliente(null);
    resetEditForm();
  };

  const handleEditSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingCliente) {
      return;
    }
    const validation = await validateForm(editForm, true, editingCliente.id_cliente);
    setEditFormErrors(validation);
    if (Object.keys(validation).length > 0) {
      return;
    }

    setUpdating(true);
    try {
      await clientesService.updateCliente(editingCliente.id_cliente, {
        nombre: editForm.nombre.trim(),
        telefono: editForm.telefono.trim() || undefined,
        direccion: editForm.direccion.trim() || undefined,
      });

      message.success('Cliente actualizado exitosamente');
      setEditDrawerOpen(false);
      setEditingCliente(null);
      resetEditForm();
      await loadData();
    } catch (err) {
      console.error('Error actualizando cliente:', err);
      message.error('Error al actualizar el cliente');
    } finally {
      setUpdating(false);
    }
  };

  const openDeleteModal = (cliente: Cliente) => {
    setDeletingCliente(cliente);
    setDeleteError(null);
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setDeleteModalOpen(false);
    setDeletingCliente(null);
    setDeleting(false);
    setDeleteError(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingCliente) {
      return;
    }
    setDeleting(true);
    try {
      await clientesService.deleteCliente(deletingCliente.id_cliente);
      message.success('Cliente eliminado exitosamente');
      closeDeleteModal();
      await loadData();
    } catch (err) {
      console.error('Error eliminando cliente:', err);
      setDeleteError('Error al eliminar el cliente. Puede que tenga ventas asociadas.');
    } finally {
      setDeleting(false);
    }
  };

  const openPuntosModal = async (cliente: Cliente) => {
    setClientePuntos(cliente);
    setPuntosActuales(cliente.puntos_acumulados);
    setPuntosOperacion('agregar');
    setCantidadPuntos(0);
    setMotivoPuntos('');
    setPuntosModalOpen(true);
  };

  const closePuntosModal = () => {
    setPuntosModalOpen(false);
    setClientePuntos(null);
    setProcesandoPuntos(false);
  };

  const handlePuntosSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientePuntos || cantidadPuntos <= 0) return;

    setProcesandoPuntos(true);
    try {
      // Llamar a la API para gestionar puntos
      const response = await fetch(`/api/clientes/${clientePuntos.id_cliente}/puntos/gestionar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          operacion: puntosOperacion,
          cantidad: cantidadPuntos,
          motivo: motivoPuntos || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Error al gestionar puntos');
      }

      message.success(`${puntosOperacion === 'agregar' ? 'Agregados' : 'Restados'} ${cantidadPuntos} puntos exitosamente`);
      closePuntosModal();
      await loadData();
    } catch (err) {
      console.error('Error procesando puntos:', err);
      message.error('Error al procesar la operación de puntos');
    } finally {
      setProcesandoPuntos(false);
    }
  };

  const handleExportCSV = () => {
    const header = [
      "ID",
      "Nombre",
      "Teléfono",
      "Dirección",
      "Puntos Acumulados",
      "Fecha Registro",
      "Última Compra",
    ];

    const rows = filteredClientes.map((cliente) => [
      cliente.id_cliente.toString(),
      cliente.nombre,
      cliente.telefono || '',
      cliente.direccion || '',
      cliente.puntos_acumulados.toString(),
      formatDate(cliente.fecha_registro),
      formatDate(cliente.ultima_compra),
    ]);

    const csv = [header, ...rows]
      .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `clientes-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const cards = [
    {
      title: "Total Clientes",
      value: stats.totalClientes.toString(),
      helper: "Clientes registrados",
      icon: <Users className="h-5 w-5" />,
    },
    {
      title: "Con Teléfono",
      value: `${stats.clientesConTelefono} / ${stats.totalClientes}`,
      helper: `${Math.round((stats.clientesConTelefono / stats.totalClientes) * 100) || 0}% tienen teléfono`,
      icon: <BarChart3 className="h-5 w-5" />,
    },
    {
      title: "Total Puntos",
      value: stats.totalPuntos.toString(),
      helper: "Puntos acumulados por todos",
      icon: <Info className="h-5 w-5" />,
    },
    {
      title: "Promedio Puntos",
      value: Math.round(stats.promedioPuntos).toString(),
      helper: "Puntos por cliente",
      icon: <CalendarDays className="h-5 w-5" />,
    },
  ];

  return (
    <div className="p-8 bg-[#f8fafc] min-h-screen">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex items-center justify-between mb-6"
      >
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-gray-700 border border-gray-200 font-medium shadow-sm hover:bg-gray-50 transition-all"
          >
            <span>←</span>
            <span>Regresar</span>
          </button>
          <h1 className="text-2xl font-bold text-gray-800">GESTIÓN DE CLIENTES</h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-gray-700 border border-gray-200 font-medium shadow-sm hover:bg-gray-50 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>

          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium shadow-sm hover:bg-emerald-700 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Nuevo Cliente</span>
          </button>
        </div>
      </motion.div>

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800"
        >
          <strong>Error:</strong> {error}
        </motion.div>
      )}

      {/* Cards de estadísticas */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6"
      >
        {cards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: index * 0.02 }}
            className="bg-white p-6 rounded-xl shadow-sm border border-gray-100"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{card.title}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
                <p className="text-xs text-gray-500 mt-1">{card.helper}</p>
              </div>
              <div className="text-emerald-600">{card.icon}</div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Contenido principal */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.04 }}
        className="bg-white rounded-xl shadow-sm border border-gray-100"
      >
        {/* Header de tabla */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Lista de Clientes</h2>

            <div className="flex items-center gap-3">
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all text-sm"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>Exportar CSV</span>
              </button>
            </div>
          </div>

          {/* Barra de búsqueda y filtros */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, teléfono o dirección..."
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
              />
            </div>

            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size} por página
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-4"></div>
                <p className="text-gray-500">Cargando clientes...</p>
              </div>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nombre
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Teléfono
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dirección
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Puntos
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Registro
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Última Compra
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedClientes.map((cliente) => (
                  <tr key={cliente.id_cliente} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      #{cliente.id_cliente}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {cliente.nombre}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {cliente.telefono || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {cliente.direccion || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {cliente.puntos_acumulados} pts
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(cliente.fecha_registro)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(cliente.ultima_compra)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openDetailModal(cliente)}
                          className="text-emerald-600 hover:text-emerald-900 p-1"
                          title="Ver detalles"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openPuntosModal(cliente)}
                          className="text-purple-600 hover:text-purple-900 p-1"
                          title="Gestionar puntos"
                        >
                          <Star className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openEditDrawer(cliente)}
                          className="text-blue-600 hover:text-blue-900 p-1"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(cliente)}
                          className="text-red-600 hover:text-red-900 p-1"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {paginatedClientes.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      {search ? 'No se encontraron clientes con los criterios de búsqueda.' : 'No hay clientes registrados.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Paginación */}
        {!loading && filteredClientes.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Mostrando {paginatedClientes.length > 0 ? ((page - 1) * pageSize) + 1 : 0} - {Math.min(page * pageSize, filteredClientes.length)} de {filteredClientes.length} cliente(s)
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <span className="text-sm text-gray-600">
                Página {page} de {totalPages}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Modal de detalles */}
      <AnimatePresence>
        {detailOpen && selectedCliente && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Detalles del Cliente</h3>
                  <button
                    onClick={() => setDetailOpen(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">ID</label>
                    <p className="text-sm text-gray-900">#{selectedCliente.id_cliente}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Nombre</label>
                    <p className="text-sm text-gray-900">{selectedCliente.nombre}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Teléfono</label>
                    <p className="text-sm text-gray-900">{selectedCliente.telefono || 'No especificado'}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Dirección</label>
                    <p className="text-sm text-gray-900">{selectedCliente.direccion || 'No especificada'}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Puntos Acumulados</label>
                    <p className="text-sm text-gray-900">{selectedCliente.puntos_acumulados} puntos</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Fecha de Registro</label>
                    <p className="text-sm text-gray-900">{formatDate(selectedCliente.fecha_registro)}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Última Compra</label>
                    <p className="text-sm text-gray-900">{formatDate(selectedCliente.ultima_compra)}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drawer de creación */}
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
                  <p className="text-sm font-semibold text-gray-900">Registrar cliente</p>
                  <p className="text-xs text-gray-500">La fecha de registro se genera automáticamente.</p>
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
                    <p className="font-medium">No se pudo guardar el cliente.</p>
                    <p>{formErrors.general}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
                <div className="grid gap-4">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-gray-700">Nombre del cliente *</span>
                    <input
                      value={form.nombre}
                      onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                      placeholder="Ej. Juan Pérez"
                      className={`w-full rounded-xl border px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-emerald-100 ${
                        formErrors.nombre ? "border-red-300" : "border-gray-200"
                      }`}
                    />
                    {formErrors.nombre && <span className="block text-xs text-red-500">{formErrors.nombre}</span>}
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-gray-700">Teléfono</span>
                    <input
                      type="tel"
                      value={form.telefono}
                      onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                      placeholder="Ej. +502 1234 5678"
                      className={`w-full rounded-xl border px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-emerald-100 ${
                        formErrors.telefono ? "border-red-300" : "border-gray-200"
                      }`}
                    />
                    {formErrors.telefono && <span className="block text-xs text-red-500">{formErrors.telefono}</span>}
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-gray-700">Dirección</span>
                    <textarea
                      rows={3}
                      value={form.direccion}
                      onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                      placeholder="Número de NIT o CF"
                      className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-emerald-100"
                    />
                  </label>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setDrawerOpen(false);
                      resetForm();
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition disabled:opacity-50"
                  >
                    {saving ? 'Creando...' : 'Crear Cliente'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drawer de edición */}
      <AnimatePresence>
        {editDrawerOpen && editingCliente && (
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
                  <p className="text-sm font-semibold text-gray-900">Editar cliente</p>
                  <p className="text-xs text-gray-500">ID {editingCliente.id_cliente}</p>
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
                    <span className="text-sm font-medium text-gray-700">Nombre del cliente *</span>
                    <input
                      value={editForm.nombre}
                      onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                      placeholder="Ej. Juan Pérez"
                      className={`w-full rounded-xl border px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-emerald-100 ${
                        editFormErrors.nombre ? "border-red-300" : "border-gray-200"
                      }`}
                    />
                    {editFormErrors.nombre && (
                      <span className="block text-xs text-red-500">{editFormErrors.nombre}</span>
                    )}
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-gray-700">Teléfono</span>
                    <input
                      type="tel"
                      value={editForm.telefono}
                      onChange={(e) => setEditForm({ ...editForm, telefono: e.target.value })}
                      placeholder="Ej. +502 1234 5678"
                      className={`w-full rounded-xl border px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-emerald-100 ${
                        editFormErrors.telefono ? "border-red-300" : "border-gray-200"
                      }`}
                    />
                    {editFormErrors.telefono && (
                      <span className="block text-xs text-red-500">{editFormErrors.telefono}</span>
                    )}
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-gray-700">Dirección</span>
                    <textarea
                      rows={3}
                      value={editForm.direccion}
                      onChange={(e) => setEditForm({ ...editForm, direccion: e.target.value })}
                      placeholder="Número de NIT o CF"
                      className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-emerald-100"
                    />
                  </label>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={restoreEditForm}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
                  >
                    Restaurar
                  </button>
                  <button
                    type="button"
                    onClick={closeEditDrawer}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={updating}
                    className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition disabled:opacity-50"
                  >
                    {updating ? 'Actualizando...' : 'Actualizar Cliente'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de eliminación */}
      <AnimatePresence>
        {deleteModalOpen && deletingCliente && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-md w-full"
            >
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <Trash2 className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">Eliminar Cliente</h3>
                    <p className="text-sm text-gray-600">
                      ¿Estás seguro de que deseas eliminar a <strong>{deletingCliente.nombre}</strong>?
                    </p>
                  </div>
                </div>

                {deleteError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                    {deleteError}
                  </div>
                )}

                <p className="text-sm text-gray-500 mb-6">
                  Esta acción no se puede deshacer. El cliente será eliminado permanentemente del sistema.
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={closeDeleteModal}
                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDeleteConfirm}
                    disabled={deleting}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all disabled:opacity-50"
                  >
                    {deleting ? 'Eliminando...' : 'Eliminar'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de gestión de puntos */}
      <AnimatePresence>
        {puntosModalOpen && clientePuntos && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-md w-full"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Gestionar Puntos</h3>
                  <button
                    onClick={closePuntosModal}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mb-4">
                  <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <Star className="h-5 w-5 text-purple-600" />
                    <div>
                      <p className="font-medium text-gray-800">{clientePuntos.nombre}</p>
                      <p className="text-sm text-gray-600">Puntos actuales: <span className="font-semibold text-purple-600">{puntosActuales}</span></p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handlePuntosSubmit}>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Operación
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setPuntosOperacion('agregar')}
                          className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                            puntosOperacion === 'agregar'
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          ➕ Agregar
                        </button>
                        <button
                          type="button"
                          onClick={() => setPuntosOperacion('restar')}
                          className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                            puntosOperacion === 'restar'
                              ? 'bg-red-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          ➖ Restar
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Cantidad de puntos
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={cantidadPuntos}
                        onChange={(e) => setCantidadPuntos(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                        placeholder="Ingrese la cantidad"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Motivo (opcional)
                      </label>
                      <textarea
                        value={motivoPuntos}
                        onChange={(e) => setMotivoPuntos(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
                        rows={3}
                        placeholder="Describa el motivo de la operación..."
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      type="button"
                      onClick={closePuntosModal}
                      className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={procesandoPuntos || cantidadPuntos <= 0}
                      className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {procesandoPuntos ? 'Procesando...' : `${puntosOperacion === 'agregar' ? 'Agregar' : 'Restar'} Puntos`}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}