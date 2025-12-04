import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { cajaService, type Arqueo } from '@/api/cajaService'; // Asumiendo que existe
import { ventasService, type Venta } from '@/api/ventasService';
import { PiTrashBold, PiEyeBold } from 'react-icons/pi';
import { message } from 'antd';
import html2pdf from 'html2pdf.js';

type RangeFilter = 'todo' | 'hoy' | 'ayer' | 'ultimos_7' | 'ultimos_30' | 'este_mes' | 'custom';

interface Transferencia {
  id_deposito?: string;
  nombre_cliente?: string;
  monto?: number;
  numero_referencia?: string;
  nombre_banco?: string;
  tipo_pago?: string;
}

const ArqueoCaja: React.FC = () => {
  const [arqueos, setArqueos] = useState<Arqueo[]>([]);
  const [search, setSearch] = useState('');
  const [range, setRange] = useState<RangeFilter>('todo');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedArqueo, setSelectedArqueo] = useState<Arqueo | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.ceil(arqueos.length / pageSize);
  const displayedArqueos = arqueos.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Datos para el reporte
  const [reporteData, setReporteData] = useState<{
    ventas: Venta[];
    transferencias: Transferencia[];
    ventasTotales: number;
    ventasEfectivo: number;
    transferTotal: number;
  } | null>(null);
  const [loadingReporte, setLoadingReporte] = useState(false);

  const navigate = useNavigate();

  const loadArqueos = useCallback(async () => {
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
      const data = await cajaService.getArqueos(fechaInicio, fechaFin);
      const filtered = data.filter((a) => {
        if (search && !(String(a.id_arqueo).includes(search) || a.fecha_arqueo.includes(search))) return false;
        return true;
      });
      setArqueos(filtered);
      setCurrentPage(1);
    } catch (e) {
      console.error('Error cargando arqueos de caja:', e);
      message.error('Error al cargar arqueos de caja');
      setArqueos([]);
      setCurrentPage(1);
    } finally {
      setIsLoading(false);
    }
  }, [search, range, customFrom, customTo]);

  useEffect(() => {
    loadArqueos();
  }, [loadArqueos]);

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize]);

  const handleView = async (arqueo: Arqueo) => {
    setSelectedArqueo(arqueo);
    setLoadingReporte(true);
    try {
      // Usar transferencias del arqueo
      const transferencias = arqueo.transferencias || [];

      // Cargar ventas del día del arqueo para el reporte detallado
      const fechaDia = arqueo.fecha_arqueo.split('T')[0];
      const fechaInicio = fechaDia + ' 00:00:00';
      const fechaFin = fechaDia + ' 23:59:59';

      const ventas = await ventasService.getVentas('confirmada', fechaInicio, fechaFin, arqueo.id_cajero || undefined);

      setReporteData({
        ventas,
        transferencias,
        ventasTotales: arqueo.total_sistema, // Usar el total almacenado en el arqueo
        ventasEfectivo: arqueo.total_sistema, // Usar el total almacenado en el arqueo
        transferTotal: transferencias.reduce((sum, t) => sum + (t.monto || 0), 0),
      });
    } catch (error) {
      console.error('Error cargando datos del reporte:', error);
      message.error('Error al cargar datos del reporte');
      setReporteData(null);
    } finally {
      setLoadingReporte(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      // Asumiendo método deleteArqueo
      await cajaService.deleteArqueo(id); // Placeholder
      message.success('Arqueo eliminado');
      loadArqueos();
    } catch (e) {
      console.error('Error eliminando arqueo:', e);
      message.error('Error eliminando arqueo');
    }
    setConfirmDelete(null);
  };

  return (
    <div className="p-8 bg-[#f8fafc] min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/ventas')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-gray-700 border border-gray-200 font-medium shadow-sm hover:bg-gray-50 transition-all"
        >
          <span className="text-xl">←</span>
          <span>Regresar</span>
        </button>
        <h1 className="text-2xl font-bold text-gray-800">Historial de Arqueos de Caja</h1>
      </div>

      {/* Filtros */}
      <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ID o fecha..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rango</label>
            <select
              value={range}
              onChange={(e) => setRange(e.target.value as RangeFilter)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="todo">Todo</option>
              <option value="hoy">Hoy</option>
              <option value="ayer">Ayer</option>
              <option value="ultimos_7">Últimos 7 días</option>
              <option value="ultimos_30">Últimos 30 días</option>
              <option value="este_mes">Este mes</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>
          {range === 'custom' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {isLoading && (
          <div className="p-4 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <p className="mt-2 text-gray-500">Cargando arqueos...</p>
          </div>
        )}
        {!isLoading && (
          <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha Arqueo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Apertura</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cierre</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Contado</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Sistema</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Diferencia</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {displayedArqueos.map((arqueo) => (
              <tr key={arqueo.id_arqueo}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{arqueo.id_arqueo}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(arqueo.fecha_arqueo).toLocaleDateString()}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {arqueo.fecha_apertura ? new Date(arqueo.fecha_apertura).toLocaleString() : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {arqueo.fecha_cierre ? new Date(arqueo.fecha_cierre).toLocaleString() : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Q{arqueo.total_contado?.toFixed(2)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Q{arqueo.total_sistema?.toFixed(2)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Q{arqueo.diferencia?.toFixed(2)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{arqueo.estado}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => handleView(arqueo)}
                    className="text-blue-600 hover:text-blue-900 mr-3"
                  >
                    <PiEyeBold size={18} />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(arqueo.id_arqueo)}
                    className="text-red-600 hover:text-red-900"
                  >
                    <PiTrashBold size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>

      {/* Paginación */}
      <div className="flex items-center justify-between mt-6">
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-700">
            Mostrando {displayedArqueos.length} de {arqueos.length} arqueos
          </div>
          <div>
            <label className="text-sm text-gray-700 mr-2">Por página:</label>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="px-2 py-1 border border-gray-300 rounded-md text-sm"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50"
          >
            Anterior
          </button>
          <span className="text-sm">Página {currentPage} de {totalPages}</span>
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
      </div>

      {/* Modal de detalles */}

      {/* Confirmar eliminación */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h2 className="text-lg font-bold mb-4">Confirmar Eliminación</h2>
            <p>¿Estás seguro de que quieres eliminar este arqueo?</p>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de reporte de arqueo */}
      {selectedArqueo && (
        <ArqueoReportModal
          onClose={() => {
            setSelectedArqueo(null);
            setReporteData(null);
          }}
          arqueo={selectedArqueo}
          reporteData={reporteData}
          loading={loadingReporte}
        />
      )}
    </div>
  );
};

export default ArqueoCaja;

/* ===================== Reporte de Arqueo ===================== */
function ArqueoReportModal({
  onClose,
  arqueo,
  reporteData,
  loading,
}: {
  onClose: () => void;
  arqueo: Arqueo;
  reporteData: {
    ventas: Venta[];
    transferencias: Transferencia[];
    ventasTotales: number;
    ventasEfectivo: number;
    transferTotal: number;
  } | null;
  loading: boolean;
}): JSX.Element {
  const fechaArqueo = new Intl.DateTimeFormat("es-GT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(arqueo.fecha_arqueo));

  const openPrintWindow = () => {
    try {
      const element = document.getElementById('reporte-arqueo');
      if (!element) return;
      const opt = {
        margin: 1,
        filename: `arqueo-${arqueo.id_arqueo}.pdf`,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' as const }
      };
      html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error('Error generando PDF:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Reporte de Arqueo #{arqueo.id_arqueo}</h2>
            <div className="flex gap-2">
              <button
                onClick={openPrintWindow}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                Generar PDF
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
              >
                Cerrar
              </button>
            </div>
          </div>
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <p className="mt-2 text-gray-500">Cargando datos del reporte...</p>
            </div>
          ) : reporteData ? (
            <PrintableArqueoSheet
              arqueo={arqueo}
              reporteData={reporteData}
              fechaArqueo={fechaArqueo}
            />
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No se pudieron cargar los datos del reporte.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PrintableArqueoSheet({
  arqueo,
  reporteData,
  fechaArqueo,
}: {
  arqueo: Arqueo;
  reporteData: {
    ventas: Venta[];
    transferencias: Transferencia[];
    ventasTotales: number;
    ventasEfectivo: number;
    transferTotal: number;
  };
  fechaArqueo: string;
}): JSX.Element {
  const esperado = arqueo.total_sistema;
  const contado = arqueo.total_contado;
  const diferencia = arqueo.diferencia;

  return (
    <div id="reporte-arqueo" className="sheet mx-auto bg-white rounded-xl border shadow-sm p-8">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">REPORTE DE ARQUEO DE CAJA</h1>
        <p className="text-gray-600">Arqueo #{arqueo.id_arqueo} - {fechaArqueo}</p>
      </div>

      <SectionHeading>Información del Arqueo</SectionHeading>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Row label="ID Arqueo" value={String(arqueo.id_arqueo)} />
        <Row label="ID Cajero" value={String(arqueo.id_cajero || 'N/A')} />
        <Row label="Fecha Arqueo" value={fechaArqueo} />
        <Row label="Fecha Apertura" value={arqueo.fecha_apertura ? new Date(arqueo.fecha_apertura).toLocaleString() : 'N/A'} />
        <Row label="Fecha Cierre" value={arqueo.fecha_cierre ? new Date(arqueo.fecha_cierre).toLocaleString() : 'N/A'} />
        <Row label="Estado" value={arqueo.estado} />
        <Row label="Total Sistema" value={`Q${arqueo.total_sistema.toFixed(2)}`} />
        <Row label="Total Contado" value={`Q${arqueo.total_contado.toFixed(2)}`} />
        <Row label="Diferencia" value={`Q${arqueo.diferencia.toFixed(2)}`} strong />
        <Row label="Observaciones" value={arqueo.observaciones || 'Ninguna'} />
      </div>

      <SectionHeading>Conteo Físico</SectionHeading>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Row label="Billetes Q100" value={`${arqueo.billetes_100} x Q100 = Q${arqueo.total_billetes_100.toFixed(2)}`} />
        <Row label="Billetes Q50" value={`${arqueo.billetes_50} x Q50 = Q${arqueo.total_billetes_50.toFixed(2)}`} />
        <Row label="Billetes Q20" value={`${arqueo.billetes_20} x Q20 = Q${arqueo.total_billetes_20.toFixed(2)}`} />
        <Row label="Billetes Q10" value={`${arqueo.billetes_10} x Q10 = Q${arqueo.total_billetes_10.toFixed(2)}`} />
        <Row label="Billetes Q5" value={`${arqueo.billetes_5} x Q5 = Q${arqueo.total_billetes_5.toFixed(2)}`} />
        <Row label="Monedas Q1" value={`${arqueo.monedas_1} x Q1 = Q${arqueo.total_monedas_1.toFixed(2)}`} />
        <Row label="Monedas Q0.50" value={`${arqueo.monedas_050} x Q0.50 = Q${arqueo.total_monedas_050.toFixed(2)}`} />
        <Row label="Monedas Q0.25" value={`${arqueo.monedas_025} x Q0.25 = Q${arqueo.total_monedas_025.toFixed(2)}`} />
      </div>

      <SectionHeading>Resumen de Ventas</SectionHeading>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Row label="Total Ventas" value={`Q${reporteData.ventasTotales.toFixed(2)}`} />
        <Row label="Ventas en Efectivo" value={`Q${reporteData.ventasEfectivo.toFixed(2)}`} />
        <Row label="Transferencias" value={`Q${reporteData.transferTotal.toFixed(2)}`} />
        <Row label="Efectivo Esperado" value={`Q${esperado.toFixed(2)}`} />
        <Row label="Efectivo Contado" value={`Q${contado.toFixed(2)}`} />
        <Row label="Diferencia" value={`Q${diferencia.toFixed(2)}`} strong />
      </div>

      {reporteData.transferencias.length > 0 && (
        <>
          <SectionHeading>Transferencias</SectionHeading>
          <table className="w-full border-collapse border border-gray-300 mb-6">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-2 text-left">ID Depósito</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Cliente</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Monto</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Tipo Pago</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Referencia</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Banco</th>
              </tr>
            </thead>
            <tbody>
              {reporteData.transferencias.map((t) => (
                <tr key={t.id_deposito}>
                  <td className="border border-gray-300 px-4 py-2">{t.id_deposito}</td>
                  <td className="border border-gray-300 px-4 py-2">{t.nombre_cliente || 'N/A'}</td>
                  <td className="border border-gray-300 px-4 py-2">Q{t.monto?.toFixed(2)}</td>
                  <td className="border border-gray-300 px-4 py-2">{t.tipo_pago}</td>
                  <td className="border border-gray-300 px-4 py-2">{t.numero_referencia || 'N/A'}</td>
                  <td className="border border-gray-300 px-4 py-2">{t.nombre_banco || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <SectionHeading>Ventas Detalladas</SectionHeading>
      <table className="w-full border-collapse border border-gray-300 mb-6">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 px-4 py-2 text-left">ID Venta</th>
            <th className="border border-gray-300 px-4 py-2 text-left">Fecha</th>
            <th className="border border-gray-300 px-4 py-2 text-left">Cliente</th>
            <th className="border border-gray-300 px-4 py-2 text-left">Tipo Pago</th>
            <th className="border border-gray-300 px-4 py-2 text-left">Total</th>
          </tr>
        </thead>
        <tbody>
          {reporteData.ventas.map((v) => (
            <tr key={v.id_venta}>
              <td className="border border-gray-300 px-4 py-2">{v.id_venta}</td>
              <td className="border border-gray-300 px-4 py-2">{new Date(v.fecha_venta).toLocaleDateString()}</td>
              <td className="border border-gray-300 px-4 py-2">{v.cliente?.nombre || 'N/A'}</td>
              <td className="border border-gray-300 px-4 py-2">{v.tipo_pago}</td>
              <td className="border border-gray-300 px-4 py-2">Q{v.total_venta?.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="flex items-center gap-2 mb-2">
      <div className="h-5 w-1.5 rounded bg-emerald-600" />
      <h3 className="text-lg font-semibold text-gray-800">{children}</h3>
    </div>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }): JSX.Element {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-4 py-1 text-sm">
      <span className="text-gray-600">{label}:</span>
      <span className={strong ? "font-bold text-gray-900" : "text-gray-900"}>{value}</span>
    </div>
  );
}