// src/features/Dashboard/Ventas/Ventas/CierreCaja.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { FaMoneyBillWave, FaMoneyCheckAlt, FaBoxOpen, FaUser, FaHashtag, FaUniversity, FaCheck, FaClock, FaTimes, FaFilePdf } from "react-icons/fa";
import { MdPointOfSale, MdPrint } from "react-icons/md";
import { cajaService, type CajaSesion } from "../../../../api/cajaService";
import { ventasService, type Venta, type VentaTransferencia } from "../../../../api/ventasService";
import { useAuth } from "../../../../hooks/useAuth";
import html2pdf from 'html2pdf.js';

/* ================= Paleta ================= */
const primary = "#00B074";
const yellow = "#FFD40D";

/* ================= Helpers ================= */
const currency = (q: number | undefined | null) =>
  (q ?? 0).toLocaleString("es-GT", {
    style: "currency",
    currency: "GTQ",
    minimumFractionDigits: 2,
  });
const toCents = (n: number | undefined | null) => Math.round((n ?? 0) * 100);
const fromCents = (c: number | undefined | null) => (c ?? 0) / 100;

/* ================= Tipos compartidos ================= */

/* Denominaciones GTQ */
const DENOMS = [100, 50, 20, 10, 5, 1, 0.5, 0.25] as const;

/* ========== Tarjetas KPI ========== */
function SalesCard({
  total,
  count,
  avg,
}: {
  total: number;
  count: number;
  avg: number;
}) {
  return (
    <div className="relative rounded-xl p-6 lg:p-7 bg-gradient-to-br from-white to-gray-50 border border-gray-100 shadow-sm">
      <div className="absolute right-3 top-3 w-16 h-16 rounded-full bg-lime-100/60" />
      <div className="absolute right-5 top-5 w-12 h-12 rounded-xl flex items-center justify-center ring-1 ring-black/5 shadow-sm bg-lime-300/70">
        <FaBoxOpen size={20} className="text-gray-800" />
      </div>
      <h4 className="text-sm font-semibold text-gray-700 tracking-wide">
        VENTAS DEL DÍA
      </h4>
      <div className="mt-2 grid grid-cols-[1fr_auto] gap-x-6 pt-7">
        <div className="text-gray-500">Total de ventas:</div>
        <div className="text-right font-semibold tabular-nums text-gray-800">
          {currency(total)}
        </div>
        <div className="text-gray-500">Número de ventas:</div>
        <div className="text-right font-semibold tabular-nums text-gray-800">
          {count}
        </div>
        <div className="text-gray-500">Promedio por venta:</div>
        <div className="text-right font-semibold tabular-nums text-gray-800">
          {currency(avg)}
        </div>
      </div>
    </div>
  );
}

function PaymentsCard({
  efectivo,
  banco,
}: {
  efectivo: number;
  banco: number;
}) {
  return (
    <div className="relative rounded-xl p-6 lg:p-7 bg-gradient-to-br from-white to-gray-50 border border-gray-100 shadow-sm">
      <div className="absolute right-3 top-3 w-16 h-16 rounded-full bg-emerald-100/60" />
      <div className="absolute right-5 top-5 w-12 h-12 rounded-xl flex items-center justify-center ring-1 ring-black/5 shadow-sm bg-emerald-200">
        <MdPointOfSale size={22} className="text-emerald-900" />
      </div>
      <h4 className="text-sm font-semibold text-gray-700 tracking-wide">
        PAGOS DEL DÍA
      </h4>
      <div className="mt-2 grid grid-cols-[1fr_auto] gap-x-6 pt-7">
        <div className="text-gray-500">Efectivo contado</div>
        <div className="text-right font-semibold tabular-nums text-emerald-700">
          {currency(efectivo)}
        </div>
        <div className="text-gray-500">Banco (Transferencias)</div>
        <div className="text-right font-semibold tabular-nums text-teal-700">
          {currency(banco)}
        </div>
      </div>
    </div>
  );
}

/* =============================== Página ============================== */
const CierreCaja: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const formRef = useRef<HTMLDivElement | null>(null);
  const { user } = useAuth();

  const [sesionCaja, setSesionCaja] = useState<CajaSesion | null>(null);

  const [guardChecking, setGuardChecking] = useState(true);
  const [mustOpen, setMustOpen] = useState(false);
  const [aperturaMonto, setAperturaMonto] = useState<string>("");
  const [aperturaLoading, setAperturaLoading] = useState(false);
  const [aperturaError, setAperturaError] = useState<string | null>(null);
  const [guardReason, setGuardReason] = useState<string | null>(null);
  const [cerrando, setCerrando] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [modalOk, setModalOk] = useState<string | null>(null);
  const [showAutoCloseModal, setShowAutoCloseModal] = useState(false);

  const [transferencias, setTransferencias] = useState<VentaTransferencia[]>([]);
  const [loadingTransferencias, setLoadingTransferencias] = useState(false);
  const [previousDayTotales, setPreviousDayTotales] = useState({ efectivo: 0, transferencia: 0, tarjeta: 0, total: 0, count: 0 });
  const [previousDayTransferencias, setPreviousDayTransferencias] = useState<VentaTransferencia[]>([]);
  const [loadingPreviousDay, setLoadingPreviousDay] = useState(false);
  const [previousDayFecha, setPreviousDayFecha] = useState<string>('');

  useEffect(() => {
    const state = location.state as { requireOpenCaja?: boolean; reason?: string } | undefined;
    if (!state) {
      return;
    }

    setAperturaError(null);

    if (state.requireOpenCaja) {
      setMustOpen(true);
      setGuardReason(state.reason ?? null);
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (state.reason) {
      setGuardReason(state.reason);
    }

    navigate(location.pathname, { replace: true, state: undefined });
  }, [location, navigate]);

  const cajero = user?.nombre || "—";
  const fechaAperturaISO = sesionCaja?.fecha_apertura ?? null;
  const fechaApertura = fechaAperturaISO
    ? new Intl.DateTimeFormat("es-GT", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(new Date(fechaAperturaISO))
    : "—";
  const montoInicial = sesionCaja?.monto_inicial ?? 0;

  const makeEmptyArqueo = useCallback(
    () => Object.fromEntries(DENOMS.map((d) => [d.toString(), 0])) as Record<string, number>,
    []
  );

  const [ventasTotales, setVentasTotales] = useState<number>(0);
  const [ventasCount, setVentasCount] = useState<number>(0);
  const [ventasEfectivo, setVentasEfectivo] = useState<number>(0);
  const ventasProm = useMemo(
    () => (ventasCount > 0 ? fromCents(Math.round((ventasTotales / ventasCount) * 100)) : 0),
    [ventasTotales, ventasCount]
  );

  const [efectivoContado, setEfectivoContado] = useState<number>(0);
  const [transferVerificada, setTransferVerificada] = useState<number>(0);
  const [transferEsperada, setTransferEsperada] = useState<number>(0);
  const [reporteVisible, setReporteVisible] = useState<boolean>(false);

  const [totalSistema, setTotalSistema] = useState<number>(0);
  const [observacionesArqueo, setObservacionesArqueo] = useState<string>("");

  const [showArqueo, setShowArqueo] = useState<boolean>(false);
  const [arqueo, setArqueo] = useState<Record<string, number>>(() => makeEmptyArqueo());
  const [arqueoAplicado, setArqueoAplicado] = useState<boolean>(false);
  const totalArqueoCents = useMemo(
    () => DENOMS.reduce((acc, d) => acc + Math.round(d * 100) * (arqueo[d.toString()] || 0), 0),
    [arqueo]
  );
  const totalArqueo = totalArqueoCents / 100;
  const limpiarArqueo = () => setArqueo(makeEmptyArqueo());
  const aplicarArqueo = () => {
    setEfectivoContado(totalArqueo);
    setArqueoAplicado(true);
    setShowArqueo(false);
  };

  const [showTfDrawer, setShowTfDrawer] = useState<boolean>(false);

  const resetFormulario = useCallback(() => {
    setEfectivoContado(0);
    setTransferVerificada(0);
    setTransferEsperada(0);
    setArqueo(makeEmptyArqueo());
    setArqueoAplicado(false);
    setTotalSistema(0);
    setObservacionesArqueo("");
    setReporteVisible(false);
  }, [makeEmptyArqueo]);

  const efectivoEsperadoCalc = useMemo(() => {
    const cents = toCents(ventasEfectivo) + toCents(montoInicial);
    return fromCents(Math.max(0, cents));
  }, [ventasEfectivo, montoInicial]);

  useEffect(() => {
    setTotalSistema(efectivoEsperadoCalc);
  }, [efectivoEsperadoCalc]);

  const diferencia = useMemo(
    () => efectivoContado - efectivoEsperadoCalc + (transferVerificada - 0),
    [efectivoContado, efectivoEsperadoCalc, transferVerificada]
  );

  const todasTransferenciasVerificadas = useMemo(
    () => transferencias.length === 0 || transferencias.every(t => t.estado_transferencia === 'recibido'),
    [transferencias]
  );

  const registroCompleto =
    efectivoContado >= 0 &&
    transferVerificada >= 0 &&
    sesionCaja !== null &&
    arqueoAplicado &&
    todasTransferenciasVerificadas;

  const abrirReporte = () => setReporteVisible(true);

  const refreshEstado = useCallback(async () => {
    setGuardChecking(true);
    try {
      const estado = await cajaService.getEstado();
      if (estado.abierta && estado.sesion) {
        setSesionCaja(estado.sesion);
        setMustOpen(false);
        setGuardReason(null);
      } else {
        setSesionCaja(null);
        setMustOpen(true);
      }
    } catch (error) {
      console.error("Error verificando estado de caja:", error);
      setSesionCaja(null);
      setMustOpen(true);
    } finally {
      setGuardChecking(false);
    }
  }, []);

  const loadPreviousDayData = useCallback(async () => {
    setLoadingPreviousDay(true);
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      setPreviousDayFecha(yesterdayStr);
      const fechaInicio = yesterdayStr + ' 00:00:00';
      const fechaFin = yesterdayStr + ' 23:59:59';

      // Cargar ventas del día anterior
      const ventas = await ventasService.getVentas('confirmada', fechaInicio, fechaFin);

      // Calcular totales
      let efectivo = 0;
      let transferencia = 0;
      let tarjeta = 0;
      let total = 0;
      let count = 0;

      ventas.forEach((venta: Venta) => {
        total += venta.total_venta || 0;
        count++;
        if (venta.tipo_pago === 'Cash') {
          efectivo += venta.total_venta || 0;
        } else if (venta.tipo_pago === 'Transferencia') {
          transferencia += venta.total_venta || 0;
        } else if (venta.tipo_pago === 'Tarjeta') {
          tarjeta += venta.total_venta || 0;
        }
      });

      setPreviousDayTotales({ efectivo, transferencia, tarjeta, total, count });

      // Cargar transferencias del día anterior (filtrar de ventas)
      const transferencias = ventas.filter((venta: Venta) => venta.tipo_pago === 'Transferencia');
      setPreviousDayTransferencias(transferencias);
    } catch (error) {
      console.error("Error cargando datos del día anterior:", error);
      setPreviousDayTotales({ efectivo: 0, transferencia: 0, tarjeta: 0, total: 0, count: 0 });
      setPreviousDayTransferencias([]);
      setPreviousDayFecha('');
    } finally {
      setLoadingPreviousDay(false);
    }
  }, []);

  useEffect(() => {
    void refreshEstado();
  }, [refreshEstado]);

  useEffect(() => {
    if (sesionCaja?.fecha_apertura) {
      const loadVentasSesion = async () => {
        try {
          const result = await ventasService.getTotalVentasSesion(sesionCaja.fecha_apertura);
          setVentasTotales(result.total);
          setVentasCount(result.count);
          setVentasEfectivo(result.efectivo);

          // Calcular valores automáticamente
          setEfectivoContado(0); // Inicia en 0, el cajero lo cuenta manualmente
          setTransferVerificada(0); // Inicia en 0, se incrementa cuando se marcan como recibidas
          setTransferEsperada(result.transferencia); // Monto esperado de transferencias

          // Cargar transferencias de la sesión
          setLoadingTransferencias(true);
          if (sesionCaja.fecha_apertura) {
            const transferenciasData = await ventasService.getTransferenciasSesion(sesionCaja.fecha_apertura);
            setTransferencias(transferenciasData);

            // Calcular transferencias ya verificadas (marcadas como 'recibido')
            const transferenciasYaVerificadas = transferenciasData.filter(t => t.estado_transferencia === 'recibido');
            const totalYaVerificado = transferenciasYaVerificadas.reduce((sum, t) => sum + (t.total_venta || 0), 0);
            setTransferVerificada(totalYaVerificado);
          } else {
            setTransferencias([]);
          }
        } catch (error) {
          console.error("Error cargando ventas de sesión:", error);
          setVentasTotales(0);
          setVentasCount(0);
          setVentasEfectivo(0);
          setEfectivoContado(0);
          setTransferVerificada(0);
          setTransferEsperada(0);
          setTransferencias([]);
        } finally {
          setLoadingTransferencias(false);
        }
      };
      void loadVentasSesion();
    }
  }, [sesionCaja?.fecha_apertura]);

  const handleIniciarCaja = async () => {
    setAperturaError(null);
    const val = Number(String(aperturaMonto).replace(",", "."));
    if (!Number.isFinite(val) || val < 0) {
      setAperturaError("Ingresa un monto valido (mayor o igual a 0).");
      return;
    }
    setAperturaLoading(true);
    try {
      const nuevaSesion = await cajaService.abrirCaja(val);
      setSesionCaja(nuevaSesion);
      setMustOpen(false);
  setGuardReason(null);
      setAperturaMonto("");
      setToast(`Caja abierta con ${currency(nuevaSesion.monto_inicial)}`);
      setTimeout(() => setToast(null), 3000);
    } catch (error) {
      console.error("Error al abrir caja:", error);
      const mensaje = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
      setAperturaError(mensaje ?? "No se pudo abrir la caja.");
    } finally {
      setAperturaLoading(false);
    }
  };

  const resetSesionCaja = useCallback(async () => {
    try {
      await cajaService.cerrarCaja();
    } catch (error) {
      console.warn("No se pudo cerrar la caja de manera forzada:", error);
    } finally {
      resetFormulario();
      setAperturaMonto("");
      setSesionCaja(null);
      setMustOpen(true);
      await refreshEstado();
      setToast("Sesion de caja reiniciada.");
      setTimeout(() => setToast(null), 2500);
    }
  }, [refreshEstado, resetFormulario]);

  const cerrarCaja = async () => {
    if (cerrando) {
      return;
    }
    if (!registroCompleto) {
      setToast("Completa el registro antes de cerrar la caja. Asegúrate de contar los billetes y verificar todas las transferencias.");
      setTimeout(() => setToast(null), 2200);
      return;
    }
    if (diferencia !== 0 && observacionesArqueo.trim() === "") {
      setToast("Si hay diferencias en el cierre, es obligatorio rellenar las observaciones.");
      setTimeout(() => setToast(null), 2200);
      return;
    }
    setCerrando(true);
    try {
      await cajaService.cerrarCaja({
        monto_cierre: efectivoContado,
        observaciones: observacionesArqueo.trim() || undefined,
      });
      resetFormulario();
      setSesionCaja(null);
      setMustOpen(true);
      setShowAutoCloseModal(true); // Mostrar modal de auto-close
      await loadPreviousDayData();
      await refreshEstado();
    } catch (error) {
      console.error("Error al cerrar la caja:", error);
      const mensaje = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
      setToast(mensaje ?? "Error al cerrar la caja.");
      setTimeout(() => setToast(null), 2200);
    } finally {
      setCerrando(false);
    }
  };

  const handleUpdateEstadoTransferencia = async (idVenta: number, estado: 'esperando' | 'recibido') => {
    try {
      await ventasService.updateEstadoTransferencia(idVenta, { estado });

      // Actualizar el estado local y recalcular transferencias verificadas
      setTransferencias(prev => {
        const updatedTransferencias = prev.map(t =>
          t.id_venta === idVenta
            ? { ...t, estado_transferencia: estado }
            : t
        );

        // Recalcular transferencias verificadas usando el array actualizado
        const transferenciasRecibidas = updatedTransferencias.filter(t => t.estado_transferencia === 'recibido');
        const totalVerificado = transferenciasRecibidas.reduce((sum, t) => sum + (t.total_venta || 0), 0);
        setTransferVerificada(totalVerificado);

        return updatedTransferencias;
      });

    } catch (error) {
      console.error('Error al actualizar estado de transferencia:', error);
      throw error; // Para que el componente lo maneje
    }
  };

  const handleUpdateTransferencia = async (idVenta: number, referencia: string, banco: string) => {
    try {
      await ventasService.updateEstadoTransferencia(idVenta, { numero_referencia: referencia, nombre_banco: banco });

      // Actualizar el estado local
      setTransferencias(prev => prev.map(t =>
        t.id_venta === idVenta
          ? {
              ...t,
              deposito_banco: {
                ...t.deposito_banco,
                numero_referencia: referencia,
                nombre_banco: banco
              }
            }
          : t
      ));

    } catch (error) {
      console.error('Error al actualizar detalles de transferencia:', error);
      throw error; // Para que el componente lo maneje
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="w-full max-w-[1200px] mx-auto">
        {/* Header */}
        <header className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Arqueo y Cierre Diario</h2>
              <p className="text-sm text-gray-500 mt-1">
                Cerrando la sesión iniciada el: <b>{fechaApertura}</b> por <b>{cajero}</b>
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!sesionCaja && (
                <button
                  onClick={resetSesionCaja}
                  className="px-3 py-2 rounded-md border bg-white hover:bg-gray-50 text-sm"
                >
                  Forzar Apertura
                </button>
              )}
              <button onClick={() => navigate("/ventas")} className="px-3 py-2 rounded-md border bg-white hover:bg-gray-50">
                ← Regresar
              </button>
            </div>
          </div>
        </header>

        {/* KPI superior */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <SalesCard total={ventasTotales} count={ventasCount} avg={ventasProm} />
          <PaymentsCard
            efectivo={efectivoContado}
            banco={transferVerificada}
          />
        </div>

        {/* ===== REGISTRO DE CIERRE ===== */}
        <motion.div
          ref={formRef}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="rounded-xl p-6 bg-gradient-to-br from-white to-gray-50 border border-gray-100 shadow-sm mb-6"
        >
          <h2 className="text-lg font-bold text-gray-800 mb-4">REGISTRO DE CIERRE</h2>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Efectivo Contado (con columna "esperado") */}
            <div>
              <div className="grid grid-cols-2 gap-2 mb-1">
                <label className="block text-sm text-gray-600">Efectivo Contado</label>
                <label className="block text-sm text-gray-600 text-right">(esperado)</label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={efectivoContado}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setEfectivoContado(parseFloat(e.target.value) || 0)
                  }
                  readOnly={!arqueoAplicado}
                  className={`w-full border rounded-lg px-3 h-11 ${!arqueoAplicado ? 'bg-gray-50 text-gray-500' : ''}`}
                />
                <input
                  type="number"
                  step="0.01"
                  value={efectivoEsperadoCalc}
                  readOnly
                  className="w-full border rounded-lg px-3 h-11 bg-blue-50 text-blue-700"
                />

                <button
                  type="button"
                  title="Arqueo de caja (billetes)"
                  aria-label="Arqueo de caja (billetes)"
                  onClick={() => setShowArqueo(true)}
                  className="h-11 px-3 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex items-center gap-2 col-span-2"
                >
                  <FaMoneyBillWave size={18} />
                  <span className="text-sm font-medium">Billetes</span>
                </button>
                {!arqueoAplicado && (
                  <p className="text-xs text-amber-600 col-span-2">Usa el botón "Billetes" para contar el efectivo antes de cerrar la caja.</p>
                )}
              </div>
            </div>

            {/* Transferencias verificadas + Drawer por banco */}
            <div>
              <div className="grid grid-cols-2 gap-2 mb-1">
                <label className="block text-sm text-gray-600">Transferencias Verificadas (monto)</label>
                <label className="block text-sm text-gray-600 text-right">(esperado)</label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={transferVerificada}
                  readOnly
                  className="w-full border rounded-lg px-3 h-11 bg-gray-50 text-gray-700"
                />
                <input
                  type="number"
                  step="0.01"
                  value={transferEsperada}
                  readOnly
                  className="w-full border rounded-lg px-3 h-11 bg-blue-50 text-blue-700"
                />
                <button
                  type="button"
                  title="Verificar transferencias por banco"
                  aria-label="Verificar transferencias por banco"
                  onClick={() => setShowTfDrawer(true)}
                  className="h-11 px-3 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex items-center gap-2 col-span-2"
                >
                  <FaMoneyCheckAlt size={18} />
                  <span className="text-sm font-medium">Verificar Transferencias</span>
                </button>
                {!todasTransferenciasVerificadas && transferencias.length > 0 && (
                  <p className="text-xs text-amber-600 col-span-2">Verifica todas las transferencias antes de cerrar la caja.</p>
                )}
              </div>
            </div>
          </div>



          {/* Campos adicionales para arqueo_caja */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Detalles del Arqueo</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Total Sistema (esperado)</label>
                <input
                  type="number"
                  step="0.01"
                  value={totalSistema}
                  onChange={(e) => setTotalSistema(parseFloat(e.target.value) || 0)}
                  className="w-full border rounded-lg px-3 h-11"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm text-gray-600 mb-1">Observaciones</label>
              <textarea
                value={observacionesArqueo}
                onChange={(e) => setObservacionesArqueo(e.target.value)}
                placeholder="Notas adicionales del arqueo..."
                className="w-full border rounded-lg px-3 py-2 h-20 resize-none"
              />
            </div>
          </div>

          {/* Diferencias */}
          <div className="mt-6">
            <label className="block text-sm text-gray-600 mb-1">Diferencias</label>
            <input
              value={diferencia.toFixed(2)}
              readOnly
              className={`w-full border rounded-lg px-3 h-11 ${
                diferencia === 0 ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
              }`}
            />
          </div>
        </motion.div>

        {/* ===== Resumen del Sistema ===== */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="rounded-xl p-6 bg-gradient-to-br from-white to-gray-50 border border-gray-100 shadow-sm"
        >
          <h3 className="text-lg font-bold text-gray-800 mb-4">Resumen del Sistema</h3>

          {!registroCompleto ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3">
              Completa el registro de cierre para visualizar el resumen.
            </div>
          ) : (
            <div className="rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-4 py-3 text-left">Etiqueta</th>
                    <th className="px-4 py-3 text-right">Valor (Calculado)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t">
                    <td className="px-4 py-3 text-gray-700">Ventas Totales (Todos los métodos)</td>
                    <td className="px-4 py-3 text-right font-semibold">{currency(ventasTotales)}</td>
                  </tr>
                  <tr className="border-t">
                    <td className="px-4 py-3 text-gray-700">(-) Total Pagos con Transferencia</td>
                    <td className="px-4 py-3 text-right">{currency(transferVerificada)}</td>
                  </tr>
                  <tr className="border-t bg-gray-50">
                    <td className="px-4 py-3 font-semibold">(=) Total Ventas en Efectivo</td>
                    <td className="px-4 py-3 text-right font-semibold">{currency(efectivoContado)}</td>
                  </tr>
                  <tr className="border-t">
                    <td className="px-4 py-3 text-gray-700">(+) Monto Inicial</td>
                    <td className="px-4 py-3 text-right">{currency(montoInicial)}</td>
                  </tr>
                  <tr className="border-t bg-emerald-50">
                    <td className="px-4 py-3 font-bold text-emerald-800">(=) EFECTIVO ESPERADO EN CAJA</td>
                    <td className="px-4 py-3 text-right font-extrabold text-emerald-800">
                      {currency(efectivoEsperadoCalc)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </motion.div>

        {/* ===== Botones finales ===== */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:justify-end">
          <button
            onClick={abrirReporte}
            disabled={!registroCompleto}
            className={`h-11 px-5 rounded-md font-semibold text-white ${
              !registroCompleto ? "opacity-50 cursor-not-allowed" : ""
            }`}
            style={{ background: yellow }}
          >
            Generar Reporte
          </button>
          <button
            onClick={cerrarCaja}
            disabled={!registroCompleto || cerrando}
            className={`h-11 px-5 rounded-md font-semibold text-white flex items-center justify-center gap-2 ${
              !registroCompleto || cerrando ? "opacity-50 cursor-not-allowed" : ""
            }`}
            style={{ background: primary }}
          >
            {cerrando && (
              <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            )}
            Cerrar Caja
          </button>
        </div>

        {/* ===== Drawer: Arqueo (Billetes) ===== */}
        <ArqueoDrawer
          open={showArqueo}
          onClose={() => setShowArqueo(false)}
          arqueo={arqueo}
          setArqueo={setArqueo}
          totalArqueo={totalArqueo}
          onClear={limpiarArqueo}
          onApply={aplicarArqueo}
        />

        {/* ===== Drawer: Transferencias por banco ===== */}
        <TransferDrawer
          open={showTfDrawer}
          onClose={() => setShowTfDrawer(false)}
          transferencias={transferencias}
          loadingTransferencias={loadingTransferencias}
          onUpdateEstado={handleUpdateEstadoTransferencia}
          onUpdateTransferencia={handleUpdateTransferencia}
        />

        {/* ===== Modal de Reporte (optimizado PDF) ===== */}
        <ReportModal
          open={reporteVisible}
          onClose={() => setReporteVisible(false)}
          ventasTotales={ventasTotales}
          transferTotal={transferVerificada}
          montoInicial={montoInicial}
          esperado={efectivoEsperadoCalc}
          contado={efectivoContado}
          diferencia={diferencia}
          transferencias={transferencias}
          cajero={cajero}
          fechaApertura={fechaApertura}
          ventasEfectivo={ventasEfectivo}
        />
      </div>

      {/* ===== Modal Guardián: Apertura de Caja ===== */}
      <AnimatePresence>
        {(mustOpen || guardChecking) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" />
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="relative bg-white w-full max-w-md rounded-2xl shadow-xl p-6"
            >
              <h3 className="text-xl font-bold text-gray-800">Apertura de Caja</h3>
              <p className="text-sm text-gray-500 mt-1">
                Por favor, ingresa el fondo de caja inicial para activar las ventas del d??a.
              </p>

              {guardReason && (
                <div className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-md">
                  {guardReason}
                </div>
              )}

              {guardChecking ? (
                <div className="flex items-center justify-center py-10">
                  <svg className="animate-spin w-6 h-6 text-gray-400" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                </div>
              ) : (
                <>
                  <div className="mt-4">
                    <label className="block text-sm text-gray-600 mb-1">Monto Inicial (Efectivo)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Q 0.00"
                      value={aperturaMonto}
                      onChange={(e) => setAperturaMonto(e.target.value)}
                      className="w-full border rounded-lg px-3 h-11"
                    />
                  </div>

                  {aperturaError && (
                    <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-md">
                      {aperturaError}
                    </div>
                  )}

                  <div className="mt-6 flex justify-end gap-2">
                    <button
                      onClick={() => navigate('/ventas')}
                      className="px-5 h-11 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors"
                    >
                      Cerrar
                    </button>
                    <button
                      disabled={aperturaLoading}
                      onClick={handleIniciarCaja}
                      className="px-5 h-11 rounded-md text-white flex items-center justify-center gap-2"
                      style={{ background: primary }}
                    >
                      {aperturaLoading && (
                        <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                      )}
                      Iniciar Caja
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== Modal de Auto-Close Caja ===== */}
      <AnimatePresence>
        {showAutoCloseModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" />
            <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }} className="relative bg-white w-full max-w-4xl rounded-2xl shadow-xl p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Caja Cerrada</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Ventas Totales:</span>
                  <span className="font-semibold">{currency(ventasTotales)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Efectivo Contado:</span>
                  <span className="font-semibold">{currency(efectivoContado)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Transferencias Verificadas:</span>
                  <span className="font-semibold">{currency(transferVerificada)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Monto Inicial:</span>
                  <span className="font-semibold">{currency(montoInicial)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-bold text-gray-800">
                  <span>Efectivo Esperado:</span>
                  <span>{currency(efectivoEsperadoCalc)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Diferencia:</span>
                  <span className={`font-semibold ${diferencia === 0 ? 'text-green-600' : 'text-amber-600'}`}>
                    {currency(diferencia)}
                  </span>
                </div>
              </div>

              {/* Reporte del día anterior */}
              <div className="mt-6 border-t pt-4">
                <h4 className="text-lg font-bold text-gray-800 mb-4">Reporte del Día Anterior</h4>
                {loadingPreviousDay ? (
                  <div className="flex justify-center py-8">
                    <svg className="animate-spin w-6 h-6 text-gray-600" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                  </div>
                ) : (
                  <PrintableSheet
                    titulo="Reporte del Día Anterior"
                    ventasTotales={previousDayTotales.total}
                    transferTotal={previousDayTotales.transferencia}
                    montoInicial={0} // No aplica para día anterior
                    esperado={previousDayTotales.total} // Simplificar
                    contado={previousDayTotales.efectivo}
                    diferencia={0} // No aplica
                    transferencias={previousDayTransferencias}
                    cajero={cajero}
                    fechaApertura={previousDayFecha ? `${previousDayFecha} 00:00:00` : ''}
                    fechaCierre={previousDayFecha ? `${previousDayFecha} 23:59:59` : ''}
                    ventasEfectivo={previousDayTotales.efectivo}
                  />
                )}
              </div>
              <div className="mt-6 flex justify-end">
                <button 
                  onClick={() => setShowAutoCloseModal(false)} 
                  className="px-6 h-11 rounded-md text-white font-semibold"
                  style={{ background: primary }}
                >
                  Enterado
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal OK al cerrar caja */}
      <AnimatePresence>
        {modalOk && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" />
            <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }} className="relative bg-white w-full max-w-md rounded-2xl shadow-xl p-6">
              <h3 className="text-lg font-bold text-gray-800">Cierre de Caja</h3>
              <p className="text-sm text-gray-600 mt-2">{modalOk}</p>
              <div className="mt-6 flex justify-end">
                <button onClick={() => setModalOk(null)} className="px-4 h-10 rounded-md text-white" style={{ background: primary }}>
                  Entendido
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="fixed bottom-4 right-4 z-[70] bg-white border border-emerald-200 text-emerald-700 rounded-lg px-4 py-2 shadow-lg"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ===================== Subcomponentes auxiliares ===================== */

function ArqueoDrawer({
  open,
  onClose,
  arqueo,
  setArqueo,
  totalArqueo,
  onClear,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  arqueo: Record<string, number>;
  setArqueo: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  totalArqueo: number;
  onClear: () => void;
  onApply: () => void;
}): JSX.Element {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black z-40"
            onClick={onClose}
          />
          <motion.aside
            key="drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 h-full w-full max-w-[520px] bg-white shadow-2xl z-50 flex flex-col"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Arqueo de caja</h3>
                <p className="text-xs text-gray-500">Ingresa la cantidad de billetes/monedas por cantidad (Q)</p>
              </div>
              <button onClick={onClose} className="px-3 py-1 rounded-md border bg-gray-50 hover:bg-gray-100 text-sm">
                X
              </button>
            </div>

            <div className="p-5 overflow-auto">
              <div className="rounded-xl border border-gray-200 shadow-sm">
                <div className="px-4 py-3 border-b">
                  <h4 className="font-semibold text-gray-800">Detalle de efectivo</h4>
                </div>
                <div>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-4 py-2 text-left">Monto</th>
                        <th className="px-4 py-2 text-right">Cant</th>
                        <th className="px-4 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {DENOMS.map((d: number) => {
                        const key = d.toString();
                        const count = arqueo[key] || 0;
                        const rowTotal = (Math.round(d * 100) * count) / 100;
                        return (
                          <tr key={key} className="even:bg-gray-50/60 hover:bg-gray-50">
                            <td className="px-4 py-2">Q {d.toFixed(2).replace(/\.00$/, "")}</td>
                            <td className="px-4 py-2 text-right">
                              <input
                                type="number"
                                min={0}
                                step={1}
                                value={count}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                  const v = Math.max(0, Math.floor(Number(e.target.value) || 0));
                                  setArqueo((prev) => ({ ...prev, [key]: v }));
                                }}
                                className="w-24 h-9 border border-gray-300 rounded-md px-2 text-right bg-white focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300"
                              />
                            </td>
                            <td className="px-4 py-2 text-right font-medium">{currency(rowTotal)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t">
                        <td className="px-4 py-2 font-semibold">Total contado</td>
                        <td />
                        <td className="px-4 py-2 text-right font-bold">{currency(totalArqueo)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            <div className="mt-auto px-5 py-4 border-t bg-gray-50 flex items-center justify-between">
              <button onClick={onClear} className="px-3 py-2 rounded-md border hover:bg-gray-100 text-sm">
                Limpiar
              </button>
              <div className="flex gap-2">
                <button onClick={onClose} className="px-4 py-2 rounded-md border bg-white hover:bg-gray-100">
                  Cancelar
                </button>
                <button onClick={onApply} className="px-4 py-2 rounded-md text-white" style={{ background: primary }}>
                  Usar este total
                </button>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function TransferDrawer({
  open,
  onClose,
  transferencias,
  loadingTransferencias,
  onUpdateEstado,
  onUpdateTransferencia,
}: {
  open: boolean;
  onClose: () => void;
  transferencias: Venta[]; // Ventas con tipo_pago = 'Transferencia'
  loadingTransferencias: boolean;
  onUpdateEstado: (idVenta: number, estado: 'esperando' | 'recibido') => Promise<void>;
  onUpdateTransferencia: (idVenta: number, referencia: string, banco: string) => Promise<void>;
}): JSX.Element {
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editReferencia, setEditReferencia] = useState('');
  const [editBanco, setEditBanco] = useState('');

  const handleUpdateEstado = async (idVenta: number, estado: 'esperando' | 'recibido') => {
    setUpdatingId(idVenta);
    try {
      await onUpdateEstado(idVenta, estado);
    } catch (error) {
      console.error('Error al actualizar estado de transferencia:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleEditTransferencia = (venta: VentaTransferencia) => {
    setEditingId(venta.id_venta);
    setEditReferencia(venta.deposito_banco?.numero_referencia || '');
    setEditBanco(venta.deposito_banco?.nombre_banco || '');
  };

  const handleSaveTransferencia = async () => {
    if (editingId === null) return;
    setUpdatingId(editingId);
    try {
      await onUpdateTransferencia(editingId, editReferencia, editBanco);
      setEditingId(null);
    } catch (error) {
      console.error('Error al actualizar transferencia:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditReferencia('');
    setEditBanco('');
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="overlay2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black z-40"
            onClick={onClose}
          />
          <motion.aside
            key="drawer2"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 h-full w-full max-w-[700px] bg-white shadow-2xl z-50 flex flex-col"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Transferencias de Ventas</h3>
                <p className="text-xs text-gray-500">Verifica el estado de las transferencias realizadas en ventas.</p>
              </div>
              <button onClick={onClose} className="px-3 py-1 rounded-md border bg-gray-50 hover:bg-gray-100 text-sm">
                ✕
              </button>
            </div>

            <div className="p-5 overflow-auto flex-1">
              {loadingTransferencias ? (
                <div className="flex items-center justify-center py-10">
                  <svg className="animate-spin w-6 h-6 text-gray-400" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  <span className="ml-2 text-gray-500">Cargando transferencias...</span>
                </div>
              ) : transferencias.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  No hay transferencias en esta sesión.
                </div>
              ) : (
                <div className="space-y-3">
                  {transferencias.map((venta: VentaTransferencia) => (
                    <div key={venta.id_venta} className="rounded-xl border border-gray-200 shadow-sm p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="font-semibold text-gray-800">Venta #{venta.id_venta}</div>
                          <div className="text-sm text-gray-500">
                            {new Date(venta.fecha_venta).toLocaleString('es-GT', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-lg">{currency(venta.total_venta)}</div>
                          <div className={`text-sm px-2 py-1 rounded-full ${
                            venta.estado_transferencia === 'recibido'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {venta.estado_transferencia === 'recibido' ? 'Recibido' : 'Esperando'}
                          </div>
                        </div>
                      </div>

                      {/* Detalles adicionales con iconos */}
                      <div className="grid grid-cols-1 gap-2 mb-3 text-sm">
                        {venta.cliente && (
                          <div className="flex items-center gap-2 text-gray-600">
                            <FaUser className="w-4 h-4 text-gray-400" />
                            <span className="font-medium">Cliente:</span>
                            <span>{venta.cliente.nombre || 'Sin nombre'}</span>
                          </div>
                        )}
                        {editingId === venta.id_venta ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <FaHashtag className="w-4 h-4 text-gray-400" />
                              <span className="font-medium">Referencia:</span>
                              <input
                                type="text"
                                value={editReferencia}
                                onChange={(e) => setEditReferencia(e.target.value)}
                                className="flex-1 border rounded px-2 py-1 text-sm"
                                placeholder="Número de referencia"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <FaUniversity className="w-4 h-4 text-gray-400" />
                              <span className="font-medium">Banco:</span>
                              <input
                                type="text"
                                value={editBanco}
                                onChange={(e) => setEditBanco(e.target.value)}
                                className="flex-1 border rounded px-2 py-1 text-sm"
                                placeholder="Nombre del banco"
                              />
                            </div>
                          </div>
                        ) : (
                          <>
                            {venta.deposito_banco?.numero_referencia && (
                              <div className="flex items-center gap-2 text-gray-600">
                                <FaHashtag className="w-4 h-4 text-gray-400" />
                                <span className="font-medium">Referencia:</span>
                                <span>{venta.deposito_banco.numero_referencia}</span>
                              </div>
                            )}
                            {venta.deposito_banco?.nombre_banco && (
                              <div className="flex items-center gap-2 text-gray-600">
                                <FaUniversity className="w-4 h-4 text-gray-400" />
                                <span className="font-medium">Banco:</span>
                                <span>{venta.deposito_banco.nombre_banco}</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {editingId === venta.id_venta ? (
                          <>
                            <button
                              onClick={handleSaveTransferencia}
                              disabled={updatingId === venta.id_venta}
                              className="flex-1 h-9 rounded-md text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
                            >
                              {updatingId === venta.id_venta ? (
                                <svg className="animate-spin w-4 h-4 mx-auto" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                </svg>
                              ) : (
                                'Guardar'
                              )}
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="flex-1 h-9 rounded-md text-sm font-medium bg-gray-500 text-white hover:bg-gray-600"
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleEditTransferencia(venta)}
                              className="flex-1 h-9 rounded-md text-sm font-medium bg-purple-500 text-white hover:bg-purple-600"
                            >
                              Editar Datos
                            </button>
                            <button
                              onClick={() => handleUpdateEstado(venta.id_venta, 'recibido')}
                              disabled={updatingId === venta.id_venta || venta.estado_transferencia === 'recibido'}
                              className={`flex-1 h-9 rounded-md text-sm font-medium ${
                                venta.estado_transferencia === 'recibido'
                                  ? 'bg-green-100 text-green-700 cursor-not-allowed'
                                  : 'bg-green-500 text-white hover:bg-green-600'
                              }`}
                            >
                              {updatingId === venta.id_venta ? (
                                <svg className="animate-spin w-4 h-4 mx-auto" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                </svg>
                              ) : (
                                <div className="flex items-center justify-center gap-2">
                                  <FaCheck className="w-4 h-4" />
                                  <span>RECIBIDO</span>
                                </div>
                              )}
                            </button>
                            <button
                              onClick={() => handleUpdateEstado(venta.id_venta, 'esperando')}
                              disabled={updatingId === venta.id_venta || venta.estado_transferencia === 'esperando'}
                              className={`flex-1 h-9 rounded-md text-sm font-medium ${
                                venta.estado_transferencia === 'esperando'
                                  ? 'bg-amber-100 text-amber-700 cursor-not-allowed'
                                  : 'bg-amber-500 text-white hover:bg-amber-600'
                              }`}
                            >
                              {updatingId === venta.id_venta ? (
                                <svg className="animate-spin w-4 h-4 mx-auto" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                </svg>
                              ) : (
                                <div className="flex items-center justify-center gap-2">
                                  <FaClock className="w-4 h-4" />
                                  <span>ESPERANDO</span>
                                </div>
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-auto px-5 py-4 border-t bg-gray-50 flex items-center justify-between">
              <div className="text-sm">
                Total transferencias: <b>{currency(transferencias.reduce((sum, v) => sum + (v.total_venta || 0), 0))}</b>
              </div>
              <button onClick={onClose} className="px-4 py-2 rounded-md border bg-white hover:bg-gray-100">
                Cerrar
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

/* ===================== Reporte (PDF Optimizado) ===================== */
function ReportModal({
  open,
  onClose,
  ventasTotales,
  transferTotal,
  montoInicial,
  esperado,
  contado,
  diferencia,
  transferencias,
  cajero,
  fechaApertura,
  titulo = "REPORTE DE CIERRE DE CAJA",
  ventasEfectivo,
}: {
  open: boolean;
  onClose: () => void;
  ventasTotales: number;
  transferTotal: number;
  montoInicial: number;
  esperado: number;
  contado: number;
  diferencia: number;
  transferencias: Venta[];
  cajero?: string;
  fechaApertura?: string;
  titulo?: string;
  ventasEfectivo: number;
}): JSX.Element {
  const fechaCierre = useMemo(
    () =>
      new Intl.DateTimeFormat("es-GT", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(new Date()),
    []
  );

  const printCss = `
            @page { size: A4; margin: 12mm; }

            /* Ocultar el nodo imprimible en pantalla sin usar display:none */
            @media screen {
              #reporte-cierre {
                position: absolute;
                left: -10000px;
                top: -10000px;
                width: 210mm;
                height: 297mm;
                opacity: 0;
                pointer-events: none;
              }
            }

            @media print {
              /* Mostrar únicamente el contenedor del reporte */
              body * { visibility: visible; }
              html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              table { page-break-inside: avoid; break-inside: avoid; }
              .sheet { width: 210mm; min-height: 297mm; }
            }
          `;

  const openPrintWindow = (title?: string) => {
    try {
      const node = document.getElementById('reporte-cierre');
      if (!node) {
        console.warn('No printable node found (#reporte-cierre)');
        return;
      }

      if (title?.includes('PDF')) {
        const opt = {
          margin: 0.5,
          filename: `cierre-caja-${new Date().toISOString().split('T')[0]}.pdf`,
          image: { type: 'jpeg' as const, quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'in' as const, format: 'a4' as const, orientation: 'portrait' as const }
        };

        html2pdf().set(opt).from(node).outputPdf().then((pdf: Uint8Array) => {
          const blob = new Blob([pdf as BlobPart], { type: 'application/pdf' });
          const blobUrl = URL.createObjectURL(blob);
          window.open(blobUrl, '_blank');
        }).catch((error: unknown) => {
          console.error('Error generando PDF:', error);
        });
        return;
      }

      // Para imprimir, abrir nueva ventana
      const cssHref = '/src/index.css';
      const docHtml = `<!doctype html><html><head><meta charset="utf-8"><title>${title ?? 'Reporte'}</title><link rel="stylesheet" href="${cssHref}">
      <style>
        /* Base styles copied from app to preserve look */
        body{font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; color:#111827;}
        ${printCss}
      </style></head><body>${node.innerHTML}</body></html>`;

      const w = window.open('', '_blank');
      if (!w) {
        alert('No se pudo abrir la ventana de impresión. Revisa bloqueadores de ventanas emergentes.');
        return;
      }

      w.document.open();
      w.document.write(docHtml);
      w.document.close();
      // Esperar a que cargue el contenido antes de imprimir
      w.focus();
      setTimeout(() => {
        try {
          w.print();
        } catch (err) {
          console.warn('Error al imprimir:', err);
        }
      }, 300);
    } catch (err) {
      console.error('openPrintWindow error', err);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70]">
          {/* Backdrop (pantalla) */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] print:hidden" />

          {/* Modal (preview pantalla) */}
          <div className="relative z-[71] h-full w-full print:hidden flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }} className="bg-white w-full max-w-4xl rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between border-b p-4 flex-shrink-0">
                <h2 className="text-xl font-bold text-gray-800">{titulo}</h2>
                <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                <div className="mx-auto bg-white rounded-xl border shadow-sm p-6">
                  <PrintableSheet
                    titulo={titulo}
                    ventasTotales={ventasTotales}
                    transferTotal={transferTotal}
                    montoInicial={montoInicial}
                    esperado={esperado}
                    contado={contado}
                    diferencia={diferencia}
                    transferencias={transferencias}
                    cajero={cajero}
                    fechaApertura={fechaApertura}
                    fechaCierre={fechaCierre}
                    ventasEfectivo={ventasEfectivo}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t p-4 bg-white flex-shrink-0">
                <button onClick={() => openPrintWindow('Abrir PDF - SHUCWAY') } className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2">
                  <FaFilePdf size={18} />
                  Abrir PDF
                </button>
                <button onClick={() => openPrintWindow('Imprimir - SHUCWAY')} className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 flex items-center gap-2">
                  <MdPrint size={18} />
                  Imprimir
                </button>
                <button onClick={onClose} className="bg-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300 flex items-center gap-2">
                  <FaTimes size={18} />
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>

          {/* ??rea imprimible A4 ??? SIEMPRE en el DOM (oculta en pantalla, visible en print) */}
          <div id="reporte-cierre">
            <PrintableSheet
              titulo={titulo}
              ventasTotales={ventasTotales}
              transferTotal={transferTotal}
              montoInicial={montoInicial}
              esperado={esperado}
              contado={contado}
              diferencia={diferencia}
              transferencias={transferencias}
              cajero={cajero}
              fechaApertura={fechaApertura}
              fechaCierre={fechaCierre}
              ventasEfectivo={ventasEfectivo}
            />
          </div>

          {/* CSS de impresi??n (EN STRING para evitar error de decorators) */}
          <style>{`
            @page { size: A4; margin: 12mm; }

            /* Ocultar el nodo imprimible en pantalla sin usar display:none */
            @media screen {
              #reporte-cierre {
                position: absolute;
                left: -10000px;
                top: -10000px;
                width: 210mm;
                height: 297mm;
                opacity: 0;
                pointer-events: none;
              }
            }

            @media print {
              /* Mostrar ??nicamente el contenedor del reporte */
              body * { visibility: hidden; }
              #reporte-cierre, #reporte-cierre * { visibility: visible; }
              #reporte-cierre {
                display: block !important;
                position: static;
                width: auto;
                height: auto;
              }
              html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              table { page-break-inside: avoid; break-inside: avoid; }
              .sheet { width: 210mm; min-height: 297mm; }
              .no-print { display: none !important; }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

function SectionHeading({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="flex items-center gap-2 mb-2">
      <div className="h-5 w-1.5 rounded bg-emerald-600" />
      <h3 className="text-sm font-bold text-gray-800 tracking-wide">{children}</h3>
    </div>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }): JSX.Element {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-4 py-1 text-sm">
      <div className="text-gray-600">{label}</div>
      <div className={(strong ? "font-bold text-gray-900" : "font-medium text-gray-800") + " tabular-nums text-right"}>
        {value}
      </div>
    </div>
  );
}

function PrintableSheet({
  titulo,
  ventasTotales,
  transferTotal,
  montoInicial,
  esperado,
  contado,
  diferencia,
  transferencias,
  cajero,
  fechaApertura,
  fechaCierre,
  ventasEfectivo,
}: {
  titulo: string;
  ventasTotales: number;
  transferTotal: number;
  montoInicial: number;
  esperado: number;
  contado: number;
  diferencia: number;
  transferencias: Venta[];
  cajero?: string;
  fechaApertura?: string;
  fechaCierre: string;
  ventasEfectivo: number;
}): JSX.Element {
  return (
    <div className="sheet mx-auto bg-white rounded-xl border shadow-sm p-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-base font-bold text-gray-900">SHUCWAY</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase text-gray-500">Fecha de cierre</div>
          <div className="text-sm font-bold">{fechaCierre}</div>
        </div>
      </div>

      <div className="mt-5 p-4 rounded-lg border bg-gradient-to-br from-white to-gray-50">
        <div className="text-center">
          <h2 className="text-lg font-extrabold tracking-wide text-gray-900">{titulo}</h2>
          {fechaApertura && <div className="text-xs text-gray-600">Sesi??n iniciada el <b>{fechaApertura}</b></div>}
        </div>
      </div>

      {/* Resumen */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-lg border p-4">
          <SectionHeading>Resumen de Ventas</SectionHeading>
          <Row label="Ventas Totales" value={currency(ventasTotales)} />
          <Row label="Pagos con Tarjeta" value={currency(0)} />
          <Row label="Transferencias" value={currency(transferTotal)} />
          <div className="mt-2 border-t pt-2">
            <Row label="Ventas en Efectivo" value={currency(ventasEfectivo)} strong />
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <SectionHeading>Detalle de Cierre</SectionHeading>
          <Row label="Monto Inicial" value={currency(montoInicial)} />
          <div className="mt-2 border-t pt-2">
            <Row label="Efectivo Esperado en Caja" value={currency(esperado)} strong />
            <Row label="Efectivo Contado" value={currency(contado)} />
            <Row label="Diferencia Total" value={currency(diferencia)} />
          </div>
        </div>
      </div>

      {/* Transferencias por banco */}
      {transferencias.length > 0 && (
        <div className="mt-6 rounded-lg border p-4">
          <SectionHeading>Transferencias verificadas por banco</SectionHeading>
          {Object.entries(
            transferencias
              .filter((t: VentaTransferencia) => t.total_venta > 0 && t.estado_transferencia === 'recibido')
              .reduce((acc: Record<string, VentaTransferencia[]>, t: VentaTransferencia) => {
                const banco = 'Transferencia'; // Simplificar por ahora
                if (!acc[banco]) acc[banco] = [];
                acc[banco].push(t);
                return acc;
              }, {} as Record<string, Venta[]>)
          ).map(([banco, transfers]: [string, VentaTransferencia[]]) => {
            const subtotal = transfers.reduce((sum: number, t: VentaTransferencia) => sum + (t.total_venta || 0), 0);
            return (
              <div key={banco} className="mb-4 last:mb-0 break-inside-avoid">
                <div className="flex items-center justify-between text-sm font-semibold text-gray-800">
                  <div>
                    {banco} <span className="text-gray-500 font-normal">({transfers.length} trx)</span>
                  </div>
                  <div className="tabular-nums">{currency(subtotal)}</div>
                </div>
                <div className="mt-2 overflow-hidden rounded-md border">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-3 py-2 text-left">#</th>
                        <th className="px-3 py-2 text-left">Cliente</th>
                        <th className="px-3 py-2 text-left">Referencia</th>
                        <th className="px-3 py-2 text-right">Monto (Q)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {transfers.map((t: VentaTransferencia, idx) => (
                        <tr key={t.id_venta}>
                          <td className="px-3 py-1">{idx + 1}</td>
                          <td className="px-3 py-1">{t.cliente?.nombre || 'Sin cliente'}</td>
                          <td className="px-3 py-1">{t.deposito_banco?.numero_referencia || '---'}</td>
                          <td className="px-3 py-1 text-right tabular-nums">{currency(t.total_venta || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Firmas */}
      <div className="mt-8 text-center">
        <div className="h-12" />
        <div className="border-t border-gray-400 pt-1 text-sm text-gray-800">{cajero || ""}</div>
        <div className="text-xs text-gray-600">Responsable de Caja</div>
      </div>

      {/* Pie */}
      <div className="mt-6 text-[10px] text-gray-500 flex items-center justify-between">
        <div>Generado: {fechaCierre}</div>
        <div></div>
      </div>
    </div>
  );
}

export default CierreCaja;

