/* ===============================================
 * 🐱 ARCHIVO .TSX (MODO LOCAL / SIN BD)
 * - Receta inline en el formulario (single/complex)
 * - ESLint/TS OK (sin any, sin hooks condicionales)
 * =============================================== */
import React, { useMemo, useState, useEffect, useCallback } from "react";
import axios from 'axios';
import { message } from 'antd';
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { getInsumos } from '@/api/inventarioService';
import { productosService, type Producto as ProductoAPI, type CategoriaProducto as CategoriaProductoAPI, type ProductoConReceta } from '@/api/productosService';
import { supabase } from '@/api/supabaseClient';
import { localStore } from '@/utils/storage';
import {
  PiEyeBold,
  PiPencilSimpleBold,
  PiTrashBold,
  PiSpinnerBold,
  PiFloppyDiskBold,
  PiPlusBold,
  PiArrowLeftBold,
  PiMoneyBold,
} from "react-icons/pi";
import { useAuth } from '../../../../../hooks/useAuth';
import { PermissionLevel } from '../../../../../constants/permissions';

/* ============================================================
 * ===== Tipos =====
 * ============================================================ */
type CategoriaProducto = {
  id_categoria: number;
  nombre: string;
  tipo_categoria?: 'perpetuo' | 'operativo';
};

type Insumo = {
  id_insumo: number;
  nombre: string;
  costo_promedio: number;
  unidad_medida_compra: string;
  id_categoria?: number;
  stock_actual?: number;
};

type InsumoRaw = {
  id_insumo: number;
  nombre_insumo: string;
  tipo_insumo: string;
  costo_promedio: number;
  unidad_base: string;
  id_categoria: number;
  stock_actual: number;
};

type Producto = {
  id: string;
  nombre: string;
  descripcion?: string;
  id_categoria: number;
  categoria: string;
  precio_venta: number;
  activo: boolean;
  imagen_url?: string;
  costo_total_producto: number | null;
};

type VarianteForm = {
  id_variante?: number;
  nombre_variante: string;
  precio_variante?: number;
  costo_variante?: number;
  estado?: 'activo' | 'desactivado';
  id_insumo?: number;
  cantidad_insumo?: number;  // Cantidad del insumo a descontar
};

type FormProducto = Omit<Producto, "id"> & { id?: string; variantes?: VarianteForm[] };

type RecetaLinea = {
  id_receta_detalle?: number;
  id_producto: string;
  id_insumo: number;
  cantidad_insumo: number;
  unidad_medida: string;
  // es_obligatorio removed from the UI / model (handled as NOT obligatory by default)
  insumo?: {
    nombre: string;
    costo_promedio: number;
  };
};

/* ============================================================
 * ===== Utils =====
 * ============================================================ */
const currency = (n: number) =>
  (n || 0).toLocaleString("es-GT", {
    style: "currency",
    currency: "GTQ",
    minimumFractionDigits: 2,
  });

const unique = <T,>(arr: T[]) => Array.from(new Set(arr));

const slugify = (s: string) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const PRODUCT_IMAGE_BUCKET = 'producto-img';

const dataUrlToBlob = (dataUrl: string): Blob => {
  const parts = dataUrl.split(',');
  if (parts.length !== 2) {
    throw new Error('Formato de imagen inválido');
  }
  const metadata = parts[0];
  const base64Data = parts[1];
  const mimeMatch = metadata.match(/data:(.*?);/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i += 1) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
};

const uploadProductoImage = async (
  blob: Blob,
  options?: { nameHint?: string; extensionHint?: string }
): Promise<string> => {
  const mimeExtension = blob.type?.split('/').pop() ?? 'bin';
  const extension = (options?.extensionHint || mimeExtension || 'bin')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') || 'bin';
  const slug = slugify(options?.nameHint || 'producto');
  const objectPath = `${slug || 'producto'}/${Date.now()}.${extension}`;

  const uploadResult = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(objectPath, blob, {
      upsert: true,
      cacheControl: '3600',
      contentType: blob.type || undefined,
    });

  if (uploadResult.error) {
    throw uploadResult.error;
  }

  const publicUrlResult = supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .getPublicUrl(objectPath);

  if (!publicUrlResult.data?.publicUrl) {
    throw new Error('No se pudo obtener la URL pública de la imagen');
  }

  return publicUrlResult.data.publicUrl;
};

const ensureRemoteImage = async (
  imageCandidate?: string | null,
  options?: { nameHint?: string }
): Promise<string | undefined> => {
  if (!imageCandidate) {
    return undefined;
  }
  if (!imageCandidate.startsWith('data:')) {
    return imageCandidate;
  }
  const blob = dataUrlToBlob(imageCandidate);
  return uploadProductoImage(blob, {
    nameHint: options?.nameHint,
    extensionHint: blob.type?.split('/').pop() ?? undefined,
  });
};

/* ===== Icon Button ===== */
function IconBtn({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="p-2 rounded-lg hover:bg-emerald-50 text-gray-700 hover:text-emerald-700"
      type="button"
      aria-label={title}
    >
      {children}
    </button>
  );
}

/* ============================================================
 * COMPONENTE PRINCIPAL
 * ============================================================ */

// Convertir API Producto a formato interno del componente
const mapProductoDB = (
  p: ProductoAPI | ProductoConReceta,
  categoriaLookup?: Record<number, CategoriaProductoAPI>
): Producto => {
  const categoria = p.id_categoria ? categoriaLookup?.[p.id_categoria] : undefined;

  return {
    id: String(p.id_producto),
    nombre: p.nombre_producto,
    descripcion: p.descripcion ?? '',
    id_categoria: p.id_categoria ?? 0,
    categoria: categoria?.nombre_categoria ?? 'Sin categoría',
    precio_venta: p.precio_venta,
    activo: p.estado === 'activo',
    imagen_url: p.imagen_url ?? '',
    costo_total_producto: p.costo_producto ?? null,
  };
};

export default function ProductosPage() {
  const navigate = useNavigate();
  const { roleLevel } = useAuth();
  const canManageProductos = (roleLevel ?? 0) >= PermissionLevel.ADMINISTRADOR;

  const ensureCanManageProductos = useCallback(() => {
    if (!canManageProductos) {
      message.warning('No tienes permisos para administrar productos.');
      return false;
    }
    return true;
  }, [canManageProductos]);
  const [rows, setRows] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<CategoriaProducto[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [recetas, setRecetas] = useState<Record<string, RecetaLinea[]>>({});
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [productosResponse, categoriasResponse, insumosResponse] = await Promise.all([
        productosService.getProductos(),
        productosService.getCategorias(),
        getInsumos()
      ]);

      if (!Array.isArray(productosResponse)) {
        throw new Error('Formato de respuesta de productos inválido');
      }

      if (!Array.isArray(categoriasResponse)) {
        throw new Error('Formato de respuesta de categorías inválido');
      }

      const categoriasLookup = categoriasResponse.reduce<Record<number, CategoriaProductoAPI>>((acc, categoria) => {
        acc[categoria.id_categoria] = categoria;
        return acc;
      }, {});

      const categoriasMapeadas = categoriasResponse.map<CategoriaProducto>((c) => ({
        id_categoria: c.id_categoria,
        nombre: c.nombre_categoria,
        tipo_categoria: (c.estado === 'activo' ? 'perpetuo' : 'operativo'),
      }));
      setCategorias(categoriasMapeadas);

      const productosMapeados = productosResponse
        .filter((p) => p && typeof p === 'object')
        .map((p) => mapProductoDB(p, categoriasLookup));
      setRows(productosMapeados);

      const insumosPayload = Array.isArray((insumosResponse as { data?: unknown })?.data)
        ? (insumosResponse as { data: InsumoRaw[] }).data
        : Array.isArray(insumosResponse)
          ? (insumosResponse as InsumoRaw[])
          : [];

      const insumosOperativos = insumosPayload
        .filter((i) => i.tipo_insumo === 'operativo')
        .map((i) => ({
          id_insumo: i.id_insumo,
          nombre: i.nombre_insumo,
          costo_promedio: i.costo_promedio,
          unidad_medida_compra: i.unidad_base,
          id_categoria: i.id_categoria,
          stock_actual: i.stock_actual
        }));
      setInsumos(insumosOperativos);
      setRecetas({});
    } catch (error) {
      console.error('Error cargando datos de productos:', error);
      message.error('Error cargando datos. Por favor intente de nuevo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // filtros
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("Todas");
  const [estado, setEstado] = useState<"todos" | "activo" | "desactivado">("todos");

  // modales
  const [showView, setShowView] = useState<{ producto: Producto; receta: RecetaLinea[] } | null>(null);
  const [modalProducto, setModalProducto] = useState<
    | null
    | {
        mode: "create" | "edit";
        data: FormProducto;
        recetaCargada?: RecetaLinea[];  // Receta precargada para evitar race conditions
      }
  >(null);

  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; productId: string; productName: string } | null>(null);

  const [openRecetario, setOpenRecetario] = useState<{ open: boolean; initialProductId?: string }>({ open: false });

  const categoriasFiltro = useMemo(
    () => ["Todas", ...unique(categorias.map((c) => c.nombre))],
    [categorias]
  );

  // Obtener datos filtrados y paginados
  const filteredData = useMemo(() => {
    let data = [...rows];

    if (cat !== "Todas") data = data.filter((r) => r.categoria === cat);
    if (estado !== "todos") data = data.filter((r) => r.activo === (estado === "activo"));
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      data = data.filter(
        (r) =>
          r.nombre.toLowerCase().includes(s) ||
          (r.descripcion || "").toLowerCase().includes(s) ||
          r.categoria.toLowerCase().includes(s)
      );
    }

    return data;
  }, [rows, q, cat, estado]);

  useEffect(() => {
    const pages = Math.max(1, Math.ceil(filteredData.length / Math.max(perPage, 1)));
    setTotal(filteredData.length);
    setTotalPages(pages);
    if (page > pages) {
      setPage(pages);
    }
  }, [filteredData.length, perPage, page]);

  const paginated = useMemo(() => {
    const start = (page - 1) * perPage;
    const end = start + perPage;
    return filteredData.slice(start, end);
  }, [filteredData, page, perPage]);

  const openCreate = () => {
    if (!ensureCanManageProductos()) {
      return;
    }
    const nuevo: FormProducto = {
      nombre: "",
      descripcion: "",
      id_categoria: categorias[0]?.id_categoria ?? 1,
      categoria: categorias[0]?.nombre ?? "Shucos",
      precio_venta: 0,
      activo: true,
      imagen_url: "",
      costo_total_producto: null,
      variantes: [],
    };

    setModalProducto({ mode: "create", data: nuevo });
  };

  // Carga diferida de recetas para evitar llamadas múltiples
  const ensureRecetaLoaded = useCallback(
    async (productId: string) => {
      console.log('🔍 ensureRecetaLoaded llamado para producto:', productId);
      
      if (recetas[productId]) {
        console.log('✅ Receta ya en cache:', recetas[productId]);
        return recetas[productId];
      }

      try {
        console.log('📡 Cargando receta desde API...');
        const recetaData = await productosService.getProductoConReceta(Number(productId));
        console.log('📦 Datos recibidos de API:', recetaData);
        
        const recetaFormateada: RecetaLinea[] = (recetaData?.receta || []).map((detalle) => {
          const insumoEncontrado = insumos.find((i) => i.id_insumo === detalle.id_insumo);
          return {
            id_receta_detalle: detalle.id_receta,
            id_producto: productId,
            id_insumo: detalle.id_insumo,
            cantidad_insumo: detalle.cantidad_requerida,
            unidad_medida: detalle.unidad_base,
            // es_obligatorio removed: default NOT obligatory (false)
            insumo: insumoEncontrado
              ? { nombre: insumoEncontrado.nombre, costo_promedio: insumoEncontrado.costo_promedio }
              : undefined,
          };
        });

        console.log('✅ Receta formateada:', recetaFormateada);
        setRecetas((prev) => ({ ...prev, [productId]: recetaFormateada }));
        return recetaFormateada;
      } catch (error) {
        console.error(`❌ Error cargando receta para producto ${productId}:`, error);
        return [];
      }
    },
    [insumos, recetas]
  );

  const openEdit = useCallback(
    async (producto: Producto) => {
      if (!ensureCanManageProductos()) {
        return;
      }
      const recetaCargada = await ensureRecetaLoaded(producto.id);

      const { id, ...resto } = producto;
      const editable: FormProducto = {
        ...resto,
        id,
        variantes: [],
      };

      setModalProducto({ mode: "edit", data: editable, recetaCargada });
    },
    [ensureCanManageProductos, ensureRecetaLoaded]
  );

  // ======= GUARDA (con receta inline) =======
  const onSaveProducto = async (payload: {
    mode: "create" | "edit";
    producto: FormProducto;
    link: "none" | "single" | "complex";
    singleInsumo?: Insumo;
    recipeLines?: RecetaLinea[];
    variantes?: VarianteForm[];
  }) => {
    if (!ensureCanManageProductos()) {
      return;
    }
    try {
      setLoading(true);

      const variantesNormalizadas = (payload.variantes ?? [])
        .filter((variant) => variant.nombre_variante && variant.nombre_variante.trim())
        .map((variant) => ({
          id_variante: variant.id_variante,
          nombre_variante: variant.nombre_variante.trim(),
          precio_variante: variant.precio_variante != null ? Number(variant.precio_variante) : undefined,
          costo_variante: variant.costo_variante != null ? Number(variant.costo_variante) : undefined,
          estado: variant.estado ?? 'activo',
          id_insumo: variant.id_insumo,
          cantidad_insumo: variant.cantidad_insumo != null ? Number(variant.cantidad_insumo) : undefined,
        }));

      if (variantesNormalizadas.some((variant) => (variant.cantidad_insumo ?? 0) < 0)) {
        message.error('La cantidad de insumo no puede ser negativa');
        return;
      }

      let recetaPayload: { id_insumo: number; cantidad_requerida: number; unidad_base: string }[] | undefined;
      if (payload.link === 'single') {
        if (!payload.singleInsumo) {
          message.error('Selecciona un insumo');
          return;
        }
        recetaPayload = [{
          id_insumo: payload.singleInsumo.id_insumo,
          cantidad_requerida: 1,
          unidad_base: payload.singleInsumo.unidad_medida_compra || 'u',
        }];
      } else if (payload.link === 'complex') {
        if (!payload.recipeLines || payload.recipeLines.length === 0) {
          message.error('Agrega al menos un insumo a la receta');
          return;
        }
        recetaPayload = payload.recipeLines.map((linea) => ({
          id_insumo: linea.id_insumo,
          cantidad_requerida: linea.cantidad_insumo,
          unidad_base: linea.unidad_medida,
        }));
      }

      let imageUrlToPersist: string | undefined;
      try {
  const resolvedImageUrl = await ensureRemoteImage(payload.producto.imagen_url, { nameHint: payload.producto.nombre });
        const rawImageUrl = payload.producto.imagen_url;
        if (resolvedImageUrl) {
          imageUrlToPersist = resolvedImageUrl;
        } else if (rawImageUrl && !rawImageUrl.startsWith('data:')) {
          imageUrlToPersist = rawImageUrl;
        }
      } catch (uploadError) {
        console.error('Error preparando la imagen del producto:', uploadError);
        const uploadMessage = uploadError instanceof Error ? uploadError.message : 'No se pudo subir la imagen del producto';
        message.error(`No se pudo subir la imagen del producto: ${uploadMessage}`);
        return;
      }

      const finalImageUrl = imageUrlToPersist || `/productos/${slugify(payload.producto.nombre)}.png`;

      if (payload.mode === 'create') {
        const newProducto = {
          nombre_producto: payload.producto.nombre,
          descripcion: payload.producto.descripcion,
          precio_venta: payload.producto.precio_venta,
          costo_producto: payload.producto.costo_total_producto || 0,
          id_categoria: payload.producto.id_categoria,
          estado: (payload.producto.activo ? 'activo' : 'desactivado') as 'activo' | 'desactivado',
          imagen_url: finalImageUrl,
        };

        await productosService.createProducto(newProducto, variantesNormalizadas, recetaPayload);
        message.success('Producto creado correctamente');
      } else {
        if (!payload.producto.id) {
          message.error('No se encontró el identificador del producto');
          return;
        }

        const updateData = {
          nombre_producto: payload.producto.nombre,
          descripcion: payload.producto.descripcion,
          precio_venta: payload.producto.precio_venta,
          costo_producto: payload.producto.costo_total_producto || 0,
          id_categoria: payload.producto.id_categoria,
          estado: (payload.producto.activo ? 'activo' : 'desactivado') as 'activo' | 'desactivado',
          imagen_url: finalImageUrl,
        };

        await productosService.updateProducto(Number(payload.producto.id), updateData, variantesNormalizadas, recetaPayload);
        message.success('Producto actualizado correctamente');
      }

      await loadData();
      setModalProducto(null);
    } catch (error) {
      console.error('Error guardando producto:', error);
      const axiosMessage = axios.isAxiosError(error)
        ? error.response?.data?.message || error.message
        : error instanceof Error
          ? error.message
          : 'Error guardando producto. Por favor intente de nuevo.';
      message.error(`Error guardando producto: ${axiosMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const onDelete = (id: string) => {
    if (!ensureCanManageProductos()) {
      return;
    }
    const product = rows.find(r => r.id === id);
    if (product) {
      setDeleteConfirm({ show: true, productId: id, productName: product.nombre });
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    if (!ensureCanManageProductos()) {
      setDeleteConfirm(null);
      return;
    }
    try {
      setLoading(true);
      await productosService.deleteProducto(parseInt(deleteConfirm.productId));
      
      // Actualizar estado local
      setRows((prev) => prev.filter((r) => r.id !== deleteConfirm.productId));
      setRecetas((prev) => {
        const n = { ...prev };
        delete n[deleteConfirm.productId];
        return n;
      });
      setDeleteConfirm(null);
      
      message.success('Producto eliminado correctamente');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Error eliminando producto:', err);
      message.error(`Error eliminando producto: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRecetaSaved = (productId: string, nuevoCosto: number) => {
    setRows((prevRows) =>
      prevRows.map((p) => (p.id === productId ? { ...p, costo_total_producto: nuevoCosto } : p))
    );
  };

  const handleView = useCallback(
    async (producto: Producto) => {
      const receta = await ensureRecetaLoaded(producto.id);
      setShowView({ producto, receta });
    },
    [ensureRecetaLoaded]
  );
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="w-full max-w-[1200px] mx-auto">
        {/* Header */}
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Productos</h2>
            <p className="text-sm text-gray-500">Catálogo de venta con filtros por categoría y estado</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate(-1)}
              className="h-11 rounded-xl px-4 text-base font-semibold text-gray-700 hover:bg-gray-100 flex items-center gap-2 border border-gray-300"
            >
              <PiArrowLeftBold />
              Regresar
            </button>
            {/* Verde oscuro SOLO este botón */}
            {canManageProductos && (
              <button
                onClick={() => {
                  if (!ensureCanManageProductos()) return;
                  setOpenRecetario({ open: true });
                }}
                className="h-11 rounded-xl px-4 text-base font-semibold text-white flex items-center gap-2 bg-[#12443D] hover:bg-[#0f3833]"
              >
                📖 Ver Recetario
              </button>
            )}
            {canManageProductos && (
              <button
                onClick={() => navigate('/productos/categorias')}
                className="h-11 rounded-xl px-4 text-base font-semibold text-white flex items-center gap-2 bg-green-800 hover:bg-green-900"
              >
                <PiMoneyBold />
                Categorias Productos
              </button>
            )}
            {canManageProductos && (
              <button
                onClick={openCreate}
                className="h-11 rounded-xl bg-emerald-600 px-4 text-base font-semibold text-white hover:bg-emerald-700 flex items-center gap-2"
              >
                <PiPlusBold />
                Agregar Producto
              </button>
            )}
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-2xl shadow p-5 mb-5">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-base text-gray-700 font-medium">Categoría:</span>
              <select
                value={cat}
                onChange={(e) => setCat(e.target.value)}
                className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-base text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                {categoriasFiltro.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-base text-gray-700 font-medium">Estado:</span>
              <div className="flex gap-2">
                {(["todos", "activo", "desactivado"] as const).map((e) => (
                  <button
                    key={e}
                    onClick={() => setEstado(e)}
                    className={
                      "h-9 rounded-lg px-3 text-sm font-semibold border transition " +
                      (estado === e
                        ? "bg-emerald-600 text-white border-emerald-600 shadow"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100")
                    }
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1" />

            <div className="relative">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar producto…"
                className="h-11 w-72 rounded-lg border border-gray-200 bg-white pl-3 pr-3 text-base text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>

            <button
              onClick={() => {
                setQ("");
                setCat("Todas");
                setEstado("todos");
              }}
              className="h-11 rounded-lg border px-4 text-base font-semibold hover:bg-gray-50"
            >
              Limpiar filtros
            </button>
          </div>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-base">
              <thead className="text-left text-gray-700 bg-gray-50">
                <tr className="border-b">
                  <th className="px-5 py-3.5 font-semibold">Producto</th>
                  <th className="px-5 py-3.5 font-semibold">Descripción</th>
                  <th className="px-5 py-3.5 font-semibold">Categoría</th>
                  <th className="px-5 py-3.5 font-semibold text-right">Precio</th>
                  <th className="px-5 py-3.5 font-semibold">Estado</th>
                  <th className="px-5 py-3.5 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="text-gray-900 leading-7">
                {loading && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-500">
                      <div className="flex items-center justify-center gap-3">
                        <PiSpinnerBold className="w-5 h-5 animate-spin" />
                        Cargando productos...
                      </div>
                    </td>
                  </tr>
                )}
                {!loading &&
                  paginated.map((r) => {
                    const fallback = `/productos/${slugify(r.nombre)}.png`;
                    return (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <img
                              src={r.imagen_url || fallback}
                              alt={r.nombre}
                              className="w-10 h-10 rounded-lg object-cover bg-emerald-100"
                              onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                                (e.currentTarget as HTMLImageElement).src = "/img/icon.png";
                              }}
                            />
                            <div className="font-semibold leading-6 line-clamp-2">{r.nombre}</div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-gray-700 line-clamp-2">{r.descripcion || "—"}</span>
                        </td>
                        <td className="px-5 py-3.5 text-gray-800">{r.categoria}</td>
                        <td className="px-5 py-3.5 text-right font-bold whitespace-nowrap">
                          {currency(r.precio_venta)}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${
                              r.activo
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-gray-200 text-gray-700"
                            }`}
                          >
                            {r.activo ? "activo" : "desactivado"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5 justify-end">
                            <IconBtn title="Ver" onClick={() => void handleView(r)}>
                              <PiEyeBold className="h-5 w-5" />
                            </IconBtn>
                              {canManageProductos && (
                                <IconBtn title="Editar" onClick={() => void openEdit(r)}>
                                  <PiPencilSimpleBold className="h-5 w-5" />
                                </IconBtn>
                              )}
                              {canManageProductos && (
                                <IconBtn title="Eliminar" onClick={() => onDelete(r.id)}>
                                  <PiTrashBold className="h-5 w-5 text-rose-600" />
                                </IconBtn>
                              )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                {!loading && filteredData.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                      Sin resultados con los filtros actuales
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer tabla con paginación */}
          <div className="px-4 py-3 text-sm text-gray-600 flex flex-wrap items-center gap-3 justify-between border-t">
            <div>
              Mostrando <span className="font-semibold">{((page - 1) * perPage) + 1} - {Math.min(page * perPage, total)}</span> de <span className="font-semibold">{total}</span> productos
            </div>
            <div className="flex items-center gap-2">
              <label className="text-gray-500 text-xs" htmlFor="perPage">Por página</label>
              <select
                id="perPage"
                value={perPage}
                onChange={(e) => {
                  setPerPage(Number(e.target.value));
                  setPage(1); // Reset to first page when changing items per page
                }}
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

        {/* Modal VER */}
        <AnimatePresence>
          {showView && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center"
            >
              <div
                className="absolute inset-0 bg-black/40"
                onClick={() => setShowView(null)}
              />
              <motion.div
                initial={{ scale: 0.98, y: 8, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.98, y: 8, opacity: 0 }}
                className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-gray-100 p-6"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-gray-800">
                    {showView.producto.nombre}
                  </h3>
                  <button
                    className="p-2 rounded-lg hover:bg-gray-100"
                    onClick={() => setShowView(null)}
                  >
                    ✕
                  </button>
                </div>

                <img
                  src={
                    showView.producto.imagen_url ||
                    `/productos/${slugify(showView.producto.nombre)}.png`
                  }
                  alt={showView.producto.nombre}
                  className="w-full h-48 object-cover rounded-lg mb-4 bg-emerald-50"
                  onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                    (e.currentTarget as HTMLImageElement).src = "/img/icon.png";
                  }}
                />

                <div className="space-y-3 text-base">
                  <Row label="Categoría" value={showView.producto.categoria} />
                  <Row label="Precio de venta" value={currency(showView.producto.precio_venta)} />
                  <Row
                    label="Costo"
                    value={
                      showView.producto.costo_total_producto != null
                        ? currency(showView.producto.costo_total_producto)
                        : "—"
                    }
                  />
                  <div>
                    <div className="text-sm font-semibold text-gray-600 mb-1">
                      Descripción
                    </div>
                    <p className="text-gray-800">{showView.producto.descripcion || "—"}</p>
                  </div>
                  <div className="mt-3 rounded-lg border p-3 bg-gray-50">
                    <div className="text-sm font-semibold text-gray-600 mb-1">
                      Receta asociada
                    </div>
                    {showView.receta?.length ? (
                      <ul className="list-disc pl-5 text-gray-700">
                        {showView.receta.map((it, i) => (
                          <li key={`${it.id_insumo}-${i}`}>
                            {it.insumo?.nombre || "Insumo desconocido"} — {it.cantidad_insumo} {it.unidad_medida}
                            {/* el campo 'obligatorio' ya no se muestra */}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-700">
                        (Sin líneas de receta registradas)
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    className="h-10 rounded-lg border px-4 text-base font-semibold hover:bg-gray-50"
                    onClick={() => setShowView(null)}
                  >
                    Cerrar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal CREAR/EDITAR PRODUCTO (con receta inline) */}
        <ProductoModal
          modal={modalProducto}
          categorias={categorias}
          onClose={() => setModalProducto(null)}
          onSave={onSaveProducto}
          insumos={insumos}
        />

        {/* Modal de confirmación de eliminación */}
        <AnimatePresence>
          {deleteConfirm?.show && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center"
            >
              <div
                className="absolute inset-0 bg-black/40"
                onClick={() => setDeleteConfirm(null)}
              />
              <motion.div
                initial={{ scale: 0.98, y: 8, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.98, y: 8, opacity: 0 }}
                className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-gray-100 p-6"
              >
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                    <PiTrashBold className="w-6 h-6 text-red-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">Eliminar Producto</h3>
                  <p className="text-gray-600 mb-6">
                    ¿Estás seguro de que quieres eliminar <strong>"{deleteConfirm.productName}"</strong>?
                    Esta acción no se puede deshacer.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="flex-1 h-10 rounded-lg border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={confirmDelete}
                      className="flex-1 h-10 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal de Producto */}
        <ProductoModal
          modal={modalProducto}
          categorias={categorias}
          onClose={() => setModalProducto(null)}
          onSave={onSaveProducto}
          insumos={insumos}
        />

        {/* Gestor de Recetas adicional (opcional) */}
        <RecetarioModal
          open={openRecetario.open}
          onClose={() => setOpenRecetario({ open: false })}
          productos={rows}
          recetas={recetas}
          setRecetas={setRecetas}
          initialProductId={openRecetario.initialProductId}
          onRecetaSaved={handleRecetaSaved}
          insumos={insumos}
        />
      </div>
    </div>
  );
}

/* ============================================================
 * ===== Subcomponentes =====
 * ============================================================ */
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-600">{label}</span>
      <span className="font-semibold text-gray-900">{value}</span>
    </div>
  );
}

/* ---------- Modal de Crear/Editar Producto (receta inline) ---------- */
function ProductoModal({
  modal,
  categorias,
  onClose,
  onSave,
  insumos,
}: {
  modal: { mode: "create" | "edit"; data: FormProducto; recetaCargada?: RecetaLinea[] } | null;
  categorias: CategoriaProducto[];
  onClose: () => void;
  onSave: (p: {
    mode: "create" | "edit";
    producto: FormProducto;
    link: "none" | "single" | "complex";
    singleInsumo?: Insumo;
    recipeLines?: RecetaLinea[];
  }) => void;
  insumos: Insumo[];
}) {
  const [form, setForm] = useState<FormProducto | null>(modal?.data ?? null);

  // 👉 solo dos opciones (sin “none”)
  const [link, setLink] = useState<"single" | "complex">("single");

  // single
  const [singleInsumo, setSingleInsumo] = useState<Insumo | null>(null);
  const [insumoQuery, setInsumoQuery] = useState("");
  const [insumoResults, setInsumoResults] = useState<Insumo[]>([]);

  const [variants, setVariants] = useState<VarianteForm[]>(modal?.data?.variantes ?? []);

  const insumosOperativos = useMemo(() => (Array.isArray(insumos) ? insumos : []), [insumos]);

  // Lista filtrada para "Bebida en lata" (heurística: nombre contiene 'lata', unidad contiene 'lata' o id_categoria === 5)
  const bebidasEnLata = useMemo(() => {
    return (insumosOperativos || []).filter((i) => {
      const name = (i.nombre || "").toLowerCase();
      const unidad = (i.unidad_medida_compra || "").toLowerCase();
      return (
        name.includes("lata") ||
        unidad.includes("lata") ||
        i.id_categoria === 5
      );
    });
  }, [insumosOperativos]);

  // complex (receta inline)
  const [recipeLines, setRecipeLines] = useState<RecetaLinea[]>([]);

  const addVariant = () => {
    setVariants((prev) => [
      ...prev,
      {
        nombre_variante: "",
        precio_variante: 0,
        costo_variante: 0,
        cantidad_insumo: 0,
        estado: 'activo',
        id_insumo: undefined,
      },
    ]);
  };

  const updateVariant = <K extends keyof VarianteForm>(index: number, field: K, value: VarianteForm[K]) => {
    setVariants((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const removeVariant = (index: number) => {
    setVariants((prev) => prev.filter((_, idx) => idx !== index));
  };

  // imagen
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const searchInsumos = useCallback(async (query: string) => {
    if (!query) {
      setInsumoResults([]);
      return;
    }
    const s = query.toLowerCase();

    // Filtrar insumos por nombre
    const filtered = insumos
      .filter((i) => i.nombre.toLowerCase().includes(s))
      .slice(0, 6);

    // Obtener stock actual para cada insumo
    const insumosWithStock = await Promise.all(
      filtered.map(async (insumo) => {
        try {
          const stockResponse = await fetch(`${import.meta.env.VITE_API_URL}/inventario/stock?idInsumo=${insumo.id_insumo}`, {
            headers: { 'Authorization': `Bearer ${localStore.get('access_token')}` }
          });
          const stockData = await stockResponse.json();
          return {
            ...insumo,
            stock_actual: stockData.data || 0
          };
        } catch (error) {
          console.warn(`Error obteniendo stock para insumo ${insumo.id_insumo}:`, error);
          return {
            ...insumo,
            stock_actual: 0
          };
        }
      })
    );

    setInsumoResults(insumosWithStock);
  }, [insumos]);

  // inicializa cuando recibe el modal
  useEffect(() => {
    if (!modal) return;

    setForm(modal.data);
    setInsumoQuery("");
    setVariants(modal.data?.variantes ?? []);

    // Default reset
    setSingleInsumo(null);
    setRecipeLines([]);

    // Si estamos en modo edición, usar la receta precargada
    if (modal.mode === "edit" && modal.recetaCargada && modal.recetaCargada.length > 0) {
      const existing = modal.recetaCargada;
      console.log('🔍 Receta cargada:', existing);
      
      // Detectar si es "single" (1 insumo con cantidad 1) o "complex"
      if (existing.length === 1 && existing[0].cantidad_insumo === 1) {
        // Es "single": cargar el insumo en singleInsumo
        console.log('✅ Detectado como SINGLE');
        setLink("single");
        const insumoEncontrado = insumos.find((i) => i.id_insumo === existing[0].id_insumo);
        if (insumoEncontrado) {
          console.log('✅ Insumo encontrado:', insumoEncontrado);
          setSingleInsumo(insumoEncontrado);
        } else {
          console.warn('⚠️ Insumo NO encontrado, id_insumo:', existing[0].id_insumo);
        }
        setRecipeLines([]);
      } else {
        // Es "complex": cargar todas las líneas
        console.log('✅ Detectado como COMPLEX');
        setLink("complex");
        setSingleInsumo(null);
        const mapped = existing.map((l) => ({
          ...l,
          insumo:
            l.insumo ||
            (insumos.find((i) => i.id_insumo === l.id_insumo)
              ? {
                  nombre: insumos.find((i) => i.id_insumo === l.id_insumo)!.nombre,
                  costo_promedio: insumos.find((i) => i.id_insumo === l.id_insumo)!.costo_promedio,
                }
              : { nombre: "", costo_promedio: 0 }),
        } as RecetaLinea));
        console.log('✅ Líneas de receta mapeadas:', mapped);
        setRecipeLines(mapped);
      }
    } else {
      console.log('ℹ️ No hay receta o modo crear');
      // No hay receta o modo crear: dejar en single por defecto
      setLink("single");
      setSingleInsumo(null);
      setRecipeLines([]);
    }
  }, [modal, insumos]);

  useEffect(() => {
    if (!modal || modal.mode !== "edit" || !modal.data.id) {
      return;
    }

    let active = true;
    (async () => {
      try {
        const data = await productosService.getVariantesByProducto(Number(modal.data.id));
        if (!active) return;
        setVariants(
          data.map((variant) => ({
            id_variante: variant.id_variante,
            nombre_variante: variant.nombre_variante,
            precio_variante: variant.precio_variante ?? undefined,
            costo_variante: variant.costo_variante ?? undefined,
            estado: variant.estado ?? 'activo',
            id_insumo: variant.id_insumo ?? undefined,
            cantidad_insumo: variant.cantidad_insumo ?? undefined,
          }))
        );
      } catch (error) {
        console.error(`Error obteniendo variantes para el producto ${modal.data.id}:`, error);
      }
    })();

    return () => {
      active = false;
    };
  }, [modal]);

  // recalcula costo mostrado según vínculo
  const costoCalculado = useMemo(() => {
    if (!form) return 0;
    if (link === "single" && singleInsumo) {
      return singleInsumo.costo_promedio;
    }
    if (link === "complex" && recipeLines.length > 0) {
      return recipeLines.reduce((acc, l: RecetaLinea) => {
        const costo = l.insumo?.costo_promedio ??
          (Array.isArray(insumos) ? insumos.find((i) => i.id_insumo === l.id_insumo)?.costo_promedio : 0) ?? 0;
        return acc + (l.cantidad_insumo || 0) * costo;
      }, 0);
    }
    return form.costo_total_producto ?? 0;
  }, [form, link, singleInsumo, recipeLines, insumos]);

  // margen calculado
  const precioBase = form?.precio_venta ?? 0;
  const margen = useMemo(() => {
    const ganancia = precioBase - costoCalculado;
    const porcentaje = precioBase > 0 ? (ganancia / precioBase) * 100 : 0;
    return {
      ganancia: currency(ganancia),
      porcentaje: `${porcentaje.toFixed(1)}%`,
    };
  }, [precioBase, costoCalculado]);

  const handleUpload = async (file: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const imageUrl = await uploadProductoImage(file, { nameHint: form?.nombre });
      setForm((prev) => {
        if (!prev) return prev;
        return { ...prev, imagen_url: imageUrl };
      });
      message.success('Imagen del producto actualizada');
    } catch (error) {
      console.error('Error subiendo imagen del producto:', error);
      const errorMessage = error instanceof Error ? error.message : 'No se pudo subir la imagen';
      message.error(`No se pudo subir la imagen: ${errorMessage}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (!modal || !form) return null;
  const title = modal.mode === "create" ? "Crear Nuevo Producto" : "Editar Producto";

  const save = () => {
    if (!form.nombre.trim()) return message.error("El nombre es obligatorio");
    if (!form.id_categoria) return message.error("Selecciona una categoría");
    if (!(form.precio_venta >= 0)) return message.error("Precio inválido");

    // asegurar descripción por defecto si no está provista
    const productoToSave: FormProducto = {
      ...(form as FormProducto),
      descripcion: form.descripcion && form.descripcion.trim() ? form.descripcion : `Descripción genérica de ${form.nombre}`,
      costo_total_producto: +costoCalculado.toFixed(2),
    };

    if (variants.some((variant) => !variant.nombre_variante.trim())) {
      return message.error("Completa el nombre de todas las variantes");
    }

    const variantesNormalizadas = variants
      .filter((variant) => variant.nombre_variante && variant.nombre_variante.trim())
      .map((variant) => ({
        id_variante: variant.id_variante,
        nombre_variante: variant.nombre_variante.trim(),
        precio_variante: variant.precio_variante != null ? Number(variant.precio_variante) : undefined,
        costo_variante: variant.costo_variante != null ? Number(variant.costo_variante) : undefined,
        cantidad_insumo: variant.cantidad_insumo != null ? Number(variant.cantidad_insumo) : undefined,
        estado: variant.estado ?? 'activo',
        id_insumo: variant.id_insumo,
      }));

    if (variantesNormalizadas.some((variant) => (variant.cantidad_insumo ?? 0) < 0)) {
      return message.error("La cantidad del insumo de una variante no puede ser negativa");
    }

    if (variantesNormalizadas.length > 0) {
      productoToSave.variantes = variantesNormalizadas;
    }

    // como ahora solo hay dos opciones, el link que mandamos es el actual
    const payload: {
      mode: "create" | "edit";
      producto: FormProducto;
      link: "single" | "complex";
      singleInsumo?: Insumo;
      recipeLines?: RecetaLinea[];
      variantes?: VarianteForm[];
    } = {
      mode: modal.mode,
      producto: productoToSave,
      link,
      variantes: variantesNormalizadas.length > 0 ? variantesNormalizadas : undefined,
    };

    if (link === "single") {
      if (!singleInsumo) return message.error("Selecciona un insumo");
      payload.singleInsumo = singleInsumo;
    } else {
      if (!recipeLines.length) return message.error("Agrega al menos un insumo a la receta");
      payload.recipeLines = recipeLines;
    }

    // la firma original acepta también "none", pero esto es compatible
    onSave(payload as unknown as {
      mode: "create" | "edit";
      producto: FormProducto;
      link: "none" | "single" | "complex";
      singleInsumo?: Insumo;
      recipeLines?: RecetaLinea[];
      variantes?: VarianteForm[];
    });
  };

  return (
    <AnimatePresence>
      {modal && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <motion.div
            initial={{ scale: 0.98, y: 8, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.98, y: 8, opacity: 0 }}
            className="relative w-full max-w-6xl bg-white rounded-2xl shadow-2xl border border-gray-100 p-6"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-xs text-gray-400">
                  Productos / {modal.mode === "create" ? "Crear" : "Editar"}
                </div>
                <h3 className="text-lg font-bold text-gray-800">{title}</h3>
              </div>
              <button className="p-2 rounded-lg hover:bg-gray-100" onClick={onClose}>✕</button>
            </div>

            {/* Body */}
            <div className="max-h-[70vh] overflow-y-auto p-1 pr-3">
              <div className="grid gap-4">

                {/* Información Básica */}
                <section className="bg-white rounded-xl border border-gray-200/70 shadow-sm p-4">
                  <div className="text-sm font-bold text-gray-800 mb-3">Información Básica</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre *</label>
                      <input
                        value={form.nombre}
                        onChange={(e) => setForm((f) => ({ ...(f as FormProducto), nombre: e.target.value }))}
                        className="w-full h-11 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Categoría *</label>
                      <select
                        value={form.id_categoria}
                        onChange={(e) => {
                          const newCategoriaId = Number(e.target.value);
                          setForm((f) => ({ ...(f as FormProducto), id_categoria: newCategoriaId }));
                          // Si la nueva categoría es "Bebida", forzar "Insumo sin receta"
                          const categoriaNombre = categorias.find((c) => c.id_categoria === newCategoriaId)?.nombre;
                          if (categoriaNombre === "Bebida" && link === "complex") {
                            setLink("single");
                            message.info("Las bebidas solo pueden ser Insumo sin receta. Se cambió automáticamente.");
                          }
                        }}
                        className="w-full h-11 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                      >
                        {categorias.map((c) => (
                          <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Precio de Venta (Q) *
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={form.precio_venta}
                        onChange={(e) => setForm((f) => ({ ...(f as FormProducto), precio_venta: Number(e.target.value || 0) }))}
                        className="w-full h-11 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Estado</label>
                      <select
                        value={form.activo === false ? 'desactivado' : 'activo'}
                        onChange={(e) => setForm((f) => ({ ...(f as FormProducto), activo: e.target.value === 'activo' }))}
                        className="w-full h-11 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                      >
                        <option value="activo">Activo</option>
                        <option value="desactivado">Desactivado</option>
                      </select>
                    </div>

                    {/* Vínculo con inventario (Receta) */}
                    <div className="sm:col-span-2">
                      <div className="text-sm font-bold text-gray-800 mb-3">Vínculo con Inventario (Receta)</div>

                      {/* SOLO 2 opciones */}
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm p-2 rounded-lg hover:bg-gray-50">
                          <input type="radio" name="link" value="single" checked={link === "single"} onChange={() => setLink("single")} />
                          Insumo sin receta (Ej: soda)
                        </label>
                        <label className={`flex items-center gap-2 text-sm p-2 rounded-lg ${
                          categorias.find((c) => c.id_categoria === form.id_categoria)?.nombre === "Bebida"
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-gray-50"
                        }`}>
                          <input
                            type="radio"
                            name="link"
                            value="complex"
                            checked={link === "complex"}
                            onChange={() => {
                              const categoriaNombre = categorias.find((c) => c.id_categoria === form.id_categoria)?.nombre;
                              if (categoriaNombre === "Bebida") {
                                message.warning("Las bebidas solo pueden ser Insumo sin receta");
                                return;
                              }
                              setLink("complex");
                            }}
                            disabled={categorias.find((c) => c.id_categoria === form.id_categoria)?.nombre === "Bebida"}
                          />
                          Insumo con receta (Ej: Shuco de Asada)
                        </label>
                      </div>

                      {/* SINGLE: buscador de insumo */}
                      {link === "single" && (
                        <div className="mt-3 relative">
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Selecciona el Insumo *</label>
                          {singleInsumo ? (
                            <div className="flex items-center justify-between p-2 bg-emerald-50 rounded-lg border border-emerald-200">
                              <span className="text-sm font-medium text-emerald-700">{singleInsumo.nombre}</span>
                              <button type="button" onClick={() => setSingleInsumo(null)} className="text-xs font-bold">✕</button>
                            </div>
                          ) : (
                            <div>
                              {/* Mostrar listado específico de "Bebida en lata" si hay coincidencias, sino fallback al buscador */}
                              {bebidasEnLata.length > 0 ? (
                                <div>
                                  <label className="sr-only">Seleccionar bebida en lata</label>
                                  <select
                                    className="w-full h-11 rounded-lg border border-gray-200 px-3 text-sm bg-white"
                                    onChange={(e) => {
                                      const id = Number(e.target.value);
                                      const ins = bebidasEnLata.find(x => x.id_insumo === id) || null;
                                      setSingleInsumo(ins);
                                    }}
                                    defaultValue=""
                                  >
                                    <option value="" disabled>Selecciona una bebida en lata…</option>
                                    {bebidasEnLata.map((ins) => (
                                      <option key={ins.id_insumo} value={ins.id_insumo}>
                                        {ins.nombre} — {currency(ins.costo_promedio)}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              ) : (
                                <div>
                                  <input
                                    type="text"
                                    value={insumoQuery}
                                    onChange={(e) => { setInsumoQuery(e.target.value); searchInsumos(e.target.value); }}
                                    placeholder="Buscar insumo (ej: Coca Cola)"
                                    className="w-full h-11 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                                  />
                                  {insumoResults.length > 0 && (
                                    <ul className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                                      {insumoResults.map((ins) => (
                                        <li
                                          key={ins.id_insumo}
                                          onClick={() => {
                                            setSingleInsumo(ins);
                                            setInsumoQuery("");
                                            setInsumoResults([]);
                                          }}
                                          className="p-3 text-sm hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                                        >
                                          <div className="font-medium text-gray-800">{ins.nombre}</div>
                                          <div className="text-xs text-gray-600 mt-1">
                                            Cantidad actual: {ins.stock_actual || 0} | Precio unitario: {currency(ins.costo_promedio)} | Unidad base: {ins.unidad_medida_compra || 'N/A'}
                                          </div>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                          <p className="text-[11px] text-gray-500 mt-1">
                            Costo calculado: {currency(singleInsumo?.costo_promedio || 0)}
                          </p>
                        </div>
                      )}

                      {/* COMPLEX: editor de receta inline */}
                      {link === "complex" && (
                        <div className="mt-4 space-y-2">
                          <InlineRecipeEditor
                            lines={recipeLines}
                            setLines={setRecipeLines}
                            insumos={insumos}
                          />
                          <div className="text-sm text-emerald-600 font-semibold">
                            Costo de Receta (Calculado): {currency(costoCalculado)}
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Costo (Calculado)</label>
                      <input
                        type="text" readOnly
                        value={currency(costoCalculado)}
                        className="w-full h-11 rounded-lg border border-gray-200 px-3 text-sm bg-gray-50 text-gray-700 font-medium focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Margen (Calc.)</label>
                      <input
                        type="text" readOnly
                        value={`${margen.ganancia} (${margen.porcentaje})`}
                        className="w-full h-11 rounded-lg border border-gray-200 px-3 text-sm bg-gray-50 text-emerald-600 font-medium focus:outline-none"
                      />
                    </div>
                  </div>
                </section>

                {/* Variantes del Producto */}
                <section className="bg-white rounded-xl border border-gray-200/70 shadow-sm p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-sm font-bold text-gray-800">Variantes del Producto</div>
                      <p className="text-xs text-gray-500">Configura presentaciones adicionales con insumos y precios específicos.</p>
                    </div>
                    <button
                      type="button"
                      onClick={addVariant}
                      className="h-9 rounded-lg border px-3 text-sm font-semibold hover:bg-gray-50 flex items-center gap-1"
                    >
                      <PiPlusBold /> Añadir Variante
                    </button>
                  </div>

                  {variants.length === 0 ? (
                    <p className="text-sm text-gray-500">No hay variantes registradas para este producto.</p>
                  ) : (
                    <div className="space-y-2">
                      {variants.map((variant, index) => (
                        <div
                          key={variant.id_variante ? `${variant.id_variante}-${index}` : `n-${index}`}
                          className="flex gap-2 items-center p-2 rounded-lg border"
                        >
                          <input
                            value={variant.nombre_variante}
                            onChange={(e) => updateVariant(index, 'nombre_variante', e.target.value)}
                            className="flex-1 h-9 rounded-md border border-gray-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                            placeholder="Nombre de la variante"
                          />
                          <select
                            value={variant.id_insumo ?? ""}
                            onChange={(e) => {
                              const value = e.target.value ? Number(e.target.value) : undefined;
                              updateVariant(index, 'id_insumo', value as VarianteForm['id_insumo']);
                            }}
                            className="flex-1 h-9 rounded-md border px-2 text-sm"
                          >
                            <option value="">Selecciona insumo…</option>
                            {insumosOperativos.map((insumo) => (
                              <option key={insumo.id_insumo} value={insumo.id_insumo}>
                                {insumo.nombre} ({currency(insumo.costo_promedio)})
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            value={variant.cantidad_insumo ?? 0}
                            onChange={(e) => updateVariant(index, 'cantidad_insumo', Number(e.target.value || 0))}
                            className="w-20 h-9 rounded-md border border-gray-200 px-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-emerald-300"
                            placeholder="Cant."
                            title="Cantidad del insumo a descontar"
                          />
                          <select
                            value={variant.estado ?? 'activo'}
                            onChange={(e) => updateVariant(index, 'estado', e.target.value as 'activo' | 'desactivado')}
                            className="w-24 h-9 rounded-md border border-gray-200 px-2 text-sm"
                          >
                            <option value="activo">Activo</option>
                            <option value="desactivado">Desactivado</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => removeVariant(index)}
                            className="p-1.5 rounded text-red-600 hover:bg-red-50"
                            title="Eliminar"
                          >
                            <PiTrashBold className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Información Adicional */}
                <section className="bg-white rounded-xl border border-gray-200/70 shadow-sm p-4">
                  <div className="text-sm font-bold text-gray-800 mb-3">Información Adicional</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {/* Descripción */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Descripción</label>
                      <textarea
                        value={form.descripcion ?? ""}
                        onChange={(e) => setForm((f) => ({ ...(f as FormProducto), descripcion: e.target.value || undefined }))}
                        className="w-full min-h-[90px] rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                      />
                    </div>

                    {/* Imagen */}
                    <ProductoImagen form={form} setForm={setForm} uploading={uploading} fileInputRef={fileInputRef} onUpload={handleUpload} />
                  </div>
                </section>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-4 pt-4 border-t flex justify-end gap-2">
              <button type="button" className="h-10 rounded-lg border px-4 text-base font-semibold hover:bg-gray-50" onClick={onClose}>
                Cancelar
              </button>
              <button
                type="button"
                className="h-10 rounded-lg bg-emerald-600 px-4 text-base font-semibold text-white hover:bg-emerald-700 flex items-center gap-1.5"
                onClick={save}
              >
                <PiFloppyDiskBold />
                {modal.mode === "create" ? "Guardar Producto" : "Guardar Cambios"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- Bloque de imagen del producto (reutilizable) ---------- */
function ProductoImagen({
  form,
  setForm,
  uploading,
  fileInputRef,
  onUpload,
}: {
  form: FormProducto;
  setForm: React.Dispatch<React.SetStateAction<FormProducto | null>>;
  uploading: boolean;
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  onUpload: (file: File) => void;
}) {
  return (
    <div className="sm:col-span-2">
      <label className="block text-xs font-semibold text-gray-600 mb-1">Imagen</label>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-16 h-16 rounded-lg border overflow-hidden bg-gray-50">
          {form.imagen_url ? (
            <img
              src={form.imagen_url}
              alt="preview"
              className="w-full h-full object-cover"
              onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                (e.currentTarget as HTMLImageElement).src = "/img/icon.png";
              }}
            />
          ) : (
            <div className="w-full h-full grid place-content-center text-gray-400 text-xs">
              sin imagen
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => fileInputRef.current?.click()} className="h-10 rounded-lg border px-3 text-sm font-semibold hover:bg-gray-50" disabled={uploading}>
            {uploading ? "Subiendo..." : "Subir imagen"}
          </button>
          {form.imagen_url && (
            <button type="button" onClick={() => setForm((f) => ({ ...(f as FormProducto), imagen_url: undefined }))} className="h-10 rounded-lg border px-3 text-sm font-semibold hover:bg-gray-50">
              Quitar
            </button>
          )}
        </div>
        <input
          ref={fileInputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const file = e.target.files?.[0]; if (file) onUpload(file); }}
        />
      </div>
      <input
        value={form.imagen_url ?? ""}
        onChange={(e) => setForm((f) => ({ ...(f as FormProducto), imagen_url: e.target.value || undefined }))}
        placeholder="https://…/imagen.png (opcional)"
        className="w-full h-11 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
      />
    </div>
  );
}

/* ---------- Editor de Receta INLINE ---------- */
function InlineRecipeEditor({
  lines,
  setLines,
  insumos,
}: {
  lines: RecetaLinea[];
  setLines: React.Dispatch<React.SetStateAction<RecetaLinea[]>>;
  insumos: Insumo[];
}) {
  // Filtrar solo insumos operativos (ya vienen filtrados desde la API)
  const insumosOperativos = React.useMemo(() => {
    return insumos;
  }, [insumos]);

  const addLinea = () => {
    console.log('Intentando agregar línea, insumosOperativos:', insumosOperativos);
    if (!insumosOperativos || insumosOperativos.length === 0) {
      console.error('No hay insumos operativos disponibles:', insumosOperativos);
      message.error('No hay insumos disponibles para crear la receta. Verifica que los insumos estén cargados y que haya categorías de insumo configuradas.');
      return;
    }
    // Agregar una línea vacía SIN seleccionar un insumo por defecto.
    // El select mostrará un placeholder "Selecciona tu insumo" y el usuario deberá elegir.
    setLines((prev) => [
      ...prev,
      {
        id_producto: "",
        id_insumo: 0, // 0 indica 'sin seleccionar'
        cantidad_insumo: 1,
        unidad_medida: "",
        // es_obligatorio removed from UI; default = NOT selected (false)
        insumo: { nombre: "", costo_promedio: 0 }
      },
    ]);
  };

  const updateLinea = <K extends keyof RecetaLinea>(index: number, field: K, value: RecetaLinea[K]) => {
    if (field === "id_insumo") {
      // Validar que el insumo no esté duplicado
      const newInsumoId = Number(value);
      const existingLine = lines.find((l, i) => i !== index && l.id_insumo === newInsumoId);
      if (existingLine) {
        message.error('Este insumo ya está en la receta. Por favor selecciona un insumo diferente.');
        return;
      }
    }

    setLines((prev) => {
      const copy = [...prev];
      const linea = { ...copy[index], [field]: value } as RecetaLinea;
      if (field === "id_insumo") {
        const i = insumosOperativos.find((x: Insumo) => x.id_insumo === Number(value));
        if (i) {
          linea.unidad_medida = i.unidad_medida_compra || "u";
          linea.insumo = { nombre: i.nombre, costo_promedio: i.costo_promedio };
        } else {
          // Si se selecciona el placeholder (value 0 / ""), limpiar datos relacionados
          linea.unidad_medida = "";
          linea.insumo = { nombre: "", costo_promedio: 0 };
        }
      }
      copy[index] = linea;
      return copy;
    });
  };

  const removeLinea = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i));

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-gray-800">Receta del Producto</h4>
        <button
          type="button"
          onClick={addLinea}
          disabled={insumosOperativos.length === 0}
          className={`h-9 rounded-lg border px-3 text-sm font-semibold flex items-center gap-1 ${
            insumosOperativos.length === 0
              ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
              : "hover:bg-gray-50"
          }`}
        >
          <PiPlusBold /> Añadir Insumo
        </button>
      </div>

      {lines.length === 0 ? (
        <p className="text-sm text-gray-500">
          {insumos.length === 0
            ? "Cargando insumos..."
            : insumosOperativos.length === 0
            ? "No hay insumos operativos disponibles. Verifica que haya insumos con categorías operativas configuradas."
            : "Aún no has agregado líneas a la receta."
          }
        </p>
      ) : (
        <div className="space-y-2">
          {lines.map((l, index) => (
            <div key={`${l.id_insumo}-${index}`} className="flex gap-2 items-center p-2 rounded-lg border">
              <select
                value={l.id_insumo || ""}
                onChange={(e) => updateLinea(index, "id_insumo", Number(e.target.value || 0))}
                className={`flex-1 h-9 rounded-md border px-2 text-sm ${l.id_insumo === 0 ? 'text-gray-500' : 'text-gray-800'}`}
              >
                <option value="" disabled>Selecciona tu insumo…</option>
                {insumosOperativos.map((ins: Insumo) => (
                  <option key={ins.id_insumo} value={ins.id_insumo}>
                    {ins.nombre} ({currency(ins.costo_promedio)})
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={l.cantidad_insumo}
                onChange={(e) => updateLinea(index, "cantidad_insumo", Number(e.target.value || 0))}
                className="w-20 h-9 rounded-md border border-gray-200 px-2 text-sm text-right"
              />
              <input
                type="text"
                value={l.unidad_medida}
                readOnly
                className="w-16 h-9 rounded-md border border-gray-200 px-2 text-sm bg-gray-50"
              />
              {/* 'Oblig.' checkbox removed per new requirement - lines are NOT obligatory by default */}
              <button
                type="button"
                onClick={() => removeLinea(index)}
                className="p-1.5 rounded text-red-600 hover:bg-red-50"
                title="Eliminar"
              >
                <PiTrashBold className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Gestor de Recetas (opcional, fuera del modal) ---------- */
function RecetarioModal({
  open,
  onClose,
  productos,
  recetas,
  setRecetas,
  initialProductId,
  onRecetaSaved,
  insumos,
}: {
  open: boolean;
  onClose: () => void;
  productos: Producto[];
  recetas: Record<string, RecetaLinea[]>;
  setRecetas: React.Dispatch<React.SetStateAction<Record<string, RecetaLinea[]>>>;
  initialProductId?: string;
  onRecetaSaved: (productId: string, nuevoCosto: number) => void;
  insumos: Insumo[];
}) {
  const productosSinReceta = useMemo(() => {
    return productos.filter(p => !recetas[p.id] || recetas[p.id].length === 0);
  }, [productos, recetas]);

  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [currentReceta, setCurrentReceta] = useState<RecetaLinea[]>([]);
  const allInsumos = useMemo(() => (Array.isArray(insumos) ? insumos : []), [insumos]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCreateRecipe, setShowCreateRecipe] = useState(false);

  const loadReceta = useCallback(async (productId: string) => {
    setLoading(true);
    setSelectedProductId(productId);

    let recetaExistente = recetas[productId];

    if (!recetaExistente || recetaExistente.length === 0) {
      try {
        const data = await productosService.getProductoConReceta(Number(productId));
        const mapped = (data?.receta ?? []).map((detalle) => {
          const insumo = allInsumos.find((i) => i.id_insumo === detalle.id_insumo);
          return {
            id_producto: String(productId),
            id_insumo: detalle.id_insumo,
            cantidad_insumo: detalle.cantidad_requerida,
            unidad_medida: detalle.unidad_base,
            // es_obligatorio removed: default NOT obligatory (false)
            insumo: insumo
              ? { nombre: insumo.nombre, costo_promedio: insumo.costo_promedio }
              : undefined,
          } as RecetaLinea;
        });

        if (mapped.length > 0) {
          setRecetas((prev) => ({ ...prev, [productId]: mapped }));
          recetaExistente = mapped;
        }
      } catch (error) {
        console.error(`Error cargando receta para producto ${productId}:`, error);
        message.error('No se pudo cargar la receta del producto seleccionado.');
      }
    }

    setCurrentReceta(recetaExistente ?? []);
    setLoading(false);
  }, [recetas, setRecetas, allInsumos]);

  useEffect(() => {
    if (open && initialProductId) {
      void loadReceta(initialProductId);
    }
    if (!open) {
      setSelectedProductId(null);
      setCurrentReceta([]);
    }
  }, [open, initialProductId, loadReceta]);

  const selectedProducto = useMemo(
    () => productos.find((p) => p.id === selectedProductId),
    [productos, selectedProductId]
  );
  const esProductoBebida = selectedProducto?.categoria?.toLowerCase() === 'bebida';

  const addLinea = () => {
    const primerInsumo = allInsumos[0];
    if (!primerInsumo) return message.error('No hay insumos cargados');
    if (!selectedProductId) return message.error('Error: No hay producto seleccionado');

    if (esProductoBebida && currentReceta.length >= 1) {
      message.warning('Las bebidas solo pueden tener un insumo en su receta.');
      return;
    }

    setCurrentReceta((prev) => [
      ...prev,
      {
        id_producto: selectedProductId,
        id_insumo: primerInsumo.id_insumo,
        cantidad_insumo: 1,
        unidad_medida: primerInsumo.unidad_medida_compra || 'u',
        // es_obligatorio removed: default NOT obligatory (false)
        insumo: { nombre: primerInsumo.nombre, costo_promedio: primerInsumo.costo_promedio },
      } as RecetaLinea,
    ]);
  };

  const updateLinea = <K extends keyof RecetaLinea>(
    index: number,
    field: K,
    value: RecetaLinea[K]
  ) => {
    const copy = [...currentReceta];
    const linea = { ...copy[index], [field]: value } as RecetaLinea;

    if (field === "id_insumo") {
      const insumo = allInsumos.find(i => i.id_insumo === Number(value));
      if (insumo) {
        linea.unidad_medida = insumo.unidad_medida_compra || "u";
        linea.insumo = { nombre: insumo.nombre, costo_promedio: insumo.costo_promedio };
      }
    }
    copy[index] = linea;
    setCurrentReceta(copy);
  };

  const removeLinea = (index: number) => {
    setCurrentReceta(prev => prev.filter((_, i) => i !== index));
  };

  const costoTotalCalculado = useMemo(() => {
    return currentReceta.reduce((total, linea) => {
      const cantidad = linea.cantidad_insumo || 0;
      const costo = linea.insumo?.costo_promedio ||
        allInsumos.find(i => i.id_insumo === linea.id_insumo)?.costo_promedio || 0;
      return total + (cantidad * costo);
    }, 0);
  }, [currentReceta, allInsumos]);

  const onSaveReceta = async () => {
    if (!selectedProductId) return message.error("No hay un producto seleccionado.");
    setSaving(true);
    await new Promise(res => setTimeout(res, 500));
    setRecetas(prev => ({ ...prev, [selectedProductId]: currentReceta }));
    onRecetaSaved(selectedProductId, costoTotalCalculado);
    setSaving(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <motion.div
            initial={{ scale: 0.98, y: 8, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.98, y: 8, opacity: 0 }}
            className="relative w-full max-w-6xl h-[82vh] bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-4">
                <h3 className="text-lg font-bold text-gray-800">Gestor de Recetas</h3>
                {productosSinReceta.length > 0 && (
                  <button
                    onClick={() => setShowCreateRecipe(true)}
                    className="h-9 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700 flex items-center gap-2"
                  >
                    <PiPlusBold size={16} />
                    Crear Receta
                  </button>
                )}
              </div>
              <button className="p-2 rounded-lg hover:bg-gray-100" onClick={onClose}>
                ✕
              </button>
            </div>

            {/* Contenido */}
            <div className="flex-1 flex overflow-hidden">
              {/* Lista productos */}
              <div className="w-2/5 border-r bg-gray-50 overflow-y-auto">
                <div className="p-3">
                  <h4 className="text-sm font-semibold mb-2">Productos con Receta</h4>
                  {productos.map(p => (
                    <button
                      key={p.id}
                      onClick={() => void loadReceta(p.id)}
                      className={`w-full text-left p-2 rounded-lg text-sm ${
                        selectedProductId === p.id
                          ? "bg-emerald-100 text-emerald-700 font-medium"
                          : "hover:bg-gray-200"
                      }`}
                    >
                      {p.nombre}
                    </button>
                  ))}
                </div>
              </div>

              {/* Form receta */}
              <div className="w-3/5 flex flex-col">
                {selectedProductId ? (
                  <>
                    <div className="p-4 border-b">
                      <h4 className="font-semibold text-gray-800">Editando: {selectedProducto?.nombre}</h4>
                      <p className="text-sm text-gray-500">
                        Precio Venta: {currency(selectedProducto?.precio_venta || 0)}
                      </p>
                      <p className="text-sm text-emerald-600 font-medium">
                        Costo de Receta (Calculado): {currency(costoTotalCalculado)}
                      </p>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                      {loading && <p>Cargando receta...</p>}

                      {currentReceta.map((linea, index) => (
                        <div key={`${linea.id_insumo}-${index}`} className="flex gap-2 items-center p-2 rounded-lg border">
                          <select
                            value={linea.id_insumo}
                            onChange={(e) => updateLinea(index, "id_insumo", Number(e.target.value))}
                            className="flex-1 h-9 rounded-md border border-gray-200 px-2 text-sm"
                          >
                            {insumos.map((ins: Insumo) => (
                              <option key={ins.id_insumo} value={ins.id_insumo}>
                                {ins.nombre} ({currency(ins.costo_promedio)})
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            value={linea.cantidad_insumo}
                            onChange={(e) => updateLinea(index, "cantidad_insumo", Number(e.target.value || 0))}
                            className="w-16 h-9 rounded-md border border-gray-200 px-2 text-sm text-right"
                          />
                          <input
                            type="text"
                            value={linea.unidad_medida}
                            onChange={(e) => updateLinea(index, "unidad_medida", e.target.value)}
                            className="w-16 h-9 rounded-md border border-gray-200 px-2 text-sm"
                          />
                          {/* 'Oblig.' checkbox removed — líneas no son obligatorias por defecto */}
                          <IconBtn title="Eliminar" onClick={() => removeLinea(index)}>
                            <PiTrashBold className="h-4 w-4 text-red-500" />
                          </IconBtn>
                        </div>
                      ))}

                      <button
                        onClick={addLinea}
                        disabled={allInsumos.length === 0 || (esProductoBebida && currentReceta.length >= 1)}
                        className={`h-10 w-full rounded-lg border border-dashed text-sm font-semibold flex items-center justify-center gap-1 transition-colors ${
                          allInsumos.length === 0 || (esProductoBebida && currentReceta.length >= 1)
                            ? 'border-gray-200 text-gray-400 cursor-not-allowed bg-gray-100'
                            : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <PiPlusBold /> Añadir Insumo
                      </button>

                      {esProductoBebida && (
                        <p className="text-xs text-amber-600 text-center">
                          Las bebidas solo admiten un insumo en la receta.
                        </p>
                      )}
                    </div>

                    <div className="mt-4 p-4 border-t flex justify-end gap-2">
                      <button
                        type="button"
                        className="h-10 rounded-lg border px-4 text-base font-semibold hover:bg-gray-50"
                        onClick={onClose}
                      >
                        Cerrar
                      </button>
                      <button
                        type="button"
                        className="h-10 rounded-lg bg-emerald-600 px-4 text-base font-semibold text-white hover:bg-emerald-700 flex items-center gap-1.5"
                        onClick={onSaveReceta}
                        disabled={saving}
                      >
                        {saving ? <PiSpinnerBold className="animate-spin" /> : <PiFloppyDiskBold />}
                        {saving ? "Guardando..." : "Guardar Receta"}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 text-gray-500">
                    <p className="font-medium">Selecciona un producto</p>
                    <p className="text-sm">
                      Selecciona un producto de la lista de la izquierda para ver o editar su receta.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Modal para seleccionar producto para nueva receta */}
      {showCreateRecipe && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCreateRecipe(false)} />
          <motion.div
            initial={{ scale: 0.98, y: 8, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.98, y: 8, opacity: 0 }}
            className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">Crear Nueva Receta</h3>
              <button
                className="p-2 rounded-lg hover:bg-gray-100"
                onClick={() => setShowCreateRecipe(false)}
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Selecciona un producto para crear su receta:
            </p>

            <div className="max-h-60 overflow-y-auto">
              {productosSinReceta.map((producto) => (
                <button
                  key={producto.id}
                  onClick={() => {
                    setSelectedProductId(producto.id);
                    setCurrentReceta([]);
                    setShowCreateRecipe(false);
                  }}
                  className="w-full text-left p-3 rounded-lg hover:bg-emerald-50 border border-gray-200 mb-2"
                >
                  <div className="font-medium text-gray-800">{producto.nombre}</div>
                  <div className="text-sm text-gray-500">
                    Precio: {currency(producto.precio_venta)}
                  </div>
                </button>
              ))}
            </div>

            {productosSinReceta.length === 0 && (
              <p className="text-center text-gray-500 py-4">
                No hay productos disponibles sin receta.
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
