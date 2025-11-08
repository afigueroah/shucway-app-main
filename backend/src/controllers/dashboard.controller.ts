import { Request, Response } from 'express';
import { dashboardService } from '../services/dashboard.service';

export const dashboardController = {
  async getStats(_req: Request, res: Response) {
    try {
      const stats = await dashboardService.getStats();
      res.json(stats);
    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      res.status(500).json({ message: 'Error al obtener estadísticas del dashboard' });
    }
  },

  async getVentasSemana(_req: Request, res: Response) {
    try {
      const ventas = await dashboardService.getVentasSemana();
      res.json(ventas);
    } catch (error) {
      console.error('Error al obtener ventas de la semana:', error);
      res.status(500).json({ message: 'Error al obtener ventas de la semana' });
    }
  },

  async getAlertasRecientes(_req: Request, res: Response) {
    try {
      const alertas = await dashboardService.getAlertasRecientes();
      res.json(alertas);
    } catch (error) {
      console.error('Error al obtener alertas recientes:', error);
      res.status(500).json({ message: 'Error al obtener alertas recientes' });
    }
  },

  async getAvailableTables(_req: Request, res: Response) {
    try {
      const tables = await dashboardService.getAvailableTables();
      res.json({ tables });
    } catch (error) {
      console.error('Error al obtener tablas disponibles:', error);
      res.status(500).json({ message: 'Error al obtener tablas disponibles' });
    }
  },

  async getTableColumns(req: Request, res: Response) {
    try {
      const { tableName } = req.params;
      if (!tableName) {
        return res.status(400).json({ message: 'Nombre de tabla requerido' });
      }

      const columns = await dashboardService.getTableColumns(tableName);
      res.json({ columns });
      return;
    } catch (error) {
      console.error('Error al obtener columnas de la tabla:', error);
      res.status(500).json({ message: 'Error al obtener columnas de la tabla' });
      return;
    }
  },

  async getTableData(req: Request, res: Response) {
    try {
      const { tableName } = req.params;
      const filters = req.query.filters ? JSON.parse(req.query.filters as string) : {};

      if (!tableName) {
        return res.status(400).json({ message: 'Nombre de tabla requerido' });
      }

      const data = await dashboardService.getTableData(tableName, filters);
      res.json({ data });
      return;
    } catch (error) {
      console.error('Error al obtener datos de la tabla:', error);
      if (error instanceof Error && error.message.includes('permission denied')) {
        res.status(403).json({ message: `No tienes permisos para acceder a la tabla ${req.params.tableName}` });
      } else {
        res.status(500).json({ message: 'Error al obtener datos de la tabla' });
      }
      return;
    }
  },

  async createRecord(req: Request, res: Response) {
    try {
      const { tableName } = req.params;
      const values = req.body;
      if (!tableName) return res.status(400).json({ message: 'Nombre de tabla requerido' });
      const created = await dashboardService.createRecord(tableName, values);
      res.status(201).json({ data: created });
      return;
    } catch (error) {
      console.error('Error creando registro:', error);
      res.status(500).json({ message: 'Error al crear el registro' });
      return;
    }
  },

  async updateRecord(req: Request, res: Response) {
    try {
      const { tableName, id } = req.params;
      const values = req.body;
      if (!tableName || !id) return res.status(400).json({ message: 'Nombre de tabla e id requerido' });
      const updated = await dashboardService.updateRecord(tableName, id, values);
      res.json({ data: updated });
      return;
    } catch (error) {
      console.error('Error actualizando registro:', error);
      res.status(500).json({ message: 'Error al actualizar el registro' });
      return;
    }
  },

  async deleteRecord(req: Request, res: Response) {
    try {
      const { tableName, id } = req.params;
      if (!tableName || !id) return res.status(400).json({ message: 'Nombre de tabla e id requerido' });
      await dashboardService.deleteRecord(tableName, id);
      res.json({ success: true });
      return;
    } catch (error) {
      console.error('Error eliminando registro:', error);
      res.status(500).json({ message: 'Error al eliminar el registro' });
      return;
    }
  },

  async getInventoryData(_req: Request, res: Response) {
    try {
      const data = await dashboardService.getInventoryData();
      res.json(data);
    } catch (error) {
      console.error('Error al obtener datos de inventario:', error);
      res.status(500).json({ message: 'Error al obtener datos de inventario' });
    }
  },

  // Devuelve el conteo de tablas disponibles (utiliza la lista de dashboardService como referencia)
  async getTablesCount(_req: Request, res: Response) {
    try {
      const tables = await dashboardService.getAvailableTables();
      res.json({ count: Array.isArray(tables) ? tables.length : 0 });
    } catch (error) {
      console.error('Error al obtener conteo de tablas:', error);
      res.status(500).json({ message: 'Error al obtener conteo de tablas' });
    }
  },

  // Devuelve cambios recientes en los módulos del sistema
  async getRecentChanges(_req: Request, res: Response) {
    try {
      // Simular actualizaciones del sistema (en producción, esto vendría de una tabla de auditoría)
      const systemUpdates = [
        {
          id: 1,
          type: 'Actualización',
          module: 'Usuarios',
          date: new Date(Date.now() - 1000 * 60 * 30).toISOString().slice(0, 19).replace('T', ' '), // 30 min atrás
          user: 'Admin'
        },
        {
          id: 2,
          type: 'Creación',
          module: 'Productos',
          date: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString().slice(0, 19).replace('T', ' '), // 2 horas atrás
          user: 'Supervisor'
        },
        {
          id: 3,
          type: 'Modificación',
          module: 'Inventario',
          date: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString().slice(0, 19).replace('T', ' '), // 4 horas atrás
          user: 'Almacén'
        },
        {
          id: 4,
          type: 'Eliminación',
          module: 'Ventas',
          date: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString().slice(0, 19).replace('T', ' '), // 6 horas atrás
          user: 'Cajero'
        },
        {
          id: 5,
          type: 'Configuración',
          module: 'Sistema',
          date: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString().slice(0, 19).replace('T', ' '), // 8 horas atrás
          user: 'Admin'
        }
      ];

      res.json(systemUpdates);
      return;
    } catch (error) {
      console.error('Error al obtener cambios recientes del sistema:', error);
      res.status(500).json({ message: 'Error al obtener cambios recientes del sistema' });
      return;
    }
  }
};