// ================================================================
// 🔔 HOOK DE MONITOREO DE STOCK
// Monitorea el inventario periódicamente y dispara alertas
// cuando insumos tienen stock mínimo
// ================================================================

import React, { useEffect, useRef, useCallback } from 'react';
import { dashboardService } from '../api/dashboardService';
import { useAlerts } from './useAlerts';
import { useNavigate } from 'react-router-dom';
import { MdWarning, MdError } from 'react-icons/md';
import { localStore } from '../utils/storage';

export interface StockAlert {
  id: string;
  insumoNombre: string;
  stockActual: number;
  stockMinimo: number;
  esAgotado: boolean;
}

export const useStockMonitoring = (enabled: boolean = true) => {
  const { addAlert } = useAlerts();
  const navigate = useNavigate();
  const monitoringRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Almacenar estado anterior del inventario para detectar cambios
  // y evitar alertas duplicadas en el mismo ciclo
  const lastInventoryStateRef = useRef<Map<string, StockAlert>>(new Map());

  // Limpiar intervalo al desmontar
  useEffect(() => {
    return () => {
      if (monitoringRef.current) {
        clearInterval(monitoringRef.current);
      }
    };
  }, []);

  // Función para procesdar alertas de stock
  const processStockAlerts = useCallback(async () => {
    if (!enabled) return;

    try {
      // Obtener inventario actual
      const inventoryData = await dashboardService.getInventoryData();
      
      const allInsumos = [...inventoryData.perpetual, ...inventoryData.operational];
      const currentState = new Map<string, StockAlert>();

      // Procesar cada insumo
      allInsumos.forEach((insumo) => {
        if (!insumo.id || !insumo.name) return;

        // Extraer valores numéricos
        const stockActual = Number(insumo.cantidad_actual ?? 0);
        
        // Verificar si está en stock mínimo (indica que está bajo/crítico)
        const esStockBajo = insumo.note?.includes('Stock Bajo') === true;
        const esAgotado = insumo.note?.includes('Sin Stock') === true;

        if (esStockBajo || esAgotado) {
          const alertId = `stock-${insumo.id}`;
          currentState.set(alertId, {
            id: alertId,
            insumoNombre: insumo.name,
            stockActual,
            stockMinimo: 0,
            esAgotado
          });

          // Verificar si esta alerta ya fue mostrada en el ciclo anterior
          const wasShownBefore = lastInventoryStateRef.current.has(alertId);
          
          // Solo mostrar si es una alerta NUEVA (no estaba en el ciclo anterior)
          if (!wasShownBefore) {
            const mensaje = esAgotado
              ? `Sin stock: '${insumo.name}' está agotado. Se debe hacer una orden de compra.`
              : `Stock crítico: '${insumo.name}' tiene ${stockActual} unidades. Se debe hacer una orden de compra.`;

            // Calcular el icono antes
            const alertIcon = esAgotado 
              ? React.createElement(MdError, { size: 18 })
              : React.createElement(MdWarning, { size: 18 });

            // Crear función de acción que abre modal de Nueva Orden
            const handleAction = () => {
              // Usar storage optimizado para señalar que se debe abrir el modal de nueva orden
              localStore.set('openNewOrderModal', 'true');
              // Navegar a ingreso-compra donde se abrirá el modal automáticamente
              navigate('/inventario/ingreso-compra');
            };

            // Agregar alerta con toda la información requerida
            addAlert({
              message: mensaje,
              icon: alertIcon,
              module: 'Inventario',
              action: handleAction
            });

            // Log removido para evitar spam en consola
          }
        }
      });

      // Actualizar estado anterior
      lastInventoryStateRef.current = currentState;
    } catch (error) {
      console.error('Error en monitoreo de stock:', error);
    }
  }, [enabled, addAlert, navigate]);

  // Iniciar monitoreo cada 2 horas
  useEffect(() => {
    if (!enabled) {
      if (monitoringRef.current) {
        clearInterval(monitoringRef.current);
        monitoringRef.current = null;
      }
      return;
    }

    // Ejecutar inmediatamente al activar
    processStockAlerts();

    // Luego ejecutar cada 2 horas (7200000 ms = 2 * 60 * 60 * 1000)
    monitoringRef.current = setInterval(processStockAlerts, 7200000);

    return () => {
      if (monitoringRef.current) {
        clearInterval(monitoringRef.current);
        monitoringRef.current = null;
      }
    };
  }, [enabled, processStockAlerts]);

  return {};
};
