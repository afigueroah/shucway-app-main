// ================================================================
// 🔐 CONSTANTES DE PERMISOS
// ================================================================
// Define los niveles de acceso y permisos del sistema
// Basado en la tabla rol_usuario de BD-modificado.sql

export enum PermissionLevel {
  PROPIETARIO = 100,
  ADMINISTRADOR = 80,
  CAJERO = 30,
  CLIENTE = 10,
}

export enum RoleName {
  PROPIETARIO = 'propietario',
  ADMINISTRADOR = 'administrador',
  CAJERO = 'cajero',
  CLIENTE = 'cliente',
}

// Mapeo de roles a niveles de permisos
export const ROLE_PERMISSIONS: Record<string, number> = {
  [RoleName.PROPIETARIO]: PermissionLevel.PROPIETARIO,
  [RoleName.ADMINISTRADOR]: PermissionLevel.ADMINISTRADOR,
  [RoleName.CAJERO]: PermissionLevel.CAJERO,
  [RoleName.CLIENTE]: PermissionLevel.CLIENTE,
};

// Permisos mínimos requeridos para cada módulo
export const MODULE_PERMISSIONS = {
  // Dashboard básico - todos los usuarios autenticados
  DASHBOARD: PermissionLevel.CLIENTE,
  
  // Perfil - todos pueden ver su propio perfil
  PERFIL: PermissionLevel.CLIENTE,
  
  // Ventas - cajeros y superiores (antes meseros, ahora cajeros)
  VENTAS: PermissionLevel.CAJERO,
  REALIZAR_VENTA: PermissionLevel.CAJERO,
  VER_VENTAS: PermissionLevel.CAJERO,
  ANULAR_VENTA: PermissionLevel.CAJERO,
  
  // Inventario - cajeros y superiores
  INVENTARIO: PermissionLevel.CAJERO,
  VER_INVENTARIO: PermissionLevel.CAJERO,
  EDITAR_INVENTARIO: PermissionLevel.ADMINISTRADOR,
  
  // Reportes - cajeros y superiores
  REPORTES: PermissionLevel.CAJERO,
  REPORTES_AVANZADOS: PermissionLevel.ADMINISTRADOR,
  
  // Administración - administradores y superiores
  ADMINISTRACION: PermissionLevel.ADMINISTRADOR,
  GESTIONAR_USUARIOS: PermissionLevel.ADMINISTRADOR,

  // Caja - cajeros y superiores
  CAJA: PermissionLevel.CAJERO,
  
  // Configuración - solo propietario
  CONFIGURACION: PermissionLevel.PROPIETARIO,
  MANTENIMIENTO: PermissionLevel.PROPIETARIO,
  CONSULTAS_SQL: PermissionLevel.PROPIETARIO,
  BACKUP: PermissionLevel.PROPIETARIO,
} as const;

// Función helper para verificar si un rol tiene permiso
export const hasPermission = (
  userRole: string | null,
  requiredLevel: number
): boolean => {
  if (!userRole) return false;
  
  const userLevel = ROLE_PERMISSIONS[userRole.toLowerCase()];
  if (userLevel === undefined) return false;
  
  return userLevel >= requiredLevel;
};

// Función helper para obtener el nivel de un rol
export const getRoleLevel = (role: string | null): number => {
  if (!role) return 0;
  return ROLE_PERMISSIONS[role.toLowerCase()] || 0;
};
