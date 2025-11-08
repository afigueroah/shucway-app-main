import { supabase } from '../config/database';
import {
  Proveedor,
  CreateProveedorDTO,
  UpdateProveedorDTO,
} from '../types/compras.types';

// ================================================================
// 🛒 SERVICIO DE COMPRAS (PROVEEDORES)
// ================================================================

type InsumoPorProveedor = {
  id_presentacion: number;
  id_insumo: number;
  descripcion_presentacion: string;
  unidad_compra: string;
  unidades_por_presentacion: number;
  costo_compra_unitario: number;
  es_principal: boolean;
  activo: boolean;
  insumo: {
    id_insumo: number;
    nombre_insumo: string;
    unidad_base: string;
    costo_promedio: number | null;
    stock_minimo: number | null;
    categoria_insumo: {
      nombre: string;
    }[];
  }[];
};

export class ComprasService {
  // ================== PROVEEDORES ==================

  async getProveedores(): Promise<Proveedor[]> {
    const { data, error } = await supabase
      .from('proveedor')
      .select('*')
      .eq('estado', true)
      .order('nombre_empresa', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async getProveedorById(id: number): Promise<Proveedor | null> {
    const { data, error } = await supabase
      .from('proveedor')
      .select('*')
      .eq('id_proveedor', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // No encontrado
      throw error;
    }
    return data;
  }

  async createProveedor(dto: CreateProveedorDTO): Promise<Proveedor> {
    const { data, error } = await supabase
      .from('proveedor')
      .insert({
        nombre_empresa: dto.nombre_empresa,
        nombre_contacto: dto.nombre_contacto,
        telefono: dto.telefono,
        correo: dto.correo,
        direccion: dto.direccion,
        metodo_entrega: dto.metodo_entrega,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateProveedor(id: number, dto: UpdateProveedorDTO): Promise<Proveedor | null> {
    const { data, error } = await supabase
      .from('proveedor')
      .update({
        nombre_empresa: dto.nombre_empresa,
        nombre_contacto: dto.nombre_contacto,
        telefono: dto.telefono,
        correo: dto.correo,
        direccion: dto.direccion,
        estado: dto.estado,
        metodo_entrega: dto.metodo_entrega,
      })
      .eq('id_proveedor', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // No encontrado
      throw error;
    }
    return data;
  }

  async deleteProveedor(id: number): Promise<boolean> {
    const { error } = await supabase
      .from('proveedor')
      .delete()
      .eq('id_proveedor', id);

    if (error) throw error;
    return true;
  }

  async getInsumosByProveedor(idProveedor: number): Promise<InsumoPorProveedor[]> {
    const { data, error } = await supabase
      .from('insumo_presentacion')
      .select(`
        id_presentacion,
        id_insumo,
        descripcion_presentacion,
        unidad_compra,
        unidades_por_presentacion,
        costo_compra_unitario,
        es_principal,
        activo,
        insumo:insumo(id_insumo, nombre_insumo, unidad_base, costo_promedio, stock_minimo, categoria_insumo:categoria_insumo(nombre))
      `)
      .eq('id_proveedor', idProveedor)
      .eq('activo', true);

    if (error) throw new Error(`Error al obtener insumos del proveedor: ${error.message}`);
    return (data || []) as InsumoPorProveedor[];
  }
}

export const comprasService = new ComprasService();