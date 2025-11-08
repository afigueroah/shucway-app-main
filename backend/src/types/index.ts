import { Request } from 'express';

// ==================== AUTH ====================

// Usuario autenticado
export interface AuthUser {
  id_perfil: number;
  email: string;
  rol: string;
}

// Request con usuario autenticado
export interface AuthRequest extends Request {
  user?: AuthUser;
}

// Respuesta estándar de la API
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Paginación
export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ==================== USUARIOS ====================

// Perfil de Usuario (según tu BD-modificado.sql)
export interface PerfilUsuario {
  id_perfil: number;
  email: string;
  password_hash?: string;
  primer_nombre: string;
  segundo_nombre?: string;
  primer_apellido: string;
  segundo_apellido?: string;
  telefono?: string;
  direccion?: string;
  fecha_nacimiento?: string;
  username?: string;
  avatar_url?: string;
  id_rol: number;
  estado: 'activo' | 'inactivo' | 'suspendido' | 'eliminado';
  fecha_registro: string;
  ultimo_acceso?: string;
}

// Rol de Usuario
export interface RolUsuario {
  id_rol: number;
  nombre_rol: 'cliente' | 'cajero' | 'administrador' | 'propietario';
  descripcion?: string;
  nivel_permisos: number;
  permisos?: Record<string, unknown>;
  activo: boolean;
}

// Usuario con rol
export interface UsuarioConRol extends Omit<PerfilUsuario, 'password_hash'> {
  rol: RolUsuario;
}

// Login
export interface LoginCredentials {
  identifier: string;
  password: string;
}

export interface LoginResponse {
  user: UsuarioConRol;
  token: string;
  refreshToken: string;
}

// Filtros para usuarios
export interface UsuarioFilters {
  primer_nombre?: string;
  email?: string;
  estado?: string;
  rol?: string;
}

// ==================== STORAGE ====================

// Opciones de subida de archivo
export interface UploadOptions {
  bucket: string;
  folder?: string;
  fileName?: string;
  contentType?: string;
}

// Respuesta de subida de archivo
export interface UploadResponse {
  path: string;
  publicUrl: string;
}

// ==================== DASHBOARD ====================

// Datos de estadísticas del dashboard
export interface StatsData {
  ventas: {
    total: number;
    change: number;
  };
  inventario: {
    total: number;
    change: number;
  };
  clientes: {
    total: number;
    change: number;
  };
  ganancias: {
    total: number;
    change: number;
  };
}

export interface InventoryItem {
  id?: number;
  name: string;
  qty?: string;
  note?: string;
  categoriaNombre?: string;
}

export interface Insumo {
  id_insumo: number;
  nombre_insumo: string;
  id_categoria: number;
  activo: boolean;
  unidad_base?: string;
  stock_minimo?: number;
  stock?: number;
}
