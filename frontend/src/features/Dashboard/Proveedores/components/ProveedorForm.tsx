import React, { useState, useEffect } from 'react';
import { Form, Input, Select, Checkbox, Button, Space, notification } from 'antd';
import { saveProveedor } from '@/api/inventarioService';

interface Proveedor {
  id_proveedor?: number;
  nombre_empresa: string;
  nombre_contacto?: string;
  telefono?: string;
  correo?: string;
  direccion?: string;
  estado: boolean;
  metodo_entrega?: 'recoge_en_tienda' | 'envio_domicilio' | 'ambos';
  es_preferido: boolean;
}

interface ProveedorFormProps {
  proveedor?: Proveedor | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const ProveedorForm: React.FC<ProveedorFormProps> = ({
  proveedor,
  onSuccess,
  onCancel,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const isEditing = !!proveedor;

  useEffect(() => {
    if (proveedor) {
      form.setFieldsValue({
        nombre_empresa: proveedor.nombre_empresa,
        nombre_contacto: proveedor.nombre_contacto || '',
        telefono: proveedor.telefono || '',
        correo: proveedor.correo || '',
        direccion: proveedor.direccion || '',
        estado: proveedor.estado,
        metodo_entrega: proveedor.metodo_entrega || '',
        es_preferido: proveedor.es_preferido,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        estado: true,
        es_preferido: false,
      });
    }
  }, [proveedor, form]);

  const handleSubmit = async (values: {
    nombre_empresa: string;
    nombre_contacto?: string;
    telefono?: string;
    correo?: string;
    direccion?: string;
    estado: boolean;
    metodo_entrega?: string;
    es_preferido: boolean;
  }) => {
    setLoading(true);
    try {
      const proveedorData = {
        nombre: values.nombre_empresa,
        contacto: values.nombre_contacto || null,
        telefono: values.telefono || null,
        correo: values.correo || null,
        direccion: values.direccion || null,
        activo: values.estado,
        es_preferido: values.es_preferido,
        metodo_entrega: values.metodo_entrega || null,
      };

      if (isEditing && proveedor) {
        // Para editar, necesitamos incluir el id
        await saveProveedor({ ...proveedorData, id_proveedor: proveedor.id_proveedor });
        notification.success({
          message: 'Proveedor actualizado',
          description: `${proveedorData.nombre} se ha actualizado correctamente.`,
        });
      } else {
        // Para crear
        await saveProveedor(proveedorData);
        notification.success({
          message: 'Proveedor creado',
          description: `${proveedorData.nombre} se ha creado correctamente.`,
        });
      }

      onSuccess();
    } catch (error: unknown) {
      console.error('Error saving proveedor:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      notification.error({
        message: 'Error al guardar proveedor',
        description: errMsg || 'Ocurrió un error al guardar el proveedor. Intenta nuevamente.',
      });
    } finally {
      setLoading(false);
    }
  };

  const validateEmail = (_: unknown, value: string) => {
    if (!value) return Promise.resolve();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return Promise.reject('Ingrese un correo electrónico válido');
    }
    return Promise.resolve();
  };

  const validatePhone = (_: unknown, value: string) => {
    if (!value) return Promise.resolve();
    const phoneRegex = /^[+]?[0-9\s\-()]{7,}$/;
    if (!phoneRegex.test(value)) {
      return Promise.reject('Ingrese un número de teléfono válido');
    }
    return Promise.resolve();
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      className="space-y-4"
    >
      {/* Información Básica */}
      <div className="border-b pb-4 mb-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Información Básica</h3>

        <Form.Item
          label="Nombre de la Empresa"
          name="nombre_empresa"
          rules={[
            { required: true, message: 'El nombre de la empresa es requerido' },
            { min: 2, message: 'El nombre debe tener al menos 2 caracteres' },
            { max: 100, message: 'El nombre no puede exceder 100 caracteres' },
          ]}
        >
          <Input
            placeholder="Ingrese el nombre de la empresa"
            className="h-10"
          />
        </Form.Item>

        <Form.Item
          label="Nombre del Contacto"
          name="nombre_contacto"
          rules={[
            { max: 100, message: 'El nombre del contacto no puede exceder 100 caracteres' },
          ]}
        >
          <Input
            placeholder="Ingrese el nombre del contacto principal"
            className="h-10"
          />
        </Form.Item>
      </div>

      {/* Información de Contacto */}
      <div className="border-b pb-4 mb-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Información de Contacto</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Form.Item
            label="Teléfono"
            name="telefono"
            rules={[
              { validator: validatePhone },
              { max: 20, message: 'El teléfono no puede exceder 20 caracteres' },
            ]}
          >
            <Input
              placeholder="Ingrese el número de teléfono"
              className="h-10"
            />
          </Form.Item>

          <Form.Item
            label="Correo Electrónico"
            name="correo"
            rules={[
              { validator: validateEmail },
              { max: 100, message: 'El correo no puede exceder 100 caracteres' },
            ]}
          >
            <Input
              type="email"
              placeholder="correo@empresa.com"
              className="h-10"
            />
          </Form.Item>
        </div>

        <Form.Item
          label="Dirección"
          name="direccion"
          rules={[
            { max: 255, message: 'La dirección no puede exceder 255 caracteres' },
          ]}
        >
          <Input.TextArea
            placeholder="Ingrese la dirección completa"
            rows={3}
            className="resize-none"
          />
        </Form.Item>
      </div>

      {/* Configuración */}
      <div className="border-b pb-4 mb-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Configuración</h3>

        <Form.Item
          label="Método de Entrega"
          name="metodo_entrega"
        >
          <Select placeholder="Seleccione el método de entrega" className="h-10">
            <Select.Option value="">Sin especificar</Select.Option>
            <Select.Option value="recoge_en_tienda">Recoge en tienda</Select.Option>
            <Select.Option value="envio_domicilio">Envío a domicilio</Select.Option>
            <Select.Option value="ambos">Ambos</Select.Option>
          </Select>
        </Form.Item>

        <div className="space-y-3">
          <Form.Item name="estado" valuePropName="checked">
            <Checkbox>Proveedor activo</Checkbox>
          </Form.Item>

          <Form.Item name="es_preferido" valuePropName="checked">
            <Checkbox>Proveedor preferido</Checkbox>
          </Form.Item>
        </div>
      </div>

      {/* Botones */}
      <Form.Item className="mb-0">
        <Space className="w-full justify-end">
          <Button onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            style={{ backgroundColor: '#346C60', borderColor: '#346C60' }}
          >
            {isEditing ? 'Actualizar' : 'Crear'} Proveedor
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
};

export default ProveedorForm;