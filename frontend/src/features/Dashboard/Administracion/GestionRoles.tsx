import { useState } from "react";
import { useNavigate } from "react-router-dom";
import RolesTable from "../../../components/RolesTable/RolesTable";
import { IoArrowBack } from "react-icons/io5";

const GestionRoles = () => {
  const [activeTab, setActiveTab] = useState('todos');
  const navigate = useNavigate();

  const handleBackToUsers = () => {
    navigate('/administracion');
  };

  return (
    <div className="w-full bg-[#f3f2f7] pt-6 pb-8 px-6">
      {/* Header con botón de regresar */}
      <div className="mb-6">
        <button
          onClick={handleBackToUsers}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <IoArrowBack className="w-5 h-5" />
          <span>Regresar a Usuarios</span>
        </button>
      </div>

      {/* Tabs y Tabla */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 px-6 py-4">
          <div className="flex space-x-6">
            {['todos', 'activo', 'inactivo'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-2 px-1 border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="px-6 py-4">
          <RolesTable estadoFilter={activeTab} />
        </div>
      </div>
    </div>
  );
};

export default GestionRoles;