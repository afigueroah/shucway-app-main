import React, { useState, useEffect, useCallback } from 'react';
import { FaPlus, FaEdit, FaTrash, FaEye, FaSearch, FaFilter } from 'react-icons/fa';
import { Button, Input, Select, Table, Modal, message, Tag, Space, Card, Tooltip } from 'antd';
import { ColumnsType } from 'antd/es/table';
import ProveedorForm from './components/ProveedorForm';
import ProveedorDetail from './components/ProveedorDetail';
import { fetchProveedores, deleteProveedor } from '@/api/inventarioService';

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

const Proveedores: React.FC = () => {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [preferredFilter, setPreferredFilter] = useState<'all' | 'preferred' | 'not_preferred'>('all');

  // Modal states
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [selectedProveedor, setSelectedProveedor] = useState<Proveedor | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const colors = {
    primary: '#346C60',
    secondary: '#12443D',
    accent: '#FFD40D',
    danger: '#DC2626',
    success: '#16A34A'
  };

  // Load proveedores
  const loadProveedores = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchProveedores();
      setProveedores(data);
    } catch (error) {
      console.error('Error loading proveedores:', error);
      message.error('Error al cargar proveedores');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProveedores();
  }, [loadProveedores]);

  // Filter proveedores
  const filteredProveedores = proveedores.filter(proveedor => {
    const matchesSearch = proveedor.nombre_empresa.toLowerCase().includes(searchText.toLowerCase()) ||
                         (proveedor.nombre_contacto?.toLowerCase().includes(searchText.toLowerCase())) ||
                         (proveedor.correo?.toLowerCase().includes(searchText.toLowerCase()));

    const matchesStatus = statusFilter === 'all' ||
                         (statusFilter === 'active' && proveedor.estado) ||
                         (statusFilter === 'inactive' && !proveedor.estado);

    const matchesPreferred = preferredFilter === 'all' ||
                           (preferredFilter === 'preferred' && proveedor.es_preferido) ||
                           (preferredFilter === 'not_preferred' && !proveedor.es_preferido);

    return matchesSearch && matchesStatus && matchesPreferred;
  });

  // Handle actions
  const handleCreate = () => {
    setSelectedProveedor(null);
    setIsEditing(false);
    setFormModalVisible(true);
  };

  const handleEdit = (proveedor: Proveedor) => {
    setSelectedProveedor(proveedor);
    setIsEditing(true);
    setFormModalVisible(true);
  };

  const handleView = (proveedor: Proveedor) => {
    setSelectedProveedor(proveedor);
    setDetailModalVisible(true);
  };

  const handleDelete = (proveedor: Proveedor) => {
    setSelectedProveedor(proveedor);
    setDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    if (!selectedProveedor) return;

    try {
      await deleteProveedor(selectedProveedor.id_proveedor);
      message.success('Proveedor eliminado correctamente');
      loadProveedores();
      setDeleteModalVisible(false);
      setSelectedProveedor(null);
    } catch (error) {
      console.error('Error deleting proveedor:', error);
      message.error('Error al eliminar proveedor');
    }
  };

  const handleFormSuccess = () => {
    loadProveedores();
    setFormModalVisible(false);
    setSelectedProveedor(null);
  };

  // Table columns
  const columns: ColumnsType<Proveedor> = [
    {
      title: 'Empresa',
      dataIndex: 'nombre_empresa',
      key: 'nombre_empresa',
      sorter: (a, b) => a.nombre_empresa.localeCompare(b.nombre_empresa),
      render: (text, record) => (
        <div className="flex items-center space-x-2">
          <span className="font-medium">{text}</span>
          {record.es_preferido && (
            <Tag color="gold">Preferido</Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Contacto',
      dataIndex: 'nombre_contacto',
      key: 'nombre_contacto',
      render: (text) => text || '-',
    },
    {
      title: 'Teléfono',
      dataIndex: 'telefono',
      key: 'telefono',
      render: (text) => text || '-',
    },
    {
      title: 'Correo',
      dataIndex: 'correo',
      key: 'correo',
      render: (text) => text || '-',
    },
    {
      title: 'Método de Entrega',
      dataIndex: 'metodo_entrega',
      key: 'metodo_entrega',
      render: (metodo) => {
        const labels: Record<string, string> = {
          'recoge_en_tienda': 'Recoge en tienda',
          'envio_domicilio': 'Envío a domicilio',
          'ambos': 'Ambos'
        };
        return metodo ? labels[metodo as string] || metodo : '-';
      },
    },
    {
      title: 'Estado',
      dataIndex: 'estado',
      key: 'estado',
      render: (estado) => (
        <Tag color={estado ? 'green' : 'red'}>
          {estado ? 'Activo' : 'Inactivo'}
        </Tag>
      ),
    },
    {
      title: 'Acciones',
      key: 'acciones',
      render: (_, record) => (
        <Space>
          <Tooltip title="Ver detalles">
            <Button
              type="text"
              icon={<FaEye />}
              onClick={() => handleView(record)}
              className="text-blue-600 hover:text-blue-800"
            />
          </Tooltip>
          <Tooltip title="Editar">
            <Button
              type="text"
              icon={<FaEdit />}
              onClick={() => handleEdit(record)}
              className="text-green-600 hover:text-green-800"
            />
          </Tooltip>
          <Tooltip title="Eliminar">
            <Button
              type="text"
              icon={<FaTrash />}
              onClick={() => handleDelete(record)}
              className="text-red-600 hover:text-red-800"
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Proveedores</h1>
          <p className="text-gray-600">Gestión de proveedores del sistema</p>
        </div>
        <Button
          type="primary"
          icon={<FaPlus />}
          onClick={handleCreate}
          style={{ backgroundColor: colors.primary, borderColor: colors.primary }}
        >
          Nuevo Proveedor
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Buscar
            </label>
            <Input
              placeholder="Buscar por empresa, contacto o correo..."
              prefix={<FaSearch />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estado
            </label>
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              className="w-full"
            >
              <Select.Option value="all">Todos</Select.Option>
              <Select.Option value="active">Activos</Select.Option>
              <Select.Option value="inactive">Inactivos</Select.Option>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo
            </label>
            <Select
              value={preferredFilter}
              onChange={setPreferredFilter}
              className="w-full"
            >
              <Select.Option value="all">Todos</Select.Option>
              <Select.Option value="preferred">Preferidos</Select.Option>
              <Select.Option value="not_preferred">No preferidos</Select.Option>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              icon={<FaFilter />}
              onClick={() => {
                setSearchText('');
                setStatusFilter('all');
                setPreferredFilter('all');
              }}
            >
              Limpiar Filtros
            </Button>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={filteredProveedores}
          loading={loading}
          rowKey="id_proveedor"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} de ${total} proveedores`,
          }}
          scroll={{ x: 800 }}
        />
      </Card>

      {/* Form Modal */}
      <Modal
        title={isEditing ? "Editar Proveedor" : "Crear Proveedor"}
        open={formModalVisible}
        onCancel={() => setFormModalVisible(false)}
        footer={null}
        width={600}
        destroyOnClose
      >
        <ProveedorForm
          proveedor={selectedProveedor}
          onSuccess={handleFormSuccess}
          onCancel={() => setFormModalVisible(false)}
        />
      </Modal>

      {/* Detail Modal */}
      <Modal
        title="Detalles del Proveedor"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={800}
        destroyOnClose
      >
        {selectedProveedor && (
          <ProveedorDetail proveedor={selectedProveedor} />
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        title="Confirmar Eliminación"
        open={deleteModalVisible}
        onOk={confirmDelete}
        onCancel={() => setDeleteModalVisible(false)}
        okText="Eliminar"
        cancelText="Cancelar"
        okButtonProps={{ danger: true }}
      >
        <p>¿Estás seguro de que deseas eliminar el proveedor <strong>{selectedProveedor?.nombre_empresa}</strong>?</p>
        <p className="text-red-600 text-sm mt-2">
          Esta acción no se puede deshacer.
        </p>
      </Modal>
    </div>
  );
};

export default Proveedores;