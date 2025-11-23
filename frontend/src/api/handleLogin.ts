// ================================================================
// 🔐 HANDLE LOGIN (USANDO BACKEND JWT)
// ================================================================

import { message } from "antd";
import api from "./apiClient";
import { localStore, cookieStore } from "../utils/storage";

export const handleLogin = async (
  identifier: string,
  password: string,
  options?: { useAntd?: boolean }
): Promise<boolean> => {
  try {
    const response = await api.post('/auth/login', {
      identifier,
      password,
    });

    if (response.data.success) {
      // Guardar el token JWT usando el sistema de storage optimizado
      const { token, refreshToken, user } = response.data.data;
      
      // Validar que el token sea un string válido
      if (!token || typeof token !== 'string' || !token.trim()) {
        console.error('Token inválido recibido del servidor:', token);
        message.error('Error: Token inválido recibido del servidor');
        return false;
      }
      
      console.log('Guardando token en storage optimizado:', token.substring(0, 20) + '...');
      
      // Guardar en localStorage optimizado con expiración
      localStore.set('access_token', token.trim(), { expires: 60 * 24 * 1 }); // 1 día
      localStore.set('refreshToken', refreshToken, { expires: 60 * 24 * 30 }); // 30 días
      localStore.set('user', user, { expires: 60 * 24 * 7 }); // 7 días

      // También guardar en cookies para persistencia adicional
      cookieStore.set('auth_session', JSON.stringify({ token: token.trim(), user }), {
        expires: 60 * 24 * 1, // 1 día
        secure: true,
        sameSite: 'strict'
      });

      console.log('✅ Token guardado correctamente en storage optimizado');
      if (options?.useAntd !== false) {
        message.success("¡Sesión iniciada correctamente!");
      }
      return true;
    } else {
      if (options?.useAntd !== false) {
        message.error(response.data.error || "Error al iniciar sesión");
      }
      return false;
    }
  } catch (error: unknown) {
    console.error('Error en login:', error);

    // Manejar diferentes tipos de errores
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { status?: number; data?: { error?: string } } };
      if (axiosError.response?.status === 400) {
        if (options?.useAntd !== false) {
          message.error("Credenciales incorrectas. Verifica tu usuario y contraseña.");
        }
      } else if (axiosError.response?.status === 401 || axiosError.response?.status === 404) {
        if (options?.useAntd !== false) {
          message.error("Credenciales incorrectas. Verifica tu usuario y contraseña.");
        }
      } else if (axiosError.response?.status === 429) {
        if (options?.useAntd !== false) {
          message.error("Demasiados intentos. Intenta más tarde.");
        }
      } else {
        if (options?.useAntd !== false) {
          message.error(axiosError.response?.data?.error || "Error al conectar con el servidor");
        }
      }
    } else {
      if (options?.useAntd !== false) {
        message.error("Error al conectar con el servidor");
      }
    }

    return false;
  }
};
