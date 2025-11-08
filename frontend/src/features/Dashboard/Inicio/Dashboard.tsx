import { useNavigate } from "react-router-dom";
import React, { useState } from "react";
import ventasImg from "/img/ventas.jpg";
import inventarioImg from "/img/inventario.jpg";
import adminImg from "/img/adm.jpg";
import reportesImg from "/img/reportes.jpg";
import configImg from "/img/config.jpg";
import soporteImg from "/img/soporte3.png";

const modules = [
  {
    name: "Ventas",
    img: ventasImg,
    route: "/ventas",
    color: "from-blue-500 to-blue-300",
  },
  {
    name: "Inventario",
    img: inventarioImg,
    route: "/inventario",
    color: "from-green-500 to-green-300",
  },
  {
    name: "Administración",
    img: adminImg,
    route: "/administracion",
    color: "from-purple-500 to-purple-300",
  },
  {
    name: "Reportes",
    img: reportesImg,
    route: "/reportes",
    color: "from-yellow-500 to-yellow-300",
  },
  {
    name: "Soporte",
    img: soporteImg,
    route: "/soporte",
    color: "from-pink-400 to-pink-300",
  },
  {
    name: "Configuración",
    img: configImg,
    route: "/configuracion",
    color: "from-gray-500 to-gray-300",
  },
];

const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  // Configuraciones locales (persistidas en localStorage)
  const STORAGE_PREFIX = "dashboard:";

  // Variables de configuración futuras - se usarán más adelante
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_enableNotifications, _setEnableNotifications] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem(STORAGE_PREFIX + "enableNotifications");
      return v === null ? true : v === "true";
    } catch {
      return true;
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_autoPrint, _setAutoPrint] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem(STORAGE_PREFIX + "autoPrint");
      return v === null ? false : v === "true";
    } catch {
      return false;
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_showLowStockAlerts, _setShowLowStockAlerts] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem(STORAGE_PREFIX + "showLowStockAlerts");
      return v === null ? true : v === "true";
    } catch {
      return true;
    }
  });

  return (
    <div className="h-full flex flex-col items-center bg-gray-50 p-6">
      <header className="w-full max-w-6xl mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-800">Panel Principal</h1>
        <p className="text-sm text-gray-600 mt-1">Accesos rápidos y estado general del sistema</p>
      </header>

      <section className="w-full max-w-6xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mb-8">
        {modules.map((mod) => (
          <div
            key={mod.name}
            role="button"
            tabIndex={0}
            onClick={() => (mod.route ? navigate(mod.route) : null)}
            onKeyDown={(e) => (e.key === "Enter" && mod.route ? navigate(mod.route) : null)}
            className={`relative rounded-2xl shadow-md cursor-pointer group overflow-hidden h-56 flex items-end bg-gradient-to-tr ${mod.color} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-400`}>
            <img
              src={mod.img}
              alt={mod.name}
              className="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:opacity-60 transition duration-300"
            />
            <div className="relative z-10 p-6 w-full flex flex-col items-start">
              <span className="text-2xl md:text-3xl font-semibold text-white drop-shadow-lg mb-1">{mod.name}</span>
              {mod.name === "Administración" && (
                <span className="text-xs bg-white/80 text-gray-700 px-2 py-1 rounded">Gestión de usuarios</span>
              )}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
};

export default Dashboard;
