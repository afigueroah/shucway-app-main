// ================================================================
// 🔐 HANDLE LOGOUT (USANDO BACKEND JWT)
// ================================================================
// Este archivo mantiene compatibilidad con el código existente
// pero ahora usa el nuevo servicio de autenticación

import { logout } from './authService';

export const handleLogout = async (): Promise<void> => {
  await logout();
  window.location.href = "/login";
};
