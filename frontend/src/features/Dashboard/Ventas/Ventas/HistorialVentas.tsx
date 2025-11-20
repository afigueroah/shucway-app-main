import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ventasService, type Venta, type VentaCompleta, type DetalleVenta } from '@/api/ventasService';
import { MetodoIcon } from '@/components/MetodoIcon';
import { PiTrashBold, PiEyeBold } from 'react-icons/pi';
import { message } from 'antd';

const HistorialVentas: React.FC = () => {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [search, setSearch] = useState('');
  const [range, setRange] = useState<'todo'|'hoy'|'ayer'|'ultimos_7'|'ultimos_30'|'este_mes'|'custom'>('todo');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [metodos, setMetodos] = useState<string[]>([]);
  const METHODS = [
    { value: 'Cash', label: 'Efectivo' },
    { value: 'Tarjeta', label: 'Tarjeta' },
    { value: 'Transferencia', label: 'Transferencia' },
    { value: 'Canje', label: 'Canje' },
    { value: 'Cupon', label: 'Cupon' },
  ];
  const [sortBy, setSortBy] = useState<'id' | 'fecha' | 'total' | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedVenta, setSelectedVenta] = useState<VentaCompleta | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.ceil(ventas.length / pageSize);
  const displayedVentas = ventas.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const navigate = useNavigate();

  useEffect(() => {
    loadVentas();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadVentas();
  }, [sortBy, sortOrder]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadVentas();
  }, [search, range, customFrom, customTo, metodos]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadVentas = async () => {
    try {
      setIsLoading(true);
      const now = new Date();
      let fechaInicio: string | undefined;
      let fechaFin: string | undefined;
      if (range === 'hoy') {
        fechaInicio = fechaFin = now.toISOString().split('T')[0];
      } else if (range === 'ayer') {
        const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
        fechaInicio = fechaFin = yesterday.toISOString().split('T')[0];
      } else if (range === 'ultimos_7') {
        const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(now.getDate() - 7);
        fechaInicio = sevenDaysAgo.toISOString().split('T')[0]; fechaFin = now.toISOString().split('T')[0];
      } else if (range === 'ultimos_30') {
        const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(now.getDate() - 30);
        fechaInicio = thirtyDaysAgo.toISOString().split('T')[0]; fechaFin = now.toISOString().split('T')[0];
      } else if (range === 'este_mes') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        fechaInicio = startOfMonth.toISOString().split('T')[0]; fechaFin = now.toISOString().split('T')[0];
      } else if (range === 'custom' && customFrom && customTo) {
        fechaInicio = customFrom;
        fechaFin = customTo;
      }
      const data = await ventasService.getVentas('confirmada', fechaInicio, fechaFin);
      const filtered = data.filter((v) => {
        if (search && !(String(v.id_venta).includes(search) || (v.productos ?? '').toLowerCase().includes(search.toLowerCase()))) return false;
        if (metodos.length > 0 && !metodos.includes(v.tipo_pago)) return false;
        return true;
      });
      // Aplica ordenamiento si fue seleccionado
      if (sortBy) {
        filtered.sort((a, b) => {
          if (sortBy === 'fecha') {
            const tA = new Date(a.fecha_venta).getTime();
            const tB = new Date(b.fecha_venta).getTime();
            return sortOrder === 'asc' ? tA - tB : tB - tA;
          }
          if (sortBy === 'total') {
            const ta = a.total_venta ?? 0;
            const tb = b.total_venta ?? 0;
            return sortOrder === 'asc' ? ta - tb : tb - ta;
          }
          if (sortBy === 'id') {
            return sortOrder === 'asc' ? a.id_venta - b.id_venta : b.id_venta - a.id_venta;
          }
          return 0;
        });
      }

      setVentas(filtered);
      setCurrentPage(1);
    } catch (e) {
      console.error(e);
      message.error('Error cargando ventas');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMetodo = (m: string) => {
    setMetodos((prev) => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  }

  const openDetails = async (id: number) => {
    try {
      const full = await ventasService.getVentaCompleta(Number(id));
      setSelectedVenta(full);
    } catch (e) {
      console.error(e);
      message.error('Error obteniendo detalles de venta');
    }
  };

  const doDelete = async (id: number) => {
    try {
      await ventasService.deleteVenta(id);
      setConfirmDelete(null);
      message.success('Venta eliminada');
      loadVentas();
    } catch (e) {
      console.error(e);
      message.error('No se pudo eliminar la venta');
    }
  };

  return (
    <div className="p-6 bg-white rounded-xl border shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Historial de ventas (Completo)</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/ventas")} className="h-10 px-3 rounded-lg border">Regresar</button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3 items-center">
        <div className="col-span-2 flex items-center gap-3">
          <input placeholder="Buscar ticket o producto" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-3 pr-3 py-2 rounded-lg border border-gray-200 w-64 text-sm" />
          <select value={range} onChange={(e) => setRange(e.target.value as typeof range)} className="px-2 py-1 rounded-lg border border-gray-200 text-sm">
            <option value="todo">Todas</option>
            <option value="hoy">Hoy</option>
            <option value="ayer">Ayer</option>
            <option value="ultimos_7">Últimos 7 días</option>
            <option value="ultimos_30">Últimos 30 días</option>
            <option value="este_mes">Este mes</option>
            <option value="custom">Personalizado</option>
          </select>
          {range === 'custom' && (
            <div className="flex gap-2 items-center">
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="px-2 py-1 rounded-lg border border-gray-200 text-sm" />
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="px-2 py-1 rounded-lg border border-gray-200 text-sm" />
            </div>
          )}
        </div>
        <div className="col-span-1 flex items-center gap-2 justify-end">
          {METHODS.map((m) => (
            <label key={m.value} className="inline-flex items-center gap-2 px-2 py-1 rounded-md border border-gray-200 text-sm cursor-pointer">
              <input type="checkbox" checked={metodos.includes(m.value)} onChange={() => toggleMetodo(m.value)} className="accent-emerald-600" />
              <span className="flex items-center gap-1"><MetodoIcon metodo={m.label} className="w-4 h-4 text-gray-700" />{m.label}</span>
            </label>
          ))}
        </div>
      </div>
      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left border-b">
              <th className="p-3 text-sm cursor-pointer" onClick={() => { setSortBy('id'); setSortOrder(prev => (sortBy === 'id' && prev === 'asc') ? 'desc' : 'asc'); }}>#</th>
              <th className="p-3 text-sm cursor-pointer" onClick={() => { setSortBy('fecha'); setSortOrder(prev => (sortBy === 'fecha' && prev === 'asc') ? 'desc' : 'asc'); }}>Fecha</th>
              <th className="p-3 text-sm">Productos</th>
              <th className="p-3 text-sm cursor-pointer" onClick={() => { setSortBy('total'); setSortOrder(prev => (sortBy === 'total' && prev === 'asc') ? 'desc' : 'asc'); }}>Total</th>
              <th className="p-3 text-sm">Método</th>
              <th className="p-3 text-sm">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {displayedVentas.map((v) => (
              <tr key={v.id_venta} className="border-b hover:bg-gray-50">
                <td className="p-3 font-medium">{v.id_venta}</td>
                <td className="p-3 text-sm">{new Date(v.fecha_venta).toLocaleString('es-ES', { timeZone: 'UTC' })}</td>
                <td className="p-3">{v.productos || '—'}</td>
                <td className="p-3 font-semibold">Q{(v.total_venta ?? 0).toFixed(2)}</td>
                <td className="p-3">
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-gray-100">
                    <MetodoIcon metodo={v.tipo_pago} className="w-4 h-4" />
                    {v.tipo_pago}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <button onClick={() => openDetails(v.id_venta)} className="p-2 rounded-lg hover:bg-gray-100"><PiEyeBold /></button>
                    <button onClick={() => setConfirmDelete(v.id_venta)} className="p-2 rounded-lg hover:bg-gray-100 text-rose-600"><PiTrashBold /></button>
                  </div>
                </td>
              </tr>
            ))}
            {displayedVentas.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-gray-500">No hay ventas</td></tr>
            )}
          </tbody>
        </table>
      )}

      {/* Paginación */}
      {ventas.length > 0 && (
        <div className="flex items-center justify-between mt-4 px-3">
          <div className="text-sm text-gray-600">
            Mostrando {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, ventas.length)} de {ventas.length} registro(s)
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-sm">Mostrar:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-1 border border-gray-200 rounded text-sm"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-200 rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <span className="px-3 py-1 text-sm">
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-200 rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {selectedVenta && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40">
          <div className="bg-white p-6 rounded-xl shadow-xl max-w-3xl w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Detalles Venta #{selectedVenta.id_venta}</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => setSelectedVenta(null)} className="h-8 rounded-lg border px-3">Cerrar</button>
              </div>
            </div>
            <div className="mb-3 text-sm text-gray-600">Fecha: {new Date(selectedVenta.fecha_venta).toLocaleString('es-ES', { timeZone: 'UTC' })}</div>
            <table className="w-full border-collapse mb-4">
              <thead>
                <tr className="text-left border-b">
                  <th className="px-3 py-2 text-sm">Cantidad</th>
                  <th className="px-3 py-2 text-sm">Producto</th>
                  <th className="px-3 py-2 text-sm">Variante</th>
                  <th className="px-3 py-2 text-sm">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {selectedVenta.detalles.map((d: DetalleVenta) => (
                  <tr key={d.id_detalle} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2">{d.cantidad}</td>
                    <td className="px-3 py-2">{d.producto?.nombre || (d.producto as unknown as { nombre_producto: string })?.nombre_producto || '—'}</td>
                    <td className="px-3 py-2">{d.variante?.nombre_variante || '—'}</td>
                    <td className="px-3 py-2">Q{d.subtotal.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between">
              <div className="text-sm">Método: <strong>{selectedVenta.tipo_pago}</strong></div>
              <div className="text-lg font-bold">Total: Q{selectedVenta.total_venta?.toFixed(2) || '0.00'}</div>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-[71] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md border">
            <div className="text-lg font-bold mb-2">Eliminar Venta</div>
            <div className="mb-4">¿Seguro que deseas eliminar la venta #{confirmDelete}? Esta acción solo está permitida si la venta está en estado pendiente.</div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="h-10 rounded-lg border px-4">Cancelar</button>
              <button onClick={() => doDelete(confirmDelete)} className="h-10 rounded-lg bg-rose-600 px-4 text-white">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistorialVentas;
