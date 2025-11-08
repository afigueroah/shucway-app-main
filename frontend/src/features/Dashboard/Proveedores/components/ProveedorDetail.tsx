import React from 'react';
import { Card, Descriptions, Tag } from 'antd';
import { FaBuilding, FaUser, FaPhone, FaEnvelope, FaMapMarkerAlt, FaTruck, FaStar } from 'react-icons/fa';

interface Proveedor {
  id_proveedor: number;
  nombre_empresa: string;
  nombre_contacto?: string;
  telefono?: string;
  correo?: string;
  direccion?: string;
  estado: boolean;
  metodo_entrega?: 'recoge_en_tienda' | 'envio_domicilio' | 'ambos';
  es_preferido: boolean;
  fecha_registro: string;
}

interface ProveedorDetailProps {
  proveedor: Proveedor;
}

const ProveedorDetail: React.FC<ProveedorDetailProps> = ({ proveedor }) => {
  const metodoEntregaLabels = {
    'recoge_en_tienda': 'Recoge en tienda',
    'envio_domicilio': 'Envío a domicilio',
    'ambos': 'Ambos'
  };

  const items = [
    {
      key: '1',
      label: 'ID Proveedor',
      children: proveedor.id_proveedor,
    },
    {
      key: '2',
      label: 'Estado',
      children: (
        <Tag color={proveedor.estado ? 'green' : 'red'}>
          {proveedor.estado ? 'Activo' : 'Inactivo'}
        </Tag>
      ),
    },
    {
      key: '3',
      label: 'Tipo',
      children: proveedor.es_preferido ? (
        <Tag color="gold" icon={<FaStar />}>
          Proveedor Preferido
        </Tag>
      ) : (
        <Tag>Proveedor Regular</Tag>
      ),
    },
    {
      key: '4',
      label: 'Fecha de Registro',
      children: new Date(proveedor.fecha_registro).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Información Principal */}
      <Card
        title={
          <div className="flex items-center space-x-2">
            <FaBuilding className="text-blue-600" />
            <span>Información de la Empresa</span>
          </div>
        }
      >
        <Descriptions
          items={items}
          column={2}
          bordered
          size="small"
        />
      </Card>

      {/* Información de Contacto */}
      <Card
        title={
          <div className="flex items-center space-x-2">
            <FaUser className="text-green-600" />
            <span>Información de Contacto</span>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <FaBuilding className="text-gray-400 w-5 h-5" />
            <div>
              <div className="font-medium text-gray-900">Empresa</div>
              <div className="text-gray-600">{proveedor.nombre_empresa}</div>
            </div>
          </div>

          {proveedor.nombre_contacto && (
            <div className="flex items-center space-x-3">
              <FaUser className="text-gray-400 w-5 h-5" />
              <div>
                <div className="font-medium text-gray-900">Contacto</div>
                <div className="text-gray-600">{proveedor.nombre_contacto}</div>
              </div>
            </div>
          )}

          {proveedor.telefono && (
            <div className="flex items-center space-x-3">
              <FaPhone className="text-gray-400 w-5 h-5" />
              <div>
                <div className="font-medium text-gray-900">Teléfono</div>
                <div className="text-gray-600">{proveedor.telefono}</div>
              </div>
            </div>
          )}

          {proveedor.correo && (
            <div className="flex items-center space-x-3">
              <FaEnvelope className="text-gray-400 w-5 h-5" />
              <div>
                <div className="font-medium text-gray-900">Correo</div>
                <div className="text-gray-600">{proveedor.correo}</div>
              </div>
            </div>
          )}

          {proveedor.direccion && (
            <div className="flex items-start space-x-3">
              <FaMapMarkerAlt className="text-gray-400 w-5 h-5 mt-1" />
              <div>
                <div className="font-medium text-gray-900">Dirección</div>
                <div className="text-gray-600 whitespace-pre-line">{proveedor.direccion}</div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Método de Entrega */}
      <Card
        title={
          <div className="flex items-center space-x-2">
            <FaTruck className="text-purple-600" />
            <span>Método de Entrega</span>
          </div>
        }
      >
        <div className="text-center py-4">
          {proveedor.metodo_entrega ? (
            <Tag
              color="blue"
              className="text-lg px-4 py-2"
            >
              {metodoEntregaLabels[proveedor.metodo_entrega]}
            </Tag>
          ) : (
            <div className="text-gray-500">No especificado</div>
          )}
        </div>
      </Card>

      {/* Estadísticas */}
      <Card title="Estadísticas">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">0</div>
            <div className="text-sm text-gray-600">Órdenes Activas</div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">0</div>
            <div className="text-sm text-gray-600">Productos Suministrados</div>
          </div>
          <div className="p-4 bg-yellow-50 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">0</div>
            <div className="text-sm text-gray-600">Compras del Mes</div>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">0</div>
            <div className="text-sm text-gray-600">Valor Total</div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ProveedorDetail;