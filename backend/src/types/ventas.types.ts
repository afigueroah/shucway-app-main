// ================================================================
// 📦 TIPOS DE VENTAS Y CLIENTES
// ================================================================

export interface Cliente {
  id_cliente: number;
  nombre: string;
  telefono?: string;
  direccion?: string;
  puntos_acumulados: number;
  fecha_registro: Date;
  ultima_compra?: Date;
}

export interface Venta {
  id_venta: number;
  id_cliente?: number;
  fecha_venta: Date;
  tipo_pago: 'Cash' | 'Paggo' | 'Tarjeta' | 'Transferencia' | 'Canje' | 'Cupon';
  estado: 'pendiente' | 'confirmada' | 'completada' | 'cancelada';
  estado_transferencia?: 'esperando' | 'recibido';
  id_cajero?: number;
  total_venta: number;
  total_costo: number;
  ganancia: number;
  notas?: string;
  productos_resumen?: string;
}

export interface DetalleVenta {
  id_detalle: number;
  id_venta: number;
  id_producto?: number;
  id_variante?: number;
  cantidad: number;
  precio_unitario: number;
  costo_unitario: number;
  subtotal: number;
  costo_total: number;
  ganancia: number;
  descuento: number;
  es_canje_puntos: boolean;
  puntos_canjeados: number;
}

export interface HistorialPuntos {
  id_historial: number;
  id_cliente: number;
  tipo_movimiento: 'acumulacion' | 'canje' | 'expiracion' | 'ajuste';
  puntos: number;
  id_venta?: number;
  descripcion?: string;
  fecha_movimiento: Date;
}

export interface BitacoraVentas {
  id_bitacora: number;
  id_venta: number;
  operacion: 'INSERT' | 'UPDATE' | 'DELETE';
  datos_anteriores?: Record<string, unknown>;
  datos_nuevos?: Record<string, unknown>;
  id_perfil?: number;
  fecha_operacion: Date;
}

// ================================================================
// DTOs para Ventas
// ================================================================

export interface CreateVentaDTO {
  id_cliente?: number;
  tipo_pago: 'Cash' | 'Paggo' | 'Tarjeta' | 'Transferencia' | 'Canje' | 'Cupon';
  puntos_usados?: number;
  acumula_puntos?: boolean;
  notas?: string;
  detalles: CreateDetalleVentaDTO[];
  // Información adicional para transferencias
  numero_referencia?: string;
  nombre_banco?: string;
}

export interface CreateDetalleVentaDTO {
  id_producto?: number;
  id_variante?: number;
  cantidad: number;
  precio_unitario: number;
  descuento?: number;
  es_canje_puntos?: boolean;
  puntos_canjeados?: number;
}

export interface CreateClienteDTO {
  nombre: string;
  telefono?: string;
  direccion?: string;
}

export interface UpdateClienteDTO {
  nombre?: string;
  telefono?: string;
  direccion?: string;
}

export interface CanjearPuntosDTO {
  id_cliente: number;
  puntos_a_canjear: number;
  descripcion?: string;
}

export interface GestionarPuntosDTO {
  operacion: 'agregar' | 'restar';
  cantidad: number;
  motivo?: string;
}

export interface VentaCompleta extends Venta {
  detalles: DetalleVenta[];
  cliente?: Cliente;
  cajero?: {
    id_perfil: number;
    nombre: string;
  };
}

export interface ProductoPopular {
  id_producto: number;
  nombre_producto: string;
  total_vendido: number;
  veces_vendido: number;
  categoria: string;
  imagen_url?: string;
}
