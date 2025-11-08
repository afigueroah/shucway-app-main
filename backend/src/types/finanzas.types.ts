// ================================================================
// 📦 TIPOS DE FINANZAS
// ================================================================

export type CategoriaGasto =
  | 'Gastos de Personal'
  | 'Servicios Fijos (Mensuales)'
  | 'Insumos Operativos'
  | 'Gastos de Transporte'
  | 'Mantenimiento y Reemplazos';

export interface GastoOperativo {
  id_gasto: number;
  numero_gasto: string;
  nombre_gasto: string;
  categoria_gasto: CategoriaGasto;
  detalle: string;
  frecuencia: 'quincenal' | 'mensual';
  monto: number;
  estado: 'activo' | 'desactivado';
  fecha_gasto: Date;
  fecha_creacion: Date;
}

export interface DepositoBanco {
  id_deposito: number;
  fecha_deposito: Date;
  monto: number;
  banco: string;
  numero_cuenta?: string;
  id_responsable?: number;
  comprobante_url?: string;
  observaciones?: string;
}

export interface ArqueoCaja {
  id_arqueo: number;
  fecha_arqueo: Date;
  id_cajero?: number;
  efectivo_esperado: number;
  efectivo_contado: number;
  diferencia: number;
  observaciones?: string;
}

// ================================================================
// DTOs para Finanzas
// ================================================================

export interface CreateCategoriaGastoDTO {
  nombre_categoria: string;
  descripcion?: string;
}

export interface CreateGastoDTO {
  nombre_gasto: string;
  categoria_gasto: CategoriaGasto;
  detalle: string;
  frecuencia: 'quincenal' | 'mensual';
  monto: number;
  estado?: 'activo' | 'desactivado'; // Opcional, default 'activo'
}

export interface CreateDepositoDTO {
  fecha_deposito?: string;
  monto: number;
  banco: string;
  numero_cuenta?: string;
  comprobante_url?: string;
  observaciones?: string;
}

export interface CreateArqueoDTO {
  efectivo_contado: number;
  observaciones?: string;
}

export interface ResumenFinanciero {
  fecha_inicio: string;
  fecha_fin: string;
  total_ventas: number;
  total_gastos: number;
  total_depositos: number;
  diferencia_caja: number;
  utilidad_neta: number;
}
