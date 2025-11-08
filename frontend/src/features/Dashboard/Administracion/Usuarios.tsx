import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import UsuariosTable from "../../../components/UsuariosTable/UsuariosTable";
import { MdAdminPanelSettings, MdTrendingUp } from "react-icons/md";
import { getEstadisticas } from "../../../api/usuariosService";
import { Spin } from "antd";

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: number;
  trendLabel?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, trend, trendLabel }) => (
  <div className="bg-white rounded-xl p-6 shadow-sm">
    <div className="flex items-center justify-between mb-4">
      <span className="text-sm font-medium text-gray-500">{title}</span>
      <div className="text-green-600">{icon}</div>
    </div>
    <div className="flex items-baseline space-x-4">
      <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
      {trend && (
        <div className={`flex items-center space-x-1 text-sm ${trend > 0 ? 'text-green-600' : 'text-red-500'}`}>
          <MdTrendingUp className={`${trend > 0 ? '' : 'transform rotate-180'}`} />
          <span>{Math.abs(trend)}%</span>
        </div>
      )}
    </div>
    {trendLabel && <p className="mt-1 text-sm text-gray-500">{trendLabel}</p>}
  </div>
);

const Usuarios = () => {
  const [activeTab, setActiveTab] = useState('todos');

  // Obtener estadísticas desde el backend
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['usuarios-estadisticas'],
    queryFn: getEstadisticas,
    refetchInterval: 5 * 60 * 1000, // Refrescar cada 5 minutos (reducido de 30 segundos)
  });

  // Calcular tasa de retención (simplificada como activos/total * 100)
  const tasaRetencion = stats ? Math.round((stats.activos / stats.total) * 100) : 0;

  return (
    <div className="w-full bg-[#f3f2f7] pt-6 pb-8 px-6">
      {/* Stats Row */}
      {loadingStats ? (
        <div className="flex justify-center items-center h-40 mb-8">
          <Spin size="large" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Usuarios"
            value={stats?.total.toString() || "0"}
            icon={<MdAdminPanelSettings size={20} />}
            trendLabel="registrados en el sistema"
          />
          <StatCard
            title="Usuarios Activos"
            value={stats?.activos.toString() || "0"}
            icon={<MdAdminPanelSettings size={20} />}
            trendLabel="usuarios activos"
          />
          <StatCard
            title="Nuevos Usuarios"
            value={stats?.nuevosEsteMes.toString() || "0"}
            icon={<MdAdminPanelSettings size={20} />}
            trendLabel="registrados este mes"
          />
          <StatCard
            title="Tasa de Retención"
            value={`${tasaRetencion}%`}
            icon={<MdAdminPanelSettings size={20} />}
            trendLabel="usuarios activos"
          />
        </div>
      )}

      {/* Tabs y Tabla */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 px-6 py-4">
          <div className="flex space-x-6">
            {['todos', 'activo', 'inactivo', 'suspendido', 'eliminado'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-2 px-1 border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-green-600 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="px-6 py-4">
          <UsuariosTable estadoFilter={activeTab} />
        </div>
      </div>
    </div>
  );
};

export default Usuarios;
