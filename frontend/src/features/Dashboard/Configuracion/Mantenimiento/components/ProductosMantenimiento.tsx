import React, { useState, useEffect } from 'react';
import api from '../../../../../api/apiClient';
import { Button, Table, message, Modal, Form, Input, Select, InputNumber } from 'antd';
import { FaEye, FaEdit, FaTrash, FaPlus } from 'react-icons/fa';

interface Producto {
  id_producto?: number;
  nombre: string;
  descripcion: string;
  precio: number;
  categoria: string;
  stock: number;
  imagen_url?: string;
  estado: 'activo' | 'inactivo';
  fecha_creacion?: string;
}

const ProductosMantenimiento: React.FC = () => {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProducto, setEditingProducto] = useState<Producto | null>(null);
  const [form] = Form.useForm();

  // Colores del tema
  const colors = {
    primary: '#346C60',
    secondary: '#12443D',
    accent: '#FFD40D'
  };

  useEffect(() => {
    fetchProductos();
  }, []);

  const fetchProductos = async () => {
    setLoading(true);
    try {
      const resp = await api.get('/dashboard/table-data/productos?limit=1000');
      if (!resp || resp.status >= 400) throw new Error('Error al cargar productos');
      const js = resp.data || {};
      const rows = js.data || [];
      setProductos(rows as Producto[]);
    } catch (error) {
      console.error('Error fetching productos:', error);
      message.error('Error al cargar productos');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingProducto(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (producto: Producto) => {
    setEditingProducto(producto);
    form.setFieldsValue(producto);
    setModalVisible(true);
  };

  const handleDelete = async (producto: Producto) => {
    if (!producto.id_producto) return;

    Modal.confirm({
      title: 'Eliminar Producto',
      content: `¿Estás seguro de eliminar "${producto.nombre}"?`,
      okText: 'Eliminar',
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          const resp = await api.delete(`/dashboard/table-data/productos/${encodeURIComponent(String(producto.id_producto))}`);
          if (!resp || resp.status >= 400) throw new Error('Error al eliminar producto');
          message.success('Producto eliminado exitosamente');
          fetchProductos();
        } catch (error) {
          console.error('Error deleting producto:', error);
          message.error('Error al eliminar producto');
        }
      }
    });
  };

  const handleSave = async (values: Producto) => {
    try {
        if (editingProducto?.id_producto) {
          const resp = await api.put(`/dashboard/table-data/productos/${encodeURIComponent(String(editingProducto.id_producto))}`, values as unknown as Record<string, unknown>);
          if (!resp || resp.status >= 400) throw new Error('Error al actualizar producto');
          message.success('Producto actualizado exitosamente');
        } else {
          const resp = await api.post('/dashboard/table-data/productos', values as unknown as Record<string, unknown>);
          if (!resp || resp.status >= 400) throw new Error('Error al crear producto');
          message.success('Producto creado exitosamente');
        }

      setModalVisible(false);
      form.resetFields();
      fetchProductos();
    } catch (error) {
      console.error('Error saving producto:', error);
      message.error('Error al guardar producto');
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id_producto',
      key: 'id_producto',
      width: 80,
    },
    {
      title: 'Nombre',
      dataIndex: 'nombre',
      key: 'nombre',
      width: 200,
    },
    {
      title: 'Categoría',
      dataIndex: 'categoria',
      key: 'categoria',
      width: 120,
    },
    {
      title: 'Precio',
      dataIndex: 'precio',
      key: 'precio',
      width: 100,
      render: (precio: number) => `$${precio.toFixed(2)}`,
    },
    {
      title: 'Stock',
      dataIndex: 'stock',
      key: 'stock',
      width: 80,
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
      title: 'Acciones',
      key: 'acciones',
      width: 150,
      render: (_: unknown, record: Producto) => (
        <div className="flex gap-2">
          <Button
            type="text"
            icon={<FaEye />}
            onClick={() => Modal.info({
              title: 'Detalles del Producto',
              content: (
                <div className="space-y-2">
                  <p><strong>Nombre:</strong> {record.nombre}</p>
                  <p><strong>Descripción:</strong> {record.descripcion}</p>
                  <p><strong>Precio:</strong> ${record.precio}</p>
                  <p><strong>Stock:</strong> {record.stock}</p>
                  <p><strong>Categoría:</strong> {record.categoria}</p>
                  <p><strong>Estado:</strong> {record.estado}</p>
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
            Gestión de Productos
          </h2>
          <p className="text-gray-600">
            Total de productos: <span className="font-semibold">{productos.length}</span>
          </p>
        </div>

        <Button
          type="primary"
          icon={<FaPlus />}
          onClick={handleAdd}
          style={{ backgroundColor: colors.primary, borderColor: colors.primary }}
        >
          Agregar Producto
        </Button>
      </div>

      {productos.length === 0 && !loading ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4" style={{ color: colors.accent }}>📦</div>
          <h3 className="text-xl font-semibold mb-2" style={{ color: colors.secondary }}>
            No hay productos registrados
          </h3>
          <p className="text-gray-600 mb-6">
            Comienza agregando tu primer producto al catálogo.
          </p>
          <Button
            type="primary"
            icon={<FaPlus />}
            onClick={handleAdd}
            style={{ backgroundColor: colors.primary, borderColor: colors.primary }}
          >
            Agregar primer producto
          </Button>
        </div>
      ) : (
        <Table
          columns={columns}
          dataSource={productos}
          rowKey="id_producto"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} de ${total} productos`
          }}
          scroll={{ x: 800 }}
        />
      )}

      <Modal
        title={editingProducto ? 'Editar Producto' : 'Agregar Producto'}
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
            label="Nombre del Producto"
            rules={[{ required: true, message: 'El nombre es requerido' }]}
          >
            <Input placeholder="Ingrese el nombre del producto" />
          </Form.Item>

          <Form.Item
            name="descripcion"
            label="Descripción"
            rules={[{ required: true, message: 'La descripción es requerida' }]}
          >
            <Input.TextArea
              placeholder="Ingrese la descripción del producto"
              rows={3}
            />
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="precio"
              label="Precio"
              rules={[{ required: true, message: 'El precio es requerido' }]}
            >
              <InputNumber<number>
                placeholder="0.00"
                min={0}
                step={0.01}
                className="w-full"
                formatter={(value) => value ? `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''}
                parser={(value) => value ? parseFloat(value.replace(/\$\s?|(,*)/g, '')) || 0 : 0}
              />
            </Form.Item>

            <Form.Item
              name="stock"
              label="Stock"
              rules={[{ required: true, message: 'El stock es requerido' }]}
            >
              <InputNumber
                placeholder="0"
                min={0}
                className="w-full"
              />
            </Form.Item>
          </div>

          <Form.Item
            name="categoria"
            label="Categoría"
            rules={[{ required: true, message: 'La categoría es requerida' }]}
          >
            <Select placeholder="Seleccione una categoría">
              <Select.Option value="hamburguesas">Hamburguesas</Select.Option>
              <Select.Option value="shucos">Shucos</Select.Option>
              <Select.Option value="papas">Papas</Select.Option>
              <Select.Option value="bebidas">Bebidas</Select.Option>
              <Select.Option value="acompañantes">Acompañantes</Select.Option>
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

          <Form.Item
            name="imagen_url"
            label="Imagen del Producto"
          >
            <Input placeholder="URL de la imagen (opcional)" />
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
              {editingProducto ? 'Actualizar' : 'Crear'} Producto
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProductosMantenimiento;
