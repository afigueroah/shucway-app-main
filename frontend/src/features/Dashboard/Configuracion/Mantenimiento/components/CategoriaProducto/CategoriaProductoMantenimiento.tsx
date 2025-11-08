import React, { useEffect, useState } from 'react';
import api from '@/api/apiClient';
import { Button, Table, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';

interface CategoriaProducto {
  id_categoria: number;
  nombre: string;
  descripcion: string | null;
  orden_visual: number;
  activo: boolean;
  color: string;
}

const CategoriaProductoMantenimiento: React.FC = () => {
  const [categorias, setCategorias] = useState<CategoriaProducto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategorias();
  }, []);

  const fetchCategorias = async () => {
    try {
      const resp = await api.get(`/dashboard/table-data/categoria_producto?limit=1000`);
      if (!resp || resp.status >= 400) throw new Error('Error al cargar categorías');
      const js = resp.data || {};
      const rows = js.data || [];
      setCategorias(rows as CategoriaProducto[]);
    } catch (error) {
      message.error('Error al cargar las categorías');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const columns: ColumnsType<CategoriaProducto> = [
    {
      title: 'Nombre',
      dataIndex: 'nombre',
      key: 'nombre',
    },
    {
      title: 'Descripción',
      dataIndex: 'descripcion',
      key: 'descripcion',
    },
    {
      title: 'Orden',
      dataIndex: 'orden_visual',
      key: 'orden_visual',
    },
    {
      title: 'Color',
      dataIndex: 'color',
      key: 'color',
      render: (color: string) => (
        <div
          style={{
            backgroundColor: color,
            width: '20px',
            height: '20px',
            borderRadius: '4px'
          }}
        />
      )
    },
    {
      title: 'Estado',
      dataIndex: 'activo',
      key: 'activo',
      render: (activo: boolean) => activo ? 'Activo' : 'Inactivo'
    }
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Categorías de Productos</h2>
        <Button type="primary">
          Agregar Categoría
        </Button>
      </div>
      <Table
        columns={columns}
        dataSource={categorias}
        loading={loading}
        rowKey="id_categoria"
      />
    </div>
  );
};

export default CategoriaProductoMantenimiento;
