import React from 'react';
import { usePermissions } from '../../hooks/usePermissions';

interface ModuleGuardProps {
  moduleName: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Componente que protege módulos basados en permisos de usuario
 * Para usuarios con nivel <= 30, solo permite acceso a DASHBOARD, REPORTES e INVENTARIO
 */
export const ModuleGuard: React.FC<ModuleGuardProps> = ({
  moduleName,
  children,
  fallback = null
}) => {
  const { isModuleAllowed } = usePermissions();

  // Verificar permisos del módulo
  const allowed = isModuleAllowed(moduleName);

  if (!allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

interface MenuItemGuardProps {
  moduleName: string;
  children: React.ReactNode;
}

/**
 * Componente específico para proteger elementos de menú
 * Oculta completamente el elemento si no tiene permisos
 */
export const MenuItemGuard: React.FC<MenuItemGuardProps> = ({
  moduleName,
  children
}) => {
  const { isModuleAllowed } = usePermissions();

  // Verificar permisos del módulo para el menú
  const allowed = isModuleAllowed(moduleName);

  // Si no tiene permisos, no mostrar el elemento del menú
  if (!allowed) {
    return null;
  }

  return <>{children}</>;
};