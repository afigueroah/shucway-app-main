import React, { useState, useEffect } from 'react';
import api from '../../../../../api/apiClient';
import { Button, Table, message, Modal, Form, Input, Select } from 'antd';
import { FaEye, FaEdit, FaTrash, FaPlus } from 'react-icons/fa';

interface RolUsuario {
  id_rol?: number;
  nombre: string;
  descripcion: string;
  nivel_permisos: number;
  estado: 'activo' | 'inactivo';
  fecha_creacion?: string;
}

const RolesMantenimiento: React.FC = () => {
  const [roles, setRoles] = useState<RolUsuario[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRol, setEditingRol] = useState<RolUsuario | null>(null);
  const [form] = Form.useForm();

  // Colores del tema
  const colors = {
    primary: '#346C60',
    secondary: '#12443D',
    accent: '#FFD40D'
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const resp = await api.get('/dashboard/table-data/rol_usuario?limit=1000');
      if (!resp || resp.status >= 400) throw new Error('Error al cargar roles');
      const js = resp.data || {};
      const rows = js.data || [];
      setRoles(rows as RolUsuario[]);
    } catch (error) {
      console.error('Error fetching roles:', error);
      message.error('Error al cargar roles');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingRol(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (rol: RolUsuario) => {
    setEditingRol(rol);
    form.setFieldsValue(rol);
    setModalVisible(true);
  };

  const handleDelete = async (rol: RolUsuario) => {
    if (!rol.id_rol) return;

    Modal.confirm({
      title: 'Eliminar Rol',
      content: `¿Estás seguro de eliminar "${rol.nombre}"? Esto puede afectar a los usuarios asociados.`,
      okText: 'Eliminar',
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          const resp = await api.delete(`/dashboard/table-data/rol_usuario/${encodeURIComponent(String(rol.id_rol))}`);
          if (!resp || resp.status >= 400) throw new Error('Error al eliminar rol');
          message.success('Rol eliminado exitosamente');
          fetchRoles();
        } catch (error) {
          console.error('Error deleting rol:', error);
          message.error('Error al eliminar rol');
        }
      }
    });
  };

  const handleSave = async (values: RolUsuario) => {
    try {
        if (editingRol?.id_rol) {
          const resp = await api.put(`/dashboard/table-data/rol_usuario/${encodeURIComponent(String(editingRol.id_rol))}`, values as unknown as Record<string, unknown>);
          if (!resp || resp.status >= 400) throw new Error('Error al actualizar rol');
          message.success('Rol actualizado exitosamente');
        } else {
          const resp = await api.post('/dashboard/table-data/rol_usuario', values as unknown as Record<string, unknown>);
          if (!resp || resp.status >= 400) throw new Error('Error al crear rol');
          message.success('Rol creado exitosamente');
        }

      setModalVisible(false);
      form.resetFields();
      fetchRoles();
    } catch (error) {
      console.error('Error saving rol:', error);
      message.error('Error al guardar rol');
    }
  };

  const getPermissionLevelDescription = (level: number) => {
    switch (level) {
      case 1: return 'Básico';
      case 2: return 'Intermedio';
      case 3: return 'Avanzado';
      case 4: return 'Administrador';
      case 5: return 'Super Admin';
      default: return 'Desconocido';
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id_rol',
      key: 'id_rol',
      width: 80,
    },
    {
      title: 'Nombre',
      dataIndex: 'nombre',
      key: 'nombre',
      width: 150,
    },
    {
      title: 'Descripción',
      dataIndex: 'descripcion',
      key: 'descripcion',
      width: 250,
    },
    {
      title: 'Nivel de Permisos',
      dataIndex: 'nivel_permisos',
      key: 'nivel_permisos',
      width: 150,
      render: (nivel: number) => (
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            nivel >= 4 ? 'bg-red-100 text-red-800' :
            nivel >= 3 ? 'bg-orange-100 text-orange-800' :
            nivel >= 2 ? 'bg-yellow-100 text-yellow-800' :
            'bg-green-100 text-green-800'
          }`}>
            Nivel {nivel}
          </span>
          <span className="text-sm text-gray-600">
            {getPermissionLevelDescription(nivel)}
          </span>
        </div>
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'estado',
      key: 'estado',
      width: 100,
      render: (estado: string) => (
        <span className={`px-2 py-1 rounded-full text-xs ${
          estado === 'activo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {estado}
        </span>
      ),
    },
    {
      title: 'Fecha Creación',
      dataIndex: 'fecha_creacion',
      key: 'fecha_creacion',
      width: 150,
      render: (fecha: string) => fecha ? new Date(fecha).toLocaleDateString('es-ES') : '-',
    },
    {
      title: 'Acciones',
      key: 'acciones',
      width: 150,
      render: (_: unknown, record: RolUsuario) => (
        <div className="flex gap-2">
          <Button
            type="text"
            icon={<FaEye />}
            onClick={() => Modal.info({
              title: 'Detalles del Rol',
              content: (
                <div className="space-y-2">
                  <p><strong>Nombre:</strong> {record.nombre}</p>
                  <p><strong>Descripción:</strong> {record.descripcion}</p>
                  <p><strong>Nivel de Permisos:</strong> {record.nivel_permisos} ({getPermissionLevelDescription(record.nivel_permisos)})</p>
                  <p><strong>Estado:</strong> {record.estado}</p>
                  <p><strong>Fecha de Creación:</strong> {record.fecha_creacion ? new Date(record.fecha_creacion).toLocaleDateString('es-ES') : '-'}</p>
                </div>
              ),
              width: 500,
            })}
            style={{ color: colors.primary }}
          />
          <Button
            type="text"
            icon={<FaEdit />}
            onClick={() => handleEdit(record)}
            style={{ color: colors.accent }}
          />
          <Button
            type="text"
            icon={<FaTrash />}
            onClick={() => handleDelete(record)}
            style={{ color: '#ff4d4f' }}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: colors.primary }}>
            Gestión de Roles
          </h2>
          <p className="text-gray-600">
            Total de roles: <span className="font-semibold">{roles.length}</span>
          </p>
        </div>

        <Button
          type="primary"
          icon={<FaPlus />}
          onClick={handleAdd}
          style={{ backgroundColor: colors.primary, borderColor: colors.primary }}
        >
          Agregar Rol
        </Button>
      </div>

      {roles.length === 0 && !loading ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4" style={{ color: colors.accent }}>👥</div>
          <h3 className="text-xl font-semibold mb-2" style={{ color: colors.secondary }}>
            No hay roles registrados
          </h3>
          <p className="text-gray-600 mb-6">
            Comienza creando tu primer rol para gestionar permisos de usuario.
          </p>
          <Button
            type="primary"
            icon={<FaPlus />}
            onClick={handleAdd}
            style={{ backgroundColor: colors.primary, borderColor: colors.primary }}
          >
            Agregar primer rol
          </Button>
        </div>
      ) : (
        <Table
          columns={columns}
          dataSource={roles}
          rowKey="id_rol"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} de ${total} roles`
          }}
          scroll={{ x: 800 }}
        />
      )}

      <Modal
        title={editingRol ? 'Editar Rol' : 'Agregar Rol'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
        >
          <Form.Item
            name="nombre"
            label="Nombre del Rol"
            rules={[{ required: true, message: 'El nombre es requerido' }]}
          >
            <Input placeholder="Ingrese el nombre del rol" />
          </Form.Item>

          <Form.Item
            name="descripcion"
            label="Descripción"
            rules={[{ required: true, message: 'La descripción es requerida' }]}
          >
            <Input.TextArea
              placeholder="Ingrese la descripción del rol"
              rows={3}
            />
          </Form.Item>

          <Form.Item
            name="nivel_permisos"
            label="Nivel de Permisos"
            rules={[{ required: true, message: 'El nivel de permisos es requerido' }]}
          >
            <Select placeholder="Seleccione el nivel de permisos">
              <Select.Option value={1}>1 - Básico (Lectura)</Select.Option>
              <Select.Option value={2}>2 - Intermedio (Lectura/Escritura básica)</Select.Option>
              <Select.Option value={3}>3 - Avanzado (Gestión de contenido)</Select.Option>
              <Select.Option value={4}>4 - Administrador (Gestión completa)</Select.Option>
              <Select.Option value={5}>5 - Super Admin (Acceso total)</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="estado"
            label="Estado"
            rules={[{ required: true, message: 'El estado es requerido' }]}
          >
            <Select placeholder="Seleccione el estado">
              <Select.Option value="activo">Activo</Select.Option>
              <Select.Option value="inactivo">Inactivo</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item className="flex justify-end">
            <Button
              onClick={() => {
                setModalVisible(false);
                form.resetFields();
              }}
              className="mr-2"
            >
              Cancelar
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              style={{ backgroundColor: colors.primary, borderColor: colors.primary }}
            >
              {editingRol ? 'Actualizar' : 'Crear'} Rol
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default RolesMantenimiento;
