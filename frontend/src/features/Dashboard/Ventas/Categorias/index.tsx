import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { PiPlusBold, PiEyeBold, PiPencilSimpleBold, PiTrashBold, PiBroomBold, PiWarning, PiX } from 'react-icons/pi';
import { MdClose } from 'react-icons/md';
import api from '../../../../api/apiClient';

type Categoria = {
  id_categoria: number;
  nombre_categoria: string;
  descripcion?: string | null;
  estado: 'activo' | 'desactivado';
};

export default function CategoriasProductos() {
  const [rows, setRows] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [openDrawer, setOpenDrawer] = useState<boolean>(false);
  const [viewing, setViewing] = useState<boolean>(false);
  const [editing, setEditing] = useState<Categoria | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Categoria | null>(null);

  const [formNombre, setFormNombre] = useState<string>('');
  const [formDescripcion, setFormDescripcion] = useState<string>('');
  const [formEstado, setFormEstado] = useState<'activo' | 'desactivado'>('activo');
  const [formErrors, setFormErrors] = useState<{ nombre?: string; descripcion?: string }>({});
  const [q, setQ] = useState<string>('');
  const navigate = useNavigate();

  const handleInputChange = (field: string, value: string) => {
    switch (field) {
      case 'nombre':
        setFormNombre(value);
        break;
      case 'descripcion':
        setFormDescripcion(value);
        break;
      case 'estado':
        setFormEstado(value as 'activo' | 'desactivado');
        break;
    }
  };

  useEffect(() => {
    fetchCategorias();
  }, []);

  async function fetchCategorias() {
    setLoading(true);
    setError(null);
    try {
      // Obtener categorías de productos desde el backend
      const resp = await api.get('/productos/categorias');
      if (!resp || resp.status >= 400) throw new Error('Error al cargar categorías');
      const data = resp.data.data || [];
      // Ordenar por ID ascendente como respaldo
      const sortedData = (data ?? []).sort((a: Categoria, b: Categoria) => a.id_categoria - b.id_categoria);
      setRows(sortedData as Categoria[]);
    } catch (e) {
      console.error('Error cargando categorías de productos desde API:', e);
      const m = e instanceof Error ? e.message : String(e);
      setError(m);
      message.error(`Error cargando categorías: ${m}`);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setFormNombre('');
    setFormDescripcion('');
    setFormEstado('activo');
    setFormErrors({});
    setViewing(false);
    setOpenDrawer(true);
  }

  function openEdit(row: Categoria) {
    setEditing(row);
    setFormNombre(row.nombre_categoria || '');
    setFormDescripcion(row.descripcion || '');
    setFormEstado(row.estado || 'activo');
    setFormErrors({});
    setViewing(false);
    setOpenDrawer(true);
  }

  function openView(row: Categoria) {
    setEditing(row);
    setFormNombre(row.nombre_categoria || '');
    setFormDescripcion(row.descripcion || '');
    setViewing(true);
    setOpenDrawer(true);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();

    // Limpiar errores previos
    setFormErrors({});

    // Validar campos obligatorios
    const errors: { nombre?: string; descripcion?: string } = {};
    if (!formNombre.trim()) {
      errors.nombre = 'El nombre de la categoría es obligatorio';
    }
    if (!formDescripcion.trim()) {
      errors.descripcion = 'La descripción de la categoría es obligatoria';
    }

    // Si hay errores, mostrarlos y detener el envío
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      // Hacer scroll al primer error
      setTimeout(() => {
        const firstError = document.querySelector('.text-red-600');
        if (firstError) {
          firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      return;
    }

    setLoading(true);
    try {
      if (editing) {
        // actualizar categoria de producto
        const payload: { nombre_categoria: string; descripcion?: string; estado?: string } = {
          nombre_categoria: formNombre.trim(),
          descripcion: formDescripcion.trim() || undefined,
          estado: formEstado
        };
        const resp = await api.put(`/productos/categorias/${encodeURIComponent(String(editing.id_categoria))}`, payload as Record<string, unknown>);
        if (!resp || resp.status >= 400) throw new Error('Error al actualizar categoría');
      } else {
        const payload: { nombre_categoria: string; descripcion?: string; estado?: string } = {
          nombre_categoria: formNombre.trim(),
          descripcion: formDescripcion.trim() || undefined,
          estado: formEstado
        };
        const resp = await api.post('/productos/categorias', payload as Record<string, unknown>);
        if (!resp || resp.status >= 400) throw new Error('Error al crear categoría');
      }
      await fetchCategorias();
      setOpenDrawer(false);
      message.success(`¡Categoría ${editing ? 'actualizada' : 'creada'} correctamente!`);
    } catch (err: unknown) {
      console.error('Error guardando categoría:', err);
      const m = err instanceof Error ? err.message : String(err);
      message.error(`Error ${editing ? 'actualizando' : 'creando'} categoría: ${m}`);
    } finally {
      setLoading(false);
    }
  }

  async function doDelete(row: Categoria) {
    setLoading(true);
    try {
      const resp = await api.delete(`/productos/categorias/${encodeURIComponent(String(row.id_categoria))}`);
      if (!resp || resp.status >= 400) throw new Error('Error al eliminar categoría');
      await fetchCategorias();
      setConfirmDelete(null);
      message.success('¡Categoría eliminada correctamente!');
    } catch (err: unknown) {
      console.error('Error eliminando categoría:', err);
      const m = err instanceof Error ? err.message : String(err);
      message.error(`Error eliminando categoría: ${m}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="w-full">
      <div className="mb-4">
        <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
          {/* Izquierda: regresar, búsqueda y filtro */}
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100" title="Regresar">←</button>
            <h3 className="text-base font-semibold">Gestión de Categoria de Productos</h3>

            <label className="sr-only" htmlFor="cat-search">Buscar</label>
            <input id="cat-search" placeholder="Buscar categorías…" value={q} onChange={(e) => setQ(e.target.value)} className="h-10 w-64 rounded-lg border border-gray-200 bg-white pl-3 pr-3 text-sm text-gray-700 focus:outline-none" />
          </div>

          {/* Derecha: botones */}
          <div className="flex items-center gap-2">
            <button onClick={() => { setQ(''); }} className="h-10 rounded-lg border px-3 text-sm font-semibold hover:bg-gray-50 flex items-center gap-2">
              <PiBroomBold />
              Limpiar
            </button>
            <button onClick={openCreate} className="h-10 rounded-lg bg-emerald-600 px-3 text-white flex items-center gap-2">
              <PiPlusBold /> Crear Categoría
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="p-3 border-b flex items-center justify-between">
          <div className="text-sm text-gray-600">Lista de categorías de productos</div>
          <div className="text-sm text-gray-500">{rows.length} registros</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500 text-xs uppercase">
              <tr className="border-b">
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Descripción</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="text-gray-800">
              {loading && (
                <tr>
                  <td colSpan={5} className="p-6 text-center">Cargando...</td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-gray-500">No hay categorías</td>
                </tr>
              )}
              {rows
                .filter((r) => {
                  if (q && !(`${r.nombre_categoria}`.toLowerCase().includes(q.toLowerCase()) || `${r.descripcion}`.toLowerCase().includes(q.toLowerCase()))) return false;
                  return true;
                })
                .map((r) => (
                <tr key={r.id_categoria} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 align-top">{r.id_categoria}</td>
                  <td className="px-4 py-3 align-top">{r.nombre_categoria}</td>
                  <td className="px-4 py-3 align-top max-w-xs truncate" title={r.descripcion || ''}>{r.descripcion || '—'}</td>
                  <td className="px-4 py-3 align-top">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      r.estado === 'activo'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {r.estado === 'activo' ? 'Activo' : 'Desactivado'}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button title="Ver" onClick={() => openView(r)} className="p-2 rounded-lg hover:bg-gray-100"><PiEyeBold /></button>
                      <button title="Editar" onClick={() => openEdit(r)} className="p-2 rounded-lg hover:bg-gray-100"><PiPencilSimpleBold /></button>
                      <button title="Eliminar" onClick={() => setConfirmDelete(r)} className="p-2 rounded-lg hover:bg-gray-100 text-rose-600"><PiTrashBold /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawer para ver/crear/editar */}
      <div aria-hidden={!openDrawer}>
        {openDrawer && (
          <div className="fixed inset-0 z-[60] flex">
            {/* Overlay solo detrás del drawer */}
            <div className="flex-1" onClick={() => setOpenDrawer(false)}>
              <div className="absolute inset-0 bg-black/40" />
            </div>
            <aside className="relative w-full md:w-[520px] bg-white shadow-2xl border-l z-[61] ml-auto transition-transform duration-300">
              <div className="h-14 px-5 flex items-center justify-between border-b">
                <h3 className="text-base md:text-lg font-bold text-gray-800">{viewing ? 'Ver categoría' : (editing ? 'Editar categoría' : 'Crear categoría')}</h3>
                <button onClick={() => setOpenDrawer(false)} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Cerrar"><MdClose /></button>
              </div>
              <div className="p-5">
                <form onSubmit={submitForm}>
                  {Object.keys(formErrors).length > 0 && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg animate-pulse">
                      <div className="flex items-center gap-2 mb-2">
                        <PiWarning className="text-red-600 text-lg" />
                        <p className="text-sm font-semibold text-red-800">Campos obligatorios incompletos</p>
                      </div>
                      <p className="text-sm text-red-700">Por favor complete todos los campos marcados con * antes de continuar.</p>
                    </div>
                  )}
                  <div className="grid gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        Nombre <span className="text-red-500">*</span>
                      </label>
                      <input
                        value={formNombre}
                        onChange={(e) => handleInputChange('nombre', e.target.value)}
                        className={`w-full h-11 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 ${
                          formErrors.nombre ? 'border-red-300 bg-red-50' : 'border-gray-200'
                        }`}
                        placeholder="Ingrese el nombre de la categoría"
                        readOnly={viewing}
                        required
                        title="Por favor ingrese el nombre de la categoría"
                        onInvalid={(e) => {
                          e.preventDefault();
                          (e.target as HTMLInputElement).setCustomValidity('Por favor ingrese el nombre de la categoría');
                        }}
                        onInput={(e) => {
                          (e.target as HTMLInputElement).setCustomValidity('');
                        }}
                      />
                      {formErrors.nombre && (
                        <p className="text-sm text-red-600 mt-1 font-medium flex items-center gap-1">
                          <PiX className="text-red-500" size={16} /> {formErrors.nombre}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        Descripción <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={formDescripcion}
                        onChange={(e) => handleInputChange('descripcion', e.target.value)}
                        className={`w-full h-20 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-none ${
                          formErrors.descripcion ? 'border-red-300 bg-red-50' : 'border-gray-200'
                        }`}
                        placeholder="Ingrese una descripción para la categoría"
                        readOnly={viewing}
                        rows={3}
                        required
                        title="Por favor ingrese la descripción de la categoría"
                        onInvalid={(e) => {
                          e.preventDefault();
                          (e.target as HTMLTextAreaElement).setCustomValidity('Por favor ingrese la descripción de la categoría');
                        }}
                        onInput={(e) => {
                          (e.target as HTMLTextAreaElement).setCustomValidity('');
                        }}
                      />
                      {formErrors.descripcion && (
                        <p className="text-sm text-red-600 mt-1 font-medium flex items-center gap-1">
                          <PiX className="text-red-500" size={16} /> {formErrors.descripcion}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        Estado <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formEstado}
                        onChange={(e) => handleInputChange('estado', e.target.value)}
                        className="w-full h-11 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                        disabled={viewing}
                        required
                      >
                        <option value="activo">Activo</option>
                        <option value="desactivado">Desactivado</option>
                      </select>
                    </div>
                    <div className="flex gap-2 justify-end pt-2">
                      <button type="button" onClick={() => setOpenDrawer(false)} className="h-10 rounded-lg border px-4">Cerrar</button>
                      {!viewing && (
                        <button
                          type="submit"
                          className={`h-10 rounded-lg px-4 text-white flex items-center gap-2 ${
                            Object.keys(formErrors).length > 0
                              ? 'bg-red-600 hover:bg-red-700'
                              : 'bg-emerald-600 hover:bg-emerald-700'
                          }`}
                          disabled={loading}
                        >
                          {loading ? (
                            <span className="flex items-center gap-2">
                              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Procesando...
                            </span>
                          ) : (
                            <>
                              <PiPlusBold size={16} />
                              {Object.keys(formErrors).length > 0 ? 'Corregir errores' : (editing ? 'Guardar' : 'Crear')}
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </form>
              </div>
            </aside>
          </div>
        )}
      </div>

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md border">
            <div className="text-lg font-bold mb-2">Eliminar categoría</div>
            <div className="mb-4">¿Seguro que deseas eliminar <strong>{confirmDelete.nombre_categoria}</strong>?</div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="h-10 rounded-lg border px-4">Cancelar</button>
              <button onClick={() => doDelete(confirmDelete)} className="h-10 rounded-lg bg-rose-600 px-4 text-white">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {error && <div className="mt-3 text-sm text-rose-700">Error: {error}</div>}
    </div>
    </>
  );
}