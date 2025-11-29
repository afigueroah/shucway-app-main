import React, { useMemo, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { productosService, type Producto, type CategoriaProducto, type ProductoConReceta, type ProductoVariante } from '@/api/productosService';
import { fetchInsumos, getStockActual } from '@/api/inventarioService';
import CategoriaModal from './CategoriaModal';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationContainer } from '@/components/NotificationContainer';
import { useAuth } from '../../../../hooks/useAuth';
import { PermissionLevel } from '../../../../constants/permissions';
import { cajaService } from '../../../../api/cajaService';
import { localStore } from '../../../../utils/storage';
import { Trash2, X, Check, Edit3, Minus, Plus, ShoppingCart, UserX, CreditCard, Gift } from 'lucide-react';

type Insumo = {
  id_insumo: number;
  nombre_insumo: string;
  insumo_url?: string | null;
  imagen?: string | null;
  imagen_url?: string | null;
  stock_actual?: number | null;
  // Puedes agregar más campos si es necesario
};

// Tipo para categorías locales (como "Todos")
interface CategoriaLocal {
  id_categoria: number | string;
  nombre_categoria: string;
  descripcion?: string;
  estado: 'activo' | 'desactivado';
}

// Tipo union para categorías
type CategoriaDisplay = CategoriaProducto | CategoriaLocal;
import { clientesService, type Cliente } from '@/api/clientesService';
import { ventasService, type CreateVentaDTO } from '@/api/ventasService';

/* =========================================================================
   Tipos
   ========================================================================= */
export type Categoria = { id: string; nombre: string };
export type CartItem = {
  producto: Producto;
  qty: number;
  mods?: string; // ej: "sin cebolla, sin guacamole"
  id_variante?: number;
  variant?: ProductoVariante | null;
};

type IngredientOption = {
  key: string;
  nombre: string;
  id_insumo: number;
  variantId: number | null;
  esObligatorio: boolean;
  imagenUrl?: string;
  cantidadRequerida: number;
  stockActual?: number;
};

/* =========================================================================
  Íconos por categoría (usando Lucide React)
  ========================================================================= */
const CATEGORY_ICON: Record<string, React.ReactNode> = {
  shucos: <ShoppingCart className="w-6 h-6" />,
  hamburguesas: <ShoppingCart className="w-6 h-6" />,
  gringas: <ShoppingCart className="w-6 h-6" />,
  papas: <ShoppingCart className="w-6 h-6" />,
  bebidas: <ShoppingCart className="w-6 h-6" />,
};

/* =========================================================================
   Emojis de ingredientes (para las tarjetas del formulario)
   ========================================================================= */
const ING_EMOJI: Record<string, string> = {
  Salsa: '🍅',
  Mayonesa: '🥫',
  Mostaza: '🧴',
  Guacamole: '🥑',
  Repollo: '🥬',
  Cebolla: '🧅',
  Ketchup: '🍅',
  Chile: '🌶️',
  Queso: '🧀',
  Lechuga: '🥬',
  Tomate: '🍅',
  Pepinillos: '🥒',
  Carne: '🥩',
  Pollo: '🍗',
  Adobado: '🥩',
};


/* =========================================================================
   Utilitarios
   ========================================================================= */
const currency = (q: number) => `Q${q.toFixed(2)}`;

/* —— Parseo del string de mods: "sin ..." y "extra ... xN" —— */
function parseMods(mods?: string): { sin: string[]; extras: Record<string, number> } {
  const out = { sin: [] as string[], extras: {} as Record<string, number> };
  if (!mods) return out;

  const parts = mods.split('|').map(s => s.trim());
  for (const p of parts) {
    if (/^sin\s/i.test(p)) {
      const list = p.replace(/^sin\s+/i, '')
        .split(/,\s*sin\s*/i)
        .map(s => s.trim())
        .filter(Boolean);
      out.sin = list;
    } else if (/^extra\s/i.test(p)) {
      const re = /extra\s+([^,|]+?)\s*x(\d+)/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(p)) !== null) {
        const name = m[1].trim();
        const n = parseInt(m[2], 10) || 0;
        out.extras[name] = n;
      }
    }
  }
  return out;
}

const getUnitPrice = (producto: Producto, variant?: ProductoVariante | null) =>
  producto.precio_venta + (variant?.precio_variante ?? 0);

const getCartItemUnitPrice = (item: CartItem) => getUnitPrice(item.producto, item.variant ?? null);

/* =========================================================================
   Pill y Card
   ========================================================================= */
const Pill: React.FC<React.PropsWithChildren<{ active?: boolean; onClick?: () => void }>> = ({
  active,
  onClick,
  children,
}) => (
  <motion.button
    onClick={onClick}
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    className={
      'h-14 px-5 rounded-xl text-base font-semibold transition-all duration-200 uppercase ' +
      (active 
        ? 'bg-emerald-800 text-white shadow-lg' 
        : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md'
      )
    }
  >
    {typeof children === 'string' ? children.toUpperCase() : children}
  </motion.button>
);

const Card: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ className = '', children }) => (
  <div className={`rounded-xl border border-gray-200 bg-white shadow-sm ${className}`}>{children}</div>
);

/* =========================================================================
   Drawer
   ========================================================================= */
const DrawerRight: React.FC<
  React.PropsWithChildren<{ open: boolean; onClose: () => void; widthClass?: string; title?: string }>
> = ({ open, onClose, widthClass = 'w-full sm:w-[420px]', title, children }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div className="absolute inset-0" onClick={onClose} />
      <div
        className={`absolute right-0 top-0 h-full bg-white shadow-2xl ${widthClass} flex flex-col`}
      >
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="font-semibold text-gray-800">{title}</div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
};

/* =========================================================================
   Componente principal
   ========================================================================= */
const Ventas: React.FC<{ onBack?: () => void }> = () => {
  const navigate = useNavigate();
  const { notifications, addNotification, removeNotification } = useNotifications();
  const { roleLevel } = useAuth();
  const canManageCategorias = (roleLevel ?? 0) >= PermissionLevel.ADMINISTRADOR;

  const ensureCanManageCategorias = useCallback(() => {
    if (!canManageCategorias) {
      addNotification({
        type: 'warning',
        title: 'Acceso restringido',
        message: 'No tienes permisos para administrar categorías.',
      });
      return false;
    }
    return true;
  }, [canManageCategorias, addNotification]);

  // Estados para datos del backend
  const [categorias, setCategorias] = useState<CategoriaDisplay[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [brokenProductImages, setBrokenProductImages] = useState<Set<number>>(new Set());
  const [brokenIngredientImages, setBrokenIngredientImages] = useState<Set<string>>(new Set());

  // Filtros
  const [catActiva, setCatActiva] = useState<number | 'all'>('all');
  const [query, setQuery] = useState('');

  // Carrito
  const [carrito, setCarrito] = useState<CartItem[]>([]);
  const [ordenN, setOrdenN] = useState<number>(() => {
    const saved = localStorage.getItem('ordenN');
    return saved ? parseInt(saved, 10) : 1;
  });

  // Cliente seleccionado
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);

  // Guardar ordenN en localStorage
  useEffect(() => {
    localStorage.setItem('ordenN', ordenN.toString());
  }, [ordenN]);

  // Cargar datos del backend al montar el componente
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        setLoading(true);
        setError(null);

        // Cargar categorías, productos y clientes en paralelo
        const [categoriasData, productosData, clientesData] = await Promise.all([
          productosService.getCategorias(),
          productosService.getProductos(true), // Solo productos activos
          clientesService.getClientes(),
        ]);

        // Agregar categoría "Todos" al inicio
        const categoriasConTodos = [
          { id_categoria: 'all', nombre_categoria: 'Todos', descripcion: 'Todas las categorías', estado: 'activo' as const },
          ...categoriasData
        ];
        setCategorias(categoriasConTodos);

        // Filtrar productos: solo aquellos con categoría activa
        const categoriasActivas = categoriasConTodos.filter(c => c.estado === 'activo');
        const productosFiltrados = productosData.filter(p => p.id_categoria && categoriasActivas.some(c => c.id_categoria == p.id_categoria));
        setProductos(productosFiltrados);

        setClientes(clientesData);

        // Cargar estado de caja
        try {
          const estado = await cajaService.getEstado();
          if (estado.abierta && estado.sesion) {
            // Sesión abierta
          }
        } catch (error) {
          console.warn('Error cargando estado de caja:', error);
        }

        // Cargar totales de la sesión actual
        try {
          const estado = await cajaService.getEstado();
          if (estado.abierta && estado.sesion) {
            const totalesSesion = await ventasService.getTotalVentasSesion(estado.sesion.fecha_apertura);
            setTotalCaja(totalesSesion.efectivo);
            setTotalBanco(totalesSesion.transferencia + totalesSesion.tarjeta);
          } else {
            // Si no hay sesión abierta, usar fecha de hoy
            const fechaInicio = new Date().toISOString().split('T')[0];
            const totalesSesion = await ventasService.getTotalVentasSesion(fechaInicio);
            setTotalCaja(totalesSesion.efectivo);
            setTotalBanco(totalesSesion.transferencia + totalesSesion.tarjeta);
          }
        } catch (sessionError) {
          console.warn('No se pudieron cargar los totales de la sesión:', sessionError);
          // Mantener valores por defecto (0) si falla la carga
        }
      } catch (err) {
        console.error('Error cargando datos:', err);
        setError('Error al cargar los datos. Por favor, recarga la página.');
      } finally {
        setLoading(false);
      }
    };

    cargarDatos();
  }, []);

  // Modales/Drawers
  const [categoriaModal, setCategoriaModal] = useState<{
    isOpen: boolean;
    mode: 'create' | 'edit';
    categoria?: CategoriaProducto | null;
  }>({
    isOpen: false,
    mode: 'create',
    categoria: null
  });
  const [openCliente, setOpenCliente] = useState(false);
  // Modal de confirmación para eliminar producto del carrito
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    isOpen: boolean;
    itemToDelete: CartItem | null;
  }>({
    isOpen: false,
    itemToDelete: null
  });
  // Modal de confirmación para canje gratis
  const [confirmCanje, setConfirmCanje] = useState(false);
  const [puntosEnabled, setPuntosEnabled] = useState<boolean>(() => localStore.get('puntosEnabled', false) ?? false);

  // Verificar cambios en puntosEnabled cada 1 segundo
  useEffect(() => {
    const interval = setInterval(() => {
      const current = localStore.get('puntosEnabled', false) ?? false;
      if (current !== puntosEnabled) {
        console.log('🔄 puntosEnabled cambió de', puntosEnabled, 'a', current);
        setPuntosEnabled(current);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [puntosEnabled]);
  // Cantidades de extras en el customizer
  // Drawer de pago
  const [openPago, setOpenPago] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [metodo, setMetodo] = useState<'efectivo' | 'transferencia' | 'canje_gratis' | 'cupon'>('efectivo');
  const [referencia, setReferencia] = useState('');
  const [banco, setBanco] = useState('');

  // Efectivo
  const [dineroRecibido, setDineroRecibido] = useState<string>('');
  const receivedNumber = Number(dineroRecibido || 0);

  //totales de caja y banco (recuento)
  const [totalCaja, setTotalCaja] = useState<number>(0);
  const [totalBanco, setTotalBanco] = useState<number>(0);
  const loadTotalesSesion = useCallback(async () => {
    try {
      const estado = await cajaService.getEstado();
      if (estado.abierta && estado.sesion) {
        const totalesSesion = await ventasService.getTotalVentasSesion(estado.sesion.fecha_apertura);
        setTotalCaja(totalesSesion.efectivo);
        setTotalBanco(totalesSesion.transferencia + totalesSesion.tarjeta);
      } else {
        // Si no hay sesión, usar hoy
        const fechaInicio = new Date().toISOString().split('T')[0];
        const totalesSesion = await ventasService.getTotalVentasSesion(fechaInicio);
        setTotalCaja(totalesSesion.efectivo);
        setTotalBanco(totalesSesion.transferencia + totalesSesion.tarjeta);
      }
    } catch (error) {
      console.warn('Error recargando totales de sesión:', error);
    }
  }, []);

  // Drawer de personalización
  const [openCustom, setOpenCustom] = useState(false);
  const [customProd, setCustomProd] = useState<Producto | null>(null);
  const [customChecks, setCustomChecks] = useState<Record<string, boolean>>({});
  const [customQty, setCustomQty] = useState<number>(1);
  const [customDetalle, setCustomDetalle] = useState<ProductoConReceta | null>(null);
  const [customVariant, setCustomVariant] = useState<ProductoVariante | null>(null);
  const [ingredientOptions, setIngredientOptions] = useState<IngredientOption[]>([]);
  const [customLoading, setCustomLoading] = useState(false);

  // pago errores
  const [pagoError, setPagoError] = useState<string>('');
  const [cashInvalid, setCashInvalid] = useState<boolean>(false);
  const [transfInvalid, setTransfInvalid] = useState(false);

  // Clientes registrados / nuevo
  const [clientModo, setClientModo] = useState<'registrados' | 'nuevo' | 'editar'>('registrados');
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [clienteAEliminar, setClienteAEliminar] = useState<Cliente | null>(null);
  const [nitMode, setNitMode] = useState<'CF' | 'NIT'>('CF');
  const [nitValue, setNitValue] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const filteredClients = useMemo(() => {
    const s = clientSearch.trim().toLowerCase();
    if (!s) return clientes;
    return clientes.filter(
      c =>
        c.nombre.toLowerCase().includes(s) ||
        (c.telefono ?? '').toLowerCase().includes(s)
    );
  }, [clientSearch, clientes]);

  // ——— NUEVO: edición de línea del carrito ———
  const [editTarget, setEditTarget] = useState<{
    productoId: number;
    mods?: string;
    variantId?: number | null;
  } | null>(null);
  const [notasVenta, setNotasVenta] = useState('');

  const buildIngredientKey = (idInsumo: number, variantId: number | null) =>
    `${idInsumo}-${variantId ?? 'base'}`;

  const normalizeText = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  // ---------------------------------------------------------------

  const extractStockValue = (payload: unknown): number | null => {
    if (payload == null) return null;
    if (typeof payload === 'number') {
      return Number.isFinite(payload) ? payload : null;
    }
    if (typeof payload === 'string') {
      const numeric = Number(payload);
      return Number.isFinite(numeric) ? numeric : null;
    }
    if (typeof payload === 'object') {
      const source = payload as Record<string, unknown>;
      const candidateKeys = ['data', 'stock', 'stock_actual', 'cantidad', 'cantidad_actual', 'total', 'total_stock'];
      for (const key of candidateKeys) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          const value = source[key];
          if (typeof value === 'number') {
            return Number.isFinite(value) ? value : null;
          }
          if (typeof value === 'string') {
            const numeric = Number(value);
            if (Number.isFinite(numeric)) {
              return numeric;
            }
          }
        }
      }
      for (const key of candidateKeys) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          const nested = source[key];
          if (nested && typeof nested === 'object' && nested !== payload) {
            const value = extractStockValue(nested);
            if (value != null) {
              return value;
            }
          }
        }
      }
    }
    return null;
  };

  const getCategoryIcon = useCallback(
    (idCategoria?: number): React.ReactNode => {
      const categoria = categorias.find(
        (cat) => typeof cat.id_categoria === 'number' && cat.id_categoria === idCategoria
      );
      const key = categoria?.nombre_categoria?.toLowerCase();
      return (key && CATEGORY_ICON[key]) ?? '🍔';
    },
    [categorias]
  );

  const handleProductImageError = useCallback((productId: number) => {
    setBrokenProductImages((prev) => {
      const next = new Set(prev);
      next.add(productId);
      return next;
    });
  }, []);

  const handleIngredientImageError = useCallback((key: string) => {
    setBrokenIngredientImages((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  // Búsqueda/Filtrado
  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    return productos.filter((p) => {
      const catOk = catActiva === 'all' ? true : p.id_categoria === catActiva;
      const qOk = q ? p.nombre_producto.toLowerCase().includes(q) : true;
      const activo = p.estado === 'activo';
      return catOk && qOk && activo;
    });
  }, [productos, query, catActiva]);

  /* ============================================================
     Carrito
     ============================================================ */
  const addToCart = (
    prod: Producto,
    mods?: string,
    qty: number = 1,
    variant?: ProductoVariante | null
  ) => {
    const variantId = variant?.id_variante;
    setCarrito((prev) => {
      const idx = prev.findIndex(
        (c) =>
          c.producto.id_producto === prod.id_producto &&
          (c.mods || '') === (mods || '') &&
          (c.id_variante ?? null) === (variantId ?? null)
      );
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + qty };
        return copy;
      }
      return [...prev, { producto: prod, qty, mods, id_variante: variantId ?? undefined, variant: variant ?? null }];
    });
  };

  const setQty = (id: number, mods: string | undefined, qty: number, idVariante?: number | null) => {
    setCarrito((prev) =>
      prev
        .map((c) =>
          c.producto.id_producto === id &&
          (c.mods || '') === (mods || '') &&
          (c.id_variante ?? null) === (idVariante ?? null)
            ? { ...c, qty: Math.max(0, qty) }
            : c
        )
        .filter((c) => c.qty > 0)
    );
  };

  const removeItem = (id: number, mods?: string, idVariante?: number) => {
    const itemToDelete = carrito.find(
      (c) =>
        c.producto.id_producto === id &&
        (c.mods || '') === (mods || '') &&
        (c.id_variante ?? null) === (idVariante ?? null)
    );
    if (itemToDelete) {
      setDeleteConfirmModal({
        isOpen: true,
        itemToDelete
      });
    }
  };

  const confirmRemoveItem = () => {
    if (deleteConfirmModal.itemToDelete) {
      const { producto, mods, id_variante } = deleteConfirmModal.itemToDelete;
      setCarrito((prev) =>
        prev.filter(
          (c) =>
            !(
              c.producto.id_producto === producto.id_producto &&
              (c.mods || '') === (mods || '') &&
              (c.id_variante ?? null) === (id_variante ?? null)
            )
        )
      );
      addNotification({
        type: 'success',
        title: 'Producto eliminado',
        message: `${producto.nombre_producto} ha sido eliminado del carrito`,
        duration: 3000
      });
    }
    setDeleteConfirmModal({ isOpen: false, itemToDelete: null });
  };

  const cancelRemoveItem = () => {
    setDeleteConfirmModal({ isOpen: false, itemToDelete: null });
  };

  const limpiar = () => {
    setCarrito([]);
    setNotasVenta('');
  };

  const total = useMemo(
    () => {
      const esDecimaCompra = clienteSeleccionado?.puntos_acumulados === 9;
      return esDecimaCompra ? 0 : carrito.reduce((acc, it) => acc + getCartItemUnitPrice(it) * it.qty, 0);
    },
    [carrito, clienteSeleccionado?.puntos_acumulados]
  );

  /* ============================================================
     Personalización
     ============================================================ */
  const hydrateIngredientOptions = (
    detalle: ProductoConReceta,
    variant: ProductoVariante | null,
    modsParsed?: ReturnType<typeof parseMods>,
    previousChecks?: Record<string, boolean>
  ) => {
    const variantId = variant?.id_variante ?? null;
    const relevant = detalle.receta.filter(
      (linea) => linea.id_variante == null || linea.id_variante === variantId
    );

    const omitidos = new Set<string>();
    if (modsParsed?.sin?.length) {
      modsParsed.sin.forEach((item) => omitidos.add(normalizeText(item)));
    }

    const options: IngredientOption[] = relevant.map((linea) => {
      const insumo = insumos.find((i) => i.id_insumo === linea.id_insumo);
      const nombre = insumo ? insumo.nombre_insumo : `Insumo ${linea.id_insumo}`;
      const imagenUrl = insumo?.insumo_url || insumo?.imagen || insumo?.imagen_url || undefined;
      const stockActual = typeof insumo?.stock_actual === 'number' ? insumo.stock_actual : undefined;
      const cantidadRequerida = Number(linea.cantidad_requerida ?? 0);

      return {
        key: buildIngredientKey(linea.id_insumo, linea.id_variante ?? null),
        nombre,
        id_insumo: linea.id_insumo,
        variantId: linea.id_variante ?? null,
        // es_obligatorio - default NOT obligatory (false)
        esObligatorio: linea.es_obligatorio ?? false,
        imagenUrl,
        stockActual,
        cantidadRequerida,
      };
    });

    const checks: Record<string, boolean> = {};
    for (const option of options) {
      if (option.esObligatorio) {
        checks[option.key] = true;
        continue;
      }

      // Default behaviour: selected by default unless there are previous checks (editing state).
      if (previousChecks && option.key in previousChecks) {
        checks[option.key] = previousChecks[option.key];
      } else {
        checks[option.key] = true;
      }
    }

    return { options, checks };
  };

  const openCustomizer = async (prod: Producto, itemToEdit?: CartItem) => {
    const qtyToUse = itemToEdit?.qty ?? 1;
    setOpenCustom(false);
    setCustomProd(prod);
    setCustomQty(qtyToUse);
    setEditTarget(
      itemToEdit
        ? {
            productoId: itemToEdit.producto.id_producto,
            mods: itemToEdit.mods,
            variantId: itemToEdit.id_variante ?? null,
          }
        : null
    );
    setCustomChecks({});
    setIngredientOptions([]);
    setCustomDetalle(null);
    setCustomVariant(null);
    setCustomLoading(true);

    try {
      const detalle = await productosService.getProductoConReceta(prod.id_producto);

      const variantesActivas = (detalle.variantes ?? []).filter((v) => v.estado === 'activo');
      const selectedVariant = itemToEdit?.variant
        ? variantesActivas.find((v) => v.id_variante === itemToEdit.variant?.id_variante) ?? null
        : variantesActivas.length === 1
        ? variantesActivas[0]
        : null;

      const parsedMods = parseMods(itemToEdit?.mods);
      const { options, checks } = hydrateIngredientOptions(detalle, selectedVariant ?? null, parsedMods);
      const hasCustomOptions = options.length > 0 || variantesActivas.length > 0;

      if (!hasCustomOptions) {
        setCustomLoading(false);
        if (!itemToEdit) {
          addToCart(prod, undefined, qtyToUse, null);
        } else {
          addNotification({
            type: 'info',
            title: 'Sin opciones',
            message: 'Este producto no tiene ingredientes ni variantes para personalizar.',
            duration: 2500,
          });
        }
        return;
      }

      setCustomDetalle(detalle);
      setCustomVariant(selectedVariant ?? null);
      setIngredientOptions(options);
      setCustomChecks(checks);
      setCustomLoading(false);
      setOpenCustom(true);
    } catch (error) {
      console.error('Error cargando receta del producto:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'No se pudo cargar la receta del producto. Intenta de nuevo.',
      });
      setCustomLoading(false);
      setOpenCustom(false);
    }
  };

  const handleVariantSelect = (variant: ProductoVariante | null) => {
    if (!customDetalle) return;

    setCustomVariant(variant);
    const { options, checks } = hydrateIngredientOptions(
      customDetalle,
      variant,
      undefined,
      customChecks
    );
    setIngredientOptions(options);
    setCustomChecks(checks);
  };

  const confirmCustomizer = () => {
    if (!customProd) return;

    const faltantes = ingredientOptions.filter((option) => {
      const seleccionado = option.esObligatorio || (customChecks[option.key] ?? false);
      if (!seleccionado) return false;
      if (option.stockActual == null) return false;
      const requerido = option.cantidadRequerida * customQty;
      return option.stockActual < requerido;
    });

    if (faltantes.length > 0) {
      const detalle = faltantes
        .slice(0, 3)
        .map((option) => {
          const requerido = (option.cantidadRequerida * customQty).toFixed(3);
          const disponible = option.stockActual?.toFixed(3) ?? '0';
          return `${option.nombre}: requiere ${requerido}, disponible ${disponible}`;
        })
        .join('\n');

      addNotification({
        type: 'error',
        title: 'Stock insuficiente',
        message: `No es posible preparar este producto con el stock actual.\n${detalle}`,
        duration: 5000,
      });
      return;
    }

    const omitidos = ingredientOptions
      .filter((option) => !option.esObligatorio && !customChecks[option.key])
      .map((option) => option.nombre);
    const modsFinal = omitidos.length ? `sin ${omitidos.join(', sin ')}` : undefined;

    const variantToUse = customVariant ?? null;
    const variantId = variantToUse?.id_variante ?? null;

    if (editTarget) {
      setCarrito((prev) => {
        const withoutOld = prev.filter(
          (c) =>
            !(
              c.producto.id_producto === editTarget.productoId &&
              (c.mods || '') === (editTarget.mods || '') &&
              (c.id_variante ?? null) === (editTarget.variantId ?? null)
            )
        );

        const existingIdx = withoutOld.findIndex(
          (c) =>
            c.producto.id_producto === customProd.id_producto &&
            (c.mods || '') === (modsFinal || '') &&
            (c.id_variante ?? null) === (variantId ?? null)
        );

        if (existingIdx >= 0) {
          const copy = [...withoutOld];
          copy[existingIdx] = {
            ...copy[existingIdx],
            qty: copy[existingIdx].qty + customQty,
            variant: variantToUse,
          };
          return copy;
        }

        return [
          ...withoutOld,
          {
            producto: customProd,
            qty: customQty,
            mods: modsFinal,
            id_variante: variantId ?? undefined,
            variant: variantToUse,
          } as CartItem,
        ];
      });
      setEditTarget(null);
    } else {
      addToCart(customProd, modsFinal, customQty, variantToUse);
    }

    setOpenCustom(false);
  };

  /* ============================================================
     Modales menores
     ============================================================ */

  const handleCloseCategoriaModal = () => {
    setCategoriaModal({
      isOpen: false,
      mode: 'create',
      categoria: null
    });
  };

  const handleSaveCategoria = async (categoriaData: Omit<CategoriaProducto, 'id_categoria'>) => {
    if (!ensureCanManageCategorias()) {
      return;
    }

    try {
      if (categoriaModal.mode === 'create') {
        // Crear nueva categoría
        // Generar ID numérico único basado en el máximo ID existente
        const maxId = categorias.reduce((max, cat) => {
          const id = typeof cat.id_categoria === 'number' ? cat.id_categoria : 0;
          return Math.max(max, id);
        }, 0);
        const newId = maxId + 1;

        // Verificar que no exista una categoría con el mismo nombre
        const nombreExiste = categorias.some((c) =>
          c.nombre_categoria.toLowerCase() === categoriaData.nombre_categoria.toLowerCase()
        );

        if (nombreExiste) {
          addNotification({ type: 'warning', title: 'Categoría duplicada', message: 'Ya existe una categoría con ese nombre' });
          return;
        }

        const nuevaCategoria: CategoriaProducto = {
          id_categoria: newId,
          nombre_categoria: categoriaData.nombre_categoria,
          descripcion: categoriaData.descripcion || '',
          estado: categoriaData.estado
        };

        setCategorias((prev) => [...prev, nuevaCategoria]);
        setCatActiva('all'); // Resetear filtro para mostrar todas las categorías

      } else if (categoriaModal.mode === 'edit' && categoriaModal.categoria) {
        // Actualizar categoría existente
        setCategorias((prev) =>
          prev.map((cat) =>
            cat.id_categoria === categoriaModal.categoria!.id_categoria
              ? { ...cat, ...categoriaData }
              : cat
          )
        );
      }
    } catch (error) {
      console.error('Error saving categoria:', error);
      addNotification({ type: 'error', title: 'Error', message: 'Error al guardar la categoría' });
    }
  };

  const handleGuardarCliente = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    if (nitMode === 'NIT' && !String(nitValue).trim()) {
      addNotification({
        type: 'warning',
        title: 'Campo requerido',
        message: 'Ingresa el NIT para continuar',
      });
      return;
    }

    try {
      const nuevoCliente = {
        nombre: String(fd.get('nombre') || 'Cliente'),
        telefono: String(fd.get('telefono') || undefined),
        direccion: nitMode === 'CF' ? 'CF' : String(nitValue).trim(), // Usando direccion para NIT por ahora
      };

      const clienteCreado = await clientesService.createCliente(nuevoCliente);
      setClienteSeleccionado(clienteCreado);

      // Recargar la lista de clientes
      const clientesActualizados = await clientesService.getClientes();
      setClientes(clientesActualizados);

      setNitMode('CF');
      setNitValue('');
      setOpenCliente(false);

      // Notificación de éxito
      addNotification({
        type: 'success',
        title: 'Cliente creado',
        message: `El cliente ${clienteCreado.nombre} ha sido registrado exitosamente`,
      });
    } catch (error: unknown) {
      console.error('Error creando cliente:', error);

      // Determinar el tipo de error y mostrar notificación apropiada
      let errorMessage = 'Error al guardar el cliente. Inténtalo de nuevo.';
      let errorTitle = 'Error';

      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: { message?: string } } };
        if (axiosError.response?.data?.message) {
          errorMessage = axiosError.response.data.message;
          errorTitle = 'Error de validación';
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      addNotification({
        type: 'error',
        title: errorTitle,
        message: errorMessage,
      });
    }
  };

  const handleEditarCliente = (cliente: Cliente) => {
    setClienteEditando(cliente);
    setClientModo('editar');
    // Pre-llenar los campos del formulario
    setNitValue(cliente.direccion === 'CF' ? '' : cliente.direccion || '');
    setNitMode(cliente.direccion === 'CF' ? 'CF' : 'NIT');
  };

  const handleEliminarCliente = (cliente: Cliente) => {
    setClienteAEliminar(cliente);
  };

  const confirmarEliminarCliente = async () => {
    if (!clienteAEliminar) return;

    try {
      await clientesService.deleteCliente(clienteAEliminar.id_cliente);

      // Actualizar la lista de clientes
      const clientesActualizados = await clientesService.getClientes();
      setClientes(clientesActualizados);

      // Si el cliente eliminado era el seleccionado, deseleccionarlo
      if (clienteSeleccionado?.id_cliente === clienteAEliminar.id_cliente) {
        setClienteSeleccionado(null);
      }

      addNotification({
        type: 'success',
        title: 'Cliente eliminado',
        message: `El cliente "${clienteAEliminar.nombre}" ha sido eliminado exitosamente`,
      });

      setClienteAEliminar(null);
    } catch (error) {
      console.error('Error eliminando cliente:', error);
      addNotification({
        type: 'error',
        title: 'Error al eliminar',
        message: 'No se pudo eliminar el cliente. Inténtalo de nuevo.',
      });
    }
  };

  const handleActualizarCliente = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!clienteEditando) return;

    const fd = new FormData(e.currentTarget);

    if (nitMode === 'NIT' && !String(nitValue).trim()) {
      addNotification({
        type: 'warning',
        title: 'Campo requerido',
        message: 'Ingresa el NIT para continuar',
      });
      return;
    }

    try {
      const clienteActualizado = {
        nombre: String(fd.get('nombre') || clienteEditando.nombre),
        telefono: String(fd.get('telefono') || clienteEditando.telefono || undefined),
        direccion: nitMode === 'CF' ? 'CF' : String(nitValue).trim(),
      };

      await clientesService.updateCliente(clienteEditando.id_cliente, clienteActualizado);

      // Actualizar la lista de clientes
      const clientesActualizados = await clientesService.getClientes();
      setClientes(clientesActualizados);

      // Actualizar el cliente seleccionado si era el que se editó
      if (clienteSeleccionado?.id_cliente === clienteEditando.id_cliente) {
        const clienteActualizadoCompleto = clientesActualizados.find(c => c.id_cliente === clienteEditando.id_cliente);
        if (clienteActualizadoCompleto) {
          setClienteSeleccionado(clienteActualizadoCompleto);
        }
      }

      // Resetear el estado
      setClienteEditando(null);
      setClientModo('registrados');
      setNitMode('CF');
      setNitValue('');

      addNotification({
        type: 'success',
        title: 'Cliente actualizado',
        message: `El cliente "${clienteActualizado.nombre}" ha sido actualizado exitosamente`,
      });
    } catch (error) {
      console.error('Error actualizando cliente:', error);

      let errorMessage = 'Error al actualizar el cliente. Inténtalo de nuevo.';
      let errorTitle = 'Error';

      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: { message?: string } } };
        if (axiosError.response?.data?.message) {
          errorMessage = axiosError.response.data.message;
          errorTitle = 'Error de validación';
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      addNotification({
        type: 'error',
        title: errorTitle,
        message: errorMessage,
      });
    }
  };

  const editarClienteSeleccionado = () => {
    if (!clienteSeleccionado) return;
    handleEditarCliente(clienteSeleccionado);
    setOpenCliente(true);
  };

  const limpiarClienteSeleccionado = () => {
    if (!clienteSeleccionado) return;
    setClienteSeleccionado(null);
    setClienteEditando(null);
    setClienteAEliminar(null);
    setClientModo('registrados');
    setNitMode('CF');
    setNitValue('');
    addNotification({
      type: 'info',
      title: 'Cliente removido',
      message: 'Se quitó el cliente de la orden actual.',
      duration: 2500,
    });
  };

  /* ============================================================
     Pago
     ============================================================ */
  const irAPago = () => {
    if (!carrito.length) return addNotification({ type: 'warning', title: 'Carrito vacío', message: 'Agrega productos a la orden' });

    // Si es décima compra (cliente tiene 9 puntos), ir directamente a confirmar
    if (clienteSeleccionado?.puntos_acumulados === 9) {
      confirmarPago();
      return;
    }

    setPagoError('');
    setCashInvalid(false);
    setTransfInvalid(false);
    setModalError(null); // Limpiar errores previos del modal
    setOpenPago(true);
  };

  const validarStockCarrito = async (): Promise<boolean> => {
    if (!carrito.length) {
      return true;
    }

    const stockDisponible = new Map<number, number>();
    insumos.forEach((insumo) => {
      if (typeof insumo?.stock_actual === 'number') {
        stockDisponible.set(insumo.id_insumo, Number(insumo.stock_actual));
      }
    });

    const recetasCache = new Map<number, ProductoConReceta>();
    const faltantes: Array<{ nombre: string; requerido: number; disponible: number }> = [];

    for (const item of carrito) {
      let detalle = recetasCache.get(item.producto.id_producto);
      if (!detalle) {
        try {
          detalle = await productosService.getProductoConReceta(item.producto.id_producto);
          recetasCache.set(item.producto.id_producto, detalle);
        } catch (error) {
          console.error('Error obteniendo receta para validar stock:', error);
          continue;
        }
      }

      const variantId = item.id_variante ?? null;
      const lineas = (detalle.receta ?? []).filter(
        (linea) => linea.id_variante == null || linea.id_variante === variantId
      );

      const parsedMods = parseMods(item.mods);
      const omitidosSet = new Set(parsedMods.sin.map(normalizeText));

      for (const linea of lineas) {
        const esObligatorio = linea.es_obligatorio === true; // default NOT obligatory unless explicitly true
        const insumo = insumos.find((i) => i.id_insumo === linea.id_insumo);
        const nombre = insumo?.nombre_insumo ?? `Insumo ${linea.id_insumo}`;
        const seleccionado = esObligatorio || !omitidosSet.has(normalizeText(nombre));
        if (!seleccionado) continue;

        const requerido = Number(linea.cantidad_requerida ?? 0) * item.qty;
        if (requerido <= 0) continue;

        let disponibleInicial = stockDisponible.has(linea.id_insumo)
          ? stockDisponible.get(linea.id_insumo)!
          : typeof insumo?.stock_actual === 'number'
            ? insumo.stock_actual
            : undefined;

        if (disponibleInicial == null) {
          try {
            const respuestaStock = await getStockActual(linea.id_insumo);
            const stockObtenido = extractStockValue(respuestaStock);
            if (stockObtenido != null) {
              disponibleInicial = stockObtenido;
              stockDisponible.set(linea.id_insumo, stockObtenido);
            }
          } catch (error) {
            console.error(`Error obteniendo stock para insumo ${linea.id_insumo}:`, error);
          }
        }

        if (disponibleInicial == null) {
          // Si no hay datos de stock, permitir que la validación del backend actúe
          continue;
        }

        if (disponibleInicial < requerido) {
          faltantes.push({
            nombre,
            requerido,
            disponible: disponibleInicial,
          });
        } else {
          const restante = Number((disponibleInicial - requerido).toFixed(3));
          stockDisponible.set(linea.id_insumo, restante);
        }
      }
    }

    if (faltantes.length > 0) {
      const detalle = faltantes
        .slice(0, 3)
        .map((f) => `${f.nombre}: requiere ${f.requerido.toFixed(3)}, disponible ${f.disponible.toFixed(3)}`)
        .join('\n');

      addNotification({
        type: 'error',
        title: 'Stock insuficiente',
        message: `No hay inventario suficiente para completar la venta.\n${detalle}`,
        duration: 5000,
      });

      return false;
    }

    return true;
  };

  const confirmarPago = async () => {
    if (!carrito.length) return addNotification({ type: 'warning', title: 'Carrito vacío', message: 'Tu carrito está vacío.' });

    if (metodo === 'transferencia' && !clienteSeleccionado) {
      setPagoError('Selecciona un cliente para pagos con transferencia.');
      setTransfInvalid(true);
      setCashInvalid(false);
      return;
    }

    if (metodo === 'efectivo') {
      // Para décima compra (total = 0), no validar dinero recibido
      if (total > 0) {
        if (Number.isNaN(receivedNumber) || receivedNumber <= 0) {
          setPagoError('Ingresa el dinero recibido.');
          setCashInvalid(true);
          setTransfInvalid(false);
          return;
        }
        if (receivedNumber < total) {
          setPagoError('El dinero recibido es menor al total.');
          setCashInvalid(true);
          setTransfInvalid(false);
          return;
        }
      }
    }

    try {
      const stockOk = await validarStockCarrito();
      if (!stockOk) {
        return;
      }

      // Crear el payload para la venta
      console.log('🛒 Creando venta con puntosEnabled:', puntosEnabled);
      const esDecimaCompra = clienteSeleccionado?.puntos_acumulados === 9;
      const ventaData: CreateVentaDTO = {
        id_cliente: clienteSeleccionado?.id_cliente,
        tipo_pago: metodo === 'efectivo' ? 'Cash' : metodo === 'transferencia' ? 'Transferencia' : metodo === 'cupon' ? 'Cupon' : 'Paggo',
        acumula_puntos: puntosEnabled,
        notas: notasVenta.trim() ? notasVenta.trim() : undefined,
        detalles: carrito.map((item) => ({
          id_producto: item.producto.id_producto,
          id_variante: item.id_variante,
          cantidad: item.qty,
          precio_unitario: esDecimaCompra ? 0 : getCartItemUnitPrice(item), // Gratis si es décima compra
          descuento: 0, // Por ahora no hay descuentos
          es_canje_puntos: esDecimaCompra, // Marcar como canje si es décima compra
          puntos_canjeados: esDecimaCompra ? 10 : 0, // Canjear 10 puntos
        })),
        // Agregar información de transferencia si es el método seleccionado
        ...(metodo === 'transferencia' && {
          numero_referencia: referencia.trim() || 'Sin referencia',
          nombre_banco: banco.trim() || 'Sin banco'
        }),
      };

      // Crear la venta en el backend
      const ventaCreada = await ventasService.createVenta(ventaData);

      // Actualizar recuentos Caja / Banco
      if (metodo === 'efectivo') setTotalCaja((v) => v + total);
      else setTotalBanco((v) => v + total);

      // Refrescar totales desde backend para asegurar sincronización
      await loadTotalesSesion();

      // Construir payload del ticket
      const recibido = metodo === 'efectivo' ? Number(dineroRecibido || 0) : null;
      const cambioLocal = metodo === 'efectivo' ? Math.max(0, (recibido ?? 0) - total) : null;

      const ticketData = {
        ordenN,
        ventaId: ventaCreada.id_venta, // Agregar el ID de la venta creada
        cliente: clienteSeleccionado,
        items: carrito.map((it) => ({
          id: it.producto.id_producto,
          nombre: it.producto.nombre_producto,
          variante: it.variant?.nombre_variante ?? null,
          qty: it.qty,
          precio: getCartItemUnitPrice(it),
          mods: it.mods || null,
          subtotal: getCartItemUnitPrice(it) * it.qty,
        })),
        total,
        metodo, // 'efectivo' | 'transferencia'
        efectivo: metodo === 'efectivo' ? { dineroRecibido: recibido, cambio: cambioLocal } : null,
        transferencia: metodo === 'transferencia' ? { referencia: referencia || 'Sin referencia', banco: banco || 'Sin banco' } : null,
        fechaHora: new Date().toISOString(),
        notas: notasVenta.trim() || undefined,
      };

      try {
        sessionStorage.setItem('ticketventa:last', JSON.stringify(ticketData));
      } catch (error) {
        console.warn('No se pudo guardar el ticket en sessionStorage:', error);
      }

      addNotification({
        type: 'success',
        title: 'Venta confirmada',
        message: 'La venta se registró exitosamente. Inventario actualizado correctamente. Generando ticket...',
        duration: 4000,
      });

      // Reset y cierre del drawer
      setOrdenN((n) => n + 1);
      limpiar();
      setClienteSeleccionado(null);
      setMetodo('efectivo');
      setReferencia('');
      setBanco('');
      setDineroRecibido('');
      setNotasVenta('');
      setOpenPago(false);

      // Navegar directamente (el toast se muestra en Ticket)
      navigate('/ventas/ticketventa', { state: ticketData });
    } catch (error) {
      console.error('Error creando la venta:', error);

      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const apiMessage =
          (error.response?.data?.message as string | undefined) ??
          (error.response?.data?.error as string | undefined) ??
          error.message;

        if (status === 403 && (apiMessage?.toLowerCase().includes('caja') ?? true)) {
          const reason = apiMessage ?? 'Debes abrir la caja antes de registrar ventas.';
          addNotification({
            type: 'warning',
            title: 'Caja cerrada',
            message: reason,
            duration: 5000,
          });
          setOpenPago(false);
          navigate('/ventas/cierre-caja', {
            state: { requireOpenCaja: true, reason },
          });
          return;
        }

        const message = apiMessage ?? 'Error al procesar la venta. Inténtalo de nuevo.';

        // Mostrar error dentro del modal
        setModalError(message);
        return;
      }

      const fallbackMessage =
        error instanceof Error ? error.message : 'Error al procesar la venta. Inténtalo de nuevo.';

      // Mostrar error dentro del modal
      setModalError(fallbackMessage);
    }
  };

  const confirmarCanjeGratis = async () => {
    if (!carrito.length) return addNotification({ type: 'warning', title: 'Carrito vacío', message: 'Tu carrito está vacío.' });

    // Verificar si el sistema de puntos está activado
    if (!puntosEnabled) {
      addNotification({
        type: 'warning',
        title: 'Sistema de puntos desactivado',
        message: 'El sistema de puntos está desactivado. El canje gratis se procesará sin usar puntos.',
        duration: 3000,
      });
    }

    // Setting metodo to canje_gratis to ensure UI hides cash inputs
    setMetodo('canje_gratis');
    setDineroRecibido('');

    try {
      const stockOk = await validarStockCarrito();
      if (!stockOk) {
        return;
      }

      // Crear el payload para la venta (canje gratis)
      const ventaData: CreateVentaDTO = {
        id_cliente: clienteSeleccionado?.id_cliente,
        tipo_pago: 'Canje',
        acumula_puntos: puntosEnabled,
        notas: notasVenta.trim() ? `${notasVenta.trim()} - CANJE GRATIS` : 'CANJE GRATIS',
        puntos_usados: puntosEnabled ? carrito.reduce((sum, it) => sum + (10 * it.qty), 0) : 0,
        detalles: carrito.map((item) => ({
          id_producto: item.producto.id_producto,
          id_variante: item.id_variante,
          cantidad: item.qty,
          precio_unitario: 0, // Precio 0 para canje gratis
          descuento: 0,
          es_canje_puntos: puntosEnabled,
          puntos_canjeados: puntosEnabled ? 10 * item.qty : 0,
        })),
      };

      // Crear la venta en el backend (tipo_pago distinto para evitar registrar ingreso en caja)
      const ventaCreada = await ventasService.createVenta(ventaData);

      // Construir payload del ticket
      const ticketData = {
        ordenN,
        ventaId: ventaCreada.id_venta,
        cliente: clienteSeleccionado,
        items: carrito.map((it) => ({
          id: it.producto.id_producto,
          nombre: it.producto.nombre_producto,
          variante: it.variant?.nombre_variante ?? null,
          qty: it.qty,
          precio: 0, // Precio 0 para canje gratis
          mods: it.mods || null,
          subtotal: 0,
        })),
        total: 0, // Total 0 para canje gratis
        metodo: 'canje_gratis',
        efectivo: null,
        transferencia: null,
        fechaHora: new Date().toISOString(),
        notas: notasVenta.trim() ? `${notasVenta.trim()} - CANJE GRATIS` : 'CANJE GRATIS',
      };

      try {
        sessionStorage.setItem('ticketventa:last', JSON.stringify(ticketData));
      } catch (error) {
        console.warn('No se pudo guardar el ticket en sessionStorage:', error);
      }

      addNotification({
        type: 'success',
        title: 'Canje gratis confirmado',
        message: 'El canje gratis se registró exitosamente. Inventario actualizado correctamente. Generando ticket...',
        duration: 4000,
      });

      // Reset y cierre del drawer
      setOrdenN((n) => n + 1);
      limpiar();
      setClienteSeleccionado(null);
      setMetodo('efectivo');
      setReferencia('');
      setBanco('');
      setDineroRecibido('');
      setNotasVenta('');
      setOpenPago(false);
      setConfirmCanje(false);

      // Navegar directamente (el toast se muestra en Ticket)
      navigate('/ventas/ticketventa', { state: ticketData });
    } catch (error) {
      console.error('Error creando el canje gratis:', error);

      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const apiMessage =
          (error.response?.data?.message as string | undefined) ??
          (error.response?.data?.error as string | undefined) ??
          error.message;

        if (status === 403 && (apiMessage?.toLowerCase().includes('caja') ?? true)) {
          const reason = apiMessage ?? 'Debes abrir la caja antes de registrar ventas.';
          addNotification({
            type: 'warning',
            title: 'Caja cerrada',
            message: reason,
            duration: 5000,
          });
          setOpenPago(false);
          navigate('/ventas/cierre-caja', {
            state: { requireOpenCaja: true, reason },
          });
          return;
        }

        const message = apiMessage ?? 'Error al procesar el canje gratis. Inténtalo de nuevo.';

        // Mostrar error dentro del modal
        setModalError(message);
        return;
      }

      const fallbackMessage =
        error instanceof Error ? error.message : 'Error al procesar el canje gratis. Inténtalo de nuevo.';

      // Mostrar error dentro del modal
      setModalError(fallbackMessage);
    }
  };

  /* ============================================================
     Render
     ============================================================ */
  const cambio = Math.max(0, receivedNumber - total);

  const toModsList = (mods?: string) => {
    if (!mods) return [] as string[];
    return mods
      .replace(/^sin\s+/i, '')
      .split(/,\s*sin\s*/i)
      .map((s) => s.trim())
      .filter(Boolean);
  };

  // Catálogo de insumos para nombrar ingredientes en el POS
  const [insumos, setInsumos] = useState<Insumo[]>([]);

  // Cargar insumos al montar el componente (solo una vez)
  useEffect(() => {
    const cargarInsumos = async () => {
      try {
        const data = await fetchInsumos();
        setInsumos(data || []);
      } catch {
        setInsumos([]);
      }
    };
    cargarInsumos();
  }, []);

  

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      {/* Mostrar loading o error si es necesario */}
      {loading && (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando datos...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-red-500 mb-4">⚠️</div>
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* 1) CONTENEDOR */}
          <div className="max-w-[1280px] mx-auto px-6 py-6">
            {/* Encabezado mejorado */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2"
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate("/ventas")}
                  className="flex items-center gap-2 h-12 px-5 rounded-xl bg-white text-gray-700 border border-gray-200 text-base font-semibold shadow-sm hover:bg-gray-50 transition-all"
                >
                  <span className="text-xl">←</span>
                  <span>Regresar</span>
                </button>
              </div>
              <div className="flex flex-1 items-center justify-end gap-2">
                <div className="relative w-full sm:w-80">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar producto o categoría"
                    className="w-full h-12 rounded-xl border border-gray-200 bg-white pl-4 pr-10 text-base focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    {/* Ícono SVG lupa */}
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" /></svg>
                  </span>
                </div>
              </div>
            </motion.div>

            {/* 2) GRID DOS COLUMNAS */}
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_440px] gap-8">
              {/* Columna izquierda: catálogo */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22 }}
                className="min-w-0"
              >
                {/* Fila de categorías dinámicas con scroll horizontal */}
                <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-emerald-300 scrollbar-track-gray-100 hover:scrollbar-thumb-emerald-400 transition-colors">
                  {categorias
                    .filter((c) => c.estado === 'activo' || c.id_categoria === 'all')
                    .sort((a, b) => {
                      if (a.id_categoria === 'all') return -1;
                      if (b.id_categoria === 'all') return 1;
                      return a.nombre_categoria.localeCompare(b.nombre_categoria);
                    })
                    .map((c) => (
                      <Pill
                        key={c.id_categoria}
                        active={catActiva === c.id_categoria}
                        onClick={() => setCatActiva(c.id_categoria === 'all' ? 'all' : Number(c.id_categoria))}
                      >
                        {c.nombre_categoria}
                      </Pill>
                    ))}
                </div>

                {/* Contenedor con scroll SOLO en 'Todos' */}
                <div className={catActiva === 'all' ? 'max-h-[70vh] overflow-y-auto pr-1' : ''}>
                  <div className={`grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-4 gap-5 lg:gap-6`}>
                    {filtrados.map((p, idx) => {
                      const showProductImage = Boolean(p.imagen_url) && !brokenProductImages.has(p.id_producto);
                      const categoryIcon = getCategoryIcon(p.id_categoria);
                      return (
                        <motion.div
                          key={p.id_producto}
                          whileHover={{ y: -2, scale: 1.01 }}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.18, delay: idx * 0.015 }}
                          className="group bg-white rounded-2xl border border-gray-100 hover:border-emerald-200 shadow-sm hover:shadow-md transition overflow-hidden text-left relative cursor-pointer"
                          onClick={() => void openCustomizer(p)}
                        >
                          <div className="aspect-[4/3] bg-gray-50 flex items-center justify-center text-gray-400 relative overflow-hidden">
                            {showProductImage ? (
                              <img
                                src={p.imagen_url}
                                alt={p.nombre_producto}
                                className="w-full h-full object-cover"
                                loading="lazy"
                                onError={() => handleProductImageError(p.id_producto)}
                              />
                            ) : (
                              <span className="leading-none text-[100px] xl:text-[130px]">
                                {categoryIcon}
                              </span>
                            )}
                          </div>
                          <div className="p-3">
                            <div className="font-semibold text-gray-800 group-hover:text-emerald-700 leading-snug break-words line-clamp-2 text-[14px]">
                              {p.nombre_producto}
                            </div>
                            <div className="mt-1 text-[13px] text-gray-500">
                              {categorias.find((c) => c.id_categoria === p.id_categoria)?.nombre_categoria}
                            </div>
                            <div className="mt-2 font-extrabold text-emerald-700 text-[18px]">
                              {currency(p.precio_venta)}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}

                    {filtrados.length === 0 && (
                      <div className="col-span-full text-center text-gray-500 py-10">
                        No hay productos para mostrar
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Columna derecha: Orden */}
              <motion.aside
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: 0.04 }}
                className="sticky top-6"
              >
                <Card className="p-5 md:p-6">
                  {/* Header ORDEN / Cliente */}
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-[12px] text-gray-500 uppercase tracking-wide">ORDEN #</div>
                      <div className="text-2xl font-extrabold text-gray-900">{ordenN}</div>
                    </div>
                    <button
                      onClick={() => setOpenCliente(true)}
                      className="h-11 px-3 rounded-lg text-[13px] font-semibold bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                    >
                      + Cliente
                    </button>
                  </div>

                  <div className="mb-4 text-[14px] text-gray-700">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">Cliente:</span>
                      {clienteSeleccionado ? (
                        <>
                          <span className="text-gray-700">
                            {clienteSeleccionado.nombre} · {clienteSeleccionado.telefono || 'Sin teléfono'}
                          </span>
                          <button
                            type="button"
                            onClick={editarClienteSeleccionado}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition"
                            title="Editar cliente"
                            aria-label="Editar cliente"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={limpiarClienteSeleccionado}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-red-50 hover:text-red-600 transition"
                            title="Quitar cliente"
                            aria-label="Quitar cliente"
                          >
                            <UserX className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <span className="italic text-gray-400">(sin cliente)</span>
                      )}
                    </div>
                  </div>

                  {clienteSeleccionado && clienteSeleccionado.puntos_acumulados === 9 && (
                    <div className="mb-4 text-sm text-orange-600 font-medium bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-center gap-2">
                      <Gift className="w-5 h-5" />
                      ¡La próxima compra es gratis! (9 puntos acumulados)
                    </div>
                  )}

                  {/* Recuento CAJA / BANCO */}
                  <div className="mb-4 rounded-xl border border-dashed border-gray-200 p-4 bg-gray-50/60">
                    <div className="flex items-center justify-between text-[14px]">
                      <span className="text-gray-600">CAJA</span>
                      <span className="font-semibold text-gray-900">{currency(totalCaja)}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[14px]">
                      <span className="text-gray-600">BANCO</span>
                      <span className="font-semibold text-gray-900">{currency(totalBanco)}</span>
                    </div>
                  </div>

                  {/* Notas de la orden */}
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Notas de la orden</label>
                    <textarea
                      value={notasVenta}
                      onChange={(e) => setNotasVenta(e.target.value)}
                      placeholder="Ej. Entregar sin bolsa, agregar servilletas extra..."
                      rows={3}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-200 resize-none"
                    />
                  </div>

                  {/* Lista de ítems */}
                  <div className="divide-y border-y rounded-lg overflow-hidden">
                    {carrito.map((it) => {
                      const modsList = toModsList(it.mods);
                      const itemUnitPrice = getCartItemUnitPrice(it);
                      return (
                        <div
                          key={`${it.producto.id_producto}-${it.id_variante ?? 'base'}-${it.mods || ''}`}
                          className="py-5 px-4 flex items-start gap-4 hover:bg-gray-50"
                        >
                          <div className="w-14 h-14 rounded-md bg-gray-100 grid place-content-center text-2xl">
                            {CATEGORY_ICON[it.producto.categoria?.nombre_categoria.toLowerCase() || ''] ?? <ShoppingCart className="w-6 h-6" />}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-900 text-[17px] md:text-[18px] leading-tight truncate">
                              {it.producto.nombre_producto}
                            </div>

                            {it.variant && (
                              <div className="mt-1 text-[13px] text-emerald-600 font-medium">
                                Variante: {it.variant.nombre_variante}
                              </div>
                            )}

                            {modsList.length > 0 && (
                              <ul className="mt-1.5 pl-5 list-disc text-[13px] leading-5 text-gray-700 space-y-1">
                                {modsList.map((m) => <li key={m}>sin {m}</li>)}
                              </ul>
                            )}

                            <div className="mt-2 text-[13px] text-gray-600">
                              {currency(itemUnitPrice)}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              className="w-9 h-9 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                              onClick={() => setQty(it.producto.id_producto, it.mods, it.qty - 1, it.id_variante)}
                              aria-label="Disminuir"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <div className="min-w-[2.25rem] text-center text-lg">{it.qty}</div>
                            <button
                              className="w-9 h-9 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                              onClick={() => setQty(it.producto.id_producto, it.mods, it.qty + 1, it.id_variante)}
                              aria-label="Aumentar"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="w-28 text-right font-semibold text-lg">
                            {currency(itemUnitPrice * it.qty)}
                          </div>

                          {/* NUEVO: Editar línea */}
                          <button
                            className="text-emerald-600 hover:text-emerald-700 ml-1 p-2 rounded hover:bg-emerald-50"
                            onClick={() => void openCustomizer(it.producto, it)}
                            title="Editar"
                            aria-label="Editar"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                            className="text-rose-600 hover:text-rose-700 ml-1 p-2 rounded hover:bg-rose-50"
                            onClick={() => removeItem(it.producto.id_producto, it.mods, it.id_variante)}
                            title="Quitar"
                            aria-label="Quitar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                    {carrito.length === 0 && (
                      <div className="py-8 text-center text-gray-400 text-[14px]">
                        Tu orden está vacía
                      </div>
                    )}
                  </div>

                  {/* TOTAL + Acciones */}
                  <div className="mt-5">
                    <div className="flex items-center justify-between text-[15px] text-gray-700">
                      <span className="font-medium">TOTAL</span>
                      <span className="text-2xl font-extrabold text-gray-900">{currency(total)}</span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <button
                        onClick={limpiar}
                        className="h-12 rounded-lg border text-base font-semibold hover:bg-gray-50 uppercase flex items-center justify-center gap-2"
                      >
                        <X className="w-4 h-4" />
                        CANCELAR
                      </button>
                      <button
                        onClick={irAPago}
                        disabled={!carrito.length}
                        className="h-12 rounded-lg bg-emerald-600 text-white text-base font-semibold hover:bg-emerald-700 disabled:opacity-50 uppercase flex items-center justify-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        CONTINUAR
                      </button>
                    </div>
                  </div>
                </Card>
              </motion.aside>

            </div>
          </div>

          {/* Drawer: Pago */}
          <DrawerRight
            open={openPago}
            onClose={() => setOpenPago(false)}
            title="Detalle de pago"
            widthClass="w-full sm:w-[525px]"
          >
            <div className="p-5 space-y-5 text-[15px]">
              <Card>
                <div className="px-5 py-3.5 border-b bg-gray-50 rounded-t-xl">
                  <span className="text-base font-semibold text-gray-700">Productos</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left">
                    <thead className="text-sm uppercase text-gray-600">
                      <tr>
                        <th className="px-5 py-3.5">Producto</th>
                        <th className="px-5 py-3.5">Precio unitario</th>
                        <th className="px-5 py-3.5">Cantidad</th>
                        <th className="px-5 py-3.5">Subtotal</th>
                        <th className="px-5 py-3.5" />
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {carrito.map((it, i) => {
                        const unitPrice = getCartItemUnitPrice(it);
                        return (
                          <tr
                            key={`${it.producto.id_producto}-${it.id_variante ?? 'base'}-${it.mods || ''}-${i}`}
                            className={i % 2 ? 'bg-white' : 'bg-gray-50/50'}
                          >
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-md bg-gray-100 grid place-content-center">
                                {CATEGORY_ICON[it.producto.categoria?.nombre_categoria.toLowerCase() || ''] ?? <ShoppingCart className="w-5 h-5" />}
                              </div>
                              <div>
                                <div className="font-medium text-gray-800 text-[15px]">{it.producto.nombre_producto}</div>
                                  {it.variant && (
                                    <div className="text-sm text-emerald-600">Variante: {it.variant.nombre_variante}</div>
                                  )}
                                {it.mods && <div className="text-sm text-gray-500">{it.mods}</div>}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-gray-700 text-[15px]">{currency(unitPrice)}</td>
                          <td className="px-5 py-3.5">
                            <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white">
                              <button
                                onClick={() => setQty(it.producto.id_producto, it.mods, Math.max(1, it.qty - 1), it.id_variante)}
                                className="px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-l-lg"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <div className="px-3 py-2 text-[15px] select-none min-w-[40px] text-center">
                                {it.qty}
                              </div>
                              <button
                                onClick={() => setQty(it.producto.id_producto, it.mods, it.qty + 1, it.id_variante)}
                                className="px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-r-lg"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 font-semibold text-gray-900 text-[16px]">
                            {currency(unitPrice * it.qty)}
                          </td>
                          <td className="px-5 py-3.5">
                            <button
                              onClick={() => removeItem(it.producto.id_producto, it.mods, it.id_variante)}
                              className="text-gray-500 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </td>
                        </tr>
                        );
                      })}
                      {carrito.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-5 py-12 text-center text-gray-500 text-[15px]">
                            Tu orden está vacía.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card className="p-5">
                <div className="flex items-center justify-between text-[15px]">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-semibold text-gray-900">{currency(total)}</span>
                </div>
                <div className="my-4 h-px bg-gray-100" />
                <div className="flex items-center justify-between">
                  <span className="text-gray-700 text-[15px]">Total</span>
                  <span className="text-emerald-600 font-extrabold text-2xl">{currency(total)}</span>
                </div>

                {/* Métodos de pago */}
                <div className="mt-6 grid grid-cols-3 gap-3">
                  <button
                    aria-pressed={metodo === 'efectivo'}
                    onClick={() => { setMetodo('efectivo'); setPagoError(''); setCashInvalid(false); }}
                    className={`h-12 rounded-lg px-4 font-semibold text-xl border transition ${
                      metodo === 'efectivo'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-inner'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    EFECTIVO
                  </button>
                  <button
                    aria-pressed={metodo === 'transferencia'}
                    onClick={() => { setMetodo('transferencia'); setPagoError(''); setCashInvalid(false); }}
                    className={`h-12 rounded-lg px-4 font-semibold text-xl border transition ${
                      metodo === 'transferencia'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-inner'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    TRANSFERENCIA
                  </button>
                  <button
                    aria-pressed={metodo === 'cupon'}
                    onClick={() => { setMetodo('cupon'); setPagoError(''); setCashInvalid(false); }}
                    className={`h-12 rounded-lg px-4 font-semibold text-xl border transition ${
                      metodo === 'cupon'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-inner'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    CUPÓN
                  </button>
                </div>

                {/* Dinero recibido / Cambio SOLO en EFECTIVO */}
                {metodo === 'efectivo' && (
                  <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xl font-medium text-gray-600">Dinero recibido</label>
                      <input
                        value={dineroRecibido}
                        onChange={(e) => {
                          setDineroRecibido(e.target.value.replace(/[^0-9.]/g, ''));
                          setCashInvalid(false);
                          setPagoError('');
                        }}
                        placeholder="Q0.00"
                        className={
                          `w-full h-12 rounded-lg border bg-white px-3 text-xl outline-none ` +
                          (cashInvalid ? 'border-rose-400 focus:ring-rose-200' : 'border-gray-200 focus:ring-emerald-200')
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xl font-medium text-gray-600">Cambio</label>
                      <input
                        value={currency(cambio)}
                        readOnly
                        className="w-full h-12 rounded-lg border border-gray-200 bg-gray-50 px-3 text-xl outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* Referencia/Banco solo cuando sea TRANSFERENCIA */}
                {metodo === 'transferencia' && (
                  <div className="mt-5 space-y-4">
                    <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
                      <strong>Nota:</strong> Para pagos con transferencia es obligatorio seleccionar un cliente.
                    </div>
                    <div>
                      <label className="text-xl font-medium text-gray-600">Número de referencia</label>
                      <input
                        value={referencia}
                        onChange={(e) => {
                          setReferencia(e.target.value);
                          setTransfInvalid(false);
                          setPagoError('');
                        }}
                        placeholder="Ej. 123456789"
                        className={
                          `w-full h-12 rounded-lg border bg-white px-3 text-xl outline-none ` +
                          (transfInvalid ? 'border-rose-400 focus:ring-rose-200' : 'border-gray-200 focus:ring-emerald-200')
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xl font-medium text-gray-600">Banco de origen</label>
                      <input
                        value={banco}
                        onChange={(e) => {
                          setBanco(e.target.value);
                          setTransfInvalid(false);
                          setPagoError('');
                        }}
                        placeholder="Ej. Banco Industrial"
                        className={
                          `w-full h-12 rounded-lg border bg-white px-3 text-xl outline-none ` +
                          (transfInvalid ? 'border-rose-400 focus:ring-rose-200' : 'border-gray-200 focus:ring-emerald-200')
                        }
                      />
                    </div>
                  </div>
                )}

                {/* Error inline */}
                {pagoError && (
                  <div className="mt-3 text-s text-rose-600 font-medium">{pagoError}</div>
                )}

                {/* Mensaje de error dentro del modal */}
                {modalError && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <X className="text-red-500 flex-shrink-0" size={20} />
                      <div className="text-red-800 text-sm font-medium">
                        {modalError}
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-6 grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setOpenPago(false)}
                    className="h-12 rounded-lg bg-gray-100 text-gray-700 font-semibold text-base hover:bg-gray-200"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      console.log('Canje Gratis clicked - carrito:', carrito.length, 'puntosEnabled:', puntosEnabled, 'cliente puntos:', clienteSeleccionado?.puntos_acumulados);
                      setConfirmCanje(true);
                    }}
                    disabled={!carrito.length}
                    className="h-12 rounded-lg bg-purple-600 text-white font-semibold text-base hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Gift size={18} />
                    Canje Gratis
                  </button>
                  <button
                    onClick={confirmarPago}
                    disabled={!carrito.length}
                    className="h-12 rounded-lg bg-emerald-600 text-white font-semibold text-base hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <CreditCard size={18} />
                    {clienteSeleccionado?.puntos_acumulados === 9 ? 'DECIMA COMPRA' : 'Pagar ahora'}
                  </button>
                </div>
                {/* Confirm canje modal */}
                {confirmCanje && (
                  <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40">
                    <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md border">
                      <div className="text-lg font-bold mb-2">Confirmar Canje Gratis</div>
                      <div className="mb-4">¿Deseas confirmar el canje gratis? Esta operación generará una venta con total Q0.00 y no se registrará ingreso en caja.</div>
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setConfirmCanje(false)} className="h-10 rounded-lg border px-4">Cancelar</button>
                        <button onClick={confirmarCanjeGratis} className="h-10 rounded-lg bg-emerald-600 px-4 text-white">Confirmar</button>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </DrawerRight>

          {/* Drawer: Personalización */}
          <DrawerRight
            open={openCustom}
            onClose={() => setOpenCustom(false)}
            title={customProd ? `${customProd.nombre_producto}` : 'Personalizar'}
            widthClass="w-full sm:w-[525px]"
          >
            {customLoading ? (
              <div className="p-8 flex items-center justify-center text-lg text-gray-500">
                Cargando opciones...
              </div>
            ) : customProd ? (
              <div className="p-5 space-y-6 text-[15px]">
                {/* Header del producto */}
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gray-100 grid place-content-center text-4xl">
                    {CATEGORY_ICON[customProd.categoria?.nombre_categoria.toLowerCase() || ''] ?? <ShoppingCart className="w-8 h-8" />}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 text-base">{customProd.nombre_producto}</div>
                    <div className="text-[15px] text-gray-500">
                      {currency(getUnitPrice(customProd, customVariant ?? null))}
                    </div>
                  </div>
                </div>

                {/* Variantes */}
                {(customDetalle?.variantes?.filter((v) => v.estado === 'activo').length ?? 0) > 0 && (
                  <div className="space-y-3">
                    <div className="text-[15px] font-medium text-gray-800">Selecciona una variante</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        onClick={() => handleVariantSelect(null)}
                        className={`h-12 rounded-lg border px-4 font-semibold transition ${
                          customVariant == null
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700 shadow-inner'
                            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        Receta base
                      </button>
                      {customDetalle?.variantes
                        ?.filter((v) => v.estado === 'activo')
                        .map((variant) => (
                          <button
                            key={variant.id_variante}
                            onClick={() => handleVariantSelect(variant)}
                            className={`h-12 rounded-lg border px-4 font-semibold transition text-left ${
                              customVariant?.id_variante === variant.id_variante
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-700 shadow-inner'
                                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <div>{variant.nombre_variante}</div>
                            {(variant.precio_variante ?? 0) !== 0 && (
                              <div className="text-sm font-normal text-emerald-600">
                                {variant.precio_variante > 0 ? '+' : ''}{currency(variant.precio_variante)}
                              </div>
                            )}
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                {/* Ingredientes a quitar */}
                <div className="text-[15px] text-gray-600">
                  Selecciona lo que <span className="font-medium">NO</span> llevará el producto
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {ingredientOptions.map((option) => {
                    const checked = customChecks[option.key] ?? true;
                    const isRequired = option.esObligatorio;
                    const showIngredientImage = Boolean(option.imagenUrl) && !brokenIngredientImages.has(option.key);
                    const isSelected = isRequired || checked;
                    const stockActual = option.stockActual ?? null;
                    const requerido = option.cantidadRequerida * customQty;
                    const tieneStock = !isSelected || stockActual == null || stockActual >= requerido;
                    return (
                      <label
                        key={option.key}
                        className={`relative flex flex-col items-center gap-3 p-5 rounded-2xl border transition cursor-pointer select-none ${
                          isSelected && !tieneStock
                            ? 'border-rose-400 bg-rose-50/70'
                            : checked
                              ? 'border-gray-200 hover:shadow-sm'
                              : 'border-rose-200 bg-rose-50/60'
                        }`}
                      >
                        <div className={`h-24 w-24 rounded-2xl border ${
                          isSelected && !tieneStock
                            ? 'border-rose-400'
                            : checked
                              ? 'border-gray-200'
                              : 'border-rose-200/70'
                        } overflow-hidden flex items-center justify-center bg-white`}>
                          {showIngredientImage ? (
                            <img
                              src={option.imagenUrl}
                              alt={option.nombre}
                              className={`h-full w-full object-cover ${checked ? '' : 'opacity-40'}`}
                              loading="lazy"
                              onError={() => handleIngredientImageError(option.key)}
                            />
                          ) : (
                            <span className={`text-4xl leading-none ${checked ? '' : 'opacity-40'}`}>
                              {ING_EMOJI[option.nombre] ?? '🍽️'}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-col items-center gap-1">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={isRequired}
                              onChange={(e) =>
                                setCustomChecks((prev) => ({ ...prev, [option.key]: e.target.checked }))
                              }
                            />
                            <span className="text-[15px] text-gray-800 text-center">{option.nombre}</span>
                          </label>
                          <span
                            className={`text-[12px] font-medium ${
                              !isSelected || stockActual == null
                                ? 'text-gray-500'
                                : tieneStock
                                  ? 'text-emerald-600'
                                  : 'text-red-600'
                            }`}
                          >
                            {stockActual == null
                              ? 'Stock: N/D'
                              : tieneStock
                                ? `Stock: ${stockActual.toFixed(3)} (requiere ${requerido.toFixed(3)})`
                                : `Sin stock suficiente (requiere ${requerido.toFixed(3)}, hay ${stockActual.toFixed(3)})`}
                          </span>
                          {isRequired && (
                            <span className="text-[12px] text-emerald-600 font-medium">Requerido</span>
                          )}
                          {!isRequired && option.variantId && (
                            <span className="text-[12px] text-gray-500">Solo en variante</span>
                          )}
                        </div>

                        {!checked && <div className="pointer-events-none absolute inset-0 rounded-2xl bg-rose-100/30" />}
                      </label>
                    );
                  })}
                  {ingredientOptions.length === 0 && (
                    <div className="col-span-full text-[15px] text-gray-500">
                      Este producto no tiene ingredientes configurables.
                    </div>
                  )}
                </div>

                {/* Cantidad */}
                <div>
                  <div className="text-[15px] text-gray-600 mb-2">Cantidad</div>
                  <div className="inline-flex items-center rounded-xl border border-gray-200 overflow-hidden">
                    <button
                      onClick={() => setCustomQty((q) => Math.max(1, q - 1))}
                      className="h-11 w-11 grid place-content-center text-gray-700 hover:bg-gray-50"
                      aria-label="Disminuir"
                    >
                      –
                    </button>
                    <div className="px-5 select-none text-base">{customQty}</div>
                    <button
                      onClick={() => setCustomQty((q) => q + 1)}
                      className="h-11 w-11 grid place-content-center text-gray-700 hover:bg-gray-50"
                      aria-label="Aumentar"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Acciones */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => setOpenCustom(false)}
                    className="h-12 rounded-lg bg-gray-100 text-gray-700 font-semibold text-base hover:bg-gray-200"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmCustomizer}
                    className="h-12 rounded-lg bg-emerald-600 text-white font-semibold text-base hover:bg-emerald-700"
                  >
                    {editTarget ? 'Guardar cambios' : 'Añadir al carrito'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">Selecciona un producto para personalizar.</div>
            )}
          </DrawerRight>

          {/* Modal: crear/editar categoría */}
          <CategoriaModal
            isOpen={categoriaModal.isOpen}
            onClose={handleCloseCategoriaModal}
            onSave={handleSaveCategoria}
            categoria={categoriaModal.categoria}
            mode={categoriaModal.mode}
          />

          {/* Modal: confirmar eliminación de producto del carrito */}
          {deleteConfirmModal.isOpen && deleteConfirmModal.itemToDelete && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6"
              >
                <div className="text-center">
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                    <Trash2 className="h-6 w-6 text-red-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    ¿Eliminar producto?
                  </h3>
                  <p className="text-sm text-gray-600 mb-6">
                    ¿Estás seguro de que quieres eliminar <strong>{deleteConfirmModal.itemToDelete.producto.nombre_producto}</strong> del carrito?
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={cancelRemoveItem}
                      className="flex-1 h-10 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 uppercase flex items-center justify-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      CANCELAR
                    </button>
                    <button
                      onClick={confirmRemoveItem}
                      className="flex-1 h-10 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 uppercase flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      ELIMINAR
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* Modal: agregar/seleccionar cliente (ACTUALIZADO) */}
          {openCliente && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/40" onClick={() => setOpenCliente(false)} />
              <div className="relative w-full max-w-[720px] bg-white rounded-2xl shadow-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-2xl font-bold text-gray-800">
                    {clientModo === 'registrados' ? 'Clientes registrados' :
                     clientModo === 'editar' ? 'Editar cliente' : 'Agregar cliente'}
                  </h3>
                  <button onClick={() => setOpenCliente(false)} className="p-2 rounded-lg hover:bg-gray-100">✕</button>
                </div>

                {/* Selector de modo */}
                <div className="grid sm:grid-cols-[1fr_220px] gap-3 mb-4">
                  <div className="text-xl text-gray-600 self-center">
                    Elige si deseas seleccionar un cliente existente o registrar uno nuevo.
                  </div>
                  <div>
                    <label className="block text-xl font-semibold text-gray-600 mb-1">Modo</label>
                    <select
                      value={clientModo}
                      onChange={(e) => setClientModo(e.target.value as 'registrados' | 'nuevo')}
                      className="w-full h-11 rounded-lg border border-gray-200 px-3 text-xl focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    >
                      <option value="registrados">Clientes Registrados</option>
                      <option value="nuevo">Agregar Cliente</option>
                    </select>
                  </div>
                </div>

                {clientModo === 'registrados' ? (
                  <>
                    <div className="mb-3">
                      <label className="block text-xl font-semibold text-gray-600 mb-1">Buscar</label>
                      <input
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        placeholder="Buscar por nombre, teléfono o NIT…"
                        className="w-full h-11 rounded-lg border border-gray-200 px-3 text-xl focus:outline-none focus:ring-2 focus:ring-emerald-300"
                      />
                    </div>

                    <div className="max-h-64 overflow-auto rounded-lg border border-gray-200">
                      {filteredClients.length ? (
                        <ul className="divide-y text-sm">
                          {filteredClients.map((c) => (
                            <li key={c.id_cliente} className="relative">
                              <div className="flex items-center gap-3 p-3">
                                <label className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 rounded-lg p-2 -m-2 flex-1">
                                  <input
                                    type="radio"
                                    name="clienteReg"
                                    checked={clienteSeleccionado?.id_cliente === c.id_cliente}
                                    onChange={() => setClienteSeleccionado(c)}
                                    className="accent-emerald-600"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xl text-gray-800 truncate">
                                      {c.nombre} {c.telefono ? `· ${c.telefono}` : ''}
                                    </div>
                                    <div className="text-xl text-gray-500">
                                      {c.direccion || 'NIT: —'}
                                    </div>
                                    <div className="text-sm text-emerald-600 font-medium mt-1">
                                      {c.puntos_acumulados > 0 ? (
                                        `⭐ ${c.puntos_acumulados} puntos acumulados`
                                      ) : (
                                        `🌱 Sin compras realizadas aún`
                                      )}
                                    </div>
                                  </div>
                                </label>
                                {/* Botones de acción */}
                                <div className="flex gap-2 ml-2">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditarCliente(c);
                                    }}
                                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                    title="Editar cliente"
                                  >
                                    📝
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEliminarCliente(c);
                                    }}
                                    className="p-2 text-gray-600 hover:bg-red-100 rounded-lg transition-colors"
                                    title="Eliminar cliente"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="p-6 text-center text-sm text-gray-500">
                          No hay clientes registrados.
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end gap-2 mt-4">
                      <button
                        type="button"
                        onClick={() => setOpenCliente(false)}
                        className="h-10 rounded-lg border px-4 text-xl font-semibold hover:bg-gray-50"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={!clienteSeleccionado}
                        onClick={() => {
                          if (!clienteSeleccionado) return;
                          setClienteSeleccionado(clienteSeleccionado);
                          setOpenCliente(false);
                        }}
                        className="h-10 rounded-lg bg-emerald-600 text-white px-4 text-xl font-semibold hover:bg-emerald-700 disabled:opacity-60"
                      >
                        Seleccionar
                      </button>
                    </div>
                  </>
                ) : clientModo === 'editar' ? (
                  <form onSubmit={handleActualizarCliente} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xl font-medium text-gray-700 mb-1">Nombre</label>
                        <input
                          name="nombre"
                          defaultValue={clienteEditando?.nombre || ''}
                          required
                          className="w-full h-11 rounded-lg border border-gray-200 px-3 text-xl focus:outline-none focus:ring-2 focus:ring-blue-300"
                        />
                      </div>
                      <div>
                        <label className="block text-xl font-medium text-gray-700 mb-1">Teléfono</label>
                        <input
                          name="telefono"
                          type="tel"
                          defaultValue={clienteEditando?.telefono || ''}
                          className="w-full h-11 rounded-lg border border-gray-200 px-3 text-xl focus:outline-none focus:ring-2 focus:ring-blue-300"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xl font-medium text-gray-700 mb-1">Tipo</label>
                        <select
                          value={nitMode}
                          onChange={(e) => setNitMode(e.target.value as 'CF' | 'NIT')}
                          className="w-full h-11 rounded-lg border border-gray-200 px-3 text-xl focus:outline-none focus:ring-2 focus:ring-blue-300"
                        >
                          <option value="CF">Consumidor Final (CF)</option>
                          <option value="NIT">NIT</option>
                        </select>
                      </div>
                      {nitMode === 'NIT' && (
                        <div>
                          <label className="block text-xl font-medium text-gray-700 mb-1">NIT</label>
                          <input
                            value={nitValue}
                            onChange={(e) => setNitValue(e.target.value)}
                            placeholder="Ingresa el NIT"
                            className="w-full h-11 rounded-lg border border-gray-200 px-3 text-xl focus:outline-none focus:ring-2 focus:ring-blue-300"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end gap-2 mt-6">
                      <button
                        type="button"
                        onClick={() => {
                          setClientModo('registrados');
                          setClienteEditando(null);
                        }}
                        className="h-10 rounded-lg border px-4 text-xl font-semibold hover:bg-gray-50"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="h-10 rounded-lg bg-blue-600 text-white px-4 text-xl font-semibold hover:bg-blue-700"
                      >
                        Actualizar Cliente
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleGuardarCliente} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xl font-medium text-gray-700 mb-1">Nombre</label>
                        <input
                          name="nombre"
                          defaultValue=""
                          className="w-full h-11 rounded-lg border border-gray-200 bg-white px-3 text-s outline-none focus:ring-2 focus:ring-emerald-200"
                        />
                      </div>
                      <div>
                        <label className="block text-xl font-medium text-gray-700 mb-1">Teléfono</label>
                        <input
                          name="telefono"
                          defaultValue=""
                          className="w-full h-11 rounded-lg border border-gray-200 bg-white px-3 text-s outline-none focus:ring-2 focus:ring-emerald-200"
                        />
                      </div>
                    </div>

                    {/* --- NIT: selector CF / NIT --- */}
                    <div>
                      <label className="block text-xl font-medium text-gray-700 mb-2">NIT</label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => { setNitMode('CF'); setNitValue(''); }}
                          className={`h-11 px-4 rounded-lg border text-lg font-semibold transition ${
                            nitMode === 'CF'
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          C.F
                        </button>
                        <button
                          type="button"
                          onClick={() => setNitMode('NIT')}
                          className={`h-11 px-4 rounded-lg border text-lg font-semibold transition ${
                            nitMode === 'NIT'
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          NIT
                        </button>
                      </div>

                      {nitMode === 'NIT' && (
                        <input
                          value={nitValue}
                          onChange={(e) => setNitValue(e.target.value)}
                          placeholder="Ej. 1234567-8"
                          className="mt-3 w-full h-11 rounded-lg border border-gray-200 bg-white px-3 text-s outline-none focus:ring-2 focus:ring-emerald-200"
                        />
                      )}
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setOpenCliente(false)}
                        className="h-10 rounded-lg border px-4 text-xl font-semibold hover:bg-gray-50"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="h-10 rounded-lg bg-emerald-600 text-white px-4 text-xl font-semibold hover:bg-emerald-700"
                      >
                        Guardar
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal: confirmar eliminación de cliente */}
      {clienteAEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setClienteAEliminar(null)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
                <span className="text-3xl">⚠️</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Eliminar cliente
              </h3>
              <p className="text-gray-600 mb-6">
                ¿Estás seguro de que quieres eliminar al cliente <strong>"{clienteAEliminar.nombre}"</strong>?
                <br />
                <span className="text-sm text-red-600 font-medium">
                  Esta acción no se puede deshacer.
                </span>
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setClienteAEliminar(null)}
                  className="flex-1 h-11 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmarEliminarCliente}
                  className="flex-1 h-11 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contenedor de notificaciones */}
      <NotificationContainer
        notifications={notifications}
        onClose={removeNotification}
      />
    </div>
  );
};

export default Ventas;
