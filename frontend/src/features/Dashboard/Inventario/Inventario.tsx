import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './Inventario.css';
import { MdInventory2, MdAddShoppingCart, MdAssignmentTurnedIn } from 'react-icons/md';
import { motion, AnimatePresence } from 'framer-motion';
import Catalogo from './Catalogo';
import IngresoCompra from './IngresoCompra';
import Auditoria from './Auditoria';
import { dashboardService } from '../../../api/dashboardService';
import { localStore } from '../../../utils/storage';

const primary = '#00B074';
const mid = '#346C60';
const dark = '#12443D';
const yellow = '#FFD40D';

const hexToRgba = (hex: string, alpha = 0.12) => {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const InvActionCard: React.FC<{ title: string; subtitle?: string; icon: React.ReactNode; tone: string; onClick?: () => void; active?: boolean }> = ({ title, subtitle, icon, tone, onClick, active }) => {
  const bg = hexToRgba(tone, 0.10);
  const iconBg = tone;
  const baseClass = 'w-full flex items-center gap-5 rounded-xl px-6 py-5 min-h-[100px] group hover:shadow-lg transition-all duration-200 ease-in-out relative overflow-hidden';
  const activeClass = active ? 'inv-action-active' : '';
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      type="button"
      onClick={onClick}
      aria-label={title}
      style={{ background: bg }}
      className={`${baseClass} ${activeClass}`}
    >
      <div className="absolute right-0 top-0 w-28 h-28 -translate-y-12 translate-x-12 rounded-full transition-transform group-hover:scale-110 duration-300 opacity-10" style={{ background: iconBg }} />
      <div className="relative">
        <div className="absolute inset-0 rounded-xl opacity-20" style={{ background: iconBg }} />
        <div style={{ background: iconBg }} className="relative flex items-center justify-center w-14 h-14 rounded-xl text-white shadow-lg transform transition-transform group-hover:scale-105 z-10">
          {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement, { className: 'text-white transition-transform group-hover:scale-110', size: 22 }) : icon}
        </div>
      </div>
      <div className="flex flex-col text-left z-10">
        <span className="text-lg font-semibold text-gray-800 mb-1">{title}</span>
        {subtitle && <span className="text-sm text-gray-500 group-hover:text-gray-600 transition-colors">{subtitle}</span>}
      </div>
    </motion.button>
  );
};

// Los datos ahora se cargan desde Supabase. Mantener tipos mínimos para el front.
type InventoryItem = { id?: number; name: string; qty?: string; cantidad_actual?: number; note?: string; tipo_insumo?: string };

type Tab = 'overview'|'catalogo'|'ingreso'|'auditoria';

const Inventario: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Obtener la pestaña inicial desde la URL (query param 'tab')
  const getInitialTab = useCallback((): Tab => {
    const urlParams = new URLSearchParams(location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam && ['overview', 'catalogo', 'ingreso', 'auditoria'].includes(tabParam)) {
      return tabParam as Tab;
    }
    return 'overview';
  }, [location.search]);

  const [activeTab, setActiveTab] = useState<Tab>(getInitialTab);

  // Función para cambiar pestaña y actualizar URL
  const changeTab = (newTab: Tab, filter?: string) => {
    setActiveTab(newTab);
    let newUrl = newTab === 'overview' 
      ? '/inventario' 
      : `/inventario?tab=${newTab}`;
    if (filter) {
      newUrl += `&filter=${filter}`;
    }
    navigate(newUrl, { replace: true });
  };

  // Sincronizar estado cuando cambia la URL (por ejemplo, al usar botón atrás/adelante del navegador)
  useEffect(() => {
    const currentTab = getInitialTab();
    if (currentTab !== activeTab) {
      setActiveTab(currentTab);
    }
  }, [getInitialTab, activeTab]);

  // Estado dinámico para reemplazar los arrays estáticos
  const [perpetualData, setPerpetualData] = useState<InventoryItem[]>([]);
  const [operationalData, setOperationalData] = useState<InventoryItem[]>([]);
  const [totalPerpetualStock, setTotalPerpetualStock] = useState(0);
  const [totalOperationalStock, setTotalOperationalStock] = useState(0);
  const [totalPerpetualItems, setTotalPerpetualItems] = useState(0);
  const [totalOperationalItems, setTotalOperationalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [qPerpetual, setQPerpetual] = useState<string>('');
  const [qOperational, setQOperational] = useState<string>('');
  const [auditoriasPendientes, setAuditoriasPendientes] = useState<number>(0);

  // Cargar auditorías pendientes
  useEffect(() => {
    const fetchAuditoriasPendientes = async () => {
      try {
        // Primero verificar localStorage optimizado como respaldo rápido
        const auditoriaActiva = localStore.get('auditoria_activa');
        const auditoriaEstado = localStore.get('auditoria_estado');
        
        // Si hay auditoría activa en localStorage optimizado y está en progreso, mostrar 1
        if (auditoriaActiva && auditoriaEstado === 'en_progreso') {
          setAuditoriasPendientes(1);
          console.log('Inventario: Auditoría activa en localStorage optimizado');
        }
        
        // Luego intentar obtener del backend
        const token = localStore.get('access_token');
        if (!token) {
          console.log('Inventario: No hay token para auditorías pendientes');
          return;
        }

        console.log('Inventario: Fetching auditorías pendientes...');
        const response = await fetch('http://localhost:3002/api/auditoria/pendientes/count', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        console.log('Inventario: Response status:', response.status);
        if (response.ok) {
          const data = await response.json();
          console.log('Inventario: Auditorías pendientes:', data.count);
          setAuditoriasPendientes(data.count || 0);
        } else {
          console.error('Inventario: Error response:', response.status, await response.text());
          // Si falla el backend, usar localStorage como fallback
          if (auditoriaActiva && auditoriaEstado === 'en_progreso') {
            setAuditoriasPendientes(1);
          }
        }
      } catch (error) {
        console.error('Error cargando auditorías pendientes:', error);
        // Si hay error de red, usar localStorage optimizado como fallback
        const auditoriaActiva = localStore.get('auditoria_activa');
        const auditoriaEstado = localStore.get('auditoria_estado');
        if (auditoriaActiva && auditoriaEstado === 'en_progreso') {
          setAuditoriasPendientes(1);
        }
      }
    };

    fetchAuditoriasPendientes();
    
    // Actualizar cada 5 segundos (reducido para mayor responsividad)
    const interval = setInterval(fetchAuditoriasPendientes, 5000);
    
    // Escuchar cambios en localStorage optimizado directamente
    const handleStorageChange = () => {
      const auditoriaActiva = localStore.get('auditoria_activa');
      const auditoriaEstado = localStore.get('auditoria_estado');
      if (auditoriaActiva && auditoriaEstado === 'en_progreso') {
        setAuditoriasPendientes(1);
      } else {
        setAuditoriasPendientes(0);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    
    // Escuchar eventos de cambios en auditorías
    const handleAuditoriaChange = () => {
      fetchAuditoriasPendientes();
    };
    window.addEventListener('auditoria-changed', handleAuditoriaChange);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auditoria-changed', handleAuditoriaChange);
    };
  }, []);

  

  // Carga inicial desde la base de datos (función reutilizable para reintento)
  const load = async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const data = await dashboardService.getInventoryData();
      setPerpetualData(data.perpetual);
      setOperationalData(data.operational);
      setTotalPerpetualStock(data.totalPerpetualStock);
      setTotalOperationalStock(data.totalOperationalStock);
      setTotalPerpetualItems(data.totalPerpetualItems);
      setTotalOperationalItems(data.totalOperationalItems);
    } catch (e) {
      console.error('Error cargando datos de inventario:', e);
      setFetchError(String(e));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // No usar valores por defecto. Los arrays provienen exclusivamente de la BD.
  const perpetual = perpetualData;
  const operational = operationalData;

  const filteredPerpetual = perpetual
    .filter(it => !qPerpetual || it.name.toLowerCase().includes(qPerpetual.toLowerCase()))
    .sort((a, b) => (a.id || 0) - (b.id || 0));

  const filteredOperational = operational
    .filter(it => !qOperational || it.name.toLowerCase().includes(qOperational.toLowerCase()))
    .sort((a, b) => (a.id || 0) - (b.id || 0));

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {fetchError && (
        <div className="max-w-6xl mx-auto mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-800 flex items-center justify-between">
          <div>
            <strong>Error cargando datos:</strong> {fetchError}
          </div>
          <div>
            <button onClick={() => load()} className="btn primary">Reintentar</button>
          </div>
        </div>
      )}
  {isLoading && <div className="max-w-6xl mx-auto mb-4 text-sm text-gray-500">Cargando datos de inventario...</div>}
      <div className="inv-container">
        {activeTab === 'overview' && (
          <header className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800">MÓDULO DE INVENTARIO</h2>
            <p className="text-sm text-gray-500 mt-1">Control de insumos, inventario operativo y alertas</p>
          </header>
        )}

        {/* Actions Cards (adaptado de Usuarios) - ocultas cuando se entra a un apartado */}
        {activeTab === 'overview' ? (
          <div className="w-full mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full">
              <InvActionCard title="CATÁLOGO DE INSUMOS" subtitle="Ver y administrar insumos" icon={<MdInventory2 />} tone={primary} onClick={() => navigate('/inventario/catalogo')} active={false} />   
              <InvActionCard title="INGRESO COMPRA" subtitle="Registrar nueva entrada" icon={<MdAddShoppingCart />} tone={mid} onClick={() => navigate('/inventario/ingreso-compra')} active={false} />
              <InvActionCard title="AUDITORÍA DE INVENTARIO" subtitle="Revisión y auditorías" icon={<MdAssignmentTurnedIn />} tone={yellow} onClick={() => changeTab('auditoria')} active={activeTab === ('auditoria' as Tab)} />
            </div>
          </div>
        ) : (
          <div className="mb-4">
            <button onClick={() => changeTab('overview')} className="px-3 py-2 rounded-md border bg-white hover:bg-gray-50">← Regresar</button>
          </div>
        )}
            {/* Contenido por pestaña */}
            <AnimatePresence mode="wait">
              {activeTab === 'overview' && (
                <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
                  {/* Summary cards */}
                  <div className="inv-overview">
                    <div className="inv-card">
                      <h3>Stock Perpetuo Total</h3>
                      <div className="number">{Math.round(Number(totalPerpetualStock))}</div>
                      <div className="text-xs text-gray-500">{totalPerpetualItems} productos</div>
                    </div>

                    <div className="inv-card">
                      <h3>Stock Operativo Total</h3>
                      <div className="number">{Math.round(Number(totalOperationalStock))}</div>
                      <div className="text-xs text-gray-500">{totalOperationalItems} productos</div>
                    </div>

                    {/* Alertas removidas: tarjeta eliminada para evitar referencias a estado inexistente */}

                    <div className="inv-card">
                      <h3>Auditorías Pendientes</h3>
                      <div className="number">{auditoriasPendientes}</div>
                    </div>
                  </div>

                  {/* Inventories */}
                  <div className="inv-grid">
                    <div className="inv-list">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h4>Inventario Perpetuo</h4>
                        <button className="see-all" onClick={() => navigate('/inventario/catalogo?filter=perpetuos')}>Ver todos</button>
                      </div>
                      <div className="mb-2">
                        <input
                          placeholder="Buscar productos..."
                          value={qPerpetual}
                          onChange={(e) => setQPerpetual(e.target.value)}
                          className="w-full h-8 rounded-md border border-gray-200 bg-white pl-3 pr-3 text-sm"
                        />
                      </div>
                      <table className="inv-table">
                        <thead>
                          <tr>
                            <th>ID</th>
                            <th>Nombre</th>
                            <th>Tipo</th>
                            <th>Cantidad Actual</th>
                            <th>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredPerpetual.length ? filteredPerpetual.map((it) => (
                            <tr key={String(it.id ?? it.name)}>
                              <td>{it.id}</td>
                              <td>{it.name}</td>
                              <td>{it.tipo_insumo}</td>
                              <td>{it.cantidad_actual ?? '-'}</td>
                              <td style={{ color: it.note === 'OK' ? mid : it.note === 'Stock Bajo' ? yellow : dark }}>{it.note}</td>
                            </tr>
                          )) : (
                            <tr><td colSpan={5} className="text-sm text-gray-500">No hay productos perpetuos registrados.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="inv-list">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h4>Inventario Operativo</h4>
                        <button className="see-all" onClick={() => navigate('/inventario/catalogo?filter=operativos')}>Ver todos</button>
                      </div>
                      <div className="mb-2">
                        <input
                          placeholder="Buscar productos..."
                          value={qOperational}
                          onChange={(e) => setQOperational(e.target.value)}
                          className="w-full h-8 rounded-md border border-gray-200 bg-white pl-3 pr-3 text-sm"
                        />
                      </div>
                      <table className="inv-table">
                        <thead>
                          <tr>
                            <th>ID</th>
                            <th>Nombre</th>
                            <th>Tipo</th>
                            <th>Cantidad Actual</th>
                            <th>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredOperational.length ? filteredOperational.map((it) => (
                            <tr key={String(it.id ?? it.name)}>
                              <td>{it.id}</td>
                              <td>{it.name}</td>
                              <td>{it.tipo_insumo}</td>
                              <td>{it.cantidad_actual ?? '-'}</td>
                              <td style={{ color: it.note === 'OK' ? mid : it.note === 'Vencido' ? '#ff5c5c' : yellow }}>{it.note}</td>
                            </tr>
                          )) : (
                            <tr><td colSpan={5} className="text-sm text-gray-500">No hay productos operativos registrados.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Alerts removed */}

                  {/* Footer actions eliminados por solicitud */}
                </motion.div>
              )}

              {activeTab === 'catalogo' && (
                <motion.div key="catalogo" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.18 }}>
                  <Catalogo />
                </motion.div>
              )}

              {activeTab === 'ingreso' && (
                <motion.div key="ingreso" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.18 }}>
                  <IngresoCompra />
                </motion.div>
              )}

              {activeTab === 'auditoria' && (
                <motion.div key="auditoria" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.18 }}>
                  <Auditoria />
                </motion.div>
              )}
            </AnimatePresence>
      </div>
    </div>
  );
};

export default Inventario;