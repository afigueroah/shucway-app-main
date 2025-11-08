// ================================================================
// 🔧 CONFIGURACIÓN DEL CLIENTE API
// ================================================================
// Este archivo configura axios para comunicarse con el backend

import axios from 'axios';
import { localStore, cookieStore } from '../utils/storage';

// URL del backend
const API_URL = (import.meta.env.VITE_API_URL || '/api').trim();

// Solo log en desarrollo
if (import.meta.env.DEV) {
  console.log('[API_URL]', API_URL);
}

// Crear instancia de axios
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false,
});

// Interceptor para agregar el token JWT a todas las peticiones
api.interceptors.request.use(
  (config) => {
    const token = localStore.get<string>('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar errores de autenticación
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token inválido o expirado
      // Evitar recargar/redirigir si ya estamos en la página de login
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
      const requestUrl = error.config?.url || '';

      // Si la petición fue la de login (o ya estamos en /login), no forzar redirect aquí;
      // eso permite que la vista (p.ej. Login) maneje la presentación de errores/notifications.
      if (currentPath === '/login' || requestUrl.includes('/auth/login')) {
        // Limpiar storage pero no forzar navegación
        localStore.remove('access_token');
        localStore.remove('refreshToken');
        localStore.remove('user');
        cookieStore.remove('auth_session');
      } else {
        localStore.remove('access_token');
        localStore.remove('refreshToken');
        localStore.remove('user');
        cookieStore.remove('auth_session');
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
