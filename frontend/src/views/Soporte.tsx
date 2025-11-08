import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, Mail, HelpCircle, Send } from 'lucide-react';

const teamMembers = [
  {
    name: 'Andrea Sofia Chafolla Mendez',
    carne: '5090-22-216',
    phone: '+502 3052 6004',
    email: 'achafollam@miumg.edu.gt'
  },
  {
    name: 'Carmi Emileny Cuxum Gonzalez',
    carne: '5090-22-3686',
    phone: '+502 3031 8249',
    email: 'ccuxumg@miumg.edu.gt'
  },
  {
    name: 'Josué Daniel Figueroa Herrera',
    carne: '5090-22-36',
    phone: '+502 5625 2922',
    email: 'jfigueroah4@miumg.edu.gt'
  },
  {
    name: 'Dilan René Escobar Rodríguez',
    carne: '5090-22-1010',
    phone: '+502 5748 1467',
    email: 'descobarr9@miumg.edu.gt'
  },
  {
    name: 'Bartola Angelica Grave Barrera',
    carne: '5090-22-7985',
    phone: '+502 3652 9993',
    email: 'Bgraveb@miumg.edu.gt'
  }
];

const Soporte: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="relative bg-gray-100 p-6">
      <div className="w-full">
        {/* Botón de regresar */}
        <div className="mb-6">
          <button onClick={() => navigate(-1)} className="px-4 py-2 rounded-md border bg-white hover:bg-gray-50 text-gray-700 font-medium">
            ← Regresar
          </button>
        </div>

        {/* Header simplificado */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800">
            Área de Soporte
          </h1>
        </div>

        {/* Layout principal: miembros a la izquierda, ayuda a la derecha */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Equipo - ocupa 2 columnas en lg */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-700 mb-6 text-center">
              Nuestro Equipo – Grupo No. 5
            </h2>

            <div className="grid grid-cols-2 gap-6">
              {teamMembers.map((member, index) => (
                <div
                  key={index}
                  className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200 hover:shadow-md transition-shadow duration-300"
                >
                  <div className="flex items-center mb-4">
                    <img
                      src="/image/other/logo-umg.png"
                      alt="Logo"
                      className="w-10 h-10 object-contain mr-4 rounded-full bg-white p-1"
                    />
                    <div>
                      <h3 className="font-semibold text-gray-800 text-base">{member.name}</h3>
                      <p className="text-sm text-gray-600">Carné: {member.carne}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center text-gray-700">
                      <Phone className="mr-2 text-green-600" size={16} />
                      <span className="text-sm">{member.phone}</span>
                    </div>
                    <div className="flex items-center text-gray-700">
                      <Mail className="mr-2 text-blue-600" size={16} />
                      <span className="text-sm">{member.email}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ayuda Inmediata - ocupa 1 columna en lg, en tarjetas */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-lg p-4">
              <h3 className="text-lg font-semibold text-gray-700 mb-4 text-center flex items-center justify-center gap-2">
                <HelpCircle className="text-orange-600" size={20} />
                ¿Necesitas Ayuda?
              </h3>

              <div className="space-y-3">
                <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-3 border border-green-200">
                  <div className="flex items-center mb-1">
                    <Phone className="text-green-600 mr-2" size={18} />
                    <h4 className="font-semibold text-gray-800 text-sm">Llamada Directa</h4>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
                  <div className="flex items-center mb-1">
                    <Send className="text-blue-600 mr-2" size={18} />
                    <h4 className="font-semibold text-gray-800 text-sm">Correo Electrónico</h4>
                  </div>
                </div>
              </div>
            </div>

            {/* Pie de página */}
            <div className="bg-white rounded-xl shadow-lg p-4 text-center">
              <p className="text-gray-500 text-xs">
                Universidad Mariano Gálvez – Proyecto Shucway App
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Soporte;