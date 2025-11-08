// ================================================================
// 📦 TIPOS DE COMPRAS Y PROVEEDORES
// ================================================================

export interface Proveedor {
  id_proveedor: number;
  nombre_empresa: string;
  contacto_principal?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  nit?: string;
  fecha_registro: Date;
  activo: boolean;
}

export interface OrdenCompra {
  id_orden: number;
  id_proveedor: number;
  fecha_orden: Date;
  fecha_entrega_estimada?: Date;
  estado: 'pendiente' | 'enviado' | 'recibido_parcial' | 'completado' | 'cancelado';
  id_responsable?: number;
  subtotal: number;
  impuestos: number;
  total: number;
  notas?: string;
}

export interface DetalleOrdenCompra {
  id_detalle: number;
  id_orden: number;
  id_insumo: number;
  cantidad_ordenada: number;
  precio_unitario: number;
  subtotal: number;
}

export interface RecepcionMercaderia {
  id_recepcion: number;
  id_orden: number;
  id_detalle_orden: number;
  cantidad_recibida: number;
  fecha_recepcion: Date;
  id_responsable?: number;
  observaciones?: string;
}

export interface BitacoraOrdenesCompra {
  id_bitacora: number;
  id_orden: number;
  operacion: 'INSERT' | 'UPDATE' | 'DELETE';
  datos_anteriores?: Record<string, unknown>;
  datos_nuevos?: Record<string, unknown>;
  id_perfil?: number;
  fecha_operacion: Date;
}

// ================================================================
// DTOs para Compras
// ================================================================

export interface CreateProveedorDTO {
  nombre_empresa: string;
  nombre_contacto?: string;
  telefono?: string;
  correo?: string;
  direccion?: string;
  metodo_entrega?: 'Recepcion' | 'Recoger en tienda';
}

export interface UpdateProveedorDTO {
  nombre_empresa?: string;
  nombre_contacto?: string;
  telefono?: string;
  correo?: string;
  direccion?: string;
  estado?: boolean;
  metodo_entrega?: 'Recepcion' | 'Recoger en tienda';
}

export interface CreateOrdenCompraDTO {
  id_proveedor: number;
  fecha_entrega_estimada?: string;
  notas?: string;
  detalles: CreateDetalleOrdenDTO[];
}

export interface CreateDetalleOrdenDTO {
  id_insumo: number;
  cantidad_ordenada: number;
  precio_unitario: number;
}

export interface CreateRecepcionDTO {
  id_orden: number;
  id_detalle_orden: number;
  cantidad_recibida: number;
  observaciones?: string;
}

export interface OrdenCompraCompleta extends OrdenCompra {
  detalles: DetalleOrdenCompra[];
  proveedor: Proveedor;
  responsable?: {
    id_perfil: number;
    nombre: string;
  };
  recepciones?: RecepcionMercaderia[];
}
