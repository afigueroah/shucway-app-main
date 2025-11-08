// ================================================================
// 📦 TIPOS DE REPORTES
// ================================================================

export interface ReporteVentas {
  fecha_inicio: string;
  fecha_fin: string;
  total_ventas: number;
  cantidad_ventas: number;
  ticket_promedio: number;
  ventas_por_dia: VentaPorDia[];
  ventas_por_producto: VentaPorProducto[];
  ventas_por_cajero: VentaPorCajero[];
}

export interface VentaPorDia {
  fecha: string;
  total: number;
  cantidad: number;
}

export interface VentaPorProducto {
  id_producto: number;
  nombre_producto: string;
  cantidad_vendida: number;
  total_vendido: number;
}

export interface VentaPorCajero {
  id_cajero: number;
  nombre_cajero: string;
  cantidad_ventas: number;
  total_vendido: number;
}

export interface ReporteInventario {
  fecha_reporte: string;
  insumos_bajo_stock: InsumoStockBajo[];
  insumos_vencimiento_proximo: InsumoVencimientoProximo[];
  movimientos_recientes: MovimientoReciente[];
  valor_total_inventario: number;
}

export interface InsumoStockBajo {
  id_insumo: number;
  nombre_insumo: string;
  cantidad_actual: number;
  stock_minimo: number;
  diferencia: number;
}

export interface InsumoVencimientoProximo {
  id_lote: number;
  id_insumo: number;
  nombre_insumo: string;
  cantidad_actual: number;
  fecha_vencimiento: string;
  dias_hasta_vencimiento: number;
}

export interface MovimientoReciente {
  fecha_movimiento: string;
  tipo_movimiento: string;
  nombre_insumo: string;
  cantidad: number;
  responsable?: string;
}

export interface ReporteFinanciero {
  fecha_inicio: string;
  fecha_fin: string;
  ingresos_totales: number;
  gastos_totales: number;
  utilidad_bruta: number;
  gastos_por_categoria: GastoPorCategoria[];
  depositos: DepositoResumen[];
  arqueos: ArqueoResumen[];
}

export interface GastoPorCategoria {
  nombre_categoria: string;
  total: number;
  cantidad: number;
}

export interface DepositoResumen {
  fecha_deposito: string;
  monto: number;
  banco: string;
}

export interface ArqueoResumen {
  fecha_arqueo: string;
  efectivo_esperado: number;
  efectivo_contado: number;
  diferencia: number;
}

// ================================================================
// DTOs para Reportes
// ================================================================

export interface GenerarReporteVentasDTO {
  fecha_inicio: string;
  fecha_fin: string;
  id_cajero?: number;
  id_producto?: number;
}

export interface GenerarReporteInventarioDTO {
  mostrar_bajo_stock?: boolean;
  mostrar_vencimientos?: boolean;
  dias_vencimiento?: number;
}

export interface GenerarReporteFinancieroDTO {
  fecha_inicio: string;
  fecha_fin: string;
  incluir_gastos?: boolean;
  incluir_depositos?: boolean;
  incluir_arqueos?: boolean;
}
