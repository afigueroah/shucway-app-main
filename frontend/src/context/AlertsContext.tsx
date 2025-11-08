// ================================================================
// 🚨 CONTEXTO DE ALERTAS DEL SISTEMA
// ================================================================

import React, { createContext, useState, ReactNode } from 'react';

export interface SystemAlert {
  id: string;
  message: string;
  icon: React.ReactNode;
  module: string;
  action: () => void;
}

interface AlertsContextType {
  alerts: SystemAlert[];
  addAlert: (alert: Omit<SystemAlert, 'id'>) => void;
  removeAlert: (id: string) => void;
  clearAlerts: () => void;
}

const AlertsContext = createContext<AlertsContextType | undefined>(undefined);

interface AlertsProviderProps {
  children: ReactNode;
}

export const AlertsProvider: React.FC<AlertsProviderProps> = ({ children }) => {
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [errorCounts, setErrorCounts] = useState<Map<string, number>>(new Map());

  const addAlert = (alert: Omit<SystemAlert, 'id'>) => {
    const key = `${alert.message}-${alert.module}`;
    const currentCount = errorCounts.get(key) || 0;

    if (currentCount >= 3) {
      // No agregar más alertas del mismo tipo después de 3 veces
      return;
    }

    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const newAlert: SystemAlert = {
      ...alert,
      id,
    };
    setAlerts(prev => [...prev, newAlert]);
    setErrorCounts(prev => new Map(prev).set(key, currentCount + 1));
  };

  const removeAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const clearAlerts = () => {
    setAlerts([]);
  };

  return (
    <AlertsContext.Provider value={{ alerts, addAlert, removeAlert, clearAlerts }}>
      {children}
    </AlertsContext.Provider>
  );
};

export { AlertsContext };