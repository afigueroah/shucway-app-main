import React, { useState } from 'react';
import { Button, Select, Modal, message, Spin } from 'antd';
import { DeleteOutlined, ArrowLeftOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { localStore } from '../../../../utils/storage';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationContainer } from '@/components/NotificationContainer';

const { Option } = Select;
const { confirm } = Modal;

const ReinicioDatos: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [selectedModule, setSelectedModule] = useState<string>('');
  const { addNotification, notifications, removeNotification } = useNotifications();

  const showConfirm = (title: string, content: string, onConfirm: () => void) => {
    confirm({
      title,
      icon: <ExclamationCircleOutlined />,
      content,
      okText: 'Sí, reiniciar',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk() {
        onConfirm();
      },
    });
  };

  const resetModule = async (module: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/reset/${module}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStore.get('access_token')}`,
        },
      });

      if (response.ok) {
        const moduleName = modules.find(m => m.key === module)?.name || module;
        addNotification({
          type: 'success',
          title: 'Módulo reiniciado',
          message: `El módulo ${moduleName} ha sido reiniciado exitosamente`,
          duration: 5000
        });
      } else {
        const error = await response.json();
        message.error(error.message || `Error al reiniciar ${module}`);
      }
    } catch {
      message.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const resetAll = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/reset/all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStore.get('access_token')}`,
        },
      });

      if (response.ok) {
        addNotification({
          type: 'success',
          title: 'Limpieza total completada',
          message: 'Todos los módulos han sido reiniciados exitosamente (excepto rol_usuario, perfil_usuario y bitacora_seguridad). Se eliminaron depósitos bancarios, bitácoras de insumo y sesiones de caja. Los IDs de todas las tablas han sido reiniciados.',
          duration: 5000
        });
      } else {
        const error = await response.json();
        message.error(error.message || 'Error al reiniciar todos los módulos');
      }
    } catch {
      message.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const modules = [
    { key: 'ventas', name: 'Ventas', description: 'Eliminar todas las ventas y detalles de venta' },
    { key: 'inventario', name: 'Inventario', description: 'Eliminar movimientos, lotes, presentaciones, insumos y categorías de inventario' },
    { key: 'productos', name: 'Productos', description: 'Eliminar productos, variantes, recetas y categorías de productos' },
    { key: 'compras', name: 'Compras', description: 'Eliminar órdenes de compra, recepciones y detalles de recepción' },
    { key: 'clientes', name: 'Clientes', description: 'Eliminar clientes, ventas relacionadas, detalles de venta e historial de puntos' },
    { key: 'proveedores', name: 'Proveedores', description: 'Eliminar proveedores, órdenes de compra, recepciones y detalles relacionados' },
    { key: 'gastos', name: 'Gastos Operativos', description: 'Eliminar gastos operativos y categorías de gasto' },
    { key: 'arqueos', name: 'Arqueos de Caja', description: 'Eliminar arqueos de caja y transferencias relacionadas' },
    { key: 'auditorias', name: 'Auditorías', description: 'Eliminar auditorías de inventario y registros relacionados' },
  ];

  const selectedModuleData = modules.find(m => m.key === selectedModule);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Reinicio de Datos</h1>
            <p className="text-gray-600 mt-1">
              Herramientas para reiniciar registros de módulos específicos o todos los módulos.
            </p>
          </div>
          <Button
            type="default"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(-1)}
            size="large"
          >
            Regresar
          </Button>
        </div>

        <Spin spinning={loading}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Panel izquierdo: Reinicio por módulo */}
            <div className="bg-white p-8 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold text-gray-800 mb-6">Reinicio por Módulo</h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Seleccionar Módulo
                  </label>
                  <Select
                    value={selectedModule}
                    onChange={setSelectedModule}
                    placeholder="Selecciona un módulo"
                    className="w-full"
                    size="large"
                  >
                    {modules.map((module) => (
                      <Option key={module.key} value={module.key}>
                        {module.name}
                      </Option>
                    ))}
                  </Select>
                </div>

                {selectedModuleData && (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h3 className="font-semibold text-blue-800">{selectedModuleData.name}</h3>
                    <p className="text-sm text-blue-600 mt-1">{selectedModuleData.description}</p>
                  </div>
                )}

                <Button
                  type="primary"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() =>
                    selectedModuleData &&
                    showConfirm(
                      `Reiniciar ${selectedModuleData.name}`,
                      `¿Estás seguro de que quieres reiniciar el módulo ${selectedModuleData.name}? Todos los datos serán eliminados permanentemente.`,
                      () => resetModule(selectedModule)
                    )
                  }
                  disabled={!selectedModule || loading}
                  size="large"
                  block
                >
                  Reiniciar {selectedModuleData?.name || 'Módulo'}
                </Button>
              </div>
            </div>

            {/* Panel derecho: Limpieza total */}
            <div className="bg-white p-8 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold text-gray-800 mb-6">Limpieza Total</h2>
              
              <div className="space-y-6">
                <div className="p-6 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex items-start gap-3">
                    <ExclamationCircleOutlined className="text-red-500 text-2xl mt-1" />
                    <div>
                      <h3 className="font-semibold text-red-800">Advertencia</h3>
                      <p className="text-sm text-red-700 mt-1">
                        Esta opción reiniciará todos los módulos excepto los perfiles de usuario, roles y bitácora de seguridad.
                        <br />
                        <strong>Los IDs de todas las tablas serán reiniciados a 1.</strong>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium text-gray-700">Módulos que se reiniciarán:</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {modules.map((module) => (
                      <li key={module.key} className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                        {module.name}
                      </li>
                    ))}
                  </ul>
                </div>

                <Button
                  type="primary"
                  danger
                  size="large"
                  icon={<DeleteOutlined />}
                  onClick={() =>
                    showConfirm(
                      'Limpieza Total',
                      '¿Estás seguro de que quieres realizar una limpieza total? Todos los datos serán eliminados permanentemente, excepto los perfiles de usuario, roles y bitácora de seguridad. Los IDs de todas las tablas serán reiniciados a 1.',
                      resetAll
                    )
                  }
                  disabled={loading}
                  block
                  className="h-16 text-lg font-semibold"
                >
                  Realizar Limpieza Total
                </Button>
              </div>
            </div>
          </div>
        </Spin>
      </div>
      <NotificationContainer
        notifications={notifications}
        onClose={removeNotification}
      />
    </div>
  );
};

export default ReinicioDatos;