// ================================================================
// 🛡️ ROLE GUARD - Protección por Nivel de Permisos
// ================================================================
// Guard que verifica si el usuario tiene el nivel de permiso requerido

import React, { FC } from 'react';
import { Result, Button, Spin } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from '../hooks/useAuth';

interface RoleGuardProps {
  children: React.ReactNode;
  requiredLevel: number;
  fallbackPath?: string;
}

/**
 * Guard que protege rutas según nivel de permisos
 * @param children - Componente hijo a renderizar si tiene permisos
 * @param requiredLevel - Nivel mínimo de permiso requerido
 * @param fallbackPath - Ruta a la que redirigir si no tiene permisos (opcional)
 */
const RoleGuard: FC<RoleGuardProps> = ({ 
  children, 
  requiredLevel,
  fallbackPath = '/dashboard'
}) => {
  const navigate = useNavigate();
  const { checkPermission, role } = usePermissions();
  const { loading, user } = useAuth();

  // Mostrar spinner mientras carga (sin tip para evitar warning)
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        gap: '16px'
      }}>
        <Spin size='large' />
        <span style={{ color: '#666' }}>Verificando permisos...</span>
      </div>
    );
  }

  // Verificar permisos
  const hasAccess = checkPermission(requiredLevel);

  if (!hasAccess) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        backgroundColor: '#f0f2f5'
      }}>
        <Result
          status="403"
          icon={<LockOutlined style={{ fontSize: 72, color: '#ff4d4f' }} />}
          title="Acceso Denegado"
          subTitle={
            <>
              Lo sentimos, no tienes permisos suficientes para acceder a esta sección.
              <br />
              <strong>Tu rol:</strong> {role || 'Sin asignar'}
              <br />
              <strong>Usuario:</strong> {user?.email || 'Desconocido'}
            </>
          }
          extra={[
            <Button 
              type="primary" 
              key="dashboard" 
              onClick={() => navigate(fallbackPath)}
            >
              Volver al Dashboard
            </Button>,
            <Button 
              key="perfil" 
              onClick={() => navigate('/perfil')}
            >
              Ver Mi Perfil
            </Button>,
          ]}
        />
      </div>
    );
  }

  return <>{children}</>;
};

export default RoleGuard;
