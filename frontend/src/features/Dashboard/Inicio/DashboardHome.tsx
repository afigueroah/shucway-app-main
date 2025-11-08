import { useNavigate } from "react-router-dom";
import React, { useState } from "react";
import ventasImg from "/img/ventas.jpg";
import inventarioImg from "/img/inventario.jpg";
import adminImg from "/img/adm.jpg";
import reportesImg from "/img/reportes.jpg";
import configImg from "/img/config.jpg";
import soporteImg from "/img/download.jpeg";
import StatsCard from "../../../components/widgets/StatsCard";
import ChartWidget from "../../../components/widgets/ChartWidget";
import AlertWidget from "../../../components/widgets/AlertWidget";
import { FaShoppingCart, FaBoxes, FaUsers, FaMoneyBillWave } from 'react-icons/fa';

const modules = [
  {
    name: "Ventas",
    img: ventasImg,
    route: "/ventas",
    color: "from-blue-500 to-blue-300",
    description: "Gestión de ventas y pedidos"
  },
  {
    name: "Inventario",
    img: inventarioImg,
    route: "/inventario",
    color: "from-green-500 to-green-300",
    description: "Control de stock y productos"
  },
  {
    name: "Administración",
    img: adminImg,
    route: "/administracion",
    color: "from-purple-500 to-purple-300",
    description: "Gestión de usuarios y permisos"
  },
  {
    name: "Reportes",
    img: reportesImg,
    route: "/reportes",
    color: "from-yellow-500 to-yellow-300",
    description: "Estadísticas y análisis"
  },
  {
    name: "Soporte",
    img: soporteImg,
    route: "soporte1",
    color: "from-pink-400 to-pink-300",
    description: "Centro de ayuda y soporte"
  },
  {
    name: "Configuración",
    img: configImg,
    route: "/configuracion",
    color: "from-gray-500 to-gray-300",
    description: "Ajustes del sistema"
  },
];

const DashboardHome: React.FC = () => {
  const navigate = useNavigate();

  // Configuraciones locales (simuladas)
  const [enableNotifications, setEnableNotifications] = useState<boolean>(true);
  const [autoPrint, setAutoPrint] = useState<boolean>(false);
  const [showLowStockAlerts, setShowLowStockAlerts] = useState<boolean>(true);

  // Datos simulados para las estadísticas
  const statsData = {
    ventas: {
      total: "Q15,750",
      change: 12.5,
    },
    inventario: {
      total: "345",
      change: -5.2,
    },
    clientes: {
      total: "128",
      change: 8.3,
    },
    ganancias: {
      total: "Q4,280",
      change: 15.7,
    }
  };

  // Datos simulados para el gráfico
  const chartData = {
    labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
    datasets: [
      {
        label: 'Ventas Diarias',
        data: [2100, 1850, 2300, 2800, 2450, 3100, 2900],
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
      }
    ],
  };

  // Alertas simuladas
  const alertas = [
    {
      id: 1,
      message: 'Stock bajo en Panes para Shuco (5 unidades restantes)',
      type: 'warning' as const,
      timestamp: '2025-10-18 10:30'
    },
    {
      id: 2,
      message: 'Venta alta detectada: Q5,000 en la última hora',
      type: 'info' as const,
      timestamp: '2025-10-18 10:15'
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 p-6">
      {/* Encabezado */}
      <header className="w-full mb-12">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">Panel Principal</h1>
        <p className="text-sm md:text-base text-gray-600">Accesos rápidos y estado general del sistema</p>
      </header>

      {/* Módulos */}
      <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-6 mb-10 w-full max-w-6xl mx-auto">
        {modules.map((mod) => (
          <div
            key={mod.name}
            role="button"
            tabIndex={0}
            onClick={() => (mod.route ? navigate(mod.route) : null)}
            onKeyDown={(e) => (e.key === "Enter" && mod.route ? navigate(mod.route) : null)}
            className={`relative rounded-2xl shadow-md cursor-pointer group overflow-hidden h-56 w-full max-w-md flex items-end bg-gradient-to-tr ${mod.color} transition duration-300 transform hover:-translate-y-0.5`}
          >
            <img
              src={mod.img}
              alt={mod.name}
              className="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:opacity-60 transition duration-300"
            />
            <div className="relative z-10 p-5 w-full flex flex-col items-start">
              <h3 className="text-2xl md:text-3xl font-semibold text-white mb-1 drop-shadow-lg">
                {mod.name}
              </h3>
              <p className="text-white/95 text-sm mb-0 line-clamp-2">
                {mod.description}
              </p>
              {mod.name === "Administración" && (
                <span className="inline-block bg-white/90 text-gray-700 px-3 py-1 rounded-full text-sm font-medium mt-2">
                  Gestión de usuarios
                </span>
              )}
            </div>
          </div>
        ))}
      </section>

      {/* Dashboard Widgets */}
      <div className="space-y-8">
        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title="Ventas Totales"
            value={statsData.ventas.total}
            change={statsData.ventas.change}
            icon={<FaShoppingCart />}
            colorClass="from-blue-500 to-blue-400"
          />
          <StatsCard
            title="Productos en Stock"
            value={statsData.inventario.total}
            change={statsData.inventario.change}
            icon={<FaBoxes />}
            colorClass="from-green-500 to-green-400"
          />
          <StatsCard
            title="Clientes Activos"
            value={statsData.clientes.total}
            change={statsData.clientes.change}
            icon={<FaUsers />}
            colorClass="from-purple-500 to-purple-400"
          />
          <StatsCard
            title="Ganancias"
            value={statsData.ganancias.total}
            change={statsData.ganancias.change}
            icon={<FaMoneyBillWave />}
            colorClass="from-yellow-500 to-yellow-400"
          />
        </div>

        {/* Gráfico y Alertas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ChartWidget
              title="Ventas de la Semana"
              data={chartData}
              height={300}
            />
          </div>
          <div>
            <AlertWidget
              title="Alertas Recientes"
              alerts={alertas}
            />
          </div>
        </div>
      </div>
      <main className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuraciones */}
        <aside className="col-span-1 lg:col-span-1 bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Configuraciones</h2>
          <p className="text-sm text-gray-600 mb-4">Ajustes rápidos que puedes activar o desactivar. Estos cambios son locales por ahora.</p>

          <ul className="space-y-4">
            <li className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-800">Notificaciones</div>
                <div className="text-xs text-gray-500">Recibe alertas sobre ventas y pedidos</div>
              </div>
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={enableNotifications}
                  onChange={(e) => setEnableNotifications(e.target.checked)}
                  aria-label="Activar notificaciones"
                />
                <span className={`w-11 h-6 flex items-center bg-gray-300 rounded-full p-1 transition-colors ${enableNotifications ? "bg-indigo-500" : "bg-gray-300"}`}>
                  <span className={`bg-white w-4 h-4 rounded-full shadow transform transition-transform ${enableNotifications ? "translate-x-5" : "translate-x-0"}`}></span>
                </span>
              </label>
            </li>

            <li className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-800">Impresión automática</div>
                <div className="text-xs text-gray-500">Imprime tickets al concluir ventas</div>
              </div>
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={autoPrint}
                  onChange={(e) => setAutoPrint(e.target.checked)}
                  aria-label="Activar impresión automática"
                />
                <span className={`w-11 h-6 flex items-center bg-gray-300 rounded-full p-1 transition-colors ${autoPrint ? "bg-indigo-500" : "bg-gray-300"}`}>
                  <span className={`bg-white w-4 h-4 rounded-full shadow transform transition-transform ${autoPrint ? "translate-x-5" : "translate-x-0"}`}></span>
                </span>
              </label>
            </li>

            <li className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-800">Alertas de stock bajo</div>
                <div className="text-xs text-gray-500">Recibe avisos cuando el inventario es bajo</div>
              </div>
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={showLowStockAlerts}
                  onChange={(e) => setShowLowStockAlerts(e.target.checked)}
                  aria-label="Activar alertas de stock bajo"
                />
                <span className={`w-11 h-6 flex items-center bg-gray-300 rounded-full p-1 transition-colors ${showLowStockAlerts ? "bg-indigo-500" : "bg-gray-300"}`}>
                  <span className={`bg-white w-4 h-4 rounded-full shadow transform transition-transform ${showLowStockAlerts ? "translate-x-5" : "translate-x-0"}`}></span>
                </span>
              </label>
            </li>
          </ul>
        </aside>

        {/* Reportes - placeholders vacíos */}
        <section className="col-span-1 lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow p-6 min-h-[220px] flex flex-col">
            <header className="flex items-center justify-between mb-3">
              <h3 className="text-md font-semibold text-gray-800">Ventas (últimos 30 días)</h3>
              <span className="text-xs text-gray-500">Estado: sin datos</span>
            </header>
            <div className="flex-1 flex items-center justify-center border-2 border-dashed border-gray-200 rounded">
              <div className="text-center text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-2" width="64" height="40" viewBox="0 0 64 40" fill="none">
                  <rect x="2" y="6" width="60" height="26" rx="3" stroke="#E5E7EB" strokeWidth="2" strokeDasharray="4 4" />
                </svg>
                <div className="text-sm">No hay datos para mostrar</div>
                <div className="text-xs text-gray-400">Cuando ingresen ventas, aquí aparecerá la gráfica</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-6 min-h-[220px] flex flex-col">
            <header className="flex items-center justify-between mb-3">
              <h3 className="text-md font-semibold text-gray-800">Inventario (stock por categoría)</h3>
              <span className="text-xs text-gray-500">Estado: sin datos</span>
            </header>
            <div className="flex-1 flex items-center justify-center border-2 border-dashed border-gray-200 rounded">
              <div className="text-center text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-2" width="64" height="40" viewBox="0 0 64 40" fill="none">
                  <rect x="2" y="6" width="60" height="26" rx="3" stroke="#E5E7EB" strokeWidth="2" strokeDasharray="4 4" />
                </svg>
                <div className="text-sm">No hay datos para mostrar</div>
                <div className="text-xs text-gray-400">Cuando se registren movimientos, aquí aparecerá la gráfica</div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default DashboardHome;
