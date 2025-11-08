import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from "framer-motion";
import {
  PiEyeBold,
  PiPencilSimpleBold,
  PiTrashBold,
  PiArrowDownBold,
  PiArrowUpBold,
  PiPlusBold,
  PiBroomBold,
  PiChartBar,
  PiX,
} from "react-icons/pi";
import { MdClose } from "react-icons/md";
import Kardex from './Kardex';
import { supabase } from "../../../../api/supabaseClient";
import { message } from "antd";
import { useAuth } from "../../../../hooks/useAuth";
import { PermissionLevel } from "../../../../constants/permissions";
import { localStore } from "../../../../utils/storage";

/** Tipos */
type TipoInsumo = "Perpetuo" | "Operativo";
type EstadoStock = "OK" | "Stock Bajo" | "Crítico" | "Vacío" | "Sobre stock";
type UnidadMedida = "caneca" | "frasco" | "galón" | "garrafon" | "lata" | "libra" | "manojo" | "paquete" | "sobre" | "unidad";

const UBICACIONES_FIJAS = ["Bodega", "Casa", "Refrigerador", "Nevera", "Congelador", "Estantería"] as const;

type Fila = {
  id: string;
  nombre: string;
  tipo: TipoInsumo;
  stockCantidad: number;
  unidad: UnidadMedida;
  ubicacion: string;
  estado: EstadoStock;
  ultimaActualizacion: string;
  categoria: string;
  descripcion?: string;
  proveedor?: string;
  costo?: number;
  activo?: boolean;
  automatica?: boolean;
  imagen?: string;
  categoriaId?: number;
  proveedorId?: number;
  fecha_vencimiento?: string;
  stock_minimo?: number;
  stock_maximo?: number;
  descripcion_presentacion?: string;
};

// Tipo para la respuesta de la API de catálogo
// Eliminado tipo no usado CatalogoInsumoAPI

interface ApiResponseBody {
  message?: string;
  error?: string;
  raw?: string;
  data?: unknown;
  [key: string]: unknown;
}

const parseResponseBody = (text: string): ApiResponseBody => {
  if (!text) return {};
  try {
    return JSON.parse(text) as ApiResponseBody;
  } catch (error) {
    console.warn('Failed to parse response:', error);
    return { raw: text };
  }
};

/** Datos (serán cargados desde la BD) */


 
export default function Catalogo() {
  // Estado para el modal de confirmación de eliminación
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; row: Fila | null }>({ open: false, row: null });
  // Valores y helpers mínimos necesarios para compilar y mantener funcionalidad básica
  const UNIDADES: UnidadMedida[] = ['caneca', 'frasco', 'galón', 'garrafon', 'lata', 'libra', 'manojo', 'paquete', 'sobre', 'unidad'];
  const TABS = [
    { id: "todos", label: "Todos" },
    { id: "perpetuos", label: "Solo Perpetuos" },
    { id: "operativos", label: "Solo Operativos" },
  ] as const;
  type SortKey = 'stock' | 'ultimaActualizacion' | 'nombre' | 'tipo' | 'estado' | 'categoria' | 'unidad' | 'ubicacion';

  const [q, setQ] = useState<string>('');
  const [debouncedQ, setDebouncedQ] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'todos' | 'perpetuos' | 'operativos'>('todos');
  const location = useLocation();
  const { roleLevel } = useAuth();
  const canManageInsumos = (roleLevel ?? 0) >= PermissionLevel.ADMINISTRADOR;
  const [categoria, setCategoria] = useState<string>("Todas las categorías");
  const [sortBy, setSortBy] = useState<SortKey>('nombre' as SortKey);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  // Ventana ampliada para ver Kárdex en pantalla aparte
  const [showKardexFull, setShowKardexFull] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const filterParam = urlParams.get('filter');
    if (filterParam && ['todos', 'perpetuos', 'operativos'].includes(filterParam)) {
      setActiveTab(filterParam as 'todos' | 'perpetuos' | 'operativos');
    }
  }, [location.search]);



  const formatStock = (n: number) => `${n}`;
  const formatDateHuman = (iso?: string) => (iso ? new Date(iso).toLocaleString('es-ES') : '—');

  const TipoBadge = ({ tipo }: { tipo: TipoInsumo }) => {
    const isPerpetuo = tipo === "Perpetuo";
    return (
      <span className={`px-2 py-0.5 rounded text-xs ${
        isPerpetuo
          ? "bg-emerald-100 text-emerald-700"
          : "bg-blue-100 text-blue-700"
      }`}>
        {tipo}
      </span>
    );
  };
  const EstadoPill = ({ estado }: { estado: EstadoStock }) => {
    const getEstadoStyles = (estado: EstadoStock) => {
      switch (estado) {
        case "Vacío":
          return "bg-red-100 text-red-800 border-red-200";
        case "Crítico":
          return "bg-red-100 text-red-700 border-red-200";
        case "Stock Bajo":
          return "bg-yellow-100 text-yellow-800 border-yellow-200";
        case "OK":
          return "bg-green-100 text-green-800 border-green-200";
        case "Sobre stock":
          return "bg-blue-100 text-blue-800 border-blue-200";
        default:
          return "bg-gray-100 text-gray-800 border-gray-200";
      }
    };

    return (
      <span className={`px-2 py-0.5 rounded text-xs border ${getEstadoStyles(estado)}`}>
        {estado}
      </span>
    );
  };
 
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  // Datos (editable en memoria)
  const [rows, setRows] = useState<Fila[]>([]);
  const [rawInsumos, setRawInsumos] = useState<Record<string, unknown>[]>([]);
  const [categoriasBD, setCategoriasBD] = useState<Array<{ id_categoria: number; nombre: string; tipo_categoria?: string }>>([]);
  const [proveedoresBD, setProveedoresBD] = useState<Array<{ id_proveedor: number; nombre_empresa: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Opciones de categorías para el filtro
  const categoriasOptions = useMemo(() => ["Todas las categorías", ...categoriasBD.map(c => c.nombre)], [categoriasBD]);

  // Función para recargar datos desde la API
  const reloadData = useCallback(async () => {
    console.log('reloadData ejecutándose...');
    try {
      setLoading(true);
      setError(null);

      // Cargar insumos desde la API de catálogo
      const insumosResponse = await fetch(`${import.meta.env.VITE_API_URL}/inventario/catalogo`, {
        headers: {
          'Authorization': `Bearer ${localStore.get('access_token')}`,
        },
      });

      if (!insumosResponse.ok) {
        throw new Error(`HTTP ${insumosResponse.status}: ${insumosResponse.statusText}`);
      }

      const insumosData = await insumosResponse.json();
      const insumos = Array.isArray(insumosData) ? insumosData : (insumosData.data || []);

      setRawInsumos(insumos);
      console.log('Insumos cargados:', insumos.length);
      console.log('Primeros 3 insumos:', insumos.slice(0, 3));

      // Cargar categorías
      const categoriasResponse = await fetch(`${import.meta.env.VITE_API_URL}/dashboard/table-data/categoria_insumo`, {
        headers: {
          'Authorization': `Bearer ${localStore.get('access_token')}`,
        },
      });

      if (categoriasResponse.ok) {
        const categoriasData = await categoriasResponse.json();
        const categorias = Array.isArray(categoriasData) ? categoriasData : (categoriasData.data || []);
        console.log('Categorías cargadas:', categorias.length);
        setCategoriasBD(categorias);
      }

      // Cargar proveedores
      const proveedoresResponse = await fetch(`${import.meta.env.VITE_API_URL}/dashboard/table-data/proveedor`, {
        headers: {
          'Authorization': `Bearer ${localStore.get('access_token')}`,
        },
      });

      if (proveedoresResponse.ok) {
        const proveedoresData = await proveedoresResponse.json();
        const proveedores = Array.isArray(proveedoresData) ? proveedoresData : (proveedoresData.data || []);
        setProveedoresBD(proveedores);
      }

    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("Error recargando datos:", message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Cargar datos inicialmente
  useEffect(() => {
    reloadData();
  }, [reloadData]);

  // Mapear insumos cuando se carguen las categorías
  useEffect(() => {
    if (rawInsumos.length > 0) {
      console.log('Mapeando insumos:', rawInsumos.length, 'categorías:', categoriasBD.length);
      console.log('Primeros 3 rawInsumos:', rawInsumos.slice(0, 3));
      const mapped = rawInsumos.map((i: Record<string, unknown>) => {
        // Determinar el tipo basado en la categoría, no en tipo_categoria de la API
        const categoriaObj = categoriasBD.find((c: { id_categoria: number; nombre: string; tipo_categoria?: string }) => c.id_categoria === i.id_categoria);
        let tipo: TipoInsumo = "Operativo";
        if (categoriaObj) {
          // Si la categoría tiene tipo_categoria definido, úsalo
          if (categoriaObj.tipo_categoria) {
            tipo = categoriaObj.tipo_categoria.toLowerCase() === "perpetuo" ? "Perpetuo" : "Operativo";
          } else {
            // Si no tiene tipo_categoria, infiérelo del nombre
            const nombreCat = categoriaObj.nombre.toLowerCase();
            const perpetuoKeywords = ['perpetuo', 'perpetuos', 'eterno', 'eternos', 'pizza', 'pizzas', 'plato', 'platos', 'principal', 'principales', 'comida', 'menu', 'hamburguesa', 'hamburguesas', 'shuco', 'shucos'];
            const operativoKeywords = ['ingrediente', 'ingredientes', 'verdura', 'verduras', 'carne', 'carnes', 'pan', 'harina', 'aceite', 'sal', 'azucar'];

            const esPerpetuo = perpetuoKeywords.some(keyword => nombreCat.includes(keyword));
            const esOperativo = operativoKeywords.some(keyword => nombreCat.includes(keyword));

            if (esPerpetuo && !esOperativo) {
              tipo = "Perpetuo";
            } else if (esOperativo && !esPerpetuo) {
              tipo = "Operativo";
            } else if (esPerpetuo && esOperativo) {
              // Si contiene ambas, asumir perpetuo
              tipo = "Perpetuo";
            }
            // Si no contiene ninguna, queda como "Operativo" por defecto
          }
        }
        const nombreCategoria = categoriaObj?.nombre ?? '—';

        // Stock: usa 0 si no tienes stock_actual
        const stockLotes = Number(i.stock_actual ?? 0);
        const stockMinimo = Number(i.stock_minimo ?? 0);
        const stockMaximo = Number(i.stock_maximo ?? 0);

        // Calcular estado basado en stock actual, mínimo y máximo
        let estado: EstadoStock = "OK";
        if (stockLotes === 0) {
          estado = "Vacío";
        } else if (stockLotes < stockMinimo) {
          estado = "Crítico";
        } else if (stockLotes <= stockMinimo * 1.2) { // 20% por encima del mínimo = stock bajo
          estado = "Stock Bajo";
        } else if (stockMaximo > 0 && stockLotes > stockMaximo) {
          estado = "Sobre stock"; // Nuevo estado para cuando excede el stock máximo
        }

        const proveedorNombre = proveedoresBD.find(p => p.id_proveedor === i.id_proveedor_principal)?.nombre_empresa;
        const ubicacionValue = typeof i.ubicacion === 'string' && i.ubicacion.trim() !== '' ? i.ubicacion : '';
        const imagenUrl = typeof i.insumo_url === 'string' && i.insumo_url.trim() !== '' ? i.insumo_url : undefined;
        const descripcionPresentacion = typeof i.descripcion_presentacion === 'string' && i.descripcion_presentacion.trim() !== ''
          ? i.descripcion_presentacion
          : undefined;
        const fechaVencimiento = typeof i.fecha_vencimiento === 'string' && i.fecha_vencimiento.trim() !== ''
          ? i.fecha_vencimiento
          : undefined;

        return {
          id: String(i.id_insumo),
          nombre: i.nombre_insumo || i.nombre, // fallback por si el campo es diferente
          tipo,
          stockCantidad: stockLotes,
          unidad: (i.unidad_base as UnidadMedida) || "unidad",
          ubicacion: ubicacionValue,
          estado,
          ultimaActualizacion: i.fecha_registro || i.fecha_creacion || new Date().toISOString(),
          categoria: nombreCategoria,
          descripcion: "",
          proveedor: proveedorNombre,
          costo: i.costo_promedio ? Number(i.costo_promedio) : undefined,
          activo: Boolean(i.activo ?? true),
          automatica: false,
          imagen: imagenUrl,
          categoriaId: i.id_categoria,
          proveedorId: i.id_proveedor_principal,
          fecha_vencimiento: fechaVencimiento,
          stock_minimo: i.stock_minimo ? Number(i.stock_minimo) : undefined,
          stock_maximo: i.stock_maximo ? Number(i.stock_maximo) : undefined,
          descripcion_presentacion: descripcionPresentacion || "",
        } as Fila;
      });
      console.log('Insumos mapeados:', mapped.length, 'primer insumo:', mapped[0]);
      setRows(mapped);
    }
  }, [rawInsumos, categoriasBD, proveedoresBD]);

  // Cargar categorías y proveedores desde las APIs del backend
  useEffect(() => {
    let mounted = true;
    async function loadMeta() {
      try {
        const [catRes, provRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL}/inventario/categorias`, {
            headers: {
              'Authorization': `Bearer ${localStore.get('access_token')}`,
            },
          }).then(res => res.json()).then(data => data.data || []),
          fetch(`${import.meta.env.VITE_API_URL}/inventario/proveedores`, {
            headers: {
              'Authorization': `Bearer ${localStore.get('access_token')}`,
            },
          }).then(res => res.json()).then(data => data.data || []),
        ]);
        if (!mounted) return;
        setCategoriasBD((catRes ?? []) as Array<{ id_categoria: number; nombre: string; tipo_categoria?: string }>);
        setProveedoresBD((provRes ?? []) as Array<{ id_proveedor: number; nombre_empresa: string }>);
      } catch (e) {
        console.error("Error cargando metadatos:", e);
      }
    }
    loadMeta();
    return () => { mounted = false; };
  }, []);

  // Helper: recargar insumos directamente desde la tabla 'insumo' (mapeo similar al fallback)
  async function fetchInsumosFromTable() {
    try {
      // Usar el endpoint del backend que ya devuelve el catálogo/joined view
      const res = await fetch(`${import.meta.env.VITE_API_URL}/inventario/catalogo`, {
        headers: {
          'Authorization': `Bearer ${localStore.get('access_token')}`,
        },
      });
      const json = await res.json();
      const insumos = Array.isArray(json) ? json : (json.data || []);
      // Reutilizar el mapeo principal a `rows` vía rawInsumos para mantener consistencia
      setRawInsumos(insumos as Record<string, unknown>[]);
    } catch (e: unknown) {
      console.error("Error recargando insumos:", e);
    }
  }

  // Drawer
  const [openDrawer, setOpenDrawer] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const navigate = useNavigate();

  // MODAL de detalle
  const [detail, setDetail] = useState<Fila | null>(null);
  const kardexRef = useRef<HTMLDivElement | null>(null);

  // Form
  const blankForm: Fila = {
    id: "",
    nombre: "",
    tipo: "Operativo",
    stockCantidad: 0,
    unidad: "unidad",
    ubicacion: UBICACIONES_FIJAS[0],
    estado: "OK",
    ultimaActualizacion: new Date().toISOString(),
    categoria: "",
    descripcion: "",
    proveedor: "",
    costo: undefined,
    activo: true,
    automatica: false,
    imagen: undefined,
    fecha_vencimiento: undefined,
    stock_minimo: undefined,
    stock_maximo: undefined,
    descripcion_presentacion: "",
  };
  const [form, setForm] = useState<Fila>(blankForm);
  // Errores por campo para mostrar mensajes inline en el formulario
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const ubicacionesMenu = useMemo(() => {
    const base: string[] = [...UBICACIONES_FIJAS];
    if (form.ubicacion && !base.includes(form.ubicacion)) {
      base.push(form.ubicacion);
    }
    return base;
  }, [form.ubicacion]);


  // Debounce búsqueda
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [q]);

  // Filtros + orden + paginado
  const filtered = useMemo(() => {
    let r = [...rows];
    if (activeTab === "perpetuos")  r = r.filter((x) => x.tipo === "Perpetuo");
    if (activeTab === "operativos") r = r.filter((x) => x.tipo === "Operativo");
    if (categoria !== "Todas las categorías") r = r.filter((x) => x.categoria === categoria);
    if (debouncedQ) {
      r = r.filter(
        (x) =>
          x.nombre.toLowerCase().includes(debouncedQ) ||
          x.categoria.toLowerCase().includes(debouncedQ) ||
          x.tipo.toLowerCase().includes(debouncedQ)
      );
    }
    // sort
    const getValue = (a: Fila, key: SortKey): number | string => {
      if (key === "stock") return a.stockCantidad;
      if (key === "ultimaActualizacion") return new Date(a.ultimaActualizacion).getTime();
      return a[key];
    };
    r.sort((a, b) => {
      const A = getValue(a, sortBy);
      const B = getValue(b, sortBy);
      const diff =
        typeof A === "number" && typeof B === "number"
          ? A - B
          : String(A).localeCompare(String(B));
      return sortDir === "asc" ? diff : -diff;
    });
    return r;
  }, [rows, activeTab, categoria, debouncedQ, sortBy, sortDir]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const pageData = filtered.slice((page - 1) * perPage, page * perPage);

  useEffect(() => {
    setPage(1);
  }, [activeTab, categoria, debouncedQ, perPage]);



  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(key);
      setSortDir("asc");
    }
  };

  // CRUD
  const openCreate = () => {
    if (!canManageInsumos) {
      message.warning('No tienes permisos para crear insumos');
      return;
    }
    setEditingId(null);
    // no crear id en frontend: delegar autoincrement al backend
    setForm({ ...blankForm, id: "", categoriaId: categoriasBD.length > 0 ? categoriasBD[0].id_categoria : undefined });
    setOpenDrawer(true);
  };
  const openEdit = async (row: Fila) => {
    if (!canManageInsumos) {
      message.warning('No tienes permisos para modificar insumos');
      return;
    }
    setEditingId(row.id);
    setLoading(true);
    setError(null);

    try {
      // Obtener detalles completos del insumo incluyendo presentaciones y lotes
      const res = await fetch(`${import.meta.env.VITE_API_URL}/inventario/insumos/${row.id}/details`, {
        headers: {
          'Authorization': `Bearer ${localStore.get('access_token')}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Error al obtener detalles del insumo: ${res.status}`);
      }

      const response = await res.json();
      const insumoDetails = response.data;

      // Mapear datos del backend al formato del formulario
      const presentacion = insumoDetails.insumo_presentacion?.[0] || {};
      const lote = insumoDetails.lote_insumo?.[0] || {};

      const formData = {
        id: String(insumoDetails.id_insumo),
        nombre: insumoDetails.nombre_insumo,
        tipo: (insumoDetails.categoria_insumo?.tipo_categoria === 'perpetuo' ? 'Perpetuo' : 'Operativo') as TipoInsumo,
        unidad: insumoDetails.unidad_base || 'unidad',
        stockCantidad: lote.cantidad_actual || 0,
        ubicacion: lote.ubicacion || row.ubicacion || '',
        estado: 'OK' as EstadoStock, // Se calculará después
        ultimaActualizacion: insumoDetails.fecha_registro,
        categoria: insumoDetails.categoria_insumo?.nombre || '',
        descripcion: '',
        proveedor: insumoDetails.proveedor_principal?.nombre_proveedor || presentacion.proveedor?.nombre_proveedor || '',
        costo: insumoDetails.costo_promedio || 0,
        activo: insumoDetails.activo,
        automatica: false,
        imagen: insumoDetails.insumo_url || row.imagen || undefined,
        categoriaId: insumoDetails.id_categoria,
        proveedorId: presentacion.id_proveedor || insumoDetails.id_proveedor_principal,
        fecha_vencimiento: lote.fecha_vencimiento || '',
        stock_minimo: insumoDetails.stock_minimo || undefined,
        stock_maximo: insumoDetails.stock_maximo || undefined,
        descripcion_presentacion: presentacion.descripcion_presentacion || '',
      };
      setForm(formData);

      setOpenDrawer(true);
    } catch (err) {
      console.error('Error cargando detalles del insumo:', err);
      const message = err instanceof Error ? err.message : String(err);
      setError(`Error al cargar datos del insumo: ${message}`);
      // Fallback: usar datos básicos de la fila
      const cat = categoriasBD.find((c) => c.nombre === row.categoria);
      const prov = proveedoresBD.find((p) => p.nombre_empresa === (row.proveedor ?? ""));
      setForm({ ...row, categoriaId: row.categoriaId ?? (cat ? cat.id_categoria : undefined), proveedorId: row.proveedorId ?? (prov ? prov.id_proveedor : undefined) });
      setOpenDrawer(true);
    } finally {
      setLoading(false);
    }
  };
  const deleteRow = async (row: Fila) => {
    if (!canManageInsumos) {
      message.warning('No tienes permisos para eliminar insumos');
      return;
    }
    setDeleteModal({ open: true, row });
  };

  // Acción real de eliminación tras confirmar en el modal
  const confirmDeleteRow = async () => {
    if (!canManageInsumos) {
      message.warning('No tienes permisos para eliminar insumos');
      setDeleteModal({ open: false, row: null });
      return;
    }
    if (!deleteModal.row) return;
    setLoading(true);
    setError(null);
    try {
      const idToDelete = Number(deleteModal.row.id);
      // Usar endpoint coherente con el CRUD de inventario
      const res = await fetch(`${import.meta.env.VITE_API_URL}/inventario/insumos/${idToDelete}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStore.get('access_token')}`,
        },
      });
      const text = await res.text().catch(() => '');
      const body = parseResponseBody(text);
      if (!res.ok) {
        console.error('Error deleting insumo:', res.status, body);
        throw new Error(body?.message || body?.error || `HTTP ${res.status}`);
      }
      // recargar catálogo
      await fetchInsumosFromTable();
      setDeleteModal({ open: false, row: null });
      
      // Mostrar notificación de éxito
      message.success('Insumo eliminado correctamente');
    } catch (e: unknown) {
      console.error('Error eliminando insumo:', e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(errorMessage);
      setDeleteModal({ open: false, row: null });
      if (errorMessage.toLowerCase().includes('permission') || errorMessage.toLowerCase().includes('forbidden') || errorMessage.toLowerCase().includes('policy')) {
        message.error(`Error eliminando insumo: permiso denegado. Si quieres que CRUD sea público, revisa las políticas RLS en Supabase o marca la tabla como accesible para el rol \`authenticated\`/público. Detalles: ${errorMessage}`);
      } else {
        message.error(`Error al eliminar el insumo: ${errorMessage}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const submitForm = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevenir cualquier propagación del evento

    if (!canManageInsumos) {
      message.warning('No tienes permisos para guardar insumos');
      return;
    }
    
    // Limpiar errores anteriores
    setFieldErrors({});
    
    // Validación manual: construir errores por campo y mostrarlos inline
    const errors: Record<string, string> = {};
    if (!form.nombre.trim()) {
      errors.nombre = 'El nombre es obligatorio. Por favor completa el campo.';
    }
    if (categoriasBD.length > 0 && (form.categoriaId == null || form.categoriaId === undefined)) {
      errors.categoriaId = 'Selecciona una categoría antes de continuar.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      // poner foco en el primer campo con error
      const first = Object.keys(errors)[0];
      setTimeout(() => {
        const el = document.getElementById(first);
        if (el) (el as HTMLElement).focus();
      }, 50);
      return;
    }

    // Mapear campos del formulario a la estructura esperada por CreateInsumoDTO
    const payload: Record<string, unknown> = {
      nombre_insumo: form.nombre,
      unidad_base: form.unidad,
      costo_promedio: form.costo || 0,
      stock_minimo: form.stock_minimo ?? 0,
      stock_maximo: form.stock_maximo ?? 0,
      descripcion_presentacion: form.descripcion_presentacion || "",
      ubicacion: form.ubicacion && form.ubicacion.trim() !== "" ? form.ubicacion : UBICACIONES_FIJAS[0],
    };

    // Agregar campos opcionales solo si tienen valor
    if (form.categoriaId != null) payload.id_categoria = form.categoriaId;
    if (form.proveedorId != null) payload.id_proveedor_principal = form.proveedorId;
    if (form.fecha_vencimiento) payload.fecha_vencimiento = form.fecha_vencimiento;
    if (form.imagen && form.imagen.trim() !== "") payload.insumo_url = form.imagen;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (editingId) {
          // actualizar via backend
          const idNum = Number(editingId);
          console.log('Updating insumo id:', idNum, 'payload:', payload);
          const res = await fetch(`${import.meta.env.VITE_API_URL}/inventario/insumos/${idNum}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStore.get('access_token')}`,
            },
            body: JSON.stringify(payload),
          });
          const text = await res.text().catch(() => '');
          const body = parseResponseBody(text);
          if (!res.ok) {
            console.error('Error updating insumo:', res.status, body);
            throw new Error(body?.message || body?.error || `HTTP ${res.status}`);
          }
          console.log('Update response:', body);
        } else {
          // crear via backend - usar endpoint específico de inventario
          console.log('Creando insumo con payload:', payload);
          const res = await fetch(`${import.meta.env.VITE_API_URL}/inventario/insumos`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStore.get('access_token')}`,
            },
            body: JSON.stringify(payload),
          });
          const text = await res.text().catch(() => '');
          const body = parseResponseBody(text);
          if (!res.ok) {
            console.error('Error creating insumo:', res.status, body);
            throw new Error(body?.message || body?.error || `HTTP ${res.status}`);
          }
          console.log('Create response:', body);
          const created = body?.data;
          if (created && typeof created === 'object' && !Array.isArray(created)) {
            const record = created as Record<string, unknown>;
            const candidateKeys = ['id_insumo', 'id', 'insertId'];
            let newId: unknown;
            for (const key of candidateKeys) {
              if (key in record) {
                newId = record[key];
                if (newId != null) break;
              }
            }
            if (newId == null) {
              const firstKey = Object.keys(record)[0];
              newId = firstKey ? record[firstKey] : undefined;
            }
            if (typeof newId === 'number' || typeof newId === 'string') {
              setForm((f) => ({ ...f, id: String(newId) }));
            }
          }
        }
        // recargar listado desde el backend para reflejar cambios
        console.log('Llamando reloadData después de guardar...');
        await reloadData();
        console.log('reloadData completado');
        setOpenDrawer(false);

        // Mostrar notificación de éxito
        message.success(editingId ? 'Insumo actualizado correctamente' : 'Insumo creado correctamente');
      } catch (e: unknown) {
        console.error('Error guardando insumo - raw error:', e);
        const errorMessage = e instanceof Error ? e.message : String(e);
        setError(errorMessage);
        const lower = errorMessage.toLowerCase();
        if (lower.includes('forbidden') || lower.includes('permission') || lower.includes('policy')) {
          message.error(`Error de permisos al guardar insumo. Revisa roles/permisos en el backend. Detalles: ${errorMessage}`);
        } else {
          message.error(`Error guardando insumo. Revisa la consola para más detalles. ${errorMessage}`);
        }
      } finally {
        setLoading(false);
      }
    })();
  };

  const setFormField = useCallback(<K extends keyof Fila>(key: K, value: Fila[K]) => {
    // Si se cambia la categoría, ajusta el tipo automáticamente
    if (key === "categoriaId") {
      let tipo: TipoInsumo = "Operativo";
      const categoriaObj = categoriasBD.find(c => c.id_categoria === value);
      if (categoriaObj && categoriaObj.nombre && categoriaObj.nombre.toLowerCase().includes("perpetuo")) {
        tipo = "Perpetuo";
      }
      setForm((f) => ({ ...f, [key]: value, tipo }));
      // Limpiar error de ese campo si existía
      setFieldErrors((prev) => { const copy = { ...prev }; delete copy[String(key)]; return copy; });
    } else {
      setForm((f) => ({ ...f, [key]: value }));
      // Limpiar error de ese campo si existía
      setFieldErrors((prev) => { const copy = { ...prev }; delete copy[String(key)]; return copy; });
    }
  }, [categoriasBD]);

  /** Render */
  return (
    <div className="w-full">
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
          <h1 className="text-2xl font-bold text-gray-900">Catálogo de Insumos</h1>
        </div>
      </div>

      {/* Modal de confirmación de eliminación */}
      <AnimatePresence>
        {deleteModal.open && deleteModal.row && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="bg-white rounded-xl shadow-xl p-7 max-w-md w-full border">
              <div className="text-lg font-bold mb-2 text-gray-800">¿Eliminar insumo?</div>
              <div className="mb-4 text-gray-700">Esta acción no se puede deshacer.<br />¿Seguro que deseas eliminar <span className="font-semibold">{deleteModal.row.nombre}</span>?</div>
              <div className="flex gap-3 justify-end">
                <button className="h-10 px-4 rounded-lg border text-sm font-semibold hover:bg-gray-50" onClick={() => setDeleteModal({ open: false, row: null })}>Cancelar</button>
                <button className="h-10 px-4 rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-700" onClick={confirmDeleteRow} disabled={loading}>{loading ? "Eliminando..." : "Eliminar"}</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filtros y acciones */}
      <div className="mb-4">
        <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
          {/* Izquierda: pestañas, select, búsqueda */}
          <div className="flex items-center gap-3">
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

            <label className="sr-only" htmlFor="categoria">Categoría</label>
            <select
              id="categoria"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700"
            >
              {categoriasOptions.map((cat: string, index: number) => (
                <option key={index} value={cat}>{cat}</option>
              ))}
            </select>
            <div className="relative">
              <label className="sr-only" htmlFor="search">Buscar</label>
              <input
                id="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar insumos…"
                className="h-10 w-64 rounded-lg border border-gray-200 bg-white pl-3 pr-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
          </div>

          {/* Derecha: botones en la esquina (Limpiar, Gestión, Agregar) */}
          <div className="flex items-center gap-2">
            <button onClick={() => { setActiveTab("todos"); setCategoria("Todas las categorías"); setQ(""); }} className="h-10 rounded-lg border px-3 text-sm font-semibold hover:bg-gray-50 flex items-center gap-2">
              <PiBroomBold />
              Limpiar filtros
            </button>
            <button onClick={() => { navigate('/inventario/categorias'); }} className="h-10 rounded-lg border px-3 text-sm font-semibold hover:bg-gray-50 flex items-center gap-2 text-gray-800">
              {/* SVG inline de icono de categorías (etiqueta/list) */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-90">
                <path d="M3 7.5L11 3l10 6.5-8 6.5L3 7.5z" stroke="#12443D" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="9.5" cy="7" r="0.8" fill="#12443D" />
              </svg>
              Gestión de Categorías
            </button>
            {canManageInsumos && (
              <button onClick={openCreate} className="h-10 rounded-lg px-4 text-sm font-semibold text-white flex items-center gap-2" style={{ backgroundColor: '#12443D' }}>
                <PiPlusBold />
                Agregar Insumo
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabla principal del catálogo de insumos */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-sm text-gray-500">
              <tr className="border-b">
                <Th label="Nombre" onSort={() => toggleSort("nombre")} active={sortBy === "nombre"} dir={sortDir} />
                <Th label="Categoría" onSort={() => toggleSort("categoria")} active={sortBy === "categoria"} dir={sortDir} />
                <Th label="Tipo de Categoría" onSort={() => toggleSort("tipo")} active={sortBy === "tipo"} dir={sortDir} />
                <Th label="Stock Actual" onSort={() => toggleSort("stock")} active={sortBy === "stock"} dir={sortDir} />
                <Th label="Unidad" onSort={() => toggleSort("unidad")} active={sortBy === "unidad"} dir={sortDir} />
                <Th label="Ubicación" onSort={() => toggleSort("ubicacion")} active={sortBy === "ubicacion"} dir={sortDir} />
                <Th label="Estado" onSort={() => toggleSort("estado")} active={sortBy === "estado"} dir={sortDir} />
                <Th label="Última Actualización" onSort={() => toggleSort("ultimaActualizacion")} active={sortBy === "ultimaActualizacion"} dir={sortDir} />
                <th className="px-4 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="text-gray-800">
              {pageData.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={r.imagen || "/img/icon.png"}
                        alt={r.nombre || "imagen de insumo"}
                        className="w-8 h-8 rounded-lg object-cover bg-emerald-100"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/img/icon.png"; }}
                      />
                      <div>
                        <div className="font-semibold leading-5 line-clamp-2">{r.nombre}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                          <TipoBadge tipo={r.tipo} />
                          <span className="text-gray-400">•</span>
                          <span>{r.automatica ? "Actualización automática" : "Conteo manual"}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">{r.categoria}</td>
                  <td className="px-4 py-3 align-top">{r.tipo}</td>
                  <td className="px-4 py-3 align-top">{formatStock(r.stockCantidad)}</td>
                  <td className="px-4 py-3 align-top">{r.unidad}</td>
                  <td className="px-4 py-3 align-top">{r.ubicacion || "—"}</td>
                  <td className="px-4 py-3 align-top"><EstadoPill estado={r.estado} /></td>
                  <td className="px-4 py-3 align-top">{formatDateHuman(r.ultimaActualizacion)}</td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center gap-2 justify-end">
                      <IconBtn title={`Ver ${r.nombre}`} onClick={() => { setDetail(r); }}><PiEyeBold /></IconBtn>
                      {canManageInsumos && (
                        <>
                          <IconBtn title="Editar" onClick={() => openEdit(r)}><PiPencilSimpleBold /></IconBtn>
                          <IconBtn title="Eliminar" onClick={() => deleteRow(r)}><PiTrashBold /></IconBtn>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {pageData.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    <div className="max-w-md mx-auto">
                      <div className="text-lg font-semibold text-gray-700">Sin resultados</div>
                      <p className="mt-1">Intenta ajustar los filtros o buscar otra palabra clave.</p>
                      <div className="mt-3">
                        <button onClick={() => { setActiveTab("todos"); setCategoria("Todas las categorías"); setQ(""); }} className="text-sm font-semibold text-emerald-700 hover:underline">
                          Restablecer filtros
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer tabla */}
        <div className="px-4 py-3 text-sm text-gray-600 flex flex-wrap items-center gap-3 justify-between">
          <div>
            Mostrando <span className="font-semibold">{((page - 1) * perPage) + 1} - {Math.min(page * perPage, total)}</span> de <span className="font-semibold">{total}</span> insumos
          </div>
          <div className="flex items-center gap-2">
            <label className="text-gray-500 text-xs" htmlFor="perPage">Por página</label>
            <select
              id="perPage"
              value={perPage}
              onChange={(e) => setPerPage(Number(e.target.value))}
              className="h-9 rounded border border-gray-200 bg-white px-2 text-sm"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-9 px-3 rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="opacity-75">
                  <path d="M15 18l-6-6 6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Anterior
              </button>
              <span className="px-3 py-1.5 rounded bg-gray-100 text-sm font-medium">
                Página {page} de {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="h-9 px-3 rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                Siguiente
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="opacity-75">
                  <path d="M9 6l6 6-6 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Drawer crear/editar */}
      <AnimatePresence>
        {openDrawer && (
          <motion.aside
            initial={{ x: 520, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 520, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="fixed inset-y-0 right-0 z-50 w-full md:max-w-[920px] bg-white shadow-2xl border-l border-gray-100"
            role="dialog"
            aria-modal="true"
          >
            <div className="h-14 px-5 flex items-center justify-between border-b border-gray-100">
              <h3 className="text-base md:text-lg font-bold text-gray-800">
                {editingId ? "Editar Insumo" : "Crear Insumo"}
              </h3>
              <button onClick={() => setOpenDrawer(false)} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Cerrar">
                <MdClose size={20} />
              </button>
            </div>

            <div className="h-[calc(100vh-56px)] grid grid-cols-1 lg:grid-cols-[1fr_360px]">
              {/* Formulario */}
              <form 
                id="insumo-form" 
                onSubmit={submitForm} 
                noValidate 
                autoComplete="off"
                className="overflow-y-auto p-5 md:p-6 lg:p-7 space-y-5"
              >
                {/* Información Básica */}
                <section className="bg-white rounded-xl border border-gray-200/70 shadow-sm p-4 md:p-5">
                  <div className="text-sm font-bold text-gray-800 mb-4">Información Básica</div>
                  <div className="grid gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1" htmlFor="nombre">Nombre del Insumo *</label>
                      <input 
                        id="nombre" 
                        value={form.nombre} 
                        onChange={(e) => setFormField("nombre", e.target.value)} 
                        placeholder="Ej: Carne de Res Premium" 
                        className={`w-full h-11 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 ${
                          fieldErrors.nombre ? 'border-red-500 focus:ring-red-300' : 'border-gray-200'
                        }`}
                        aria-invalid={fieldErrors.nombre ? "true" : "false"}
                        aria-describedby={fieldErrors.nombre ? "nombre-error" : undefined}
                      />
                      {fieldErrors.nombre && (
                        <p id="nombre-error" className="mt-1 text-sm text-red-600">
                          {fieldErrors.nombre}
                        </p>
                      )}
                      {fieldErrors.nombre && (
                        <div className="mt-1 text-sm text-rose-700">{fieldErrors.nombre}</div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1" htmlFor="categoriaSel">Categoría *</label>
                        <select id="categoriaSel" value={form.categoriaId ?? ""} onChange={(e) => setFormField("categoriaId", e.target.value === "" ? undefined : Number(e.target.value))} className="w-full h-11 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300">
                          <option value="">Seleccione categoría</option>
                          {categoriasBD.length > 0 ? categoriasBD.map((c) => <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>) : <option disabled>No hay categorías disponibles</option>}
                        </select>
                        {fieldErrors.categoriaId && (
                          <div className="mt-1 text-sm text-rose-700">{fieldErrors.categoriaId}</div>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1" htmlFor="unidad">Unidad Base</label>
                        <select id="unidad" value={form.unidad} onChange={(e) => setFormField("unidad", e.target.value as UnidadMedida)} className="w-full h-11 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300">
                          {UNIDADES.map((u) => <option key={u}>{u}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Campos adicionales que solo aparecen al editar */}
                    {editingId && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Stock Actual</label>
                          <input type="number" inputMode="decimal" id="stockCantidad" value={form.stockCantidad} readOnly className="w-full h-11 rounded-lg border border-gray-200 px-3 text-sm bg-gray-50 cursor-not-allowed" />
                        </div>
                        {/* Campo Estado oculto según requerimiento del usuario */}
                        {/* <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Estado</label>
                          <select value={form.estado} onChange={(e) => setFormField("estado", e.target.value as EstadoStock)} className="w-full h-11 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300">
                            {(["OK", "Stock Bajo", "Crítico", "Vacío", "Sobre stock"] as EstadoStock[]).map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div> */}
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Actualización</label>
                          <select value={form.automatica ? "auto" : "manual"} onChange={(e) => setFormField("automatica", e.target.value === "auto")} className="w-full h-11 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300">
                            <option value="manual">Conteo manual</option>
                            <option value="auto">Actualización automática</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                {/* El tipo de insumo se selecciona automáticamente según la categoría */}

                {/* Información Adicional */}
                <section className="bg-white rounded-xl border border-gray-200/70 shadow-sm p-4 md:p-5">
                  <div className="text-sm font-bold text-gray-800 mb-4">Información Adicional</div>
                  <div className="grid gap-4">

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Proveedor Principal</label>
                      <select value={form.proveedorId ?? ""} onChange={(e) => setFormField("proveedorId", e.target.value === "" ? undefined : Number(e.target.value))} className="w-full h-11 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300">
                        <option value="">Seleccionar proveedor</option>
                        {proveedoresBD.length > 0 ? proveedoresBD.map((p) => <option key={p.id_proveedor} value={p.id_proveedor}>{p.nombre_empresa}</option>) : (<>
                          <option value={1}>Carnes del Valle</option>
                          <option value={2}>La Bodeguita</option>
                        </>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Costo Promedio (Q)</label>
                      <input type="number" inputMode="decimal" value={form.costo ?? ""} onChange={(e) => setFormField("costo", e.target.value === "" ? undefined : Number(e.target.value))} className="w-full h-11 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Imagen del producto</label>
                      <div className="flex gap-3 items-center">
                        {form.imagen && (
                          <img src={form.imagen} alt="preview" className="h-16 w-16 object-cover rounded border" />
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const ext = file.name.includes('.') ? file.name.split('.').pop() : undefined;
                            const sanitizedExt = ((ext || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')) || 'bin';
                            const bucket = 'insumo-img';
                            const folder = form.id ? `insumo/${form.id}` : 'insumo/tmp';
                            const uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
                            const fileName = `${folder}/${uniqueSuffix}.${sanitizedExt}`;
                            console.debug('insumo file diagnostics:', {
                              name: file.name,
                              type: file.type,
                              size: file.size,
                              constructor: file?.constructor?.name,
                              toString: Object.prototype.toString.call(file),
                              isFile: file instanceof File,
                              isBlob: file instanceof Blob,
                              bucket,
                              folder,
                              fileName,
                            });

                            // Read as ArrayBuffer and upload a Blob to ensure binary content
                            const arrayBuffer = await file.arrayBuffer();
                            const blob = new Blob([arrayBuffer], { type: file.type || 'application/octet-stream' });
                            const { data, error } = await supabase.storage.from(bucket).upload(fileName, blob, { upsert: true, contentType: file.type });
                            if (error) {
                              console.error('Error subiendo imagen insumo:', error, { bucket, fileName });
                              message.error('Error subiendo imagen: ' + (error?.message || String(error)));
                              return;
                            }
                            const uploadedPath = data?.path || fileName;
                            const publicUrl = supabase.storage.from(bucket).getPublicUrl(uploadedPath).data.publicUrl;
                            console.debug('insumo-img upload:', { fileName, uploadedPath, publicUrl, data });
                            setFormField('imagen', publicUrl);
                            message.success('Imagen del insumo actualizada');
                          }}
                          className="block"
                        />
                      </div>
                      <input value={form.imagen ?? ""} onChange={(e) => setFormField("imagen", e.target.value)} placeholder="https://.../imagen.png" className="w-full h-11 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 mt-2" />
                    </div>
                  </div>
                </section>

                {/* Información de Inventario */}
                <section className="bg-white rounded-xl border border-gray-200/70 shadow-sm p-4 md:p-5">
                  <div className="text-sm font-bold text-gray-800 mb-4">Información de Inventario</div>
                  <div className="grid gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1" htmlFor="stock_minimo">Stock Mínimo</label>
                        <input
                          id="stock_minimo"
                          type="number"
                          inputMode="decimal"
                          value={form.stock_minimo ?? ""}
                          onChange={(e) => setFormField("stock_minimo", e.target.value === "" ? undefined : Number(e.target.value))}
                          placeholder="0"
                          className="w-full h-11 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1" htmlFor="stock_maximo">Stock Máximo</label>
                        <input
                          id="stock_maximo"
                          type="number"
                          inputMode="decimal"
                          value={form.stock_maximo ?? ""}
                          onChange={(e) => setFormField("stock_maximo", e.target.value === "" ? undefined : Number(e.target.value))}
                          placeholder="0"
                          className="w-full h-11 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1" htmlFor="fecha_vencimiento">Fecha de Vencimiento</label>
                      <input
                        id="fecha_vencimiento"
                        type="date"
                        value={form.fecha_vencimiento ?? ""}
                        onChange={(e) => setFormField("fecha_vencimiento", e.target.value === "" ? undefined : e.target.value)}
                        className="w-full h-11 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1" htmlFor="ubicacion">Ubicación</label>
                      <select
                        id="ubicacion"
                        value={form.ubicacion ?? ""}
                        onChange={(e) => setFormField("ubicacion", e.target.value)}
                        className="w-full h-11 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                      >
                        <option value="">Selecciona una ubicación</option>
                        {ubicacionesMenu.map((ubicacion) => (
                          <option key={ubicacion} value={ubicacion}>{ubicacion}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1" htmlFor="descripcion_presentacion">Descripción de Presentación</label>
                      <textarea
                        id="descripcion_presentacion"
                        value={form.descripcion_presentacion ?? ""}
                        onChange={(e) => setFormField("descripcion_presentacion", e.target.value)}
                        placeholder="Ej: Bolsa de 1kg, Caja de 24 unidades, etc."
                        className="w-full min-h-[40px] rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                      />
                    </div>
                  </div>
                </section>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button type="submit" disabled={loading} className="h-11 rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60">
                    {loading ? "Guardando..." : editingId ? "Guardar cambios" : "Crear Insumo"}
                  </button>
                  <button type="button" className="h-11 rounded-lg border px-4 text-sm font-semibold hover:bg-gray-50" onClick={() => setOpenDrawer(false)}>
                    Cancelar
                  </button>
                </div>

                  {error && (
                    <div className="p-3 text-sm text-rose-700 bg-rose-50 rounded-md">Error: {error}</div>
                  )}
              </form>

              {/* Resumen */}
              <div className="hidden lg:block border-l border-gray-100 bg-gray-50/60">
                <div className="h-full overflow-y-auto">
                  <div className="sticky top-0 p-5">
                    <div className="bg-white rounded-xl border border-gray-200/70 shadow-sm p-5">
                      <div className="text-sm font-bold text-gray-800 mb-4">Resumen</div>
                      <div className="space-y-3 text-sm">
                        <ResumenRow label="ID del Insumo:">{editingId || form.id || "Nuevo"}</ResumenRow>
                        <ResumenRow label="Nombre:">{form.nombre || "—"}</ResumenRow>
                        <ResumenRow label="Categoría:">{(form.categoriaId != null ? (categoriasBD.find(c => c.id_categoria === form.categoriaId)?.nombre) : form.categoria) || "No seleccionada"}</ResumenRow>
                        <ResumenRow label="Proveedor:">{(form.proveedorId != null ? (proveedoresBD.find(p => p.id_proveedor === form.proveedorId)?.nombre_empresa) : form.proveedor) || "No seleccionado"}</ResumenRow>
                        <ResumenRow label="Unidad:">{form.unidad || "unidad"}</ResumenRow>
                        <ResumenRow label="Stock Mínimo:">{form.stock_minimo ?? "0"}</ResumenRow>
                        <ResumenRow label="Stock Máximo:">{form.stock_maximo ?? "Sin límite"}</ResumenRow>
                        <ResumenRow label="Costo:">Q {form.costo ?? "0.00"}</ResumenRow>
                        <ResumenRow label="Ubicación:">{form.ubicacion || "No especificada"}</ResumenRow>
                        <ResumenRow label="Fecha Vencimiento:">{form.fecha_vencimiento || "Sin vencimiento"}</ResumenRow>
                        <ResumenRow label="Tipo:">{form.tipo || "operativo"}</ResumenRow>
                        <ResumenRow label="Estado:"><EstadoPill estado={form.estado} /></ResumenRow>
                        <ResumenRow label="Stock Actual:">{formatStock(form.stockCantidad)}</ResumenRow>
                        <ResumenRow label="Actualización:">{form.automatica ? "Automática" : "Manual"}</ResumenRow>
                      </div>
                      <div className="mt-5 flex gap-3">
                        <button form="insumo-form" type="submit" className="h-10 flex-1 rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-white hover:bg-emerald-600">
                          {editingId ? "Guardar" : "Crear"}
                        </button>
                        <button className="h-10 flex-1 rounded-lg border px-4 text-sm font-semibold hover:bg-gray-50" onClick={() => setOpenDrawer(false)}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* MODAL: Vista rápida de insumo */}

      {/* MODAL: Vista rápida de insumo */}
      <AnimatePresence>
        {detail && (
          <>
            {/* Overlay */}
            <motion.div
              key="overlay"
              className="fixed inset-0 z-[60] bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            {/* Modal */}
            <motion.div
              key="modal"
              className="fixed inset-0 z-[61] flex items-center justify-center p-4"
              initial={{ opacity: 0, scale: 0.98, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 8 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="insumo-detail-title"
            >
              <div className="w-full max-w-7xl min-h-[620px] rounded-2xl bg-white shadow-2xl border border-gray-100">
                <div className="flex items-center justify-between px-4 h-12 border-b">
                  <h3 id="insumo-detail-title" className="text-lg font-bold text-gray-800">
                    {detail.nombre}
                  </h3>
                  <button className="p-2 rounded-lg hover:bg-gray-100" onClick={() => setDetail(null)} aria-label="Cerrar">
                    <MdClose size={20} />
                  </button>
                </div>

                <div className="p-6 space-y-6 max-h-[82vh] overflow-auto">
                  {/* Header con imagen y badges */}
                  <div className="flex flex-col lg:flex-row gap-6">
                    <div className="flex-shrink-0">
                      {detail.imagen ? (
                        <img
                          src={detail.imagen}
                          alt={detail.nombre || "Imagen de insumo"}
                          className="h-32 w-32 rounded-xl border border-gray-200 object-cover"
                        />
                      ) : (
                        <div className="h-32 w-32 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl flex items-center justify-center text-gray-400 border border-gray-200">
                          <span className="text-4xl">📦</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <TipoBadge tipo={detail.tipo} />
                        <EstadoPill estado={detail.estado} />
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          detail.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {detail.activo ? 'Activo' : 'Inactivo'}
                        </span>
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                          {detail.automatica ? "Actualización automática" : "Conteo manual"}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>ID: <span className="font-mono text-gray-800">{detail.id}</span></div>
                        <div>Categoría: <span className="font-medium text-gray-800">{detail.categoria}</span></div>
                        <div>Unidad: <span className="font-medium text-gray-800">{detail.unidad}</span></div>
                      </div>
                    </div>
                  </div>

                  {/* Información Principal */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">Stock y Costos</h4>
                      <div className="space-y-2 text-sm">
                        <DetailRow label="Stock Actual" value={formatStock(detail.stockCantidad)} />
                        <DetailRow label="Stock Mínimo" value={detail.stock_minimo != null ? String(detail.stock_minimo) : "No definido"} />
                        <DetailRow label="Stock Máximo" value={detail.stock_maximo != null ? String(detail.stock_maximo) : "Sin límite"} />
                        <DetailRow label="Costo Promedio" value={detail.costo != null ? `Q ${detail.costo.toFixed(2)}` : "—"} />
                      </div>
                    </div>

                    <div className="bg-blue-50 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-blue-700 mb-3">Proveedor y Ubicación</h4>
                      <div className="space-y-2 text-sm">
                        <DetailRow label="Proveedor" value={detail.proveedor ?? "No asignado"} />
                        <DetailRow label="Ubicación" value={detail.ubicacion ?? "No especificada"} />
                        <DetailRow label="Última Actualización" value={formatDateHuman(detail.ultimaActualizacion)} />
                      </div>
                    </div>

                    <div className="bg-amber-50 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-amber-700 mb-3">Información Adicional</h4>
                      <div className="space-y-2 text-sm">
                        <DetailRow label="Fecha Vencimiento" value={detail.fecha_vencimiento ? new Date(detail.fecha_vencimiento).toLocaleDateString() : "Sin vencimiento"} />
                        <DetailRow label="Presentación" value={detail.descripcion_presentacion ?? "No especificada"} />
                        <DetailRow label="Valor Total" value={detail.costo != null && detail.stockCantidad > 0 ? `Q ${(detail.costo * detail.stockCantidad).toFixed(2)}` : "—"} />
                      </div>
                    </div>
                  </div>

                  {/* Estadísticas rápidas */}
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-indigo-700 mb-3">Estadísticas Rápidas</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="text-center">
                        <div className="text-lg font-bold text-indigo-600">{formatStock(detail.stockCantidad)}</div>
                        <div className="text-xs text-gray-600">Stock Actual</div>
                      </div>
                      {detail.stock_minimo != null && (
                        <div className="text-center">
                          <div className="text-lg font-bold text-gray-600">
                            {formatStock(detail.stock_minimo)}
                          </div>
                          <div className="text-xs text-gray-600">Stock Mínimo</div>
                        </div>
                      )}
                      {detail.stock_maximo != null && (
                        <div className="text-center">
                          <div className="text-lg font-bold text-gray-600">
                            {formatStock(detail.stock_maximo)}
                          </div>
                          <div className="text-xs text-gray-600">Stock Máximo</div>
                        </div>
                      )}
                      <div className="text-center">
                        <div className="text-lg font-bold text-purple-600">
                          {detail.costo != null ? `Q ${detail.costo.toFixed(0)}` : '—'}
                        </div>
                        <div className="text-xs text-gray-600">Costo Unit.</div>
                      </div>
                    </div>
                  </div>

                  {/* Kárdex incrustado dentro del modal de detalle */}
                  <div ref={kardexRef}>
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-semibold text-gray-800">Historial de Movimientos (Kárdex)</h4>
                        <div className="text-sm text-gray-500">
                          Últimos 30 días
                        </div>
                      </div>
                      <Kardex id_insumo={Number(detail.id)} onClose={() => setDetail(null)} />
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 border-t bg-gray-50">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">ID:</span> {detail.id}
                      </div>
                      <div>
                        <span className="font-medium">Creado:</span> {formatDateHuman(detail.ultimaActualizacion)}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                      <button className="h-9 px-3 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors flex items-center gap-2" onClick={() => setDetail(null)}>
                        <PiX size={16} />
                        Cerrar
                      </button>
                      <button className="h-9 px-3 rounded-md border border-blue-300 text-sm font-medium text-blue-700 hover:bg-blue-50 hover:border-blue-400 transition-colors flex items-center gap-2" onClick={() => setShowKardexFull(true)}>
                        <PiChartBar size={16} />
                        Ver Kárdex
                      </button>
                      <button 
                        className="h-9 px-3 rounded-md text-sm font-medium text-white transition-colors flex items-center gap-2" 
                        style={{ backgroundColor: '#12443d' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0d3630'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#12443d'}
                        onClick={() => { setDetail(null); openEdit(detail); }}
                      >
                        <PiPencilSimpleBold size={16} />
                        Editar Insumo
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              {/* Modal / vista amplia del Kárdex */}
              {showKardexFull && (
                <div className="fixed inset-0 z-50 flex items-start justify-center p-4">
                  <div className="absolute inset-0 bg-black/40" onClick={() => setShowKardexFull(false)} />
                  <div className="relative w-full max-w-[95vw] h-[90vh] bg-white rounded-lg shadow-lg overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b">
                      <h3 className="text-lg font-semibold">Kárdex — Insumo #{detail.id}</h3>
                      <button className="p-2 rounded hover:bg-gray-100" onClick={() => setShowKardexFull(false)} aria-label="Cerrar Kárdex">
                        <MdClose size={20} />
                      </button>
                    </div>
                    <div className="p-4 h-[calc(100%-64px)] overflow-auto">
                      <Kardex id_insumo={Number(detail.id)} onClose={() => setShowKardexFull(false)} fullScreen />
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
    </div>
  );
}

/** Subcomponentes */
function Th({ label, onSort, active, dir }: { label: string; onSort: () => void; active?: boolean; dir?: "asc" | "desc" }) {
  return (
    <th className="px-4 py-3 font-medium select-none">
      <button type="button" onClick={onSort} className="inline-flex items-center gap-1 text-left hover:underline" aria-label={`Ordenar por ${label}`}>
        <span>{label}</span>
        {active ? (dir === "asc" ? <PiArrowUpBold className="opacity-70" /> : <PiArrowDownBold className="opacity-70" />) : null}
      </button>
    </th>
  );
}
function ResumenRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800 max-w-[55%] text-right truncate">{children}</span>
    </div>
  );
}

function IconBtn({ title, children, onClick, style }: { title: string; children: React.ReactNode; onClick?: () => void; style?: React.CSSProperties }) {
  return (
    <button title={title} onClick={onClick} style={style} className="p-2 rounded-lg hover:bg-gray-100 text-gray-700" type="button" aria-label={title}>
      {children}
    </button>
  );
}
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800">{value}</span>
    </div>
  );
}

