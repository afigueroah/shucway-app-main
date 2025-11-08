export interface OrdenCompra {
  id_orden?: number;
  fecha_orden: string;
  id_proveedor: number;
  estado?: string;
  tipo_orden?: string;
  motivo_generacion?: string;
  fecha_entrega_estimada?: string;
  total?: number;
  creado_por?: number;
  aprobado_por?: number;
}

export interface DetalleOrdenCompra {
  id_detalle?: number;
  id_orden: number;
  id_insumo: number;
  cantidad: number;
  precio_unitario: number;
  subtotal?: number;
  iva?: number;
  id_presentacion?: number;
  cantidad_recibida?: number;
}
