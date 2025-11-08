import { api } from './apiClient';

// ================================================================
// 👥 SERVICIO DE USUARIOS - FRONTEND
// ================================================================

// Ya no necesitamos getAuthHeaders porque api (apiClient) ya incluye el token automáticamente

// ================================================================
// 📦 TIPOS E INTERFACES
// ================================================================

export interface PerfilUsuario {
  id_perfil: number;
  nombre: string;
  email: string;
  username: string;
  telefono?: string;
  direccion?: string;
  fecha_nacimiento?: string;
  avatar_url?: string;
  estado: 'activo' | 'inactivo' | 'suspendido' | 'eliminado';
  fecha_registro: Date;
  ultimo_acceso?: Date;
  primer_nombre?: string;
  segundo_nombre?: string;
  primer_apellido?: string;
  segundo_apellido?: string;
}

export interface PerfilConRoles extends PerfilUsuario {
  roles: string;
  nivel_permisos: number;
}

export interface UpdateUsuarioDTO {
  nombre?: string;
  telefono?: string;
  direccion?: string;
  fecha_nacimiento?: string;
  avatar_url?: string;
  primer_nombre?: string;
  segundo_nombre?: string;
  primer_apellido?: string;
  segundo_apellido?: string;
  estado?: string;
  password?: string; // contraseña en texto plano; será enviada al backend para hashear
  email?: string;
  username?: string;
}

export interface UsuariosFilters {
  estado?: string;
  searchValue?: string;
  telefono?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
}

export interface GetUsuariosResponse {
  success: boolean;
  data: PerfilConRoles[];
  count: number;
  page: number;
  pageSize: number;
}

export interface Estadisticas {
  total: number;
  activos: number;
  inactivos: number;
  nuevosEsteMes: number;
}

// ================================================================
// 🔌 FUNCIONES API
// ================================================================

/**
 * Obtener usuarios con paginación y filtros
 */
export const getUsuarios = async (
  page: number = 1,
  pageSize: number = 10,
  filters?: UsuariosFilters
): Promise<GetUsuariosResponse> => {
  try {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('pageSize', pageSize.toString());

    if (filters) {
      if (filters.estado) params.append('estado', filters.estado);
      if (filters.searchValue) params.append('searchValue', filters.searchValue);
      if (filters.telefono) params.append('telefono', filters.telefono);
      if (filters.fecha_inicio) params.append('fecha_inicio', filters.fecha_inicio);
      if (filters.fecha_fin) params.append('fecha_fin', filters.fecha_fin);
    }

    const token = localStorage.getItem('token');
    const response = await api.get(`/usuarios?${params.toString()}`, {
      headers: { Authorization: token ? `Bearer ${token}` : '' }
    });
    return response.data;
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    throw error;
  }
};

/**
 * Obtener usuario por ID
 */
export const getUsuarioById = async (id: number): Promise<PerfilConRoles> => {
  try {
    const response = await api.get(`/usuarios/${id}`);
    return response.data.data;
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    throw error;
  }
};

/**
 * Actualizar usuario
 */
export const updateUsuario = async (id: number, data: UpdateUsuarioDTO): Promise<PerfilUsuario> => {
  try {
    const response = await api.put(`/usuarios/${id}`, data);
    return response.data.data;
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    throw error;
  }
};

/**
 * Cambiar estado de usuario
 */
export const cambiarEstado = async (
  id: number,
  estado: 'activo' | 'inactivo' | 'suspendido' | 'eliminado'
): Promise<PerfilUsuario> => {
  try {
    const response = await api.patch(`/usuarios/${id}/estado`, { estado });
    return response.data.data;
  } catch (error) {
    console.error('Error al cambiar estado:', error);
    throw error;
  }
};

/**
 * Eliminar usuario (soft delete)
 */
export const deleteUsuario = async (id: number): Promise<void> => {
  try {
    await api.delete(`/usuarios/${id}`);
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    throw error;
  }
};

/**
 * Obtener roles de un usuario
 */
export const getRolesByUsuario = async (id: number) => {
  try {
    const response = await api.get(`/usuarios/${id}/roles`);
    return response.data.data;
  } catch (error) {
    console.error('Error al obtener roles:', error);
    throw error;
  }
};

/**
 * Asignar rol a usuario
 */
export const asignarRol = async (idUsuario: number, idRol: number): Promise<void> => {
  try {
    await api.post(`/usuarios/${idUsuario}/roles`, { idRol });
  } catch (error) {
    console.error('Error al asignar rol:', error);
    throw error;
  }
};

/**
 * Remover rol de usuario
 */
export const removerRol = async (idUsuario: number): Promise<void> => {
  try {
    await api.delete(`/usuarios/${idUsuario}/roles`);
  } catch (error) {
    console.error('Error al remover rol:', error);
    throw error;
  }
};

/**
 * Obtener estadísticas de usuarios
 */
export const getEstadisticas = async (): Promise<Estadisticas> => {
  try {
    const token = localStorage.getItem('token');
    const response = await api.get(`/usuarios/estadisticas`, {
      headers: { Authorization: token ? `Bearer ${token}` : '' }
    });
    return response.data.data;
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    throw error;
  }
};

/**
 * Verificar si un email ya existe
 */
export const checkEmailExists = async (email: string, excludeId?: number): Promise<boolean> => {
  try {
    const params: Record<string, string | number> = { email };
    if (excludeId !== undefined) params.excludeId = excludeId;

    const response = await api.get(`/usuarios/check-email`, {
      params,
    });
    return response.data.exists;
  } catch (error) {
    console.error('Error al verificar email:', error);
    throw error;
  }
};

/**
 * Verificar si un username ya existe
 */
export const checkUsernameExists = async (username: string, excludeId?: number): Promise<boolean> => {
  try {
    const params: Record<string, string | number> = { username };
    if (excludeId !== undefined) params.excludeId = excludeId;

    const response = await api.get(`/usuarios/check-username`, {
      params,
    });
    return response.data.exists;
  } catch (error) {
    console.error('Error al verificar username:', error);
    throw error;
  }
};
