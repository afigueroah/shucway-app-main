import { useContext } from 'react';
import { AuthContext, AuthContextType } from '../context/AuthContext';

// Hook personalizado para usar nuestro contexto fácilmente
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};
