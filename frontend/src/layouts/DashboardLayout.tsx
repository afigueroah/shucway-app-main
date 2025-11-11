import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import avatarImg from "../assets/imgs/login.png";
import { CgLogOut } from "react-icons/cg";
import { MdHome, MdInventory, MdSettings, MdOutlineAssessment, MdAdminPanelSettings, MdShoppingCart, MdLockOpen, MdBackup, MdError, MdWarning, MdCancel, MdLock, MdPerson, MdHelp } from "react-icons/md";
import { FiBell } from "react-icons/fi";
import { handleLogout } from "../api/handleLogout";
import { useNavigate, useLocation } from "react-router-dom";
import { localStore } from "../utils/storage";
import { UsuarioDataType } from "../types";
import { MenuItemGuard } from "../components/guards/ModuleGuard";
import { dashboardService } from "../api/dashboardService";
import { useAlerts } from "../hooks/useAlerts";
import { usePermissions } from "../hooks/usePermissions";
import { useStockMonitoring } from "../hooks/useStockMonitoring";
import { cajaService, type CajaSesion as CajaSesionApi } from "../api/cajaService";
import { ventasService } from "../api/ventasService";
import { getProfile } from "../api/authService";

// usar el logo público (public/img/logo.png)
const publicLogo = "/img/logo.png";

interface NotificationItem {
  id: string;
  message: string;
  icon: React.ReactNode;
  module: string;
  action: () => void;
}

interface AlertData {
  id?: string;
  type: 'warning' | 'info' | 'error';
  message: string;
  module: string;
  timestamp: string;
}

const sidebarItems = [
  { name: "Inicio", icon: <MdHome size={18} />, route: "/dashboard", module: "DASHBOARD" },
  { name: "Ventas", icon: <MdShoppingCart size={18} />, route: "/ventas", module: "VENTAS" },
  { name: "Inventario", icon: <MdInventory size={18} />, route: "/inventario", module: "INVENTARIO" },
  { name: "Reportes", icon: <MdOutlineAssessment size={18} />, route: "/reportes", module: "REPORTES" },
  { name: "Administración", icon: <MdAdminPanelSettings size={18} />, route: "/administracion", module: "USUARIOS" },
  { name: "Configuración", icon: <MdSettings size={18} />, route: "/configuracion", module: "CONFIGURACION" },
];

const sidebarSections = [
  { title: "General", items: [sidebarItems[0], sidebarItems[1]] },
  { title: "Operaciones", items: [sidebarItems[2], sidebarItems[3], sidebarItems[4]] },
  { title: "Ajustes", items: [sidebarItems[5]] },
];

// colores provistos por el cliente
const ICON_HEX: Record<string, string> = {
  Inicio: "#346C60",
  Ventas: "#00A149",
  Inventario: "#12443D",
  Reportes: "#FFC222",
  Administración: "#346C60",
  Configuración: "#12443D",
};

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  // ... existing code ...
  const { alerts: localAlerts } = useAlerts();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);
  // Notifications and alerts states
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [alerts, setAlerts] = useState<NotificationItem[]>([]);
  const alertsRef = useRef<HTMLDivElement | null>(null);
  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<number | null>(null);
  const { isModuleAllowed } = usePermissions();

  useEffect(() => {
    // Obtener el usuario del localStorage y API (similar a Perfil.tsx)
    const fetchUser = async () => {
      try {
        // Primero intentar obtener del localStorage optimizado
        let userData: UsuarioDataType | null = localStore.get('user') as UsuarioDataType | null;

        // Intentar obtener perfil actualizado de la API (similar a Perfil.tsx)
        try {
          const profile = await getProfile();
          userData = profile;

          // Actualizar localStorage optimizado con la información más reciente
          localStore.set('user', profile, { expires: 60 * 24 * 7 }); // 7 días
        } catch (apiError) {
          console.warn('No se pudo obtener perfil de API, usando localStorage:', apiError);
          // Si falla la API, usar lo que hay en localStorage
        }

        if (!userData) {
          setUserName(null);
          setAvatarUrl(null);
          return;
        }

        // Mostrar solo el primer nombre del usuario
        const nameToUse = userData.primer_nombre || userData.username || userData.nombre || userData.email?.split('@')[0] || 'Usuario';

        setUserName(nameToUse);
        setAvatarUrl(userData.avatar_url || null);
      } catch (error) {
        console.error('Error al cargar usuario:', error);
        setUserName('Usuario');
        setAvatarUrl(null);
      }
    };

    fetchUser();

    // Listener para cambios en localStorage (útil para múltiples pestañas)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'user') {
        fetchUser();
      }
    };

    // Listener personalizado para actualizaciones del usuario en la misma aplicación
    const handleUserUpdate = () => {
      fetchUser();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('userProfileUpdated', handleUserUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('userProfileUpdated', handleUserUpdate);
    };
  }, []);

  const getInitials = (name?: string | null) => {
    if (!name) return null;
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return null;
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // sidebar label animations handled inline per-item

  // Cierra el menú de perfil al hacer click fuera
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
      if (alertsRef.current && !alertsRef.current.contains(e.target as Node)) {
        setAlertsOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Cierra el buscador al hacer click fuera
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Debounce simple para evitar filtrar en cada pulsación
  useEffect(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    // 200ms debounce — ligero y reactivo
    // store id as number (window.setTimeout returns number in browsers)
    debounceRef.current = window.setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 200) as unknown as number;

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  // removed theme toggle per request

  const handleAlertNavigation = useCallback((module: string) => {
    if (module === 'Inventario') navigate('/inventario');
    else if (module === 'Ventas') navigate('/ventas');
    else if (module === 'Configuración') navigate('/configuracion');
  }, [navigate]);

  useEffect(() => {
    const loadAlerts = async () => {
      try {
        const alertasData = await dashboardService.getAlertasRecientes();
        const notifs: NotificationItem[] = [];
        const alrts: NotificationItem[] = [];
        alertasData.forEach((alert: AlertData) => {
          const isInventoryWarning = alert.module?.toLowerCase() === 'inventario' && alert.type === 'warning';
          const item: NotificationItem = {
            id: alert.id || '',
            message: alert.message,
            icon: alert.type === 'error' ? <MdError size={16} /> : alert.type === 'warning' ? <MdWarning size={16} /> : <MdBackup size={16} />,
            module: alert.module,
            action: () => handleAlertNavigation(alert.module || '')
          };
          if (isInventoryWarning) {
            notifs.push(item);
            return;
          }

          if (alert.type === 'error' || alert.type === 'warning') {
            alrts.push(item);
          } else {
            notifs.push(item);
          }
        });
        const uniqueNotifications = Array.from(new Map(notifs.map((n) => [n.id, n])).values());
        setNotifications(uniqueNotifications);
        setAlerts(alrts);
      } catch (error) {
        console.error('Error loading alerts:', error);
        // Fallback to empty arrays
        setNotifications([]);
        setAlerts([]);
      }
    };
    loadAlerts();
  }, [handleAlertNavigation]);

  // 🔔 Activar monitoreo automático de stock
  useStockMonitoring(true);

  const currentRouteName = () => {
    const match = sidebarItems.find((s) => s.route === location.pathname);
    return match?.name || location.pathname.replace("/", "") || "Panel";
  };

  // Preparar una lista de sugerencias con sección y ruta para el buscador
  // Incluye los items del sidebar más rutas internas (lista ligera para evitar imports circulares)
  const extraRoutes: { name: string; route: string; section: string }[] = [
    { name: 'Dashboard', route: '/dashboard', section: 'General' },
    { name: 'Configuración', route: '/configuracion', section: 'Ajustes' },
    { name: 'Mantenimiento', route: '/configuracion/mantenimiento', section: 'Ajustes' },
    { name: 'Consultas SQL', route: '/configuracion/consultas-sql', section: 'Ajustes' },
    { name: 'Backup', route: '/configuracion/backup', section: 'Ajustes' },
    { name: 'Administración', route: '/administracion', section: 'General' },
    { name: 'Gestionar Roles', route: '/administracion/roles', section: 'General' },
    { name: 'Ventas', route: '/ventas', section: 'General' },
  { name: 'POS / Punto de Venta', route: '/ventas/ventas', section: 'Ventas' },
    { name: 'Producto (Ventas)', route: '/ventas/producto', section: 'Ventas' },
    { name: 'Cierre de Caja', route: '/ventas/cierre-caja', section: 'Ventas' },
    { name: 'Inventario', route: '/inventario', section: 'Operaciones' },
    { name: 'Categorías', route: '/inventario/categorias', section: 'Operaciones' },
    { name: 'Recepción de Mercadería', route: '/inventario/recepcion-mercaderia', section: 'Operaciones' },
    { name: 'Proveedores', route: '/proveedores', section: 'Operaciones' },
    { name: 'Órdenes de Compra', route: '/inventario?tab=ordenes', section: 'Operaciones' },
    { name: 'Auditoría de Inventario', route: '/inventario?tab=auditoria', section: 'Operaciones' },
    { name: 'Reportes', route: '/reportes', section: 'Operaciones' },
    { name: 'Perfil', route: '/perfil', section: 'General' },
    { name: 'Soporte', route: '/soporte', section: 'General' },
    { name: 'Login', route: '/login', section: 'Público' },
  ];

  const visibleSidebarSections = sidebarSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => isModuleAllowed(item.module)),
    }))
    .filter((section) => section.items.length > 0);

  const combined = [
    ...sidebarSections.flatMap((sec) => sec.items.map((it) => ({ name: it.name, route: it.route, section: sec.title })) ),
    ...extraRoutes,
  ];

  // Deduplicate by route (mantener la primera aparición)
  const searchableItems = Array.from(new Map(combined.map(item => [item.route, item])).values());

  // Búsqueda minimalista y eficiente: puntuamos coincidencias y ordenamos
  const fuzzyScore = (text: string, q: string) => {
    const t = text.toLowerCase();
    const qq = q.toLowerCase();
    if (!qq) return 0;
    if (t === qq) return 100;
    if (t.startsWith(qq)) return 80;
    if (t.includes(qq)) return 60;
    // subsequence match (letras en orden) — bajo coste
    let i = 0;
    for (const c of qq) {
      i = t.indexOf(c, i);
      if (i === -1) return 0;
      i++;
    }
    return 20; // small score for subsequence matches
  };

  const filteredSuggestions = debouncedQuery
    ? searchableItems
        .map((it) => {
          const nameScore = fuzzyScore(it.name, debouncedQuery);
          const routeScore = fuzzyScore(it.route, debouncedQuery);
          const score = Math.max(nameScore, routeScore);
          return { item: it, score };
        })
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map((s) => s.item)
    : [];

  const selectSuggestion = (item: { name: string; route: string }) => {
    navigate(item.route);
    setIsSearchOpen(false);
    setSearchQuery("");
    setHighlightedIndex(-1);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isSearchOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, filteredSuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredSuggestions.length) {
        selectSuggestion(filteredSuggestions[highlightedIndex]);
      } else if (filteredSuggestions.length === 1) {
        selectSuggestion(filteredSuggestions[0]);
      }
    } else if (e.key === 'Escape') {
      setIsSearchOpen(false);
      setHighlightedIndex(-1);
    }
  };

  // Componente local: AuditoriaQuick
  const AuditoriaQuick: React.FC = () => {
    const [auditoriaActiva, setAuditoriaActiva] = useState<string | null>(() => {
      try {
        return localStore.get('auditoria_activa') as string | null;
      } catch {
        return null;
      }
    });

    const [auditoriaLabel, setAuditoriaLabel] = useState<string>(() => {
      try {
        return (localStore.get('auditoria_label') as string) || 'Auditoría';
      } catch {
        return 'Auditoría';
      }
    });

    const [auditoriaFecha, setAuditoriaFecha] = useState<string>(() => {
      try {
        return (localStore.get('auditoria_fecha') as string) || '';
      } catch {
        return '';
      }
    });

    // Escuchar cambios en localStorage usando event listener en lugar de polling
    React.useEffect(() => {
      const handleStorageChange = (e: StorageEvent) => {
        if (e.key?.startsWith('auditoria_')) {
          const activa = localStore.get('auditoria_activa') as string | null;
          const label = (localStore.get('auditoria_label') as string) || 'Auditoría';
          const fecha = (localStore.get('auditoria_fecha') as string) || '';
          setAuditoriaActiva(activa);
          setAuditoriaLabel(label);
          setAuditoriaFecha(fecha);
        }
      };

      // Verificar estado inicial
      const activa = localStore.get('auditoria_activa') as string | null;
      const label = (localStore.get('auditoria_label') as string) || 'Auditoría';
      const fecha = (localStore.get('auditoria_fecha') as string) || '';
      setAuditoriaActiva(activa);
      setAuditoriaLabel(label);
      setAuditoriaFecha(fecha);

      window.addEventListener('storage', handleStorageChange);
      return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    const formatDateSpanish = (dateStr: string) => {
      try {
        if (!dateStr) return new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long' }).toUpperCase();
        const d = new Date(dateStr);
        return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'long' }).toUpperCase();
      } catch {
        return '';
      }
    };

    const handleClick = () => {
      // Deshabilitar temporalmente el interceptor
      (window as { auditoriaWidgetNavigating?: boolean }).auditoriaWidgetNavigating = true;
      navigate('/inventario?tab=auditoria');
      // Re-habilitar después de un breve delay
      setTimeout(() => {
        (window as { auditoriaWidgetNavigating?: boolean }).auditoriaWidgetNavigating = false;
      }, 100);
    };

    return (
      <div className="flex items-center justify-center w-full mt-2 auditoria-quick-widget">
        {collapsed ? (
          // Vista colapsada: solo icono
          <button
            onClick={handleClick}
            data-navigate="/inventario?tab=auditoria"
            className={`w-12 h-12 rounded-lg ${
              auditoriaActiva
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-green-900 hover:bg-slate-900'
            } flex items-center justify-center shadow-md transition-colors`}
            title={auditoriaActiva ? 'Continuar Auditoría' : 'Iniciar Auditoría'}
          >
            {auditoriaActiva ? (
              <MdLock size={24} className="text-white" />
            ) : (
              <MdInventory size={24} className="text-white" />
            )}
          </button>
        ) : (
          // Vista expandida: card completa
          <div className="w-full bg-gray-50 rounded-lg p-2 flex flex-col items-center shadow-md border border-gray-200">
            <div className="text-xs uppercase font-semibold text-gray-500 mb-1">
              {auditoriaActiva ? 'Auditoría en Curso' : 'Auditoría'}
            </div>
            <div className="text-lg font-semibold text-gray-700 text-center">
              {formatDateSpanish(auditoriaFecha)}
            </div>
            {auditoriaActiva && (
              <div className="text-sm text-gray-600 mt-1 text-center truncate w-full">{auditoriaLabel}</div>
            )}
            <div className="mt-2 w-full">
              <button
                onClick={handleClick}
                data-navigate="/inventario?tab=auditoria"
                className="w-full text-white px-3 py-2 rounded-full font-normal flex items-center justify-center gap-2 text-sm"
                style={auditoriaActiva 
                  ? { background: 'linear-gradient(135deg, #001f3f 0%, #003d7a 100%)' }
                  : { background: 'linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%)' }
                }
              >
                {auditoriaActiva ? (
                  <>
                    <MdLock size={16} />
                    Continuar
                  </>
                ) : (
                  <>
                    <MdInventory size={16} />
                    Iniciar
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const resolveCajaApiMessage = (error: unknown): string | undefined => {
    if (typeof error === 'object' && error !== null) {
      const maybeResponse = (error as { response?: { data?: { message?: string } } }).response;
      if (maybeResponse?.data?.message) {
        return maybeResponse.data.message;
      }
    }
    if (error instanceof Error) {
      return error.message;
    }
    return undefined;
  };

  // Componente local: CajaQuick (declarado antes del return para evitar errores TSX)
  const CajaQuick: React.FC = () => {
    const [sesion, setSesion] = useState<CajaSesionApi | null>(null);
    const [cajaLoading, setCajaLoading] = useState<boolean>(true);
    const [cajaError, setCajaError] = useState<string | null>(null);
    const [expirada, setExpirada] = useState<boolean>(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [countVentas, setCountVentas] = useState<number>(0);
    const [efectivoVentas, setEfectivoVentas] = useState<number>(0);
    const [transferenciaVentas, setTransferenciaVentas] = useState<number>(0);

    const loadEstado = useCallback(async () => {
      try {
        setCajaError(null);
        const estado = await cajaService.getEstado();
        if (estado.abierta && estado.sesion) {
          setSesion(estado.sesion);
          // Cargar total de ventas de la sesión
          try {
            const ventasResult = await ventasService.getTotalVentasSesion(estado.sesion.fecha_apertura);
            setCountVentas(ventasResult.count);
            setEfectivoVentas(ventasResult.efectivo);
            setTransferenciaVentas(ventasResult.transferencia);
          } catch (ventasError) {
            console.error('Error obteniendo total de ventas:', ventasError);
            setCountVentas(0);
            setEfectivoVentas(0);
            setTransferenciaVentas(0);
          }
        } else {
          setSesion(null);
          setCountVentas(0);
          setEfectivoVentas(0);
          setTransferenciaVentas(0);
        }
        setExpirada(Boolean(estado.expirada));
      } catch (error: unknown) {
        console.error('Error obteniendo estado de caja:', error);
        const message = resolveCajaApiMessage(error) ?? 'No se pudo obtener el estado de la caja.';
        setCajaError(message);
        setCountVentas(0);
        setEfectivoVentas(0);
        setTransferenciaVentas(0);
      } finally {
        setCajaLoading(false);
      }
    }, []);

    useEffect(() => {
      let mounted = true;

      const init = async () => {
        if (!mounted) return;
        setCajaLoading(true);
        await loadEstado();
      };

      init();

      const interval = window.setInterval(() => {
        loadEstado();
      }, 60000);

      return () => {
        mounted = false;
        window.clearInterval(interval);
      };
    }, [loadEstado]);

    // Removido: useEffect que refresca en cada cambio de ruta para evitar sobrecarga

    const openCaja = () => {
      setCajaError(null);
      navigate('/ventas/cierre-caja', { state: { requireOpenCaja: true } });
    };

    const cerrarCaja = async () => {
      try {
        setCajaLoading(true);
        setCajaError(null);
        await cajaService.cerrarCaja();
        setSesion(null);
        setShowConfirm(false);
        navigate('/ventas/cierre-caja');
      } catch (error: unknown) {
        console.error('Error al cerrar la caja:', error);
        const message = resolveCajaApiMessage(error) ?? 'No se pudo cerrar la caja.';
        setCajaError(message);
      } finally {
        setCajaLoading(false);
      }
    };

    const cajaOpen = !!sesion;

    return (
      <>
        <div className="flex items-center justify-center w-full mt-1 caja-quick-widget">
          {collapsed ? (
            // Vista colapsada: solo icono
            <button 
              onClick={cajaOpen ? () => setShowConfirm(true) : openCaja}
              disabled={cajaLoading}
              className={`w-12 h-12 rounded-lg ${cajaOpen ? 'bg-yellow-400 hover:bg-yellow-500' : 'bg-green-500 hover:bg-green-600'} flex items-center justify-center shadow-md transition-colors ${cajaLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
              title={cajaOpen ? 'Cerrar Caja' : 'Abrir Caja'}
            >
              <MdLockOpen size={24} className={cajaOpen ? 'text-gray-900' : 'text-white'} />
            </button>
          ) : (
            // Vista expandida: card completa
            <div className="w-full bg-gray-50 rounded-lg p-2 flex flex-col items-center shadow-md border border-gray-200">
              <div className="text-xs uppercase font-semibold text-gray-500 mb-1">
                {cajaOpen ? 'Caja Abierta' : expirada ? 'Caja Expirada' : 'Caja Cerrada'}
              </div>
              <div className="text-lg font-semibold text-gray-700 text-center">
                {cajaOpen ? (
                  <div>
                    <div>CAJA Q{efectivoVentas.toFixed(2)}</div>
                    <div>BANCO Q{transferenciaVentas.toFixed(2)}</div>
                  </div>
                ) : '—'}
              </div>
              {cajaOpen && (
                <div className="text-sm text-gray-600 text-center mt-1">
                  {countVentas} ventas
                </div>
              )}
              {cajaError && (
                <div className="text-xs text-red-600 mt-1 text-center">{cajaError}</div>
              )}
              {expirada && !cajaOpen && !cajaError && (
                <div className="text-xs text-amber-600 mt-1 text-center">La última sesión se cerró automáticamente por tiempo.</div>
              )}
              <div className="mt-2 w-full">
                {!cajaOpen ? (
                  <button onClick={openCaja} disabled={cajaLoading} className={`w-full bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-full font-normal flex items-center justify-center gap-2 text-sm ${cajaLoading ? 'opacity-70 cursor-not-allowed' : ''}`}>
                    <MdLockOpen size={16} />
                    Abrir Caja
                  </button>
                ) : (
                  <button onClick={() => setShowConfirm(true)} disabled={cajaLoading} className={`w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 px-3 py-2 rounded-full font-normal flex items-center justify-center gap-2 text-sm ${cajaLoading ? 'opacity-70 cursor-not-allowed' : ''}`}>
                    <MdLockOpen size={16} />
                    Cerrar Caja
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Confirmación modal al cerrar caja */}
        {showConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowConfirm(false)} />
            <div className="relative bg-white rounded-lg shadow-lg p-10 w-[32rem] max-w-2xl">
              <h3 className="text-xl font-semibold mb-4 text-center">Confirmar cierre</h3>
              <p className="text-lg text-gray-700 mb-8 leading-relaxed text-center">¿Estás seguro de que deseas cerrar la caja?<br />Se registrará el cierre y podrá revisarse en el módulo de ventas.</p>
              <div className="flex gap-4 justify-end">
                <button onClick={() => setShowConfirm(false)} disabled={cajaLoading} className={`px-6 py-3 rounded-md bg-gray-100 hover:bg-gray-200 font-bold text-xl flex items-center gap-2 ${cajaLoading ? 'opacity-70 cursor-not-allowed' : ''}`}>
                  <MdCancel size={24} />
                  Cancelar
                </button>
                <button onClick={cerrarCaja} disabled={cajaLoading} className={`px-6 py-3 rounded-md bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold text-xl flex items-center gap-2 ${cajaLoading ? 'opacity-70 cursor-not-allowed' : ''}`}>
                  <MdLock size={24} />
                  Cerrar caja
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden font-[Barrow,Segoe UI,Roboto,sans-serif]">
      {/* Overlay para móviles cuando el sidebar está abierto */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <motion.aside
        aria-label="Sidebar"
        initial={false}
        animate={{ 
          width: collapsed ? 80 : 224,
          x: mobileMenuOpen ? 0 : (typeof window !== 'undefined' && window.innerWidth < 768 ? -224 : 0)
        }}
        transition={{ type: 'spring', stiffness: 220, damping: 30 }}
        className={`z-50 fixed left-0 top-0 h-screen bg-white shadow-lg flex flex-col items-center py-3 sm:py-4 md:py-6 overflow-y-auto overflow-x-hidden md:relative`}
      >
        <div className={`flex items-center gap-3 px-2 sm:px-3 md:px-4 ${collapsed ? "justify-center" : "justify-center w-full"} mb-3 sm:mb-4 md:mb-6`}>
          <motion.button 
            whileTap={{ scale: 0.985 }} 
            whileHover={{ scale: 1.02 }} 
            transition={{ duration: 0.18 }} 
            onClick={() => {
              navigate('/dashboard');
              if (window.innerWidth < 768) {
                setMobileMenuOpen(false);
              }
            }} 
            data-navigate="/dashboard"
            aria-label="Ir al dashboard" 
            className={`flex items-center ${collapsed ? 'justify-center' : 'justify-center'} w-full bg-transparent p-0 rounded-md hover:bg-transparent focus:outline-none transition-colors`}
          > 
            <img src={publicLogo} alt="logo" className={`cursor-pointer ${collapsed ? "w-12 sm:w-14" : "w-36 sm:w-44"} transition-all duration-300`} />
          </motion.button>
        </div>
        <nav className="flex flex-col gap-3 sm:gap-4 w-full px-2 sm:px-3" role="navigation">
          {visibleSidebarSections.map((sec) => (
            <div key={sec.title}>
              {!collapsed && <div className="px-2 sm:px-3 text-xs uppercase text-gray-400 mb-1">{sec.title}</div>}
              <div className="flex flex-col gap-2">
                {sec.items.map((item) => {
                  const isActive = location.pathname === item.route;
                  return (
                    <MenuItemGuard key={item.name} moduleName={item.module}>
                      <Tippy
                        content={item.name}
                        disabled={!collapsed}
                        animation="scale"
                        placement="right"
                        delay={[80, 0]}
                        duration={[160, 80]}
                        hideOnClick={false}
                        interactive={false}
                        arrow={true}
                      >
                        <button
                          onClick={() => {
                            navigate(item.route);
                            if (window.innerWidth < 768) {
                              setMobileMenuOpen(false);
                            }
                          }}
                          data-navigate={item.route}
                          title={collapsed ? item.name : undefined}
                          className={`relative flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-3 rounded-lg text-base font-medium transition-all duration-150 w-full text-left hover:bg-gray-50 transform ${
                            isActive ? "bg-green-50 text-green-700 shadow-[inset_0_0_0_1px_rgba(34,197,94,0.06)]" : "text-gray-700"
                          }`}
                        >
                          {/* active indicator */}
                          <AnimatePresence>{isActive && (
                            <motion.span layoutId="active-indicator" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-green-500" />
                          )}</AnimatePresence>

                          <motion.div whileHover={{ scale: 1.06 }} transition={{ type: "spring", stiffness: 300 }} className={`flex items-center justify-center ${collapsed ? 'w-12 h-12' : 'w-11 h-11'} rounded-lg shadow-sm`} style={{ background: ICON_HEX[item.name] || '#E5E7EB', color: '#fff' }}>
                            {item.icon}
                          </motion.div>
                          <AnimatePresence initial={false} mode="wait">
                            {!collapsed && (
                              <motion.span key={item.name} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.18 }} className="ml-2">
                                {item.name}
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </button>
                      </Tippy>
                    </MenuItemGuard>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="flex-1" />
        {/* Caja rápida: abrir / cerrar caja y contador */}
        <div className="w-full px-3 mb-1">
          {/* estado de la caja almacenado en localStorage: 'caja:start' = timestamp */}
          {/* Mostrar botón Abrir Caja cuando cerrada; contador + Cerrar cuando abierta */}
          {/* Usa navigate a la ruta de cierre de caja para integrarse con el módulo de ventas */}
          <CajaQuick />
          
          {/* Auditoría rápida: iniciar o continuar auditoría */}
          <AuditoriaQuick />
        </div>

        <div className="w-full px-3 mb-6">
          {/* sidebar: perfil eliminado según solicitud */}

          <div className="mt-6 flex justify-center">
              {collapsed ? (
              <Tippy content="Cerrar sesión" placement="right" animation="scale" delay={[80,0]} duration={[160,80]} hideOnClick={false} interactive={false} arrow={true}>
                <button
                  onClick={handleLogout}
                  className="w-10 h-10 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded-md shadow-sm"
                  aria-label="Cerrar sesión"
                >
                  <CgLogOut size={18} />
                </button>
              </Tippy>
            ) : (
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-3 bg-red-500 hover:bg-red-600 text-white px-4 py-3 rounded-md shadow-sm text-base font-semibold"
              >
                <CgLogOut />
                <span>Cerrar sesión</span>
              </button>
            )}
          </div>
        </div>
  </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col bg-gradient-to-b from-white to-gray-50 w-full">
        {/* Header */}
  <header className="sticky top-0 z-30 bg-white backdrop-blur-sm w-full" style={{ boxShadow: '0 1px 0 rgba(16,24,40,0.04)' }}>
          <div className="w-full px-2 sm:px-3 md:px-4 py-2 sm:py-3 flex items-center gap-2 sm:gap-4">
            <div className="flex items-center w-auto sm:w-48">
              <button 
                onClick={() => {
                  if (window.innerWidth < 768) {
                    setMobileMenuOpen(!mobileMenuOpen);
                  } else {
                    setCollapsed(!collapsed);
                  }
                }} 
                className="p-2 rounded-md hover:bg-gray-100 transition-colors" 
                aria-label="toggle sidebar" 
                aria-expanded={window.innerWidth < 768 ? mobileMenuOpen : !collapsed}
              >
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
                </svg>
              </button>
              <div className="ml-3 hidden md:block">
                <div className="text-xs text-gray-500">Sección</div>
                <div className="font-semibold text-gray-800">{currentRouteName()}</div>
              </div>
            </div>

            {/* Centered search */}
            <div className="flex-1 justify-center hidden sm:flex">
              <div className="w-full max-w-2xl">
                <div className="relative" ref={searchRef}>
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"></path>
                    </svg>
                  </span>
                  <input
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setIsSearchOpen(true); setHighlightedIndex(-1); }}
                    onFocus={() => setIsSearchOpen(true)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Busca aquí lo que te interese"
                    aria-label="Buscar"
                    className="w-full bg-gray-100 border border-transparent rounded-full py-2 pl-10 pr-4 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />

                  {/* Dropdown de sugerencias */}
                  {isSearchOpen && (
                    <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-100 rounded-md shadow-lg z-50 max-h-64 overflow-auto">
                      {filteredSuggestions.length > 0 ? (
                        <ul role="listbox" className="divide-y divide-gray-100">
                          {filteredSuggestions.map((s, idx) => (
                            <li
                              key={s.route}
                              role="option"
                              aria-selected={highlightedIndex === idx}
                              onMouseEnter={() => setHighlightedIndex(idx)}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => selectSuggestion(s)}
                              className={`px-4 py-3 cursor-pointer hover:bg-gray-50 ${highlightedIndex === idx ? 'bg-blue-50' : ''}`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="text-sm font-medium text-gray-800">{s.name}</div>
                                <div className="text-xs text-gray-400">{s.section}</div>
                              </div>
                              <div className="text-xs text-gray-500 truncate">{s.route}</div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="px-4 py-3 text-sm text-gray-500">No se encontraron resultados</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right: notifications + profile */}
            <div className="flex items-center gap-2 sm:gap-4 justify-end w-auto min-w-fit">
              <div className="relative" ref={alertsRef}>
                <button onClick={() => setAlertsOpen(!alertsOpen)} className="p-2 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors relative flex items-center justify-center" aria-label="notificaciones y alertas">
                  <FiBell size={18} className="text-green-600" />
                  <motion.span
                    key={notifications.length + alerts.length + localAlerts.length}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 20 }}
                    className="absolute -top-1 -right-1 bg-blue-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center"
                  >
                    {notifications.length + alerts.length + localAlerts.length}
                  </motion.span>
                </button>
                <AnimatePresence>
                  {alertsOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute right-0 mt-2 w-80 bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border-l-4 border-green-600 py-2 z-50 max-h-80 overflow-auto"
                    >
                      {(() => {
                        const allNotifications = [...notifications, ...alerts, ...localAlerts];
                        return allNotifications.length > 0 ? (
                          allNotifications.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => { item.action(); setAlertsOpen(false); }}
                              className="w-full text-left px-4 py-3 hover:bg-gray-100 rounded-2xl bg-white shadow-sm border border-gray-200 flex items-start gap-3 transition-colors mb-2"
                            >
                              <div className="flex-shrink-0 mt-1 text-gray-600">
                                {item.icon}
                              </div>
                              <div className="flex-1">
                                <span className="text-xs text-gray-500 uppercase font-medium">{item.module}</span>
                                <span className="text-sm text-gray-700 block">{item.message}</span>
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-3 text-sm text-gray-500">No hay notificaciones</div>
                        );
                      })()}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="relative" ref={profileRef}>
                <button onClick={() => setProfileOpen((s) => !s)} className="flex items-center gap-3" aria-label="Abrir perfil">
                  <div className="relative">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="avatar" className="w-12 h-12 rounded-full border-2 border-white shadow-lg object-cover ring-0 hover:scale-105 transition-transform" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-700 border-2 border-white shadow-lg ring-0 hover:scale-105 transition-transform">
                        {getInitials(userName) || <img src={avatarImg} alt="avatar" className="w-10 h-10 rounded-full object-cover" />}
                      </div>
                    )}
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
                  </div>
                  <div className="hidden md:flex flex-col text-sm text-gray-700">
                    <span className="text-xs text-gray-500">Hola,</span>
                    <span className="font-semibold text-gray-800 truncate max-w-[200px]">{userName || "Usuario"}</span>
                  </div>
                </button>

                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-100 py-2 z-50">
                    <button onClick={() => { navigate('/perfil'); setProfileOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <MdPerson size={16} />
                      Mi perfil
                    </button>
                    <button onClick={() => { navigate('/soporte'); setProfileOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <MdHelp size={16} />
                      Soporte
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                    <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50 flex items-center gap-2">
                      <CgLogOut /> Cerrar sesión
                    </button>
                  </div>
                )}
              </div>

              {/* vertical separator */}
              <div className="h-8 w-px bg-gray-200 ml-3 hidden md:block" />
            </div>
          </div>
  </header>

  <div className="flex-1 p-2 bg-transparent w-full overflow-hidden min-h-0">
          <div className="animate-fade-in w-full h-full overflow-y-auto">{children}</div>
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
