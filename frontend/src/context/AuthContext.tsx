import { createContext, useState, useEffect, ReactNode } from 'react';
import { validateToken, AuthUser } from '../api/authService';
import { localStore } from '../utils/storage';

// Definimos la estructura de lo que nuestro contexto proveerá
export interface AuthContextType {
  user: AuthUser | null;
  role: string | null;
  roleLevel: number | null; // Nivel de permiso del rol
  loading: boolean;
  refreshUser: () => Promise<void>;
  hasPermission: (requiredLevel: number) => boolean; // Función para verificar permisos
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Creamos el "Proveedor" que envolverá nuestra aplicación
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [roleLevel, setRoleLevel] = useState<number | null>(null);
  const [loading, setLoading] = useState(true); // Iniciar en true para evitar problemas de timing

  const refreshUser = async () => {
    try {
      setLoading(true);
      
      // Verificar si hay token en storage optimizado
      const token = localStore.get('access_token');
      
      if (!token) {
        // No hay token, usuario no autenticado
        setUser(null);
        setRole(null);
        setRoleLevel(null);
        setLoading(false);
        return;
      }
      
      // Intentar validar el token con el backend
      const validatedUser = await validateToken();
      
      if (validatedUser) {
        setUser(validatedUser);
        setRole(validatedUser.role.nombre_rol);
        setRoleLevel(validatedUser.role.nivel_permisos);
      } else {
        // Token inválido, limpiar todo
        setUser(null);
        setRole(null);
        setRoleLevel(null);
        localStore.remove('access_token');
        localStore.remove('user');
        localStore.remove('refreshToken');
      }
    } catch (err) {
      console.error('Error al validar usuario:', err);
      setUser(null);
      setRole(null);
      setRoleLevel(null);
      localStore.remove('access_token');
      localStore.remove('user');
      localStore.remove('refreshToken');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Verificar token al montar el componente
    const token = localStore.get('access_token');
    if (token) {
      refreshUser();
    } else {
      setLoading(false); // Si no hay token, terminar loading
    }
  }, []); // Solo se ejecuta una vez al montar

  const hasPermission = (requiredLevel: number): boolean => {
    // Si no hay roleLevel, asumir permisos básicos (cliente)
    const currentLevel = roleLevel ?? 10;
    return currentLevel >= requiredLevel;
  };

  const value = { user, role, roleLevel, loading, refreshUser, hasPermission };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Exportamos el contexto para usos avanzados si es necesario
export { AuthContext };