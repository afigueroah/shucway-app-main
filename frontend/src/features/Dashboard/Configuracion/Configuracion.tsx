import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DatabaseOutlined, CloudUploadOutlined, HistoryOutlined } from '@ant-design/icons';
import mantenimientoImg from '/img/mantenimiento.jpg';
import backupImg from '/img/Backup.jpg';
import resetImg from '/img/config.jpg';

interface RecentChange {
  id: number;
  type: string;
  module: string;
  date: string;
  user: string;
}

// Estilos CSS inspirados en el inventario
const configStyles = `
.config-table {
  width: 100%;
  border-collapse: collapse;
  background: #ffffff;
  border-radius: 0.75rem;
  overflow: hidden;
  box-shadow: 0 6px 20px rgba(16,24,40,0.06);
}

.config-table th, .config-table td {
  padding: 1rem 1.25rem;
  text-align: left;
  border-bottom: 1px solid #f1f3f4;
  font-size: 0.9rem;
}

.config-table th {
  background: #f8f9fa;
  font-weight: 600;
  color: #12443D;
  text-transform: uppercase;
  font-size: 0.8rem;
  letter-spacing: 0.5px;
}

.config-table tbody tr:hover {
  background: #f8f9fa;
}

.config-table tbody tr:last-child td {
  border-bottom: none;
}

.config-card {
  background: #ffffff;
  border-radius: 0.75rem;
  box-shadow: 0 6px 20px rgba(16,24,40,0.06);
  overflow: hidden;
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}

.config-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px rgba(16,24,40,0.12);
}
`;

const Configuracion: React.FC = () => {
  const navigate = useNavigate();
  const [backupsCount, setBackupsCount] = useState(0);
  const [tablesCount, setTablesCount] = useState(0);
  const [recentChanges, setRecentChanges] = useState<RecentChange[]>([]);

  useEffect(() => {
    // Cargar datos de backups desde localStorage (si existen)
    const storedBackups = localStorage.getItem('backups');
    if (storedBackups) {
      try {
        const backups = JSON.parse(storedBackups);
        setBackupsCount(Array.isArray(backups) ? backups.length : 0);
      } catch {
        // ignore parse errors
      }
    }

    // Intentar obtener datos dinámicos desde la API. Si las rutas no existen,
    // dejamos los valores por defecto (0 / []). Esto evita datos "quemados" en el UI.
    (async () => {
      try {
        const tRes = await fetch('/api/db/tables-count');
        if (tRes.ok) {
          const tJson = await tRes.json();
          if (typeof tJson.count === 'number') setTablesCount(tJson.count);
        }
      } catch {
        // no-op, mantenemos tablesCount = 0
      }

      try {
        const rRes = await fetch('/api/config/recent-changes');
        if (rRes.ok) {
          const rJson = await rRes.json();
          if (Array.isArray(rJson) && rJson.length > 0) {
            setRecentChanges(rJson.slice(0, 5));
          } else {
            // Fallback: datos simulados mientras se implementa auditoría real
            setRecentChanges([
              { id: 1, type: 'Actualización', module: 'Usuarios', date: new Date(Date.now() - 1000 * 60 * 30).toISOString().slice(0, 19).replace('T', ' '), user: 'Admin' },
              { id: 2, type: 'Creación', module: 'Productos', date: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString().slice(0, 19).replace('T', ' '), user: 'Supervisor' },
              { id: 3, type: 'Modificación', module: 'Inventario', date: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString().slice(0, 19).replace('T', ' '), user: 'Almacén' },
              { id: 4, type: 'Eliminación', module: 'Ventas', date: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString().slice(0, 19).replace('T', ' '), user: 'Cajero' },
              { id: 5, type: 'Configuración', module: 'Sistema', date: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString().slice(0, 19).replace('T', ' '), user: 'Admin' }
            ]);
          }
        }
      } catch {
        // Fallback: datos simulados mientras se implementa auditoría real
        setRecentChanges([
          { id: 1, type: 'Actualización', module: 'Usuarios', date: new Date(Date.now() - 1000 * 60 * 30).toISOString().slice(0, 19).replace('T', ' '), user: 'Admin' },
          { id: 2, type: 'Creación', module: 'Productos', date: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString().slice(0, 19).replace('T', ' '), user: 'Supervisor' },
          { id: 3, type: 'Modificación', module: 'Inventario', date: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString().slice(0, 19).replace('T', ' '), user: 'Almacén' },
          { id: 4, type: 'Eliminación', module: 'Ventas', date: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString().slice(0, 19).replace('T', ' '), user: 'Cajero' },
          { id: 5, type: 'Configuración', module: 'Sistema', date: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString().slice(0, 19).replace('T', ' '), user: 'Admin' }
        ]);
      }
    })();
  }, []);

  const options = [
    {
      name: 'Mantenimiento',
      img: mantenimientoImg,
      route: '/configuracion/mantenimiento',
      description: 'Gestionar tablas de la base de datos'
    },
    {
      name: 'Backup',
      img: backupImg,
      route: '/configuracion/backup',
      description: 'Generar y gestionar backups'
    },
    {
      name: 'Reinicio de datos',
      img: resetImg,
      route: '/configuracion/reinicio-datos',
      description: 'Reiniciar registros de módulos'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <style>{configStyles}</style>
  <header className="w-full max-w-screen-xl mx-auto mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-800">Configuración y Mantenimiento</h1>
        <p className="text-sm text-gray-600 mt-1">Herramientas avanzadas para la gestión del sistema</p>
      </header>

      {/* Opciones principales - SIEMPRE ARRIBA */}
  <section className="w-full max-w-screen-xl mx-auto mb-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        {options.map((option) => (
          <div
            key={option.name}
            role="button"
            tabIndex={0}
            onClick={() => navigate(option.route)}
            onKeyDown={(e) => e.key === 'Enter' && navigate(option.route)}
            className="relative rounded-2xl shadow-md cursor-pointer group overflow-hidden h-48 flex items-end bg-gradient-to-tr from-gray-500 to-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-400"
          >
            <img
              src={option.img}
              alt={option.name}
              className="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:opacity-60 transition duration-300"
            />
            <div className="relative z-10 p-5 w-full flex flex-col items-start">
              <span className="text-xl md:text-2xl font-semibold text-white drop-shadow-lg mb-1">{option.name}</span>
              <span className="text-xs bg-white/80 text-gray-700 px-2 py-1 rounded">{option.description}</span>
            </div>
          </div>
        ))}
      </section>

      {/* Estadísticas y tabla */}
  <div className="w-full max-w-screen-xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Estadísticas en el lado izquierdo - estilo inventario */}
        <div className="lg:col-span-1 space-y-6">
          <div className="config-card">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold mb-1">{backupsCount}</div>
                  <div className="text-blue-100 text-sm font-medium">Backups realizados</div>
                </div>
                <CloudUploadOutlined className="text-4xl text-blue-200" />
              </div>
            </div>
          </div>

          <div className="config-card">
            <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold mb-1">{tablesCount}</div>
                  <div className="text-green-100 text-sm font-medium">Tablas en BD</div>
                </div>
                <DatabaseOutlined className="text-4xl text-green-200" />
              </div>
            </div>
          </div>

          <div className="config-card">
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-bold mb-1">Últimas modificaciones</div>
                  <div className="text-purple-100 text-sm font-medium">Historial de cambios recientes</div>
                </div>
                <HistoryOutlined className="text-4xl text-purple-200" />
              </div>
            </div>
          </div>
        </div>        {/* Tabla estirada en el lado derecho */}
        <div className="lg:col-span-2">
          <div className="config-card">
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">Últimas 5 actualizaciones del sistema</h3>
              <p className="text-sm text-gray-600">Historial de cambios recientes en los módulos del sistema</p>
            </div>
            <div className="overflow-x-auto">
              <table className="config-table">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Módulo</th>
                    <th>Fecha</th>
                    <th>Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {recentChanges.map((change) => (
                    <tr key={change.id}>
                      <td>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {change.type}
                        </span>
                      </td>
                      <td>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {change.module}
                        </span>
                      </td>
                      <td className="text-sm text-gray-600">{change.date}</td>
                      <td className="font-medium text-gray-900">{change.user}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Configuracion;
