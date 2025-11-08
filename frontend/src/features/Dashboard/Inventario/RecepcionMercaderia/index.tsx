import { useEffect, useState, useMemo } from "react";
import { PiPackageBold, PiEyeBold, PiTrashBold, PiPencilBold } from "react-icons/pi";
import { useNavigate } from 'react-router-dom';
import { api } from "../../../../api/apiClient";
import { message } from "antd";
import { useAuth } from "../../../../hooks/useAuth";
import { PermissionLevel } from "../../../../constants/permissions";

/* =============== Tipos =============== */
type RecepcionMercaderia = {
  id_recepcion: number;
  id_orden: number;
  fecha_recepcion: string;
  numero_factura?: string;
  numero_orden?: string; // Agregado para compatibilidad directa
  perfil_usuario?: {
    primer_nombre: string;
    primer_apellido: string;
  };
  orden_compra?: {
    numero_orden: string;
    proveedor?: {
      nombre: string;
      nombre_empresa?: string;
    };
  };
  detalle_recepcion_mercaderia?: Array<{
    id_detalle: number;
    id_recepcion?: number;
    id_detalle_orden?: number;
    cantidad_recibida?: number;
    cantidad_aceptada?: number;
    id_lote?: number;
    id_presentacion?: number;
    insumo_presentacion?: {
      id_insumo: number;
      insumo?: {
        nombre_insumo: string;
      };
    };
  }>;
  _count?: {
    detalle_recepcion_mercaderia: number;
  };
};

/* =============== Componente Principal =============== */
export default function RecepcionMercaderia() {
  const [recepciones, setRecepciones] = useState<RecepcionMercaderia[]>([]);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { roleLevel } = useAuth();
  const canManageRecepciones = (roleLevel ?? 0) >= PermissionLevel.ADMINISTRADOR;

  // Estados de filtrado
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  
  // Estados para modales
  const [viewModal, setViewModal] = useState(false);
  const [selectedRecepcion, setSelectedRecepcion] = useState<RecepcionMercaderia | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; recepcion: RecepcionMercaderia | null }>({ open: false, recepcion: null });
  const [editModal, setEditModal] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [savingInvoice, setSavingInvoice] = useState(false);

  useEffect(() => {
    loadRecepciones();
  }, []);

  const loadRecepciones = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get("/inventario/recepciones-mercaderia");
      setRecepciones(response.data?.data || []);
    } catch (err: unknown) {
      console.error("Error loading recepciones:", err);
      const errorMessage = err instanceof Error ? err.message : "Error desconocido";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Filtrado y paginación
  const filteredRecepciones = useMemo(() => {
    const recepcionesArray = Array.isArray(recepciones) ? recepciones : [];
    if (!searchTerm) return recepcionesArray;
    return recepcionesArray.filter((r) =>
      r.numero_factura?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.numero_orden || r.orden_compra?.numero_orden)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.orden_compra?.proveedor?.nombre?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [recepciones, searchTerm]);

  const paginatedRecepciones = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredRecepciones.slice(startIndex, startIndex + pageSize);
  }, [filteredRecepciones, currentPage]);

  const totalPages = Math.ceil((Array.isArray(filteredRecepciones) ? filteredRecepciones.length : 0) / pageSize);

  const handleDelete = async (id: number) => {
    if (!canManageRecepciones) {
      message.warning('No tienes permisos para modificar recepciones.');
      return;
    }
    try {
      await api.delete(`/inventario/recepciones-mercaderia/${id}`);
      message.success('Recepción eliminada exitosamente');
      loadRecepciones();
    } catch (error: unknown) {
      console.error('Error eliminando recepción:', error);
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: { detail?: string; message?: string } } };
        const errorMessage = axiosError.response?.data?.message || axiosError.response?.data?.detail || 'Error desconocido';
        message.error(`Error al eliminar la recepción: ${errorMessage}`);
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        message.error(`Error al eliminar la recepción: ${errorMessage}`);
      }
    }
  };

  const handleView = (recepcion: RecepcionMercaderia) => {
    setSelectedRecepcion(recepcion);
    setViewModal(true);
  };

  const handleEdit = (recepcion: RecepcionMercaderia) => {
    if (!canManageRecepciones) {
      message.warning('No tienes permisos para modificar recepciones.');
      return;
    }
    setSelectedRecepcion(recepcion);
    setInvoiceNumber(recepcion.numero_factura || '');
    setEditModal(true);
  };

  const handleUpdateInvoice = async () => {
    if (!canManageRecepciones) {
      message.warning('No tienes permisos para modificar recepciones.');
      return;
    }
    if (!selectedRecepcion) {
      return;
    }

    try {
      setSavingInvoice(true);
      const trimmedValue = invoiceNumber.trim();
      await api.patch(`/inventario/recepciones-mercaderia/${selectedRecepcion.id_recepcion}/factura`, {
        numeroFactura: trimmedValue || null,
      });

      message.success('Número de factura actualizado correctamente');
    await loadRecepciones();
    setEditModal(false);
    setSelectedRecepcion(null);
    setInvoiceNumber('');
    } catch (err: unknown) {
      let errorMessage = 'Error desconocido';
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosError = err as { response?: { data?: { message?: string; detail?: string; error?: string } } };
        errorMessage = axiosError.response?.data?.message || axiosError.response?.data?.detail || axiosError.response?.data?.error || errorMessage;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      message.error(`No se pudo actualizar la factura: ${errorMessage}`);
    } finally {
      setSavingInvoice(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <PiPackageBold className="text-blue-600" />
            Recepción de Mercadería
          </h1>
          <p className="text-gray-600 mt-1">
            Historial de recepciones de mercadería y control de calidad
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="px-4 py-2 rounded-md border bg-white hover:bg-gray-50 text-gray-700 font-medium">
            ← Regresar
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl shadow p-5">
          <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Buscar por factura, orden o proveedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-11 rounded-lg border border-gray-300 px-4 text-base focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          {/* Nota: El botón 'Actualizar' fue removido por petición del usuario. La recarga se hará automáticamente o vía acciones específicas (Ver/Editar). */}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl shadow overflow-hidden">
        {loading && (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Cargando recepciones...</p>
          </div>
        )}

        {error && (
          <div className="p-8 text-center">
            <div className="text-red-600 mb-2">⚠️ Error</div>
            <p className="text-gray-600">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">ID</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Fecha</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Factura</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Orden</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Proveedor</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Items</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Usuario</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedRecepciones.map((recepcion) => (
                    <tr key={recepcion.id_recepcion} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        #{recepcion.id_recepcion}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(recepcion.fecha_recepcion).toLocaleDateString('es-GT')}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {recepcion.numero_factura || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {recepcion.numero_orden || recepcion.orden_compra?.numero_orden || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {recepcion.orden_compra?.proveedor?.nombre || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {recepcion._count?.detalle_recepcion_mercaderia || 0}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {recepcion.perfil_usuario
                          ? `${recepcion.perfil_usuario.primer_nombre} ${recepcion.perfil_usuario.primer_apellido}`
                          : '-'
                        }
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleView(recepcion)}
                            className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                            title="Ver detalle"
                          >
                            <PiEyeBold className="w-5 h-5" />
                          </button>
                          {canManageRecepciones && (
                            <button
                              onClick={() => handleEdit(recepcion)}
                              className="p-2 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors duration-200"
                              title="Editar factura"
                            >
                              <PiPencilBold className="w-5 h-5" />
                            </button>
                          )}
                          {canManageRecepciones && (
                            <button
                              onClick={() => setDeleteModal({ open: true, recepcion })}
                              className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors duration-200"
                              title="Eliminar"
                            >
                              <PiTrashBold className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {paginatedRecepciones.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                        <div className="flex flex-col items-center gap-2">
                          <PiPackageBold className="text-4xl text-gray-300" />
                          <p>No hay recepciones registradas</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Mostrando {((currentPage - 1) * pageSize) + 1} a {Math.min(currentPage * pageSize, filteredRecepciones.length)} de {filteredRecepciones.length} recepciones
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Anterior
                  </button>
                  <span className="px-3 py-1 text-sm text-gray-700">
                    Página {currentPage} de {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal de Vista (custom, estilo similar a Catalogo/Kárdex) */}
      {viewModal && selectedRecepcion && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setViewModal(false); setSelectedRecepcion(null); }} />
            <div className="relative flex items-center justify-center min-h-screen p-4">
              <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between px-4 h-14 border-b">
                  <div className="flex items-center gap-3">
                    <PiPackageBold className="text-blue-600 w-5 h-5" />
                    <h3 className="text-base font-semibold text-gray-800">Detalles de Recepción</h3>
                  </div>
                  <button className="p-2 rounded-lg hover:bg-gray-100" onClick={() => { setViewModal(false); setSelectedRecepcion(null); }} aria-label="Cerrar">
                    ✕
                  </button>
                </div>

              <div className="p-6 space-y-6 max-h-[78vh] overflow-auto text-sm">
                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-5 rounded-lg">
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">ID de Recepción</p>
                    <p className="text-base font-semibold text-gray-900">#{selectedRecepcion.id_recepcion}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Fecha de Recepción</p>
                    <p className="text-base font-semibold text-gray-900">{new Date(selectedRecepcion.fecha_recepcion).toLocaleDateString('es-GT')}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Número de Factura</p>
                    <p className="text-base font-semibold text-gray-900">{selectedRecepcion.numero_factura || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Número de Orden</p>
                    <p className="text-base font-semibold text-gray-900">{selectedRecepcion.numero_orden || selectedRecepcion.orden_compra?.numero_orden || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Proveedor</p>
                    <p className="text-base font-semibold text-gray-900">{selectedRecepcion.orden_compra?.proveedor?.nombre || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Usuario</p>
                    <p className="text-base font-semibold text-gray-900">{selectedRecepcion.perfil_usuario ? `${selectedRecepcion.perfil_usuario.primer_nombre} ${selectedRecepcion.perfil_usuario.primer_apellido}` : '-'}</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-3 text-gray-800">Detalle de Insumos</h4>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Insumo</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Cantidad Recibida</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Cantidad Aceptada</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedRecepcion.detalle_recepcion_mercaderia?.map((detalle) => (
                          <tr key={detalle.id_detalle} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{detalle.insumo_presentacion?.insumo?.nombre_insumo || '-'}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{detalle.cantidad_recibida || 0}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{detalle.cantidad_aceptada || 0}</td>
                          </tr>
                        ))}
                        {(!selectedRecepcion.detalle_recepcion_mercaderia || selectedRecepcion.detalle_recepcion_mercaderia.length === 0) && (
                          <tr>
                            <td colSpan={3} className="px-4 py-4 text-sm text-gray-500 text-center">No hay insumos registrados</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button onClick={() => { setViewModal(false); setSelectedRecepcion(null); }} className="h-9 px-4 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">Cerrar</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {editModal && selectedRecepcion && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              setEditModal(false);
              setSelectedRecepcion(null);
              setInvoiceNumber('');
            }}
          />
          <div className="relative flex items-center justify-center min-h-screen p-4">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-4 h-14 border-b">
                <div className="flex items-center gap-3">
                  <PiPencilBold className="text-emerald-600 w-5 h-5" />
                  <h3 className="text-base font-semibold text-gray-800">Editar número de factura</h3>
                </div>
                <button
                  className="p-2 rounded-lg hover:bg-gray-100"
                  onClick={() => {
                    setEditModal(false);
                    setSelectedRecepcion(null);
                    setInvoiceNumber('');
                  }}
                  aria-label="Cerrar"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-5 text-sm">
                <div className="grid grid-cols-1 gap-4 bg-gray-50 p-4 rounded-lg">
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">ID de Recepción</p>
                    <p className="text-base font-semibold text-gray-900">#{selectedRecepcion.id_recepcion}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Número de Orden</p>
                    <p className="text-base font-semibold text-gray-900">{selectedRecepcion.numero_orden || selectedRecepcion.orden_compra?.numero_orden || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Número de factura</p>
                    <input
                      className="w-full h-11 rounded-lg border border-gray-300 px-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-300"
                      placeholder="Ingrese el número de factura"
                      value={invoiceNumber}
                      onChange={(event) => setInvoiceNumber(event.target.value)}
                      maxLength={50}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setEditModal(false);
                      setSelectedRecepcion(null);
                      setInvoiceNumber('');
                    }}
                    className="h-10 px-4 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
                    type="button"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleUpdateInvoice}
                    className="h-10 px-4 rounded-md bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                    disabled={savingInvoice}
                    type="button"
                  >
                    {savingInvoice ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación de eliminación - personalizado para coincidir con estilo del resto de la app */}
      {deleteModal.open && deleteModal.recepcion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <PiTrashBold className="text-rose-600 text-2xl mr-3" />
              <h3 className="text-lg font-semibold text-gray-900">Confirmar eliminación</h3>
            </div>
            <p className="text-gray-600 mb-6">
              ¿Estás seguro de que deseas eliminar la recepción <strong>"{deleteModal.recepcion.numero_orden || `#${deleteModal.recepcion.id_recepcion}`}"</strong>? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteModal({ open: false, recepcion: null })}
                className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  try {
                    await handleDelete(deleteModal.recepcion!.id_recepcion);
                    setDeleteModal({ open: false, recepcion: null });
                    setSelectedRecepcion(null);
                  } catch {
                    // handleDelete muestra mensajes de error
                    setDeleteModal({ open: false, recepcion: null });
                  }
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}