import { supabase } from './supabaseClient';
import { api } from './apiClient';

export interface Rol {
  id_rol: number;
  nombre_rol: string;
  descripcion: string | null;
  nivel_permisos: number;
  permisos?: Record<string, unknown>;
  activo: boolean;
  fecha_creacion: string;
}

export interface UsuarioRol {
  primer_nombre: string;
  segundo_nombre?: string;
  primer_apellido: string;
  segundo_apellido?: string;
  username: string;
}

export interface CreateRolDTO {
  nombre_rol: string;
  descripcion?: string;
  nivel_permisos: number;
  permisos?: Record<string, unknown>;
}

export interface UpdateRolDTO {
  nombre_rol?: string;
  descripcion?: string;
  nivel_permisos?: number;
  permisos?: Record<string, unknown>;
  activo?: boolean;
}

export interface RolesFilters {
  estado?: string;
  searchValue?: string;
}

export interface RolesResponse {
  data: Rol[];
  total: number;
}

export interface RolesStats {
  total: number;
  activos: number;
  inactivos: number;
}

export const getRoles = async (
  page?: number,
  pageSize?: number,
  filters?: RolesFilters
): Promise<RolesResponse> => {
  const params = new URLSearchParams();

  if (page) params.append('page', page.toString());
  if (pageSize) params.append('pageSize', pageSize.toString());
  if (filters?.estado) params.append('estado', filters.estado);
  if (filters?.searchValue) params.append('searchValue', filters.searchValue);

  const response = await api.get(`/usuarios/roles/all?${params.toString()}`);
  return {
    data: response.data.data || [],
    total: response.data.count || 0
  };
};

export const deleteRol = async (id: string): Promise<void> => {
  await api.delete(`/usuarios/roles/${id}`);
};

export const getRolesStats = async (): Promise<RolesStats> => {
  const { data, error } = await supabase
    .from('rol_usuario')
    .select('activo');

  if (error) throw error;

  const total = data.length;
  const activos = data.filter(rol => rol.activo).length;
  const inactivos = total - activos;

  return { total, activos, inactivos };
};

export const getUsuariosByRol = async (idRol: number): Promise<UsuarioRol[]> => {
  const response = await api.get(`/usuarios/roles/${idRol}/usuarios`);
  return response.data.data || [];
};

export const createRol = async (rolData: CreateRolDTO): Promise<Rol> => {
  const response = await api.post('/usuarios/roles', rolData);
  return response.data.data;
};

export const updateRol = async (idRol: number, rolData: UpdateRolDTO): Promise<Rol> => {
  const response = await api.put(`/usuarios/roles/${idRol}`, rolData);
  return response.data.data;
};
