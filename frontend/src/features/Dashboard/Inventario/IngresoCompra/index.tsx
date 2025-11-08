import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from "framer-motion";
import { PiEyeBold, PiTrashBold, PiSpinnerBold, PiFloppyDiskBold, PiPlusBold, PiPackageBold, PiPencilSimpleBold, PiWarningBold } from "react-icons/pi";
import { message, notification } from 'antd';
import { fetchProveedores, fetchOrdenesCompra, createOrdenCompra, createDetalleOrdenCompra, updateOrdenCompra, deleteOrdenCompra, createRecepcionMercaderia, getRecepcionesMercaderia, getOrdenCompraById } from "../../../../api/inventarioService";
import { getProfile } from '../../../../api/authService';
import { useAuth } from "../../../../hooks/useAuth";
import { PermissionLevel } from "../../../../constants/permissions";
import { localStore } from '../../../../utils/storage';

/* =============== Tipos API =============== */
type ProveedorAPI = {
  id_proveedor: number;
  nombre_empresa: string;
  nombre_contacto?: string | null;
  telefono?: string | null;
  correo?: string | null;
  direccion?: string | null;
  estado: boolean;
  metodo_entrega?: string | null;
  es_preferido?: boolean;
};

type OrdenCompraAPI = {
  id_orden: number;
  fecha_orden: string;
  fecha_entrega_estimada?: string | null;
  id_proveedor: number;
  estado: string;
  tipo_orden?: string | null;
  motivo_generacion?: string | null;
  fecha_aprobacion?: string | null;
  total: number;
  tipo_pago?: string | null;
};
type Proveedor = {
  id_proveedor: number;
  nombre: string;
  contacto?: string | null;
  telefono?: string | null;
  correo?: string | null;
  direccion?: string | null;
  activo: boolean;
  es_preferido: boolean;
  dias_entrega?: string | null;
  tiempo_entrega_promedio?: number | null;
  metodo_entrega?: string | null;
};

export type Orden = {
  id_orden: string;
  numero_orden: string | null;
  fecha: string | null;
  fecha_entrega_estimada?: string | null;
  tipo_pago?: string | null;
  tipo_orden?: string | null;
  motivo_generacion?: string | null;
  nota?: string | null;
  id_proveedor?: number | null;
  proveedor?: { nombre: string } | null;
  total?: number | null;
  estado?: string | null;
  items_count?: number | null;
};

type DetalleOrdenCompra = {
  id_detalle: number;
  id_insumo: number;
  cantidad: number;
  precio_unitario: number;
  id_presentacion: number;
  descripcion_insumo?: string;
  presentacion?: string;
  unidad_base?: string;
  unidades_por_presentacion?: number;
  cantidad_recibida?: number;
  insumo?: {
    nombre_insumo?: string;
    unidad_base?: string;
  };
  insumo_presentacion?: {
    descripcion_presentacion?: string;
    unidades_por_presentacion?: number;
    unidad_compra?: string;
  };
};

type InsumoRow = {
  id_insumo: number;
  nombre: string;
  costo_promedio?: number | null;
  unidad_medida_compra?: string | null;
  unidad_base?: string | null;
  stock_minimo?: number | null;
  stock_maximo?: number | null;
  stock_actual?: number | null;
};

type PresentacionCompleta = {
  insumo: {
    id_insumo: number;
    nombre_insumo: string;
    unidad_base: string;
    costo_promedio: number;
    stock_minimo: number;
    stock_maximo: number;
    stock_actual: number;
    activo: boolean;
  };
  presentacion: {
    id_presentacion: number;
    descripcion_presentacion: string;
    unidad_compra: string;
    unidades_por_presentacion: number;
    costo_compra_unitario: number;
    es_principal: boolean;
    activo: boolean;
  };
  proveedor: {
    id_proveedor: number;
    nombre_proveedor: string;
  } | null;
  lotes_disponibles: Array<{
    id_lote: number;
    id_insumo: number;
    cantidad_inicial: number;
    cantidad_actual: number;
    costo_unitario: number;
    fecha_vencimiento?: string;
    ubicacion?: string;
  }>;
};

export type Item = {
  id: string;
  id_insumo?: number | null;
  descripcion: string;
  qty: number;
  precio: number;
  id_presentacion?: number | null;
  descripcion_presentacion?: string | null;
  unidades_por_presentacion?: number | null;
  unidad_compra?: string | null;
  unidad_base?: string | null;
  cantidad_recibida?: number | null;
  stock_minimo?: number | null;
  stock_maximo?: number | null;
  stock_actual?: number | null;
  lotes_disponibles?: Array<{
    id_lote: number;
    id_insumo: number;
    cantidad_inicial: number;
    cantidad_actual: number;
    costo_unitario: number;
    fecha_vencimiento?: string;
    ubicacion?: string;
  }>;
};

type MovimientoSincronizacionResumen = {
  movimientosAplicados: boolean;
  movimientosGenerados: number;
  cantidadBaseTotal: number;
  lotesActualizados: number;
  insumosActualizados: number;
  seOmitioPorDuplicado: boolean;
  mensajes: string[];
};

type RecepcionSincronizacionResumen = {
  movimientos: MovimientoSincronizacionResumen;
  ocCerrada: boolean;
  ocEstadoFinal: string;
  totalDetallesOrden: number | null;
  totalDetallesRecepcion: number | null;
  detallesPendientes: number;
};

type FormProveedor = {
  id_proveedor?: number;
  nombre: string;
  contacto: string | null;
  telefono: string | null;
  correo: string | null;
  direccion: string | null;
  activo: boolean;
  es_preferido: boolean;
  dias_entrega: string | null;
  tiempo_entrega_promedio: number | null;
  metodo_entrega: string | null;
};
const INPUT_CLS =
  "w-full h-11 rounded-lg border border-gray-300 px-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-300 disabled:bg-gray-100 disabled:text-gray-500";

const fmtQ = (n?: number | null) =>
  n == null ? "—" : new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ" }).format(n);
const fmtUnits = (n?: number | null) =>
  n == null ? "0" : new Intl.NumberFormat("es-GT", { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(n);
const fmtDate = (s?: string | null) => {
  if (!s) return "—";
  try {
    const date = new Date(s);
    return isNaN(date.getTime()) ? "—" : date.toLocaleDateString("es-GT");
  } catch {
    return "—";
  }
};
const sortOrdersDesc = (orders: Orden[]) =>
  [...orders].sort((a, b) => {
    const timeA = a?.fecha ? new Date(a.fecha).getTime() : 0;
    const timeB = b?.fecha ? new Date(b.fecha).getTime() : 0;
    if (timeA === timeB) {
      const idA = Number(a?.id_orden ?? 0);
      const idB = Number(b?.id_orden ?? 0);
      return idB - idA;
    }
    return timeB - timeA;
  });

const showRecepcionSyncNotification = ({
  numeroOrden,
  idRecepcion,
  detallesCreados,
  resumen,
}: {
  numeroOrden?: string | null;
  idRecepcion?: number;
  detallesCreados?: number;
  resumen?: RecepcionSincronizacionResumen | null;
}) => {
  if (!resumen) return;

  const lines: string[] = [];

  if (typeof detallesCreados === 'number') {
    lines.push(`Detalles generados automáticamente: ${detallesCreados}`);
  }

  if (resumen.totalDetallesOrden !== null && resumen.totalDetallesRecepcion !== null) {
    const baseLine = `Recepciones vinculadas: ${resumen.totalDetallesRecepcion}/${resumen.totalDetallesOrden}`;
    lines.push(resumen.detallesPendientes > 0 ? `${baseLine} (pendientes: ${resumen.detallesPendientes})` : baseLine);
  }

  if (resumen.movimientos.seOmitioPorDuplicado) {
    lines.push('Los movimientos de inventario ya estaban aplicados.');
  } else if (resumen.movimientos.movimientosAplicados) {
    lines.push(`Movimientos generados: ${resumen.movimientos.movimientosGenerados} registro(s) (${fmtUnits(resumen.movimientos.cantidadBaseTotal)} uds base).`);
  } else {
    lines.push('No se generaron movimientos de inventario para esta recepción.');
  }

  lines.push(`Estado actual de la OC: ${resumen.ocEstadoFinal}${resumen.ocCerrada ? ' (cerrada)' : ''}.`);

  resumen.movimientos.mensajes
    .filter(msg => Boolean(msg) && !lines.includes(msg))
    .forEach(msg => lines.push(msg));

  notification.success({
    message: `Recepción sincronizada${numeroOrden ? ` (${numeroOrden})` : ''}`,
    description: (
      <div className="space-y-1">
        {typeof idRecepcion === 'number' ? (
          <div className="font-semibold text-gray-800">Recepción #{idRecepcion}</div>
        ) : null}
        {lines.map((line, index) => (
          <div key={`sync-line-${index}`} className="text-sm text-gray-700">{line}</div>
        ))}
      </div>
    ),
    placement: 'bottomRight',
    duration: 6,
  });
};

/* =========================================================================
 * DrawerRight (estilo Ventas)
 * ========================================================================= */
const DrawerRight: React.FC<React.PropsWithChildren<{
  open: boolean;
  onClose: () => void;
  widthClass?: string;
  title?: string;
}>> = ({ open, onClose, widthClass = "w-full sm:w-[520px]", title, children }) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[2000] w-screen h-screen left-0 top-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="fixed inset-0 bg-black/60"
            style={{ top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 2000 }}
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.24 }}
            className={`fixed right-0 top-0 h-full bg-white shadow-2xl ${widthClass} flex flex-col z-[2001]`}
            style={{ maxHeight: '100vh', overflow: 'auto' }}
          >
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <div className="text-lg font-semibold text-gray-800">{title}</div>
              <button onClick={onClose} className="text-gray-500 hover:text-gray-700" aria-label="Cerrar">✕</button>
            </div>
            <div className="flex-1 overflow-auto">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* =============== Pastillas (rojo/verde) =============== */
function Pill({ tone, children }: { tone: "green" | "red"; children: React.ReactNode }) {
  const c = tone === "green"
    ? { bg: "bg-emerald-50", text: "text-emerald-800", br: "border-emerald-200", dot: "bg-emerald-600" }
    : { bg: "bg-rose-50",    text: "text-rose-800",    br: "border-rose-200",    dot: "bg-rose-600" };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border ${c.bg} ${c.text} ${c.br} px-3 py-1 text-sm font-semibold`}>
      <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />
      {children}
    </span>
  );
}
function ProviderState({ active }: { active?: boolean | null }) {
  return <Pill tone={active ? "green" : "red"}>{active ? "Activo" : "Inactivo"}</Pill>;
}

/* =============== Componente de Paginación =============== */
function PaginationControls({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange
}: {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  const totalPages = Math.ceil(totalItems / pageSize);
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 px-4 py-3 bg-gray-50 rounded-lg">
      {/* Información de registros */}
      <div className="text-sm text-gray-600">
        Mostrando {totalItems === 0 ? 0 : startItem} - {endItem} de {totalItems} registros
      </div>

      {/* Controles de paginación */}
      <div className="flex items-center gap-4">
        {/* Selector de registros por página */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Por página:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-8 px-2 text-sm border border-gray-300 rounded"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>

        {/* Controles de navegación */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Anterior
          </button>

          <span className="text-sm text-gray-600">
            {currentPage} / {totalPages || 1}
          </span>

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}

/* =============== Botones chicos =============== */
function IconBtn({ children, onClick, title, style }: { children: React.ReactNode; onClick?: () => void; title?: string; style?: React.CSSProperties }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={style}
      className="p-2 rounded-lg hover:bg-emerald-50 text-gray-700 hover:text-emerald-700"
    >
      {children}
    </button>
  );
}
/* Tabs VERDES como en Ventas */
function TabButton({ active, onClick, label }: { active?: boolean; onClick?: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={
        "px-4 py-2 rounded-xl text-base font-semibold whitespace-nowrap border transition " +
        (active
          ? "bg-emerald-600 text-white border-emerald-600 shadow"
          : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100")
      }
    >
      {label}
    </button>
  );
}

/* =============== Función auxiliar para fecha de hoy =============== */
const getTodayDate = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/* =============== Componente para mostrar estado de orden =============== */
function OrderState({ estado }: { estado: string | null | undefined }) {
  const getEstadoStyles = (estado: string) => {
    switch (estado?.toLowerCase()) {
      case 'pendiente':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'aprobada':
      case 'aprobado':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'recibida':
      case 'recibido':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelada':
      case 'cancelado':
      case 'rechazada':
      case 'rechazado':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getEstadoDisplay = (estado: string) => {
    switch (estado?.toLowerCase()) {
      case 'aprobada':
      case 'aprobado':
        return 'Aprobada';
      case 'rechazada':
      case 'rechazado':
        return 'Rechazada';
      default:
        return estadoValue.charAt(0).toUpperCase() + estadoValue.slice(1);
    }
  };

  const estadoValue = estado || 'pendiente';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getEstadoStyles(estadoValue)}`}>
      {getEstadoDisplay(estadoValue)}
    </span>
  );
}

/* =============== Componente Principal =============== */
export default function IngresoCompra(): JSX.Element {
  const [rows, setRows] = useState<Orden[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [allProveedores, setAllProveedores] = useState<Proveedor[]>([]); // Para el filtro dropdown
  const [insumos, setInsumos] = useState<InsumoRow[]>([]); // Para el listado de insumos en el formulario
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal de confirmación de eliminación de proveedor
  const [deleteProviderModal, setDeleteProviderModal] = useState<{ open: boolean; provider: Proveedor | null }>({ open: false, provider: null });

  // Modal de confirmación de eliminación de orden
  const [deleteOrderModal, setDeleteOrderModal] = useState<{ open: boolean; order: Orden | null }>({ open: false, order: null });

  // Función para cargar datos
  const loadData = async () => {
    try {
      setLoading(true);
      const [proveedoresData, ordenesData, insumosResult] = await Promise.all([
        fetchProveedores(),
        fetchOrdenesCompra(),
        fetch(`${import.meta.env.VITE_API_URL}/inventario/insumos`, {
          headers: { 'Authorization': `Bearer ${localStore.get('access_token')}` }
        }).then(res => res.json()).catch(() => ({ data: [] })) // Fallback to empty array on error
      ]);

      let insumosData: unknown[] = [];
      if (insumosResult && typeof insumosResult === 'object' && 'data' in insumosResult) {
        insumosData = Array.isArray(insumosResult.data) ? insumosResult.data : [];
      } else if (Array.isArray(insumosResult)) {
        insumosData = insumosResult;
      }

      // Transformar insumos al formato esperado por el frontend
      const transformedInsumos: InsumoRow[] = (insumosData as { id_insumo: number; nombre_insumo: string; costo_promedio: number; unidad_base: string; stock_minimo?: number; stock_maximo?: number; stock_actual?: number }[]).map((ins: { id_insumo: number; nombre_insumo: string; costo_promedio: number; unidad_base: string; stock_minimo?: number; stock_maximo?: number; stock_actual?: number }) => ({
        id_insumo: ins.id_insumo,
        nombre: ins.nombre_insumo,
        costo_promedio: ins.costo_promedio,
        unidad_medida_compra: ins.unidad_base, // Usar unidad_base como medida de compra por defecto
        unidad_base: ins.unidad_base,
        stock_minimo: ins.stock_minimo,
        stock_maximo: ins.stock_maximo,
        stock_actual: ins.stock_actual,
      }));

      // Transformar datos de proveedores para que coincidan con el tipo esperado
      const proveedoresFormatted = proveedoresData.map((prov: ProveedorAPI) => ({
        id_proveedor: prov.id_proveedor,
        nombre: prov.nombre_empresa,
        contacto: prov.nombre_contacto,
        telefono: prov.telefono,
        correo: prov.correo,
        direccion: prov.direccion,
        activo: prov.estado,
        es_preferido: prov.es_preferido ?? false,
        dias_entrega: null,
        tiempo_entrega_promedio: null,
        metodo_entrega: prov.metodo_entrega
      }));

      // Transformar datos de órdenes de compra
      const ordenesFormatted = ordenesData.map((orden: OrdenCompraAPI) => {
        const proveedorEncontrado = proveedoresFormatted.find((p: FormProveedor) => p.id_proveedor === orden.id_proveedor);
        return {
          id_orden: orden.id_orden.toString(),
          numero_orden: `OC-${orden.id_orden}`,
          fecha: orden.fecha_orden,
          fecha_entrega_estimada: orden.fecha_entrega_estimada,
          tipo_pago: orden.tipo_pago,
          tipo_orden: orden.tipo_orden,
          motivo_generacion: orden.motivo_generacion,
          id_proveedor: orden.id_proveedor,
          proveedor: proveedorEncontrado ? { nombre: proveedorEncontrado.nombre } : null,
          total: orden.total, // Usar el total directamente de la base de datos
          estado: orden.estado,
          items_count: 0 // Calcular si es necesario
        };
      });

  setProveedores(proveedoresFormatted);
  setAllProveedores(proveedoresFormatted); // Para el dropdown de filtro
  setRows(sortOrdersDesc(ordenesFormatted as Orden[]));
      setInsumos(transformedInsumos);
    } catch (err) {
      console.error('Error cargando datos:', err);
      setError('Error al cargar los datos. Intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  // Cargar datos al montar el componente
  useEffect(() => {
    loadData();
  }, []);

  // Filtros órdenes
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("Todas");
  const [selectedProveedorIdFilter, setSelectedProveedorIdFilter] = useState<string>("Todos");

  // Filtros proveedores
  const [providerQ, setProviderQ] = useState<string>("");
  const [providerActivoFilter, setProviderActivoFilter] = useState<"all" | "activo" | "inactivo">("all");
  const [providerPreferidoFilter, setProviderPreferidoFilter] = useState<"all" | "si" | "no">("all");

  // Paginación proveedores
  const [providerPage, setProviderPage] = useState(1);
  const [providerPageSize, setProviderPageSize] = useState(5);

  // Paginación órdenes
  const [orderPage, setOrderPage] = useState(1);
  const [orderPageSize, setOrderPageSize] = useState(5);

  // Drawer orden
  const [openDrawer, setOpenDrawer] = useState(false);
  const [detail, setDetail] = useState<Orden | null>(null);
  const [readOnly, setReadOnly] = useState(false);

  // Hook de navegación
  const navigate = useNavigate();
  const { roleLevel } = useAuth();
  const canManageCompras = (roleLevel ?? 0) >= PermissionLevel.ADMINISTRADOR;
  const ensureCanManageCompras = useCallback(() => {
    if (!canManageCompras) {
      message.warning('No tienes permisos para gestionar compras.');
      return false;
    }
    return true;
  }, [canManageCompras]);

  // Drawer proveedor
  const [openProvDrawer, setOpenProvDrawer] = useState(false);
  const [provDetail, setProvDetail] = useState<Proveedor | null>(null);

  // Drawer formulario proveedor
  const [openProvFormDrawer, setOpenProvFormDrawer] = useState(false);
  const [provFormData, setProvFormData] = useState<FormProveedor>({
    nombre: "",
    contacto: null,
    telefono: null,
    correo: null,
    direccion: null,
    activo: true,
    es_preferido: false,
    dias_entrega: null,
    tiempo_entrega_promedio: null,
    metodo_entrega: null,
  });

  // Bloquea scroll al abrir drawers
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = (openDrawer || openProvDrawer || openProvFormDrawer) ? "hidden" : "";
    return () => { document.body.style.overflow = prev || ""; };
  }, [openDrawer, openProvDrawer, openProvFormDrawer]);

  // Detectar flag de localStorage optimizado para abrir modal de Nueva Orden desde stock monitoring
  useEffect(() => {
    const shouldOpenNewOrder = localStore.get('openNewOrderModal');
    if (shouldOpenNewOrder === 'true') {
      setDetail(null);
      setReadOnly(false);
      setOpenDrawer(true);
      localStorage.removeItem('openNewOrderModal');
    }
  }, []);

  // Reset paginación cuando cambian filtros
  useEffect(() => {
    setProviderPage(1);
  }, [providerQ, providerActivoFilter, providerPreferidoFilter]);

  // Reset filtros de proveedores cuando se filtra por proveedor en órdenes
  useEffect(() => {
    if (selectedProveedorIdFilter !== "Todos") {
      setProviderQ("");
      setProviderActivoFilter("all");
      setProviderPreferidoFilter("all");
    }
  }, [selectedProveedorIdFilter]);

  useEffect(() => {
    setOrderPage(1);
  }, [q, status, selectedProveedorIdFilter]);

  /* ---- Filtrados ---- */
  const filteredOrders = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "Todas") {
        const estadoOrden = (r.estado || "pendiente").toLowerCase();
        const filtroEstado = status.toLowerCase();
        if (filtroEstado === "pendiente" && (estadoOrden.includes("aprob") || estadoOrden.includes("recib") || estadoOrden.includes("rechaz"))) return false;
        if (filtroEstado === "aprobada" && !estadoOrden.includes("aprob")) return false;
        if (filtroEstado === "recibida" && !estadoOrden.includes("recib")) return false;
        if (filtroEstado === "rechazada" && !estadoOrden.includes("rechaz")) return false;
      }
      if (selectedProveedorIdFilter !== "Todos" && String(r.id_proveedor ?? "") !== selectedProveedorIdFilter) return false;
      if (!ql) return true;
      const numOrden = `${r.numero_orden ?? ""}`.toLowerCase();
      const provNombre = `${r.proveedor?.nombre ?? ""}`.toLowerCase();
      return numOrden.includes(ql) || provNombre.includes(ql);
    }).sort((a, b) => {
      // Ordenar por fecha descendente (más reciente primero)
      const fechaA = new Date(a.fecha || 0).getTime();
      const fechaB = new Date(b.fecha || 0).getTime();
      return fechaB - fechaA;
    });
  }, [rows, q, status, selectedProveedorIdFilter]);

  const counts = useMemo(() => {
    const acc = { Pendiente: 0, Aprobada: 0, Recibida: 0, Rechazada: 0 } as Record<string, number>;
    rows.forEach((r) => {
      const s = (r.estado || "").toLowerCase();
      if (s.includes("aprob")) acc.Aprobada++;
      else if (s.includes("recib")) acc.Recibida++;
      else if (s.includes("rechaz")) acc.Rechazada++;
      else acc.Pendiente++;
    });
    return acc;
  }, [rows]);

  const filteredProviders = useMemo(() => {
    return proveedores
      .filter((p) => {
        const searchTerm = providerQ.toLowerCase();
        const nombreEmpresa = (p.nombre || "").toLowerCase();
        const nombreContacto = (p.contacto || "").toLowerCase();
        return nombreEmpresa.includes(searchTerm) || nombreContacto.includes(searchTerm);
      })
      .filter((p) => (providerActivoFilter === "all" ? true : providerActivoFilter === "activo" ? p.activo : !p.activo))
      .filter((p) => (providerPreferidoFilter === "all" ? true : providerPreferidoFilter === "si" ? p.es_preferido : !p.es_preferido));
  }, [proveedores, providerQ, providerActivoFilter, providerPreferidoFilter]);

  // Ajustar página si excede el límite
  useEffect(() => {
    const maxPages = Math.ceil(filteredProviders.length / providerPageSize);
    if (providerPage > maxPages && maxPages > 0) {
      setProviderPage(maxPages);
    }
  }, [filteredProviders.length, providerPageSize, providerPage]);

  useEffect(() => {
    const maxPages = Math.ceil(filteredOrders.length / orderPageSize);
    if (orderPage > maxPages && maxPages > 0) {
      setOrderPage(maxPages);
    }
  }, [filteredOrders.length, orderPageSize, orderPage]);

  // Datos paginados proveedores
  const paginatedProviders = useMemo(() => {
    const startIndex = (providerPage - 1) * providerPageSize;
    return filteredProviders.slice(startIndex, startIndex + providerPageSize);
  }, [filteredProviders, providerPage, providerPageSize]);

  // Datos paginados órdenes
  const paginatedOrders = useMemo(() => {
    const startIndex = (orderPage - 1) * orderPageSize;
    return filteredOrders.slice(startIndex, startIndex + orderPageSize);
  }, [filteredOrders, orderPage, orderPageSize]);

  /* ---- Acciones Proveedores ---- */
  const openViewProvider = (p: Proveedor) => { setProvDetail(p); setOpenProvDrawer(true); };
  const deleteProvider = (p: Proveedor) => {
    if (!ensureCanManageCompras()) return;
    setDeleteProviderModal({ open: true, provider: p });
  };

  const confirmDeleteProvider = useCallback(() => {
    if (!ensureCanManageCompras()) {
      setDeleteProviderModal({ open: false, provider: null });
      return;
    }
    if (!deleteProviderModal.provider) return;
    (async () => {
      try {
        const resp = await fetch(`/api/proveedores/${deleteProviderModal.provider!.id_proveedor}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${localStore.get('access_token')}` }
        });
        if (!resp.ok) {
          const txt = await resp.text();
          throw new Error(txt || 'Error eliminando proveedor');
        }
        setProveedores((prev) => prev.filter(x => x.id_proveedor !== deleteProviderModal.provider!.id_proveedor));
        setAllProveedores((prev) => prev.filter(x => x.id_proveedor !== deleteProviderModal.provider!.id_proveedor));
        message.success(`Proveedor "${deleteProviderModal.provider!.nombre}" eliminado correctamente.`);
        setDeleteProviderModal({ open: false, provider: null });
      } catch (error) {
        console.error('Error eliminando proveedor:', error);
        const msg = error instanceof Error ? error.message : 'Error desconocido';
        message.error(`No se pudo eliminar el proveedor: ${msg}`);
      }
    })();
  }, [deleteProviderModal.provider, ensureCanManageCompras]);

  /* ---- Acciones Órdenes ---- */
  const openEditOrder = (r: Orden) => {
    if (!ensureCanManageCompras()) return;
    setDetail(r);
    setReadOnly(false);
    setOpenDrawer(true);
  };
  const deleteOrder = (r: Orden) => {
    if (!ensureCanManageCompras()) return;
    setDeleteOrderModal({ open: true, order: r });
  };

  const confirmDeleteOrder = useCallback(async () => {
    if (!ensureCanManageCompras()) {
      setDeleteOrderModal({ open: false, order: null });
      return;
    }
    if (!deleteOrderModal.order) return;
    
    try {
      // Eliminar la orden del backend usando la función del servicio
      await deleteOrdenCompra(deleteOrderModal.order.id_orden);

      // Actualizar el estado local
      setRows((prev) => prev.filter(x => x.id_orden !== deleteOrderModal.order!.id_orden));
      message.success(`Orden "${deleteOrderModal.order.numero_orden || deleteOrderModal.order.id_orden}" eliminada correctamente.`);
      setDeleteOrderModal({ open: false, order: null });
    } catch (error: unknown) {
      console.error('Error eliminando orden:', error);
      
      // Manejar el error específico de recepciones asociadas
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: { detail?: string; message?: string } } };
        if (axiosError.response?.data?.detail) {
          message.error(
            `No se puede eliminar la orden porque tiene recepciones de mercadería asociadas. ${axiosError.response.data.detail}`
          );
        } else {
          const errorMessage = axiosError.response?.data?.message || 'Error desconocido';
          message.error(`Error al eliminar la orden: ${errorMessage}`);
        }
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        message.error(`Error al eliminar la orden: ${errorMessage}`);
      }
    }
  }, [deleteOrderModal.order, ensureCanManageCompras]);

  /* ---- Función para guardar proveedor ---- */
  // Función para guardar/editar proveedor con integración backend
  const handleProveedorSubmit = async () => {
    if (!ensureCanManageCompras()) return;
    try {
      // Validación de teléfono: debe tener 4 u 8 dígitos si se ingresa
      const telefonoLimpio = provFormData.telefono?.replace(/\D/g, "") || "";
      if (telefonoLimpio && !(telefonoLimpio.length === 4 || telefonoLimpio.length === 8)) {
        message.error("El teléfono debe tener exactamente 4 u 8 dígitos.");
        return;
      }
      // Limpiar campos: strings vacíos a undefined/null según corresponda
      const payload = {
        nombre_empresa: provFormData.nombre,
        nombre_contacto: provFormData.contacto?.trim() ? provFormData.contacto : undefined,
        telefono: telefonoLimpio ? telefonoLimpio : undefined,
        correo: provFormData.correo?.trim() ? provFormData.correo : undefined,
        direccion: provFormData.direccion?.trim() ? provFormData.direccion : undefined,
        estado: provFormData.activo,
        metodo_entrega: provFormData.metodo_entrega === '' || provFormData.metodo_entrega == null ? null : provFormData.metodo_entrega,
        es_preferido: provFormData.es_preferido,
      };
      // Nunca enviar id_proveedor en el payload de creación
      let response;
      if (provFormData.id_proveedor) {
        // Editar proveedor
        response = await fetch(`/api/proveedores/${provFormData.id_proveedor}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        // Crear proveedor
        // Nunca enviar id_proveedor en el payload
        response = await fetch('/api/proveedores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      if (!response.ok) throw new Error('Error al guardar proveedor');
      // Actualizar lista local
      const data = await response.json();
      if (provFormData.id_proveedor) {
        setProveedores(prev => prev.map(p => p.id_proveedor === provFormData.id_proveedor ? {
          ...p,
          nombre: payload.nombre_empresa,
          contacto: payload.nombre_contacto,
          telefono: payload.telefono,
          correo: payload.correo,
          direccion: payload.direccion,
          activo: payload.estado,
          es_preferido: payload.es_preferido,
          metodo_entrega: payload.metodo_entrega,
        } : p));
        message.success('Proveedor actualizado correctamente');
      } else {
        setProveedores(prev => [
          {
            id_proveedor: data.id_proveedor,
            nombre: payload.nombre_empresa,
            contacto: payload.nombre_contacto,
            telefono: payload.telefono,
            correo: payload.correo,
            direccion: payload.direccion,
            activo: payload.estado,
            es_preferido: payload.es_preferido,
            metodo_entrega: payload.metodo_entrega,
          },
          ...prev,
        ]);
        message.success('Proveedor creado correctamente');
      }
      setOpenProvFormDrawer(false);
      setProvFormData({
        nombre: "",
        contacto: null,
        telefono: null,
        correo: null,
        direccion: null,
        activo: true,
        es_preferido: false,
        dias_entrega: null,
        tiempo_entrega_promedio: null,
        metodo_entrega: null,
      });
    } catch (error) {
      let errorMessage = '';
      if (error instanceof Error) errorMessage = error.message;
      else errorMessage = String(error);
      if (errorMessage.toLowerCase().includes('forbidden') || errorMessage.toLowerCase().includes('permission') || errorMessage.toLowerCase().includes('policy')) {
        message.error(`Error de permisos al guardar proveedor. Revisa roles/permisos en el backend. Detalles: ${errorMessage}`);
      } else {
        message.error(`Error al guardar proveedor: ${errorMessage}`);
      }
      console.error('Error al guardar proveedor:', error);
    }
  };

  /* ---- Helpers Drawer Órdenes ---- */
  const openNewOrder  = () => {
    if (!ensureCanManageCompras()) return;
    setDetail(null);
    setReadOnly(false);
    setOpenDrawer(true);
  };
  const openViewOrder = (r: Orden) => { setDetail(r);  setReadOnly(true);  setOpenDrawer(true); };
  const openRecepcionMercaderia = () => {
    navigate('/inventario/recepcion-mercaderia');
  };

  return (
    <div className="w-full p-6 lg:p-8 space-y-8">
      {/* Header con título y botón de regresar */}
      <div className="mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 12H5M12 19L5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Regresar
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Ingreso de Compras</h1>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <PiSpinnerBold className="animate-spin text-2xl text-emerald-600 mr-2" />
          <span className="text-lg text-gray-600">Cargando datos...</span>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <>
          {/* ===================== Proveedores ===================== */}
          <section>
        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-2xl font-bold text-gray-800">Proveedores</h3>
            <p className="text-sm text-gray-500">Administra proveedores (ver detalles e insumos relacionados).</p>
          </div>
          <div className="flex items-center gap-3">
            {canManageCompras && (
              <button 
                onClick={() => { 
                  if (!ensureCanManageCompras()) return;
                  setProvFormData({
                    nombre: "",
                    contacto: null,
                    telefono: null,
                    correo: null,
                    direccion: null,
                    activo: true,
                    es_preferido: false,
                    dias_entrega: null,
                    tiempo_entrega_promedio: null,
                    metodo_entrega: null,
                  });
                  setOpenProvFormDrawer(true); 
                }}
                className="px-4 py-2 rounded-md text-white font-medium"
                style={{ backgroundColor: '#12443d', border: '1px solid #12443d' }}
              >
                + Crear Proveedor
              </button>
            )}
          </div>
        </div>

        {/* Filtros de Proveedores */}
        <div className="bg-white rounded-2xl shadow p-5 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
            <input
              value={providerQ}
              onChange={(e) => setProviderQ(e.target.value)}
              placeholder="Buscar proveedor..."
              className="h-11 rounded-lg border border-gray-200 px-3 text-base bg-white md:col-span-2"
            />
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600">Estado:</label>
              <select
                value={providerActivoFilter}
                onChange={(e) => setProviderActivoFilter(e.target.value as "all"|"activo"|"inactivo")}
                className="h-11 rounded-lg border border-gray-200 px-3 text-base bg-white"
              >
                <option value="all">Todos</option>
                <option value="activo">Activos</option>
                <option value="inactivo">Inactivos</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600">Preferido:</label>
              <select
                value={providerPreferidoFilter}
                onChange={(e) => setProviderPreferidoFilter(e.target.value as "all"|"si"|"no")}
                className="h-11 rounded-lg border border-gray-200 px-3 text-base bg-white"
              >
                <option value="all">Todos</option>
                <option value="si">Sí</option>
                <option value="no">No</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tabla Proveedores (agrandada + verde) */}
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-base">
              <thead className="text-left text-gray-700 bg-gray-50">
                <tr className="border-b">
                  <th className="px-4 py-3.5 font-semibold">Nombre</th>
                  <th className="px-4 py-3.5 font-semibold">Contacto</th>
                  <th className="px-4 py-3.5 font-semibold">Teléfono</th>
                  <th className="px-4 py-3.5 font-semibold">Estado</th>
                  <th className="px-4 py-3.5 font-semibold">Preferido</th>
                  <th className="px-4 py-3.5 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-800 leading-7">
                {filteredProviders.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400 italic">No se encontraron proveedores.</td></tr>
                )}
                {paginatedProviders.map((p) => (
                  <tr key={p.id_proveedor} className="hover:bg-gray-50">
                    <td className="px-4 py-3.5 font-medium">{p.nombre}</td>
                    <td className="px-4 py-3.5">{p.contacto || "—"}</td>
                    <td className="px-4 py-3.5">{p.telefono || "—"}</td>
                    <td className="px-4 py-3.5"><ProviderState active={p.activo} /></td>
                    <td className="px-4 py-3.5">{p.es_preferido ? "⭐ Sí" : "No"}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <IconBtn title="Ver" onClick={() => openViewProvider(p)}><PiEyeBold /></IconBtn>
                        {canManageCompras && (
                          <>
                            <IconBtn title="Editar" onClick={() => {
                              if (!ensureCanManageCompras()) return;
                              setProvFormData({
                                id_proveedor: p.id_proveedor,
                                nombre: p.nombre,
                                contacto: p.contacto || null,
                                telefono: p.telefono || null,
                                correo: p.correo || null,
                                direccion: p.direccion || null,
                                activo: p.activo,
                                es_preferido: p.es_preferido,
                                dias_entrega: p.dias_entrega || null,
                                tiempo_entrega_promedio: p.tiempo_entrega_promedio || null,
                                metodo_entrega: p.metodo_entrega || null,
                              });
                              setOpenProvFormDrawer(true);
                            }} style={{ color: '#7c3aed' }}>
                              <PiPencilSimpleBold />
                            </IconBtn>
                            <IconBtn title="Eliminar" onClick={() => deleteProvider(p)}><PiTrashBold className="text-rose-600" /></IconBtn>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación proveedores */}
          {filteredProviders.length > 0 && (
            <PaginationControls
              currentPage={providerPage}
              totalItems={filteredProviders.length}
              pageSize={providerPageSize}
              onPageChange={setProviderPage}
              onPageSizeChange={(size) => {
                setProviderPageSize(size);
                setProviderPage(1); // Reset to first page when changing page size
              }}
            />
          )}
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      {/* ===================== Órdenes de Compra ===================== */}
      <section>
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-2xl font-bold text-gray-800">Órdenes de Compra</h3>
            <p className="text-sm text-gray-500">Historial y alta de órdenes.</p>
          </div>
          <div className="flex gap-3">
            {canManageCompras && (
              <button
                onClick={openNewOrder}
                className="h-11 rounded-xl bg-emerald-600 px-4 text-base font-semibold text-white hover:bg-emerald-700 flex items-center gap-2"
              >
                <PiPlusBold /> Nueva Orden
              </button>
            )}
            <button
              onClick={openRecepcionMercaderia}
              className="h-11 rounded-xl px-4 text-base font-semibold text-white hover:opacity-90 flex items-center gap-2"
              style={{ backgroundColor: '#346c60' }}
            >
              <PiPackageBold /> Recepción Mercadería
            </button>
          </div>
        </div>

        {/* Filtros Órdenes */}
        <div className="bg-white rounded-2xl shadow p-5 mb-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-base font-medium text-gray-700 whitespace-nowrap">Estado:</span>
                {["Todas", "Pendiente", "Aprobada", "Recibida", "Rechazada"].map((estadoKey) => {
                  const count = estadoKey === "Todas" ? rows.length : counts[estadoKey] ?? 0;
                  const label = estadoKey === "Todas" ? `Todas (${count})` : `${estadoKey} (${count})`;
                  return <TabButton key={estadoKey} active={status === estadoKey} onClick={() => setStatus(estadoKey)} label={label} />;
                })}
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="filtroProveedorOrden" className="text-base font-medium text-gray-700 whitespace-nowrap">Proveedor:</label>
                <select
                  id="filtroProveedorOrden"
                  value={selectedProveedorIdFilter}
                  onChange={(e) => setSelectedProveedorIdFilter(e.target.value)}
                  className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-base text-gray-800 w-64"
                >
                  <option value="Todos">Todos</option>
                  {allProveedores.map((p) => (
                    <option key={p.id_proveedor} value={p.id_proveedor}>{p.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="relative w-96">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar N° Orden / Proveedor..."
                  className="h-11 w-full rounded-lg border border-gray-200 bg-white pl-3 pr-8 text-base"
                />
              </div>
            </div>
            <button
              onClick={() => { setQ(""); setStatus("Todas"); setSelectedProveedorIdFilter("Todos"); }}
              className="h-11 rounded-lg border px-4 text-base font-semibold text-gray-700 hover:bg-gray-100 whitespace-nowrap"
            >
              Limpiar
            </button>
          </div>
        </div>

        {/* Tabla Órdenes (más grande y SOLO 👁️) */}
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-lg">
              <thead className="text-left text-gray-700 bg-gray-50">
                <tr className="border-b">
                  <th className="px-5 py-4 font-semibold">N° Orden</th>
                  <th className="px-5 py-4 font-semibold">Fecha</th>
                  <th className="px-5 py-4 font-semibold">Proveedor</th>
                  <th className="px-5 py-4 font-semibold">Estado</th>
                  <th className="px-5 py-4 font-semibold text-right">Total</th>
                  <th className="px-5 py-4 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 leading-[2.1rem]">
                {filteredOrders.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400 italic">No se encontraron órdenes.</td></tr>
                ) : (
                  paginatedOrders.map((r) => (
                    <tr key={r.id_orden} className="hover:bg-gray-50">
                      <td className="px-5 py-4 font-semibold text-gray-900">{r.numero_orden ?? r.id_orden}</td>
                      <td className="px-5 py-4 text-gray-800">{fmtDate(r.fecha)}</td>
                      <td className="px-5 py-4 text-gray-800">{r.proveedor?.nombre ?? <span className="italic text-gray-400">N/A</span>}</td>
                      <td className="px-5 py-4"><OrderState estado={r.estado} /></td>
                      <td className="px-5 py-4 text-right font-bold text-gray-900">{fmtQ(r.total)}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <IconBtn title="Ver" onClick={() => openViewOrder(r)}><PiEyeBold /></IconBtn>
                            {canManageCompras && r.estado !== 'recibida' && (
                            <IconBtn title="Editar" onClick={() => openEditOrder(r)} style={{ color: '#7c3aed' }}>
                              <PiPencilSimpleBold />
                            </IconBtn>
                          )}
                            {canManageCompras && (
                              <IconBtn title="Eliminar" onClick={() => deleteOrder(r)}><PiTrashBold className="text-rose-600" /></IconBtn>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación órdenes */}
          {filteredOrders.length > 0 && (
            <PaginationControls
              currentPage={orderPage}
              totalItems={filteredOrders.length}
              pageSize={orderPageSize}
              onPageChange={setOrderPage}
              onPageSizeChange={(size) => {
                setOrderPageSize(size);
                setOrderPage(1); // Reset to first page when changing page size
              }}
            />
          )}
        </div>
      </section>
        </>
      )}

      {/* Drawer: Orden */}
      <DrawerRight
        open={openDrawer}
        onClose={() => setOpenDrawer(false)}
        title={detail ? (readOnly ? "Ver Orden de Compra" : "Editar Orden de Compra") : "Nueva Orden de Compra"}
        widthClass="w-full md:w-[700px] lg:w-[920px]"
      >
        <div className="flex-1">
          <PurchaseOrderForm
            detail={detail}
            readOnly={readOnly}
            onClose={() => {
              // Mantenerse en la página de órdenes de compra
              setDetail(null);
              setReadOnly(false);
              setOpenDrawer(false);
            }}
            setRows={setRows}
            proveedores={proveedores}
            insumos={insumos}
            loadData={loadData}
            setStatus={setStatus}
            setQ={setQ}
            setSelectedProveedorIdFilter={setSelectedProveedorIdFilter}
          />
        </div>
      </DrawerRight>

      {/* Drawer: Formulario Proveedor */}
      <DrawerRight
        open={openProvFormDrawer}
        onClose={() => setOpenProvFormDrawer(false)}
        title={provFormData.id_proveedor ? "Editar Proveedor" : "Crear Proveedor"}
        widthClass="w-full md:w-[600px]"
      >
        <form
          className="flex flex-col gap-6 p-2 md:p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            await handleProveedorSubmit();
          }}
        >
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block font-semibold mb-1">Nombre de la Empresa *</label>
              <input
                className={INPUT_CLS}
                required
                value={provFormData.nombre}
                onChange={e => setProvFormData(f => ({ ...f, nombre: e.target.value }))}
                placeholder="Ingrese el nombre de la empresa"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Nombre del Contacto</label>
              <input
                className={INPUT_CLS}
                value={provFormData.contacto ?? ''}
                onChange={e => setProvFormData(f => ({ ...f, contacto: e.target.value }))}
                placeholder="Ingrese el nombre del contacto"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Teléfono</label>
              <input
                className={INPUT_CLS}
                value={provFormData.telefono ?? ''}
                onChange={e => setProvFormData(f => ({ ...f, telefono: e.target.value }))}
                placeholder="Ingrese el número de teléfono"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Correo Electrónico</label>
              <input
                className={INPUT_CLS}
                type="email"
                value={provFormData.correo ?? ''}
                onChange={e => setProvFormData(f => ({ ...f, correo: e.target.value }))}
                placeholder="Ingrese el correo electrónico"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Dirección</label>
              <input
                className={INPUT_CLS}
                value={provFormData.direccion ?? ''}
                onChange={e => setProvFormData(f => ({ ...f, direccion: e.target.value }))}
                placeholder="Ingrese la dirección completa"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Método de Entrega</label>
              <select
                className={INPUT_CLS}
                value={provFormData.metodo_entrega ?? ''}
                onChange={e => {
                  const val = e.target.value;
                  setProvFormData(f => ({ ...f, metodo_entrega: val === '' ? null : val }));
                }}
              >
                <option value="">Seleccionar método</option>
                <option value="Recepcion">Recepcion</option>
                <option value="Recoger en tienda">Recoger en tienda</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Estado</label>
              <select
                className={INPUT_CLS}
                value={provFormData.activo === false ? 'inactivo' : 'activo'}
                onChange={e => setProvFormData(f => ({ ...f, activo: e.target.value === 'activo' ? true : false }))}
              >
                <option value="activo">Activo</option>
                <option value="inactivo">Desactivado</option>
              </select>
            </div>
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={provFormData.es_preferido}
                  onChange={e => setProvFormData(f => ({ ...f, es_preferido: e.target.checked }))}
                />
                Proveedor preferido
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
              onClick={() => setOpenProvFormDrawer(false)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
            >
              {provFormData.id_proveedor ? 'Guardar Cambios' : 'Crear Proveedor'}
            </button>
          </div>
        </form>
      </DrawerRight>

      {/* Modal: Proveedor */}
      {openProvDrawer && provDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[2000]">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-800">Ver Proveedor</h2>
              <button onClick={() => setOpenProvDrawer(false)} className="text-gray-500 hover:text-gray-700 text-2xl">✕</button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <ProviderInsumosModal id_proveedor={provDetail.id_proveedor} proveedorData={provDetail} />
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación de eliminación de proveedor */}
      {deleteProviderModal.open && deleteProviderModal.provider && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <PiTrashBold className="text-rose-600 text-2xl mr-3" />
              <h3 className="text-lg font-semibold text-gray-900">Confirmar eliminación</h3>
            </div>
            <p className="text-gray-600 mb-6">
              ¿Estás seguro de que deseas eliminar el proveedor <strong>"{deleteProviderModal.provider.nombre}"</strong>?
              Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteProviderModal({ open: false, provider: null })}
                className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteProvider}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación de eliminación de orden */}
      {deleteOrderModal.open && deleteOrderModal.order && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <PiTrashBold className="text-rose-600 text-2xl mr-3" />
              <h3 className="text-lg font-semibold text-gray-900">Confirmar eliminación</h3>
            </div>
            <p className="text-gray-600 mb-6">
              ¿Estás seguro de que deseas eliminar la orden <strong>"{deleteOrderModal.order.numero_orden ?? deleteOrderModal.order.id_orden}"</strong>?
              Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteOrderModal({ open: false, order: null })}
                className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteOrder}
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

/* ======================================================================
 * ===== Formulario de Orden de Compra =====
 * ====================================================================== */
function PurchaseOrderForm({
  detail, readOnly, onClose, setRows, proveedores, insumos, loadData, setStatus, setQ, setSelectedProveedorIdFilter
}: {
  detail: Orden | null;
  readOnly: boolean;
  onClose: () => void;
  setRows: React.Dispatch<React.SetStateAction<Orden[]>>;
  proveedores: Proveedor[];
  insumos: InsumoRow[];
  loadData: () => Promise<void>;
  setStatus?: React.Dispatch<React.SetStateAction<string>>;
  setQ?: React.Dispatch<React.SetStateAction<string>>;
  setSelectedProveedorIdFilter?: React.Dispatch<React.SetStateAction<string>>;
}) {
  const [selectedProveedorId, setSelectedProveedorId] = useState<string>(String(detail?.id_proveedor ?? ""));
  const [fecha, setFecha] = useState<string>(detail?.fecha ? String(detail.fecha).slice(0, 10) : (() => {
    const today = new Date();
    return new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  })());
  const [fechaEntregaEstimada, setFechaEntregaEstimada] = useState<string>(detail?.fecha_entrega_estimada ? String(detail.fecha_entrega_estimada).slice(0, 10) : '');
  const [tipoPago, setTipoPago] = useState<string>(detail?.tipo_pago || 'credito');
  const [estado, setEstado] = useState<string>(detail?.estado || 'pendiente');
  const [motivoGeneracion, setMotivoGeneracion] = useState<string>(detail?.motivo_generacion || '');
  const [nota, setNota] = useState<string>("");
  const [items, setItems] = useState<Item[]>([{ id: crypto.randomUUID(), descripcion: "Item de ejemplo", qty: 1, precio: 10 }]);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ nombre: string; username: string } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (detail?.id_orden) {
      // Load order details
      const loadOrder = async () => {
        try {
          const response = await fetch(`${import.meta.env.VITE_API_URL}/ordenes-compra/${detail.id_orden}/detalles`, {
            headers: { Authorization: `Bearer ${localStore.get('access_token')}` },
          });
          if (response.ok) {
            const detalles = await response.json() as DetalleOrdenCompra[];
            const loadedItems = await Promise.all(detalles.map(async (d) => {
              const descripcionPresentacion = d.insumo_presentacion?.descripcion_presentacion || '';
              const unidadesPorPresentacion = d.insumo_presentacion?.unidades_por_presentacion ?? d.unidades_por_presentacion ?? 1;
              const unidadBase = d.unidad_base || d.insumo?.unidad_base || '';

              // Obtener información completa del insumo incluyendo stock
              let stockInfo = {};
              try {
                const insumoResponse = await fetch(`${import.meta.env.VITE_API_URL}/inventario/insumos/${d.id_insumo}`, {
                  headers: { Authorization: `Bearer ${localStore.get('access_token')}` },
                });
                if (insumoResponse.ok) {
                  const insumoData = await insumoResponse.json();
                  stockInfo = {
                    stock_minimo: insumoData.stock_minimo,
                    stock_maximo: insumoData.stock_maximo,
                    stock_actual: insumoData.stock_actual,
                  };
                }
              } catch (error) {
                console.error('Error obteniendo información de stock:', error);
              }

              return {
                id: d.id_detalle.toString(),
                id_insumo: d.id_insumo,
                descripcion: d.insumo?.nombre_insumo || d.descripcion_insumo || '',
                qty: d.cantidad,
                precio: d.precio_unitario,
                id_presentacion: d.id_presentacion,
                descripcion_presentacion: descripcionPresentacion,
                presentacion: descripcionPresentacion,
                unidad_compra: d.insumo_presentacion?.unidad_compra,
                unidad_base: unidadBase,
                unidades_por_presentacion: unidadesPorPresentacion,
                cantidad_recibida: d.cantidad_recibida || 0,
                ...stockInfo,
              };
            }));
            setItems(loadedItems);
          }
        } catch (error) {
          console.error('Error loading order details:', error);
        }
      };
      loadOrder();
      setSelectedProveedorId(String(detail.id_proveedor ?? ""));
      setFecha(detail.fecha ? String(detail.fecha).slice(0, 10) : getTodayDate());
      setFechaEntregaEstimada(detail.fecha_entrega_estimada ? String(detail.fecha_entrega_estimada).slice(0, 10) : '');
      setTipoPago(detail.tipo_pago || 'credito');
      setEstado(detail.estado || 'pendiente');
      setMotivoGeneracion(detail.motivo_generacion || '');
      setNota(detail.motivo_generacion || '');
    } else {
      setItems([{ id: crypto.randomUUID(), descripcion: "", qty: 1, precio: 0 }]);
      setNota("");
      setSelectedProveedorId("");
      setFecha(getTodayDate());
      setFechaEntregaEstimada('');
      setTipoPago('credito');
      setMotivoGeneracion('');
    }
  }, [detail]);

  // Fetch current user
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const user = await getProfile();
        setCurrentUser({ nombre: user.nombre, username: user.username });
      } catch (error) {
        console.error('Error fetching current user:', error);
      }
    };
    fetchCurrentUser();
  }, []);

  const subtotal = useMemo(() => items.reduce((acc, it) => acc + (it.qty * (it.unidades_por_presentacion || 1) * it.precio || 0), 0), [items]);
  const iva = useMemo(() => +(subtotal * 0.12).toFixed(2), [subtotal]);
  const total = useMemo(() => +(subtotal + iva).toFixed(2), [subtotal, iva]);

  // (Eliminada función generateOrderNumber, ya no se usa)

  // (Eliminado require, ahora se usa import al inicio del archivo)
  const handleSave = async (aprobarAutomaticamente = false) => {
    if (!selectedProveedorId) {
      message.error("Por favor, selecciona un proveedor.");
      return;
    }
    if (!fecha) {
      message.error("Por favor, ingresa una fecha.");
      return;
    }
    if (!fechaEntregaEstimada) {
      message.error("Por favor, ingresa una fecha de entrega estimada.");
      return;
    }
    if (new Date(fechaEntregaEstimada) <= new Date(fecha)) {
      message.error("La fecha de entrega estimada debe ser posterior a la fecha de la orden.");
      return;
    }
    if (items.length === 0 || items.every((it) => !(it.descripcion || "").trim() && !it.id_insumo)) {
      message.error("Agrega al menos un ítem válido.");
      return;
    }

    setSaving(true);
    try {
      // Incluir hora actual en la fecha
      const fechaConHora = aprobarAutomaticamente ? new Date().toISOString() : `${fecha}T${new Date().toTimeString().slice(0, 8)}`;
      
      // Payload para orden_compra según modelo SQL
      const trimmedMotivo = motivoGeneracion.trim();
      const trimmedNota = nota.trim();
      
      // Determinar el estado correcto
      const estadoFinal = aprobarAutomaticamente
        ? "recibida"
        : detail
          ? estado
          : "pendiente";
      
      const ordenPayload = {
        fecha_orden: fechaConHora,
        id_proveedor: Number(selectedProveedorId),
        estado: estadoFinal,
        tipo_orden: "manual",
        tipo_pago: tipoPago,
        motivo_generacion: trimmedMotivo || (trimmedNota ? trimmedNota : undefined),
        fecha_entrega_estimada: fechaEntregaEstimada || null,
        total: total,
      };
      let ordenResult: Record<string, unknown>;
      if (detail && detail.id_orden) {
        console.log('Procesando OC:', detail.id_orden, 'Estado actual:', detail.estado, 'Nuevo estado:', estado);
        
  // Si se pidió aprobación automática o se cambió manualmente a recibida, crear recepción si no existe
  const debeCrearRecepcion = aprobarAutomaticamente || (estado === 'recibida' && detail.estado !== 'recibida');
        if (debeCrearRecepcion) {
          console.log('Procesando recepción automática para OC', detail.id_orden, 'estado anterior:', detail.estado, 'bandera auto:', aprobarAutomaticamente);
          try {
            const recepciones = await getRecepcionesMercaderia();
            const existingRecepcion = recepciones.data?.find((r: Recepcion) => r.id_orden === Number(detail.id_orden));
            if (!existingRecepcion) {
              console.log('Obteniendo datos de la orden:', detail.id_orden);
              const ordenData = await getOrdenCompraById(Number(detail.id_orden));
              console.log('Datos de orden obtenidos:', ordenData);
              console.log('Detalles de orden:', ordenData?.detalle_orden_compra);
              
              const userProfile = await getProfile();
              const recepcionData = {
                id_orden: Number(detail.id_orden),
                fecha_recepcion: new Date().toISOString().split('T')[0],
                id_perfil: userProfile.id_perfil,
              };
              const recepcionResult = await createRecepcionMercaderia(recepcionData);
              const recepcionPayload = (recepcionResult as { data?: unknown })?.data ?? recepcionResult;
              const detallesAuto = (recepcionPayload as { detalles_creados?: number })?.detalles_creados ?? 0;
              const idRecepcionCreada = (recepcionPayload as { id_recepcion?: number })?.id_recepcion;
              const sincronizacion = (recepcionPayload as { sincronizacion?: RecepcionSincronizacionResumen | null })?.sincronizacion ?? null;
              console.log('Recepción creada:', recepcionPayload);
              console.log('Detalles automáticos agregados:', detallesAuto);
              showRecepcionSyncNotification({
                numeroOrden: detail?.numero_orden ?? (detail?.id_orden ? `OC-${detail.id_orden}` : undefined),
                idRecepcion: typeof idRecepcionCreada === 'number' ? idRecepcionCreada : undefined,
                detallesCreados: detallesAuto,
                resumen: sincronizacion,
              });
            } else {
              console.log('Recepción ya existe para OC:', detail.id_orden);
            }
          } catch (error) {
            console.error('Error creando recepción automática:', error);
            // Mostrar error al usuario pero no fallar la operación
            message.error('Error creando recepción automática, pero la orden fue actualizada');
          }
        }
        if (aprobarAutomaticamente) {
          setEstado('recibida');
        }

  // Editar orden existente (solo campos editables)
  // Mantener consistencia con estado recibido cuando aplica
        const payloadParaUpdate: Partial<typeof ordenPayload> = { ...ordenPayload };
        ordenResult = await updateOrdenCompra(detail.id_orden, payloadParaUpdate);
        console.log('OC actualizada tras guardar, estado final previsto:', aprobarAutomaticamente ? 'recibida' : estado, 'Resultado:', ordenResult);
        
        if (ordenResult.id_orden && Array.isArray(items)) {
          console.log('[Frontend] Actualizando detalles de OC:', detail.id_orden);

          for (const item of items) {
            try {
              await createDetalleOrdenCompra({
                id_orden: Number(ordenResult.id_orden),
                id_insumo: item.id_insumo!,
                cantidad: item.qty,
                precio_unitario: item.precio,
                id_presentacion: item.id_presentacion!,
              });
            } catch (error) {
              console.error('[Frontend] Error actualizando detalle:', error);
            }
          }
        }
        setRows(prev => {
          const updated = prev.map(r => r.id_orden === detail.id_orden ? {
            ...r,
            id_proveedor: ordenResult.id_proveedor as number,
            proveedor: proveedores.find(p => p.id_proveedor === ordenResult.id_proveedor) ? { nombre: proveedores.find(p => p.id_proveedor === ordenResult.id_proveedor)!.nombre } : undefined,
            fecha: ordenResult.fecha_orden as string,
            fecha_entrega_estimada: (ordenResult.fecha_entrega_estimada as string | null) ?? null,
            total: (ordenResult.total as number) ?? r.total ?? 0,
            estado: aprobarAutomaticamente ? 'recibida' : (ordenResult.estado as string),
            motivo_generacion: (ordenResult.motivo_generacion as string | null) ?? null,
            tipo_pago: (ordenResult.tipo_pago as string | null) ?? null,
            tipo_orden: (ordenResult.tipo_orden as string | null) ?? r.tipo_orden ?? 'manual',
          } : r);
          return sortOrdersDesc(updated);
        });
        // Recargar datos para asegurar que todo esté actualizado
        await loadData();
        message.success(aprobarAutomaticamente
          ? 'Orden de compra actualizada y marcada como recibida. Revisa la recepción generada.'
          : 'Orden de compra actualizada correctamente');
      } else {
        // Crear nueva orden
        ordenResult = await createOrdenCompra(ordenPayload);
        console.log('[Frontend] Nueva orden creada:', ordenResult);
        let resumenSincronizacionAuto: RecepcionSincronizacionResumen | null = null;
        
        if (ordenResult.id_orden && Array.isArray(items)) {
          console.log('[Frontend] Creando detalles de la orden...');
          const detallesCreados = [];
          for (const item of items) {
            try {
              const detalleResult = await createDetalleOrdenCompra({
                id_orden: Number(ordenResult.id_orden),
                id_insumo: item.id_insumo!,
                cantidad: item.qty,
                precio_unitario: item.precio,
                id_presentacion: item.id_presentacion!,
              });
              detallesCreados.push(detalleResult);
              console.log('[Frontend] Detalle creado:', detalleResult);
            } catch (error) {
              console.error('[Frontend] Error creando detalle:', error);
            }
          }
          console.log(`[Frontend] ${detallesCreados.length} detalles creados exitosamente`);
          
          // Pequeña pausa para permitir que Supabase procese los inserts
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Si se aprueba automáticamente, crear recepción automática
        if (aprobarAutomaticamente) {
          console.log('[Frontend] Aprobación automática activada - creando recepción de mercadería');
          const userProfile = await getProfile();
          const recepcionData = {
            id_orden: Number(ordenResult.id_orden),
            fecha_recepcion: new Date().toISOString().split('T')[0],
            id_perfil: userProfile.id_perfil,
          };
          const recepcionResult = await createRecepcionMercaderia(recepcionData);
          const recepcionPayload = (recepcionResult as { data?: unknown })?.data ?? recepcionResult;
          const detallesAuto = (recepcionPayload as { detalles_creados?: number })?.detalles_creados ?? 0;
          const idRecepcionAuto = (recepcionPayload as { id_recepcion?: number })?.id_recepcion;
          const sincronizacion = (recepcionPayload as { sincronizacion?: RecepcionSincronizacionResumen | null })?.sincronizacion ?? null;
          console.log('[Frontend] Recepción automática creada. Detalles agregados:', detallesAuto);
          console.log('[Frontend] El backend cambiará automáticamente el estado de la OC a "recibida" y aplicará movimientos de inventario');

          const numeroOrdenNotificacion = typeof ordenResult.numero_orden === 'string' && ordenResult.numero_orden.trim().length > 0
            ? ordenResult.numero_orden
            : ordenResult.id_orden != null
              ? `OC-${ordenResult.id_orden}`
              : undefined;

          showRecepcionSyncNotification({
            numeroOrden: numeroOrdenNotificacion,
            idRecepcion: typeof idRecepcionAuto === 'number' ? idRecepcionAuto : undefined,
            detallesCreados: detallesAuto,
            resumen: sincronizacion,
          });

          resumenSincronizacionAuto = sincronizacion;
        }

        setRows(prev => sortOrdersDesc([
          {
            id_orden: ordenResult.id_orden as string,
            numero_orden: ordenResult.numero_orden as string || ordenResult.id_orden as string,
            fecha: ordenResult.fecha_orden as string,
            fecha_entrega_estimada: (ordenResult.fecha_entrega_estimada as string | null) ?? null,
            id_proveedor: ordenResult.id_proveedor as number,
            proveedor: proveedores.find(p => p.id_proveedor === ordenResult.id_proveedor) ? { nombre: proveedores.find(p => p.id_proveedor === ordenResult.id_proveedor)!.nombre } : undefined,
            total: ordenResult.total as number,
            estado: aprobarAutomaticamente ? 'recibida' : (ordenResult.estado as string),
            motivo_generacion: (ordenResult.motivo_generacion as string | null) ?? null,
            tipo_pago: (ordenResult.tipo_pago as string | null) ?? tipoPago,
            tipo_orden: (ordenResult.tipo_orden as string | null) ?? 'manual',
            items_count: items.length,
          },
          ...prev
        ]));
        await loadData();
        // Reset filtros para mostrar la orden recién creada
        if (setStatus) setStatus("Todas");
        if (setQ) setQ("");
        if (setSelectedProveedorIdFilter) setSelectedProveedorIdFilter("Todos");
        const mensajeExito = aprobarAutomaticamente 
          ? resumenSincronizacionAuto?.movimientos.movimientosAplicados
            ? "Orden de compra guardada y recibida correctamente. Movimientos de inventario aplicados." 
            : "Orden de compra marcada como recibida. Revisa la recepción y los movimientos." 
          : "Orden de compra guardada como borrador (estado: pendiente)";
        message.success(mensajeExito);
      }
      // Cerrar el drawer después de guardar exitosamente
      onClose();
    } catch (error) {
      console.error('Error guardando orden de compra:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const lower = errorMessage.toLowerCase();
      if (lower.includes('forbidden') || lower.includes('permission') || lower.includes('policy')) {
        message.error(`Error de permisos al guardar orden de compra. Revisa roles/permisos en el backend. Detalles: ${errorMessage}`);
      } else {
        message.error(`Error guardando orden de compra. Revisa la consola para más detalles. ${errorMessage}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const addItem = () => {
    const id = crypto.randomUUID();
    setItems((p) => [...p, { id, descripcion: "", qty: 1, precio: 0 }]);
  };
  const removeItem = (id: string) => setItems((p) => p.filter((i) => i.id !== id));
  const updateItem = (id: string, patch: Partial<Item>) => setItems((p) => p.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  // Función para actualizar presentación en la base de datos
  const updatePresentacion = async (idPresentacion: number, updates: { descripcion_presentacion?: string; unidades_por_presentacion?: number; unidad_compra?: string }) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/inventario/presentaciones/${idPresentacion}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStore.get('access_token')}`,
        },
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        console.error('Error actualizando presentación:', await response.text());
      }
    } catch (error) {
      console.error('Error actualizando presentación:', error);
    }
  };

  // Función para actualizar costo_unitario en lote_insumo
  const updateLoteCostoUnitario = async (idLote: number, costoUnitario: number) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/inventario/lotes/${idLote}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStore.get('access_token')}`,
        },
        body: JSON.stringify({ costo_unitario: costoUnitario }),
      });
      if (!response.ok) {
        console.error('Error actualizando lote:', await response.text());
      }
    } catch (error) {
      console.error('Error actualizando lote:', error);
    }
  };

  const canSave = !readOnly && !!fecha && !!selectedProveedorId && items.length > 0 && items.some((it) => (it.descripcion || "").trim() || it.id_insumo);

  return (
    <>
      <form className="p-6 lg:p-7 space-y-6" onSubmit={(e) => e.preventDefault()}>
      {/* Proveedor/Fecha/Número */}  
  
  
      <section className="bg-gray-50 rounded-xl border border-gray-200 p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <div>
          <label htmlFor="proveedorSelectForm" className="block text-xs font-semibold text-gray-600 mb-1">Proveedor *</label>
          <select id="proveedorSelectForm" value={selectedProveedorId} onChange={e => setSelectedProveedorId(e.target.value)} disabled={readOnly} required className={INPUT_CLS}>
            <option value="" disabled>Selecciona...</option>
            {proveedores.map((p) => (<option key={p.id_proveedor} value={p.id_proveedor}>{p.nombre}</option>))}
          </select>
        </div>
        <div>
          <label htmlFor="fechaInputForm" className="block text-xs font-semibold text-gray-600 mb-1">Fecha *</label>
          <input id="fechaInputForm" type="date" value={fecha} onChange={e => setFecha(e.target.value)} disabled={true} required className={INPUT_CLS} />
        </div>
        {!readOnly && detail && (
          <>
            <div>
              <label htmlFor="horaInputForm" className="block text-xs font-semibold text-gray-600 mb-1">Hora</label>
              <input 
                id="horaInputForm" 
                type="time" 
                value={fecha.includes('T') ? fecha.split('T')[1].slice(0, 5) : new Date().toTimeString().slice(0, 5)} 
                onChange={e => {
                  const [hours, minutes] = e.target.value.split(':');
                  const currentDate = new Date(fecha);
                  currentDate.setHours(parseInt(hours), parseInt(minutes));
                  setFecha(currentDate.toISOString().slice(0, 16));
                }} 
                className={INPUT_CLS} 
              />
            </div>
            <div>
              <label htmlFor="estadoSelectForm" className="block text-xs font-semibold text-gray-600 mb-1">Estado</label>
              <select id="estadoSelectForm" value={estado} onChange={e => setEstado(e.target.value)} className={INPUT_CLS}>
                <option value="pendiente">Pendiente</option>
                <option value="aprobada">Aprobada</option>
                <option value="recibida">Recibida</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
          </>
        )}
        <div>
          <label htmlFor="fechaEntregaInputForm" className="block text-xs font-semibold text-gray-600 mb-1">Fecha entrega estimada</label>
          <input
            id="fechaEntregaInputForm"
            type="date"
            value={fechaEntregaEstimada}
            onChange={e => {
              const selectedDate = new Date(e.target.value);
              const today = new Date();
              today.setHours(0, 0, 0, 0); // Reset time to start of day

              if (selectedDate <= today) {
                message.error("La fecha de entrega estimada debe ser posterior a hoy");
                return;
              }
              setFechaEntregaEstimada(e.target.value);
            }}
            disabled={readOnly}
            className={INPUT_CLS}
          />
        </div>
        <div>
          <label htmlFor="tipoPagoSelectForm" className="block text-xs font-semibold text-gray-600 mb-1">Tipo de pago</label>
          <select id="tipoPagoSelectForm" value={tipoPago} onChange={e => setTipoPago(e.target.value)} disabled={readOnly} className={INPUT_CLS}>
            <option value="credito">Crédito</option>
            <option value="efectivo">Efectivo</option>
            <option value="transferencias">Transferencias</option>
            <option value="tarjeta">Tarjeta</option>
          </select>
        </div>
        <div>
          <label htmlFor="tipoOrdenInputForm" className="block text-xs font-semibold text-gray-600 mb-1">Tipo de orden</label>
          <input id="tipoOrdenInputForm" value="manual" readOnly disabled className={`${INPUT_CLS} bg-gray-100 text-gray-500`} />
        </div>
        <div>
          <label htmlFor="numeroOrdenInputForm" className="block text-xs font-semibold text-gray-600 mb-1">N° Orden</label>
          <input id="numeroOrdenInputForm" value={detail?.numero_orden || "(Automático)"} readOnly disabled className={`${INPUT_CLS} bg-gray-100 text-gray-500`} />
        </div>
      </section>

      {/* Botón Ver Insumos */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => navigate('/inventario?tab=catalogo&from=orden-form')}
          className="px-4 py-2 rounded-lg text-gray-700 bg-gray-100 hover:bg-gray-200 flex items-center gap-2 text-sm font-medium transition-colors"
        >
          <PiEyeBold className="w-4 h-4" />
          Ver Insumos
        </button>
      </div>

      {/* Usuario que crea la orden */}
      {currentUser && (
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-3">
          <div className="text-sm text-blue-800">
            <span className="font-semibold">Creado por:</span> {currentUser.nombre} ({currentUser.username})
          </div>
        </div>
      )}
      {/* Estado dinámico */}
      <div className="mb-2">
        <span className={`inline-block px-3 py-1 rounded-full font-semibold text-sm ${
          estado === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
          estado === 'aprobada' ? 'bg-blue-100 text-blue-800' :
          estado === 'recibida' ? 'bg-green-100 text-green-800' :
          estado === 'rechazado' ? 'bg-red-100 text-red-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          Estado: {estado.charAt(0).toUpperCase() + estado.slice(1)}
        </span>
        <span className="ml-2 inline-block px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs">
          Tipo: manual
        </span>
      </div>

      {/* Detalle */}
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-base font-bold text-gray-800">Detalle de la Orden</h4>
          {!readOnly && (
            <button type="button" onClick={addItem} className="h-10 rounded-lg border px-3 text-base font-semibold hover:bg-gray-50 flex items-center gap-2">
              <PiPlusBold /> Agregar producto
            </button>
          )}
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-base">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="p-3 text-left font-semibold">Insumo</th>
                <th className="p-3 text-left font-semibold w-40">Descripción</th>
                <th className="p-3 text-left font-semibold w-24">Unidades</th>
                <th className="p-3 text-left font-semibold w-32">Unidad Base</th>
                <th className="p-3 text-right font-semibold w-28">Cant.</th>
                <th className="p-3 text-right font-semibold w-28">Recibido</th>
                <th className="p-3 text-right font-semibold w-36">P. Unit.</th>
                <th className="p-3 text-right font-semibold w-36">Subtotal</th>
                <th className="p-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((it) => (
                <tr key={it.id}>
                  <td className="p-2 align-top">
                    <select
                      disabled={readOnly}
                      value={it.id_insumo || ""}
                      onChange={async (e) => {
                        const id_insumo = Number(e.target.value);
                        if (!id_insumo) {
                          updateItem(it.id, {
                            id_insumo: undefined,
                            descripcion: "",
                            id_presentacion: undefined,
                            descripcion_presentacion: undefined,
                            unidades_por_presentacion: undefined,
                            unidad_compra: undefined
                          });
                          return;
                        }
                        const insumo = insumos.find(i => i.id_insumo === id_insumo);
                        if (!insumo) return;

                        // No validar aquí, se valida en el input de cantidad
                        let id_presentacion: number | null = null;
                        let descripcion_presentacion: string | null = null;
                        let unidades_por_presentacion: number | null = null;
                        let lotes_disponibles: Array<{
                          id_lote: number;
                          id_insumo: number;
                          cantidad_inicial: number;
                          cantidad_actual: number;
                          costo_unitario: number;
                          fecha_vencimiento?: string;
                          ubicacion?: string;
                        }> = [];
                        try {
                          const response = await fetch(`${import.meta.env.VITE_API_URL}/inventario/insumos/${id_insumo}/presentaciones`, {
                            headers: {
                              'Authorization': `Bearer ${localStore.get('access_token')}`,
                            },
                          });
                          if (response.ok) {
                            const responseData = await response.json();
                            const data = responseData.data;

                            if (!data || !Array.isArray(data)) {
                              console.error('La respuesta de la API no contiene un array válido en data:', data);
                              return;
                            }

                            // Buscar primero la presentación principal, si no hay, tomar la primera
                            const principal = data.find((p: PresentacionCompleta) => p.presentacion.es_principal) || data[0];
                            if (principal) {
                              id_presentacion = principal.presentacion.id_presentacion;
                              descripcion_presentacion = principal.presentacion.descripcion_presentacion;
                              unidades_por_presentacion = principal.presentacion.unidades_por_presentacion || 1; // Por defecto 1 si no está definido
                              lotes_disponibles = principal.lotes_disponibles || [];
                            }
                          }
                        } catch (e) {
                          console.error('Error obteniendo presentación:', e);
                        }
                        const updateData: Partial<Item> = {
                          id_insumo,
                          descripcion: insumo.nombre,
                          precio: insumo.costo_promedio ?? it.precio,
                          unidad_base: insumo.unidad_base,
                          // No autocompletar qty ni unidades_por_presentacion
                          stock_minimo: insumo.stock_minimo,
                          stock_maximo: insumo.stock_maximo,
                          stock_actual: insumo.stock_actual,
                        };

                        if (id_presentacion !== null) {
                          updateData.id_presentacion = id_presentacion;
                          updateData.descripcion_presentacion = descripcion_presentacion;
                          updateData.unidades_por_presentacion = unidades_por_presentacion;
                          updateData.lotes_disponibles = lotes_disponibles;
                        }

                        updateItem(it.id, updateData);
                      }}
                      className={INPUT_CLS}
                    >
                      <option value="">Seleccionar insumo...</option>
                      {(Array.isArray(insumos) ? insumos : [])
                        .filter((ins) => {
                          // Filtrar insumos que ya están seleccionados en otras líneas
                          return !items.some((otherItem) =>
                            otherItem.id !== it.id && otherItem.id_insumo === ins.id_insumo
                          );
                        })
                        .map((ins) => (
                          <option key={ins.id_insumo} value={ins.id_insumo}>{ins.nombre}</option>
                        ))
                      }
                    </select>
                    {it.id_insumo && (
                      <div className="mt-1 text-xs">
                        <div className={`font-medium ${
                          it.stock_maximo && it.qty > it.stock_maximo ? 'text-red-600' :
                          it.stock_minimo && it.qty < it.stock_minimo ? 'text-orange-600' :
                          'text-gray-600'
                        }`}>
                          Stock actual: {it.stock_actual || 0}
                          {it.cantidad_recibida && it.cantidad_recibida > 0 && (
                            <span className="text-blue-600"> (+{it.cantidad_recibida} pendiente)</span>
                          )}
                          {it.stock_minimo && it.stock_maximo && (
                            <span> | Mín: {it.stock_minimo} | Máx: {it.stock_maximo}</span>
                          )}
                          {it.stock_maximo && (() => {
                            const exceso = (it.stock_actual || 0) + it.qty - it.stock_maximo;
                            return exceso > 0 ? (
                              <span className="ml-2 font-bold text-red-600 flex items-center gap-1">
                                <PiWarningBold className="w-4 h-4" />
                                Excede máximo ({exceso} unidades extra)
                              </span>
                            ) : null;
                          })()}
                        </div>
                        {(() => {
                          // Calcular sugerencia inteligente basada en stock actual
                          const stockActual = it.stock_actual || 0;
                          const stockMinimo = it.stock_minimo || 0;
                          const stockMaximo = it.stock_maximo || 0;

                          let sugerencia = null;
                          let mensajeSugerencia = '';

                          if (stockMinimo > 0 && stockMaximo > 0) {
                            if (stockActual < stockMinimo) {
                              // Si está por debajo del mínimo, sugerir llegar al máximo
                              sugerencia = stockMaximo - stockActual;
                              mensajeSugerencia = `Sugerido: ${sugerencia} (para llegar al máximo desde mínimo)`;
                            } else if (stockActual < stockMaximo) {
                              // Si está entre mínimo y máximo, sugerir llegar al máximo
                              sugerencia = stockMaximo - stockActual;
                              mensajeSugerencia = `Sugerido: ${sugerencia} (para llegar al máximo)`;
                            }
                          }

                          return sugerencia && sugerencia > 0 ? (
                            <span className="ml-2 text-blue-600 font-medium">
                              {mensajeSugerencia}
                            </span>
                          ) : null;
                        })()}
                      </div>
                    )}
                  </td>
                  <td className="p-2 align-top">
                    <input
                      disabled={readOnly}
                      type="text"
                      value={it.descripcion_presentacion || ''}
                      onChange={async (e) => {
                        const newValue = e.target.value;
                        updateItem(it.id, { descripcion_presentacion: newValue });
                        if (it.id_presentacion) {
                          await updatePresentacion(it.id_presentacion, { descripcion_presentacion: newValue });
                        }
                      }}
                      className={INPUT_CLS}
                      placeholder="Descripción"
                    />
                  </td>
                  <td className="p-2 align-top">
                    <input
                      disabled={readOnly}
                      type="number"
                      min={1}
                      step={1}
                      value={it.unidades_por_presentacion || ''}
                      onChange={async (e) => {
                        const newValue = Number(e.target.value) || null;
                        updateItem(it.id, { unidades_por_presentacion: newValue });
                        if (it.id_presentacion) {
                          await updatePresentacion(it.id_presentacion, { unidades_por_presentacion: newValue || undefined });
                        }
                      }}
                      className={INPUT_CLS}
                      placeholder="Unidades"
                    />
                  </td>
                  <td className="p-2 align-top text-gray-700">{it.unidad_base || '-'}</td>
                  <td className="p-2 align-top text-right">
                    <input
                      disabled={readOnly || (() => {
                        // Calcular si debe estar bloqueado basado en la sugerencia
                        const stockActual = it.stock_actual || 0;
                        const stockMinimo = it.stock_minimo || 0;
                        const stockMaximo = it.stock_maximo || 0;
                        const cantidadIngresada = it.qty || 0;

                        let sugerenciaMaxima = null;

                        if (stockMinimo > 0 && stockMaximo > 0) {
                          if (stockActual < stockMinimo) {
                            // Si está por debajo del mínimo, sugerir llegar al máximo
                            sugerenciaMaxima = stockMaximo - stockActual;
                          } else if (stockActual < stockMaximo) {
                            // Si está entre mínimo y máximo, sugerir llegar al máximo
                            sugerenciaMaxima = stockMaximo - stockActual;
                          }
                        }

                        // Bloquear si excede la sugerencia calculada
                        if (sugerenciaMaxima !== null && cantidadIngresada > sugerenciaMaxima) {
                          return true;
                        }

                        // También bloquear si excede el stock máximo (validación existente)
                        if (stockMaximo && ((stockActual || 0) + cantidadIngresada) > stockMaximo) {
                          return true;
                        }

                        return false;
                      })()}
                      type="number"
                      min={1}
                      step={1}
                      value={it.qty}
                      onChange={(e) => {
                        const newQty = Number(e.target.value) || 1;
                        // Validar si excede el stock máximo considerando stock actual + cantidad a ingresar
                        // No incluir cantidad_recibida porque ya está contabilizada en stock_actual
                        if (it.stock_maximo && ((it.stock_actual || 0) + newQty) > it.stock_maximo) {
                          message.warning(`La cantidad ingresada excede el stock máximo permitido (${it.stock_maximo - (it.stock_actual || 0)} unidades disponibles).`);
                        }

                        // Calcular sugerencia para validar exceso
                        const stockActual = it.stock_actual || 0;
                        const stockMinimo = it.stock_minimo || 0;
                        const stockMaximo = it.stock_maximo || 0;

                        let sugerenciaMaxima = null;
                        if (stockMinimo > 0 && stockMaximo > 0) {
                          if (stockActual < stockMinimo) {
                            sugerenciaMaxima = stockMaximo - stockActual;
                          } else if (stockActual < stockMaximo) {
                            sugerenciaMaxima = stockMaximo - stockActual;
                          }
                        }

                        if (sugerenciaMaxima !== null && newQty > sugerenciaMaxima) {
                          message.warning(`La cantidad ingresada excede la sugerencia recomendada (${sugerenciaMaxima} unidades). Considere reducir la cantidad.`);
                        }

                        updateItem(it.id, { qty: newQty });
                      }}
                      className={`${INPUT_CLS} text-right`}
                    />
                  </td>
                  <td className="p-2 align-top text-right text-gray-700">
                    {it.cantidad_recibida || 0} / {(it.qty || 0) * (it.unidades_por_presentacion || 1)}
                  </td>
                  <td className="p-2 align-top text-right">
                    <input disabled={readOnly} type="number" min={0} step={0.01} value={it.precio} onChange={async (e) => {
                      const newPrecio = Number(e.target.value) || 0;
                      updateItem(it.id, { precio: newPrecio });
                      
                      // Actualizar costo_unitario en lotes disponibles
                      if (it.lotes_disponibles && it.lotes_disponibles.length > 0) {
                        // Actualizar el primer lote disponible (el más antiguo)
                        const lotePrincipal = it.lotes_disponibles[0];
                        if (lotePrincipal) {
                          await updateLoteCostoUnitario(lotePrincipal.id_lote, newPrecio);
                        }
                      }
                    }} className={`${INPUT_CLS} text-right`} />
                  </td>
                  <td className="p-2 align-top text-right font-semibold text-gray-800">{fmtQ((it.qty || 0) * (it.unidades_por_presentacion || 1) * (it.precio || 0))}</td>
                  <td className="p-2 align-top text-center">
                    {!readOnly && (
                      <button type="button" onClick={() => removeItem(it.id)} title="Quitar línea" className="p-2 rounded text-rose-600 hover:bg-rose-50">
                        <PiTrashBold className="w-5 h-5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (<tr><td colSpan={7} className="p-4 text-center text-gray-500 italic">Agrega al menos un ítem.</td></tr>)}
            </tbody>
          </table>
        </div>
      </section>

      {/* Notas + Resumen */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 lg:col-span-2">
          <div className="text-base font-bold text-gray-800 mb-3">Notas</div>
          <div className="space-y-3">
            <div>
              <label htmlFor="motivoNotasForm" className="block text-sm font-medium text-gray-700 mb-1">Motivo de generación</label>
              <input
                id="motivoNotasForm"
                type="text"
                value={motivoGeneracion}
                onChange={e => setMotivoGeneracion(e.target.value)}
                disabled={readOnly}
                className={`${INPUT_CLS} text-sm`}
                placeholder="Motivo de la orden de compra"
              />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="text-base font-bold text-gray-800 mb-3">Resumen</div>
          <div className="space-y-1 text-base mb-4">
            <div className="flex items-center justify-between"><span className="text-gray-600">Subtotal</span><span className="font-semibold">{fmtQ(subtotal)}</span></div>
            <div className="flex items-center justify-between"><span className="text-gray-600">IVA (12%)</span><span className="font-semibold">{fmtQ(iva)}</span></div>
            <div className="pt-2 mt-2 border-t flex items-center justify-between text-lg"><span className="font-semibold text-gray-900">Total</span><span className="font-bold text-gray-900">{fmtQ(total)}</span></div>
          </div>
          {!readOnly ? (
            <div className="mt-4 space-y-3">
              <button type="button" onClick={() => handleSave(false)} disabled={!canSave || saving} className="h-11 w-full rounded-lg border px-4 text-base font-semibold hover:bg-gray-50 disabled:opacity-60 flex items-center justify-center gap-2">
                {saving ? <PiSpinnerBold className="animate-spin" /> : <PiFloppyDiskBold />} {saving ? "Guardando..." : "Guardar Borrador"}
              </button>
              <button type="button" onClick={() => handleSave(true)} disabled={!canSave || saving} className="h-11 w-full rounded-lg bg-emerald-600 px-4 text-base font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-2">
                {saving ? <PiSpinnerBold className="animate-spin" /> : <PiPackageBold />} {saving ? "Guardando..." : "Guardar y Aprobar"}
              </button>
              <button type="button" onClick={onClose} className="h-10 w-full rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-red-50 hover:text-red-700 hover:border-red-300">
                Cancelar
              </button>
            </div>
          ) : (
            <div className="mt-6 pt-4 border-t flex justify-end">
              <button type="button" onClick={onClose} className="h-10 rounded-lg border px-4 text-base font-semibold text-gray-700 hover:bg-gray-100">
                Cerrar Vista
              </button>
            </div>
          )}
        </div>
      </section>
    </form>
    </>
  );
}

/* ======================================================================
 * ===== Modal de Insumos Relacionados con Proveedor =====
 * ====================================================================== */
type InsumoRelacionado = {
  id_insumo: number;
  nombre: string;
  categoria?: string;
  stock_actual?: number;
  unidad_medida?: string;
  costo_promedio?: number;
  descripcion_presentacion?: string;
  unidades_por_presentacion?: number;
  es_principal?: boolean;
};



function ProviderInsumosModal({ id_proveedor, proveedorData }: { id_proveedor: number; proveedorData: Proveedor }) {
  const [insumos, setInsumos] = useState<InsumoRelacionado[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Obtener insumos del proveedor desde insumo_presentacion
        const response = await fetch(`${import.meta.env.VITE_API_URL}/compras/proveedores/${id_proveedor}/insumos`, {
          headers: {
            'Authorization': `Bearer ${localStore.get('access_token')}`,
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        if (!mounted) return;

        const data = result.data || [];

        // Mapear los datos para que coincidan con el tipo esperado
        const mappedData = data.map((item: unknown) => {
          const i = item as {
            insumo?: {
              id_insumo?: number;
              nombre_insumo?: string;
              categoria_insumo?: { nombre?: string };
              stock_minimo?: number;
              unidad_base?: string;
              costo_promedio?: number;
            };
            id_insumo?: number;
            descripcion_presentacion?: string;
            unidad_compra?: string;
            costo_compra_unitario?: number;
            unidades_por_presentacion?: number;
            es_principal?: boolean;
          };
          return {
            id_insumo: i.insumo?.id_insumo || i.id_insumo,
            nombre: i.insumo?.nombre_insumo || i.descripcion_presentacion || 'Sin nombre',
            categoria: i.insumo?.categoria_insumo?.nombre || undefined,
            stock_actual: i.insumo?.stock_minimo ?? undefined,
            unidad_medida: i.unidad_compra || i.insumo?.unidad_base || 'unidad',
            costo_promedio: i.costo_compra_unitario ?? i.insumo?.costo_promedio ?? undefined,
            descripcion_presentacion: i.descripcion_presentacion,
            unidades_por_presentacion: i.unidades_por_presentacion,
            es_principal: i.es_principal,
          } as InsumoRelacionado;
        });

        setInsumos(mappedData);
      } catch (e: unknown) {
        let msg = '';
        if (e instanceof Error) msg = e.message;
        else if (typeof e === 'object' && e !== null) msg = JSON.stringify(e);
        else msg = String(e);
        console.error('Provider insumos load error:', msg);
        if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('forbidden') || msg.toLowerCase().includes('policy')) {
          setError('Error de permisos leyendo insumos del proveedor. Verifica políticas RLS.');
        } else {
          setError(msg);
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id_proveedor]);

  return (
    <div className="space-y-6">
      {/* Datos del Proveedor */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Información del Proveedor</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600">Nombre Empresa</label>
            <p className="text-base text-gray-800">{proveedorData.nombre}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600">Nombre Contacto</label>
            <p className="text-base text-gray-800">{proveedorData.contacto || 'No especificado'}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600">Teléfono</label>
            <p className="text-base text-gray-800">{proveedorData.telefono || 'No especificado'}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600">Correo</label>
            <p className="text-base text-gray-800">{proveedorData.correo || 'No especificado'}</p>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-600">Dirección</label>
            <p className="text-base text-gray-800">{proveedorData.direccion || 'No especificada'}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600">Estado</label>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              proveedorData.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {proveedorData.activo ? 'Activo' : 'Inactivo'}
            </span>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600">Preferido</label>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              proveedorData.es_preferido ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {proveedorData.es_preferido ? '⭐ Sí' : 'No'}
            </span>
          </div>
        </div>
      </div>

      {/* Insumos Relacionados */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Insumos Relacionados con el Proveedor</h3>
        {loading && <div className="text-sm text-gray-500">Cargando insumos...</div>}
        {error && <div className="text-sm text-red-600">Error: {error}</div>}
        {!loading && !error && (
          <div className="max-h-[400px] overflow-y-auto border rounded-lg">
            <table className="w-full text-sm table-auto min-w-full">
              <thead className="text-left text-xs text-gray-500 bg-gray-50">
                <tr>
                  <th className="px-3 py-3">#</th>
                  <th className="px-3 py-3">Nombre</th>
                  <th className="px-3 py-3">Presentación</th>
                  <th className="px-3 py-3">Categoría</th>
                  <th className="px-3 py-3 text-right">Unidades x Pres.</th>
                  <th className="px-3 py-3">Unidad</th>
                  <th className="px-3 py-3 text-right">Costo Unit.</th>
                  <th className="px-3 py-3">Principal</th>
                </tr>
              </thead>
              <tbody>
                {insumos.map((insumo, index) => (
                  <tr key={`insumo-${insumo.id_insumo}-${index}`} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}>
                    <td className="px-3 py-3 text-gray-600 font-medium">{index + 1}</td>
                    <td className="px-3 py-3 text-gray-800 font-medium">{insumo.nombre}</td>
                    <td className="px-3 py-3 text-gray-700">{insumo.descripcion_presentacion || '-'}</td>
                    <td className="px-3 py-3 text-gray-700">{insumo.categoria || '-'}</td>
                    <td className="px-3 py-3 text-right text-gray-800">{insumo.unidades_por_presentacion ?? '-'}</td>
                    <td className="px-3 py-3 text-gray-600">{insumo.unidad_medida || '-'}</td>
                    <td className="px-3 py-3 text-right text-gray-800">Q {insumo.costo_promedio?.toFixed(2) ?? '-'}</td>
                    <td className="px-3 py-3 text-center">{insumo.es_principal ? '⭐' : ''}</td>
                  </tr>
                ))}
                {insumos.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-sm text-gray-500 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-gray-400 text-lg">📦</span>
                        No hay insumos registrados para este proveedor.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ======================================================================
 * ===== Tipos adicionales para Recepción y Detalle de Recepción =====
 * ====================================================================== */
type Recepcion = {
  id_recepcion: number;
  id_orden: number;
  fecha_recepcion: string;
  id_perfil: number;
  numero_factura?: string;
};
