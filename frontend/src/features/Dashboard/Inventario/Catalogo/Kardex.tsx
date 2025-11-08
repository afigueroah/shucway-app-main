import React, { useEffect, useState } from 'react';
import { supabase } from '../../../../api/supabaseClient';

type Movimiento = {
  fecha?: string;
  tipo_movimiento?: string;
  referencia?: string;
  entrada?: number | null;
  salida?: number | null;
  saldo?: number | null;
  costo_unitario?: number | null;
  valor_total?: number | null;
  usuario?: string;
  descripcion?: string;
  lote_fecha_vencimiento?: string;
  lote_ubicacion?: string;
  lote_cantidad_inicial?: number | null;
  lote_cantidad_actual?: number | null;
  presentacion_descripcion?: string;
  presentacion_unidad?: string;
};

export default function Kardex({ id_insumo, onClose, fullScreen }: { id_insumo: number | string; onClose?: () => void; fullScreen?: boolean }) {
  const [rows, setRows] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Manejar id_insumo nulo o no numérico: intentar pasarlo como string si Number() es NaN
        const idNum = Number(id_insumo);
        const { data, error } = await supabase.rpc('fn_kardex_insumo', {
          p_id_insumo: idNum,
          p_fecha_desde: null,
          p_fecha_hasta: null,
        });
        if (!mounted) return;
        if (error) throw error;
        setRows(Array.isArray(data) ? data as Movimiento[] : []);
      } catch (e: unknown) {
        let msg = '';
        if (e instanceof Error) msg = e.message;
        else if (typeof e === 'object' && e !== null) msg = JSON.stringify(e);
        else msg = String(e);
        console.error('Kardex load error:', msg);
        // Si es un error de permisos, dar pista
        if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('forbidden') || msg.toLowerCase().includes('policy')) {
          setError('Error de permisos leyendo kardex. Verifica políticas RLS y la sesión actual.');
        } else {
          setError(msg);
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id_insumo]);

  // Los datos ya vienen con saldos calculados desde fn_kardex_insumo
  type RowSaldo = Movimiento;
  const rowsWithSaldo = React.useMemo(() => {
    return rows as RowSaldo[];
  }, [rows]);

  const rootClass = fullScreen
    ? 'w-full bg-white rounded-lg border border-gray-200 p-4 h-[calc(100vh-160px)] overflow-auto'
    : 'w-full bg-white rounded-xl shadow p-4';

  return (
    <div className={rootClass}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold">Historial de Movimientos (Kárdex)</h4>
        <div className="flex items-center gap-2">
          {onClose && <button className="text-sm px-3 py-1 rounded border" onClick={onClose}>Cerrar</button>}
        </div>
      </div>
      {loading && <div className="text-sm text-gray-500">Cargando movimientos...</div>}
      {error && <div className="text-sm text-red-600">Error: {error}</div>}
      {!loading && !error && (
        <div className="max-h-[52vh] md:max-h-[56vh] overflow-y-auto">
          <table className="w-full text-sm table-auto min-w-full">
            <thead className="text-left text-xs text-gray-500">
              <tr>
                <th className="px-2 py-2">#</th>
                <th className="px-2 py-2">Fecha</th>
                <th className="px-2 py-2">Tipo</th>
                <th className="px-2 py-2">Referencia</th>
                <th className="px-2 py-2 text-right">Entrada</th>
                <th className="px-2 py-2 text-right">Salida</th>
                <th className="px-2 py-2 text-right">Saldo</th>
                <th className="px-2 py-2 text-right">Costo Unit.</th>
                <th className="px-2 py-2 text-right">Valor Total</th>
                <th className="px-2 py-2">Usuario</th>
                <th className="px-2 py-2">Descripción</th>
                <th className="px-2 py-2">Vencimiento Lote</th>
                <th className="px-2 py-2">Ubicación Lote</th>
                <th className="px-2 py-2">Presentación</th>
              </tr>
            </thead>
            <tbody>
              {rowsWithSaldo.map((r, index) => (
                <tr key={`mov-${index}`} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}>
                  <td className="px-3 py-3 text-gray-600 font-medium">{index + 1}</td>
                  <td className="px-3 py-3 text-gray-800">{r.fecha ? new Date(r.fecha).toLocaleString('es-ES', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : '-'}</td>
                  <td className="px-3 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      r.tipo_movimiento?.includes('entrada') ? 'bg-green-100 text-green-800' :
                      r.tipo_movimiento?.includes('salida') ? 'bg-red-100 text-red-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {r.tipo_movimiento || '-'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-gray-700 font-medium">{r.referencia || '-'}</td>
                  <td className="px-3 py-3 text-right text-green-600 font-medium">{r.entrada ? `+${r.entrada}` : '-'}</td>
                  <td className="px-3 py-3 text-right text-red-600 font-medium">{r.salida ? `-${r.salida}` : '-'}</td>
                  <td className="px-3 py-3 text-right font-bold text-gray-800">{r.saldo ?? '-'}</td>
                  <td className="px-3 py-3 text-right text-gray-600">Q {r.costo_unitario?.toFixed(2) ?? '-'}</td>
                  <td className="px-3 py-3 text-right font-medium text-gray-800">Q {r.valor_total?.toFixed(2) ?? '-'}</td>
                  <td className="px-3 py-3 text-gray-700">{r.usuario || '-'}</td>
                  <td className="px-3 py-3 text-gray-600 max-w-xs truncate" title={r.descripcion || undefined}>{r.descripcion || '-'}</td>
                  <td className="px-3 py-3 text-gray-600">{r.lote_fecha_vencimiento ? new Date(r.lote_fecha_vencimiento).toLocaleDateString('es-ES') : '-'}</td>
                  <td className="px-3 py-3 text-gray-600">{r.lote_ubicacion || '-'}</td>
                  <td className="px-3 py-3 text-gray-600 max-w-xs truncate" title={r.presentacion_descripcion || undefined}>{r.presentacion_descripcion || '-'}</td>
                </tr>
              ))}
              {rowsWithSaldo.length === 0 && (
                <tr>
                  <td colSpan={14} className="px-3 py-8 text-sm text-gray-500 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-gray-400 text-lg">📊</span>
                      No hay movimientos registrados para este período.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
