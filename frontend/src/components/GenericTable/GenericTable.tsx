import React, { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Space, Modal, Form, message, Popconfirm, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, FilterOutlined } from '@ant-design/icons';
import { GenericMaintenanceService, TableMetadata, QueryParams, formatFieldValue, FieldMetadata } from '@/api/generic-maintenance.service';
import type { ColumnsType } from 'antd/es/table';

interface GenericTableProps {
  tableName: string;
  title?: string;
  pageSize?: number;
  showCreateButton?: boolean;
  showEditButton?: boolean;
  showDeleteButton?: boolean;
  showSearch?: boolean;
  showFilters?: boolean;
  customActions?: (record: RecordData) => React.ReactNode;
}

interface RecordData {
  [key: string]: unknown;
}

// ================================================================
// 📊 COMPONENTE DE TABLA GENÉRICA
// ================================================================

export const GenericTable: React.FC<GenericTableProps> = ({
  tableName,
  title,
  pageSize = 10,
  showCreateButton = true,
  showEditButton = true,
  showDeleteButton = true,
  showSearch = true,
  showFilters = true,
  customActions
}) => {
  // Estados
  const [metadata, setMetadata] = useState<TableMetadata | null>(null);
  const [data, setData] = useState<RecordData[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize,
    total: 0,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total: number, range: [number, number]) =>
      `${range[0]}-${range[1]} de ${total} registros`
  });

  // Estados para búsqueda y filtros
  const [searchValue, setSearchValue] = useState('');

  // Estados para modales
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<RecordData | null>(null);
  const [form] = Form.useForm();

  // ================================================================
  // 🔄 FUNCIONES DE CARGA DE DATOS
  // ================================================================

  // Cargar metadatos de la tabla
  const loadMetadata = useCallback(async () => {
    try {
      const tableMetadata = await GenericMaintenanceService.getTableMetadata(tableName);
      setMetadata(tableMetadata);
    } catch (error) {
      message.error(`Error al cargar metadatos de la tabla ${tableName}`);
      console.error('Error loading metadata:', error);
    }
  }, [tableName]);

  // Cargar datos de la tabla
  const loadData = useCallback(async (params: QueryParams = {}) => {
    if (!metadata) return;

    setLoading(true);
    try {
      const queryParams: QueryParams = {
        page: params.page || pagination.current,
        pageSize: params.pageSize || pagination.pageSize,
        search: searchValue || undefined,
        ...params
      };

      const result = await GenericMaintenanceService.getRecords(tableName, queryParams);

      setData(result.data);
      setPagination(prev => ({
        ...prev,
        current: result.page,
        pageSize: result.pageSize,
        total: result.total
      }));
    } catch (error) {
      message.error('Error al cargar los datos');
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [metadata, searchValue, tableName, pagination]);

  // ================================================================
  // 🎯 FUNCIONES CRUD
  // ================================================================

  // Crear registro
  const handleCreate = async (values: RecordData) => {
    if (!metadata) return;

    try {
      await GenericMaintenanceService.createRecord(tableName, values);
      message.success('Registro creado exitosamente');
      setCreateModalVisible(false);
      form.resetFields();
      loadData();
    } catch (error) {
      message.error('Error al crear el registro');
      console.error('Error creating record:', error);
    }
  };

  // Actualizar registro
  const handleUpdate = async (values: RecordData) => {
    if (!metadata || !editingRecord) return;

    try {
      const id = editingRecord[metadata.primaryKey] as number;
      await GenericMaintenanceService.updateRecord(tableName, id, values);
      message.success('Registro actualizado exitosamente');
      setEditModalVisible(false);
      setEditingRecord(null);
      form.resetFields();
      loadData();
    } catch (error) {
      message.error('Error al actualizar el registro');
      console.error('Error updating record:', error);
    }
  };

  // Eliminar registro
  const handleDelete = async (record: RecordData) => {
    if (!metadata) return;

    try {
      const id = record[metadata.primaryKey] as number;
      await GenericMaintenanceService.deleteRecord(tableName, id, metadata.primaryKey);
      message.success('Registro eliminado exitosamente');
      loadData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido al eliminar el registro';
      message.error(`Error al eliminar el registro: ${errorMessage}`);
      console.error('Error deleting record:', error);
    }
  };

  // ================================================================
  // 🎨 FUNCIONES DE RENDERIZADO
  // ================================================================

  // Generar columnas dinámicamente
  const generateColumns = (): ColumnsType<RecordData> => {
    if (!metadata) return [];

    const columns: ColumnsType<RecordData> = metadata.fields
      .filter((field: FieldMetadata) => !field.hidden)
      .map((field: FieldMetadata) => ({
        title: field.label,
        dataIndex: field.name,
        key: field.name,
        sorter: true, // Simplificado
        render: (value: unknown) => {
          if (field.type === 'boolean') {
            return <Tag color={value ? 'green' : 'red'}>{value ? 'Sí' : 'No'}</Tag>;
          }
          return formatFieldValue(value, field.type);
        }
      }));

    // Agregar columna de acciones
    if (showEditButton || showDeleteButton || customActions) {
      columns.push({
        title: 'Acciones',
        key: 'actions',
        fixed: 'right',
        width: 150,
        render: (_: unknown, record: RecordData) => (
          <Space size="small">
            {showEditButton && (
              <Button
                type="link"
                icon={<EditOutlined />}
                onClick={() => {
                  setEditingRecord(record);
                  form.setFieldsValue(record);
                  setEditModalVisible(true);
                }}
              >
                Editar
              </Button>
            )}
            {showDeleteButton && (
              <Popconfirm
                title="¿Está seguro de eliminar este registro?"
                onConfirm={() => handleDelete(record)}
                okText="Sí"
                cancelText="No"
              >
                <Button type="link" danger icon={<DeleteOutlined />}>
                  Eliminar
                </Button>
              </Popconfirm>
            )}
            {customActions && customActions(record)}
          </Space>
        )
      });
    }

    return columns;
  };

  // Generar campos del formulario dinámicamente
  const generateFormFields = () => {
    if (!metadata) return null;

    return metadata.fields
      .filter((field: FieldMetadata) => !field.readonly && !field.hidden)
      .map((field: FieldMetadata) => {
        let inputComponent;

        switch (field.type) {
          case 'select':
            inputComponent = (
              <Select placeholder={`Seleccione ${field.label.toLowerCase()}`}>
                {field.options?.map((option: { value: string | number; label: string }) => (
                  <Select.Option key={String(option.value)} value={option.value}>
                    {option.label}
                  </Select.Option>
                ))}
              </Select>
            );
            break;
          case 'textarea':
            inputComponent = <Input.TextArea rows={4} />;
            break;
          case 'boolean':
            inputComponent = <Select placeholder={`Seleccione ${field.displayName || field.label}`}>
              <Select.Option value={true}>Sí</Select.Option>
              <Select.Option value={false}>No</Select.Option>
            </Select>;
            break;
          case 'date':
            inputComponent = <Input type="date" />;
            break;
          case 'number':
            inputComponent = <Input type="number" />;
            break;
          case 'email':
            inputComponent = <Input type="email" />;
            break;
          case 'password':
            inputComponent = <Input.Password />;
            break;
          default:
            inputComponent = <Input />;
        }

        return (
          <Form.Item
            key={field.name}
            name={field.name}
            label={field.displayName}
            rules={[
              { required: field.required, message: `El campo ${field.displayName} es requerido` },
              ...(field.maxLength ? [{ max: field.maxLength, message: `Máximo ${field.maxLength} caracteres` }] : []),
              ...(field.minLength ? [{ min: field.minLength, message: `Mínimo ${field.minLength} caracteres` }] : []),
              ...(field.pattern ? [{ pattern: new RegExp(field.pattern), message: `Formato inválido` }] : [])
            ]}
          >
            {inputComponent}
          </Form.Item>
        );
      });
  };

  // ================================================================
  // 🎣 EFECTOS
  // ================================================================

  // Cargar metadatos al montar el componente
  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  // Cargar datos cuando cambian los metadatos
  useEffect(() => {
    if (metadata) {
      loadData();
    }
  }, [metadata, loadData]);

  // ================================================================
  // 🎨 RENDERIZADO
  // ================================================================

  if (!metadata) {
    return <div>Cargando metadatos...</div>;
  }

  return (
    <div>
      {/* Header con título y controles */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>{title || metadata.displayName}</h2>

        <Space>
          {/* Búsqueda */}
          {showSearch && (
            <Input
              placeholder="Buscar..."
              prefix={<SearchOutlined />}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onPressEnter={() => loadData()}
              style={{ width: 200 }}
            />
          )}

          {/* Filtros adicionales */}
          {showFilters && metadata.filterableFields.length > 0 && (
            <Button icon={<FilterOutlined />}>
              Filtros
            </Button>
          )}

          {/* Botón crear */}
          {showCreateButton && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalVisible(true)}
            >
              Nuevo {metadata.displayName.toLowerCase()}
            </Button>
          )}
        </Space>
      </div>

      {/* Tabla */}
      <Table
        columns={generateColumns()}
        dataSource={data}
        rowKey={metadata.primaryKey}
        loading={loading}
        pagination={pagination}
        onChange={(paginationInfo) => {
          loadData({
            page: paginationInfo.current,
            pageSize: paginationInfo.pageSize
          });
        }}
        scroll={{ x: 'max-content' }}
      />

      {/* Modal Crear */}
      <Modal
        title={`Crear ${metadata.displayName}`}
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
        >
          {generateFormFields()}
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Crear
              </Button>
              <Button onClick={() => {
                setCreateModalVisible(false);
                form.resetFields();
              }}>
                Cancelar
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Editar */}
      <Modal
        title={`Editar ${metadata.displayName}`}
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingRecord(null);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleUpdate}
        >
          {generateFormFields()}
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Actualizar
              </Button>
              <Button onClick={() => {
                setEditModalVisible(false);
                setEditingRecord(null);
                form.resetFields();
              }}>
                Cancelar
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};