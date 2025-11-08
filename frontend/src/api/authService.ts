// ============================================================
// OBTENER PERFIL COMPLETO DEL USUARIO AUTENTICADO
// ============================================================
export const getProfile = async () => {
  try {
    const response = await api.get('/auth/profile');
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.message || 'No se pudo obtener el perfil');
  } catch (error) {
    console.error('Error al obtener perfil:', error);
    throw error;
  }
};
// ================================================================
// 🔐 SERVICIO DE AUTENTICACIÓN
// ================================================================
// Maneja login, logout, registro y validación de token

import { message } from 'antd';
import api from './apiClient';
import { localStore, cookieStore } from '../utils/storage';

// Interfaces
export interface LoginCredentials {
  identifier: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  primer_nombre: string;
  primer_apellido: string;
  segundo_nombre?: string;
  segundo_apellido?: string;
  telefono?: string;
  direccion?: string;
  fecha_nacimiento?: string;
  username?: string;
}

export interface AuthUser {
  id_perfil: number;
  nombre: string;
  email: string;
  username: string;
  role: {
    id_rol: number;
    nombre_rol: string;
    nivel_permisos: number;
  };
  avatar_url?: string | null;
  estado?: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    refreshToken: string;
    user: AuthUser;
  };
}

// ============================================================
// LOGIN
// ============================================================
export const login = async (credentials: LoginCredentials): Promise<boolean> => {
  try {
    const response = await api.post<LoginResponse>('/auth/login', credentials);
    if (response.data.success) {
      const { token, refreshToken, user } = response.data.data;

      // Guardar en localStorage con expiración (7 días para token, 30 días para refresh)
      localStore.set('access_token', token, { expires: 60 * 24 * 7 }); // 7 días
      localStore.set('refreshToken', refreshToken, { expires: 60 * 24 * 30 }); // 30 días
      localStore.set('user', user, { expires: 60 * 24 * 7 }); // 7 días

      // También guardar en cookies para persistencia adicional
      cookieStore.set('auth_session', JSON.stringify({ token, user }), {
        expires: 60 * 24 * 7, // 7 días
        secure: true,
        sameSite: 'strict'
      });

      message.success('¡Sesión iniciada correctamente!');
      return true;
    }
    message.error(response.data.message || 'Error al iniciar sesión');
    return false;
  } catch (error: unknown) {
    console.error('Error en login:', error);
    const errorMessage = error instanceof Error && 'response' in error
      ? (error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Error al iniciar sesión'
      : 'Error al iniciar sesión';
    message.error(errorMessage);
    return false;
  }
};

// ============================================================
// LOGOUT
// ============================================================
export const logout = async (): Promise<void> => {
  try {
    await api.post('/auth/logout');
  } catch (error) {
    console.error('Error en logout:', error);
  } finally {
    // Limpiar localStorage y cookies
    localStore.remove('access_token');
    localStore.remove('refreshToken');
    localStore.remove('user');
    cookieStore.remove('auth_session');
    message.success('Sesión cerrada correctamente');
  }
};

// ============================================================
// REGISTRO
// ============================================================
export const register = async (data: RegisterData): Promise<boolean> => {
  try {
    const response = await api.post<LoginResponse>('/auth/register', data);

    if (response.data.success) {
      const { token, refreshToken, user } = response.data.data;

      // Guardar en localStorage con expiración
      localStore.set('access_token', token, { expires: 60 * 24 * 7 }); // 7 días
      localStore.set('refreshToken', refreshToken, { expires: 60 * 24 * 30 }); // 30 días
      localStore.set('user', user, { expires: 60 * 24 * 7 }); // 7 días

      // También guardar en cookies para persistencia adicional
      cookieStore.set('auth_session', JSON.stringify({ token, user }), {
        expires: 60 * 24 * 7, // 7 días
        secure: true,
        sameSite: 'strict'
      });

      message.success('¡Registro exitoso!');
      return true;
    }

    message.error(response.data.message || 'Error al registrar usuario');
    return false;
  } catch (error: unknown) {
    console.error('Error en registro:', error);
    const errorMessage = error instanceof Error && 'response' in error
      ? (error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Error al registrar usuario'
      : 'Error al registrar usuario';
    message.error(errorMessage);
    return false;
  }
};

// ============================================================
// VALIDAR TOKEN
// ============================================================
export const validateToken = async (): Promise<AuthUser | null> => {
  try {
    const token = localStore.get<string>('access_token');
    if (!token) {
      return null;
    }

    const response = await api.get<{ success: boolean; data: AuthUser }>('/auth/validate', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (response.data.success) {
      // Actualizar usuario en localStorage
      localStore.set('user', response.data.data, { expires: 60 * 24 * 7 }); // 7 días
      return response.data.data;
    }

    return null;
  } catch (error) {
    console.error('Error al validar token:', error);
    // Limpiar storage si el token es inválido
    localStore.remove('access_token');
    localStore.remove('user');
    cookieStore.remove('auth_session');
    return null;
  }
};

// ============================================================
// OBTENER USUARIO ACTUAL DEL STORAGE
// ============================================================
export const getCurrentUser = (): AuthUser | null => {
  try {
    return localStore.get<AuthUser>('user');
  } catch (error) {
    console.error('Error al obtener usuario actual:', error);
    return null;
  }
};

// ============================================================
// VERIFICAR SI ESTÁ AUTENTICADO
// ============================================================
export const isAuthenticated = (): boolean => {
  const token = localStore.get<string>('access_token');
  const user = getCurrentUser();
  return !!(token && user);
};
