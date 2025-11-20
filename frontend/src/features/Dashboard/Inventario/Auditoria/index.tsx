/* ===============================================
 * AUDITORÍA DE INVENTARIO (CONTEO FÍSICO)
 * - Filtros estilo Catálogo (arriba)
 * - Tabs: Operativos / Perpetuos (se elimina "Todos")
 * - Paginación inferior: "Mostrando N de Y · Por página [10] · Anterior 1/7 Siguiente"
 * - Abre el modal de "Iniciar Auditoría" automáticamente si no hay sesión
 * =============================================== */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../Inventario.css";
import "./Auditoria.css";
import { MdCheckCircle, MdEventNote, MdErrorOutline } from "react-icons/md";
import { FaUserCircle } from "react-icons/fa";
import { PiBroomBold } from "react-icons/pi";
import { message } from "antd";
import { useAuth } from "../../../../hooks/useAuth";
import { supabase } from "../../../../api/supabaseClient";
import { localStore } from "../../../../utils/storage";

/* ======================= Tipos ======================= */
type Row = {
  id_detalle?: number; // ID de auditoria_detalle
  id_insumo: number;
  insumo: string;
  categoria: string | null;
  unidad: string | null;
  tipo_insumo: "operativo" | "perpetuo" | "desconocido";
  esperado: number;
  contado: number | null;
  diferencia: number;
  estado: "pendiente" | "contado";
  observacion: string;
  fue_contado?: boolean | null;
  id_tipo_ajuste: number | null;
  causa_nombre: string | null;
};

// Tipo para los datos que vienen de Supabase
type SupabaseAuditoriaDetalle = {
  id_detalle: number;
  id_insumo: number;
  tipo_categoria: string;
  stock_esperado: number;
  conteo_fisico: number | null;
  diferencia: number | null;
  causa_ajuste: string | null;
  notas: string | null;
  insumo?: 
    | {
        nombre_insumo: string;
        unidad_base: string;
        categoria_insumo?: { nombre: string } | { nombre: string }[];
      }
    | {
        nombre_insumo: string;
        unidad_base: string;
        categoria_insumo?: { nombre: string } | { nombre: string }[];
      }[];
};

// Mock de causas/ajustes (puedes sustituir por tu tabla real)
const TIPOS_AJUSTE = [
  { id: 1, nombre: "Merma (Dañado/Vencido)", tipo: "salida", aplica_a: "operativo" },
  { id: 2, nombre: "Faltante (Pérdida/Robo)", tipo: "salida", aplica_a: "operativo" },
  { id: 3, nombre: "Consumo Operativo (Gasto)", tipo: "salida", aplica_a: "perpetuo" },
  { id: 4, nombre: "Sobrante (Conteo)", tipo: "entrada", aplica_a: "todos" },
  { id: 5, nombre: "Error de Sistema", tipo: "entrada", aplica_a: "todos" },
];

type AuditoriaProps = {
  initialSessionId?: string;
  auditorName?: string;
};

/* ======================= Seed (demo) - ELIMINADO ======================= */
// Los datos ahora se cargan directamente desde la base de datos

/* ============ Utilidades comunes ============ */
function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}
function csvEscape(v: unknown): string {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

function buildPrintHtml(title: string, tableHtml: string, subtitle?: string) {
  const fecha = new Date().toLocaleString();
  return `<!doctype html><html><head><meta charset="utf-8"/>
<title>${title}</title>
<style>
:root { color-scheme: light; }
body{font-family: Arial, Helvetica, sans-serif; color:#111; margin:20px}
.header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.brand{display:flex;gap:12px;align-items:center}
.brand img{height:56px}
h2{margin:0 0 4px 0}.meta{font-size:13px;color:#444}
table{width:100%;border-collapse:collapse;margin-top:12px; margin-bottom: 24px;}
th,td{padding:8px;border:1px solid #e5e7eb;text-align:left;font-size:13px; vertical-align: top;}
th{background:#f3f4f6;color:#111}tbody tr:nth-child(even){background:#fbfbfb}
.footer{margin-top:16px;font-size:12px;color:#666}@media print{ .no-print{display:none} }
h3.table-title{margin: 24px 0 8px 0; font-size: 1.1em; color: #333;}
</style></head>
<body>
<div class="header">
  <div class="brand"><img src="/img/logo.png"/><div><h2>${title}</h2><div class="meta">${subtitle ?? ""}</div></div></div>
  <div style="text-align:right"><div class="meta">Fecha: ${fecha}</div></div>
</div>
${tableHtml}
<div class="footer">Generado desde Shucway - Auditoría</div>
<script>setTimeout(function(){ window.print(); }, 350);</script>
</body></html>`;
}

function openPrintWindow(html: string) {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}

function calcDiferencia(r: Row): Row {
  const c = r.contado;
  const diff = typeof c === "number" ? Number((c - r.esperado).toFixed(2)) : 0;
  const counted = typeof c === "number";
  const esCero = !counted || diff === 0;
  return {
    ...r,
    diferencia: counted ? diff : 0,
    estado: counted ? "contado" : "pendiente",
    fue_contado: r.fue_contado ?? counted,
    id_tipo_ajuste: esCero ? null : r.id_tipo_ajuste,
    causa_nombre: esCero ? null : r.causa_nombre,
  };
}

function isVolumetricUnit(u?: string | null): boolean {
  if (!u) return false;
  const v = u.toLowerCase();
  return ["lb", "kg", "lt", "l", "ml", "g"].includes(v);
}

/* ===== Helpers seguros ===== */
function readString(obj: unknown, key: string): string | null {
  if (obj && typeof obj === "object" && key in obj) {
    const val = (obj as Record<string, unknown>)[key];
    if (typeof val === "string") return val;
  }
  return null;
}
function getUserDisplayName(u: unknown, fallback?: string): string {
  if (u && typeof u === "object" && "user_metadata" in u) {
    const meta = (u as Record<string, unknown>)["user_metadata"];
    if (meta && typeof meta === "object") {
      const fn = readString(meta, "full_name");
      if (fn) return fn;
    }
  }
  return (
    readString(u, "name") ??
    readString(u, "username") ??
    readString(u, "email") ??
    fallback ??
    "—"
  );
}

/* =================== Componente =================== */
const Auditoria: React.FC<AuditoriaProps> = ({ initialSessionId, auditorName }) => {
  const { user } = useAuth();

  // Sesión - Restaurar desde localStorage si existe
  const [sessionId, setSessionId] = useState<string | undefined>(() => {
    if (initialSessionId) return initialSessionId;
    // Intentar restaurar auditoría activa desde localStorage
    const stored = localStore.get('auditoria_activa');
    return stored || undefined;
  });
  const [sessionDate, setSessionDate] = useState<string | undefined>();
  const [sessionLabel, setSessionLabel] = useState<string | undefined>();
  const [sessionEstado, setSessionEstado] = useState<'en_progreso' | 'completada' | 'cancelada'>('en_progreso');

  // Estado UI
  const [rows, setRows] = useState<Row[]>([]);

  // ===== Tabs (sin "Todos") =====
  const TABS = [
    { id: "operativos", label: "Solo Operativos" },
    { id: "perpetuos", label: "Solo Perpetuos" },
  ] as const;
  type TabId = (typeof TABS)[number]["id"];
  const [activeTab, setActiveTab] = useState<TabId>("operativos");

  // Filtros
  const [categoria, setCategoria] = useState<string>("Todas las categorías");
  const [term, setTerm] = useState<string>("");

  const categoriasOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => { if (r.categoria && r.categoria.trim()) set.add(r.categoria); });
    return ["Todas las categorías", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [rows]);

  const clearFilters = () => {
    setActiveTab("operativos");
    setCategoria("Todas las categorías");
    setTerm("");
  };

  // ===== Export modal =====
  const [showExport, setShowExport] = useState(false);

  // ===== Modal "Iniciar Auditoría" =====
  const [showStartModal, setShowStartModal] = useState(false);
  const [auditLabel, setAuditLabel] = useState("");
  const [auditStartDate, setAuditStartDate] = useState(() => getTodayDate());
  const [auditEndDate, setAuditEndDate] = useState(() => getTodayDate());

  // Abre modal de bienvenida auto si no hay sesión activa
  useEffect(() => {
    // Solo abrir modal si NO hay auditoría activa (ni en props ni en localStorage)
    const storedAudit = localStore.get('auditoria_activa');
    if (!initialSessionId && !storedAudit) {
      setShowStartModal(true);
    }
    
    // Restaurar datos de auditoría desde localStorage
    if (storedAudit && !initialSessionId) {
      const storedLabel = localStore.get('auditoria_label');
      const storedFecha = localStore.get('auditoria_fecha');
      const storedEstado = localStore.get('auditoria_estado') as 'en_progreso' | 'completada' | 'cancelada' | null;
      
      if (storedLabel) setSessionLabel(storedLabel);
      if (storedFecha) setSessionDate(storedFecha);
      if (storedEstado) setSessionEstado(storedEstado);
    }
  }, [initialSessionId]);

  // ===== Modal "Finalizar" =====
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [optComentario, setOptComentario] = useState<string>("");
  const [isStarting, setIsStarting] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

  // ===== Modales de Cancelación =====
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false);
  const [showCancelSuccessModal, setShowCancelSuccessModal] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const [isCanceling, setIsCanceling] = useState(false);
  const navigate = useNavigate();
  const [notif, setNotif] = useState<{ type: "info" | "success" | "error"; msg: string } | null>(null);
  const notify = useCallback((type: "info" | "success" | "error", msg: string) => {
    setNotif({ type, msg });
    setTimeout(() => setNotif(null), 2600);
  }, [setNotif]);

  // Interceptar navegación mediante click en enlaces/botones del sidebar
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // No interceptar si es navegación desde el widget de auditoría
      if ((window as { auditoriaWidgetNavigating?: boolean }).auditoriaWidgetNavigating) {
        console.log('✅ Navegación desde widget de auditoría, no interceptar');
        return;
      }
      
      // Solo interceptar si hay auditoría activa
      if (!sessionId || sessionEstado !== 'en_progreso') return;

      // Buscar si el click es en un enlace de navegación
      const target = e.target as HTMLElement;
      
      // NO interceptar clicks en el widget de auditoría del sidebar
      const auditoriaWidget = target.closest('.auditoria-quick-widget');
      if (auditoriaWidget) {
        console.log('✅ Click en widget de auditoría, no interceptar');
        return;
      }
      
      const link = target.closest('a[href], button[data-navigate]');
      
      if (link) {
        const href = link.getAttribute('href');
        const navPath = link.getAttribute('data-navigate');
        const targetPath = href || navPath;
        
        console.log('🔍 Interceptor detectó click:', {
          targetPath,
          sessionId,
          sessionEstado,
          includes: targetPath?.includes('/inventario')
        });
        
        // NO interceptar si:
        // 1. Va hacia la página de auditoría (permite continuar)
        // 2. Ya estamos en la página de inventario con tab auditoria
        if (targetPath && (
          targetPath.includes('/inventario?tab=auditoria') ||
          targetPath.includes('/inventario/auditoria')
        )) {
          console.log('✅ Permitiendo navegación a auditoría');
          return; // Permitir navegación sin bloquear
        }
        
        // Si es una navegación a otro módulo, mostrar modal de confirmación
        if (targetPath) {
          console.log('🚫 Bloqueando navegación a:', targetPath);
          e.preventDefault();
          e.stopPropagation();
          
          // Guardar la función de navegación
          setPendingNavigation(() => () => navigate(targetPath));
          setShowCancelConfirmModal(true);
          notify("info", "Tienes una auditoría en curso. Puedes guardar los cambios o continuar más tarde.");
        }
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [sessionId, sessionEstado, navigate, notify]);

  const detectedName = getUserDisplayName(user, auditorName);

  // Refs
  const lastLoadAbort = useRef<AbortController | null>(null);

  /* ============== Derivados / filtros ============== */
  const baseFilteredRows = useMemo(() => {
    let r = [...rows];
    if (categoria !== "Todas las categorías") {
      r = r.filter((x) => (x.categoria ?? "").toLowerCase() === categoria.toLowerCase());
    }
    const q = term.trim().toLowerCase();
    if (q) {
      r = r.filter(
        (x) =>
          x.insumo.toLowerCase().includes(q) ||
          (x.categoria ?? "").toLowerCase().includes(q) ||
          (x.unidad ?? "").toLowerCase().includes(q)
      );
    }
    return r;
  }, [rows, categoria, term]);

  const operativosRows = useMemo(
    () => baseFilteredRows.filter((r) => r.tipo_insumo === "operativo"),
    [baseFilteredRows]
  );
  const perpetuosRows = useMemo(
    () => baseFilteredRows.filter((r) => r.tipo_insumo === "perpetuo" || r.tipo_insumo === "desconocido"),
    [baseFilteredRows]
  );

  // ===== Contadores y totales SOLO del tab activo =====
  const totalCount = useMemo(
    () => (activeTab === "operativos" ? operativosRows.length : perpetuosRows.length),
    [activeTab, operativosRows.length, perpetuosRows.length]
  );
  const counted = useMemo(() => {
    const list = activeTab === "operativos" ? operativosRows : perpetuosRows;
    return list.filter((r) => typeof r.contado === "number").length;
  }, [activeTab, operativosRows, perpetuosRows]);
  const discrepancies = useMemo(() => {
    const list = activeTab === "operativos" ? operativosRows : perpetuosRows;
    return list.filter((r) => Math.abs(r.diferencia) !== 0 && r.id_tipo_ajuste != null).length;
  }, [activeTab, operativosRows, perpetuosRows]);

  // ===== Paginación =====
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState<number>(1);

  // Cambios de filtros/tabs reinician a página 1
  useEffect(() => { setPage(1); }, [activeTab, categoria, term]);

  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(page, pageCount);
  const startIdx = (currentPage - 1) * pageSize;
  const endIdx = startIdx + pageSize;

  const currentTabData = activeTab === "operativos" ? operativosRows : perpetuosRows;
  const pageRows = useMemo(
    () => currentTabData.slice(startIdx, endIdx),
    [currentTabData, startIdx, endIdx]
  );

  /* ============== Carga ============== */
  async function loadRows(search: string) {
    if (!sessionId) {
      setRows([]);
      return;
    }

    // Validar que sessionId sea un número válido
    const idAuditoria = parseInt(sessionId, 10);
    if (isNaN(idAuditoria)) {
      console.error("sessionId no es un número válido:", sessionId);
      setRows([]);
      return;
    }

    try {
      lastLoadAbort.current?.abort();
      const ac = new AbortController();
      lastLoadAbort.current = ac;

      // Cargar estado de la auditoría desde BD
      const { data: auditoriaData, error: auditoriaError } = await supabase
        .from('auditoria_inventario')
        .select('estado, nombre_auditoria, fecha_inicio_auditoria')
        .eq('id_auditoria', idAuditoria)
        .single();

      if (!auditoriaError && auditoriaData) {
        setSessionEstado(auditoriaData.estado as 'en_progreso' | 'completada' | 'cancelada');
        if (auditoriaData.nombre_auditoria) setSessionLabel(auditoriaData.nombre_auditoria);
        if (auditoriaData.fecha_inicio_auditoria) setSessionDate(auditoriaData.fecha_inicio_auditoria);
        // Actualizar localStorage también
        localStore.set('auditoria_estado', auditoriaData.estado);
      }

      // Cargar desde el backend endpoint (respeta RLS)
      const token = localStore.get("access_token");
      console.log('🔍 Token obtenido:', token ? 'Presente' : 'Ausente');
      console.log('🔍 URL de API:', import.meta.env.VITE_API_URL);
      console.log('🔍 ID de auditoría:', idAuditoria);

      // Primero probar autenticación
      try {
        const testResponse = await fetch(`${import.meta.env.VITE_API_URL}/auditoria/test-auth`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        console.log('🔍 Test auth response:', testResponse.status);
        if (testResponse.ok) {
          const testData = await testResponse.json();
          console.log('🔍 Test auth data:', testData);
        } else {
          console.error('❌ Test auth failed:', testResponse.status);
        }
      } catch (testError) {
        console.error('❌ Test auth error:', testError);
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/auditoria/detalle/${idAuditoria}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          signal: ac.signal,
        }
      );

      if (!response.ok) {
        console.error("Error cargando detalles de auditoría:", response.status);
        notify("error", `Error al cargar detalles: ${response.status}`);
        setRows([]);
        return;
      }

      const data = await response.json();

      if (!Array.isArray(data) || data.length === 0) {
        console.log("No hay datos de auditoría");
        setRows([]);
        return;
      }

      // Mapear los datos al formato Row
      const mapped: Row[] = data
        .filter((d: SupabaseAuditoriaDetalle) => d.insumo) // Solo insumos válidos
        .map((d: SupabaseAuditoriaDetalle) => {
          // Backend puede devolver insumo como objeto o array, normalizar
          const insumoData = Array.isArray(d.insumo) ? d.insumo[0] : d.insumo;
          const nombreInsumo = insumoData?.nombre_insumo || "Sin nombre";
          const unidadBase = insumoData?.unidad_base || "";
          
          // categoria_insumo también puede ser array
          const categoriaData = Array.isArray(insumoData?.categoria_insumo) 
            ? insumoData.categoria_insumo[0] 
            : insumoData?.categoria_insumo;
          const nombreCategoria = categoriaData?.nombre || "";
          
          const contado = d.conteo_fisico == null ? null : Number(d.conteo_fisico);
          const tipo: Row["tipo_insumo"] =
            String(d.tipo_categoria).toLowerCase() === "operativo"
              ? "operativo"
              : String(d.tipo_categoria).toLowerCase() === "perpetuo"
              ? "perpetuo"
              : "desconocido";

          return {
            id_detalle: d.id_detalle,
            id_insumo: d.id_insumo,
            insumo: nombreInsumo,
            categoria: nombreCategoria,
            unidad: unidadBase,
            tipo_insumo: tipo,
            esperado: Number(d.stock_esperado ?? 0),
            contado,
            diferencia: contado !== null ? Number(contado) - Number(d.stock_esperado ?? 0) : 0,
            estado: contado !== null ? "contado" : "pendiente",
            observacion: d.notas || "",
            fue_contado: contado !== null,
            id_tipo_ajuste: null,
            causa_nombre: d.causa_ajuste || null,
          };
        });

      // Filtrar por búsqueda si existe
      const filtered = search.trim()
        ? mapped.filter((r) =>
            r.insumo.toLowerCase().includes(search.trim().toLowerCase())
          )
        : mapped;

      setRows(filtered.map(calcDiferencia));
      console.log(`Cargados ${filtered.length} insumos de ${mapped.length} totales`);
    } catch (err) {
      console.error("Error en loadRows:", err);
      notify("error", "Error al cargar datos");
      setRows([]);
    }
  }

  useEffect(() => {
    if (!sessionId) return;
    const t = setTimeout(() => {
      void loadRows(term);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, sessionId]);

  /* ============== Handlers ============== */
  function handleConteoChange(id_insumo: number, value: string) {
    const v = value === "" ? null : Number(value);
    setRows((prev) =>
      prev.map((r) =>
        r.id_insumo === id_insumo ? calcDiferencia({ ...r, contado: v, fue_contado: v != null }) : r
      )
    );
  }

  function handleNotasChange(id_insumo: number, value: string) {
    setRows((prev) => prev.map((r) => (r.id_insumo === id_insumo ? { ...r, observacion: value } : r)));
  }

  function handleCausaChange(id_insumo: number, value: string) {
    const selectedId = Number(value) || null;
    const causa = TIPOS_AJUSTE.find((c) => c.id === selectedId);
    setRows((prev) =>
      prev.map((r) =>
        r.id_insumo === id_insumo
          ? {
              ...r,
              id_tipo_ajuste: causa?.id ?? null,
              causa_nombre: causa?.nombre ?? null,
            }
          : r
      )
    );
  }

  async function handleBlurSave(id_insumo: number) {
    const row = rows.find((r) => r.id_insumo === id_insumo);
    if (!row) return;

    if (!sessionId) {
      notify("info", "Sesión demo: cambios guardados localmente.");
      return;
    }

    // Validar que sessionId sea un número válido
    const idAuditoria = parseInt(sessionId, 10);
    if (isNaN(idAuditoria)) {
      notify("error", "ID de auditoría inválido");
      return;
    }

    // Obtener id_perfil del usuario autenticado
    const userId = user && typeof user === 'object' && 'id_perfil' in user 
      ? (user.id_perfil as number) 
      : null;

    if (!userId) {
      notify("error", "No se pudo obtener el perfil del usuario");
      return;
    }

    // Usar fn_actualizar_conteo_auditoria
    const { error } = await supabase.rpc("fn_actualizar_conteo_auditoria", {
      p_id_auditoria: idAuditoria,
      p_id_insumo: row.id_insumo,
      p_conteo_fisico: row.contado,
      p_causa_ajuste: row.causa_nombre,
      p_notas: row.observacion,
      p_id_perfil: userId,
    });

    if (error)
      notify(
        "error",
        `Error guardando línea: ${String((error as { message?: string }).message ?? error)}`
      );
    else notify("success", "Línea guardada.");
  }

  async function startAudit() {
    setIsStarting(true);

    try {
      // Validar campos antes de enviar
      if (!auditLabel.trim()) {
        notify("error", "El nombre de auditoría es requerido");
        return;
      }

      if (!auditStartDate || !auditEndDate) {
        notify("error", "Las fechas de período son requeridas");
        return;
      }

      // Validar que fechaInicioPeriodo no sea anterior a hoy (permite hoy)
      const today = new Date();
      today.setHours(23, 59, 59, 999); // Fin del día de hoy
      const startDate = new Date(auditStartDate);
      
      if (startDate > today) {
        notify("error", "La fecha de inicio no puede ser posterior a hoy");
        return;
      }

      // Validar que fechaInicioPeriodo no sea posterior a fechaFinPeriodo
      if (new Date(auditStartDate) > new Date(auditEndDate)) {
        notify("error", "La fecha de inicio no puede ser posterior a la fecha fin");
        return;
      }

      // Obtener ID del usuario autenticado - DEBE existir
      let userId: number | null = null;
      
      // Primero intentar desde el objeto user si tiene id_perfil directo
      if (user && typeof user === 'object' && 'id_perfil' in user) {
        userId = user.id_perfil as number;
      }
      
      // Si no está, el usuario no tiene perfil válido
      if (!userId) {
        notify("error", "No se pudo obtener el perfil del usuario. Por favor, inicie sesión nuevamente.");
        console.error("Usuario sin id_perfil:", user);
        return;
      }
      
      console.log("Usuario autenticado:", user);
      console.log("ID de perfil para auditoría:", userId);
      console.log("Datos a enviar:", {
        p_nombre_auditoria: auditLabel.trim(),
        p_fecha_inicio_periodo: auditStartDate,
        p_fecha_fin_periodo: auditEndDate,
        p_id_perfil: userId,
      });

      // Validar que userId sea un número válido
      if (!userId || isNaN(userId)) {
        notify("error", "ID de perfil inválido. Por favor, inicie sesión nuevamente.");
        console.error("userId inválido:", userId);
        return;
      }

      // Llamar a la función fn_iniciar_auditoria de la BD
      const { data, error } = await supabase.rpc("fn_iniciar_auditoria", {
        p_nombre_auditoria: auditLabel.trim(),
        p_fecha_inicio_periodo: auditStartDate,
        p_fecha_fin_periodo: auditEndDate,
        p_id_perfil: userId,
      });

      if (error) {
        console.error("Error completo iniciando auditoría:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          error: error,
        });
        notify("error", `Error: ${error.message || error.details || "Error desconocido"}`);
        return;
      }

      if (!data) {
        notify("error", "No se recibió ID de auditoría");
        return;
      }

      // data es el id_auditoria retornado
      const idAuditoria = String(data);
      setSessionId(idAuditoria);
      setSessionDate(new Date().toISOString());
      setSessionLabel(auditLabel);
      setSessionEstado('en_progreso');
      
      // ✅ PERSISTIR EN LOCALSTORAGE
      localStore.set('auditoria_activa', idAuditoria);
      localStore.set('auditoria_label', auditLabel);
      localStore.set('auditoria_fecha', new Date().toISOString());
      localStore.set('auditoria_estado', 'en_progreso');
      
      // ✅ DISPARAR EVENTO PARA ACTUALIZAR CONTADOR
      window.dispatchEvent(new Event('auditoria-changed'));
      
      notify("success", "Auditoría iniciada correctamente.");
      
      // Cargar datos de auditoria_detalle
      void loadRows("");
      setShowStartModal(false);
    } catch (err) {
      console.error("Error en startAudit:", err);
      notify("error", "Error al iniciar auditoría. Intente nuevamente.");
    } finally {
      setIsStarting(false);
    }
  }

  function markNoDiff() {
    setRows((prev) =>
      prev.map((r) => calcDiferencia({ ...r, contado: r.esperado, fue_contado: true }))
    );
    notify("info", "Se marcaron todos los ítems como sin diferencias.");
  }

  function resetConteo() {
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        contado: null,
        diferencia: 0,
        estado: "pendiente",
        fue_contado: false,
        id_tipo_ajuste: null,
        causa_nombre: null,
      }))
    );
    notify("info", "Conteos reiniciados.");
  }

  function exportCSV() {
    const headers = [
      "Insumo",
      "Categoría",
      "Unidad",
      "Tipo",
      "Esperado",
      "Conteo Físico",
      "Diferencia",
      "Causa",
      "Notas",
    ];
    const out: string[] = [headers.map(csvEscape).join(",")];
    const src = activeTab === "operativos" ? operativosRows : perpetuosRows;
    src.forEach((r) => {
      out.push(
        [
          r.insumo,
          r.categoria ?? "",
          r.unidad ?? "",
          r.tipo_insumo,
          r.esperado,
          r.contado ?? "",
          r.diferencia,
          r.causa_nombre ?? "",
          r.observacion,
        ]
          .map(csvEscape)
          .join(",")
      );
    });
    const blob = new Blob([out.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria_inventario_${sessionId ?? "reporte"}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExport(false);
  }

  function exportPDF() {
    const makeTableHtml = (title: string, data: Row[]) => {
      if (data.length === 0) return "";
      const headerHtml = `<thead><tr>
        <th>Insumo</th><th>Categoría</th><th>Unidad</th>
        <th>Esperado</th><th>Conteo Físico</th><th>Diferencia</th><th>Causa</th><th>Notas</th>
      </tr></thead>`;
      const bodyHtml = `<tbody>${data
        .map(
          (r) => `
        <tr><td>${r.insumo}</td><td>${r.categoria ?? ""}</td><td>${r.unidad ?? ""}</td>
        <td>${r.esperado}</td><td>${r.contado ?? ""}</td><td>${r.diferencia}</td>
        <td>${r.causa_nombre ?? ""}</td><td>${r.observacion}</td></tr>
      `
        )
        .join("")}</tbody>`;
      return `<h3 class="table-title">${title}</h3><table>${headerHtml}${bodyHtml}</table>`;
    };

    const tableHtml =
      activeTab === "operativos"
        ? makeTableHtml("Insumos Operativos (Merma/Ajuste)", operativosRows)
        : makeTableHtml("Insumos Perpetuos (Consumo)", perpetuosRows);

    const subtitle = `Auditor: ${detectedName} · Sesión: ${sessionId ?? "—"}${
      sessionDate ? " · " + new Date(sessionDate).toLocaleString() : ""
    }`;
    const html = buildPrintHtml("Auditoría de Inventario", tableHtml, subtitle);
    setShowExport(false);
    openPrintWindow(html);
  }

  async function finalizeAudit() {
    if (!sessionId) {
      notify("info", "Sesión demo: se generará únicamente el resumen imprimible.");
    }
    setIsFinalizing(true);

    try {
      const diffsFinal = rows.filter(
        (r) => typeof r.contado === "number" && r.diferencia !== 0 && r.id_tipo_ajuste != null
      );
      const diffsIgnoradas = rows.filter(
        (r) => typeof r.contado === "number" && r.diferencia !== 0 && r.id_tipo_ajuste == null
      );

      // Llamar a fn_completar_auditoria
      if (sessionId) {
        const idAuditoria = parseInt(sessionId, 10);
        if (isNaN(idAuditoria)) {
          notify("error", "ID de auditoría inválido");
          return;
        }

        // Obtener id_perfil del usuario autenticado
        const userId = user && typeof user === 'object' && 'id_perfil' in user 
          ? (user.id_perfil as number) 
          : null;

        if (!userId) {
          notify("error", "No se pudo obtener el perfil del usuario");
          return;
        }

        const { error: completarError } = await supabase.rpc("fn_completar_auditoria", {
          p_id_auditoria: idAuditoria,
          p_id_perfil: userId,
        });

        if (completarError) {
          console.error("Error al completar auditoría:", completarError);
          notify("error", `Error al completar auditoría: ${completarError.message || "Error desconocido"}`);
          return;
        } else {
          notify("success", "Auditoría completada correctamente.");
        }
      }

      // Resumen imprimible
      const allDiffs = [...diffsFinal, ...diffsIgnoradas];
      const headerHtml =
        `<thead><tr><th>Insumo</th><th>Tipo</th><th>Esperado</th><th>Conteo</th><th>Diferencia</th><th>Estado</th><th>Causa/Notas</th></tr></thead>`;
      const bodyHtml = `<tbody>${allDiffs
        .map((d) => {
          const esRegistrada = d.id_tipo_ajuste != null;
          return `
          <tr style="${!esRegistrada ? "color:#777; background:#f9f9f9;" : ""}">
            <td>${d.insumo}</td>
            <td>${d.tipo_insumo}</td>
            <td>${d.esperado}</td>
            <td>${d.contado ?? ""}</td>
            <td>${d.diferencia.toFixed(2)}</td>
            <td>${esRegistrada ? "APLICADO" : "IGNORADO (Sin Causa)"}</td>
            <td><b>${d.causa_nombre ?? ""}</b> ${d.observacion}</td>
          </tr>`;
        })
        .join("")}</tbody>`;

      const tableHtml =
        allDiffs.length > 0 ? `<table>${headerHtml}${bodyHtml}</table>` : "<p>No hay diferencias.</p>";

      const pdfSubtitle = [`Sesión: ${sessionLabel ?? sessionId}`, optComentario ? `Motivo: ${optComentario}` : ""]
        .filter(Boolean)
        .join(" · ");

      const summaryHtml = buildPrintHtml("Resumen de Ajuste - Auditoría", tableHtml, pdfSubtitle);
      openPrintWindow(summaryHtml);

      // Reset UI
      setShowFinalizeModal(false);
      setSessionId(undefined);
      setSessionDate(undefined);
      setSessionLabel(undefined);
      setSessionEstado('en_progreso');
      setTerm("");
      setRows([]);
      setAuditLabel("");
      setAuditStartDate(getTodayDate());
      setAuditEndDate(getTodayDate());
      setOptComentario("");
      clearFilters();
      
      // ✅ LIMPIAR LOCALSTORAGE
      localStore.set('auditoria_activa', '');
      localStore.set('auditoria_label', '');
      localStore.set('auditoria_fecha', '');
      localStore.set('auditoria_estado', '');
      
      // ✅ DISPARAR EVENTO PARA ACTUALIZAR CONTADOR
      window.dispatchEvent(new Event('auditoria-changed'));
      
      notify("success", "Auditoría finalizada.");

      if (pendingNavigation) {
        pendingNavigation();
        setPendingNavigation(null);
      }
    } catch {
      notify("error", "Error al finalizar la auditoría.");
    } finally {
      setIsFinalizing(false);
    }
  }

  // ===== Función para Cancelar Auditoría =====
  async function cancelAudit() {
    if (!sessionId) {
      notify("error", "No hay auditoría activa para cancelar");
      return;
    }

    setIsCanceling(true);

    try {
      const token = localStore.get('access_token');
      if (!token) {
        notify("error", "No se encontró el token de autenticación");
        return;
      }

      const response = await fetch(`http://localhost:3002/api/auditoria/cancelar/${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          motivo: 'Cancelada por el usuario al salir del módulo'
        }),
      });

      // Si la auditoría no existe (404) o hay error del servidor, aún limpiamos el estado local
      if (!response.ok) {
        if (response.status === 404) {
          console.warn('Auditoría no encontrada en el servidor, limpiando estado local');
        } else {
          console.error('Error del servidor al cancelar auditoría:', response.status);
        }
      } else {
        const result = await response.json();
        console.log('Auditoría cancelada exitosamente:', result);
      }

      // Limpiar estado local independientemente del resultado del servidor
      setSessionEstado('cancelada');
      localStore.set('auditoria_estado', 'cancelada');

      // Limpiar sesión
      setSessionId(undefined);
      setSessionDate(undefined);
      setSessionLabel(undefined);
      setRows([]);
      localStore.set('auditoria_activa', '');
      localStore.set('auditoria_label', '');
      localStore.set('auditoria_fecha', '');
      localStore.set('auditoria_estado', 'cancelada');

      // Mostrar modal de éxito
      setShowCancelConfirmModal(false);
      setShowCancelSuccessModal(true);
      
      // ✅ DISPARAR EVENTO PARA ACTUALIZAR CONTADOR
      window.dispatchEvent(new Event('auditoria-changed'));
      
      notify("success", "Auditoría cancelada correctamente");
      
    } catch (error) {
      console.error("Error cancelando auditoría:", error);
      
      message.error(`Error cancelando auditoría. ${error instanceof Error ? error.message : String(error)}`);
      
      // Aún si hay error de red, limpiamos el estado local
      setSessionEstado('cancelada');
      localStore.set('auditoria_estado', 'cancelada');
      setSessionId(undefined);
      setSessionDate(undefined);
      setSessionLabel(undefined);
      setRows([]);
      localStore.set('auditoria_activa', '');
      localStore.set('auditoria_label', '');
      localStore.set('auditoria_fecha', '');
      localStore.set('auditoria_estado', 'cancelada');
      
      setShowCancelConfirmModal(false);
      setShowCancelSuccessModal(true);
      window.dispatchEvent(new Event('auditoria-changed'));
      
      notify("info", "Auditoría cancelada localmente (error de conexión)");
    } finally {
      setIsCanceling(false);
    }
  }

  // ===== Manejar Continuar sin Cancelar =====
  function handleContinueWithoutCancel() {
    setShowCancelConfirmModal(false);
    
    // Si hay navegación pendiente, ejecutarla
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
  }

  // ===== Cerrar modal de éxito y navegar =====
  function handleCloseCancelSuccess() {
    setShowCancelSuccessModal(false);
    
    // Si hay navegación pendiente, ejecutarla
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
  }

  /* ============== Render helpers ============== */
  function causasAplicables(row: Row) {
    const tipoDiff = row.diferencia > 0 ? "entrada" : "salida";
    return TIPOS_AJUSTE.filter(
      (c) => (c.aplica_a === "todos" || c.aplica_a === row.tipo_insumo) && c.tipo === tipoDiff
    );
  }

  function renderTable(data: Row[], title: string) {
    return (
      <>
        <h3 className="auditoria-table-title">{title}</h3>
        {data.length > 0 ? (
          <div className="auditoria-table">
            <table className="inv-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Insumo</th>
                  <th>Unidad</th>
                  <th>Esperado</th>
                  <th>Conteo Físico</th>
                  <th>Diferencia</th>
                  <th>Causa (si aplica)</th>
                  <th>Notas</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r) => {
                  const isCounted = !!(r.fue_contado || r.contado != null);
                  const step = isVolumetricUnit(r.unidad) ? 0.01 : 1;
                  const hasDiff = isCounted && r.diferencia !== 0;
                  const causas = hasDiff ? causasAplicables(r) : [];

                  return (
                    <tr key={r.id_insumo}>
                      <td>
                        {r.insumo}
                        <div style={{ fontSize: "0.8em", color: "#666" }}>{r.categoria ?? ""}</div>
                      </td>
                      <td>{r.unidad ?? ""}</td>
                      <td>{r.esperado}</td>
                      <td>
                        <input
                          type="number"
                          step={step}
                          value={r.contado ?? ""}
                          onChange={(e) => handleConteoChange(r.id_insumo, e.target.value)}
                          onBlur={() => handleBlurSave(r.id_insumo)}
                          className={`p-1 border rounded w-28 ${isCounted ? "counted" : ""}`}
                          style={isCounted ? { background: "#ecfdf5", borderColor: "#a7f3d0" } : undefined}
                        />
                      </td>
                      <td>
                        <span
                          className={`diff-cell ${
                            hasDiff ? (r.diferencia > 0 ? "diff-positive" : "diff-negative") : "diff-zero"
                          }`}
                        >
                          {isCounted
                            ? r.diferencia > 0
                              ? `+${r.diferencia.toFixed(2)}`
                              : r.diferencia.toFixed(2)
                            : ""}
                        </span>
                      </td>

                      <td>
                        {hasDiff ? (
                          <select
                            value={r.id_tipo_ajuste ?? ""}
                            onChange={(e) => handleCausaChange(r.id_insumo, e.target.value)}
                            className="p-1 border rounded w-full"
                            style={{ minWidth: "150px" }}
                          >
                            <option value="">-- Justificar diferencia --</option>
                            {causas.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.nombre}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span style={{ color: "#999" }}>—</span>
                        )}
                      </td>

                      <td>
                        <input
                          className="p-1 border rounded w-full"
                          placeholder="Observaciones"
                          value={r.observacion}
                          onChange={(e) => handleNotasChange(r.id_insumo, e.target.value)}
                          onBlur={() => handleBlurSave(r.id_insumo)}
                          style={{ minWidth: "150px" }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white rounded-xl border p-4 mt-2 mb-4 text-center text-gray-500 text-sm">
            No hay insumos para mostrar (o no coinciden con los filtros).
          </div>
        )}
      </>
    );
  }

  /* ============== Render ============== */
  return (
    <div className="inv-list">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <h3 style={{ margin: 0 }}>AUDITORÍA DE INVENTARIO (CONTEO FÍSICO)</h3>
        {sessionId && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: '999px',
              fontSize: '12px',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              background: sessionEstado === 'en_progreso' 
                ? '#dbeafe' 
                : sessionEstado === 'completada' 
                ? '#d1fae5' 
                : '#fee2e2',
              color: sessionEstado === 'en_progreso' 
                ? '#1e40af' 
                : sessionEstado === 'completada' 
                ? '#065f46' 
                : '#991b1b',
              border: `1px solid ${sessionEstado === 'en_progreso' 
                ? '#93c5fd' 
                : sessionEstado === 'completada' 
                ? '#6ee7b7' 
                : '#fca5a5'}`,
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: sessionEstado === 'en_progreso' 
                  ? '#3b82f6' 
                  : sessionEstado === 'completada' 
                  ? '#10b981' 
                  : '#ef4444',
              }}
            />
            {sessionEstado === 'en_progreso' ? 'En Progreso' : sessionEstado === 'completada' ? 'Completada' : 'Cancelada'}
          </span>
        )}
      </div>

      {/* Notificación */}
      {notif && (
        <div style={{ position: "fixed", right: 18, top: 70, zIndex: 99999 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "8px 12px",
              borderRadius: 999,
              background: "#fff",
              border: "1px solid rgba(0,0,0,0.06)",
              boxShadow: "0 6px 18px rgba(16,24,40,0.06)",
              minWidth: 220,
              maxWidth: 360,
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: notif.type === "success" ? "#16a34a" : notif.type === "error" ? "#dc2626" : "#2563eb",
              }}
            />
            <div style={{ fontSize: 13, color: "#111", flex: 1 }}>{notif.msg}</div>
            <button
              aria-label="Cerrar"
              onClick={() => setNotif(null)}
              style={{ background: "transparent", border: "none", color: "#6b7280", fontSize: 14, padding: "6px 8px", cursor: "pointer" }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Cards resumen */}
      <div className="auditoria-top">
        <div className="auditoria-cards">
          <div className="audit-card audit-success">
            <div>
              <div className="small">Sesión de Auditoría</div>
              <div className="big">
                {sessionId ? (
                  <>
                    {sessionLabel ? <span title={`ID: ${sessionId}`}>{sessionLabel}</span> : sessionId}
                    {sessionDate && (
                      <span className="text-xs text-gray-500"> · {new Date(sessionDate).toLocaleString()}</span>
                    )}
                  </>
                ) : (
                  <span className="text-sm text-gray-500">Sin sesión asignada</span>
                )}
              </div>
            </div>
            <div className="audit-icon" aria-hidden>
              <MdCheckCircle size={20} />
            </div>
          </div>
          <div className="audit-card audit-count">
            <div>
              <div className="small">Items Contados (tab activo)</div>
              <div className="big">
                {counted}/{totalCount}
              </div>
            </div>
            <div className="audit-icon" aria-hidden>
              <MdEventNote size={20} />
            </div>
          </div>
          <div className="audit-card audit-danger">
            <div>
              <div className="small">Discrepancias (Justificadas)</div>
              <div className="big">{discrepancies}</div>
            </div>
            <div className="audit-icon" aria-hidden>
              <MdErrorOutline size={20} />
            </div>
          </div>
          <div className="audit-card audit-user">
            <div>
              <div className="small">Auditor</div>
              <div className="big">{detectedName}</div>
            </div>
            <div className="audit-icon" aria-hidden>
              <FaUserCircle size={20} />
            </div>
          </div>
        </div>

        {/* Acciones principales */}
        <div className="auditoria-actions-wrapper">
          <div className="auditoria-actions">
            {sessionId ? (
              <>
                <button className="btn primary" onClick={() => setShowFinalizeModal(true)} disabled={isFinalizing}>
                  {isFinalizing ? "Aplicando..." : "Finalizar Auditoría"}
                </button>
                <button className="btn danger" onClick={() => setShowCancelConfirmModal(true)} disabled={isCanceling}>
                  {isCanceling ? "Cancelando..." : "Cancelar Auditoría"}
                </button>
              </>
            ) : (
              <button className="btn primary" onClick={() => setShowStartModal(true)} disabled={isStarting}>
                {isStarting ? "Iniciando..." : "Iniciar Auditoría"}
              </button>
            )}
            <button className="btn secondary" onClick={markNoDiff}>
              Marcar Sin Diferencias
            </button>
            <button className="btn outline" onClick={() => setShowExport(true)}>
              Exportar Resultados
            </button>
            <button className="btn ghost" onClick={resetConteo}>
              Reiniciar Conteo
            </button>
          </div>
        </div>
      </div>

      {/* ==== FILTROS SUPERIORES ==== */}
      {sessionId && (
        <div className="mb-4">
          <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3">
              {/* Tabs (solo 2) */}
              <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      activeTab === tab.id
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Categoría */}
              <label className="sr-only" htmlFor="categoria">Categoría</label>
              <select
                id="categoria"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700"
              >
                {categoriasOptions.map((cat, i) => (
                  <option key={i} value={cat}>{cat}</option>
                ))}
              </select>

              {/* Buscar */}
              <div className="relative">
                <label className="sr-only" htmlFor="search">Buscar</label>
                <input
                  id="search"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="Buscar insumos…"
                  className="h-10 w-64 rounded-lg border border-gray-200 bg-white pl-3 pr-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
            </div>

            {/* Limpiar */}
            <div className="flex items-center gap-2">
              <button
                onClick={clearFilters}
                className="h-10 rounded-lg border px-3 text-sm font-semibold hover:bg-gray-50 flex items-center gap-2"
                title="Limpiar filtros"
              >
                <PiBroomBold />
                Limpiar filtros
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabla según TAB activo (paginada) */}
      {sessionId ? (
        <div>
          {activeTab === "operativos"
            ? renderTable(pageRows, "Insumos Operativos (Merma/Ajuste)")
            : renderTable(pageRows, "Insumos Perpetuos (Consumo)")}

          {/* ==== PAGINACIÓN INFERIOR ==== */}
          <div className="mt-4">
            <div className="flex items-center justify-between gap-3 bg-white px-3 py-2 rounded-xl border border-gray-200 shadow-sm">
              <div className="text-sm text-gray-600">
                Mostrando <span className="font-semibold">{pageRows.length}</span> de{" "}
                <span className="font-semibold">{totalCount}</span> insumos
              </div>

              <div className="flex items-center gap-2">
                <div className="text-xs text-gray-500">Por página</div>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm text-gray-700"
                >
                  {[10, 20, 50, 100].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>

                <button
                  className="btn outline"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  style={{ minWidth: 90 }}
                >
                  Anterior
                </button>

                <div className="text-sm text-gray-700" style={{ minWidth: 48, textAlign: "center" }}>
                  {currentPage} / {pageCount}
                </div>

                <button
                  className="btn outline"
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  disabled={currentPage >= pageCount}
                  style={{ minWidth: 90 }}
                >
                  Siguiente
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border p-6 mt-4 text-center text-gray-600">
          Inicia una auditoría para ver el <b>Detalle del Conteo</b>.
        </div>
      )}

      {/* Modal Exportar */}
      {showExport && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.2)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ background: "#fff", padding: 24, borderRadius: 8, minWidth: 280, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
            <h4 style={{ marginBottom: 16 }}>Exportar Reporte</h4>
            <button className="btn primary" style={{ marginBottom: 8, width: "100%" }} onClick={exportCSV}>
              Descargar CSV (tab activo)
            </button>
            <button className="btn secondary" style={{ marginBottom: 8, width: "100%" }} onClick={exportPDF}>
              Imprimir / Guardar como PDF
            </button>
            <button className="btn ghost" style={{ width: "100%" }} onClick={() => setShowExport(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Modal Finalizar */}
      {showFinalizeModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.2)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: 20,
              borderRadius: 12,
              width: "100%",
              maxWidth: 520,
              boxShadow: "0 12px 28px rgba(16,24,40,0.14)",
            }}
          >
            <h4 className="text-lg font-semibold mb-3">Finalizar Auditoría</h4>

            <p className="text-gray-600 mb-3">
              Se registrarán todas las diferencias que hayan sido justificadas con una "Causa". Las
              diferencias sin causa serán ignoradas.
            </p>

            <div>
              <label className="block text-sm font-medium mb-1">Comentario de cierre (Opcional)</label>
              <textarea
                rows={3}
                value={optComentario}
                onChange={(e) => setOptComentario(e.target.value)}
                className="w-full p-2 rounded border"
                placeholder="Ej: Cierre semanal..."
              />
            </div>

            <div className="mt-4 flex gap-8 justify-end">
              <button className="btn ghost" onClick={() => setShowFinalizeModal(false)}>
                Cancelar
              </button>
              <button className="btn primary" disabled={isFinalizing} onClick={finalizeAudit}>
                {isFinalizing ? "Aplicando..." : "Confirmar Cierre"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Iniciar */}
      {showStartModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.2)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: 20,
              borderRadius: 12,
              width: "100%",
              maxWidth: 520,
              boxShadow: "0 12px 28px rgba(16,24,40,0.14)",
            }}
          >
            <h4 className="text-lg font-semibold mb-3">Iniciar Nueva Auditoría</h4>

            <p className="text-gray-600 mb-4">
              Define el período que cubrirá esta auditoría. Esto es usado para calcular el consumo de
              perpetuos.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Etiqueta (Nombre)</label>
                <input
                  type="text"
                  value={auditLabel}
                  onChange={(e) => setAuditLabel(e.target.value)}
                  className="auditoria-modal-input"
                  placeholder="Ej: Auditoría Quincenal"
                />
              </div>

              <div style={{ display: "flex", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label className="block text-sm font-medium mb-1">Fecha Inicio Período</label>
                  <input
                    type="date"
                    value={auditStartDate}
                    onChange={(e) => setAuditStartDate(e.target.value)}
                    className="auditoria-modal-input"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="block text-sm font-medium mb-1">Fecha Fin Período</label>
                  <input
                    type="date"
                    value={auditEndDate}
                    onChange={(e) => setAuditEndDate(e.target.value)}
                    className="auditoria-modal-input"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-8 justify-end">
              <button className="btn ghost" onClick={() => setShowStartModal(false)}>
                Cancelar
              </button>
              <button className="btn primary" disabled={isStarting} onClick={startAudit}>
                {isStarting ? "Iniciando..." : "Confirmar e Iniciar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Cancelación */}
      {showCancelConfirmModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.3)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: 24,
              borderRadius: 12,
              width: "100%",
              maxWidth: 480,
              boxShadow: "0 12px 28px rgba(16,24,40,0.14)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <MdErrorOutline size={32} style={{ color: "#dc2626" }} />
              <h4 className="text-lg font-semibold">¿Cancelar Auditoría?</h4>
            </div>

            <p className="text-gray-600 mb-4">
              Tienes una auditoría en progreso. Si sales ahora, puedes:
            </p>

            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-2">
              <li><strong>Guardar ajustes:</strong> Finaliza la auditoría para conservar todo lo registrado.</li>
              <li><strong>Cancelar la auditoría:</strong> Se marcará como cancelada y perderás todo el progreso.</li>
              <li><strong>Continuar:</strong> Podrás navegar entre módulos y la auditoría seguirá activa.</li>
            </ul>

            <div className="mt-6 flex gap-3 justify-end flex-wrap">
              <button 
                className="btn ghost" 
                onClick={handleContinueWithoutCancel}
                style={{ minWidth: 140 }}
              >
                Guardar cambios
              </button>
              <button 
                className="btn" 
                onClick={cancelAudit}
                disabled={isCanceling}
                style={{ 
                  minWidth: 140,
                  background: "linear-gradient(135deg, #001f3f 0%, #003d7a 100%)",
                  color: "#fff",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}
              >
                <MdErrorOutline size={16} />
                {isCanceling ? "Cancelando..." : "Cancelar Auditoría"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Éxito al Cancelar */}
      {showCancelSuccessModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.3)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: 24,
              borderRadius: 12,
              width: "100%",
              maxWidth: 400,
              boxShadow: "0 12px 28px rgba(16,24,40,0.14)",
              textAlign: "center",
            }}
          >
            <MdCheckCircle size={56} style={{ color: "#dc2626", margin: "0 auto 16px" }} />
            
            <h4 className="text-lg font-semibold mb-2">Auditoría Cancelada</h4>
            
            <p className="text-gray-600 mb-1">
              <strong>{sessionLabel || "Auditoría"}</strong>
            </p>
            <p className="text-gray-500 text-sm mb-6">
              La auditoría ha sido cancelada exitosamente
            </p>

            <button 
              className="btn primary" 
              onClick={handleCloseCancelSuccess}
              style={{ width: "100%" }}
            >
              Aceptar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Auditoria;
