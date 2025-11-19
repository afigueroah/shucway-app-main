// src/features/Dashboard/Reportes/Reportes.tsx
import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BarChart3,
  FileSpreadsheet,
  FileText,
  PieChart as PieChartIcon,
  PiggyBank,
  ShoppingBag,
  TrendingUp,
  Wallet,
  Receipt,
} from "lucide-react";
import html2pdf from 'html2pdf.js';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import reportesService, { ProductoReporte } from "../../../api/reportesService";
import type { LucideIcon } from "lucide-react";
import "./Reportes.styles.css";

/* ========================= Helpers & tipos ========================= */
type FiltroCategoria = string;
type FiltroMetodo = "Todos" | "Efectivo" | "Tarjeta" | "Transferencia";
type ChartTab = "distribution" | "productos";

// Para formatear dinero
const q = (n: number) =>
  `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Colores para charts
const COLORS = ["#6366F1","#10B981","#F59E0B","#EF4444","#3B82F6","#F97316","#84CC16","#14B8A6"];

/* ========================= Componente principal ========================= */
const Reportes: React.FC = () => {
  const navigate = useNavigate();

  // Estados para datos del backend
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoriasDisponibles, setCategoriasDisponibles] = useState<string[]>([]);
  const [chartsReady, setChartsReady] = useState(false);
  const [chartsTab, setChartsTab] = useState<ChartTab>("distribution");

  /* ---------- Filtros GLOBALes (afectan KPIs + Tabla) ---------- */
  type Periodo = "hoy" | "ayer" | "30d" | "rango";
  const [periodo, setPeriodo] = useState<Periodo>("30d");
  const [rangoInicio, setRangoInicio] = useState<string>("");
  const [rangoFin, setRangoFin] = useState<string>("");

  const [catGlobal, setCatGlobal] = useState<FiltroCategoria>("Todas");
  const [metodoGlobal, setMetodoGlobal] = useState<FiltroMetodo>("Todos");
  const [search, setSearch] = useState<string>("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchHighlight, setSearchHighlight] = useState<number>(-1);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  // Específicos de tarjetas de estrategia
  const [topVendidosFiltro, setTopVendidosFiltro] = useState<FiltroCategoria>("Todas");
  const [topRentablesFiltro, setTopRentablesFiltro] = useState<FiltroCategoria>("Todas");

  // Datos del backend
  const [kpis, setKpis] = useState({
    ventaTotal: 0,
    cogsTotal: 0,
    gananciaBruta: 0,
    gastosOperativos: 0,
    gananciaNeta: 0
  });
  const [productosData, setProductosData] = useState<ProductoReporte[]>([]);
  const [pieCategoria, setPieCategoria] = useState<{name: string, value: number}[]>([]);
  const [pieMetodo, setPieMetodo] = useState<{name: string, value: number}[]>([]);

  const categoriaOpciones = useMemo(() => Array.from(new Set(["Todas", ...categoriasDisponibles])) as FiltroCategoria[], [categoriasDisponibles]);

  const totalUnidadesVendidas = useMemo(() => {
    return productosData.reduce((sum, item) => sum + (item.unidades || 0), 0);
  }, [productosData]);

  const kpiCards = useMemo(() => {
    const base: Array<{
      key: string;
      label: string;
      icon: LucideIcon;
      accent: string;
      background: string;
      value: string;
    }> = [
      {
        key: "ventaTotal",
        label: "Venta Total",
        icon: TrendingUp,
        accent: "#047857",
        background: "#ecfdf3",
        value: q(kpis.ventaTotal),
      },
      {
        key: "costoVentas",
        label: "Costo de Ventas",
        icon: ShoppingBag,
        accent: "#1d4ed8",
        background: "#eff6ff",
        value: q(kpis.cogsTotal),
      },
      {
        key: "gananciaBruta",
        label: "Ganancia Bruta",
        icon: PiggyBank,
        accent: "#7f1d1d",
        background: "#fef2f2",
        value: q(kpis.gananciaBruta),
      },
      {
        key: "gastosOperativos",
        label: "Gastos Operativos",
        icon: Receipt,
        accent: "#92400e",
        background: "#fff7ed",
        value: q(kpis.gastosOperativos),
      },
      {
        key: "cantidadVentas",
        label: "Cantidad de Ventas",
        icon: BarChart3,
        accent: "#312e81",
        background: "#eef2ff",
        value: totalUnidadesVendidas.toLocaleString("es-GT"),
      },
    ];

    return base;
  }, [kpis, totalUnidadesVendidas]);

  const chartTabOptions = useMemo(
    () => [
      { id: "distribution" as ChartTab, label: "Distribución", description: "Categorías y métodos de pago", icon: PieChartIcon },
      { id: "productos" as ChartTab, label: "Top Productos", description: "Unidades vendidas y margen", icon: BarChart3 },
    ],
    []
  );

  /* ---------- Rango de fechas ---------- */
  const [ini, fin] = useMemo(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);

    if (periodo === "hoy") {
      start.setHours(0, 0, 0, 0);
    } else if (periodo === "ayer") {
      start.setDate(end.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
    } else if (periodo === "30d") {
      start.setDate(end.getDate() - 29);
      start.setHours(0, 0, 0, 0);
    } else {
      let rIni = rangoInicio ? new Date(rangoInicio) : new Date(end);
      let rFin = rangoFin ? new Date(rangoFin) : new Date(end);
      // Corrige inversión si es necesario
      if (rIni > rFin) {
        const temp = rIni;
        rIni = rFin;
        rFin = temp;
      }
      // Ajusta las horas
      rIni = new Date(rIni.setHours(0, 0, 0, 0));
      rFin = new Date(rFin.setHours(23, 59, 59, 999));
      return [rIni, rFin] as const;
    }
    return [start, end] as const;
  }, [periodo, rangoInicio, rangoFin]);

  // Formato de fechas para el backend (YYYY-MM-DD)
  const fechaInicio = useMemo(() => ini.toISOString().split('T')[0], [ini]);
  const fechaFin = useMemo(() => fin.toISOString().split('T')[0], [fin]);

  /* ---------- Cargar datos del backend ---------- */
  const cargarDatos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Cargar KPIs
      const kpisData = await reportesService.obtenerKPIs(fechaInicio, fechaFin);
      setKpis(kpisData);

      // Cargar productos
      const productosResp = await reportesService.obtenerProductosReporte(
        fechaInicio,
        fechaFin,
        catGlobal !== 'Todas' ? catGlobal : undefined,
        metodoGlobal !== 'Todos' ? metodoGlobal : undefined,
        search || undefined
      );
      setProductosData(productosResp);

      // Obtener categorías únicas
  const cats = [...new Set(productosResp.map(p => p.categoria))];
  setCategoriasDisponibles(cats);

      // Cargar distribuciones para gráficas
      const distCat = await reportesService.obtenerDistribucionCategoria(fechaInicio, fechaFin);
      setPieCategoria(distCat.map(d => ({ name: d.categoria, value: d.total })));

      const distMet = await reportesService.obtenerDistribucionMetodo(fechaInicio, fechaFin);
      setPieMetodo(distMet.map(d => ({ name: d.metodo, value: d.total })));

    } catch (err) {
      console.error('Error al cargar datos:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  }, [fechaInicio, fechaFin, catGlobal, metodoGlobal, search]);

  // Cargar datos cuando cambian las fechas o filtros
  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // Delay para permitir que los contenedores se estabilicen antes de renderizar gráficos
  useEffect(() => {
    const timer = setTimeout(() => {
      setChartsReady(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
        setSearchHighlight(-1);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* ---------- Tabla agregada por producto ---------- */
  type RowAgg = { producto: string; categoria: string; unidades: number; ventaQ: number; cogsQ: number; gananciaQ: number; };
  const tablaProductosBase: RowAgg[] = useMemo(() => {
    // ProductoReporte ya viene agregado del backend
    return productosData.map(p => ({
      producto: p.producto,
      categoria: p.categoria,
      unidades: p.unidades,
      ventaQ: p.ventaQ,
      cogsQ: p.cogsQ,
      gananciaQ: p.gananciaQ
    }));
  }, [productosData]);

  // Orden + paginación
  type SortKey = "producto" | "categoria" | "unidades" | "ventaQ" | "cogsQ" | "gananciaQ";
  const [sortBy, setSortBy] = useState<SortKey>("ventaQ");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(8);

  const tablaOrdenada = useMemo(() => {
    const copy = [...tablaProductosBase];
    copy.sort((a, b) => {
      const A = a[sortBy], B = b[sortBy];
      const r = (A < B ? -1 : A > B ? 1 : 0);
      return sortDir === "asc" ? r : -r;
    });
    return copy;
  }, [tablaProductosBase, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(tablaOrdenada.length / pageSize));
  const pageClamped = Math.min(page, totalPages);
  const tablaPaginada = useMemo(() => {
    const start = (pageClamped - 1) * pageSize;
    return tablaOrdenada.slice(start, start + pageSize);
  }, [tablaOrdenada, pageClamped, pageSize]);

  const productoSuggestions = useMemo(() => {
    const nombres = tablaProductosBase.map((p) => p.producto).filter(Boolean);
    return Array.from(new Set(nombres));
  }, [tablaProductosBase]);

  const filteredProductSuggestions = useMemo(() => {
    if (!productoSuggestions.length) return [];
    const query = search.trim().toLowerCase();
    const base = query
      ? productoSuggestions.filter((name) => name.toLowerCase().includes(query))
      : productoSuggestions;
    return base.slice(0, 8);
  }, [productoSuggestions, search]);

  const handleSelectSuggestion = useCallback((value: string) => {
    setSearch(value);
    setSearchOpen(false);
    setSearchHighlight(-1);
    setPage(1);
  }, []);

  const handleSearchKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!filteredProductSuggestions.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSearchOpen(true);
      setSearchHighlight((prev) => Math.min(prev + 1, filteredProductSuggestions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSearchOpen(true);
      setSearchHighlight((prev) => Math.max(prev - 1, 0));
    } else if (event.key === "Enter") {
      if (searchHighlight >= 0 && searchHighlight < filteredProductSuggestions.length) {
        event.preventDefault();
        handleSelectSuggestion(filteredProductSuggestions[searchHighlight]);
      }
    } else if (event.key === "Escape") {
      setSearchOpen(false);
      setSearchHighlight(-1);
    }
  }, [filteredProductSuggestions, handleSelectSuggestion, searchHighlight]);

  // Top 5 (estrategia) - Usamos los mismos datos agregados pero sin filtros
  const topVendidos = useMemo(() => {
    const filtered = tablaProductosBase.filter(r => topVendidosFiltro === "Todas" ? true : r.categoria === topVendidosFiltro);
    return [...filtered].sort((a,b)=> b.unidades - a.unidades).slice(0,5).map(r=>({name:r.producto, value:r.unidades}));
  }, [tablaProductosBase, topVendidosFiltro]);

  const topRentables = useMemo(() => {
    const filtered = tablaProductosBase.filter(r => topRentablesFiltro === "Todas" ? true : r.categoria === topRentablesFiltro);
    return [...filtered].sort((a,b)=> b.gananciaQ - a.gananciaQ).slice(0,5).map(r=>({name:r.producto, value:Math.round(r.gananciaQ*100)/100}));
  }, [tablaProductosBase, topRentablesFiltro]);

  /* ---------- Export (CSV / PDF) del estado filtrado y ORDENADO ---------- */
  function exportCSV() {
    const headers = ["Producto","Categoría","Unidades","Venta Total","COGS","Ganancia"];
    const lines = [headers.join(",")];
    tablaOrdenada.forEach(r=>{
      lines.push([
        `"${r.producto.replace(/"/g,'""')}"`,
        r.categoria,
        r.unidades,
        r.ventaQ.toFixed(2),
        r.cogsQ.toFixed(2),
        r.gananciaQ.toFixed(2),
      ].join(","));
    });
    const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "reporte_productos.csv";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  function exportPDF() {
    const rangoTxt = `${ini.toLocaleDateString("es-GT")} – ${fin.toLocaleDateString("es-GT")}`;
    const kpiHtml = `
      <table style="width:100%; border-collapse:collapse; margin:8px 0; font-size:12px">
        <tr>
          <th style="text-align:left; padding:6px; border:1px solid #e5e7eb">Venta Total</th>
          <th style="text-align:left; padding:6px; border:1px solid #e5e7eb">Costo de Ventas</th>
          <th style="text-align:left; padding:6px; border:1px solid #e5e7eb">Ganancia Bruta</th>
          <th style="text-align:left; padding:6px; border:1px solid #e5e7eb">Gastos Operativos</th>
          <th style="text-align:left; padding:6px; border:1px solid #e5e7eb">Ganancia Neta</th>
        </tr>
        <tr>
          <td style="padding:6px; border:1px solid #e5e7eb">${q(kpis.ventaTotal)}</td>
          <td style="padding:6px; border:1px solid #e5e7eb">${q(kpis.cogsTotal)}</td>
          <td style="padding:6px; border:1px solid #e5e7eb">${q(kpis.gananciaBruta)}</td>
          <td style="padding:6px; border:1px solid #e5e7eb">${q(kpis.gastosOperativos)}</td>
          <td style="padding:6px; border:1px solid #e5e7eb">${q(kpis.gananciaNeta)}</td>
        </tr>
      </table>
    `;
    const rowsHtml = tablaOrdenada.map((r,i)=>`
      <tr>
        <td style="padding:6px; border:1px solid #e5e7eb">${i+1}</td>
        <td style="padding:6px; border:1px solid #e5e7eb">${r.producto}</td>
        <td style="padding:6px; border:1px solid #e5e7eb">${r.categoria}</td>
        <td style="padding:6px; border:1px solid #e5e7eb; text-align:right">${r.unidades}</td>
        <td style="padding:6px; border:1px solid #e5e7eb; text-align:right">${q(r.ventaQ)}</td>
        <td style="padding:6px; border:1px solid #e5e7eb; text-align:right">${q(r.cogsQ)}</td>
        <td style="padding:6px; border:1px solid #e5e7eb; text-align:right">${q(r.gananciaQ)}</td>
      </tr>
    `).join("");

    const html = `
<div style="font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Arial;margin:16px;color:#111">
  <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:8px">
    <div>
      <h1 style="margin:0 0 4px 0">Reportes</h1>
      <div style="color:#6b7280; font-size:12px">Rango: ${rangoTxt}</div>
    </div>
    <div style="color:#6b7280; font-size:12px">${new Date().toLocaleString()}</div>
  </div>
  <h3 style="margin:12px 0 6px 0">KPIs</h3>
  ${kpiHtml}
  <h3 style="margin:14px 0 6px 0">Productos (según filtros)</h3>
  <table style="width:100%; border-collapse:collapse; font-size:12px">
    <thead>
      <tr>
        <th style="text-align:left; padding:6px; border:1px solid #e5e7eb">#</th>
        <th style="text-align:left; padding:6px; border:1px solid #e5e7eb">Producto</th>
        <th style="text-align:left; padding:6px; border:1px solid #e5e7eb">Categoría</th>
        <th style="text-align:right; padding:6px; border:1px solid #e5e7eb">Unidades</th>
        <th style="text-align:right; padding:6px; border:1px solid #e5e7eb">Venta</th>
        <th style="text-align:right; padding:6px; border:1px solid #e5e7eb">COGS</th>
        <th style="text-align:right; padding:6px; border:1px solid #e5e7eb">Ganancia</th>
      </tr>
    </thead>
    <tbody>${rowsHtml || `<tr><td colspan="7" style="padding:10px;color:#6b7280">Sin datos</td></tr>`}</tbody>
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
      filename: `reportes-${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(tempDiv).save().then(() => {
      document.body.removeChild(tempDiv);
    });
  }

  function handleGastosOperativos() {
    navigate("/reportes/gastos-operativos");
  }

  /* ========================= UI ========================= */
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header compacto */}
  <div className="w-full max-w-[1200px] mx-auto mb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 text-sm font-semibold"
            >
              ← Regresar
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 leading-tight">Reportes</h1>
              <div className="text-xs text-gray-500">Estado general y rentabilidad</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              className="btn-ghost"
            >
              <FileSpreadsheet size={18} />
              <span>Descargar CSV</span> 
            </button>
            <button
              onClick={exportPDF}
              className="btn-success"
            >
              <FileText size={18} />
              <span>Descargar PDF</span>
            </button>
            <button
              onClick={handleGastosOperativos}
              className="btn-dark"
            >
              <Wallet size={18} />
              <span>Ver Gestión de Gastos Operativos</span>
            </button>
          </div>
        </div>

        {/* Filtros GLOBALes */}
        <div className="mt-3 bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-700 mr-1">Periodo:</span>
            {(["hoy","ayer","30d","rango"] as Periodo[]).map(p=>(
              <button
                key={p}
                onClick={()=>setPeriodo(p)}
                className={`rounded-full px-4 py-2 text-sm font-semibold border transition-all duration-150 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-emerald-500
                ${periodo===p
                  ? "bg-emerald-600 border-emerald-700 text-white shadow-[0_10px_24px_rgba(16,185,129,0.35)] hover:bg-emerald-700"
                  : "bg-emerald-100 border-emerald-200 text-emerald-800 hover:bg-emerald-200"}
              `}
              >
                {p==="hoy"?"Hoy":p==="ayer"?"Ayer":p==="30d"?"Últimos 30 días":"Rango"}
              </button>
            ))}

            {periodo==="rango" && (
              <div className="flex items-center gap-2 ml-1">
                <input type="date" value={rangoInicio} onChange={(e)=>setRangoInicio(e.target.value)} className="input" />
                <span className="text-gray-500 text-sm">a</span>
                <input type="date" value={rangoFin} onChange={(e)=>setRangoFin(e.target.value)} className="input" />
              </div>
            )}

            <div className="ml-auto flex items-center gap-2">
              <select 
                className="input" 
                value={catGlobal} 
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCatGlobal(e.target.value as FiltroCategoria)}
              >
                {categoriaOpciones.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
              <div className="search-container" ref={searchContainerRef}>
                <input
                  value={search}
                  onChange={(e)=>{
                    setSearch(e.target.value);
                    setPage(1);
                    setSearchOpen(true);
                    setSearchHighlight(-1);
                  }}
                  onFocus={()=>{
                    setSearchOpen(true);
                    setSearchHighlight(-1);
                  }}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Buscar producto…"
                  className="input search-input"
                />
                {searchOpen && filteredProductSuggestions.length > 0 && (
                  <div className="search-suggestions">
                    {filteredProductSuggestions.map((name, idx) => (
                      <button
                        key={name}
                        type="button"
                        className={`search-suggestion ${searchHighlight === idx ? "is-active" : ""}`}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          handleSelectSuggestion(name);
                        }}
                        onMouseEnter={() => setSearchHighlight(idx)}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
                {searchOpen && !filteredProductSuggestions.length && (
                  <div className="search-suggestions empty">
                    <span>Sin coincidencias</span>
                  </div>
                )}
              </div>
              <button
                onClick={()=>{
                  setCatGlobal("Todas");
                  setMetodoGlobal("Todos");
                  setSearch("");
                  setPage(1);
                  setSearchOpen(false);
                  setSearchHighlight(-1);
                }}
                className="btn-ghost"
              >
                Limpiar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Estado de carga o error */}
      {loading && (
  <div className="w-full max-w-[1200px] mx-auto text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
          <p className="mt-4 text-gray-600">Cargando datos...</p>
        </div>
      )}

      {error && !loading && (
  <div className="w-full max-w-[1200px] mx-auto bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-semibold">Error:</p>
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
      {/* KPIs */}
  <div className="w-full max-w-[1200px] mx-auto grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
        {kpiCards.map((card) => (
          <motion.div
            key={card.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="report-card"
            style={{ background: card.background }}
          >
            <div className="report-card__icon" style={{ color: card.accent }}>
              <card.icon size={22} />
            </div>
            <div className="report-card__content">
              <span className="report-card__label">{card.label}</span>
              <span className="report-card__value">{card.value}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Gráficas: Pie Categoría + Pie Método (lado a lado) */}
  <div className="w-full max-w-[1200px] mx-auto mt-4">
        <div className="report-tabs">
          {chartTabOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => setChartsTab(option.id)}
              className={`report-tab ${chartsTab === option.id ? "is-active" : ""}`}
            >
              <option.icon size={18} />
              <div>
                <span>{option.label}</span>
                <small>{option.description}</small>
              </div>
            </button>
          ))}
        </div>

        {chartsTab === "distribution" ? (
          <div className="report-split">
            <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} className="report-panel">
              <header>
                <h3>Distribución por Categoría</h3>
                <span>{ini.toLocaleDateString("es-GT")} – {fin.toLocaleDateString("es-GT")}</span>
              </header>
              <div className="panel-body">
                {loading || pieCategoria.length === 0 || !chartsReady ? (
                  <div className="loading-container">
                    <div className="loader" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={320} minWidth={280} minHeight={240}>
                    <PieChart>
                      <Pie data={pieCategoria} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
                        {pieCategoria.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number|string, n: string)=>[q(Number(v)), n]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </motion.div>

            <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} className="report-panel">
              <header>
                <h3>Métodos de Pago</h3>
                <span>{ini.toLocaleDateString("es-GT")} – {fin.toLocaleDateString("es-GT")}</span>
              </header>
              <div className="panel-body">
                {loading || pieMetodo.length === 0 || !chartsReady ? (
                  <div className="loading-container">
                    <div className="loader" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={320} minWidth={280} minHeight={240}>
                    <PieChart>
                      <Pie data={pieMetodo} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
                        {pieMetodo.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number|string, n: string)=>[q(Number(v)), n]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </motion.div>
          </div>
        ) : (
          <div className="report-split">
            <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} className="report-panel">
              <header>
                <div className="panel-heading">
                  <h3>Top 5 Productos Más Vendidos (unidades)</h3>
                  <select
                    className="input"
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTopVendidosFiltro(e.target.value as FiltroCategoria)}
                    value={topVendidosFiltro}
                  >
                    {categoriaOpciones.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </header>
              <div className="panel-body">
                {loading || topVendidos.length === 0 ? (
                  <div className="loading-container">
                    <div className="loader" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={320} minWidth={320} minHeight={240}>
                    <BarChart data={topVendidos} margin={{left:10,right:10,top:10,bottom:10}}>
                      <CartesianGrid stroke="#f3f4f6" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#6366F1" radius={[6,6,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </motion.div>

            <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} className="report-panel">
              <header>
                <div className="panel-heading">
                  <h3>Top 5 Productos Más Rentables (Q)</h3>
                  <select
                    className="input"
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTopRentablesFiltro(e.target.value as FiltroCategoria)}
                    value={topRentablesFiltro}
                  >
                    {categoriaOpciones.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </header>
              <div className="panel-body">
                {loading || topRentables.length === 0 || !chartsReady ? (
                  <div className="loading-container">
                    <div className="loader" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={320} minWidth={320} minHeight={240}>
                    <BarChart data={topRentables} margin={{left:10,right:10,top:10,bottom:10}}>
                      <CartesianGrid stroke="#f3f4f6" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number | string)=>q(Number(v))} />
                      <Bar dataKey="value" fill="#10B981" radius={[6,6,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </div>

      {/* Tabla interactiva con orden y paginación */}
  <div className="w-full max-w-[1200px] mx-auto mt-6">
        <div className="report-table">
          <header>
            <div>
              <h3>Productos (según filtros globales)</h3>
              <span>{ini.toLocaleDateString("es-GT")} – {fin.toLocaleDateString("es-GT")}</span>
            </div>
            <div className="table-actions">
              <label>Ordenar por</label>
              <select
              className="input"
              value={sortBy}
              onChange={(e)=>setSortBy(e.target.value as SortKey)}
            >
              <option value="producto">Producto</option>
              <option value="categoria">Categoría</option>
              <option value="unidades">Unidades</option>
              <option value="ventaQ">Venta</option>
              <option value="cogsQ">COGS</option>
              <option value="gananciaQ">Ganancia</option>
            </select>
            <select
              className="input"
              value={sortDir}
              onChange={(e)=>setSortDir(e.target.value as "asc" | "desc")}
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
            </div>
            <div className="table-actions">
              <label>Filas</label>
              <select
                className="input"
                value={pageSize}
                onChange={(e)=>{ setPage(1); setPageSize(Number(e.target.value)); }}
              >
                {[5,8,10,20].map(n=><option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </header>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th className="text-right">Unidades</th>
                  <th className="text-right">Venta</th>
                  <th className="text-right">COGS</th>
                  <th className="text-right">Ganancia</th>
                </tr>
              </thead>
              <tbody>
                {tablaPaginada.length ? tablaPaginada.map((r,idx)=>(
                  <tr key={`${r.producto}-${idx}`}>
                    <td>{(pageClamped-1)*pageSize + idx + 1}</td>
                    <td>{r.producto}</td>
                    <td>{r.categoria}</td>
                    <td className="text-right">{r.unidades}</td>
                    <td className="text-right">{q(r.ventaQ)}</td>
                    <td className="text-right">{q(r.cogsQ)}</td>
                    <td className="text-right">{q(r.gananciaQ)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={7} className="empty">Sin datos para los filtros actuales.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <footer>
            <div className="summary">
              Página {pageClamped} de {totalPages} • {tablaOrdenada.length} registros
            </div>
            <div className="pager">
              <button
                className="btn-ghost"
                onClick={()=>setPage(1)}
                disabled={pageClamped===1}
              >
                « Primero
              </button>
              <button
                className="btn-ghost"
                onClick={()=>setPage(p=>Math.max(1,p-1))}
                disabled={pageClamped===1}
              >
                ‹ Prev
              </button>
              <button
                className="btn-ghost"
                onClick={()=>setPage(p=>Math.min(totalPages,p+1))}
                disabled={pageClamped===totalPages}
              >
                Next ›
              </button>
              <button
                className="btn-ghost"
                onClick={()=>setPage(totalPages)}
                disabled={pageClamped===totalPages}
              >
                Última »
              </button>
            </div>
          </footer>
        </div>
      </div>

      <div className="h-6" />
      </>
      )}
    </div>
  );
};

export default Reportes;
